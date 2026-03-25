from snapcapsule_core.config import Settings
from snapcapsule_core.services.settings_store import SettingsStore


def test_settings_store_normalizes_string_booleans(tmp_path):
    settings = Settings(ingest_root_dir=str(tmp_path), _env_file=None)
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


def test_settings_uses_explicit_library_and_cache_dirs(tmp_path):
    cache_dir = tmp_path / "cache"
    library_dir = tmp_path / "library"
    settings = Settings(
        ingest_cache_dir=str(cache_dir),
        library_archives_dir=str(library_dir),
        _env_file=None,
    )

    assert settings.ingest_cache_root_dir == cache_dir
    assert settings.ingest_upload_dir == cache_dir / "uploads"
    assert settings.ingest_workspace_dir == cache_dir / "workspaces"
    assert settings.preferences_file_path == cache_dir / "user-preferences.json"
    assert settings.profile_snapshot_path == cache_dir / "profile-snapshot.json"
    assert settings.ingest_archive_dir == library_dir


def test_settings_falls_back_to_legacy_ingest_root_dir(tmp_path):
    legacy_root = tmp_path / "legacy-ingest"
    settings = Settings(ingest_root_dir=str(legacy_root), _env_file=None)

    assert settings.ingest_cache_root_dir == legacy_root
    assert settings.ingest_upload_dir == legacy_root / "uploads"
    assert settings.ingest_workspace_dir == legacy_root / "workspaces"
    assert settings.ingest_archive_dir == legacy_root / "archives"
