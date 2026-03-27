from __future__ import annotations

import argparse

from snapcapsule_core.config import get_settings
from snapcapsule_core.db import SessionLocal
from snapcapsule_core.models import Asset
from snapcapsule_core.services.media_processor import MediaProcessor
from snapcapsule_core.services.thumbnail_repairs import (
    find_missing_plain_thumbnail_candidates,
    generate_missing_plain_thumbnails,
)
from sqlalchemy import select


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Backfill non-overlay memory thumbnails for already-imported assets.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Generate missing plain thumbnails. Omit to run in dry-run mode.",
    )
    args = parser.parse_args()

    settings = get_settings()
    processor = MediaProcessor(settings)

    session = SessionLocal()
    try:
        assets = session.scalars(
            select(Asset)
            .where(Asset.overlay_path.is_not(None), Asset.thumbnail_path.is_not(None))
            .order_by(Asset.created_at, Asset.id)
        ).all()
    finally:
        session.close()

    candidates, scan_stats = find_missing_plain_thumbnail_candidates(assets, processor=processor)

    print(f"eligible_assets: {scan_stats['eligible_assets']}")
    print(f"already_present: {scan_stats['already_present']}")
    print(f"missing_plain_thumbnails: {scan_stats['candidates']}")

    if candidates:
        print("")
        print("Sample assets:")
        for candidate in candidates[:10]:
            print(f"  {candidate.asset_id} [{candidate.media_type.value}]")
            print(f"    original: {candidate.original_path}")
            if candidate.overlay_path:
                print(f"    overlay:  {candidate.overlay_path}")

    print("")
    result = generate_missing_plain_thumbnails(
        candidates,
        processor=processor,
        apply_changes=args.apply,
    )

    if args.apply:
        print("Plain thumbnail backfill complete.")
    else:
        print("Dry run complete. No files were generated.")

    print(f"ready_to_generate: {result['ready_to_generate']}")
    print(f"generated: {result['generated']}")
    print(f"missing_original: {result['missing_original']}")
    print(f"failed: {result['failed']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
