from snapcapsule_core.config import Settings
from snapcapsule_core.services.settings_store import SettingsStore


def test_settings_store_normalizes_string_booleans(tmp_path):
    settings = Settings(ingest_root_dir=str(tmp_path))
    store = SettingsStore(settings)
    settings.preferences_file_path.write_text(
        """
        {
          "dark_mode": "false",
          "autoplay_videos_in_grid": "true",
          "show_memory_overlays": "0",
          "default_grid_size": "LARGE",
          "enable_debug_logging": "yes"
        }
        """.strip(),
        encoding="utf-8",
    )

    stored = store.load()

    assert stored.dark_mode is False
    assert stored.autoplay_videos_in_grid is True
    assert stored.show_memory_overlays is False
    assert stored.default_grid_size == "large"
    assert stored.enable_debug_logging is True
