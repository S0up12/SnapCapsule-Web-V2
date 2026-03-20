from __future__ import annotations

import json
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from apps.api.app.api.routes import profile as profile_routes
from snapcapsule_core.services import profile_queries
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
                "ranking": {
                    "snapscore": 101683,
                    "total_friends": 73,
                    "accounts_followed": 0,
                    "spotlight_posts": 114,
                    "top_spotlight_tags": ["#meme"],
                },
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
                    "cohort_age": None,
                    "derived_ad_demographic": None,
                    "breakdown_of_time_spent": [],
                    "interest_categories": [],
                    "content_categories": [],
                    "web_interactions": [],
                    "app_interactions": [],
                    "off_platform_share_count": 0,
                    "latest_off_platform_share_at": None,
                    "share_destinations": [],
                },
                "security": {
                    "login_count": 0,
                    "latest_login_at": None,
                    "latest_login_country": None,
                    "latest_login_status": None,
                    "password_change_count": 0,
                    "connected_permissions_count": 0,
                    "latest_terms_acceptance_at": None,
                    "two_factor_events": [],
                    "download_reports": [],
                    "connected_apps": [],
                    "terms_acceptances": [],
                },
                "history": {
                    "display_name_changes": [],
                    "email_changes": [],
                    "mobile_number_changes": [],
                },
                "location": {
                    "latest_region": None,
                    "latest_city": None,
                    "latest_country": None,
                    "frequent_regions": [],
                    "raw_location_count": 0,
                    "latest_coordinate_at": None,
                    "latest_coordinate": None,
                    "inferred_home": None,
                    "inferred_work": None,
                    "declared_home": None,
                    "school_name": None,
                    "visited_places": [],
                    "business_visits": [],
                    "snap_map_places": [],
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
                "Demographics": {
                    "Cohort Age": "AGE_21_TO_24",
                    "Derived Ad Demographic": "MALE",
                },
                "Interactions": {
                    "Web Interactions": ["kw1c.nl", "marktplaats.nl"],
                    "App Interactions": ["Spotify"],
                },
                "Off-Platform Sharing": [
                    {"Share Destination": "Camera Roll", "Date": "2026-01-23 00:00:00 UTC", "Media Type": "Video"}
                ],
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
    (json_root / "ranking.json").write_text(
        json.dumps(
            {
                "Statistics": {
                    "Snapscore": "101683.0",
                    "Your Total Friends": "73",
                    "The Number of Accounts You Follow": "0",
                },
                "Spotlight": [114, {"#meme": "6", "#art": "5"}],
            }
        ),
        encoding="utf-8",
    )
    (json_root / "snap_pro.json").write_text(json.dumps({"Profile": {"Profile Title": "Sammy", "Location": "NL"}}), encoding="utf-8")
    (json_root / "terms_history.json").write_text(
        json.dumps(
            {
                "Terms of Service and Privacy Policy Acceptance History": [
                    {
                        "Version": "Snap Terms of Service & Privacy Policy - November 15, 2021",
                        "Acceptance Date": "2021-11-18 23:02:25 UTC",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    (json_root / "location_history.json").write_text(
        json.dumps(
            {
                "Frequent Locations": [{"Region": "nb"}, {"Region": "li"}],
                "Latest Location": [{"Region": "li", "City": "Eindhoven", "Country": "NL"}],
                "Home, School & Work": {
                    "inferredHome": "lat 51.584, long 5.343",
                    "inferredWork": "lat 51.685, long 5.291",
                },
                "Businesses and places you may have visited": {
                    "inferredVisitationList": [["The Old Irish", "Tilburg"]],
                    "businessList": [["2025-03-02", "Foot Locker"]],
                },
                "Location History": [
                    ["2026-02-09 00:41:21 UTC", "51.585, 5.343"],
                    ["2026-02-09 02:00:07 UTC", "51.586, 5.344"],
                ],
            }
        ),
        encoding="utf-8",
    )
    (json_root / "snap_map_places_history.json").write_text(
        json.dumps(
            {
                "Snap Map Places History": [
                    {
                        "Date": "2026-02-28 22:50:18 UTC",
                        "Place": "The Old Irish",
                        "Place Location": "Tilburg, Provincie Noord-Brabant",
                        "Share Type": "Snap Send",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    settings = SimpleNamespace(profile_snapshot_path=tmp_path / "profile-snapshot.json")

    snapshot = build_profile_snapshot(settings, [export_root])

    assert snapshot is not None
    assert snapshot["account"]["username"] == "sammykastanja"
    assert snapshot["ranking"]["snapscore"] == 101683
    assert snapshot["ranking"]["top_spotlight_tags"][0] == "#meme"
    assert snapshot["friends"]["friends_count"] == 1
    assert snapshot["bitmoji"]["email"] == "sammy@example.com"
    assert snapshot["engagement"]["application_opens"] == 856
    assert snapshot["engagement"]["cohort_age"] == "AGE_21_TO_24"
    assert snapshot["engagement"]["web_interactions"][0] == "kw1c.nl"
    assert snapshot["engagement"]["off_platform_share_count"] == 1
    assert snapshot["security"]["latest_terms_acceptance_at"] == "2021-11-18T23:02:25+00:00"
    assert snapshot["security"]["connected_apps"][0]["label"] == "Bitmoji"
    assert snapshot["location"]["latest_region"] == "li"
    assert snapshot["location"]["raw_location_count"] == 2
    assert snapshot["location"]["visited_places"][0]["name"] == "The Old Irish"
    assert snapshot["location"]["business_visits"][0]["name"] == "Foot Locker"
    assert snapshot["location"]["snap_map_places"][0]["name"] == "The Old Irish"
    assert snapshot["public_profile"]["title"] == "Sammy"


def test_get_profile_snapshot_falls_back_to_persisted_snapshot_when_rebuild_fails(
    db_session_factory,
    monkeypatch,
    tmp_path,
):
    SessionLocal, _ = db_session_factory
    snapshot_path = tmp_path / "profile-snapshot.json"
    snapshot_path.write_text(
        json.dumps(
            {
                "generated_at": "2026-03-19T10:00:00+00:00",
                "account": {"username": "sammykastanja"},
                "location": {
                    "visited_places": [],
                    "business_visits": [],
                    "snap_map_places": [],
                },
                "engagement": {
                    "cohort_age": None,
                    "derived_ad_demographic": None,
                    "web_interactions": [],
                    "app_interactions": [],
                    "off_platform_share_count": 0,
                    "latest_off_platform_share_at": None,
                    "share_destinations": [],
                },
                "security": {
                    "latest_terms_acceptance_at": None,
                    "connected_apps": [],
                    "terms_acceptances": [],
                },
            }
        ),
        encoding="utf-8",
    )
    settings = SimpleNamespace(profile_snapshot_path=snapshot_path)

    with SessionLocal() as session:
        monkeypatch.setattr(profile_queries, "discover_profile_roots", lambda _session, _settings: [tmp_path / "export"])
        monkeypatch.setattr(profile_queries, "build_profile_snapshot", lambda _settings, _roots: None)

        snapshot = profile_queries.get_profile_snapshot(session, settings)

    assert snapshot is not None
    assert snapshot["account"]["username"] == "sammykastanja"
