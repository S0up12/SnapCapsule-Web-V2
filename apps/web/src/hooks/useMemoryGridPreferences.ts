import { useSettings, type AppSettings } from "./useSettings";

const AUTOPLAY_VIDEOS_IN_GRID_STORAGE_KEY = "snapcapsule:autoplay-videos-in-grid";
const DEFAULT_GRID_SIZE_STORAGE_KEY = "snapcapsule:default-grid-size";

function getStoredAutoplayPreference() {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(AUTOPLAY_VIDEOS_IN_GRID_STORAGE_KEY) === "true";
}

function getStoredGridSizePreference(): AppSettings["default_grid_size"] {
  if (typeof window === "undefined") {
    return "medium";
  }

  const value = window.localStorage.getItem(DEFAULT_GRID_SIZE_STORAGE_KEY);
  if (value === "small" || value === "medium" || value === "large") {
    return value;
  }
  return "medium";
}

export function useMemoryGridPreferences() {
  const settingsQuery = useSettings();

  return {
    autoplayVideosInGrid: settingsQuery.data?.autoplay_videos_in_grid ?? getStoredAutoplayPreference(),
    defaultGridSize: settingsQuery.data?.default_grid_size ?? getStoredGridSizePreference(),
  };
}
