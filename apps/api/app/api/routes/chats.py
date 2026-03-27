from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query, status
from snapcapsule_core.db import SessionLocal
from snapcapsule_core.services.chat_queries import (
    ChatFilters,
    get_chat_thread,
    list_chat_threads,
    list_grouped_chat_messages,
)

from apps.api.app.api.schemas import ChatListResponse, ChatMessagesResponse, ErrorResponse

router = APIRouter(prefix="/api")


@router.get(
    "/chats",
    response_model=ChatListResponse,
    tags=["Chats"],
    summary="List conversations",
)
def get_chats(
    search: str = Query("", max_length=200),
    sort: str = Query("newest", pattern="^(newest|oldest)$"),
    filter: str = Query("all", pattern="^(all|has_media)$"),
) -> ChatListResponse:
    """Return conversations filtered by name and optionally narrowed to threads containing linked media."""
    filters = ChatFilters(search=search, sort=sort, filter_name=filter)
    with SessionLocal() as session:
        items = list_chat_threads(session, filters)

    return ChatListResponse(
        items=[
            {
                "id": item.id,
                "display_name": item.display_name,
                "latest_at": item.latest_at,
                "latest_preview": item.latest_preview,
                "has_media": item.has_media,
                "is_group": item.is_group,
            }
            for item in items
        ],
        total=len(items),
    )


@router.get(
    "/chats/{chat_id}/messages",
    response_model=ChatMessagesResponse,
    tags=["Chats"],
    summary="List grouped chat messages",
    responses={404: {"model": ErrorResponse, "description": "Chat thread not found."}},
)
def get_chat_messages(
    chat_id: uuid.UUID,
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> ChatMessagesResponse:
    """Return chronological grouped chat bubbles, merging same-sender messages within the same minute like the desktop app."""
    with SessionLocal() as session:
        if get_chat_thread(session, chat_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat thread not found.")
        items, total = list_grouped_chat_messages(session, chat_id=chat_id, limit=limit, offset=offset)

    return ChatMessagesResponse(
        items=[
            {
                "id": item.id,
                "sender": item.sender,
                "sender_label": item.sender_label,
                "is_me": item.is_me,
                "text": item.text,
                "sent_at": item.sent_at,
                "media_assets": [
                    {
                        "id": asset.id,
                        "taken_at": asset.taken_at,
                        "media_type": asset.media_type,
                        "is_favorite": asset.is_favorite,
                        "tags": list(asset.tags),
                        "has_overlay": asset.has_overlay,
                    }
                    for asset in item.media_assets
                ],
            }
            for item in items
        ],
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(items) < total,
    )
