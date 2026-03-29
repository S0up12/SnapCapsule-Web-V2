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
                "prefer_browser_playback": True,
                "autoplay_videos_in_grid": False,
                "mute_video_previews": True,
                "loop_video_previews": True,
                "video_preview_hover_delay": "1.2s",
                "autoplay_videos_in_lightbox": True,
                "show_memory_overlays": True,
                "default_grid_size": "medium",
                "timeline_default_sort": "newest",
                "timeline_default_filter": "all",
                "timeline_date_grouping": "year",
                "remember_last_timeline_filters": False,
                "show_undated_assets": True,
                "show_stories_workspace": True,
                "show_story_activity": True,
                "show_snapchat_plus_profile_card": True,
                "blur_private_names": False,
                "hide_exact_timestamps": False,
                "demo_safe_mode": False,
                "enable_debug_logging": False,
                "storage": {
                    "raw_media_dir": "/srv/snapcapsule/raw",
                    "thumbnail_dir": "/srv/snapcapsule/thumbnails",
                },
            }
        }
    )

    dark_mode: bool = Field(..., description="Whether the web shell should render with the dark theme enabled.")
    prefer_browser_playback: bool = Field(
        ...,
        description="Whether video playback should prefer the browser-compatible cached stream over the archived original.",
    )
    autoplay_videos_in_grid: bool = Field(
        ...,
        description="Whether muted video thumbnails should begin playback automatically inside gallery views.",
    )
    mute_video_previews: bool = Field(..., description="Whether grid video previews should start muted.")
    loop_video_previews: bool = Field(..., description="Whether grid video previews should loop continuously.")
    video_preview_hover_delay: str = Field(
        ...,
        description="Delay before a grid video preview starts. Accepted values: off, 0.6s, 1.2s, 2s.",
    )
    autoplay_videos_in_lightbox: bool = Field(
        ...,
        description="Whether videos should autoplay when opened in the media viewer.",
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
    timeline_default_sort: str = Field(
        ...,
        description="Preferred default sort order for the memories timeline. Accepted values: newest, oldest.",
    )
    timeline_default_filter: str = Field(
        ...,
        description="Preferred default filter for the memories timeline. Accepted values: all, photos, videos, favorites.",
    )
    timeline_date_grouping: str = Field(
        ...,
        description="Preferred date grouping for the memories timeline. Accepted values: year, month, day.",
    )
    remember_last_timeline_filters: bool = Field(
        ...,
        description="Whether timeline control changes should update the persisted defaults automatically.",
    )
    show_undated_assets: bool = Field(
        ...,
        description="Whether memories without an exported capture timestamp should remain visible in the timeline.",
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
    blur_private_names: bool = Field(
        ...,
        description="Whether personal names and account labels should blur in chats and profile views until hovered.",
    )
    hide_exact_timestamps: bool = Field(
        ...,
        description="Whether chats and profile views should show date-only summaries instead of exact times.",
    )
    demo_safe_mode: bool = Field(
        ...,
        description="Whether privacy-friendly presentation defaults should be forced for chats and profile views.",
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
                "prefer_browser_playback": True,
                "autoplay_videos_in_grid": True,
                "mute_video_previews": True,
                "loop_video_previews": True,
                "video_preview_hover_delay": "0.6s",
                "autoplay_videos_in_lightbox": False,
                "show_memory_overlays": False,
                "default_grid_size": "large",
                "timeline_default_sort": "oldest",
                "timeline_default_filter": "favorites",
                "timeline_date_grouping": "month",
                "remember_last_timeline_filters": True,
                "show_undated_assets": False,
                "show_stories_workspace": True,
                "show_story_activity": True,
                "show_snapchat_plus_profile_card": True,
                "blur_private_names": True,
                "hide_exact_timestamps": True,
                "demo_safe_mode": False,
                "enable_debug_logging": True,
            }
        }
    )

    dark_mode: bool | None = Field(default=None, description="Persisted dark mode preference.")
    prefer_browser_playback: bool | None = Field(default=None, description="Persisted browser-compatible playback preference.")
    autoplay_videos_in_grid: bool | None = Field(default=None, description="Persisted autoplay preference.")
    mute_video_previews: bool | None = Field(default=None, description="Persisted grid video mute preference.")
    loop_video_previews: bool | None = Field(default=None, description="Persisted looping preference for grid video previews.")
    video_preview_hover_delay: str | None = Field(
        default=None,
        description="Persisted preview delay. Accepted values: off, 0.6s, 1.2s, 2s.",
    )
    autoplay_videos_in_lightbox: bool | None = Field(
        default=None,
        description="Persisted viewer autoplay preference.",
    )
    show_memory_overlays: bool | None = Field(default=None, description="Persisted memory overlay visibility preference.")
    default_grid_size: str | None = Field(
        default=None,
        description="Persisted default thumbnail size. Accepted values: small, medium, large.",
    )
    timeline_default_sort: str | None = Field(
        default=None,
        description="Persisted memories default sort. Accepted values: newest, oldest.",
    )
    timeline_default_filter: str | None = Field(
        default=None,
        description="Persisted memories default filter. Accepted values: all, photos, videos, favorites.",
    )
    timeline_date_grouping: str | None = Field(
        default=None,
        description="Persisted memories date grouping. Accepted values: year, month, day.",
    )
    remember_last_timeline_filters: bool | None = Field(
        default=None,
        description="Persisted preference for remembering timeline control changes.",
    )
    show_undated_assets: bool | None = Field(
        default=None,
        description="Persisted preference for showing undated memories.",
    )
    show_stories_workspace: bool | None = Field(default=None, description="Persisted Stories workspace visibility preference.")
    show_story_activity: bool | None = Field(default=None, description="Persisted Spotlight/shared story activity visibility preference.")
    show_snapchat_plus_profile_card: bool | None = Field(
        default=None,
        description="Persisted Snapchat+ profile card visibility preference.",
    )
    blur_private_names: bool | None = Field(default=None, description="Persisted privacy blur preference for names.")
    hide_exact_timestamps: bool | None = Field(default=None, description="Persisted privacy preference for timestamp precision.")
    demo_safe_mode: bool | None = Field(default=None, description="Persisted presentation-safe privacy mode.")
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
