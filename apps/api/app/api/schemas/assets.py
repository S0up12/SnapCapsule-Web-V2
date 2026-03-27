from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field
from snapcapsule_core.models.enums import MediaType


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


class TagDeleteResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "tag": "vacation",
                "affected_assets": 12,
            }
        }
    )

    tag: str = Field(..., description="Deleted tag label.")
    affected_assets: int = Field(..., description="Number of assets that had the deleted tag removed.")


class AssetTagsUpdateRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "tags": ["vacation", "beach"],
            }
        }
    )

    tags: list[str] = Field(..., description="Complete replacement tag list for the target asset.")
