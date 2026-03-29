import SettingsCard from "./SettingsCard";
import SettingRow from "./SettingRow";
import ToggleSwitch from "./ToggleSwitch";
import type { AppSettings, AppSettingsUpdate } from "../../hooks/useSettings";

type PrivacySettingsPanelProps = {
  settings: AppSettings;
  isSaving: boolean;
  onUpdate: (updates: AppSettingsUpdate) => Promise<void>;
};

export default function PrivacySettingsPanel({ settings, isSaving, onUpdate }: PrivacySettingsPanelProps) {
  return (
    <div className="grid gap-6">
      <SettingsCard
        eyebrow="Privacy"
        title="Safer Presentation"
        description="Reduce sensitive details in chats and profile views when you are presenting, recording, or sharing screenshots."
      >
        <SettingRow
          title="Blur Private Names"
          description="Blur names and account labels in chats and profile views until hovered."
        >
          <ToggleSwitch
            label="Blur Private Names"
            checked={settings.blur_private_names}
            disabled={isSaving}
            onCheckedChange={(checked) => void onUpdate({ blur_private_names: checked })}
          />
        </SettingRow>

        <SettingRow
          title="Hide Exact Timestamps"
          description="Show date-only summaries instead of exact times in chats and profile history."
        >
          <ToggleSwitch
            label="Hide Exact Timestamps"
            checked={settings.hide_exact_timestamps}
            disabled={isSaving}
            onCheckedChange={(checked) => void onUpdate({ hide_exact_timestamps: checked })}
          />
        </SettingRow>

        <SettingRow
          title="Demo-Safe Mode"
          description="Force privacy-friendly presentation defaults by blurring names and reducing timestamp precision together."
        >
          <ToggleSwitch
            label="Demo-Safe Mode"
            checked={settings.demo_safe_mode}
            disabled={isSaving}
            onCheckedChange={(checked) => void onUpdate({ demo_safe_mode: checked })}
          />
        </SettingRow>
      </SettingsCard>
    </div>
  );
}
