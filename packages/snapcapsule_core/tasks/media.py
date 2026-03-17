from __future__ import annotations

import shutil
import uuid
from datetime import UTC, datetime
from pathlib import Path

from snapcapsule_core.config import get_settings
from snapcapsule_core.db import session_scope
from snapcapsule_core.models import Asset, IngestionJob
from snapcapsule_core.models.enums import IngestionJobStatus
from snapcapsule_core.queue import celery_app
from snapcapsule_core.services.media_processor import MediaProcessor


def _complete_job_if_finished(job: IngestionJob) -> None:
    total_done = job.processed_assets + job.failed_assets
    if job.total_assets == 0 or total_done < job.total_assets:
        return

    job.progress_percent = 100
    job.finished_at = datetime.now(UTC)
    if job.failed_assets > 0:
        job.status = IngestionJobStatus.FAILED
        job.detail_message = f"Completed with {job.failed_assets} failed media items"
    else:
        job.status = IngestionJobStatus.COMPLETED
        job.detail_message = "Ingestion completed"

    if job.workspace_path:
        shutil.rmtree(job.workspace_path, ignore_errors=True)


@celery_app.task(
    name="snapcapsule_core.tasks.media.generate_asset_derivatives",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def generate_asset_derivatives(asset_id: str) -> dict[str, str]:
    return {"asset_id": asset_id, "status": "pending"}


@celery_app.task(
    bind=True,
    name="snapcapsule_core.tasks.media.process_asset_media",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def process_asset_media(
    self,
    asset_id: str,
    source_path: str,
    overlay_source_path: str | None,
    job_id: str,
    preserve_source: bool = False,
) -> dict[str, str]:
    settings = get_settings()
    processor = MediaProcessor(settings)
    parsed_asset_id = uuid.UUID(asset_id)
    parsed_job_id = uuid.UUID(job_id)

    try:
        with session_scope() as session:
            asset = session.get(Asset, parsed_asset_id)
            job = session.get(IngestionJob, parsed_job_id, with_for_update=True)
            if asset is None or job is None:
                raise ValueError("Asset or ingestion job not found")

            raw_destination = processor.raw_destination_path(str(asset.id), asset.source_type, Path(source_path).suffix)
            overlay_destination = None
            if overlay_source_path:
                overlay_destination = processor.overlay_destination_path(
                    str(asset.id),
                    asset.source_type,
                    Path(overlay_source_path).suffix,
                )

        stored_media = raw_destination if raw_destination.exists() else processor.store_media_file(
            source_path,
            raw_destination,
            preserve_source=preserve_source,
        )
        stored_overlay = None
        if overlay_source_path and overlay_destination is not None:
            stored_overlay = (
                overlay_destination
                if overlay_destination.exists()
                else processor.store_media_file(
                    overlay_source_path,
                    overlay_destination,
                    preserve_source=preserve_source,
                )
            )

        with session_scope() as session:
            asset = session.get(Asset, parsed_asset_id)
            if asset is None:
                raise ValueError("Asset disappeared during processing")
            thumbnail = processor.generate_thumbnail(
                str(asset.id),
                stored_media,
                asset.media_type,
                stored_overlay,
            )
            checksum = processor.compute_checksum(stored_media)

            asset.original_path = str(stored_media)
            asset.overlay_path = str(stored_overlay) if stored_overlay else None
            asset.thumbnail_path = str(thumbnail) if thumbnail else None
            asset.checksum_sha256 = checksum
            metadata = dict(asset.raw_metadata or {})
            metadata["processing"] = "completed"
            asset.raw_metadata = metadata

            job = session.get(IngestionJob, parsed_job_id, with_for_update=True)
            if job is None:
                raise ValueError("Ingestion job disappeared during processing")
            job.processed_assets += 1
            if job.total_assets > 0:
                done = job.processed_assets + job.failed_assets
                job.progress_percent = min(99, int(done * 100 / job.total_assets))
            job.detail_message = f"Processed {job.processed_assets} of {job.total_assets} media items"
            _complete_job_if_finished(job)

        return {"asset_id": asset_id, "status": "completed"}
    except Exception as exc:
        with session_scope() as session:
            asset = session.get(Asset, parsed_asset_id)
            job = session.get(IngestionJob, parsed_job_id, with_for_update=True)
            if asset is not None:
                metadata = dict(asset.raw_metadata or {})
                metadata["processing"] = "failed"
                metadata["processing_error"] = str(exc)
                asset.raw_metadata = metadata
            if job is not None:
                job.failed_assets += 1
                if job.total_assets > 0:
                    done = job.processed_assets + job.failed_assets
                    job.progress_percent = min(99, int(done * 100 / job.total_assets))
                job.detail_message = f"Failed media items: {job.failed_assets}"
                job.error_message = str(exc)
                _complete_job_if_finished(job)
        raise


@celery_app.task(name="snapcapsule_core.tasks.media.ping_worker")
def ping_worker() -> dict[str, str]:
    return {"status": "pong"}
