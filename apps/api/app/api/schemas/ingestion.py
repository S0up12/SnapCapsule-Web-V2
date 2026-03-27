from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field
from snapcapsule_core.models.enums import IngestionJobStatus, IngestionSourceKind


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


class IngestionJobsListResponse(BaseModel):
    items: list[IngestionJobResponse] = Field(..., description="Recent ingestion jobs ordered newest first.")
    total: int = Field(..., description="Number of jobs returned in this response.")


class IngestionFailedItemResponse(BaseModel):
    asset_id: UUID = Field(..., description="Asset identifier for the failed media item.")
    filename: str = Field(..., description="Filename for the failed source media.")
    media_type: str = Field(..., description="Media type associated with the failed item.")
    processing_state: str | None = Field(default=None, description="Last known processing state for the failed item.")
    error_message: str | None = Field(default=None, description="Failure message recorded for the item.")
    source_path: str | None = Field(default=None, description="Original source path recorded during ingestion.")
    available_path: str | None = Field(default=None, description="Resolved readable path available for troubleshooting.")


class IngestionFailedItemsResponse(BaseModel):
    items: list[IngestionFailedItemResponse] = Field(..., description="Failed items recorded for the ingestion job.")
    total: int = Field(..., description="Number of failed items available for the ingestion job.")
