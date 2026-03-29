import SettingsCard from "./SettingsCard";
import SettingRow from "./SettingRow";
import ToggleSwitch from "./ToggleSwitch";
import type { AppSettings, AppSettingsUpdate } from "../../hooks/useSettings";

type AdvancedSettingsPanelProps = {
  settings: AppSettings;
  isSaving: boolean;
  onUpdate: (updates: AppSettingsUpdate) => Promise<void>;
};

export default function AdvancedSettingsPanel({ settings, isSaving, onUpdate }: AdvancedSettingsPanelProps) {
  return (
    <div className="grid gap-6">
      <SettingsCard
        eyebrow="Advanced"
        title="App And Workspace"
        description="Developer-facing controls, workspace visibility toggles, and shell behavior."
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
          title="Show Stories Workspace"
          description="Expose the Stories workspace when imported story media or story activity exists."
        >
          <ToggleSwitch
            label="Show Stories Workspace"
            checked={settings.show_stories_workspace}
            disabled={isSaving}
            onCheckedChange={(checked) => void onUpdate({ show_stories_workspace: checked })}
          />
        </SettingRow>

        <SettingRow
          title="Show Story Activity"
          description="Render Spotlight and shared story metadata inside the Stories workspace."
        >
          <ToggleSwitch
            label="Show Story Activity"
            checked={settings.show_story_activity}
            disabled={isSaving}
            onCheckedChange={(checked) => void onUpdate({ show_story_activity: checked })}
          />
        </SettingRow>

        <SettingRow
          title="Show Snapchat+ Card"
          description="Render the dedicated Snapchat+ profile card when subscription purchase data exists."
        >
          <ToggleSwitch
            label="Show Snapchat+ Card"
            checked={settings.show_snapchat_plus_profile_card}
            disabled={isSaving}
            onCheckedChange={(checked) => void onUpdate({ show_snapchat_plus_profile_card: checked })}
          />
        </SettingRow>

        <SettingRow
          title="Enable Debug Logging"
          description="Raise backend logging to debug level for local troubleshooting."
        >
          <ToggleSwitch
            label="Enable Debug Logging"
            checked={settings.enable_debug_logging}
            disabled={isSaving}
            onCheckedChange={(checked) => void onUpdate({ enable_debug_logging: checked })}
          />
        </SettingRow>
      </SettingsCard>
    </div>
  );
}
