from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from apps.api.app.api.schemas import ErrorResponse, IngestionJobResponse, IngestionStartResponse
from snapcapsule_core.config import get_settings
from snapcapsule_core.db import session_scope
from snapcapsule_core.models import IngestionJob
from snapcapsule_core.models.enums import IngestionJobStatus, IngestionSourceKind
from snapcapsule_core.tasks.ingestion import extract_and_parse

router = APIRouter(prefix="/api/ingest")
settings = get_settings()


def serialize_job(job: IngestionJob) -> IngestionJobResponse:
    return IngestionJobResponse(
        id=job.id,
        source_kind=job.source_kind,
        source_name=job.source_name,
        source_path=job.source_path,
        workspace_path=job.workspace_path,
        celery_task_id=job.celery_task_id,
        status=job.status,
        detail_message=job.detail_message,
        progress_percent=job.progress_percent,
        total_assets=job.total_assets,
        processed_assets=job.processed_assets,
        failed_assets=job.failed_assets,
        error_message=job.error_message,
        created_at=job.created_at,
        updated_at=job.updated_at,
        finished_at=job.finished_at,
        raw_metadata=job.raw_metadata,
    )


@router.post(
    "",
    response_model=IngestionStartResponse,
    tags=["Ingestion"],
    summary="Start a Snapchat export ingestion job",
    responses={
        400: {"model": ErrorResponse, "description": "The upload payload or directory path was invalid."},
        500: {"model": ErrorResponse, "description": "The ingestion job could not be queued correctly."},
    },
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "archive": {
                                "type": "string",
                                "format": "binary",
                                "description": "Optional Snapchat export ZIP upload.",
                            },
                            "directory_path": {
                                "type": "string",
                                "description": "Optional absolute path inside the backend container.",
                            },
                        },
                        "description": "Provide either a ZIP file upload or a container-visible export directory path.",
                    },
                    "examples": {
                        "directory_import": {
                            "summary": "Queue a mounted export directory",
                            "value": {"directory_path": "/srv/snapcapsule/ingest/sample-export"},
                        },
                        "archive_upload": {
                            "summary": "Upload a Snapchat export ZIP",
                            "value": {"archive": "(binary zip file)"},
                        },
                    },
                }
            },
        }
    },
)
async def start_ingestion(
    archive: UploadFile | None = File(default=None),
    directory_path: str | None = Form(default=None),
) -> IngestionStartResponse:
    """Queue a new background ingestion job from either an uploaded ZIP archive or a mounted export directory."""
    if archive is None and not directory_path:
        raise HTTPException(status_code=400, detail="Provide either an archive upload or a directory path.")
    if archive is not None and directory_path:
        raise HTTPException(status_code=400, detail="Provide only one source per ingestion request.")

    metadata: dict[str, str] = {}
    if archive is not None:
        safe_name = Path(archive.filename or "snapchat-export.zip").name
        source_path = settings.ingest_upload_dir / f"{uuid.uuid4()}-{safe_name}"
        with source_path.open("wb") as handle:
            shutil.copyfileobj(archive.file, handle)
        source_kind = IngestionSourceKind.UPLOAD
        source_name = safe_name
        metadata["uploaded_filename"] = safe_name
    else:
        source_path = Path(directory_path or "").expanduser().resolve()
        if not source_path.exists() or not source_path.is_dir():
            raise HTTPException(
                status_code=400,
                detail="The provided directory path does not exist inside the API container.",
            )
        source_kind = IngestionSourceKind.DIRECTORY
        source_name = source_path.name

    with session_scope() as session:
        job = IngestionJob(
            source_kind=source_kind,
            source_name=source_name,
            source_path=str(source_path),
            status=IngestionJobStatus.QUEUED,
            detail_message="Queued for ingestion",
            progress_percent=0,
            raw_metadata=metadata or None,
        )
        session.add(job)
        session.flush()
        job_id = str(job.id)

    async_result = extract_and_parse.delay(job_id)

    with session_scope() as session:
        job = session.get(IngestionJob, uuid.UUID(job_id))
        if job is None:
            raise HTTPException(status_code=500, detail="Ingestion job disappeared before queue dispatch.")
        job.celery_task_id = async_result.id
        job.detail_message = "Background ingestion started"
        payload = IngestionStartResponse(
            job_id=uuid.UUID(job_id),
            task_id=async_result.id,
            status=job.status,
            message=job.detail_message or "Background ingestion started",
        )

    return payload


@router.get(
    "/{job_id}",
    response_model=IngestionJobResponse,
    tags=["Ingestion"],
    summary="Get ingestion job status",
    responses={404: {"model": ErrorResponse, "description": "The requested ingestion job does not exist."}},
)
def get_ingestion_job(job_id: uuid.UUID) -> IngestionJobResponse:
    """Return the current ingestion job state, progress counters, and source metadata for polling UIs."""
    with session_scope() as session:
        job = session.get(IngestionJob, job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Ingestion job not found.")
        return serialize_job(job)
