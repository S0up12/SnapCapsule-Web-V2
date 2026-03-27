from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class SettingsStorageInfo(BaseModel):
    raw_media_dir: str = Field(..., description="Mounted directory that stores original Snapchat media.")
    thumbnail_dir: str = Field(..., description="Mounted directory that stores generated thumbnail images.")


class AppSettingsResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "dark_mode": True,
                "autoplay_videos_in_grid": False,
                "show_memory_overlays": True,
                "default_grid_size": "medium",
                "show_stories_workspace": True,
                "show_story_activity": True,
                "show_snapchat_plus_profile_card": True,
                "enable_debug_logging": False,
                "storage": {
                    "raw_media_dir": "/srv/snapcapsule/raw",
                    "thumbnail_dir": "/srv/snapcapsule/thumbnails",
                },
            }
        }
    )

    dark_mode: bool = Field(..., description="Whether the web shell should render with the dark theme enabled.")
    autoplay_videos_in_grid: bool = Field(
        ...,
        description="Whether muted video thumbnails should begin playback automatically inside gallery views.",
    )
    show_memory_overlays: bool = Field(
        ...,
        description="Whether Snapchat memory overlay PNGs should be composited into thumbnails and the viewer.",
    )
    default_grid_size: str = Field(
        ...,
        description="Preferred thumbnail density used by the memories grid.",
        examples=["medium"],
    )
    show_stories_workspace: bool = Field(
        ...,
        description="Whether the Stories workspace should appear when story data exists in the current archive.",
    )
    show_story_activity: bool = Field(
        ...,
        description="Whether metadata-only Spotlight and shared story activity should render inside the Stories workspace.",
    )
    show_snapchat_plus_profile_card: bool = Field(
        ...,
        description="Whether the Snapchat+ profile card should render when Snapchat+ purchase data exists.",
    )
    enable_debug_logging: bool = Field(
        ...,
        description="Whether backend application loggers should run at debug level.",
    )
    storage: SettingsStorageInfo


class AppSettingsUpdateRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "dark_mode": False,
                "autoplay_videos_in_grid": True,
                "show_memory_overlays": False,
                "default_grid_size": "large",
                "show_stories_workspace": True,
                "show_story_activity": True,
                "show_snapchat_plus_profile_card": True,
                "enable_debug_logging": True,
            }
        }
    )

    dark_mode: bool | None = Field(default=None, description="Persisted dark mode preference.")
    autoplay_videos_in_grid: bool | None = Field(default=None, description="Persisted autoplay preference.")
    show_memory_overlays: bool | None = Field(default=None, description="Persisted memory overlay visibility preference.")
    default_grid_size: str | None = Field(
        default=None,
        description="Persisted default thumbnail size. Accepted values: small, medium, large.",
    )
    show_stories_workspace: bool | None = Field(default=None, description="Persisted Stories workspace visibility preference.")
    show_story_activity: bool | None = Field(default=None, description="Persisted Spotlight/shared story activity visibility preference.")
    show_snapchat_plus_profile_card: bool | None = Field(
        default=None,
        description="Persisted Snapchat+ profile card visibility preference.",
    )
    enable_debug_logging: bool | None = Field(
        default=None,
        description="Persisted backend debug logging preference.",
    )


class SystemActionResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "accepted",
                "message": "Queued 2 mounted archive folder(s) for background rescan.",
                "affected_items": 2,
            }
        }
    )

    status: str = Field(..., description="Outcome classification for the requested system action.")
    message: str = Field(..., description="Short human-readable summary of what happened.")
    affected_items: int = Field(..., description="Count of folders, files, or rows touched by the action.")


class SystemStatusResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "worker_state": "idle",
                "worker_label": "Workers idle",
                "workers_online": 1,
                "active_tasks": 0,
                "queued_tasks": 0,
                "debug_logging_enabled": False,
            }
        }
    )

    worker_state: str = Field(..., description="High-level worker state: offline, idle, or processing.")
    worker_label: str = Field(..., description="User-facing summary of the worker state.")
    workers_online: int = Field(..., description="Number of Celery workers responding to inspect ping.")
    active_tasks: int = Field(..., description="Number of tasks currently executing on connected workers.")
    queued_tasks: int = Field(..., description="Number of tasks waiting in Redis queues.")
    debug_logging_enabled: bool = Field(..., description="Whether backend debug logging is currently enabled.")
