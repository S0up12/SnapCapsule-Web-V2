from __future__ import annotations

import uuid
from datetime import UTC, datetime

from snapcapsule_core.models import Asset, ChatMessage, ChatThread
from snapcapsule_core.models.enums import AssetSource, ChatMessageSource, MediaType
from snapcapsule_core.services.chat_queries import ChatFilters, list_chat_threads, list_grouped_chat_messages


def _create_asset(
    session,
    *,
    media_type: MediaType,
    taken_at: datetime | None = None,
    is_favorite: bool = False,
    tags: list[str] | None = None,
    has_overlay: bool = False,
) -> Asset:
    extension = {
        MediaType.IMAGE: "jpg",
        MediaType.VIDEO: "mp4",
        MediaType.AUDIO: "m4a",
    }[media_type]
    asset = Asset(
        source_type=AssetSource.CHAT,
        media_type=media_type,
        original_path=f"/tmp/{uuid.uuid4()}.{extension}",
        thumbnail_path=f"/tmp/{uuid.uuid4()}.jpg" if media_type != MediaType.AUDIO else None,
        overlay_path=f"/tmp/{uuid.uuid4()}_overlay.png" if has_overlay else None,
        taken_at=taken_at,
        is_favorite=is_favorite,
        tags=list(tags or ()),
    )
    session.add(asset)
    session.flush()
    return asset


def _create_thread(session, *, external_id: str, title: str | None = None, is_group: bool = False) -> ChatThread:
    thread = ChatThread(
        external_id=external_id,
        title=title,
        is_group=is_group,
    )
    session.add(thread)
    session.flush()
    return thread


def _create_message(
    session,
    *,
    thread: ChatThread,
    sender: str,
    sent_at: datetime,
    body: str | None = None,
    assets: list[Asset] | None = None,
) -> ChatMessage:
    message = ChatMessage(
        thread_id=thread.id,
        sender=sender,
        body=body,
        sent_at=sent_at,
        message_type="TEXT" if body else "MEDIA",
        source=ChatMessageSource.CHAT_HISTORY,
        dedupe_key=str(uuid.uuid4()),
    )
    session.add(message)
    session.flush()
    if assets:
        message.assets.extend(assets)
        session.flush()
    return message


def test_list_chat_threads_applies_search_sort_filter_and_preview(db_session):
    private_thread = _create_thread(db_session, external_id="ties", title="Ties")
    group_thread = _create_thread(db_session, external_id="group-1", title="Weekend Crew", is_group=True)
    no_media_thread = _create_thread(db_session, external_id="alex", title="Alex")

    photo_asset = _create_asset(db_session, media_type=MediaType.IMAGE)

    _create_message(
        db_session,
        thread=private_thread,
        sender="sammykastanja",
        sent_at=datetime(2026, 3, 20, 10, 45, tzinfo=UTC),
        assets=[photo_asset],
    )
    _create_message(
        db_session,
        thread=group_thread,
        sender="Teuntje",
        sent_at=datetime(2026, 3, 20, 11, 30, tzinfo=UTC),
        body="Meet at eight",
    )
    _create_message(
        db_session,
        thread=no_media_thread,
        sender="Alex",
        sent_at=datetime(2026, 3, 19, 9, 15, tzinfo=UTC),
        body="Plain text only",
    )

    newest_records = list_chat_threads(db_session, ChatFilters())
    assert [record.display_name for record in newest_records] == ["Weekend Crew", "Ties", "Alex"]
    assert newest_records[0].latest_preview == "Meet at eight"
    assert newest_records[1].latest_preview == "You: Media attachment"
    assert newest_records[1].has_media is True
    assert newest_records[1].is_group is False

    oldest_records = list_chat_threads(db_session, ChatFilters(sort="oldest"))
    assert [record.display_name for record in oldest_records] == ["Alex", "Ties", "Weekend Crew"]

    media_only_records = list_chat_threads(db_session, ChatFilters(filter_name="has_media"))
    assert [record.display_name for record in media_only_records] == ["Ties"]

    searched_records = list_chat_threads(db_session, ChatFilters(search="weekend"))
    assert [record.display_name for record in searched_records] == ["Weekend Crew"]


def test_list_grouped_chat_messages_merges_same_minute_and_sorts_media_assets(db_session):
    thread = _create_thread(db_session, external_id="ties", title="Ties")
    image_asset = _create_asset(
        db_session,
        media_type=MediaType.IMAGE,
        taken_at=datetime(2026, 3, 20, 10, 0, 5, tzinfo=UTC),
        tags=["trip"],
        has_overlay=True,
    )
    video_asset = _create_asset(
        db_session,
        media_type=MediaType.VIDEO,
        taken_at=datetime(2026, 3, 20, 10, 0, 10, tzinfo=UTC),
    )
    audio_asset = _create_asset(
        db_session,
        media_type=MediaType.AUDIO,
        taken_at=datetime(2026, 3, 20, 10, 0, 15, tzinfo=UTC),
    )

    _create_message(
        db_session,
        thread=thread,
        sender="sammykastanja",
        sent_at=datetime(2026, 3, 20, 10, 0, 10, tzinfo=UTC),
        body="First line",
        assets=[video_asset],
    )
    _create_message(
        db_session,
        thread=thread,
        sender="sammykastanja",
        sent_at=datetime(2026, 3, 20, 10, 0, 40, tzinfo=UTC),
        body="Second line",
        assets=[image_asset, audio_asset],
    )
    _create_message(
        db_session,
        thread=thread,
        sender="ties",
        sent_at=datetime(2026, 3, 20, 10, 2, 0, tzinfo=UTC),
        body="Reply",
    )

    grouped, total = list_grouped_chat_messages(db_session, chat_id=thread.id, limit=50, offset=0)

    assert total == 2
    assert len(grouped) == 2

    first_group = grouped[0]
    assert first_group.sender_label == "ME"
    assert first_group.is_me is True
    assert first_group.text == "First line\nSecond line"
    assert [asset.id for asset in first_group.media_assets] == [video_asset.id, image_asset.id, audio_asset.id]
    assert first_group.media_assets[1].has_overlay is True
    assert first_group.media_assets[1].tags == ("trip",)
    assert first_group.media_assets[2].media_type == MediaType.AUDIO

    second_group = grouped[1]
    assert second_group.sender_label == "ties"
    assert second_group.is_me is False
    assert second_group.text == "Reply"


def test_list_grouped_chat_messages_respects_offset_and_limit(db_session):
    thread = _create_thread(db_session, external_id="group-1", title="Weekend Crew", is_group=True)

    _create_message(
        db_session,
        thread=thread,
        sender="Teuntje",
        sent_at=datetime(2026, 3, 20, 10, 0, tzinfo=UTC),
        body="One",
    )
    _create_message(
        db_session,
        thread=thread,
        sender="Siem",
        sent_at=datetime(2026, 3, 20, 10, 2, tzinfo=UTC),
        body="Two",
    )
    _create_message(
        db_session,
        thread=thread,
        sender="Teuntje",
        sent_at=datetime(2026, 3, 20, 10, 4, tzinfo=UTC),
        body="Three",
    )

    grouped, total = list_grouped_chat_messages(db_session, chat_id=thread.id, limit=1, offset=1)

    assert total == 3
    assert len(grouped) == 1
    assert grouped[0].text == "Two"
    assert grouped[0].sender_label == "Siem"
