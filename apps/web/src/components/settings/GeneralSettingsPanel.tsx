import { LayoutGrid } from "lucide-react";

import PopoverSelect from "../controls/PopoverSelect";
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
      <SettingsCard title="Interface">
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
          title="Preview Videos in Grid"
          description="Start muted video previews after hovering over a video tile for a moment."
        >
          <ToggleSwitch
            label="Preview Videos in Grid"
            checked={settings.autoplay_videos_in_grid}
            disabled={isSaving}
            onCheckedChange={(checked) => void onUpdate({ autoplay_videos_in_grid: checked })}
          />
        </SettingRow>

        <SettingRow
          title="Show Memory Overlays"
          description="Display Snapchat overlay edits in memory thumbnails and the full-screen viewer."
        >
          <ToggleSwitch
            label="Show Memory Overlays"
            checked={settings.show_memory_overlays}
            disabled={isSaving}
            onCheckedChange={(checked) => void onUpdate({ show_memory_overlays: checked })}
          />
        </SettingRow>

        <SettingRow
          title="Default Grid Size"
          description="Choose the thumbnail density you want the memories grid to prefer."
        >
          <PopoverSelect
            label="Default Grid Size"
            icon={LayoutGrid}
            value={settings.default_grid_size}
            disabled={isSaving}
            onChange={(value) => void onUpdate({ default_grid_size: value as AppSettings["default_grid_size"] })}
            options={[...GRID_SIZE_OPTIONS]}
          />
        </SettingRow>
      </SettingsCard>
    </div>
  );
}
