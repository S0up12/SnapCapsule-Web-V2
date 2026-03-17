from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from snapcapsule_core.config import Settings

LOGGER_NAMES = [
    "apps.api",
    "snapcapsule_core",
]

DEFAULT_PREFERENCES: dict[str, Any] = {
    "dark_mode": True,
    "autoplay_videos_in_grid": False,
    "default_grid_size": "medium",
    "enable_debug_logging": False,
}

VALID_GRID_SIZES = {"small", "medium", "large"}


@dataclass(slots=True)
class StoredPreferences:
    dark_mode: bool
    autoplay_videos_in_grid: bool
    default_grid_size: str
    enable_debug_logging: bool

    def to_dict(self) -> dict[str, Any]:
        return {
            "dark_mode": self.dark_mode,
            "autoplay_videos_in_grid": self.autoplay_videos_in_grid,
            "default_grid_size": self.default_grid_size,
            "enable_debug_logging": self.enable_debug_logging,
        }


def configure_debug_logging(enabled: bool) -> None:
    level = logging.DEBUG if enabled else logging.INFO
    logging.getLogger().setLevel(level)
    for name in LOGGER_NAMES:
        logging.getLogger(name).setLevel(level)


class SettingsStore:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.path = Path(settings.preferences_file_path)

    def load(self) -> StoredPreferences:
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

    def save(self, updates: dict[str, Any]) -> StoredPreferences:
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

        return StoredPreferences(
            dark_mode=bool(payload.get("dark_mode", DEFAULT_PREFERENCES["dark_mode"])),
            autoplay_videos_in_grid=bool(
                payload.get("autoplay_videos_in_grid", DEFAULT_PREFERENCES["autoplay_videos_in_grid"])
            ),
            default_grid_size=grid_size,
            enable_debug_logging=bool(
                payload.get("enable_debug_logging", DEFAULT_PREFERENCES["enable_debug_logging"])
            ),
        )
