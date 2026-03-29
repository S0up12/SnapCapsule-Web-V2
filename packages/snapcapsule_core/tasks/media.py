from __future__ import annotations

import uuid
from pathlib import Path

from sqlalchemy.exc import OperationalError

from snapcapsule_core.config import get_settings
from snapcapsule_core.db import session_scope
from snapcapsule_core.models import Asset, IngestionJob
from snapcapsule_core.models.enums import IngestionJobStatus, MediaType
from snapcapsule_core.queue import celery_app
from snapcapsule_core.services.ingestion_jobs import (
    JobCanceledError,
    append_public_job_event,
    cleanup_successful_upload_artifacts,
    mark_job_status,
    record_public_job_metrics,
    summarize_exception_message,
)
from snapcapsule_core.services.media_processor import MediaProcessor
from snapcapsule_core.services.thumbnail_repairs import (
    find_thumbnail_rebuild_candidates,
    rebuild_thumbnail_files,
)

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
        append_public_job_event(job, f"Media processing finished with {job.failed_assets} failed item(s)")
    else:
        mark_job_status(
            job,
            status=IngestionJobStatus.COMPLETED,
            detail_message="Ingestion completed",
            progress_percent=100,
            finished=True,
        )
        append_public_job_event(job, "Ingestion completed successfully")
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
    playback_mode: str | None = None,
    thumbnail_error: str | None = None,
    playback_error: str | None = None,
) -> None:
    asset.original_path = str(stored_media)
    asset.overlay_path = str(stored_overlay) if stored_overlay else None
    asset.thumbnail_path = str(thumbnail) if thumbnail else None
    asset.checksum_sha256 = checksum
    metadata = dict(asset.raw_metadata or {})
    metadata["processing"] = "completed"
    metadata.pop("processing_error", None)
    if playback_mode:
        metadata["browser_playback"] = playback_mode
    else:
        metadata.pop("browser_playback", None)
    if thumbnail_error:
        metadata["thumbnail_error"] = thumbnail_error
    else:
        metadata.pop("thumbnail_error", None)
    if playback_error:
        metadata["playback_error"] = playback_error
    else:
        metadata.pop("playback_error", None)
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
            asset.media_type = processor.detect_actual_media_type(stored_media, asset.media_type)
            thumbnail_error: str | None = None
            playback_error: str | None = None
            playback_mode: str | None = None
            plain_thumbnail: Path | None = None
            browser_playback: Path | None = None
            try:
                thumbnail = processor.generate_thumbnail(
                    str(asset.id),
                    stored_media,
                    asset.media_type,
                    stored_overlay,
                )
                if stored_overlay is not None:
                    plain_thumbnail = processor.generate_thumbnail(
                        str(asset.id),
                        stored_media,
                        asset.media_type,
                        stored_overlay,
                        include_overlay=False,
                    )
            except Exception as exc:
                thumbnail = None
                thumbnail_error = summarize_exception_message(exc)
            try:
                browser_playback = processor.ensure_browser_playback(
                    str(asset.id),
                    stored_media,
                    asset.media_type,
                )
                if asset.media_type == MediaType.VIDEO:
                    playback_mode = "transcoded" if browser_playback != stored_media else "original"
            except Exception as exc:
                browser_playback = None
                playback_error = summarize_exception_message(exc)
            checksum = processor.compute_checksum(stored_media)

            _mark_asset_success(
                asset,
                stored_media,
                stored_overlay,
                thumbnail,
                checksum,
                playback_mode=playback_mode,
                thumbnail_error=thumbnail_error,
                playback_error=playback_error,
            )
            read_bytes = Path(source_path).stat().st_size if Path(source_path).exists() else stored_media.stat().st_size
            write_bytes = stored_media.stat().st_size
            if overlay_source_path and stored_overlay is not None:
                overlay_read_bytes = Path(overlay_source_path).stat().st_size if Path(overlay_source_path).exists() else stored_overlay.stat().st_size
                read_bytes += overlay_read_bytes
                write_bytes += stored_overlay.stat().st_size
            if thumbnail is not None and thumbnail.exists():
                write_bytes += thumbnail.stat().st_size
            if plain_thumbnail is not None and plain_thumbnail.exists():
                write_bytes += plain_thumbnail.stat().st_size
            if browser_playback is not None and browser_playback != stored_media and browser_playback.exists():
                write_bytes += browser_playback.stat().st_size
            record_public_job_metrics(
                job,
                read_bytes_delta=read_bytes,
                write_bytes_delta=write_bytes,
                operations_delta=1,
            )
            job.processed_assets += 1
            job.progress_percent = _job_completion_percent(job)
            total_done = job.processed_assets + job.failed_assets
            job.detail_message = f"Processed {total_done} of {job.total_assets} media items"
            if (
                total_done == 1
                or total_done == job.total_assets
                or total_done % max(25, job.total_assets // 20 or 1) == 0
            ):
                append_public_job_event(job, f"[media] Processed {total_done}/{job.total_assets} items")
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
                    append_public_job_event(job, f"[media] Failed item {job.failed_assets}: {summary}")
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
                append_public_job_event(job, f"[media] Failed item {job.failed_assets}: {summary}")
                _complete_job_if_finished(job)
        raise


@celery_app.task(name="snapcapsule_core.tasks.media.ping_worker")
def ping_worker() -> dict[str, str]:
    return {"status": "pong"}


@celery_app.task(name="snapcapsule_core.tasks.media.rebuild_thumbnail_cache")
def rebuild_thumbnail_cache() -> dict[str, int]:
    settings = get_settings()
    processor = MediaProcessor(settings)

    with session_scope() as session:
        assets = (
            session.query(Asset)
            .order_by(Asset.created_at, Asset.id)
            .all()
        )
        candidates = find_thumbnail_rebuild_candidates(assets)
        result = rebuild_thumbnail_files(
            candidates,
            processor=processor,
            apply_changes=True,
        )

        rebuilt_asset_ids = {candidate.asset_id for candidate in candidates}
        for asset in assets:
            if asset.media_type == MediaType.VIDEO and asset.original_path:
                try:
                    playback_path = processor.ensure_browser_playback(str(asset.id), asset.original_path, asset.media_type)
                    metadata = dict(asset.raw_metadata or {})
                    metadata["browser_playback"] = "transcoded" if playback_path != Path(asset.original_path) else "original"
                    metadata.pop("playback_error", None)
                    asset.raw_metadata = metadata
                except Exception as exc:
                    metadata = dict(asset.raw_metadata or {})
                    metadata["playback_error"] = summarize_exception_message(exc)
                    asset.raw_metadata = metadata
            if asset.id not in rebuilt_asset_ids:
                continue
            thumbnail = processor.resolve_existing_thumbnail_path(str(asset.id), include_overlay=True)
            asset.thumbnail_path = str(thumbnail) if thumbnail is not None else None

    return {
        "requested": len(candidates),
        **result,
    }
