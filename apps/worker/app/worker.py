import logging
import uuid
from pathlib import Path

from celery.signals import worker_ready

from snapcapsule_core.db import session_scope
from snapcapsule_core.models import IngestionJob
from snapcapsule_core.models.enums import IngestionJobStatus
from snapcapsule_core.queue import celery_app
from snapcapsule_core.services.ingestion_jobs import ACTIVE_INGESTION_JOB_STATUSES
from snapcapsule_core.tasks.ingestion import extract_and_parse
from snapcapsule_core.tasks import ingestion as _ingestion  # noqa: F401
from snapcapsule_core.tasks import media as _media  # noqa: F401

logger = logging.getLogger(__name__)

__all__ = ["celery_app"]


@worker_ready.connect
def resume_interrupted_ingestion_jobs(**_: object) -> None:
    recoverable_job_ids: list[str] = []

    with session_scope() as session:
        jobs = (
            session.query(IngestionJob)
            .filter(IngestionJob.status.in_(tuple(ACTIVE_INGESTION_JOB_STATUSES)))
            .all()
        )

        for job in jobs:
            source_path = Path(job.source_path)
            if not source_path.exists():
                job.status = IngestionJobStatus.FAILED
                job.detail_message = "Ingestion source disappeared before recovery"
                job.error_message = "The uploaded archive bundle or source directory is no longer available."
                job.progress_percent = 100
                job.finished_at = job.finished_at or job.updated_at
                continue

            job.status = IngestionJobStatus.QUEUED
            job.detail_message = "Worker restarted, resuming ingestion"
            job.progress_percent = 0
            job.total_assets = 0
            job.processed_assets = 0
            job.failed_assets = 0
            job.error_message = None
            job.finished_at = None
            recoverable_job_ids.append(str(job.id))

    for job_id in recoverable_job_ids:
        async_result = extract_and_parse.delay(job_id)
        with session_scope() as session:
            job = session.get(IngestionJob, uuid.UUID(job_id))
            if job is None:
                continue
            job.celery_task_id = async_result.id
            job.detail_message = "Recovered after worker restart"

        logger.warning("Requeued interrupted ingestion job %s after worker startup", job_id)
