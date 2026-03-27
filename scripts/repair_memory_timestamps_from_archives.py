from __future__ import annotations

import argparse
import zipfile
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path

from snapcapsule_core.db import session_scope
from snapcapsule_core.models import Asset, IngestionJob, MemoryItem
from snapcapsule_core.models.enums import AssetSource, IngestionSourceKind, MediaType
from sqlalchemy import select


def zip_member_timestamp(member: zipfile.ZipInfo) -> datetime:
    return datetime(*member.date_time, tzinfo=UTC)


def build_archive_timestamp_index(archive_dir: Path) -> dict[str, datetime]:
    timestamps_by_relative_path: dict[str, list[datetime]] = defaultdict(list)

    for archive_path in sorted(archive_dir.glob("*.zip")):
        with zipfile.ZipFile(archive_path) as archive:
            for member in archive.infolist():
                if member.is_dir():
                    continue
                normalized_name = member.filename.replace("\\", "/").lstrip("./")
                timestamps_by_relative_path[normalized_name].append(zip_member_timestamp(member))

    resolved: dict[str, datetime] = {}
    for relative_path, candidates in timestamps_by_relative_path.items():
        if not candidates:
            continue
        resolved[relative_path] = max(candidates)
    return resolved


def main() -> int:
    parser = argparse.ArgumentParser(description="Repair memory timestamps from uploaded archive ZIP metadata.")
    parser.add_argument("--apply", action="store_true", help="Persist changes instead of running in dry-run mode.")
    args = parser.parse_args()

    with session_scope() as session:
        upload_jobs = session.execute(
            select(IngestionJob).where(IngestionJob.source_kind == IngestionSourceKind.UPLOAD)
        ).scalars().all()

        updated_assets = 0
        updated_memory_items = 0
        scanned_jobs = 0
        indexed_paths = 0

        for job in upload_jobs:
            archive_dir = Path(job.source_path)
            if not archive_dir.exists() or not archive_dir.is_dir():
                continue

            timestamp_index = build_archive_timestamp_index(archive_dir)
            if not timestamp_index:
                continue

            scanned_jobs += 1
            indexed_paths += len(timestamp_index)

            rows = session.execute(
                select(Asset, MemoryItem)
                .join(MemoryItem, MemoryItem.asset_id == Asset.id)
                .where(
                    Asset.source_type == AssetSource.MEMORY,
                    Asset.media_type.in_((MediaType.IMAGE, MediaType.VIDEO)),
                    Asset.raw_metadata.is_not(None),
                )
            ).all()

            for asset, memory_item in rows:
                metadata = asset.raw_metadata or {}
                if str(metadata.get("job_id")) != str(job.id):
                    continue
                relative_path = metadata.get("relative_path")
                if not isinstance(relative_path, str):
                    continue

                precise_timestamp = timestamp_index.get(relative_path)
                if precise_timestamp is None:
                    continue

                if asset.taken_at != precise_timestamp:
                    asset.taken_at = precise_timestamp
                    updated_assets += 1
                if memory_item.taken_at != precise_timestamp:
                    memory_item.taken_at = precise_timestamp
                    updated_memory_items += 1

        if not args.apply:
            session.rollback()

        print(
            {
                "mode": "apply" if args.apply else "dry-run",
                "scanned_jobs": scanned_jobs,
                "indexed_paths": indexed_paths,
                "updated_assets": updated_assets,
                "updated_memory_items": updated_memory_items,
            }
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
