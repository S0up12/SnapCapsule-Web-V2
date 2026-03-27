from __future__ import annotations

import argparse

from snapcapsule_core.config import get_settings
from snapcapsule_core.db import SessionLocal
from snapcapsule_core.models import Asset
from snapcapsule_core.models.enums import MediaType
from snapcapsule_core.services.media_processor import MediaProcessor
from sqlalchemy import select


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Detect audio-only media files among imported video assets and reclassify them as audio.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Persist media_type changes. Omit to run in dry-run mode.",
    )
    args = parser.parse_args()

    processor = MediaProcessor(get_settings())
    session = SessionLocal()

    try:
        assets = session.scalars(
            select(Asset)
            .where(Asset.media_type == MediaType.VIDEO)
            .order_by(Asset.created_at, Asset.id)
        ).all()

        checked = 0
        changed = 0
        missing = 0

        for asset in assets:
            checked += 1
            if not asset.original_path:
                missing += 1
                continue

            try:
                detected_type = processor.detect_actual_media_type(asset.original_path, asset.media_type)
            except Exception:
                continue

            if detected_type == asset.media_type:
                continue

            changed += 1
            if args.apply:
                asset.media_type = detected_type
                if detected_type == MediaType.AUDIO:
                    asset.thumbnail_path = None

        if args.apply:
            session.commit()
            print("Audio reclassification complete. Database changes were saved.")
        else:
            session.rollback()
            print("Dry run complete. No database changes were saved.")

        print(f"checked: {checked}")
        print(f"changed: {changed}")
        print(f"missing_original_path: {missing}")
        return 0
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    raise SystemExit(main())
