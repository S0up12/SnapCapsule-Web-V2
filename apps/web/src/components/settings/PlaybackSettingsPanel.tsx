import { Clapperboard } from "lucide-react";

import PopoverSelect from "../controls/PopoverSelect";
import SettingsCard from "./SettingsCard";
import SettingRow from "./SettingRow";
import ToggleSwitch from "./ToggleSwitch";
import type { AppSettings, AppSettingsUpdate } from "../../hooks/useSettings";

type PlaybackSettingsPanelProps = {
  settings: AppSettings;
  isSaving: boolean;
  onUpdate: (updates: AppSettingsUpdate) => Promise<void>;
};

const HOVER_DELAY_OPTIONS = [
  { value: "off", label: "Off" },
  { value: "0.6s", label: "0.6 Seconds" },
  { value: "1.2s", label: "1.2 Seconds" },
  { value: "2s", label: "2 Seconds" },
] as const;

export default function PlaybackSettingsPanel({ settings, isSaving, onUpdate }: PlaybackSettingsPanelProps) {
  return (
    <div className="grid gap-6">
      <SettingsCard
        eyebrow="Playback"
        title="Video And Viewer"
        description="Choose how video previews and the full-screen viewer behave across browsers and devices."
      >
        <SettingRow
          title="Prefer Browser-Compatible Playback"
          description="Use the cached compatibility stream by default so videos play reliably on more machines and browsers."
        >
          <ToggleSwitch
            label="Prefer Browser-Compatible Playback"
            checked={settings.prefer_browser_playback}
            disabled={isSaving}
            onCheckedChange={(checked) => void onUpdate({ prefer_browser_playback: checked })}
          />
        </SettingRow>

        <SettingRow
          title="Preview Videos In Grid"
          description="Enable hover-triggered video playback inside the memories grid."
        >
          <ToggleSwitch
            label="Preview Videos In Grid"
            checked={settings.autoplay_videos_in_grid}
            disabled={isSaving}
            onCheckedChange={(checked) => void onUpdate({ autoplay_videos_in_grid: checked })}
          />
        </SettingRow>

        <SettingRow
          title="Mute Video Previews"
          description="Start grid previews muted to keep browsing unobtrusive."
        >
          <ToggleSwitch
            label="Mute Video Previews"
            checked={settings.mute_video_previews}
            disabled={isSaving}
            onCheckedChange={(checked) => void onUpdate({ mute_video_previews: checked })}
          />
        </SettingRow>

        <SettingRow
          title="Loop Video Previews"
          description="Keep preview clips looping while the pointer remains over a tile."
        >
          <ToggleSwitch
            label="Loop Video Previews"
            checked={settings.loop_video_previews}
            disabled={isSaving}
            onCheckedChange={(checked) => void onUpdate({ loop_video_previews: checked })}
          />
        </SettingRow>

        <SettingRow
          title="Preview Hover Delay"
          description="Set how long the cursor must rest on a video tile before the preview begins."
        >
          <PopoverSelect
            label="Preview Hover Delay"
            icon={Clapperboard}
            value={settings.video_preview_hover_delay}
            disabled={isSaving}
            onChange={(value) => void onUpdate({ video_preview_hover_delay: value as AppSettings["video_preview_hover_delay"] })}
            options={[...HOVER_DELAY_OPTIONS]}
          />
        </SettingRow>

        <SettingRow
          title="Autoplay Videos In Viewer"
          description="Begin playback automatically when a video opens in the full-screen media viewer."
        >
          <ToggleSwitch
            label="Autoplay Videos In Viewer"
            checked={settings.autoplay_videos_in_lightbox}
            disabled={isSaving}
            onCheckedChange={(checked) => void onUpdate({ autoplay_videos_in_lightbox: checked })}
          />
        </SettingRow>

        <SettingRow
          title="Show Memory Overlays"
          description="Display Snapchat overlays in memory thumbnails and in the full-screen viewer."
        >
          <ToggleSwitch
            label="Show Memory Overlays"
            checked={settings.show_memory_overlays}
            disabled={isSaving}
            onCheckedChange={(checked) => void onUpdate({ show_memory_overlays: checked })}
          />
        </SettingRow>
      </SettingsCard>

      <SettingsCard
        eyebrow="Viewer"
        title="Cross-Device Defaults"
        description="These defaults are stored with your account preferences so the app behaves consistently across machines."
      >
        <div className="rounded-[1.2rem] border border-slate-200/70 bg-slate-50/85 px-4 py-4 text-sm leading-6 text-slate-600 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300">
          Browser-compatible playback keeps public-facing playback predictable. If you disable it, original files are used when possible, but unsupported codecs may fail on some computers.
        </div>
      </SettingsCard>
    </div>
  );
}
