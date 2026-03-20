from __future__ import annotations

import shutil
import uuid
from dataclasses import dataclass
from pathlib import Path

from snapcapsule_core.config import Settings
from snapcapsule_core.db import engine, session_scope
from snapcapsule_core.models import Base, IngestionJob
from snapcapsule_core.models.enums import IngestionJobStatus, IngestionSourceKind
from snapcapsule_core.queue import celery_app, get_redis_client
from snapcapsule_core.tasks.ingestion import extract_and_parse


@dataclass(slots=True)
class SystemQueueStatus:
    worker_state: str
    worker_label: str
    workers_online: int
    active_tasks: int
    queued_tasks: int


@dataclass(slots=True)
class ActionResult:
    status: str
    message: str
    affected_items: int = 0


def get_system_queue_status() -> SystemQueueStatus:
    workers_online = 0
    active_tasks = 0
    queued_tasks = 0

    try:
        inspect = celery_app.control.inspect(timeout=1.0)
        ping_result = inspect.ping() or {}
        active_result = inspect.active() or {}
        workers_online = len(ping_result)
        active_tasks = sum(len(items) for items in active_result.values())
    except Exception:
        ping_result = {}

    try:
        redis_client = get_redis_client()
        queued_tasks = int(redis_client.llen("ingest")) + int(redis_client.llen("media"))
    except Exception:
        queued_tasks = 0

    if workers_online == 0:
        return SystemQueueStatus(
            worker_state="offline",
            worker_label="Workers offline",
            workers_online=0,
            active_tasks=active_tasks,
            queued_tasks=queued_tasks,
        )

    if active_tasks > 0 or queued_tasks > 0:
        return SystemQueueStatus(
            worker_state="processing",
            worker_label="Workers processing",
            workers_online=workers_online,
            active_tasks=active_tasks,
            queued_tasks=queued_tasks,
        )

    return SystemQueueStatus(
        worker_state="idle",
        worker_label="Workers idle",
        workers_online=workers_online,
        active_tasks=0,
        queued_tasks=queued_tasks,
    )


def clear_ingestion_cache(settings: Settings) -> ActionResult:
    removed_items = 0
    for root in (settings.ingest_upload_dir, settings.ingest_workspace_dir):
        root.mkdir(parents=True, exist_ok=True)
        for child in root.iterdir():
            if child.is_dir():
                shutil.rmtree(child, ignore_errors=True)
                removed_items += 1
            else:
                child.unlink(missing_ok=True)
                removed_items += 1

    return ActionResult(
        status="ok",
        message="Temporary ingestion cache cleared.",
        affected_items=removed_items,
    )


def reset_archive_data(settings: Settings) -> ActionResult:
    for directory in (Path(settings.raw_media_dir), Path(settings.thumbnail_dir), settings.ingest_upload_dir, settings.ingest_workspace_dir):
        directory.mkdir(parents=True, exist_ok=True)
        for child in directory.iterdir():
            if child.is_dir():
                shutil.rmtree(child, ignore_errors=True)
            else:
                child.unlink(missing_ok=True)

    settings.profile_snapshot_path.unlink(missing_ok=True)

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    return ActionResult(
        status="ok",
        message="Database, generated media, and saved profile data were cleared. Archive is ready for a fresh import.",
        affected_items=0,
    )


def queue_library_rescan(settings: Settings) -> ActionResult:
    archive_root = settings.ingest_archive_dir
    archive_root.mkdir(parents=True, exist_ok=True)
    directories = sorted(path for path in archive_root.iterdir() if path.is_dir())
    if not directories:
        return ActionResult(
            status="ok",
            message="No mounted archive folders were found to rescan.",
            affected_items=0,
        )

    queued_job_ids: list[str] = []
    with session_scope() as session:
        for directory in directories:
            job = IngestionJob(
                source_kind=IngestionSourceKind.DIRECTORY,
                source_name=directory.name,
                source_path=str(directory.resolve()),
                status=IngestionJobStatus.QUEUED,
                detail_message="Queued from library rescan",
                progress_percent=0,
                raw_metadata={"rescan": True},
            )
            session.add(job)
            session.flush()
            queued_job_ids.append(str(job.id))

    for job_id in queued_job_ids:
        async_result = extract_and_parse.delay(job_id)
        with session_scope() as session:
            job = session.get(IngestionJob, uuid.UUID(job_id))
            if job is not None:
                job.celery_task_id = async_result.id
                job.detail_message = "Background rescan started"

    return ActionResult(
        status="accepted",
        message=f"Queued {len(queued_job_ids)} mounted archive folder(s) for background rescan.",
        affected_items=len(queued_job_ids),
    )
