from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from snapcapsule_core.config import Settings

LOGGER_NAMES = [
    "apps.api",
    "snapcapsule_core",
]

DEFAULT_PREFERENCES: dict[str, Any] = {
    "dark_mode": True,
    "prefer_browser_playback": True,
    "autoplay_videos_in_grid": False,
    "mute_video_previews": True,
    "loop_video_previews": True,
    "video_preview_hover_delay": "1.2s",
    "autoplay_videos_in_lightbox": True,
    "show_memory_overlays": True,
    "default_grid_size": "medium",
    "timeline_default_sort": "newest",
    "timeline_default_filter": "all",
    "timeline_date_grouping": "year",
    "timeline_page_size": 100,
    "remember_last_timeline_filters": False,
    "show_undated_assets": True,
    "show_stories_workspace": True,
    "show_story_activity": True,
    "show_snapchat_plus_profile_card": True,
    "blur_private_names": False,
    "hide_exact_timestamps": False,
    "hide_location_details": False,
    "demo_safe_mode": False,
    "enable_debug_logging": False,
}

VALID_GRID_SIZES = {"small", "medium", "large"}
VALID_VIDEO_PREVIEW_HOVER_DELAYS = {"off", "0.6s", "1.2s", "2s"}
VALID_TIMELINE_DEFAULT_SORTS = {"newest", "oldest"}
VALID_TIMELINE_DEFAULT_FILTERS = {"all", "photos", "videos", "favorites"}
VALID_TIMELINE_DATE_GROUPINGS = {"year", "month", "day"}
VALID_TIMELINE_PAGE_SIZES = {50, 100, 150, 200}
TRUE_VALUES = {"1", "true", "yes", "on"}
FALSE_VALUES = {"0", "false", "no", "off", ""}


@dataclass(slots=True)
class StoredPreferences:
    dark_mode: bool
    prefer_browser_playback: bool
    autoplay_videos_in_grid: bool
    mute_video_previews: bool
    loop_video_previews: bool
    video_preview_hover_delay: str
    autoplay_videos_in_lightbox: bool
    show_memory_overlays: bool
    default_grid_size: str
    timeline_default_sort: str
    timeline_default_filter: str
    timeline_date_grouping: str
    timeline_page_size: int
    remember_last_timeline_filters: bool
    show_undated_assets: bool
    show_stories_workspace: bool
    show_story_activity: bool
    show_snapchat_plus_profile_card: bool
    blur_private_names: bool
    hide_exact_timestamps: bool
    hide_location_details: bool
    demo_safe_mode: bool
    enable_debug_logging: bool

    def to_dict(self) -> dict[str, Any]:
        return {
            "dark_mode": self.dark_mode,
            "prefer_browser_playback": self.prefer_browser_playback,
            "autoplay_videos_in_grid": self.autoplay_videos_in_grid,
            "mute_video_previews": self.mute_video_previews,
            "loop_video_previews": self.loop_video_previews,
            "video_preview_hover_delay": self.video_preview_hover_delay,
            "autoplay_videos_in_lightbox": self.autoplay_videos_in_lightbox,
            "show_memory_overlays": self.show_memory_overlays,
            "default_grid_size": self.default_grid_size,
            "timeline_default_sort": self.timeline_default_sort,
            "timeline_default_filter": self.timeline_default_filter,
            "timeline_date_grouping": self.timeline_date_grouping,
            "timeline_page_size": self.timeline_page_size,
            "remember_last_timeline_filters": self.remember_last_timeline_filters,
            "show_undated_assets": self.show_undated_assets,
            "show_stories_workspace": self.show_stories_workspace,
            "show_story_activity": self.show_story_activity,
            "show_snapchat_plus_profile_card": self.show_snapchat_plus_profile_card,
            "blur_private_names": self.blur_private_names,
            "hide_exact_timestamps": self.hide_exact_timestamps,
            "hide_location_details": self.hide_location_details,
            "demo_safe_mode": self.demo_safe_mode,
            "enable_debug_logging": self.enable_debug_logging,
        }


class SettingsRepository(Protocol):
    def load(self, account_id: str | None = None) -> StoredPreferences: ...

    def save(self, updates: dict[str, Any], account_id: str | None = None) -> StoredPreferences: ...


def configure_debug_logging(enabled: bool) -> None:
    level = logging.DEBUG if enabled else logging.INFO
    logging.getLogger().setLevel(level)
    for name in LOGGER_NAMES:
        logging.getLogger(name).setLevel(level)


class SettingsStore:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.path = Path(settings.preferences_file_path)

    def load(self, account_id: str | None = None) -> StoredPreferences:
        payload = dict(DEFAULT_PREFERENCES)
        if self.path.exists():
            try:
                raw_payload = json.loads(self.path.read_text(encoding="utf-8"))
                if isinstance(raw_payload, dict):
                    payload.update(raw_payload)
            except (json.JSONDecodeError, OSError):
                pass

        preferences = self._normalize(payload)
        configure_debug_logging(preferences.enable_debug_logging)
        return preferences

    def save(self, updates: dict[str, Any], account_id: str | None = None) -> StoredPreferences:
        current = self.load().to_dict()
        current.update(updates)
        preferences = self._normalize(current)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(preferences.to_dict(), indent=2), encoding="utf-8")
        configure_debug_logging(preferences.enable_debug_logging)
        return preferences

    def _normalize(self, payload: dict[str, Any]) -> StoredPreferences:
        grid_size = str(payload.get("default_grid_size", DEFAULT_PREFERENCES["default_grid_size"])).lower().strip()
        if grid_size not in VALID_GRID_SIZES:
            grid_size = "medium"

        preview_hover_delay = str(
            payload.get("video_preview_hover_delay", DEFAULT_PREFERENCES["video_preview_hover_delay"])
        ).lower().strip()
        if preview_hover_delay not in VALID_VIDEO_PREVIEW_HOVER_DELAYS:
            preview_hover_delay = "1.2s"

        timeline_default_sort = str(
            payload.get("timeline_default_sort", DEFAULT_PREFERENCES["timeline_default_sort"])
        ).lower().strip()
        if timeline_default_sort not in VALID_TIMELINE_DEFAULT_SORTS:
            timeline_default_sort = "newest"

        timeline_default_filter = str(
            payload.get("timeline_default_filter", DEFAULT_PREFERENCES["timeline_default_filter"])
        ).lower().strip()
        if timeline_default_filter not in VALID_TIMELINE_DEFAULT_FILTERS:
            timeline_default_filter = "all"

        timeline_date_grouping = str(
            payload.get("timeline_date_grouping", DEFAULT_PREFERENCES["timeline_date_grouping"])
        ).lower().strip()
        if timeline_date_grouping not in VALID_TIMELINE_DATE_GROUPINGS:
            timeline_date_grouping = "year"

        timeline_page_size = payload.get("timeline_page_size", DEFAULT_PREFERENCES["timeline_page_size"])
        try:
            timeline_page_size = int(timeline_page_size)
        except (TypeError, ValueError):
            timeline_page_size = 100
        if timeline_page_size not in VALID_TIMELINE_PAGE_SIZES:
            timeline_page_size = 100

        return StoredPreferences(
            dark_mode=_coerce_bool(payload.get("dark_mode", DEFAULT_PREFERENCES["dark_mode"])),
            prefer_browser_playback=_coerce_bool(
                payload.get("prefer_browser_playback", DEFAULT_PREFERENCES["prefer_browser_playback"])
            ),
            autoplay_videos_in_grid=_coerce_bool(
                payload.get("autoplay_videos_in_grid", DEFAULT_PREFERENCES["autoplay_videos_in_grid"])
            ),
            mute_video_previews=_coerce_bool(
                payload.get("mute_video_previews", DEFAULT_PREFERENCES["mute_video_previews"])
            ),
            loop_video_previews=_coerce_bool(
                payload.get("loop_video_previews", DEFAULT_PREFERENCES["loop_video_previews"])
            ),
            video_preview_hover_delay=preview_hover_delay,
            autoplay_videos_in_lightbox=_coerce_bool(
                payload.get("autoplay_videos_in_lightbox", DEFAULT_PREFERENCES["autoplay_videos_in_lightbox"])
            ),
            show_memory_overlays=_coerce_bool(
                payload.get("show_memory_overlays", DEFAULT_PREFERENCES["show_memory_overlays"])
            ),
            default_grid_size=grid_size,
            timeline_default_sort=timeline_default_sort,
            timeline_default_filter=timeline_default_filter,
            timeline_date_grouping=timeline_date_grouping,
            timeline_page_size=timeline_page_size,
            remember_last_timeline_filters=_coerce_bool(
                payload.get(
                    "remember_last_timeline_filters",
                    DEFAULT_PREFERENCES["remember_last_timeline_filters"],
                )
            ),
            show_undated_assets=_coerce_bool(
                payload.get("show_undated_assets", DEFAULT_PREFERENCES["show_undated_assets"])
            ),
            show_stories_workspace=_coerce_bool(
                payload.get("show_stories_workspace", DEFAULT_PREFERENCES["show_stories_workspace"])
            ),
            show_story_activity=_coerce_bool(
                payload.get("show_story_activity", DEFAULT_PREFERENCES["show_story_activity"])
            ),
            show_snapchat_plus_profile_card=_coerce_bool(
                payload.get(
                    "show_snapchat_plus_profile_card",
                    DEFAULT_PREFERENCES["show_snapchat_plus_profile_card"],
                )
            ),
            blur_private_names=_coerce_bool(
                payload.get("blur_private_names", DEFAULT_PREFERENCES["blur_private_names"])
            ),
            hide_exact_timestamps=_coerce_bool(
                payload.get("hide_exact_timestamps", DEFAULT_PREFERENCES["hide_exact_timestamps"])
            ),
            hide_location_details=_coerce_bool(
                payload.get("hide_location_details", DEFAULT_PREFERENCES["hide_location_details"])
            ),
            demo_safe_mode=_coerce_bool(
                payload.get("demo_safe_mode", DEFAULT_PREFERENCES["demo_safe_mode"])
            ),
            enable_debug_logging=_coerce_bool(
                payload.get("enable_debug_logging", DEFAULT_PREFERENCES["enable_debug_logging"])
            ),
        )


class SettingsService:
    def __init__(self, repository: SettingsRepository) -> None:
        self.repository = repository

    def load(self, account_id: str | None = None) -> StoredPreferences:
        return self.repository.load(account_id=account_id)

    def save(self, updates: dict[str, Any], account_id: str | None = None) -> StoredPreferences:
        return self.repository.save(updates, account_id=account_id)


def _coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in TRUE_VALUES:
            return True
        if normalized in FALSE_VALUES:
            return False
    return bool(value)
