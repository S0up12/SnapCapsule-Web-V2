from __future__ import annotations

import argparse
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import select

from snapcapsule_core.config import get_settings
from snapcapsule_core.db import SessionLocal
from snapcapsule_core.models import Asset
from snapcapsule_core.models.enums import AssetSource
from snapcapsule_core.services.ingestion import IngestionService
from snapcapsule_core.services.media_processor import MediaProcessor


@dataclass(slots=True)
class OverlayRepairCandidate:
    key: str
    main_asset: Asset
    overlay_asset: Asset


def asset_stem_token(service: IngestionService, asset: Asset) -> str:
    if asset.external_id and ":" in asset.external_id:
        return asset.external_id.split(":", 1)[1]

    metadata = asset.raw_metadata or {}
    relative_path = metadata.get("relative_path")
    if isinstance(relative_path, str) and relative_path.strip():
        return Path(relative_path).stem

    source_path = metadata.get("source_path")
    if isinstance(source_path, str) and source_path.strip():
        return Path(source_path).stem

    return Path(asset.original_path).stem


def normalized_group_key(service: IngestionService, asset: Asset) -> str:
    return service.normalize_media_stem(Path(asset_stem_token(service, asset)))


def is_overlay_asset(service: IngestionService, asset: Asset) -> bool:
    return service.is_overlay_variant(Path(asset_stem_token(service, asset)))


def build_candidates(service: IngestionService, assets: list[Asset]) -> tuple[list[OverlayRepairCandidate], dict[str, int]]:
    grouped: dict[str, dict[str, list[Asset]]] = defaultdict(lambda: {"main": [], "overlay": []})
    stats = {
        "total_assets": len(assets),
        "overlay_assets": 0,
        "overlay_only_groups": 0,
        "ambiguous_main_groups": 0,
        "ambiguous_overlay_groups": 0,
        "already_linked": 0,
        "candidates": 0,
    }

    for asset in assets:
        key = normalized_group_key(service, asset)
        if is_overlay_asset(service, asset):
            grouped[key]["overlay"].append(asset)
            stats["overlay_assets"] += 1
        else:
            grouped[key]["main"].append(asset)

    candidates: list[OverlayRepairCandidate] = []
    for key, payload in grouped.items():
        mains = payload["main"]
        overlays = payload["overlay"]
        if not overlays:
            continue
        if not mains:
            stats["overlay_only_groups"] += 1
            continue
        if len(mains) != 1:
            stats["ambiguous_main_groups"] += 1
            continue
        if len(overlays) != 1:
            stats["ambiguous_overlay_groups"] += 1
            continue

        main_asset = mains[0]
        overlay_asset = overlays[0]
        if main_asset.overlay_path:
            stats["already_linked"] += 1
            continue

        candidates.append(
            OverlayRepairCandidate(
                key=key,
                main_asset=main_asset,
                overlay_asset=overlay_asset,
            )
        )

    stats["candidates"] = len(candidates)
    return candidates, stats


def merge_tags(main_asset: Asset, overlay_asset: Asset) -> list[str]:
    return sorted(
        {str(tag).strip() for tag in [*(main_asset.tags or []), *(overlay_asset.tags or [])] if str(tag).strip()},
        key=str.lower,
    )


def apply_repairs(candidates: list[OverlayRepairCandidate], *, apply_changes: bool) -> dict[str, int]:
    settings = get_settings()
    processor = MediaProcessor(settings) if apply_changes else None
    session = SessionLocal()
    repaired = 0
    deleted_assets = 0
    regenerated_thumbnails = 0
    removed_overlay_thumbnails = 0
    failed = 0

    try:
        for candidate in candidates:
            main_asset = session.get(Asset, candidate.main_asset.id)
            overlay_asset = session.get(Asset, candidate.overlay_asset.id)
            if main_asset is None or overlay_asset is None:
                failed += 1
                continue

            try:
                main_asset.overlay_path = overlay_asset.original_path
                main_asset.is_favorite = bool(main_asset.is_favorite or overlay_asset.is_favorite)
                main_asset.tags = merge_tags(main_asset, overlay_asset)

                metadata = dict(main_asset.raw_metadata or {})
                overlay_metadata = dict(overlay_asset.raw_metadata or {})
                metadata["overlay_source_path"] = overlay_metadata.get("source_path") or metadata.get("overlay_source_path")
                metadata["overlay_relative_path"] = overlay_metadata.get("relative_path") or metadata.get("overlay_relative_path")
                metadata["repaired_overlay_asset_id"] = str(overlay_asset.id)
                main_asset.raw_metadata = metadata

                repaired += 1
                if apply_changes:
                    thumbnail = processor.generate_thumbnail(
                        str(main_asset.id),
                        main_asset.original_path,
                        main_asset.media_type,
                        main_asset.overlay_path,
                    )
                    main_asset.thumbnail_path = str(thumbnail) if thumbnail else None
                    regenerated_thumbnails += 1

                    overlay_thumbnail_path = Path(overlay_asset.thumbnail_path) if overlay_asset.thumbnail_path else None
                    if overlay_thumbnail_path and overlay_thumbnail_path.exists():
                        overlay_thumbnail_path.unlink(missing_ok=True)
                        removed_overlay_thumbnails += 1

                    session.delete(overlay_asset)
                    deleted_assets += 1
            except Exception:
                failed += 1
                if apply_changes:
                    raise

        if apply_changes:
            session.commit()
            print("Overlay repair complete. Database changes were saved.")
        else:
            session.rollback()
            print("Dry run complete. No database changes were saved.")

        print(f"repaired_pairs: {repaired}")
        print(f"deleted_overlay_assets: {deleted_assets}")
        print(f"regenerated_thumbnails: {regenerated_thumbnails}")
        print(f"removed_overlay_thumbnails: {removed_overlay_thumbnails}")
        print(f"failed_pairs: {failed}")
        return {
            "repaired_pairs": repaired,
            "deleted_overlay_assets": deleted_assets,
            "regenerated_thumbnails": regenerated_thumbnails,
            "removed_overlay_thumbnails": removed_overlay_thumbnails,
            "failed_pairs": failed,
        }
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Repair already-imported Snapchat memory overlays without reimporting the archive.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Persist database changes and regenerate thumbnails. Omit to run in dry-run mode.",
    )
    args = parser.parse_args()

    session = SessionLocal()
    try:
        assets = session.scalars(
            select(Asset)
            .where(Asset.source_type == AssetSource.MEMORY)
            .order_by(Asset.created_at, Asset.id)
        ).all()
    finally:
        session.close()

    service = IngestionService(get_settings())
    candidates, stats = build_candidates(service, assets)

    print(f"memory_assets: {stats['total_assets']}")
    print(f"overlay_assets: {stats['overlay_assets']}")
    print(f"overlay_only_groups: {stats['overlay_only_groups']}")
    print(f"ambiguous_main_groups: {stats['ambiguous_main_groups']}")
    print(f"ambiguous_overlay_groups: {stats['ambiguous_overlay_groups']}")
    print(f"already_linked: {stats['already_linked']}")
    print(f"repair_candidates: {stats['candidates']}")

    if candidates:
        print("")
        print("Sample candidates:")
        for candidate in candidates[:10]:
            print(f"  {candidate.key}")
            print(f"    main:    {candidate.main_asset.original_path}")
            print(f"    overlay: {candidate.overlay_asset.original_path}")

    print("")
    apply_repairs(candidates, apply_changes=args.apply)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
