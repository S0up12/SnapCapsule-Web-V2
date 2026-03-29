from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from apps.api.app.api.routes import settings as settings_routes


def test_get_library_status_serializes_diagnostics(monkeypatch):
    app = FastAPI()
    app.include_router(settings_routes.router)

    class FakeDiagnostics:
        storage = {
            "raw_media_bytes": 1,
            "thumbnail_bytes": 2,
            "playback_cache_bytes": 3,
            "ingest_workspace_bytes": 4,
            "ingest_upload_bytes": 5,
            "total_bytes": 15,
        }
        integrity = {
            "total_assets": 6,
            "video_assets": 2,
            "playback_derivatives": 1,
            "orphaned_playback_files": 0,
            "missing_original_files": 0,
            "missing_thumbnail_files": 0,
            "missing_overlay_files": 0,
            "playback_error_assets": 0,
        }

    monkeypatch.setattr(settings_routes, "get_library_diagnostics", lambda _settings: FakeDiagnostics())

    client = TestClient(app)
    response = client.get("/api/system/library")

    assert response.status_code == 200
    assert response.json() == {
        "storage": {
            "raw_media_bytes": 1,
            "thumbnail_bytes": 2,
            "playback_cache_bytes": 3,
            "ingest_workspace_bytes": 4,
            "ingest_upload_bytes": 5,
            "total_bytes": 15,
        },
        "integrity": {
            "total_assets": 6,
            "video_assets": 2,
            "playback_derivatives": 1,
            "orphaned_playback_files": 0,
            "missing_original_files": 0,
            "missing_thumbnail_files": 0,
            "missing_overlay_files": 0,
            "playback_error_assets": 0,
        },
    }
