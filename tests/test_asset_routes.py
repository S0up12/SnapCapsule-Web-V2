from __future__ import annotations

import uuid
from datetime import UTC, datetime
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from snapcapsule_core.models import Asset, MemoryCollection, MemoryItem
from snapcapsule_core.models.enums import AssetSource, MediaType

from apps.api.app.api.routes import assets as asset_routes


def _build_asset_app(SessionLocal, session_scope, monkeypatch) -> TestClient:
    monkeypatch.setattr(asset_routes, "SessionLocal", SessionLocal)
    monkeypatch.setattr(asset_routes, "session_scope", session_scope)

    app = FastAPI()
    app.include_router(asset_routes.router)
    return TestClient(app)


def _create_memory_asset(
    session,
    *,
    taken_at: datetime | None,
    media_type: MediaType = MediaType.IMAGE,
    tags=None,
    is_favorite=False,
    raw_metadata=None,
):
    collection = session.query(MemoryCollection).first()
    if collection is None:
        collection = MemoryCollection(title="Saved Media")
        session.add(collection)
        session.flush()

    extension = "jpg" if media_type == MediaType.IMAGE else "mp4"
    asset = Asset(
        source_type=AssetSource.MEMORY,
        media_type=media_type,
        original_path=f"/tmp/{uuid.uuid4()}.{extension}",
        thumbnail_path=f"/tmp/{uuid.uuid4()}.jpg",
        taken_at=taken_at,
        tags=list(tags or ()),
        is_favorite=is_favorite,
        raw_metadata=raw_metadata,
    )
    session.add(asset)
    session.flush()
    session.add(
        MemoryItem(
            collection_id=collection.id,
            asset_id=asset.id,
            taken_at=taken_at,
        )
    )
    session.flush()
    return asset


def test_get_timeline_route_applies_date_range_and_filters(db_session_factory, monkeypatch):
    SessionLocal, session_scope = db_session_factory
    with session_scope() as session:
        matching = _create_memory_asset(
            session,
            taken_at=datetime(2024, 6, 15, 13, 0, tzinfo=UTC),
            media_type=MediaType.IMAGE,
            tags=["Trip"],
            is_favorite=True,
        )
        _create_memory_asset(
            session,
            taken_at=datetime(2024, 6, 16, 13, 0, tzinfo=UTC),
            media_type=MediaType.IMAGE,
            tags=["Trip"],
            is_favorite=True,
        )
        _create_memory_asset(
            session,
            taken_at=datetime(2024, 6, 15, 8, 0, tzinfo=UTC),
            media_type=MediaType.VIDEO,
            tags=["Trip"],
            is_favorite=True,
        )
        _create_memory_asset(
            session,
            taken_at=datetime(2024, 6, 15, 9, 0, tzinfo=UTC),
            media_type=MediaType.IMAGE,
            tags=["Other"],
            is_favorite=True,
        )

    client = _build_asset_app(SessionLocal, session_scope, monkeypatch)

    response = client.get(
        "/api/timeline",
        params={
            "media_type": "image",
            "favorite": "true",
            "tags": "Trip",
            "date_from": "2024-06-15",
            "date_to": "2024-06-15",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["summary"] == {
        "total_assets": 1,
        "total_photos": 1,
        "total_videos": 0,
    }
    assert [item["id"] for item in payload["items"]] == [str(matching.id)]


def test_asset_mutation_routes_toggle_favorite_and_update_tags(db_session_factory, monkeypatch):
    SessionLocal, session_scope = db_session_factory
    with session_scope() as session:
        asset = _create_memory_asset(
            session,
            taken_at=datetime(2024, 6, 15, 13, 0, tzinfo=UTC),
            tags=["old"],
        )

    client = _build_asset_app(SessionLocal, session_scope, monkeypatch)

    favorite_response = client.post(f"/api/asset/{asset.id}/favorite")
    assert favorite_response.status_code == 200
    assert favorite_response.json()["is_favorite"] is True

    tags_response = client.post(
        f"/api/asset/{asset.id}/tags",
        json={"tags": [" Beach ", "beach", "Trip"]},
    )
    assert tags_response.status_code == 200
    assert tags_response.json()["tags"] == ["Beach", "Trip"]


def test_delete_timeline_tag_route_removes_tag_globally(db_session_factory, monkeypatch):
    SessionLocal, session_scope = db_session_factory
    with session_scope() as session:
        first = _create_memory_asset(
            session,
            taken_at=datetime(2024, 6, 15, 13, 0, tzinfo=UTC),
            tags=["Trip", "Beach"],
        )
        second = _create_memory_asset(
            session,
            taken_at=datetime(2024, 6, 15, 14, 0, tzinfo=UTC),
            media_type=MediaType.VIDEO,
            tags=["trip"],
        )

    client = _build_asset_app(SessionLocal, session_scope, monkeypatch)

    response = client.delete("/api/timeline/tags/Trip")

    assert response.status_code == 200
    assert response.json() == {"tag": "Trip", "affected_assets": 2}

    with session_scope() as session:
        refreshed_first = session.get(Asset, first.id)
        refreshed_second = session.get(Asset, second.id)
        assert refreshed_first.tags == ["Beach"]
        assert refreshed_second.tags == []


def test_get_timeline_route_searches_tags_filenames_and_date_text(db_session_factory, monkeypatch):
    SessionLocal, session_scope = db_session_factory
    with session_scope() as session:
        matching = _create_memory_asset(
            session,
            taken_at=datetime(2024, 6, 15, 13, 0, tzinfo=UTC),
            media_type=MediaType.IMAGE,
            tags=["Aurora"],
            raw_metadata={
                "source_path": "/imports/memories/Sunrise-Beach.jpg",
                "relative_path": "memories/Sunrise-Beach.jpg",
            },
        )
        _create_memory_asset(
            session,
            taken_at=datetime(2024, 12, 20, 9, 0, tzinfo=UTC),
            media_type=MediaType.IMAGE,
            tags=["Winter"],
            raw_metadata={
                "source_path": "/imports/memories/SkiTrip.jpg",
                "relative_path": "memories/SkiTrip.jpg",
            },
        )

    client = _build_asset_app(SessionLocal, session_scope, monkeypatch)

    assert client.get("/api/timeline", params={"search": "aurora"}).json()["items"][0]["id"] == str(matching.id)
    assert client.get("/api/timeline", params={"search": "sunrise-beach"}).json()["items"][0]["id"] == str(matching.id)
    assert client.get("/api/timeline", params={"search": "june 15"}).json()["items"][0]["id"] == str(matching.id)


def test_get_timeline_route_can_hide_undated_assets(db_session_factory, monkeypatch):
    SessionLocal, session_scope = db_session_factory
    with session_scope() as session:
        dated = _create_memory_asset(
            session,
            taken_at=datetime(2024, 6, 15, 13, 0, tzinfo=UTC),
            media_type=MediaType.IMAGE,
        )
        _create_memory_asset(
            session,
            taken_at=None,
            media_type=MediaType.IMAGE,
        )

    client = _build_asset_app(SessionLocal, session_scope, monkeypatch)

    visible_response = client.get("/api/timeline")
    hidden_response = client.get("/api/timeline", params={"include_undated": "false"})

    assert visible_response.status_code == 200
    assert hidden_response.status_code == 200
    assert visible_response.json()["total"] == 2
    assert hidden_response.json()["total"] == 1
    assert hidden_response.json()["items"][0]["id"] == str(dated.id)


def test_get_asset_playback_route_streams_browser_compatible_video(db_session_factory, monkeypatch, tmp_path: Path):
    SessionLocal, session_scope = db_session_factory
    source_path = tmp_path / "source.mp4"
    source_path.write_bytes(b"original-video")
    playback_path = tmp_path / "playback" / "video.mp4"
    playback_path.parent.mkdir(parents=True, exist_ok=True)
    playback_path.write_bytes(b"0123456789")

    with session_scope() as session:
        asset = _create_memory_asset(
            session,
            taken_at=datetime(2024, 6, 15, 13, 0, tzinfo=UTC),
            media_type=MediaType.VIDEO,
        )
        asset.original_path = str(source_path)

    client = _build_asset_app(SessionLocal, session_scope, monkeypatch)

    class PlaybackMediaProcessor:
        def ensure_browser_playback(self, asset_id: str, media_path: str, media_type: MediaType) -> Path:
            assert asset_id == str(asset.id)
            assert Path(media_path) == source_path
            assert media_type == MediaType.VIDEO
            return playback_path

    monkeypatch.setattr(asset_routes, "MediaProcessor", PlaybackMediaProcessor)

    response = client.get(
        f"/api/asset/{asset.id}/playback",
        headers={"Range": "bytes=0-3"},
    )

    assert response.status_code == 206
    assert response.content == b"0123"
    assert response.headers["content-range"] == "bytes 0-3/10"
    assert response.headers["content-type"].startswith("video/mp4")
