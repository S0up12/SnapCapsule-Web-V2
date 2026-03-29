from __future__ import annotations

import shutil
import uuid
from dataclasses import dataclass
from pathlib import Path

from snapcapsule_core.config import Settings
from snapcapsule_core.db import engine, session_scope
from snapcapsule_core.models import Asset, Base, IngestionJob
from snapcapsule_core.models.enums import IngestionJobStatus, IngestionSourceKind, MediaType
from snapcapsule_core.queue import celery_app, get_redis_client
from snapcapsule_core.tasks.ingestion import extract_and_parse
from snapcapsule_core.tasks.media import rebuild_playback_cache, rebuild_thumbnail_cache


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


@dataclass(slots=True)
class LibraryStorageUsage:
    raw_media_bytes: int
    thumbnail_bytes: int
    playback_cache_bytes: int
    ingest_workspace_bytes: int
    ingest_upload_bytes: int
    total_bytes: int


@dataclass(slots=True)
class LibraryIntegrityReport:
    total_assets: int
    video_assets: int
    playback_derivatives: int
    orphaned_playback_files: int
    missing_original_files: int
    missing_thumbnail_files: int
    missing_overlay_files: int
    playback_error_assets: int


@dataclass(slots=True)
class LibraryDiagnostics:
    storage: LibraryStorageUsage
    integrity: LibraryIntegrityReport


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


def _sum_directory_size(root: Path) -> int:
    if not root.exists():
        return 0
    total = 0
    for path in root.rglob("*"):
        if path.is_file():
            try:
                total += path.stat().st_size
            except OSError:
                continue
    return total


def get_library_diagnostics(settings: Settings) -> LibraryDiagnostics:
    raw_media_root = Path(settings.raw_media_dir)
    thumbnail_root = Path(settings.thumbnail_dir)
    playback_root = thumbnail_root / "playback"
    workspace_root = settings.ingest_workspace_dir
    upload_root = settings.ingest_upload_dir

    playback_files = {path.stem for path in playback_root.glob("*.mp4")} if playback_root.exists() else set()

    with session_scope() as session:
        assets = session.query(Asset).all()

    video_asset_ids = {str(asset.id) for asset in assets if asset.media_type == MediaType.VIDEO}
    missing_original_files = 0
    missing_thumbnail_files = 0
    missing_overlay_files = 0
    playback_error_assets = 0
    for asset in assets:
        if not Path(asset.original_path).exists():
            missing_original_files += 1
        if asset.thumbnail_path and not Path(asset.thumbnail_path).exists():
            missing_thumbnail_files += 1
        if asset.overlay_path and not Path(asset.overlay_path).exists():
            missing_overlay_files += 1
        if isinstance(asset.raw_metadata, dict) and asset.raw_metadata.get("playback_error"):
            playback_error_assets += 1

    playback_cache_bytes = _sum_directory_size(playback_root)
    thumbnail_bytes = max(_sum_directory_size(thumbnail_root) - playback_cache_bytes, 0)
    raw_media_bytes = _sum_directory_size(raw_media_root)
    ingest_workspace_bytes = _sum_directory_size(workspace_root)
    ingest_upload_bytes = _sum_directory_size(upload_root)

    storage = LibraryStorageUsage(
        raw_media_bytes=raw_media_bytes,
        thumbnail_bytes=thumbnail_bytes,
        playback_cache_bytes=playback_cache_bytes,
        ingest_workspace_bytes=ingest_workspace_bytes,
        ingest_upload_bytes=ingest_upload_bytes,
        total_bytes=raw_media_bytes + thumbnail_bytes + playback_cache_bytes + ingest_workspace_bytes + ingest_upload_bytes,
    )
    integrity = LibraryIntegrityReport(
        total_assets=len(assets),
        video_assets=len(video_asset_ids),
        playback_derivatives=len(playback_files),
        orphaned_playback_files=len(playback_files - video_asset_ids),
        missing_original_files=missing_original_files,
        missing_thumbnail_files=missing_thumbnail_files,
        missing_overlay_files=missing_overlay_files,
        playback_error_assets=playback_error_assets,
    )
    return LibraryDiagnostics(storage=storage, integrity=integrity)


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


def queue_thumbnail_rebuild(settings: Settings) -> ActionResult:
    Path(settings.thumbnail_dir).mkdir(parents=True, exist_ok=True)

    with session_scope() as session:
        asset_count = (
            session.query(Asset)
            .filter(Asset.media_type.in_((MediaType.IMAGE, MediaType.VIDEO)))
            .count()
        )

    if asset_count == 0:
        return ActionResult(
            status="ok",
            message="No image or video assets were found to rebuild thumbnails for.",
            affected_items=0,
        )

    rebuild_thumbnail_cache.delay()
    return ActionResult(
        status="accepted",
        message=f"Queued a background thumbnail rebuild for {asset_count} asset(s).",
        affected_items=asset_count,
    )


def queue_playback_rebuild(settings: Settings) -> ActionResult:
    Path(settings.thumbnail_dir).mkdir(parents=True, exist_ok=True)

    with session_scope() as session:
        asset_count = (
            session.query(Asset)
            .filter(Asset.media_type == MediaType.VIDEO)
            .count()
        )

    if asset_count == 0:
        return ActionResult(
            status="ok",
            message="No video assets were found to rebuild playback for.",
            affected_items=0,
        )

    rebuild_playback_cache.delay()
    return ActionResult(
        status="accepted",
        message=f"Queued a background playback-cache rebuild for {asset_count} video asset(s).",
        affected_items=asset_count,
    )


def clean_playback_cache(settings: Settings) -> ActionResult:
    playback_root = Path(settings.thumbnail_dir) / "playback"
    playback_root.mkdir(parents=True, exist_ok=True)

    with session_scope() as session:
        referenced_asset_ids = {
            str(asset_id)
            for asset_id, in session.query(Asset.id).filter(Asset.media_type == MediaType.VIDEO).all()
        }

    removed = 0
    for candidate in playback_root.glob("*.mp4"):
        if candidate.stem in referenced_asset_ids:
            continue
        candidate.unlink(missing_ok=True)
        removed += 1

    return ActionResult(
        status="ok",
        message=f"Removed {removed} orphaned playback cache file(s).",
        affected_items=removed,
    )


def verify_library_files(settings: Settings) -> ActionResult:
    diagnostics = get_library_diagnostics(settings)
    missing_total = (
        diagnostics.integrity.missing_original_files
        + diagnostics.integrity.missing_thumbnail_files
        + diagnostics.integrity.missing_overlay_files
    )
    return ActionResult(
        status="ok" if missing_total == 0 else "warning",
        message=(
            "Library verification completed with no missing file links."
            if missing_total == 0
            else f"Library verification found {missing_total} missing file link(s)."
        ),
        affected_items=missing_total,
    )
