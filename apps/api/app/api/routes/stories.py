from __future__ import annotations

from apps.api.app.api.schemas import StoryCollectionsResponse
from snapcapsule_core.config import get_settings
from snapcapsule_core.db import SessionLocal
from snapcapsule_core.services.story_queries import build_story_activity_summary, list_story_collections

from fastapi import APIRouter

router = APIRouter(prefix="/api")


@router.get(
    "/stories",
    response_model=StoryCollectionsResponse,
    tags=["Stories"],
    summary="List imported Snapchat story collections",
)
def get_stories() -> StoryCollectionsResponse:
    settings = get_settings()
    with SessionLocal() as session:
        collections = list_story_collections(session)
        activity = build_story_activity_summary(session, settings)

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
        activity={
            "spotlight_history_count": activity.spotlight_history_count,
            "shared_story_count": activity.shared_story_count,
            "latest_story_date": activity.latest_story_date,
            "spotlight_history": [
                {
                    "story_date": item.story_date,
                    "story_url": item.story_url,
                    "action_type": item.action_type,
                    "view_duration_seconds": item.view_duration_seconds,
                }
                for item in activity.spotlight_history
            ],
            "shared_story_activity": [
                {
                    "story_date": item.story_date,
                    "story_url": item.story_url,
                    "action_type": item.action_type,
                    "view_duration_seconds": item.view_duration_seconds,
                }
                for item in activity.shared_story_activity
            ],
        },
    )
