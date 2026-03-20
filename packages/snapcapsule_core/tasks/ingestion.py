from __future__ import annotations

import logging
import uuid

from sqlalchemy.exc import OperationalError

from snapcapsule_core.config import get_settings
from snapcapsule_core.db import session_scope
from snapcapsule_core.models import IngestionJob
from snapcapsule_core.models.enums import IngestionJobStatus, IngestionSourceKind
from snapcapsule_core.queue import celery_app
from snapcapsule_core.services.ingestion import IngestionService
from snapcapsule_core.services.ingestion_jobs import (
    ACTIVE_INGESTION_JOB_STATUSES,
    JobCanceledError,
    append_public_job_event,
    cleanup_successful_upload_artifacts,
    get_job_metadata,
    mark_job_status,
    record_public_job_metrics,
    set_job_metadata,
    summarize_exception_message,
)
from snapcapsule_core.services.profile_queries import persist_profile_snapshot_from_roots
from snapcapsule_core.tasks.media import process_asset_media

logger = logging.getLogger(__name__)

MAX_INGESTION_RETRIES = 3
TRANSIENT_INGESTION_EXCEPTIONS = (OSError, OperationalError)


def _set_transient_failure_state(job_id: uuid.UUID, message: str, *, final_failure: bool) -> None:
    summary = summarize_exception_message(message)
    with session_scope() as session:
        job = session.get(IngestionJob, job_id, with_for_update=True)
        if job is None or job.status == IngestionJobStatus.CANCELED:
            return
        if final_failure:
            mark_job_status(
                job,
                status=IngestionJobStatus.FAILED,
                detail_message="Ingestion failed",
                progress_percent=100,
                error_message=summary,
                finished=True,
            )
            return
        mark_job_status(
            job,
            detail_message="Transient worker error, retrying ingestion",
            error_message=summary,
        )


def _set_non_retry_failure_state(job_id: uuid.UUID, message: str) -> None:
    summary = summarize_exception_message(message)
    with session_scope() as session:
        job = session.get(IngestionJob, job_id, with_for_update=True)
        if job is None or job.status == IngestionJobStatus.CANCELED:
            return
        mark_job_status(
            job,
            status=IngestionJobStatus.FAILED,
            detail_message="Ingestion failed",
            progress_percent=100,
            error_message=summary,
            finished=True,
        )


@celery_app.task(
    bind=True,
    name="snapcapsule_core.tasks.ingestion.extract_and_parse",
    autoretry_for=TRANSIENT_INGESTION_EXCEPTIONS,
    retry_backoff=True,
    retry_kwargs={"max_retries": MAX_INGESTION_RETRIES},
)
def extract_and_parse(self, job_id: str) -> dict[str, str]:
    settings = get_settings()
    service = IngestionService(settings)
    parsed_job_id = uuid.UUID(job_id)
    media_task_ids: list[str] = []

    try:
        with session_scope() as session:
            job = session.get(IngestionJob, parsed_job_id, with_for_update=True)
            if job is None:
                raise ValueError(f"Ingestion job {job_id} not found")
            if (
                job.celery_task_id
                and job.celery_task_id != self.request.id
                and job.status in ACTIVE_INGESTION_JOB_STATUSES
            ):
                logger.warning(
                    "Ignoring duplicate ingestion task %s for job %s; active task is %s",
                    self.request.id,
                    job_id,
                    job.celery_task_id,
                )
                return {"job_id": job_id, "status": "ignored"}
            if job.status == IngestionJobStatus.CANCELED:
                return {"job_id": job_id, "status": IngestionJobStatus.CANCELED.value}
            job.celery_task_id = self.request.id
            if job.source_kind == IngestionSourceKind.UPLOAD:
                job.workspace_path = job.workspace_path or str(settings.ingest_workspace_dir / str(job.id))
            mark_job_status(
                job,
                status=IngestionJobStatus.EXTRACTING,
                detail_message="Extracting and merging uploaded archives",
                progress_percent=10,
                error_message=None,
            )
            append_public_job_event(job, "Queued ingestion job")
            append_public_job_event(job, "Starting archive extraction")

        with session_scope() as session:
            job = session.get(IngestionJob, parsed_job_id)
            if job is None:
                raise ValueError(f"Ingestion job {job_id} not found")
            session.refresh(job)
            if job.status == IngestionJobStatus.CANCELED:
                raise JobCanceledError(f"Ingestion job {job_id} was canceled")
            last_logged_extraction_marker: str | None = None

            def extraction_progress_callback(
                archive_index: int,
                total_archives: int,
                member_index: int,
                total_members: int,
                archive_name: str,
                read_bytes_delta: int,
                write_bytes_delta: int,
                operations_delta: int,
            ) -> None:
                nonlocal last_logged_extraction_marker
                with session_scope() as callback_session:
                    callback_job = callback_session.get(IngestionJob, parsed_job_id, with_for_update=True)
                    if callback_job is None or callback_job.status == IngestionJobStatus.CANCELED:
                        return

                    archive_fraction = ((archive_index - 1) + (member_index / max(total_members, 1))) / max(total_archives, 1)
                    progress_percent = min(30, max(10, int(10 + archive_fraction * 20)))
                    detail_message = (
                        f"Extracting archive {archive_index} of {total_archives} "
                        f"({member_index}/{total_members} entries)"
                    )
                    mark_job_status(
                        callback_job,
                        detail_message=detail_message,
                        progress_percent=progress_percent,
                    )
                    record_public_job_metrics(
                        callback_job,
                        read_bytes_delta=read_bytes_delta,
                        write_bytes_delta=write_bytes_delta,
                        operations_delta=operations_delta,
                    )

                    marker = f"{archive_index}:{member_index}:{total_members}"
                    if marker != last_logged_extraction_marker and (
                        member_index == 1 or member_index == total_members or member_index % 1000 == 0
                    ):
                        append_public_job_event(
                            callback_job,
                            f"[extract] {archive_name}: {member_index}/{total_members} entries",
                        )
                        last_logged_extraction_marker = marker

            prepared_source = service.prepare_source(job, extraction_progress_callback=extraction_progress_callback)
            try:
                persist_profile_snapshot_from_roots(session, settings, prepared_source.roots)
            except Exception:
                logger.warning("Failed to persist profile snapshot for ingestion job %s", job_id, exc_info=True)
            session.refresh(job)
            if job.status == IngestionJobStatus.CANCELED:
                raise JobCanceledError(f"Ingestion job {job_id} was canceled")
            if prepared_source.workspace_path is not None:
                job.workspace_path = str(prepared_source.workspace_path)
            mark_job_status(
                job,
                status=IngestionJobStatus.PARSING,
                detail_message="Parsing JSON and building archive records",
                progress_percent=35,
            )
            append_public_job_event(job, "Archive extraction finished")
            append_public_job_event(job, "Parsing Snapchat export data")

        with session_scope() as session:
            job = session.get(IngestionJob, parsed_job_id, with_for_update=True)
            if job is None:
                raise ValueError(f"Ingestion job {job_id} not found")
            if job.status == IngestionJobStatus.CANCELED:
                raise JobCanceledError(f"Ingestion job {job_id} was canceled")

            def cancel_check() -> None:
                session.refresh(job)
                if job.status == IngestionJobStatus.CANCELED:
                    raise JobCanceledError(f"Ingestion job {job_id} was canceled")

            indexed_assets = service.run_ingestion(session, job, prepared_source.roots, cancel_check=cancel_check)
            asset_payloads = [
                {
                    "asset_id": str(indexed.asset.id),
                    "source_path": str(indexed.source_path),
                    "overlay_source_path": str(indexed.overlay_source_path) if indexed.overlay_source_path else None,
                    "job_id": str(job.id),
                    "preserve_source": prepared_source.preserve_source or job.source_kind == IngestionSourceKind.DIRECTORY,
                }
                for indexed in indexed_assets.all_assets
            ]

        with session_scope() as session:
            job = session.get(IngestionJob, parsed_job_id)
            if job is None:
                raise ValueError(f"Ingestion job {job_id} not found")
            if job.status == IngestionJobStatus.CANCELED:
                raise JobCanceledError(f"Ingestion job {job_id} was canceled")
            if job.total_assets == 0 and job.status == IngestionJobStatus.COMPLETED:
                cleanup_successful_upload_artifacts(job)
                return {"job_id": job_id, "status": IngestionJobStatus.COMPLETED.value}

        for payload in asset_payloads:
            result = process_asset_media.delay(**payload)
            media_task_ids.append(result.id)

        with session_scope() as session:
            job = session.get(IngestionJob, parsed_job_id, with_for_update=True)
            if job is None:
                raise ValueError(f"Ingestion job {job_id} not found")
            if job.status == IngestionJobStatus.CANCELED:
                raise JobCanceledError(f"Ingestion job {job_id} was canceled")
            metadata = get_job_metadata(job)
            metadata["_media_task_ids"] = media_task_ids
            set_job_metadata(job, metadata)
            mark_job_status(
                job,
                status=IngestionJobStatus.PROCESSING_MEDIA,
                detail_message="Processing media files",
                progress_percent=max(job.progress_percent, 50),
            )
            append_public_job_event(job, f"Queued {len(asset_payloads)} media item(s) for processing")

        return {"job_id": job_id, "status": "queued"}
    except JobCanceledError:
        for media_task_id in media_task_ids:
            celery_app.control.revoke(media_task_id, terminate=True)
        with session_scope() as session:
            job = session.get(IngestionJob, parsed_job_id, with_for_update=True)
            if job is not None and job.status != IngestionJobStatus.CANCELED:
                mark_job_status(
                    job,
                    status=IngestionJobStatus.CANCELED,
                    detail_message="Ingestion canceled",
                    progress_percent=100,
                    finished=True,
                )
                append_public_job_event(job, "Ingestion canceled")
        return {"job_id": job_id, "status": IngestionJobStatus.CANCELED.value}
    except TRANSIENT_INGESTION_EXCEPTIONS as exc:
        for media_task_id in media_task_ids:
            celery_app.control.revoke(media_task_id, terminate=True)
        _set_transient_failure_state(
            parsed_job_id,
            str(exc),
            final_failure=self.request.retries >= MAX_INGESTION_RETRIES,
        )
        raise
    except Exception as exc:
        for media_task_id in media_task_ids:
            celery_app.control.revoke(media_task_id, terminate=True)
        _set_non_retry_failure_state(parsed_job_id, str(exc))
        raise
