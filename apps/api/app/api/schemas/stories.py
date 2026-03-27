from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field
from snapcapsule_core.models.enums import MediaType


class StoryAssetSummary(BaseModel):
    id: UUID = Field(..., description="Asset identifier for story thumbnails and lightbox rendering.")
    taken_at: datetime | None = Field(default=None, description="Story capture or posted timestamp used for ordering.")
    media_type: MediaType = Field(..., description="Media type for story preview rendering.")
    is_favorite: bool = Field(..., description="Whether this story asset is favorited.")
    tags: list[str] = Field(..., description="User-defined text tags attached to the story asset.")
    has_overlay: bool = Field(..., description="Whether the story asset has a separate Snapchat overlay image.")


class StoryCollectionSummary(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "a3db6185-2be6-4107-89e3-2d78e2378cc2",
                "title": "My Story",
                "story_type": "private",
                "total_items": 3,
                "earliest_posted_at": "2024-01-03T09:00:00+00:00",
                "latest_posted_at": "2024-01-03T12:00:00+00:00",
                "items": [
                    {
                        "id": "eba274cb-6509-40f6-9a9f-df634f0f2894",
                        "taken_at": "2024-01-03T12:00:00+00:00",
                        "media_type": "image",
                        "is_favorite": False,
                        "tags": [],
                        "has_overlay": False,
                    }
                ],
            }
        }
    )

    id: UUID = Field(..., description="Stable story collection identifier.")
    title: str = Field(..., description="Best available story title from the imported export.")
    story_type: str = Field(..., description="Story category derived from the Snapchat export.")
    total_items: int = Field(..., description="Number of media items attached to the story collection.")
    earliest_posted_at: datetime | None = Field(default=None, description="Oldest story item timestamp in the collection.")
    latest_posted_at: datetime | None = Field(default=None, description="Newest story item timestamp in the collection.")
    items: list[StoryAssetSummary] = Field(..., description="Story media items ordered newest first inside the collection.")


class StoryActivityEntry(BaseModel):
    story_date: datetime | None = Field(default=None, description="Story activity timestamp exported by Snapchat.")
    story_url: str | None = Field(default=None, description="Story or Spotlight URL when present in the export.")
    action_type: str | None = Field(default=None, description="Action type such as VIEW.")
    view_duration_seconds: float | None = Field(default=None, description="Normalized view duration in seconds if exported.")


class StoriesActivitySummary(BaseModel):
    spotlight_history_count: int = Field(default=0, description="Total Spotlight history rows in the latest export.")
    shared_story_count: int = Field(default=0, description="Total shared story rows in the latest export.")
    latest_story_date: datetime | None = Field(default=None, description="Most recent activity timestamp across shared story and Spotlight rows.")
    spotlight_history: list[StoryActivityEntry] = Field(default_factory=list, description="Recent Spotlight history rows.")
    shared_story_activity: list[StoryActivityEntry] = Field(default_factory=list, description="Recent shared story rows.")


class StoryCollectionsResponse(BaseModel):
    items: list[StoryCollectionSummary] = Field(..., description="Imported story collections with nested story media items.")
    total_collections: int = Field(..., description="Number of story collections returned by the archive.")
    total_story_items: int = Field(..., description="Total number of story items across all returned collections.")
    activity: StoriesActivitySummary = Field(
        default_factory=StoriesActivitySummary,
        description="Metadata-only shared story and Spotlight activity from the latest ingested export.",
    )
