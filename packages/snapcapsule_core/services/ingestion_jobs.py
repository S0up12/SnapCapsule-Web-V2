from __future__ import annotations

import shutil
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from snapcapsule_core.models import IngestionJob
from snapcapsule_core.models.enums import IngestionJobStatus, IngestionSourceKind

_UNSET = object()

TERMINAL_INGESTION_JOB_STATUSES = {
    IngestionJobStatus.COMPLETED,
    IngestionJobStatus.CANCELED,
    IngestionJobStatus.FAILED,
}

ACTIVE_INGESTION_JOB_STATUSES = {
    IngestionJobStatus.QUEUED,
    IngestionJobStatus.EXTRACTING,
    IngestionJobStatus.PARSING,
    IngestionJobStatus.PROCESSING_MEDIA,
}


class JobCanceledError(RuntimeError):
    """Raised when a running job has been canceled by the user."""


def get_job_metadata(job: IngestionJob) -> dict[str, Any]:
    return dict(job.raw_metadata or {})


def set_job_metadata(job: IngestionJob, metadata: dict[str, Any]) -> None:
    job.raw_metadata = metadata or None


def public_job_metadata(job: IngestionJob) -> dict[str, Any] | None:
    if not job.raw_metadata:
        return None
    return {
        key: value
        for key, value in job.raw_metadata.items()
        if not key.startswith("_")
    } or None


def mark_job_status(
    job: IngestionJob,
    *,
    status: IngestionJobStatus | None = None,
    detail_message: str | None = None,
    progress_percent: int | None = None,
    error_message: str | None | object = _UNSET,
    finished: bool = False,
) -> None:
    if status is not None:
        job.status = status
    if detail_message is not None:
        job.detail_message = detail_message
    if progress_percent is not None:
        job.progress_percent = progress_percent
    if error_message is not _UNSET:
        job.error_message = error_message
    if finished:
        job.finished_at = datetime.now(UTC)


def ensure_job_not_canceled(job: IngestionJob) -> None:
    if job.status == IngestionJobStatus.CANCELED:
        raise JobCanceledError(f"Ingestion job {job.id} was canceled")


def cleanup_successful_upload_artifacts(job: IngestionJob) -> None:
    if job.source_kind != IngestionSourceKind.UPLOAD:
        if job.workspace_path:
            shutil.rmtree(job.workspace_path, ignore_errors=True)
        return

    for raw_path in (job.source_path, job.workspace_path):
        if not raw_path:
            continue
        target = Path(raw_path)
        if target.is_dir():
            shutil.rmtree(target, ignore_errors=True)
        elif target.exists():
            target.unlink(missing_ok=True)


def summarize_exception_message(error: Exception | str) -> str:
    message = str(error).strip()
    if "uq_chat_messages_dedupe_key" in message or "chat_messages_dedupe_key" in message:
        return "Duplicate chat messages were detected while combining archive parts."
    if "duplicate key value violates unique constraint" in message:
        return "A uniqueness constraint failed while saving imported data."
    if not message:
        return "Unexpected ingestion error."

    first_line = next((line.strip() for line in message.splitlines() if line.strip()), message)
    if len(first_line) > 280:
        return first_line[:277].rstrip() + "..."
    return first_line
