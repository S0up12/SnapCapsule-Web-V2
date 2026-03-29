import { resolveAppSettings, useSettings } from "./useSettings";

export function usePrivacyPreferences() {
  const settingsQuery = useSettings();
  const settings = resolveAppSettings(settingsQuery.data);

  return {
    blurPrivateNames: settings.demo_safe_mode || settings.blur_private_names,
    hideExactTimestamps: settings.demo_safe_mode || settings.hide_exact_timestamps,
    hideLocationDetails: settings.demo_safe_mode || settings.hide_location_details,
    demoSafeMode: settings.demo_safe_mode,
  };
}
