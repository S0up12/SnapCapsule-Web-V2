import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type GridSize = "small" | "medium" | "large";
export type VideoPreviewHoverDelay = "off" | "0.6s" | "1.2s" | "2s";
export type TimelineDefaultSort = "newest" | "oldest";
export type TimelineDefaultFilter = "all" | "photos" | "videos" | "favorites";
export type TimelineDateGrouping = "year" | "month" | "day";

export type AppSettings = {
  dark_mode: boolean;
  prefer_browser_playback: boolean;
  autoplay_videos_in_grid: boolean;
  mute_video_previews: boolean;
  loop_video_previews: boolean;
  video_preview_hover_delay: VideoPreviewHoverDelay;
  autoplay_videos_in_lightbox: boolean;
  show_memory_overlays: boolean;
  default_grid_size: GridSize;
  timeline_default_sort: TimelineDefaultSort;
  timeline_default_filter: TimelineDefaultFilter;
  timeline_date_grouping: TimelineDateGrouping;
  remember_last_timeline_filters: boolean;
  show_undated_assets: boolean;
  show_stories_workspace: boolean;
  show_story_activity: boolean;
  show_snapchat_plus_profile_card: boolean;
  blur_private_names: boolean;
  hide_exact_timestamps: boolean;
  demo_safe_mode: boolean;
  enable_debug_logging: boolean;
  storage: {
    raw_media_dir: string;
    thumbnail_dir: string;
  };
};

export type AppSettingsUpdate = Partial<
  Pick<
    AppSettings,
    | "dark_mode"
    | "prefer_browser_playback"
    | "autoplay_videos_in_grid"
    | "mute_video_previews"
    | "loop_video_previews"
    | "video_preview_hover_delay"
    | "autoplay_videos_in_lightbox"
    | "show_memory_overlays"
    | "default_grid_size"
    | "timeline_default_sort"
    | "timeline_default_filter"
    | "timeline_date_grouping"
    | "remember_last_timeline_filters"
    | "show_undated_assets"
    | "show_stories_workspace"
    | "show_story_activity"
    | "show_snapchat_plus_profile_card"
    | "blur_private_names"
    | "hide_exact_timestamps"
    | "demo_safe_mode"
    | "enable_debug_logging"
  >
>;

const DARK_MODE_STORAGE_KEY = "snapcapsule:dark-mode";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  dark_mode: true,
  prefer_browser_playback: true,
  autoplay_videos_in_grid: false,
  mute_video_previews: true,
  loop_video_previews: true,
  video_preview_hover_delay: "1.2s",
  autoplay_videos_in_lightbox: true,
  show_memory_overlays: true,
  default_grid_size: "medium",
  timeline_default_sort: "newest",
  timeline_default_filter: "all",
  timeline_date_grouping: "year",
  remember_last_timeline_filters: false,
  show_undated_assets: true,
  show_stories_workspace: true,
  show_story_activity: true,
  show_snapchat_plus_profile_card: true,
  blur_private_names: false,
  hide_exact_timestamps: false,
  demo_safe_mode: false,
  enable_debug_logging: false,
  storage: {
    raw_media_dir: "",
    thumbnail_dir: "",
  },
};

function persistDarkMode(settings: Pick<AppSettings, "dark_mode">) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(DARK_MODE_STORAGE_KEY, String(settings.dark_mode));
}

export function resolveAppSettings(settings: AppSettings | undefined | null): AppSettings {
  if (!settings) {
    return DEFAULT_APP_SETTINGS;
  }

  return {
    ...DEFAULT_APP_SETTINGS,
    ...settings,
    storage: {
      ...DEFAULT_APP_SETTINGS.storage,
      ...settings.storage,
    },
  };
}

async function fetchSettings(): Promise<AppSettings> {
  const response = await fetch("/api/settings");
  if (!response.ok) {
    throw new Error(`Settings request failed with ${response.status}`);
  }

  const settings = (await response.json()) as AppSettings;
  persistDarkMode(settings);
  return settings;
}

async function saveSettings(payload: AppSettingsUpdate): Promise<AppSettings> {
  const response = await fetch("/api/settings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Settings save failed with ${response.status}`);
  }

  return (await response.json()) as AppSettings;
}

export function useSettings() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(["settings"], data);
      persistDarkMode(data);
    },
  });

  return {
    ...query,
    saveSettings: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}
