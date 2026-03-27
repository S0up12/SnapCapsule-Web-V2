from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field
from snapcapsule_core.models.enums import MediaType


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
