from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from snapcapsule_core.models import IngestionJob, ProfileSnapshot
from snapcapsule_core.models.enums import IngestionSourceKind
from snapcapsule_core.services.ingestion import IngestionService

PROFILE_JSON_FILES = (
    "account.json",
    "account_history.json",
    "bitmoji.json",
    "connected_apps.json",
    "friends.json",
    "location_history.json",
    "ranking.json",
    "snapchat_ai.json",
    "snapchat_plus.json",
    "snap_map_places_history.json",
    "snap_pro.json",
    "support_note.json",
    "talk_history.json",
    "terms_history.json",
    "user_profile.json",
)

DURATION_SECONDS_PATTERN = re.compile(r"(?P<seconds>\d+(?:\.\d+)?)")


def get_profile_snapshot(session: Session, settings) -> dict[str, Any] | None:
    persisted = load_profile_snapshot(session, settings)
    if persisted is not None and _snapshot_has_current_profile_shape(persisted):
        return persisted

    roots = discover_profile_roots(session, settings)
    if not roots:
        return persisted

    snapshot = build_profile_snapshot(settings, roots)
    if snapshot is None:
        return persisted

    save_profile_snapshot(session, snapshot)
    return snapshot


def persist_profile_snapshot_from_roots(session: Session, settings, roots: list[Path]) -> dict[str, Any] | None:
    snapshot = build_profile_snapshot(settings, roots)
    if snapshot is None:
        return None
    save_profile_snapshot(session, snapshot)
    return snapshot


def load_profile_snapshot(session: Session, settings) -> dict[str, Any] | None:
    db_snapshot = load_profile_snapshot_from_db(session)
    if db_snapshot is not None:
        return db_snapshot

    legacy_snapshot = load_profile_snapshot_from_file(settings)
    if legacy_snapshot is not None:
        save_profile_snapshot(session, legacy_snapshot)
        return legacy_snapshot

    return None


def load_profile_snapshot_from_db(session: Session) -> dict[str, Any] | None:
    row = session.get(ProfileSnapshot, 1)
    if row is None or not isinstance(row.snapshot, dict):
        return None
    return dict(row.snapshot)


def load_profile_snapshot_from_file(settings) -> dict[str, Any] | None:
    path = settings.profile_snapshot_path
    if not path.exists() or not path.is_file():
        return None

    try:
        raw_payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None

    return raw_payload if isinstance(raw_payload, dict) else None


def save_profile_snapshot(session: Session, snapshot: dict[str, Any]) -> None:
    generated_at = _parse_datetime(snapshot.get("generated_at"))
    row = session.get(ProfileSnapshot, 1)
    if row is None:
        row = ProfileSnapshot(
            id=1,
            generated_at=generated_at,
            snapshot=snapshot,
        )
        session.add(row)
    else:
        row.generated_at = generated_at
        row.snapshot = snapshot
    session.flush()


def _snapshot_has_current_profile_shape(snapshot: dict[str, Any]) -> bool:
    location = snapshot.get("location")
    if not isinstance(location, dict):
        return False
    engagement = snapshot.get("engagement")
    security = snapshot.get("security")
    ranking = snapshot.get("ranking")
    subscriptions = snapshot.get("subscriptions")
    communications = snapshot.get("communications")
    required_location_keys = {"visited_places", "business_visits", "snap_map_places"}
    required_engagement_keys = {
        "cohort_age",
        "derived_ad_demographic",
        "web_interactions",
        "app_interactions",
        "off_platform_share_count",
        "latest_off_platform_share_at",
        "share_destinations",
    }
    required_security_keys = {"latest_terms_acceptance_at", "connected_apps", "terms_acceptances"}
    required_subscriptions_keys = {"snapchat_plus_active", "purchase_count", "latest_purchase", "recent_purchases"}
    required_communications_keys = {
        "outgoing_calls_count",
        "incoming_calls_count",
        "completed_calls_count",
        "latest_call_at",
        "recent_calls",
        "support_notes",
    }
    return (
        isinstance(engagement, dict)
        and isinstance(security, dict)
        and isinstance(ranking, dict)
        and isinstance(subscriptions, dict)
        and isinstance(communications, dict)
        and required_location_keys.issubset(location.keys())
        and required_engagement_keys.issubset(engagement.keys())
        and required_security_keys.issubset(security.keys())
        and required_subscriptions_keys.issubset(subscriptions.keys())
        and required_communications_keys.issubset(communications.keys())
    )


def discover_profile_roots(session: Session, settings) -> list[Path]:
    service = IngestionService(settings)
    jobs = session.execute(select(IngestionJob).order_by(IngestionJob.created_at.desc())).scalars()

    for job in jobs:
        candidate_roots = _resolve_job_roots(service, job)
        if not candidate_roots:
            continue
        if any(_root_contains_profile_json(root) for root in candidate_roots):
            return candidate_roots

    return []


def discover_latest_export_roots(session: Session, settings) -> list[Path]:
    service = IngestionService(settings)
    jobs = session.execute(select(IngestionJob).order_by(IngestionJob.created_at.desc())).scalars()

    for job in jobs:
        candidate_roots = _resolve_job_roots(service, job)
        if candidate_roots:
            return candidate_roots

    return []


def build_profile_snapshot(settings, roots: list[Path]) -> dict[str, Any] | None:
    service = IngestionService(settings)
    payloads = {
        filename: service.load_merged_json_payload(roots, filename, service.merge_generic_json_payload)
        for filename in PROFILE_JSON_FILES
    }

    if not any(payloads.values()):
        return None

    account = payloads.get("account.json") if isinstance(payloads.get("account.json"), dict) else {}
    user_profile = payloads.get("user_profile.json") if isinstance(payloads.get("user_profile.json"), dict) else {}
    friends = payloads.get("friends.json") if isinstance(payloads.get("friends.json"), dict) else {}
    bitmoji = payloads.get("bitmoji.json") if isinstance(payloads.get("bitmoji.json"), dict) else {}
    account_history = payloads.get("account_history.json") if isinstance(payloads.get("account_history.json"), dict) else {}
    connected_apps = payloads.get("connected_apps.json") if isinstance(payloads.get("connected_apps.json"), dict) else {}
    location_history = payloads.get("location_history.json") if isinstance(payloads.get("location_history.json"), dict) else {}
    ranking = payloads.get("ranking.json") if isinstance(payloads.get("ranking.json"), dict) else {}
    snapchat_plus = payloads.get("snapchat_plus.json") if isinstance(payloads.get("snapchat_plus.json"), dict) else {}
    snap_map_places_history = payloads.get("snap_map_places_history.json") if isinstance(payloads.get("snap_map_places_history.json"), dict) else {}
    snap_pro = payloads.get("snap_pro.json") if isinstance(payloads.get("snap_pro.json"), dict) else {}
    support_note = payloads.get("support_note.json") if isinstance(payloads.get("support_note.json"), dict) else {}
    talk_history = payloads.get("talk_history.json") if isinstance(payloads.get("talk_history.json"), dict) else {}
    terms_history = payloads.get("terms_history.json") if isinstance(payloads.get("terms_history.json"), dict) else {}

    basic_info = _as_dict(account.get("Basic Information"))
    device_info = _as_dict(account.get("Device Information"))
    device_history = _as_list(account.get("Device History"))
    login_history = _sort_events_desc(_as_list(account.get("Login History")), "Created")

    app_profile = _as_dict(user_profile.get("App Profile"))
    engagement_rows = _as_list(user_profile.get("Engagement"))
    engagement_map = {
        str(row.get("Event") or "").strip(): int(row.get("Occurrences") or 0)
        for row in engagement_rows
        if isinstance(row, dict)
    }
    demographics = _as_dict(user_profile.get("Demographics"))
    interactions = _as_dict(user_profile.get("Interactions"))
    off_platform_sharing = _sort_events_desc(_as_list(user_profile.get("Off-Platform Sharing")), "Date")

    friends_list = _as_list(friends.get("Friends"))
    friends_summary = {
        "friends_count": len(friends_list),
        "friend_requests_sent_count": len(_as_list(friends.get("Friend Requests Sent"))),
        "blocked_count": len(_as_list(friends.get("Blocked Users"))),
        "deleted_count": len(_as_list(friends.get("Deleted Friends"))),
        "ignored_count": len(_as_list(friends.get("Ignored Snapchatters"))),
        "pending_count": len(_as_list(friends.get("Pending Requests"))),
        "top_friends": [
            {
                "username": _clean_string(friend.get("Username")),
                "display_name": _clean_string(friend.get("Display Name")),
                "added_at": _iso_or_none(_parse_datetime(friend.get("Creation Timestamp"))),
                "source": _clean_string(friend.get("Source")),
            }
            for friend in friends_list[:6]
            if isinstance(friend, dict)
        ],
    }

    bitmoji_basic = _as_dict(bitmoji.get("Basic Information"))
    bitmoji_analytics = _as_dict(bitmoji.get("Analytics"))
    ranking_stats = _as_dict(ranking.get("Statistics"))
    spotlight_rows = _as_list(ranking.get("Spotlight"))
    spotlight_tag_counts = spotlight_rows[1] if len(spotlight_rows) > 1 and isinstance(spotlight_rows[1], dict) else {}

    profile_section = _as_dict(snap_pro.get("Profile"))
    location_summary = build_location_summary(location_history, snap_map_places_history)
    connected_permissions = _sort_events_desc(_as_list(connected_apps.get("Permissions")), "Time")
    two_factor_events = _sort_events_desc(_as_list(account_history.get("Two-Factor Authentication")), "Date")
    display_name_changes = _sort_events_desc(_as_list(account_history.get("Display Name Change")), "Date")
    email_changes = _sort_events_desc(_as_list(account_history.get("Email Change")), "Date")
    mobile_number_changes = _sort_events_desc(_as_list(account_history.get("Mobile Number Change")), "Date")
    download_reports = _sort_events_desc(_as_list(account_history.get("Download My Data Reports")), "Date")
    terms_acceptances = _sort_events_desc(
        _as_list(terms_history.get("Terms of Service and Privacy Policy Acceptance History")),
        "Acceptance Date",
    )

    latest_login = login_history[0] if login_history else {}
    latest_share = off_platform_sharing[0] if off_platform_sharing else {}
    latest_terms_acceptance = terms_acceptances[0] if terms_acceptances else {}
    share_destinations = [
        destination
        for destination in (
            _clean_string(row.get("Share Destination"))
            for row in off_platform_sharing
            if isinstance(row, dict)
        )
        if destination
    ]
    unique_share_destinations = list(dict.fromkeys(share_destinations))
    spotlight_tags = [
        tag
        for tag, count in sorted(
            ((str(tag).strip(), _coerce_int(value)) for tag, value in spotlight_tag_counts.items()),
            key=lambda item: item[1],
            reverse=True,
        )
        if tag and count > 0
    ]
    subscriptions_summary = build_subscriptions_summary(snapchat_plus)
    communications_summary = build_communications_summary(talk_history, support_note)

    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "account": {
            "username": _clean_string(basic_info.get("Username")),
            "display_name": _clean_string(basic_info.get("Name")),
            "country": _clean_string(basic_info.get("Country") or app_profile.get("Country")),
            "created_at": _iso_or_none(
                _parse_datetime(app_profile.get("Creation Time"))
                or _parse_datetime(basic_info.get("Creation Date"))
            ),
            "account_creation_country": _clean_string(app_profile.get("Account Creation Country")),
            "in_app_language": _clean_string(app_profile.get("In-app Language")),
            "platform_version": _clean_string(app_profile.get("Platform Version")),
            "registration_ip": _clean_string(basic_info.get("Registration IP")),
        },
        "current_device": {
            "make": _clean_string(device_info.get("Make")),
            "model_name": _clean_string(device_info.get("Model Name") or device_info.get("Model ID")),
            "os_type": _clean_string(device_info.get("OS Type")),
            "language": _clean_string(device_info.get("Language")),
        },
        "device_history": [
            {
                "make": _clean_string(entry.get("Make")),
                "model": _clean_string(entry.get("Model")),
                "device_type": _clean_string(entry.get("Device Type")),
                "start_time": _iso_or_none(_parse_datetime(entry.get("Start Time"))),
            }
            for entry in device_history[:6]
            if isinstance(entry, dict)
        ],
        "ranking": {
            "snapscore": _coerce_int(ranking_stats.get("Snapscore")),
            "total_friends": _coerce_int(ranking_stats.get("Your Total Friends")),
            "accounts_followed": _coerce_int(ranking_stats.get("The Number of Accounts You Follow")),
            "spotlight_posts": _coerce_int(spotlight_rows[0]) if spotlight_rows else 0,
            "top_spotlight_tags": spotlight_tags[:8],
        },
        "friends": friends_summary,
        "bitmoji": {
            "email": _clean_string(bitmoji_basic.get("Email")),
            "phone_number": _clean_string(bitmoji_basic.get("Phone Number")),
            "account_created_at": _iso_or_none(_parse_datetime(bitmoji_basic.get("Account Creation Date"))),
            "avatar_gender": _clean_string(bitmoji_analytics.get("Avatar Gender")),
            "app_open_count": _coerce_int(bitmoji_analytics.get("App Open Count")),
            "outfit_save_count": _coerce_int(bitmoji_analytics.get("Outfit Save Count")),
            "share_count": _coerce_int(bitmoji_analytics.get("Share Count")),
        },
        "engagement": {
            "application_opens": engagement_map.get("Application Opens", 0),
            "story_views": engagement_map.get("Story Views", 0),
            "discover_channels_viewed_count": len(_as_list(user_profile.get("Discover Channels Viewed"))),
            "ads_interacted_count": len(_as_list(user_profile.get("Ads You Interacted With"))),
            "cohort_age": _clean_string(demographics.get("Cohort Age")),
            "derived_ad_demographic": _clean_string(demographics.get("Derived Ad Demographic")),
            "breakdown_of_time_spent": _compact_strings(_as_list(user_profile.get("Breakdown of Time Spent on App")), limit=6),
            "interest_categories": _compact_strings(_as_list(user_profile.get("Interest Categories")), limit=8),
            "content_categories": _compact_strings(_as_list(user_profile.get("Content Categories")), limit=8),
            "web_interactions": _compact_strings(_as_list(interactions.get("Web Interactions")), limit=6),
            "app_interactions": _compact_strings(_as_list(interactions.get("App Interactions")), limit=6),
            "off_platform_share_count": len(off_platform_sharing),
            "latest_off_platform_share_at": _iso_or_none(_parse_datetime(latest_share.get("Date"))),
            "share_destinations": unique_share_destinations[:6],
        },
        "security": {
            "login_count": len(login_history),
            "latest_login_at": _iso_or_none(_parse_datetime(latest_login.get("Created"))),
            "latest_login_country": _clean_string(latest_login.get("Country")),
            "latest_login_status": _clean_string(latest_login.get("Status")),
            "password_change_count": len(_as_list(account_history.get("Password Change"))),
            "connected_permissions_count": len(_as_list(connected_apps.get("Permissions"))),
            "latest_terms_acceptance_at": _iso_or_none(_parse_datetime(latest_terms_acceptance.get("Acceptance Date"))),
            "two_factor_events": [
                {
                    "date": _iso_or_none(_parse_datetime(event.get("Date"))),
                    "label": _clean_string(event.get("Event")),
                }
                for event in two_factor_events[:5]
                if isinstance(event, dict)
            ],
            "download_reports": [
                {
                    "date": _iso_or_none(_parse_datetime(report.get("Date"))),
                    "label": _clean_string(report.get("Status")),
                    "value": _clean_string(report.get("Email Address")),
                }
                for report in download_reports[:5]
                if isinstance(report, dict)
            ],
            "connected_apps": [
                {
                    "date": _iso_or_none(_parse_datetime(permission.get("Time"))),
                    "label": _clean_string(permission.get("App")),
                    "value": _clean_string(permission.get("Type")),
                }
                for permission in connected_permissions[:5]
                if isinstance(permission, dict)
            ],
            "terms_acceptances": [
                {
                    "date": _iso_or_none(_parse_datetime(acceptance.get("Acceptance Date"))),
                    "label": _clean_string(acceptance.get("Version")),
                }
                for acceptance in terms_acceptances[:5]
                if isinstance(acceptance, dict)
            ],
        },
        "subscriptions": subscriptions_summary,
        "communications": communications_summary,
        "history": {
            "display_name_changes": [
                {
                    "date": _iso_or_none(_parse_datetime(change.get("Date"))),
                    "value": _clean_string(change.get("Display Name")),
                }
                for change in display_name_changes[:5]
                if isinstance(change, dict)
            ],
            "email_changes": [
                {
                    "date": _iso_or_none(_parse_datetime(change.get("Date"))),
                    "value": _clean_string(change.get("Email Address")),
                }
                for change in email_changes[:5]
                if isinstance(change, dict)
            ],
            "mobile_number_changes": [
                {
                    "date": _iso_or_none(_parse_datetime(change.get("Date"))),
                    "value": _clean_string(change.get("Mobile Number")),
                }
                for change in mobile_number_changes[:5]
                if isinstance(change, dict)
            ],
        },
        "location": location_summary,
        "public_profile": {
            "created_at": _iso_or_none(_parse_datetime(profile_section.get("Created"))),
            "title": _clean_string(profile_section.get("Profile Title")),
            "location": _clean_string(profile_section.get("Location")),
            "website": _clean_string(profile_section.get("Profile Website")),
        },
    }


def build_subscriptions_summary(snapchat_plus: dict[str, Any]) -> dict[str, Any]:
    purchase_rows = _sort_events_desc(_flatten_purchase_rows(snapchat_plus), "Purchase Date")
    recent_purchases: list[dict[str, Any]] = []
    latest_purchase: dict[str, Any] | None = None

    for row in purchase_rows[:6]:
        purchase_date = _parse_datetime(row.get("Purchase Date"))
        ends_at = _parse_datetime(row.get("End Date (if applicable)"))
        normalized = {
            "purchase_date": _iso_or_none(purchase_date),
            "purchase_type": _clean_string(row.get("Purchase Type")),
            "provider": _clean_string(row.get("Purchase Provider")),
            "price": _coerce_float_or_none(row.get("Price")),
            "ends_at": _iso_or_none(ends_at),
            "is_active": bool(ends_at is None or ends_at >= datetime.now(UTC)),
        }
        recent_purchases.append(normalized)
        if latest_purchase is None:
            latest_purchase = normalized

    snapchat_plus_active = bool(latest_purchase and latest_purchase["is_active"])
    return {
        "snapchat_plus_active": snapchat_plus_active,
        "purchase_count": len(purchase_rows),
        "latest_purchase": latest_purchase,
        "recent_purchases": recent_purchases,
    }


def build_communications_summary(talk_history: dict[str, Any], support_note: dict[str, Any]) -> dict[str, Any]:
    outgoing_calls = _as_list(talk_history.get("Outgoing Calls"))
    incoming_calls = _as_list(talk_history.get("Incoming Calls"))
    completed_calls = _as_list(talk_history.get("Completed Calls"))

    recent_calls = sorted(
        [
            *_normalize_call_rows(outgoing_calls, direction="outgoing"),
            *_normalize_call_rows(incoming_calls, direction="incoming"),
            *_normalize_call_rows(completed_calls, direction="completed"),
        ],
        key=lambda row: _parse_datetime(row.get("date")) or datetime.min.replace(tzinfo=UTC),
        reverse=True,
    )
    support_notes = sorted(
        [
            *_normalize_support_rows(_as_list(support_note.get("Support Site"))),
            *_normalize_support_rows(_as_list(support_note.get("In-app Report"))),
            *_normalize_support_rows(_as_list(support_note.get("Shake to Report"))),
        ],
        key=lambda row: _parse_datetime(row.get("date")) or datetime.min.replace(tzinfo=UTC),
        reverse=True,
    )
    latest_call = recent_calls[0] if recent_calls else {}

    return {
        "outgoing_calls_count": len([row for row in outgoing_calls if isinstance(row, dict)]),
        "incoming_calls_count": len([row for row in incoming_calls if isinstance(row, dict)]),
        "completed_calls_count": len([row for row in completed_calls if isinstance(row, dict)]),
        "latest_call_at": _clean_string(latest_call.get("date")),
        "recent_calls": recent_calls[:10],
        "support_notes": support_notes[:6],
    }


def build_location_summary(location_history: dict[str, Any], snap_map_places_history: dict[str, Any]) -> dict[str, Any]:
    latest_location_rows = [row for row in _as_list(location_history.get("Latest Location")) if isinstance(row, dict)]
    frequent_location_rows = [row for row in _as_list(location_history.get("Frequent Locations")) if isinstance(row, dict)]
    raw_location_rows = [row for row in _as_list(location_history.get("Location History")) if isinstance(row, list) and len(row) >= 2]
    home_school_work = _as_dict(location_history.get("Home, School & Work"))
    visited_places = _as_dict(location_history.get("Businesses and places you may have visited"))
    inferred_visits = [
        {
            "name": _clean_string(entry[0]) if len(entry) > 0 else None,
            "location": _clean_string(entry[1]) if len(entry) > 1 else None,
            "date": None,
            "share_type": None,
        }
        for entry in _as_list(visited_places.get("inferredVisitationList"))
        if isinstance(entry, list)
    ]
    business_visits = [
        {
            "name": _clean_string(entry[1]) if len(entry) > 1 else None,
            "location": None,
            "date": _clean_string(entry[0]) if len(entry) > 0 else None,
            "share_type": None,
        }
        for entry in _as_list(visited_places.get("businessList"))
        if isinstance(entry, list)
    ]
    snap_map_places = [
        {
            "name": _clean_string(entry.get("Place")),
            "location": _clean_string(entry.get("Place Location")),
            "date": _clean_string(entry.get("Date")),
            "share_type": _clean_string(entry.get("Share Type")),
        }
        for entry in _as_list(snap_map_places_history.get("Snap Map Places History"))
        if isinstance(entry, dict)
    ]

    latest_location = latest_location_rows[0] if latest_location_rows else {}
    frequent_regions = [
        region
        for region in (_clean_string(row.get("Region")) for row in frequent_location_rows)
        if region
    ]
    unique_frequent_regions = list(dict.fromkeys(frequent_regions))

    latest_history_entry = raw_location_rows[-1] if raw_location_rows else None

    return {
        "latest_region": _clean_string(latest_location.get("Region")),
        "latest_city": _clean_string(latest_location.get("City")),
        "latest_country": _clean_string(latest_location.get("Country")),
        "frequent_regions": unique_frequent_regions[:6],
        "raw_location_count": len(raw_location_rows),
        "latest_coordinate_at": _iso_or_none(_parse_datetime(latest_history_entry[0])) if latest_history_entry else None,
        "latest_coordinate": _clean_string(latest_history_entry[1]) if latest_history_entry else None,
        "inferred_home": _clean_string(home_school_work.get("inferredHome")),
        "inferred_work": _clean_string(home_school_work.get("inferredWork")),
        "declared_home": _clean_string(home_school_work.get("userProvidedHome")),
        "school_name": _clean_string(home_school_work.get("schoolName")),
        "visited_places": inferred_visits[:12],
        "business_visits": business_visits[:12],
        "snap_map_places": snap_map_places[:12],
    }


def _resolve_job_roots(service: IngestionService, job: IngestionJob) -> list[Path]:
    workspace_path = Path(job.workspace_path) if job.workspace_path else None
    if workspace_path and workspace_path.exists():
        parts_root = workspace_path / "_parts"
        if parts_root.exists() and parts_root.is_dir():
            return [service.find_snap_root(path) for path in sorted(parts_root.iterdir()) if path.is_dir()]
        return [service.find_snap_root(workspace_path)]

    source_path = Path(job.source_path)
    if source_path.exists() and source_path.is_dir() and job.source_kind == IngestionSourceKind.DIRECTORY:
        return [service.find_snap_root(source_path)]

    return []


def _root_contains_profile_json(root: Path) -> bool:
    json_dir = root / "json"
    return any((json_dir / filename).exists() for filename in PROFILE_JSON_FILES)


def _flatten_purchase_rows(payload: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for value in payload.values():
        if isinstance(value, list):
            rows.extend(entry for entry in value if isinstance(entry, dict))
    return rows


def _normalize_call_rows(rows: list[Any], *, direction: str) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        normalized.append(
            {
                "date": _iso_or_none(_parse_datetime(row.get("Date & Time"))),
                "direction": direction,
                "call_type": _clean_string(row.get("Type")),
                "participants": _coerce_int_or_none(row.get("People in Chat")),
                "result": _clean_string(row.get("Result")),
                "city": _clean_string(row.get("City")),
                "country": _clean_string(row.get("Country")),
                "duration_seconds": _coerce_int_or_none(row.get("Length (sec)")),
                "network": _clean_string(row.get("Network")),
            }
        )
    return normalized


def _normalize_support_rows(rows: list[Any]) -> list[dict[str, Any]]:
    return [
        {
            "date": _iso_or_none(_parse_datetime(row.get("Create Time"))),
            "subject": _clean_string(row.get("Subject")),
            "message": _clean_string(row.get("Message")),
        }
        for row in rows
        if isinstance(row, dict)
    ]


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _clean_string(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _parse_datetime(value: Any) -> datetime | None:
    return IngestionService.parse_datetime(value)


def _iso_or_none(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None


def _coerce_int(value: Any) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        try:
            return int(float(value or 0))
        except (TypeError, ValueError):
            return 0


def _coerce_int_or_none(value: Any) -> int | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return None


def _coerce_float_or_none(value: Any) -> float | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        match = DURATION_SECONDS_PATTERN.search(str(value))
        if not match:
            return None
        try:
            return float(match.group("seconds"))
        except (TypeError, ValueError):
            return None


def _compact_strings(values: list[Any], *, limit: int) -> list[str]:
    compacted: list[str] = []
    for value in values:
        text = _clean_string(value)
        if text:
            compacted.append(text)
        if len(compacted) >= limit:
            break
    return compacted


def _sort_events_desc(rows: list[Any], key: str) -> list[dict[str, Any]]:
    normalized = [row for row in rows if isinstance(row, dict)]
    return sorted(
        normalized,
        key=lambda row: _parse_datetime(row.get(key)) or datetime.min.replace(tzinfo=UTC),
        reverse=True,
    )
