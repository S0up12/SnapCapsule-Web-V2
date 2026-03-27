from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from snapcapsule_core.models import Asset, StoryCollection, StoryItem
from snapcapsule_core.models.enums import MediaType, StoryType
from snapcapsule_core.services.ingestion import IngestionService
from snapcapsule_core.services.profile_queries import discover_latest_export_roots

DURATION_SECONDS_PATTERN = re.compile(r"(?P<seconds>\d+(?:\.\d+)?)")


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


@dataclass(frozen=True, slots=True)
class StoryActivityRecord:
    story_date: datetime | None
    story_url: str | None
    action_type: str | None
    view_duration_seconds: float | None


@dataclass(frozen=True, slots=True)
class StoriesActivitySummaryRecord:
    spotlight_history_count: int
    shared_story_count: int
    latest_story_date: datetime | None
    spotlight_history: tuple[StoryActivityRecord, ...]
    shared_story_activity: tuple[StoryActivityRecord, ...]


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


def build_story_activity_summary(session: Session, settings) -> StoriesActivitySummaryRecord:
    roots = discover_latest_export_roots(session, settings)
    if not roots:
        return StoriesActivitySummaryRecord(
            spotlight_history_count=0,
            shared_story_count=0,
            latest_story_date=None,
            spotlight_history=(),
            shared_story_activity=(),
        )

    service = IngestionService(settings)
    payload = service.load_merged_json_payload(roots, "shared_story.json", service.merge_generic_json_payload)
    if not isinstance(payload, dict):
        return StoriesActivitySummaryRecord(
            spotlight_history_count=0,
            shared_story_count=0,
            latest_story_date=None,
            spotlight_history=(),
            shared_story_activity=(),
        )

    spotlight_history = _normalize_story_activity_rows(payload.get("Spotlight History"))
    shared_story_activity = _normalize_story_activity_rows(payload.get("Shared Story"))
    latest_story_date = max(
        (entry.story_date for entry in (*spotlight_history, *shared_story_activity) if entry.story_date is not None),
        default=None,
    )

    return StoriesActivitySummaryRecord(
        spotlight_history_count=len(spotlight_history),
        shared_story_count=len(shared_story_activity),
        latest_story_date=latest_story_date,
        spotlight_history=tuple(spotlight_history[:20]),
        shared_story_activity=tuple(shared_story_activity[:20]),
    )


def _normalize_story_activity_rows(value) -> list[StoryActivityRecord]:
    rows = [row for row in (value or []) if isinstance(row, dict)]
    normalized = [
        StoryActivityRecord(
            story_date=IngestionService.parse_datetime(row.get("Story Date")),
            story_url=_clean_string(row.get("Story URL")),
            action_type=_clean_string(row.get("Action Type")),
            view_duration_seconds=_parse_view_duration_seconds(row.get("View Time")),
        )
        for row in rows
    ]
    return sorted(
        normalized,
        key=lambda row: row.story_date or datetime.min.replace(tzinfo=UTC),
        reverse=True,
    )


def _parse_view_duration_seconds(value) -> float | None:
    if value is None:
        return None
    match = DURATION_SECONDS_PATTERN.search(str(value))
    if not match:
        return None
    try:
        return float(match.group("seconds"))
    except (TypeError, ValueError):
        return None


def _clean_string(value) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None
