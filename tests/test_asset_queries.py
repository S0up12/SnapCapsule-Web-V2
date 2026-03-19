from __future__ import annotations

from datetime import UTC, date, datetime

from sqlalchemy import select

from snapcapsule_core.models import MemoryItem
from snapcapsule_core.models.enums import AssetSource, MediaType
from snapcapsule_core.services.asset_queries import (
    TimelineFilters,
    delete_asset_tag,
    get_timeline_summary,
    list_available_tags,
    list_timeline_assets,
    update_asset_tags,
)


def test_list_timeline_assets_prefers_memory_item_chronology_over_asset_fallback(db_session, make_asset):
    newer_asset = make_asset(
        taken_at=datetime(2024, 6, 15, 9, 0, tzinfo=UTC),
        tags=["Trip"],
    )
    older_asset = make_asset(
        taken_at=datetime(2024, 6, 15, 8, 0, tzinfo=UTC),
        tags=["Trip"],
    )

    memory_items = {
        item.asset_id: item
        for item in db_session.execute(select(MemoryItem)).scalars()
    }
    memory_items[newer_asset.id].taken_at = datetime(2024, 6, 15, 10, 30, tzinfo=UTC)
    memory_items[newer_asset.id].position = 5
    memory_items[older_asset.id].taken_at = datetime(2024, 6, 15, 10, 30, tzinfo=UTC)
    memory_items[older_asset.id].position = 6
    db_session.flush()

    items = list_timeline_assets(db_session, limit=20, offset=0, filters=TimelineFilters(sort_direction="desc"))

    assert [item.id for item in items] == [newer_asset.id, older_asset.id]
    assert [item.taken_at for item in items] == [
        datetime(2024, 6, 15, 10, 30, tzinfo=UTC),
        datetime(2024, 6, 15, 10, 30, tzinfo=UTC),
    ]


def test_list_timeline_assets_applies_combined_filters(db_session, make_asset):
    matching = make_asset(
        media_type=MediaType.IMAGE,
        taken_at=datetime(2024, 12, 31, 23, 30, tzinfo=UTC),
        is_favorite=True,
        tags=["Summer", "Beach"],
    )
    make_asset(
        media_type=MediaType.IMAGE,
        taken_at=datetime(2024, 12, 31, 15, 0, tzinfo=UTC),
        is_favorite=True,
        tags=["Beach"],
    )
    make_asset(
        media_type=MediaType.VIDEO,
        taken_at=datetime(2024, 12, 31, 12, 0, tzinfo=UTC),
        is_favorite=True,
        tags=["Summer"],
    )
    make_asset(
        media_type=MediaType.IMAGE,
        taken_at=datetime(2024, 12, 31, 11, 0, tzinfo=UTC),
        is_favorite=False,
        tags=["Summer"],
    )
    make_asset(
        media_type=MediaType.IMAGE,
        taken_at=datetime(2025, 1, 1, 0, 0, tzinfo=UTC),
        is_favorite=True,
        tags=["Summer"],
    )
    make_asset(
        source_type=AssetSource.CHAT,
        media_type=MediaType.IMAGE,
        taken_at=datetime(2024, 12, 31, 9, 0, tzinfo=UTC),
        is_favorite=True,
        tags=["Summer"],
    )
    make_asset(
        media_type=MediaType.IMAGE,
        taken_at=datetime(2024, 12, 31, 8, 0, tzinfo=UTC),
        is_favorite=True,
        tags=["Summer"],
        include_thumbnail=False,
    )

    filters = TimelineFilters(
        sort_direction="desc",
        media_type=MediaType.IMAGE,
        favorite_only=True,
        tags=("Summer",),
        date_from=date(2024, 12, 31),
        date_to=date(2024, 12, 31),
    )

    items = list_timeline_assets(db_session, limit=20, offset=0, filters=filters)
    summary = get_timeline_summary(db_session, filters)

    assert [item.id for item in items] == [matching.id]
    assert summary.total_assets == 1
    assert summary.total_photos == 1
    assert summary.total_videos == 0


def test_update_asset_tags_normalizes_and_deduplicates_case_insensitively(db_session, make_asset):
    asset = make_asset(tags=["old"])

    updated = update_asset_tags(db_session, asset.id, [" beach ", "Beach", "", "trip", "beach", "Trip "])

    assert updated is not None
    assert list(updated.tags) == ["beach", "trip"]
    assert asset.tags == ["beach", "trip"]


def test_list_available_tags_returns_distinct_memory_tags(db_session, make_asset):
    make_asset(tags=["Vacation", "beach"])
    make_asset(media_type=MediaType.VIDEO, tags=["vacation", "friends"])
    make_asset(source_type=AssetSource.CHAT, tags=["ignored-chat-tag"])
    make_asset(media_type=MediaType.AUDIO, tags=["ignored-audio-tag"])

    tags = list_available_tags(db_session)

    assert tags == ["beach", "friends", "Vacation"]


def test_delete_asset_tag_removes_tag_from_all_memory_media_assets(db_session, make_asset):
    memory_image = make_asset(tags=["Trip", "Beach"])
    memory_video = make_asset(media_type=MediaType.VIDEO, tags=["trip"])
    chat_image = make_asset(source_type=AssetSource.CHAT, tags=["Trip"])
    memory_audio = make_asset(media_type=MediaType.AUDIO, tags=["Trip"])

    result = delete_asset_tag(db_session, "TRIP")

    assert result.tag == "TRIP"
    assert result.affected_assets == 2
    assert memory_image.tags == ["Beach"]
    assert memory_video.tags == []
    assert chat_image.tags == ["Trip"]
    assert memory_audio.tags == ["Trip"]
