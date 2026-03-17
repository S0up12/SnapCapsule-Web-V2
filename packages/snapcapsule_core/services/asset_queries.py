from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import Select, case, desc, func, select
from sqlalchemy.orm import Session

from snapcapsule_core.models import Asset
from snapcapsule_core.models.enums import MediaType


@dataclass(frozen=True, slots=True)
class TimelineAssetRecord:
    id: uuid.UUID
    taken_at: datetime | None
    media_type: MediaType


@dataclass(frozen=True, slots=True)
class AssetFileRecord:
    id: uuid.UUID
    media_type: MediaType
    original_path: str
    thumbnail_path: str | None


@dataclass(frozen=True, slots=True)
class DashboardStatsRecord:
    total_assets: int
    total_photos: int
    total_videos: int


def build_timeline_query(*, limit: int, offset: int) -> Select[tuple[uuid.UUID, datetime | None, MediaType]]:
    return (
        select(Asset.id, Asset.taken_at, Asset.media_type)
        .where(
            Asset.media_type.in_((MediaType.IMAGE, MediaType.VIDEO)),
            Asset.thumbnail_path.is_not(None),
            Asset.original_path.is_not(None),
        )
        .order_by(
            desc(func.coalesce(Asset.taken_at, Asset.created_at)),
            desc(Asset.id),
        )
        .limit(limit)
        .offset(offset)
    )


def list_timeline_assets(session: Session, *, limit: int, offset: int) -> list[TimelineAssetRecord]:
    rows = session.execute(build_timeline_query(limit=limit, offset=offset)).all()
    return [
        TimelineAssetRecord(
            id=asset_id,
            taken_at=taken_at,
            media_type=media_type,
        )
        for asset_id, taken_at, media_type in rows
    ]


def count_timeline_assets(session: Session) -> int:
    return session.scalar(
        select(func.count())
        .select_from(Asset)
        .where(
            Asset.media_type.in_((MediaType.IMAGE, MediaType.VIDEO)),
            Asset.thumbnail_path.is_not(None),
            Asset.original_path.is_not(None),
        )
    ) or 0


def get_asset_file_record(session: Session, asset_id: uuid.UUID) -> AssetFileRecord | None:
    row = session.execute(
        select(Asset.id, Asset.media_type, Asset.original_path, Asset.thumbnail_path).where(Asset.id == asset_id)
    ).one_or_none()
    if row is None:
        return None

    return AssetFileRecord(
        id=row[0],
        media_type=row[1],
        original_path=row[2],
        thumbnail_path=row[3],
    )


def get_dashboard_stats(session: Session) -> DashboardStatsRecord:
    row = session.execute(
        select(
            func.count().label("total_assets"),
            func.sum(case((Asset.media_type == MediaType.IMAGE, 1), else_=0)).label("total_photos"),
            func.sum(case((Asset.media_type == MediaType.VIDEO, 1), else_=0)).label("total_videos"),
        ).where(
            Asset.media_type.in_((MediaType.IMAGE, MediaType.VIDEO)),
            Asset.thumbnail_path.is_not(None),
            Asset.original_path.is_not(None),
        )
    ).one()

    return DashboardStatsRecord(
        total_assets=int(row.total_assets or 0),
        total_photos=int(row.total_photos or 0),
        total_videos=int(row.total_videos or 0),
    )
