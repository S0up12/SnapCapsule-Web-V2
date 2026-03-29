from snapcapsule_core.config import Settings
from snapcapsule_core.services.settings_store import SettingsStore


def test_settings_store_normalizes_string_booleans(tmp_path):
    settings = Settings(ingest_root_dir=str(tmp_path))
    store = SettingsStore(settings)
    settings.preferences_file_path.write_text(
        """
        {
          "dark_mode": "false",
          "prefer_browser_playback": "yes",
          "autoplay_videos_in_grid": "true",
          "mute_video_previews": "false",
          "loop_video_previews": "1",
          "video_preview_hover_delay": "2S",
          "autoplay_videos_in_lightbox": "off",
          "show_memory_overlays": "0",
          "default_grid_size": "LARGE",
          "timeline_default_sort": "OLDEST",
          "timeline_default_filter": "VIDEOS",
          "timeline_date_grouping": "MONTH",
          "remember_last_timeline_filters": "yes",
          "show_undated_assets": "false",
          "show_stories_workspace": "yes",
          "show_story_activity": "false",
          "show_snapchat_plus_profile_card": "1",
          "blur_private_names": "true",
          "hide_exact_timestamps": "yes",
          "demo_safe_mode": "0",
          "enable_debug_logging": "yes"
        }
        """.strip(),
        encoding="utf-8",
    )

    stored = store.load()

    assert stored.dark_mode is False
    assert stored.prefer_browser_playback is True
    assert stored.autoplay_videos_in_grid is True
    assert stored.mute_video_previews is False
    assert stored.loop_video_previews is True
    assert stored.video_preview_hover_delay == "2s"
    assert stored.autoplay_videos_in_lightbox is False
    assert stored.show_memory_overlays is False
    assert stored.default_grid_size == "large"
    assert stored.timeline_default_sort == "oldest"
    assert stored.timeline_default_filter == "videos"
    assert stored.timeline_date_grouping == "month"
    assert stored.remember_last_timeline_filters is True
    assert stored.show_undated_assets is False
    assert stored.show_stories_workspace is True
    assert stored.show_story_activity is False
    assert stored.show_snapchat_plus_profile_card is True
    assert stored.blur_private_names is True
    assert stored.hide_exact_timestamps is True
    assert stored.demo_safe_mode is False
    assert stored.enable_debug_logging is True
