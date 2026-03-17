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


class TimelinePageResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "items": [
                    {
                        "id": "eba274cb-6509-40f6-9a9f-df634f0f2894",
                        "taken_at": "2024-01-03T00:00:00+00:00",
                        "media_type": "video",
                    }
                ],
                "limit": 100,
                "offset": 0,
                "total": 12453,
                "has_more": True,
            }
        }
    )

    items: list[AssetSummary] = Field(..., description="Current timeline page of assets ordered newest first.")
    limit: int = Field(..., description="Page size requested by the client.", examples=[100])
    offset: int = Field(..., description="Zero-based row offset used for pagination.", examples=[0])
    total: int = Field(..., description="Total number of timeline assets currently available.", examples=[12453])
    has_more: bool = Field(..., description="Whether more assets exist beyond the current page.", examples=[True])


class IngestionStartResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "job_id": "09722d7e-4662-4355-8fa2-4ae84de45dae",
                "task_id": "0e86606f-d10f-4c9d-9cb8-7eab0ba629ff",
                "status": "queued",
                "message": "Background ingestion started",
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
                "raw_metadata": {"uploaded_filename": "snapchat-export.zip"},
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
