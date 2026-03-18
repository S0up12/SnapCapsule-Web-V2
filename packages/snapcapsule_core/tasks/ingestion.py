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
    JobCanceledError,
    cleanup_successful_upload_artifacts,
    get_job_metadata,
    mark_job_status,
    set_job_metadata,
    summarize_exception_message,
)
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
                job.workspace_path = str(settings.ingest_workspace_dir / str(job.id))
            mark_job_status(
                job,
                status=IngestionJobStatus.EXTRACTING,
                detail_message="Extracting and merging uploaded archives",
                progress_percent=10,
                error_message=None,
            )

        with session_scope() as session:
            job = session.get(IngestionJob, parsed_job_id)
            if job is None:
                raise ValueError(f"Ingestion job {job_id} not found")
            session.refresh(job)
            if job.status == IngestionJobStatus.CANCELED:
                raise JobCanceledError(f"Ingestion job {job_id} was canceled")
            prepared_source = service.prepare_source(job)
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
                    finished=True,
                )
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
