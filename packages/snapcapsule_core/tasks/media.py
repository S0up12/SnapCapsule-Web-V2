from __future__ import annotations

import uuid
from pathlib import Path

from sqlalchemy.exc import OperationalError

from snapcapsule_core.config import get_settings
from snapcapsule_core.db import session_scope
from snapcapsule_core.models import Asset, IngestionJob
from snapcapsule_core.models.enums import IngestionJobStatus
from snapcapsule_core.queue import celery_app
from snapcapsule_core.services.ingestion_jobs import (
    JobCanceledError,
    cleanup_successful_upload_artifacts,
    mark_job_status,
    summarize_exception_message,
)
from snapcapsule_core.services.media_processor import MediaProcessor

MAX_MEDIA_RETRIES = 3
TRANSIENT_MEDIA_EXCEPTIONS = (OSError, OperationalError)


def _job_completion_percent(job: IngestionJob) -> int:
    if job.total_assets <= 0:
        return job.progress_percent
    done = job.processed_assets + job.failed_assets
    return min(99, int(done * 100 / job.total_assets))


def _complete_job_if_finished(job: IngestionJob) -> None:
    if job.status == IngestionJobStatus.CANCELED:
        return

    total_done = job.processed_assets + job.failed_assets
    if job.total_assets == 0 or total_done < job.total_assets:
        return

    if job.failed_assets > 0:
        mark_job_status(
            job,
            status=IngestionJobStatus.FAILED,
            detail_message=f"Completed with {job.failed_assets} failed media items",
            progress_percent=100,
            finished=True,
        )
    else:
        mark_job_status(
            job,
            status=IngestionJobStatus.COMPLETED,
            detail_message="Ingestion completed",
            progress_percent=100,
            finished=True,
        )
        cleanup_successful_upload_artifacts(job)


def _mark_asset_failure(asset: Asset | None, message: str, *, state: str) -> None:
    if asset is None:
        return
    summary = summarize_exception_message(message)
    metadata = dict(asset.raw_metadata or {})
    metadata["processing"] = state
    metadata["processing_error"] = summary
    asset.raw_metadata = metadata


def _mark_asset_success(
    asset: Asset,
    stored_media: Path,
    stored_overlay: Path | None,
    thumbnail: Path | None,
    checksum: str,
    *,
    thumbnail_error: str | None = None,
) -> None:
    asset.original_path = str(stored_media)
    asset.overlay_path = str(stored_overlay) if stored_overlay else None
    asset.thumbnail_path = str(thumbnail) if thumbnail else None
    asset.checksum_sha256 = checksum
    metadata = dict(asset.raw_metadata or {})
    metadata["processing"] = "completed"
    metadata.pop("processing_error", None)
    if thumbnail_error:
        metadata["thumbnail_error"] = thumbnail_error
    else:
        metadata.pop("thumbnail_error", None)
    asset.raw_metadata = metadata


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
    autoretry_for=TRANSIENT_MEDIA_EXCEPTIONS,
    retry_backoff=True,
    retry_kwargs={"max_retries": MAX_MEDIA_RETRIES},
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
        raw_destination: Path | None = None
        overlay_destination: Path | None = None
        with session_scope() as session:
            asset = session.get(Asset, parsed_asset_id)
            job = session.get(IngestionJob, parsed_job_id, with_for_update=True)
            if asset is None or job is None:
                raise ValueError("Asset or ingestion job not found")
            if job.status == IngestionJobStatus.CANCELED:
                raise JobCanceledError(f"Ingestion job {job_id} was canceled")

            raw_destination = processor.raw_destination_path(str(asset.id), asset.source_type, Path(source_path).suffix)
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
            job = session.get(IngestionJob, parsed_job_id, with_for_update=True)
            if asset is None or job is None:
                raise ValueError("Asset disappeared during processing")
            if job.status == IngestionJobStatus.CANCELED:
                raise JobCanceledError(f"Ingestion job {job_id} was canceled")
            thumbnail_error: str | None = None
            try:
                thumbnail = processor.generate_thumbnail(
                    str(asset.id),
                    stored_media,
                    asset.media_type,
                    stored_overlay,
                )
            except Exception as exc:
                thumbnail = None
                thumbnail_error = summarize_exception_message(exc)
            checksum = processor.compute_checksum(stored_media)

            _mark_asset_success(
                asset,
                stored_media,
                stored_overlay,
                thumbnail,
                checksum,
                thumbnail_error=thumbnail_error,
            )
            job.processed_assets += 1
            job.progress_percent = _job_completion_percent(job)
            if thumbnail_error:
                job.detail_message = f"Processed {job.processed_assets} of {job.total_assets} media items"
            else:
                job.detail_message = f"Processed {job.processed_assets} of {job.total_assets} media items"
            _complete_job_if_finished(job)

        return {"asset_id": asset_id, "status": "completed"}
    except JobCanceledError:
        with session_scope() as session:
            asset = session.get(Asset, parsed_asset_id)
            job = session.get(IngestionJob, parsed_job_id, with_for_update=True)
            _mark_asset_failure(asset, "Processing canceled", state="canceled")
            if job is not None and job.status != IngestionJobStatus.CANCELED:
                mark_job_status(
                    job,
                    status=IngestionJobStatus.CANCELED,
                    detail_message="Ingestion canceled",
                    finished=True,
                )
        return {"asset_id": asset_id, "status": IngestionJobStatus.CANCELED.value}
    except TRANSIENT_MEDIA_EXCEPTIONS as exc:
        final_failure = self.request.retries >= MAX_MEDIA_RETRIES
        summary = summarize_exception_message(exc)
        with session_scope() as session:
            asset = session.get(Asset, parsed_asset_id)
            job = session.get(IngestionJob, parsed_job_id, with_for_update=True)
            if asset is not None:
                _mark_asset_failure(
                    asset,
                    str(exc),
                    state="failed" if final_failure else "retrying",
                )
            if job is not None and job.status != IngestionJobStatus.CANCELED:
                if final_failure:
                    job.failed_assets += 1
                    job.progress_percent = _job_completion_percent(job)
                    job.detail_message = f"Failed media items: {job.failed_assets}"
                    job.error_message = summary
                    _complete_job_if_finished(job)
                else:
                    job.detail_message = "Transient media error, retrying"
                    job.error_message = summary
        raise
    except Exception as exc:
        summary = summarize_exception_message(exc)
        with session_scope() as session:
            asset = session.get(Asset, parsed_asset_id)
            job = session.get(IngestionJob, parsed_job_id, with_for_update=True)
            _mark_asset_failure(asset, str(exc), state="failed")
            if job is not None and job.status != IngestionJobStatus.CANCELED:
                job.failed_assets += 1
                job.progress_percent = _job_completion_percent(job)
                job.detail_message = f"Failed media items: {job.failed_assets}"
                job.error_message = summary
                _complete_job_if_finished(job)
        raise


@celery_app.task(name="snapcapsule_core.tasks.media.ping_worker")
def ping_worker() -> dict[str, str]:
    return {"status": "pong"}
