from __future__ import annotations

import json
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from apps.api.app.api.routes import profile as profile_routes
from snapcapsule_core.services.profile_queries import build_profile_snapshot


def _build_profile_app(SessionLocal, monkeypatch, settings) -> TestClient:
    monkeypatch.setattr(profile_routes, "SessionLocal", SessionLocal)
    monkeypatch.setattr(profile_routes, "get_settings", lambda: settings)

    app = FastAPI()
    app.include_router(profile_routes.router)
    return TestClient(app)


def test_get_profile_route_returns_persisted_snapshot(db_session_factory, monkeypatch, tmp_path):
    SessionLocal, _ = db_session_factory
    snapshot_path = tmp_path / "profile-snapshot.json"
    snapshot_path.write_text(
        json.dumps(
            {
                "generated_at": "2026-03-19T10:00:00+00:00",
                "account": {
                    "username": "sammykastanja",
                    "display_name": "Sammy",
                    "country": "NL",
                    "created_at": "2017-02-02T11:16:14+00:00",
                    "account_creation_country": None,
                    "in_app_language": None,
                    "platform_version": None,
                    "registration_ip": None,
                },
                "current_device": {
                    "make": "Apple",
                    "model_name": "iPhone17,3",
                    "os_type": "iOS",
                    "language": "nl-NL",
                },
                "device_history": [],
                "friends": {
                    "friends_count": 2,
                    "friend_requests_sent_count": 0,
                    "blocked_count": 0,
                    "deleted_count": 0,
                    "ignored_count": 0,
                    "pending_count": 0,
                    "top_friends": [],
                },
                "bitmoji": {
                    "email": None,
                    "phone_number": None,
                    "account_created_at": None,
                    "avatar_gender": None,
                    "app_open_count": 0,
                    "outfit_save_count": 0,
                    "share_count": 0,
                },
                "engagement": {
                    "application_opens": 0,
                    "story_views": 0,
                    "discover_channels_viewed_count": 0,
                    "ads_interacted_count": 0,
                    "breakdown_of_time_spent": [],
                    "interest_categories": [],
                    "content_categories": [],
                },
                "security": {
                    "login_count": 0,
                    "latest_login_at": None,
                    "latest_login_country": None,
                    "latest_login_status": None,
                    "password_change_count": 0,
                    "connected_permissions_count": 0,
                    "two_factor_events": [],
                    "download_reports": [],
                },
                "history": {
                    "display_name_changes": [],
                    "email_changes": [],
                    "mobile_number_changes": [],
                },
                "public_profile": {
                    "created_at": None,
                    "title": None,
                    "location": None,
                    "website": None,
                },
            }
        ),
        encoding="utf-8",
    )
    settings = SimpleNamespace(profile_snapshot_path=snapshot_path)
    client = _build_profile_app(SessionLocal, monkeypatch, settings)

    response = client.get("/api/profile")

    assert response.status_code == 200
    payload = response.json()
    assert payload["account"]["username"] == "sammykastanja"
    assert payload["friends"]["friends_count"] == 2


def test_build_profile_snapshot_parses_export_roots(tmp_path):
    export_root = tmp_path / "export"
    json_root = export_root / "json"
    json_root.mkdir(parents=True)

    (json_root / "account.json").write_text(
        json.dumps(
            {
                "Basic Information": {
                    "Username": "sammykastanja",
                    "Name": "Sammy",
                    "Creation Date": "2017-02-02 11:16:14 UTC",
                    "Country": "NL",
                },
                "Device Information": {
                    "Make": "Apple",
                    "Model Name": "iPhone17,3",
                    "OS Type": "iOS",
                    "Language": "nl-NL",
                },
                "Device History": [
                    {"Make": "Apple", "Model": "iPhone17,3", "Start Time": "2025-03-08 15:00:00 UTC", "Device Type": "PHONE"}
                ],
                "Login History": [
                    {"Country": "NL", "Created": "2026-03-17 13:43:50 UTC", "Status": "success"}
                ],
            }
        ),
        encoding="utf-8",
    )
    (json_root / "user_profile.json").write_text(
        json.dumps(
            {
                "App Profile": {
                    "Country": "NL",
                    "Creation Time": "2017-02-02 11:16:14 UTC",
                    "In-app Language": "nl",
                },
                "Engagement": [{"Event": "Application Opens", "Occurrences": 856}],
                "Interest Categories": ["Furniture Stores"],
            }
        ),
        encoding="utf-8",
    )
    (json_root / "friends.json").write_text(
        json.dumps(
            {
                "Friends": [
                    {
                        "Username": "ninoscheut",
                        "Display Name": "Nino",
                        "Creation Timestamp": "2017-02-02 11:26:45 UTC",
                        "Source": "added by unknown",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    (json_root / "bitmoji.json").write_text(
        json.dumps(
            {
                "Basic Information": {"Email": "sammy@example.com"},
                "Analytics": {"App Open Count": 14, "Avatar Gender": "male"},
            }
        ),
        encoding="utf-8",
    )
    (json_root / "account_history.json").write_text(
        json.dumps(
            {
                "Two-Factor Authentication": [{"Date": "2022-01-18 20:35:33 UTC", "Event": "SMS enabled"}],
                "Display Name Change": [{"Date": "2019-12-20 09:27:27 UTC", "Display Name": "Sammy"}],
            }
        ),
        encoding="utf-8",
    )
    (json_root / "connected_apps.json").write_text(json.dumps({"Permissions": [{"App": "Bitmoji"}]}), encoding="utf-8")
    (json_root / "snap_pro.json").write_text(json.dumps({"Profile": {"Profile Title": "Sammy", "Location": "NL"}}), encoding="utf-8")

    settings = SimpleNamespace(profile_snapshot_path=tmp_path / "profile-snapshot.json")

    snapshot = build_profile_snapshot(settings, [export_root])

    assert snapshot is not None
    assert snapshot["account"]["username"] == "sammykastanja"
    assert snapshot["friends"]["friends_count"] == 1
    assert snapshot["bitmoji"]["email"] == "sammy@example.com"
    assert snapshot["engagement"]["application_opens"] == 856
    assert snapshot["public_profile"]["title"] == "Sammy"
