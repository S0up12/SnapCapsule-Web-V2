from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Body, File, Form, HTTPException, Query, UploadFile

from apps.api.app.api.schemas import ErrorResponse, IngestionCancelRequest, IngestionJobResponse, IngestionStartResponse
from snapcapsule_core.config import get_settings
from snapcapsule_core.db import session_scope
from snapcapsule_core.models import IngestionJob
from snapcapsule_core.models.enums import IngestionJobStatus, IngestionSourceKind
from snapcapsule_core.queue import celery_app
from snapcapsule_core.services.ingestion_jobs import ACTIVE_INGESTION_JOB_STATUSES, mark_job_status, public_job_metadata
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
        raw_metadata=public_job_metadata(job),
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
                            "archives": {
                                "type": "array",
                                "items": {"type": "string", "format": "binary"},
                                "description": "One or more Snapchat export ZIP uploads processed as a single job.",
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
                            "summary": "Upload one or more Snapchat export ZIP files",
                            "value": {"archives": ["(binary zip file)", "(binary zip file)"]},
                        },
                    },
                }
            },
        }
    },
)
async def start_ingestion(
    archives: list[UploadFile] | None = File(default=None),
    archive: UploadFile | None = File(default=None),
    directory_path: str | None = Form(default=None),
) -> IngestionStartResponse:
    """Queue a new background ingestion job from either an uploaded ZIP archive or a mounted export directory."""
    uploaded_archives = list(archives or [])
    if archive is not None:
        uploaded_archives.append(archive)

    if not uploaded_archives and not directory_path:
        raise HTTPException(status_code=400, detail="Provide either an archive upload or a directory path.")
    if uploaded_archives and directory_path:
        raise HTTPException(status_code=400, detail="Provide only one source per ingestion request.")

    metadata: dict[str, object] = {}
    job_id = uuid.uuid4()

    if uploaded_archives:
        valid_archives = [
            upload
            for upload in uploaded_archives
            if Path(upload.filename or "").suffix.lower() == ".zip"
        ]
        if not valid_archives:
            raise HTTPException(status_code=400, detail="Upload one or more .zip files.")

        upload_bundle_dir = settings.ingest_upload_dir / str(job_id)
        upload_bundle_dir.mkdir(parents=True, exist_ok=True)
        uploaded_filenames: list[str] = []
        try:
            for index, upload in enumerate(valid_archives, start=1):
                safe_name = Path(upload.filename or f"snapchat-export-{index}.zip").name
                stored_path = upload_bundle_dir / f"{index:03d}-{safe_name}"
                with stored_path.open("wb") as handle:
                    shutil.copyfileobj(upload.file, handle)
                uploaded_filenames.append(safe_name)
        except Exception as exc:
            shutil.rmtree(upload_bundle_dir, ignore_errors=True)
            raise HTTPException(status_code=500, detail=f"Failed to save uploaded archive(s): {exc}") from exc

        source_kind = IngestionSourceKind.UPLOAD
        source_path = upload_bundle_dir
        source_name = uploaded_filenames[0] if len(uploaded_filenames) == 1 else f"{len(uploaded_filenames)} uploaded archives"
        metadata["archive_count"] = len(uploaded_filenames)
        metadata["uploaded_filenames"] = uploaded_filenames
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
            id=job_id,
            source_kind=source_kind,
            source_name=source_name,
            source_path=str(source_path),
            status=IngestionJobStatus.QUEUED,
            detail_message="Queued for background ingestion",
            progress_percent=0,
            raw_metadata=metadata or None,
        )
        session.add(job)

    async_result = extract_and_parse.delay(str(job_id))

    with session_scope() as session:
        job = session.get(IngestionJob, job_id)
        if job is None:
            raise HTTPException(status_code=500, detail="Ingestion job disappeared before queue dispatch.")
        job.celery_task_id = async_result.id
        job.detail_message = "Background ingestion queued"
        payload = IngestionStartResponse(
            job_id=job_id,
            task_id=async_result.id,
            status=job.status,
            message=job.detail_message or "Background ingestion queued",
        )

    return payload


@router.get(
    "/status",
    response_model=IngestionJobResponse,
    tags=["Ingestion"],
    summary="Get ingestion job status",
    responses={404: {"model": ErrorResponse, "description": "The requested ingestion job does not exist."}},
)
def get_ingestion_status(job_id: uuid.UUID = Query(..., description="Ingestion job identifier to poll.")) -> IngestionJobResponse:
    """Return the current ingestion job state, progress counters, and source metadata for polling UIs."""
    with session_scope() as session:
        job = session.get(IngestionJob, job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Ingestion job not found.")
        return serialize_job(job)


@router.post(
    "/cancel",
    response_model=IngestionJobResponse,
    tags=["Ingestion"],
    summary="Cancel a running ingestion job",
    responses={404: {"model": ErrorResponse, "description": "The requested ingestion job does not exist."}},
)
def cancel_ingestion_job(payload: IngestionCancelRequest = Body(...)) -> IngestionJobResponse:
    """Request cancellation of the active Celery work for a job and persist the canceled state."""
    with session_scope() as session:
        job = session.get(IngestionJob, payload.job_id, with_for_update=True)
        if job is None:
            raise HTTPException(status_code=404, detail="Ingestion job not found.")

        if job.status in ACTIVE_INGESTION_JOB_STATUSES and job.celery_task_id:
            celery_app.control.revoke(job.celery_task_id, terminate=True)

        for media_task_id in (job.raw_metadata or {}).get("_media_task_ids", []):
            celery_app.control.revoke(media_task_id, terminate=True)

        if job.status not in {IngestionJobStatus.COMPLETED, IngestionJobStatus.FAILED, IngestionJobStatus.CANCELED}:
            mark_job_status(
                job,
                status=IngestionJobStatus.CANCELED,
                detail_message="Ingestion canceled by user",
                error_message=None,
                finished=True,
            )

        return serialize_job(job)


@router.get(
    "/{job_id}",
    response_model=IngestionJobResponse,
    tags=["Ingestion"],
    summary="Get ingestion job status (legacy path)",
    responses={404: {"model": ErrorResponse, "description": "The requested ingestion job does not exist."}},
)
def get_ingestion_job(job_id: uuid.UUID) -> IngestionJobResponse:
    with session_scope() as session:
        job = session.get(IngestionJob, job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Ingestion job not found.")
        return serialize_job(job)
