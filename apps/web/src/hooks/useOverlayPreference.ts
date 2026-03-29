import { resolveAppSettings, useSettings } from "./useSettings";

export function useShowMemoryOverlays() {
  const settingsQuery = useSettings();
  return resolveAppSettings(settingsQuery.data).show_memory_overlays;
}
