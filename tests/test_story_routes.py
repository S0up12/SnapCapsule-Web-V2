from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from apps.api.app.api.routes import stories as story_routes
from snapcapsule_core.models import Asset, IngestionJob, StoryCollection, StoryItem
from snapcapsule_core.models.enums import AssetSource, IngestionJobStatus, IngestionSourceKind, MediaType, StoryType


def _build_story_app(SessionLocal, monkeypatch, settings=None) -> TestClient:
    monkeypatch.setattr(story_routes, "SessionLocal", SessionLocal)
    monkeypatch.setattr(story_routes, "get_settings", lambda: settings or SimpleNamespace())

    app = FastAPI()
    app.include_router(story_routes.router)
    return TestClient(app)


def _create_story_asset(
    session,
    *,
    media_type: MediaType,
    taken_at: datetime,
    is_favorite: bool = False,
    has_overlay: bool = False,
) -> Asset:
    extension = "jpg" if media_type == MediaType.IMAGE else "mp4"
    asset = Asset(
        source_type=AssetSource.STORY,
        media_type=media_type,
        original_path=f"/tmp/{uuid.uuid4()}.{extension}",
        thumbnail_path=f"/tmp/{uuid.uuid4()}.jpg",
        overlay_path=f"/tmp/{uuid.uuid4()}_overlay.png" if has_overlay else None,
        taken_at=taken_at,
        is_favorite=is_favorite,
        tags=["highlight"] if is_favorite else [],
    )
    session.add(asset)
    session.flush()
    return asset


def _create_story_collection(session, *, title: str, story_type: StoryType) -> StoryCollection:
    collection = StoryCollection(title=title, story_type=story_type, external_id=f"story:{uuid.uuid4()}")
    session.add(collection)
    session.flush()
    return collection


def test_get_stories_returns_collections_with_nested_assets(db_session_factory, monkeypatch):
    SessionLocal, _ = db_session_factory
    with SessionLocal() as session:
        newer_collection = _create_story_collection(session, title="My Story", story_type=StoryType.PRIVATE)
        newer_photo = _create_story_asset(
            session,
            media_type=MediaType.IMAGE,
            taken_at=datetime(2026, 3, 20, 12, 30, tzinfo=UTC),
            is_favorite=True,
            has_overlay=True,
        )
        older_video = _create_story_asset(
            session,
            media_type=MediaType.VIDEO,
            taken_at=datetime(2026, 3, 20, 9, 15, tzinfo=UTC),
        )
        session.add_all(
            [
                StoryItem(collection_id=newer_collection.id, asset_id=newer_photo.id, posted_at=newer_photo.taken_at, position=0),
                StoryItem(collection_id=newer_collection.id, asset_id=older_video.id, posted_at=older_video.taken_at, position=1),
            ]
        )

        older_collection = _create_story_collection(session, title="Campus", story_type=StoryType.PUBLIC)
        older_asset = _create_story_asset(
            session,
            media_type=MediaType.IMAGE,
            taken_at=datetime(2026, 3, 19, 18, 0, tzinfo=UTC),
        )
        session.add(StoryItem(collection_id=older_collection.id, asset_id=older_asset.id, posted_at=older_asset.taken_at, position=0))
        session.commit()

    client = _build_story_app(SessionLocal, monkeypatch)

    response = client.get("/api/stories")

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_collections"] == 2
    assert payload["total_story_items"] == 3
    assert payload["items"][0]["title"] == "My Story"
    assert payload["items"][0]["story_type"] == "private"
    assert payload["items"][0]["total_items"] == 2
    assert payload["items"][0]["items"][0]["id"] == str(newer_photo.id)
    assert payload["items"][0]["items"][0]["has_overlay"] is True
    assert payload["items"][0]["items"][0]["tags"] == ["highlight"]
    assert payload["items"][0]["items"][1]["id"] == str(older_video.id)
    assert payload["items"][1]["title"] == "Campus"
    assert payload["activity"] == {
        "spotlight_history_count": 0,
        "shared_story_count": 0,
        "latest_story_date": None,
        "spotlight_history": [],
        "shared_story_activity": [],
    }


def test_get_stories_returns_empty_payload_when_no_story_assets_exist(db_session_factory, monkeypatch):
    SessionLocal, _ = db_session_factory
    client = _build_story_app(SessionLocal, monkeypatch)

    response = client.get("/api/stories")

    assert response.status_code == 200
    assert response.json() == {
        "items": [],
        "total_collections": 0,
        "total_story_items": 0,
        "activity": {
            "spotlight_history_count": 0,
            "shared_story_count": 0,
            "latest_story_date": None,
            "spotlight_history": [],
            "shared_story_activity": [],
        },
    }


def test_get_stories_returns_metadata_activity_without_local_story_media(db_session_factory, monkeypatch, tmp_path):
    SessionLocal, _ = db_session_factory
    export_root = tmp_path / "export"
    json_root = export_root / "json"
    json_root.mkdir(parents=True)
    (json_root / "shared_story.json").write_text(
        json.dumps(
            {
                "Shared Story": [
                    {
                        "Story Date": "2026-03-22 08:00:00 UTC",
                        "Story URL": "https://story.snapchat.com/o/shared-1",
                        "Action Type": "VIEW",
                        "View Time": "1.37 seconds",
                    }
                ],
                "Spotlight History": [
                    {
                        "Story Date": "2026-03-23 09:30:00 UTC",
                        "Story URL": "https://story.snapchat.com/o/spotlight-1",
                        "Action Type": "VIEW",
                        "View Time": "not available",
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    with SessionLocal() as session:
        session.add(
            IngestionJob(
                source_kind=IngestionSourceKind.DIRECTORY,
                source_name="export",
                source_path=str(export_root),
                status=IngestionJobStatus.COMPLETED,
                progress_percent=100,
            )
        )
        session.commit()

    client = _build_story_app(SessionLocal, monkeypatch, SimpleNamespace())

    response = client.get("/api/stories")

    assert response.status_code == 200
    payload = response.json()
    assert payload["items"] == []
    assert payload["total_collections"] == 0
    assert payload["total_story_items"] == 0
    assert payload["activity"]["spotlight_history_count"] == 1
    assert payload["activity"]["shared_story_count"] == 1
    assert payload["activity"]["latest_story_date"] == "2026-03-23T09:30:00+00:00"
    assert payload["activity"]["spotlight_history"][0]["story_url"] == "https://story.snapchat.com/o/spotlight-1"
    assert payload["activity"]["spotlight_history"][0]["view_duration_seconds"] is None
    assert payload["activity"]["shared_story_activity"][0]["view_duration_seconds"] == 1.37
