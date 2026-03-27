from __future__ import annotations

import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from snapcapsule_core.models import Asset
from snapcapsule_core.models.enums import MediaType
from snapcapsule_core.services.media_processor import MediaProcessor


@dataclass(slots=True)
class PlainThumbnailCandidate:
    asset_id: uuid.UUID
    media_type: MediaType
    original_path: str
    overlay_path: str | None


@dataclass(slots=True)
class ThumbnailRebuildCandidate:
    asset_id: uuid.UUID
    media_type: MediaType
    original_path: str
    overlay_path: str | None


def find_missing_plain_thumbnail_candidates(
    assets: Iterable[Asset],
    *,
    processor: MediaProcessor,
) -> tuple[list[PlainThumbnailCandidate], dict[str, int]]:
    candidates: list[PlainThumbnailCandidate] = []
    eligible_assets = 0
    already_present = 0

    for asset in assets:
        if asset.media_type not in {MediaType.IMAGE, MediaType.VIDEO}:
            continue
        if not asset.overlay_path or not asset.thumbnail_path:
            continue

        eligible_assets += 1
        plain_thumbnail_path = processor.resolve_existing_thumbnail_path(str(asset.id), include_overlay=False)
        if plain_thumbnail_path is not None:
            already_present += 1
            continue

        candidates.append(
            PlainThumbnailCandidate(
                asset_id=asset.id,
                media_type=asset.media_type,
                original_path=asset.original_path,
                overlay_path=asset.overlay_path,
            )
        )

    return candidates, {
        "eligible_assets": eligible_assets,
        "already_present": already_present,
        "candidates": len(candidates),
    }


def generate_missing_plain_thumbnails(
    candidates: Iterable[PlainThumbnailCandidate],
    *,
    processor: MediaProcessor,
    apply_changes: bool,
) -> dict[str, int]:
    generated = 0
    missing_original = 0
    failed = 0
    ready = 0

    for candidate in candidates:
        if not Path(candidate.original_path).exists():
            missing_original += 1
            continue

        ready += 1
        if not apply_changes:
            continue

        try:
            thumbnail = processor.generate_thumbnail(
                str(candidate.asset_id),
                candidate.original_path,
                candidate.media_type,
                candidate.overlay_path,
                include_overlay=False,
            )
        except Exception:
            failed += 1
            continue

        if thumbnail is None or not thumbnail.exists():
            failed += 1
            continue

        generated += 1

    return {
        "ready_to_generate": ready,
        "generated": generated,
        "missing_original": missing_original,
        "failed": failed,
    }


def find_thumbnail_rebuild_candidates(assets: Iterable[Asset]) -> list[ThumbnailRebuildCandidate]:
    candidates: list[ThumbnailRebuildCandidate] = []

    for asset in assets:
        if asset.media_type not in {MediaType.IMAGE, MediaType.VIDEO}:
            continue
        if not asset.original_path:
            continue

        candidates.append(
            ThumbnailRebuildCandidate(
                asset_id=asset.id,
                media_type=asset.media_type,
                original_path=asset.original_path,
                overlay_path=asset.overlay_path,
            )
        )

    return candidates


def rebuild_thumbnail_files(
    candidates: Iterable[ThumbnailRebuildCandidate],
    *,
    processor: MediaProcessor,
    apply_changes: bool,
) -> dict[str, int]:
    rebuilt = 0
    missing_original = 0
    failed = 0
    ready = 0

    for candidate in candidates:
        original_path = Path(candidate.original_path)
        if not original_path.exists():
            missing_original += 1
            continue

        ready += 1
        if not apply_changes:
            continue

        overlay_path = candidate.overlay_path if candidate.overlay_path and Path(candidate.overlay_path).exists() else None

        try:
            thumbnail = processor.generate_thumbnail(
                str(candidate.asset_id),
                original_path,
                candidate.media_type,
                overlay_path,
            )
            if thumbnail is None or not thumbnail.exists():
                failed += 1
                continue

            if overlay_path is not None:
                plain_thumbnail = processor.generate_thumbnail(
                    str(candidate.asset_id),
                    original_path,
                    candidate.media_type,
                    overlay_path,
                    include_overlay=False,
                )
                if plain_thumbnail is None or not plain_thumbnail.exists():
                    failed += 1
                    continue
        except Exception:
            failed += 1
            continue

        rebuilt += 1

    return {
        "ready_to_rebuild": ready,
        "rebuilt": rebuilt,
        "missing_original": missing_original,
        "failed": failed,
    }
