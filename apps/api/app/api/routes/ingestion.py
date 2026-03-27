from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Body, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from snapcapsule_core.config import get_settings
from snapcapsule_core.db import session_scope
from snapcapsule_core.models import IngestionJob
from snapcapsule_core.models.enums import IngestionJobStatus, IngestionSourceKind
from snapcapsule_core.queue import celery_app
from snapcapsule_core.services.ingestion_diagnostics import (
    acknowledge_ingestion_issues,
    clear_terminal_ingestion_history,
)
from snapcapsule_core.services.ingestion_jobs import ACTIVE_INGESTION_JOB_STATUSES, mark_job_status, public_job_metadata
from snapcapsule_core.tasks.ingestion import extract_and_parse
from sqlalchemy import desc, select

from apps.api.app.api.routes.ingestion_failed_items import (
    build_failed_item_file_response,
    build_failed_items_response,
)
from apps.api.app.api.routes.ingestion_helpers import (
    build_upload_source_name,
    bundle_fingerprint,
    copy_upload_with_checksum,
    job_is_reusable_import,
    normalize_archive_manifest,
    serialize_job,
    workspace_path_for_job,
)
from apps.api.app.api.schemas import (
    ErrorResponse,
    IngestionCancelRequest,
    IngestionFailedItemsResponse,
    IngestionJobResponse,
    IngestionJobsListResponse,
    IngestionStartResponse,
    SystemActionResponse,
)

router = APIRouter(prefix="/api/ingest")
settings = get_settings()


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

        temp_upload_bundle_dir = settings.ingest_upload_dir / "_incoming" / str(job_id)
        temp_upload_bundle_dir.mkdir(parents=True, exist_ok=True)
        file_manifest: list[dict[str, object]] = []
        uploaded_filenames: list[str] = []
        try:
            for index, upload in enumerate(valid_archives, start=1):
                safe_name = Path(upload.filename or f"snapchat-export-{index}.zip").name
                stored_path = temp_upload_bundle_dir / f"{index:03d}-{safe_name}"
                checksum_sha256, size_bytes = copy_upload_with_checksum(upload, stored_path)
                uploaded_filenames.append(safe_name)
                file_manifest.append(
                    {
                        "name": safe_name,
                        "stored_name": stored_path.name,
                        "size_bytes": size_bytes,
                        "checksum_sha256": checksum_sha256,
                    }
                )
        except Exception as exc:
            shutil.rmtree(temp_upload_bundle_dir, ignore_errors=True)
            raise HTTPException(status_code=500, detail=f"Failed to save uploaded archive(s): {exc}") from exc

        with session_scope() as session:
            upload_jobs = session.query(IngestionJob).filter(
                IngestionJob.source_kind == IngestionSourceKind.UPLOAD,
            ).order_by(IngestionJob.created_at.desc(), IngestionJob.id.desc()).all()

            file_manifest, skipped_filenames, reused_job = normalize_archive_manifest(file_manifest, upload_jobs)
            if not file_manifest:
                shutil.rmtree(temp_upload_bundle_dir, ignore_errors=True)
                if reused_job is None:
                    raise HTTPException(status_code=409, detail="All uploaded ZIP files have already been imported.")
                return IngestionStartResponse(
                    job_id=reused_job.id,
                    task_id=reused_job.celery_task_id or "",
                    status=reused_job.status,
                    message=reused_job.detail_message or "These ZIP files were already imported.",
                )

            kept_names = {str(entry["stored_name"]) for entry in file_manifest}
            for child in temp_upload_bundle_dir.iterdir():
                if child.is_file() and child.name not in kept_names:
                    child.unlink(missing_ok=True)

            uploaded_filenames = [str(entry["name"]) for entry in file_manifest]
            fingerprint = bundle_fingerprint(file_manifest)
            upload_bundle_dir = settings.ingest_upload_dir / fingerprint
            workspace_path = settings.ingest_workspace_dir / fingerprint

            existing_job = next(
                (
                    job
                    for job in upload_jobs
                    if (public_job_metadata(job) or {}).get("bundle_fingerprint") == fingerprint
                    and job_is_reusable_import(job)
                ),
                None,
            )
            if existing_job is not None:
                shutil.rmtree(temp_upload_bundle_dir, ignore_errors=True)
                return IngestionStartResponse(
                    job_id=existing_job.id,
                    task_id=existing_job.celery_task_id or "",
                    status=existing_job.status,
                    message=existing_job.detail_message or "These ZIP files were already imported.",
                )

        if upload_bundle_dir.exists():
            shutil.rmtree(temp_upload_bundle_dir, ignore_errors=True)
        else:
            upload_bundle_dir.parent.mkdir(parents=True, exist_ok=True)
            temp_upload_bundle_dir.replace(upload_bundle_dir)

        source_kind = IngestionSourceKind.UPLOAD
        source_path = upload_bundle_dir
        source_name = build_upload_source_name(uploaded_filenames)
        metadata["archive_count"] = len(uploaded_filenames)
        metadata["uploaded_filenames"] = uploaded_filenames
        metadata["archive_checksums"] = [str(entry["checksum_sha256"]) for entry in file_manifest]
        metadata["skipped_duplicate_archives"] = skipped_filenames
        metadata["bundle_fingerprint"] = fingerprint
        metadata["total_upload_bytes"] = sum(int(entry["size_bytes"]) for entry in file_manifest)
        metadata["metrics_totals"] = {
            "read_bytes": 0,
            "write_bytes": 0,
            "operations": 0,
        }
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
            workspace_path=str(workspace_path) if uploaded_archives else None,
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
    "/recent",
    response_model=IngestionJobsListResponse,
    tags=["Ingestion"],
    summary="List recent ingestion jobs",
)
def list_recent_ingestion_jobs(limit: int = Query(8, ge=1, le=20)) -> IngestionJobsListResponse:
    with session_scope() as session:
        jobs = session.execute(
            select(IngestionJob).order_by(desc(IngestionJob.created_at), desc(IngestionJob.id)).limit(limit)
        ).scalars().all()

    return IngestionJobsListResponse(items=[serialize_job(job) for job in jobs], total=len(jobs))


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
    "/{job_id}/retry",
    response_model=IngestionStartResponse,
    tags=["Ingestion"],
    summary="Retry an ingestion job from the same source",
    responses={
        404: {"model": ErrorResponse, "description": "The requested ingestion job does not exist."},
        409: {"model": ErrorResponse, "description": "The requested ingestion job is still active."},
    },
)
def retry_ingestion_job(job_id: uuid.UUID) -> IngestionStartResponse:
    with session_scope() as session:
        original_job = session.get(IngestionJob, job_id)
        if original_job is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ingestion job not found.")
        if original_job.status in ACTIVE_INGESTION_JOB_STATUSES:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This ingestion job is still active.")

        source_path = Path(original_job.source_path)
        if not source_path.exists():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The uploaded archive bundle or source directory is no longer available.",
            )

        retried_job = IngestionJob(
            source_kind=original_job.source_kind,
            source_name=original_job.source_name,
            source_path=original_job.source_path,
            workspace_path=workspace_path_for_job(original_job),
            status=IngestionJobStatus.QUEUED,
            detail_message="Queued from retry",
            progress_percent=0,
            raw_metadata=public_job_metadata(original_job),
        )
        session.add(retried_job)
        session.flush()
        retried_job_id = retried_job.id

    async_result = extract_and_parse.delay(str(retried_job_id))

    with session_scope() as session:
        job = session.get(IngestionJob, retried_job_id)
        if job is None:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Retried job disappeared before queue dispatch.")
        job.celery_task_id = async_result.id
        job.detail_message = "Background ingestion queued"
        return IngestionStartResponse(
            job_id=retried_job_id,
            task_id=async_result.id,
            status=job.status,
            message=job.detail_message or "Background ingestion queued",
        )


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
                progress_percent=100,
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


@router.get(
    "/{job_id}/failed-items",
    response_model=IngestionFailedItemsResponse,
    tags=["Ingestion"],
    summary="List failed items for an ingestion job",
)
def get_failed_ingestion_items(job_id: uuid.UUID) -> IngestionFailedItemsResponse:
    with session_scope() as session:
        job = session.get(IngestionJob, job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Ingestion job not found.")
        return build_failed_items_response(session, job, settings)


@router.get(
    "/{job_id}/failed-items/{asset_id}/file",
    response_class=FileResponse,
    tags=["Ingestion"],
    summary="Open a failed ingestion source file",
)
def get_failed_ingestion_item_file(job_id: uuid.UUID, asset_id: uuid.UUID):
    with session_scope() as session:
        job = session.get(IngestionJob, job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Ingestion job not found.")
        return build_failed_item_file_response(session, job, settings, asset_id)


@router.post(
    "/{job_id}/acknowledge-issues",
    response_model=IngestionJobResponse,
    tags=["Ingestion"],
    summary="Acknowledge failed items for an ingestion job",
)
def post_acknowledge_ingestion_issues(job_id: uuid.UUID) -> IngestionJobResponse:
    with session_scope() as session:
        job = acknowledge_ingestion_issues(session, job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Ingestion job not found.")
        return serialize_job(job)


@router.delete(
    "/history",
    response_model=SystemActionResponse,
    tags=["Ingestion"],
    summary="Clear terminal ingestion history",
)
def delete_ingestion_history() -> SystemActionResponse:
    with session_scope() as session:
        cleared = clear_terminal_ingestion_history(session)

    return SystemActionResponse(
        status="accepted",
        message=f"Cleared {cleared} terminal import histor{'y' if cleared == 1 else 'ies'}.",
        affected_items=cleared,
    )
