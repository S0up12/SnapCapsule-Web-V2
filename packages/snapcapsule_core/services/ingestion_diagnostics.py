from __future__ import annotations

import uuid
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import cast, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session

from snapcapsule_core.config import Settings
from snapcapsule_core.models import Asset, IngestionJob
from snapcapsule_core.services.ingestion_jobs import TERMINAL_INGESTION_JOB_STATUSES, get_job_metadata, set_job_metadata
from snapcapsule_core.services.media_processor import MediaProcessor


@dataclass(frozen=True, slots=True)
class FailedIngestionAssetRecord:
    asset_id: uuid.UUID
    filename: str
    media_type: str
    processing_state: str | None
    error_message: str | None
    source_path: str | None
    available_path: str | None


def list_failed_ingestion_assets(session: Session, job_id: uuid.UUID, settings: Settings) -> list[FailedIngestionAssetRecord]:
    assets = session.execute(
        select(Asset).where(
            cast(Asset.raw_metadata, JSONB).contains({"job_id": str(job_id)}),
        )
    ).scalars().all()

    records: list[FailedIngestionAssetRecord] = []
    for asset in assets:
        metadata = dict(asset.raw_metadata or {})
        error_message = metadata.get("processing_error")
        if not error_message:
            continue

        source_path = str(metadata.get("source_path")) if metadata.get("source_path") else None
        available_path = resolve_failed_asset_path(asset, settings)
        filename = Path(source_path).name if source_path else Path(available_path or asset.original_path).name
        records.append(
            FailedIngestionAssetRecord(
                asset_id=asset.id,
                filename=filename,
                media_type=asset.media_type.value,
                processing_state=str(metadata.get("processing") or "") or None,
                error_message=str(error_message),
                source_path=source_path,
                available_path=str(available_path) if available_path else None,
            )
        )

    records.sort(key=lambda item: (item.filename.lower(), str(item.asset_id)))
    return records


def resolve_failed_asset_path(asset: Asset, settings: Settings) -> Path | None:
    metadata = dict(asset.raw_metadata or {})
    source_path_raw = metadata.get("source_path")
    candidates: list[Path] = []

    if source_path_raw:
        source_path = Path(str(source_path_raw))
        processor_path = MediaProcessor(settings).raw_destination_path(str(asset.id), asset.source_type, source_path.suffix)
        candidates.append(processor_path)
        candidates.append(source_path)

    if asset.original_path:
        candidates.append(Path(asset.original_path))

    seen: set[str] = set()
    for candidate in candidates:
        key = str(candidate)
        if key in seen:
            continue
        seen.add(key)
        if candidate.exists() and candidate.is_file():
            return candidate
    return None


def acknowledge_ingestion_issues(session: Session, job_id: uuid.UUID) -> IngestionJob | None:
    job = session.get(IngestionJob, job_id)
    if job is None:
        return None

    metadata = get_job_metadata(job)
    metadata["issues_reviewed"] = True
    set_job_metadata(job, metadata)
    session.flush()
    return job


def clear_terminal_ingestion_history(session: Session) -> int:
    jobs = session.execute(
        select(IngestionJob).where(IngestionJob.status.in_(tuple(TERMINAL_INGESTION_JOB_STATUSES)))
    ).scalars().all()

    cleared = 0
    for job in jobs:
        session.delete(job)
        cleared += 1

    session.flush()
    return cleared
