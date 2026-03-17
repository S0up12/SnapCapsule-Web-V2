import SettingsCard from "./SettingsCard";
import SettingRow from "./SettingRow";
import ToggleSwitch from "./ToggleSwitch";
import type { AppSettings, AppSettingsUpdate } from "../../hooks/useSettings";

type GeneralSettingsPanelProps = {
  settings: AppSettings;
  isSaving: boolean;
  onUpdate: (updates: AppSettingsUpdate) => Promise<void>;
};

const GRID_SIZE_OPTIONS = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
] as const;

export default function GeneralSettingsPanel({ settings, isSaving, onUpdate }: GeneralSettingsPanelProps) {
  return (
    <div className="grid gap-6">
      <SettingsCard
        eyebrow="General"
        title="Interface preferences"
        description="Control how SnapCapsule feels while you browse, scroll, and review media."
      >
        <SettingRow
          title="Dark Mode"
          description="Use the darker shell theme while working in the archive."
        >
          <ToggleSwitch
            label="Dark Mode"
            checked={settings.dark_mode}
            disabled={isSaving}
            onCheckedChange={(checked) => void onUpdate({ dark_mode: checked })}
          />
        </SettingRow>

        <SettingRow
          title="Autoplay Videos in Grid"
          description="Automatically begin muted playback for video tiles when supported by the gallery."
        >
          <ToggleSwitch
            label="Autoplay Videos in Grid"
            checked={settings.autoplay_videos_in_grid}
            disabled={isSaving}
            onCheckedChange={(checked) => void onUpdate({ autoplay_videos_in_grid: checked })}
          />
        </SettingRow>

        <SettingRow
          title="Default Grid Size"
          description="Choose the thumbnail density you want the memories grid to prefer."
        >
          <select
            value={settings.default_grid_size}
            disabled={isSaving}
            onChange={(event) =>
              void onUpdate({ default_grid_size: event.target.value as AppSettings["default_grid_size"] })
            }
            className="min-w-[11rem] rounded-[0.95rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-sky-400 focus:outline-none dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-100"
          >
            {GRID_SIZE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </SettingRow>
      </SettingsCard>
    </div>
  );
}
