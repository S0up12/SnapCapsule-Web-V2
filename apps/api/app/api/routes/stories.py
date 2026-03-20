from __future__ import annotations

from apps.api.app.api.schemas import StoryCollectionsResponse
from snapcapsule_core.db import SessionLocal
from snapcapsule_core.services.story_queries import list_story_collections

from fastapi import APIRouter

router = APIRouter(prefix="/api")


@router.get(
    "/stories",
    response_model=StoryCollectionsResponse,
    tags=["Stories"],
    summary="List imported Snapchat story collections",
)
def get_stories() -> StoryCollectionsResponse:
    with SessionLocal() as session:
        collections = list_story_collections(session)

    return StoryCollectionsResponse(
        items=[
            {
                "id": collection.id,
                "title": collection.title,
                "story_type": collection.story_type.value,
                "total_items": collection.total_items,
                "earliest_posted_at": collection.earliest_posted_at,
                "latest_posted_at": collection.latest_posted_at,
                "items": [
                    {
                        "id": item.id,
                        "taken_at": item.taken_at,
                        "media_type": item.media_type.value,
                        "is_favorite": item.is_favorite,
                        "tags": list(item.tags),
                        "has_overlay": item.has_overlay,
                    }
                    for item in collection.items
                ],
            }
            for collection in collections
        ],
        total_collections=len(collections),
        total_story_items=sum(collection.total_items for collection in collections),
    )
