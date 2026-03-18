from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from snapcapsule_core.models.enums import IngestionJobStatus, IngestionSourceKind, MediaType


class ErrorResponse(BaseModel):
    detail: str = Field(
        ...,
        description="Human-readable error message returned by the API.",
        examples=["Asset not found."],
    )


class StorageDirectories(BaseModel):
    raw_media_dir: str = Field(
        ...,
        description="Mounted directory used to store original Snapchat media files.",
        examples=["/srv/snapcapsule/raw"],
    )
    thumbnail_dir: str = Field(
        ...,
        description="Mounted directory used to store web-optimized thumbnail files.",
        examples=["/srv/snapcapsule/thumbnails"],
    )


class RootResponse(BaseModel):
    service: str = Field(..., description="Display name of the running API service.", examples=["SnapCapsule Web API"])
    status: str = Field(..., description="Top-level service status.", examples=["ok"])
    healthcheck: str = Field(..., description="Path to the machine-readable health endpoint.", examples=["/health"])
    storage: StorageDirectories


class ServiceHealth(BaseModel):
    status: str = Field(..., description="Status reported by a dependency check.", examples=["ok"])
    error: str | None = Field(
        default=None,
        description="Dependency error details when the service is degraded.",
        examples=[None],
    )


class HealthServices(BaseModel):
    database: ServiceHealth
    redis: ServiceHealth


class HealthResponse(BaseModel):
    status: str = Field(..., description="Aggregated platform health status.", examples=["ok"])
    services: HealthServices


class AssetSummary(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "eba274cb-6509-40f6-9a9f-df634f0f2894",
                "taken_at": "2024-01-03T00:00:00+00:00",
                "media_type": "video",
                "is_favorite": True,
                "tags": ["vacation", "beach"],
                "has_overlay": False,
            }
        }
    )

    id: UUID = Field(..., description="Stable asset identifier used by timeline and media endpoints.")
    taken_at: datetime | None = Field(
        ...,
        description="Best-known capture timestamp used for timeline ordering.",
        examples=["2024-01-03T00:00:00+00:00"],
    )
    media_type: MediaType = Field(..., description="Normalized media type returned by the API.")
    is_favorite: bool = Field(..., description="Whether the asset is currently marked as a favorite.")
    tags: list[str] = Field(..., description="User-defined text tags associated with the asset.")
    has_overlay: bool = Field(..., description="Whether Snapchat provided a separate overlay image for this asset.")


class TimelineSummary(BaseModel):
    total_assets: int = Field(..., description="Total number of assets matching the active filters.")
    total_photos: int = Field(..., description="Number of photo assets matching the active filters.")
    total_videos: int = Field(..., description="Number of video assets matching the active filters.")


class TimelinePageResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "items": [
                    {
                        "id": "eba274cb-6509-40f6-9a9f-df634f0f2894",
                        "taken_at": "2024-01-03T00:00:00+00:00",
                        "media_type": "video",
                        "is_favorite": True,
                        "tags": ["vacation", "beach"],
                        "has_overlay": False,
                    }
                ],
                "limit": 100,
                "offset": 0,
                "total": 12453,
                "has_more": True,
                "summary": {
                    "total_assets": 12453,
                    "total_photos": 10984,
                    "total_videos": 1469,
                },
            }
        }
    )

    items: list[AssetSummary] = Field(..., description="Current timeline page of assets ordered newest first.")
    limit: int = Field(..., description="Page size requested by the client.", examples=[100])
    offset: int = Field(..., description="Zero-based row offset used for pagination.", examples=[0])
    total: int = Field(..., description="Total number of timeline assets currently available.", examples=[12453])
    has_more: bool = Field(..., description="Whether more assets exist beyond the current page.", examples=[True])
    summary: TimelineSummary


class DashboardStatsResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "total_assets": 12453,
                "total_memories": 12453,
                "total_photos": 10984,
                "total_videos": 1469,
            }
        }
    )

    total_assets: int = Field(..., description="Total processed photo and video assets available for the web UI.")
    total_memories: int = Field(..., description="Alias of total processed assets used by the dashboard cards.")
    total_photos: int = Field(..., description="Total processed image assets available in the archive.")
    total_videos: int = Field(..., description="Total processed video assets available in the archive.")


class TimelineTagsResponse(BaseModel):
    tags: list[str] = Field(..., description="Distinct user-defined asset tags available for filtering.")


class AssetMutationResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "eba274cb-6509-40f6-9a9f-df634f0f2894",
                "is_favorite": True,
                "tags": ["vacation", "beach"],
            }
        }
    )

    id: UUID = Field(..., description="Asset identifier that was updated.")
    is_favorite: bool = Field(..., description="Latest favorite flag after the mutation.")
    tags: list[str] = Field(..., description="Latest normalized tag list after the mutation.")


class AssetTagsUpdateRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "tags": ["vacation", "beach"],
            }
        }
    )

    tags: list[str] = Field(..., description="Complete replacement tag list for the target asset.")


class ChatConversationSummary(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "b57fa2aa-c88c-4ea4-b421-cbbf9227155d",
                "display_name": "bestfriend123",
                "latest_at": "2024-01-03T10:15:00+00:00",
                "latest_preview": "You: Media attachment",
                "has_media": True,
                "is_group": False,
            }
        }
    )

    id: UUID = Field(..., description="Stable chat thread identifier.")
    display_name: str = Field(..., description="Best available conversation label shown in the chat list.")
    latest_at: datetime | None = Field(default=None, description="Timestamp of the most recent interaction in the thread.")
    latest_preview: str = Field(..., description="Short preview line derived from the latest message in the conversation.")
    has_media: bool = Field(..., description="Whether the conversation contains one or more linked media assets.")
    is_group: bool = Field(..., description="Whether the conversation is a group chat.")


class ChatListResponse(BaseModel):
    items: list[ChatConversationSummary] = Field(..., description="Conversation list rows matching the current query.")
    total: int = Field(..., description="Total number of conversations returned by the current filters.")


class ChatMediaAssetSummary(BaseModel):
    id: UUID = Field(..., description="Asset identifier for thumbnails and original media routes.")
    taken_at: datetime | None = Field(default=None, description="Capture or sent timestamp for the media asset.")
    media_type: MediaType = Field(..., description="Media type for thumbnail and lightbox rendering.")
    is_favorite: bool = Field(..., description="Whether the linked media asset is favorited.")
    tags: list[str] = Field(..., description="Current user-defined tags attached to the linked asset.")
    has_overlay: bool = Field(..., description="Whether the media asset has a separate Snapchat overlay image.")


class ChatMessageGroup(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "3d2f5da6-969f-4387-bad0-b4b718c243ab",
                "sender": "Me",
                "sender_label": "ME",
                "is_me": True,
                "text": "Check this out",
                "sent_at": "2024-01-03T10:15:00+00:00",
                "media_assets": [
                    {
                        "id": "eba274cb-6509-40f6-9a9f-df634f0f2894",
                        "taken_at": "2024-01-03T10:15:00+00:00",
                        "media_type": "image",
                        "is_favorite": False,
                        "tags": [],
                        "has_overlay": False,
                    }
                ],
            }
        }
    )

    id: str = Field(..., description="Stable identifier for the grouped chat bubble.")
    sender: str = Field(..., description="Original sender name from the imported export.")
    sender_label: str = Field(..., description="Display sender label used in the chat UI.")
    is_me: bool = Field(..., description="Whether the sender should be rendered as the local user.")
    text: str = Field(..., description="Combined text content for this grouped chat bubble.")
    sent_at: datetime = Field(..., description="Timestamp used for chronological rendering.")
    media_assets: list[ChatMediaAssetSummary] = Field(..., description="Chronologically attached media assets for the bubble.")


class ChatMessagesResponse(BaseModel):
    items: list[ChatMessageGroup] = Field(..., description="Chronological grouped chat bubbles for the requested conversation.")
    total: int = Field(..., description="Total grouped chat bubbles available for the conversation.")
    limit: int = Field(..., description="Requested page size.")
    offset: int = Field(..., description="Requested grouped-message offset.")
    has_more: bool = Field(..., description="Whether additional grouped chat bubbles exist beyond the current page.")


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


class IngestionStartResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "job_id": "09722d7e-4662-4355-8fa2-4ae84de45dae",
                "task_id": "0e86606f-d10f-4c9d-9cb8-7eab0ba629ff",
                "status": "queued",
                "message": "Background ingestion queued",
            }
        }
    )

    job_id: UUID = Field(..., description="Database identifier for the ingestion job.")
    task_id: str = Field(..., description="Celery task identifier for the background parser task.")
    status: IngestionJobStatus = Field(..., description="Current ingestion job state immediately after queueing.")
    message: str = Field(..., description="Short user-facing summary of the queued ingestion.")


class IngestionDirectoryRequest(BaseModel):
    directory_path: str = Field(
        ...,
        description="Absolute path inside the backend container pointing to an extracted Snapchat export directory.",
        examples=["/srv/snapcapsule/ingest/sample-export"],
    )


class IngestionCancelRequest(BaseModel):
    job_id: UUID = Field(..., description="Ingestion job identifier to cancel.")


class IngestionJobResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "09722d7e-4662-4355-8fa2-4ae84de45dae",
                "source_kind": "directory",
                "source_name": "sample-export",
                "source_path": "/srv/snapcapsule/ingest/sample-export",
                "workspace_path": None,
                "celery_task_id": "0e86606f-d10f-4c9d-9cb8-7eab0ba629ff",
                "status": "completed",
                "detail_message": "Ingestion completed",
                "progress_percent": 100,
                "total_assets": 3,
                "processed_assets": 3,
                "failed_assets": 0,
                "error_message": None,
                "created_at": "2026-03-17T12:51:37.153488+00:00",
                "updated_at": "2026-03-17T12:51:37.759333+00:00",
                "finished_at": "2026-03-17T12:51:37.930270+00:00",
                "raw_metadata": {"archive_count": 2, "uploaded_filenames": ["part1.zip", "part2.zip"]},
            }
        }
    )

    id: UUID = Field(..., description="Stable ingestion job identifier.")
    source_kind: IngestionSourceKind = Field(..., description="Whether the job came from an uploaded ZIP or a mounted directory.")
    source_name: str = Field(..., description="Friendly source label shown in the UI.")
    source_path: str = Field(..., description="Absolute source path used by the backend worker.")
    workspace_path: str | None = Field(
        default=None,
        description="Temporary extraction directory when the source was an uploaded archive.",
    )
    celery_task_id: str | None = Field(default=None, description="Primary Celery task identifier for ingestion orchestration.")
    status: IngestionJobStatus = Field(..., description="Current lifecycle status of the ingestion job.")
    detail_message: str | None = Field(default=None, description="Short progress text suitable for status UIs.")
    progress_percent: int = Field(..., description="Approximate job completion percentage from 0 to 100.", examples=[50])
    total_assets: int = Field(..., description="Number of media assets discovered by the parser.", examples=[3])
    processed_assets: int = Field(..., description="Number of assets successfully processed into raw and thumbnail storage.", examples=[3])
    failed_assets: int = Field(..., description="Number of assets that failed derivative processing.", examples=[0])
    error_message: str | None = Field(default=None, description="Last recorded job-level error message, if any.")
    created_at: datetime | None = Field(default=None, description="Timestamp when the ingestion job was created.")
    updated_at: datetime | None = Field(default=None, description="Timestamp when the ingestion job last changed.")
    finished_at: datetime | None = Field(default=None, description="Timestamp when the job reached a terminal state.")
    raw_metadata: dict[str, Any] | None = Field(
        default=None,
        description="Source-specific metadata captured during request intake and parsing.",
    )
