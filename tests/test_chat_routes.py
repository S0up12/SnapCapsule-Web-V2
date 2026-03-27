from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import FastAPI
from fastapi.testclient import TestClient
from snapcapsule_core.models import Asset, ChatMessage, ChatThread
from snapcapsule_core.models.enums import AssetSource, ChatMessageSource, MediaType

from apps.api.app.api.routes import chats as chat_routes


def _build_chat_app(SessionLocal, monkeypatch) -> TestClient:
    monkeypatch.setattr(chat_routes, "SessionLocal", SessionLocal)

    app = FastAPI()
    app.include_router(chat_routes.router)
    return TestClient(app)


def _create_thread(session, *, external_id: str, title: str | None = None, is_group: bool = False) -> ChatThread:
    thread = ChatThread(
        external_id=external_id,
        title=title,
        is_group=is_group,
    )
    session.add(thread)
    session.flush()
    return thread


def _create_asset(session, *, media_type: MediaType, has_overlay: bool = False) -> Asset:
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
        taken_at=datetime(2026, 3, 20, 10, 0, tzinfo=UTC),
        is_favorite=media_type == MediaType.IMAGE,
        tags=["trip"] if media_type == MediaType.IMAGE else [],
    )
    session.add(asset)
    session.flush()
    return asset


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


def test_get_chats_route_applies_filter_and_returns_expected_preview(db_session_factory, monkeypatch):
    SessionLocal, session_scope = db_session_factory
    with session_scope() as session:
        private_thread = _create_thread(session, external_id="ties", title="Ties")
        media_asset = _create_asset(session, media_type=MediaType.IMAGE)
        _create_message(
            session,
            thread=private_thread,
            sender="sammykastanja",
            sent_at=datetime(2026, 3, 20, 10, 45, tzinfo=UTC),
            assets=[media_asset],
        )

        text_thread = _create_thread(session, external_id="alex", title="Alex")
        _create_message(
            session,
            thread=text_thread,
            sender="Alex",
            sent_at=datetime(2026, 3, 19, 9, 0, tzinfo=UTC),
            body="Hello there",
        )

    client = _build_chat_app(SessionLocal, monkeypatch)

    response = client.get("/api/chats", params={"filter": "has_media"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["display_name"] == "Ties"
    assert payload["items"][0]["latest_preview"] == "You: Media attachment"
    assert payload["items"][0]["has_media"] is True
    assert payload["items"][0]["is_group"] is False


def test_get_chats_route_searches_message_bodies(db_session_factory, monkeypatch):
    SessionLocal, session_scope = db_session_factory
    with session_scope() as session:
        thread = _create_thread(session, external_id="alex", title="Alex")
        _create_message(
            session,
            thread=thread,
            sender="Alex",
            sent_at=datetime(2026, 3, 19, 9, 0, tzinfo=UTC),
            body="Meet me near the station entrance",
        )

    client = _build_chat_app(SessionLocal, monkeypatch)

    response = client.get("/api/chats", params={"search": "station entrance"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["display_name"] == "Alex"


def test_get_chat_messages_route_returns_grouped_messages_with_media_payload(db_session_factory, monkeypatch):
    SessionLocal, _ = db_session_factory
    with SessionLocal() as session:
        thread = _create_thread(session, external_id="ties", title="Ties")
        photo_asset = _create_asset(session, media_type=MediaType.IMAGE, has_overlay=True)
        _create_message(
            session,
            thread=thread,
            sender="sammykastanja",
            sent_at=datetime(2026, 3, 20, 10, 0, 10, tzinfo=UTC),
            body="First line",
        )
        _create_message(
            session,
            thread=thread,
            sender="sammykastanja",
            sent_at=datetime(2026, 3, 20, 10, 0, 40, tzinfo=UTC),
            body="Second line",
            assets=[photo_asset],
        )
        thread_id = thread.id
        session.commit()

    client = _build_chat_app(SessionLocal, monkeypatch)

    response = client.get(f"/api/chats/{thread_id}/messages", params={"limit": 50, "offset": 0})

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["has_more"] is False
    assert payload["items"][0]["sender_label"] == "ME"
    assert payload["items"][0]["text"] == "First line\nSecond line"
    assert payload["items"][0]["media_assets"][0]["id"] == str(photo_asset.id)
    assert payload["items"][0]["media_assets"][0]["has_overlay"] is True
    assert payload["items"][0]["media_assets"][0]["tags"] == ["trip"]


def test_get_chat_messages_route_returns_404_for_missing_thread(db_session_factory, monkeypatch):
    SessionLocal, _ = db_session_factory
    client = _build_chat_app(SessionLocal, monkeypatch)

    response = client.get(f"/api/chats/{uuid.uuid4()}/messages")

    assert response.status_code == 404
    assert response.json()["detail"] == "Chat thread not found."
