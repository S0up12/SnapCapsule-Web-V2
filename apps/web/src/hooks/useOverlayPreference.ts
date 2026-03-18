import { useSettings } from "./useSettings";

const SHOW_MEMORY_OVERLAYS_STORAGE_KEY = "snapcapsule:show-memory-overlays";

function getStoredOverlayPreference() {
  if (typeof window === "undefined") {
    return true;
  }
  return window.localStorage.getItem(SHOW_MEMORY_OVERLAYS_STORAGE_KEY) !== "false";
}

export function useShowMemoryOverlays() {
  const settingsQuery = useSettings();
  return settingsQuery.data?.show_memory_overlays ?? getStoredOverlayPreference();
}
