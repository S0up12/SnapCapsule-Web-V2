from __future__ import annotations

import hashlib
import json
from pathlib import Path

from snapcapsule_core.models import IngestionJob
from snapcapsule_core.models.enums import IngestionJobStatus, IngestionSourceKind
from snapcapsule_core.services.ingestion_jobs import ACTIVE_INGESTION_JOB_STATUSES, public_job_metadata

from apps.api.app.api.schemas import IngestionJobResponse


def copy_upload_with_checksum(upload, destination: Path) -> tuple[str, int]:
    digest = hashlib.sha256()
    size_bytes = 0
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as handle:
        while True:
            chunk = upload.file.read(1024 * 1024)
            if not chunk:
                break
            handle.write(chunk)
            digest.update(chunk)
            size_bytes += len(chunk)
    upload.file.seek(0)
    return digest.hexdigest(), size_bytes


def bundle_fingerprint(file_manifest: list[dict[str, object]]) -> str:
    payload = json.dumps(
        sorted(file_manifest, key=lambda item: str(item["name"]).lower()),
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def job_is_reusable_import(job: IngestionJob) -> bool:
    return (
        job.status in ACTIVE_INGESTION_JOB_STATUSES
        or job.status == IngestionJobStatus.COMPLETED
        or (job.processed_assets > 0 and job.failed_assets > 0 and job.total_assets > job.failed_assets)
    )


def normalize_archive_manifest(
    file_manifest: list[dict[str, object]],
    upload_jobs: list[IngestionJob],
) -> tuple[list[dict[str, object]], list[str], IngestionJob | None]:
    reusable_jobs = [job for job in upload_jobs if job_is_reusable_import(job)]
    imported_checksums: set[str] = set()
    latest_job_by_checksum: dict[str, IngestionJob] = {}
    for job in reusable_jobs:
        metadata = public_job_metadata(job) or {}
        for checksum in metadata.get("archive_checksums", []) or []:
            normalized = str(checksum).strip()
            if not normalized:
                continue
            imported_checksums.add(normalized)
            latest_job_by_checksum.setdefault(normalized, job)

    seen_checksums_in_request: set[str] = set()
    filtered_manifest: list[dict[str, object]] = []
    skipped_filenames: list[str] = []
    reused_job: IngestionJob | None = None
    for entry in file_manifest:
        checksum = str(entry.get("checksum_sha256") or "").strip()
        filename = str(entry.get("name") or entry.get("stored_name") or "archive.zip")
        if not checksum:
            filtered_manifest.append(entry)
            continue
        if checksum in seen_checksums_in_request:
            skipped_filenames.append(filename)
            continue
        seen_checksums_in_request.add(checksum)
        if checksum in imported_checksums:
            skipped_filenames.append(filename)
            reused_job = reused_job or latest_job_by_checksum.get(checksum)
            continue
        filtered_manifest.append(entry)

    return filtered_manifest, skipped_filenames, reused_job


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


def build_upload_source_name(uploaded_filenames: list[str]) -> str:
    if len(uploaded_filenames) == 1:
        return uploaded_filenames[0]
    return f"{len(uploaded_filenames)} uploaded archives"


def workspace_path_for_job(job: IngestionJob) -> str | None:
    if job.source_kind != IngestionSourceKind.UPLOAD:
        return None
    return job.workspace_path
