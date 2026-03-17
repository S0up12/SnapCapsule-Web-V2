from __future__ import annotations

import shutil
import uuid
from datetime import UTC, datetime

from snapcapsule_core.config import get_settings
from snapcapsule_core.db import session_scope
from snapcapsule_core.models import IngestionJob
from snapcapsule_core.models.enums import IngestionJobStatus, IngestionSourceKind
from snapcapsule_core.queue import celery_app
from snapcapsule_core.services.ingestion import IngestionService
from snapcapsule_core.tasks.media import process_asset_media


@celery_app.task(
    bind=True,
    name="snapcapsule_core.tasks.ingestion.extract_and_parse",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 2},
)
def extract_and_parse(self, job_id: str) -> dict[str, str]:
    settings = get_settings()
    service = IngestionService(settings)
    parsed_job_id = uuid.UUID(job_id)

    try:
        with session_scope() as session:
            job = session.get(IngestionJob, parsed_job_id)
            if job is None:
                raise ValueError(f"Ingestion job {job_id} not found")
            job.celery_task_id = self.request.id
            indexed_assets, preserve_source = service.run_ingestion(session, job)
            asset_payloads = [
                {
                    "asset_id": str(indexed.asset.id),
                    "source_path": str(indexed.source_path),
                    "overlay_source_path": str(indexed.overlay_source_path) if indexed.overlay_source_path else None,
                    "job_id": str(job.id),
                    "preserve_source": preserve_source or job.source_kind == IngestionSourceKind.DIRECTORY,
                }
                for indexed in indexed_assets.all_assets
            ]

        for payload in asset_payloads:
            process_asset_media.delay(**payload)

        if not asset_payloads:
            with session_scope() as session:
                job = session.get(IngestionJob, parsed_job_id)
                if job and job.workspace_path and job.source_kind == IngestionSourceKind.UPLOAD:
                    shutil.rmtree(job.workspace_path, ignore_errors=True)

        return {"job_id": job_id, "status": "queued"}
    except Exception as exc:
        with session_scope() as session:
            job = session.get(IngestionJob, parsed_job_id)
            if job is not None:
                job.status = IngestionJobStatus.FAILED
                job.detail_message = "Ingestion failed"
                job.error_message = str(exc)
                job.progress_percent = 100
                job.finished_at = datetime.now(UTC)
        raise
