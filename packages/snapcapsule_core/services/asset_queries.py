from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import Select, case, cast, desc, func, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session

from snapcapsule_core.models import Asset, MemoryItem
from snapcapsule_core.models.enums import AssetSource, MediaType


@dataclass(frozen=True, slots=True)
class TimelineFilters:
    sort_direction: str = "desc"
    media_type: MediaType | None = None
    favorite_only: bool = False
    tags: tuple[str, ...] = ()
    date_from: date | None = None
    date_to: date | None = None


@dataclass(frozen=True, slots=True)
class TimelineAssetRecord:
    id: uuid.UUID
    taken_at: datetime | None
    media_type: MediaType
    is_favorite: bool
    tags: tuple[str, ...]
    has_overlay: bool


@dataclass(frozen=True, slots=True)
class AssetFileRecord:
    id: uuid.UUID
    media_type: MediaType
    original_path: str
    thumbnail_path: str | None
    overlay_path: str | None
    is_favorite: bool
    tags: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class DashboardStatsRecord:
    total_assets: int
    total_photos: int
    total_videos: int


@dataclass(frozen=True, slots=True)
class TimelineSummaryRecord:
    total_assets: int
    total_photos: int
    total_videos: int


@dataclass(frozen=True, slots=True)
class AssetMutationRecord:
    id: uuid.UUID
    is_favorite: bool
    tags: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class TagDeleteRecord:
    tag: str
    affected_assets: int


def _normalize_tags(tags: list[str] | tuple[str, ...]) -> list[str]:
    normalized: dict[str, str] = {}
    for raw_tag in tags:
        value = str(raw_tag).strip()
        if not value:
            continue
        normalized.setdefault(value.lower(), value)

    return sorted(normalized.values(), key=str.lower)


def _memory_timeline_subquery():
    return (
        select(
            MemoryItem.asset_id.label("asset_id"),
            func.min(MemoryItem.taken_at).label("taken_at"),
            func.min(MemoryItem.position).label("position"),
        )
        .group_by(MemoryItem.asset_id)
        .subquery()
    )


def _base_asset_filters(filters: TimelineFilters, timeline_taken_at):
    clauses = [
        Asset.source_type == AssetSource.MEMORY,
        Asset.media_type.in_((MediaType.IMAGE, MediaType.VIDEO)),
        Asset.thumbnail_path.is_not(None),
        Asset.original_path.is_not(None),
    ]

    if filters.media_type is not None:
        clauses.append(Asset.media_type == filters.media_type)
    if filters.favorite_only:
        clauses.append(Asset.is_favorite.is_(True))
    for tag in filters.tags:
        clauses.append(cast(Asset.tags, JSONB).contains([tag]))
    if filters.date_from is not None:
        clauses.append(timeline_taken_at >= datetime.combine(filters.date_from, time.min, tzinfo=timezone.utc))
    if filters.date_to is not None:
        clauses.append(timeline_taken_at < datetime.combine(filters.date_to + timedelta(days=1), time.min, tzinfo=timezone.utc))

    return clauses


def build_timeline_query(*, limit: int, offset: int, filters: TimelineFilters) -> Select:
    memory_timeline = _memory_timeline_subquery()
    timeline_taken_at = func.coalesce(memory_timeline.c.taken_at, Asset.taken_at, Asset.created_at)
    memory_position = memory_timeline.c.position
    order_by = (
        timeline_taken_at.asc(),
        memory_position.desc().nulls_last(),
        Asset.id.asc(),
    ) if filters.sort_direction == "asc" else (
        desc(timeline_taken_at),
        memory_position.asc().nulls_last(),
        desc(Asset.id),
    )

    return (
        select(Asset.id, timeline_taken_at, Asset.media_type, Asset.is_favorite, Asset.tags, Asset.overlay_path)
        .select_from(Asset)
        .outerjoin(memory_timeline, memory_timeline.c.asset_id == Asset.id)
        .where(*_base_asset_filters(filters, timeline_taken_at))
        .order_by(*order_by)
        .limit(limit)
        .offset(offset)
    )


def list_timeline_assets(session: Session, *, limit: int, offset: int, filters: TimelineFilters) -> list[TimelineAssetRecord]:
    rows = session.execute(build_timeline_query(limit=limit, offset=offset, filters=filters)).all()
    return [
        TimelineAssetRecord(
            id=asset_id,
            taken_at=taken_at,
            media_type=media_type,
            is_favorite=is_favorite,
            tags=tuple(tags or ()),
            has_overlay=bool(overlay_path),
        )
        for asset_id, taken_at, media_type, is_favorite, tags, overlay_path in rows
    ]


def get_timeline_summary(session: Session, filters: TimelineFilters) -> TimelineSummaryRecord:
    memory_timeline = _memory_timeline_subquery()
    timeline_taken_at = func.coalesce(memory_timeline.c.taken_at, Asset.taken_at, Asset.created_at)
    row = session.execute(
        select(
            func.count().label("total_assets"),
            func.sum(case((Asset.media_type == MediaType.IMAGE, 1), else_=0)).label("total_photos"),
            func.sum(case((Asset.media_type == MediaType.VIDEO, 1), else_=0)).label("total_videos"),
        )
        .select_from(Asset)
        .outerjoin(memory_timeline, memory_timeline.c.asset_id == Asset.id)
        .where(*_base_asset_filters(filters, timeline_taken_at))
    ).one()

    return TimelineSummaryRecord(
        total_assets=int(row.total_assets or 0),
        total_photos=int(row.total_photos or 0),
        total_videos=int(row.total_videos or 0),
    )


def list_available_tags(session: Session) -> list[str]:
    rows = session.execute(
        select(Asset.tags).where(
            Asset.source_type == AssetSource.MEMORY,
            Asset.media_type.in_((MediaType.IMAGE, MediaType.VIDEO)),
            Asset.tags.is_not(None),
        )
    ).scalars()

    tag_map: dict[str, str] = {}
    for tags in rows:
        for tag in tags or []:
            normalized = str(tag).strip()
            if normalized:
                tag_map.setdefault(normalized.lower(), normalized)

    return sorted(tag_map.values(), key=str.lower)


def get_asset_file_record(session: Session, asset_id: uuid.UUID) -> AssetFileRecord | None:
    row = session.execute(
        select(
            Asset.id,
            Asset.media_type,
            Asset.original_path,
            Asset.thumbnail_path,
            Asset.overlay_path,
            Asset.is_favorite,
            Asset.tags,
        ).where(Asset.id == asset_id)
    ).one_or_none()
    if row is None:
        return None

    return AssetFileRecord(
        id=row[0],
        media_type=row[1],
        original_path=row[2],
        thumbnail_path=row[3],
        overlay_path=row[4],
        is_favorite=bool(row[5]),
        tags=tuple(row[6] or ()),
    )


def toggle_asset_favorite(session: Session, asset_id: uuid.UUID) -> AssetMutationRecord | None:
    asset = session.get(Asset, asset_id)
    if asset is None:
        return None

    asset.is_favorite = not asset.is_favorite
    session.flush()
    return AssetMutationRecord(
        id=asset.id,
        is_favorite=asset.is_favorite,
        tags=tuple(asset.tags or ()),
    )


def update_asset_tags(session: Session, asset_id: uuid.UUID, tags: list[str]) -> AssetMutationRecord | None:
    asset = session.get(Asset, asset_id)
    if asset is None:
        return None

    asset.tags = _normalize_tags(tags)
    session.flush()
    return AssetMutationRecord(
        id=asset.id,
        is_favorite=asset.is_favorite,
        tags=tuple(asset.tags or ()),
    )


def delete_asset_tag(session: Session, tag: str) -> TagDeleteRecord:
    normalized_target = tag.strip()
    normalized_key = normalized_target.lower()
    if not normalized_target:
        return TagDeleteRecord(tag="", affected_assets=0)

    assets = session.execute(
        select(Asset).where(
            Asset.source_type == AssetSource.MEMORY,
            Asset.media_type.in_((MediaType.IMAGE, MediaType.VIDEO)),
            Asset.tags.is_not(None),
        )
    ).scalars()

    affected_assets = 0
    for asset in assets:
        current_tags = list(asset.tags or ())
        next_tags = [value for value in current_tags if str(value).strip().lower() != normalized_key]
        if len(next_tags) == len(current_tags):
            continue

        asset.tags = next_tags
        affected_assets += 1

    session.flush()
    return TagDeleteRecord(tag=normalized_target, affected_assets=affected_assets)


def get_dashboard_stats(session: Session) -> DashboardStatsRecord:
    summary = get_timeline_summary(session, TimelineFilters())
    return DashboardStatsRecord(
        total_assets=summary.total_assets,
        total_photos=summary.total_photos,
        total_videos=summary.total_videos,
    )
