from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from snapcapsule_core.models import Asset, StoryCollection, StoryItem
from snapcapsule_core.models.enums import MediaType, StoryType


@dataclass(frozen=True, slots=True)
class StoryAssetRecord:
    id: uuid.UUID
    taken_at: datetime | None
    media_type: MediaType
    is_favorite: bool
    tags: tuple[str, ...]
    has_overlay: bool


@dataclass(frozen=True, slots=True)
class StoryCollectionRecord:
    id: uuid.UUID
    title: str
    story_type: StoryType
    total_items: int
    earliest_posted_at: datetime | None
    latest_posted_at: datetime | None
    items: tuple[StoryAssetRecord, ...]


def _story_taken_at():
    return func.coalesce(StoryItem.posted_at, Asset.taken_at, Asset.created_at)


def list_story_collections(session: Session) -> list[StoryCollectionRecord]:
    story_taken_at = _story_taken_at()
    collection_summary = (
        select(
            StoryItem.collection_id.label("collection_id"),
            func.count().label("total_items"),
            func.min(story_taken_at).label("earliest_posted_at"),
            func.max(story_taken_at).label("latest_posted_at"),
        )
        .select_from(StoryItem)
        .join(Asset, Asset.id == StoryItem.asset_id)
        .where(
            Asset.media_type.in_((MediaType.IMAGE, MediaType.VIDEO)),
            Asset.thumbnail_path.is_not(None),
            Asset.original_path.is_not(None),
        )
        .group_by(StoryItem.collection_id)
        .subquery()
    )

    collections = session.execute(
        select(
            StoryCollection.id,
            StoryCollection.title,
            StoryCollection.story_type,
            collection_summary.c.total_items,
            collection_summary.c.earliest_posted_at,
            collection_summary.c.latest_posted_at,
        )
        .join(collection_summary, collection_summary.c.collection_id == StoryCollection.id)
        .order_by(
            desc(collection_summary.c.latest_posted_at),
            StoryCollection.title.asc().nulls_last(),
            StoryCollection.id.asc(),
        )
    ).all()

    if not collections:
        return []

    collection_ids = [row.id for row in collections]
    item_rows = session.execute(
        select(
            StoryItem.collection_id,
            Asset.id,
            story_taken_at.label("taken_at"),
            Asset.media_type,
            Asset.is_favorite,
            Asset.tags,
            Asset.overlay_path,
        )
        .select_from(StoryItem)
        .join(Asset, Asset.id == StoryItem.asset_id)
        .where(
            StoryItem.collection_id.in_(collection_ids),
            Asset.media_type.in_((MediaType.IMAGE, MediaType.VIDEO)),
            Asset.thumbnail_path.is_not(None),
            Asset.original_path.is_not(None),
        )
        .order_by(
            StoryItem.collection_id.asc(),
            desc(story_taken_at),
            StoryItem.position.asc().nulls_last(),
            desc(Asset.id),
        )
    ).all()

    items_by_collection: dict[uuid.UUID, list[StoryAssetRecord]] = {collection_id: [] for collection_id in collection_ids}
    for row in item_rows:
        items_by_collection[row.collection_id].append(
            StoryAssetRecord(
                id=row.id,
                taken_at=row.taken_at,
                media_type=row.media_type,
                is_favorite=bool(row.is_favorite),
                tags=tuple(row.tags or ()),
                has_overlay=bool(row.overlay_path),
            )
        )

    return [
        StoryCollectionRecord(
            id=row.id,
            title=row.title or "Stories",
            story_type=row.story_type if isinstance(row.story_type, StoryType) else StoryType.UNKNOWN,
            total_items=int(row.total_items or 0),
            earliest_posted_at=row.earliest_posted_at,
            latest_posted_at=row.latest_posted_at,
            items=tuple(items_by_collection.get(row.id, ())),
        )
        for row in collections
        if items_by_collection.get(row.id)
    ]
