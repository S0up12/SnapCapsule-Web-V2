from __future__ import annotations

from fastapi import APIRouter

from apps.api.app.api.schemas import (
    AppSettingsResponse,
    AppSettingsUpdateRequest,
    SystemActionResponse,
    SystemStatusResponse,
)
from snapcapsule_core.config import get_settings
from snapcapsule_core.services.settings_store import SettingsStore
from snapcapsule_core.services.system_tools import clear_ingestion_cache, get_system_queue_status, queue_library_rescan, reset_archive_data

router = APIRouter(prefix="/api")
settings = get_settings()
settings_store = SettingsStore(settings)


def _serialize_settings() -> AppSettingsResponse:
    stored = settings_store.load()
    return AppSettingsResponse(
        dark_mode=stored.dark_mode,
        autoplay_videos_in_grid=stored.autoplay_videos_in_grid,
        show_memory_overlays=stored.show_memory_overlays,
        default_grid_size=stored.default_grid_size,
        show_stories_workspace=stored.show_stories_workspace,
        show_story_activity=stored.show_story_activity,
        show_snapchat_plus_profile_card=stored.show_snapchat_plus_profile_card,
        enable_debug_logging=stored.enable_debug_logging,
        storage={
            "raw_media_dir": settings.raw_media_dir,
            "thumbnail_dir": settings.thumbnail_dir,
        },
    )


@router.get(
    "/settings",
    response_model=AppSettingsResponse,
    tags=["Settings"],
    summary="Get persisted application settings",
)
def get_app_settings() -> AppSettingsResponse:
    """Return saved UI and developer preferences together with the active media storage mount paths."""
    return _serialize_settings()


@router.post(
    "/settings",
    response_model=AppSettingsResponse,
    tags=["Settings"],
    summary="Save application settings",
)
def save_app_settings(payload: AppSettingsUpdateRequest) -> AppSettingsResponse:
    """Persist UI preferences and backend debug settings for the current development environment."""
    updates = payload.model_dump(exclude_none=True)
    settings_store.save(updates)
    return _serialize_settings()


@router.get(
    "/system/status",
    response_model=SystemStatusResponse,
    tags=["System"],
    summary="Get worker and queue status",
)
def get_system_status() -> SystemStatusResponse:
    """Return a small operational snapshot for developer-facing settings panels and admin cards."""
    queue_status = get_system_queue_status()
    stored = settings_store.load()
    return SystemStatusResponse(
        worker_state=queue_status.worker_state,
        worker_label=queue_status.worker_label,
        workers_online=queue_status.workers_online,
        active_tasks=queue_status.active_tasks,
        queued_tasks=queue_status.queued_tasks,
        debug_logging_enabled=stored.enable_debug_logging,
    )


@router.post(
    "/system/rescan",
    response_model=SystemActionResponse,
    tags=["System"],
    summary="Queue a mounted-folder library rescan",
)
def post_system_rescan() -> SystemActionResponse:
    """Queue background ingestion jobs for mounted archive directories found under the archive rescan folder."""
    result = queue_library_rescan(settings)
    return SystemActionResponse(
        status=result.status,
        message=result.message,
        affected_items=result.affected_items,
    )


@router.post(
    "/system/clear-cache",
    response_model=SystemActionResponse,
    tags=["System"],
    summary="Clear temporary ingestion cache",
)
def post_clear_cache() -> SystemActionResponse:
    """Delete temporary uploaded ZIPs and extracted workspaces without touching the main archive library."""
    result = clear_ingestion_cache(settings)
    return SystemActionResponse(
        status=result.status,
        message=result.message,
        affected_items=result.affected_items,
    )


@router.post(
    "/system/reset",
    response_model=SystemActionResponse,
    tags=["System"],
    summary="Clear archive metadata and generated media",
)
def post_reset_archive() -> SystemActionResponse:
    """Reset PostgreSQL metadata plus generated raw and thumbnail files so the archive can be imported again from scratch."""
    result = reset_archive_data(settings)
    return SystemActionResponse(
        status=result.status,
        message=result.message,
        affected_items=result.affected_items,
    )
