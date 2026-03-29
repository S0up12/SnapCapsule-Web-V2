import { resolveAppSettings, useSettings } from "./useSettings";

export function useMemoryGridPreferences() {
  const settingsQuery = useSettings();
  const settings = resolveAppSettings(settingsQuery.data);

  return {
    autoplayVideosInGrid: settings.autoplay_videos_in_grid,
    defaultGridSize: settings.default_grid_size,
    preferBrowserPlayback: settings.prefer_browser_playback,
    muteVideoPreviews: settings.mute_video_previews,
    loopVideoPreviews: settings.loop_video_previews,
    videoPreviewHoverDelay: settings.video_preview_hover_delay,
    autoplayVideosInLightbox: settings.autoplay_videos_in_lightbox,
    timelineDefaultSort: settings.timeline_default_sort,
    timelineDefaultFilter: settings.timeline_default_filter,
    timelineDateGrouping: settings.timeline_date_grouping,
    rememberLastTimelineFilters: settings.remember_last_timeline_filters,
    showUndatedAssets: settings.show_undated_assets,
    saveSettings: settingsQuery.saveSettings,
    isLoading: settingsQuery.isLoading,
  };
}
