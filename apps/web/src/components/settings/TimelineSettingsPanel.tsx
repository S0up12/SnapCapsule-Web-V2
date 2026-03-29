import { CalendarRange, LayoutGrid, SlidersHorizontal } from "lucide-react";

import PopoverSelect from "../controls/PopoverSelect";
import SettingsCard from "./SettingsCard";
import SettingRow from "./SettingRow";
import ToggleSwitch from "./ToggleSwitch";
import type { AppSettings, AppSettingsUpdate } from "../../hooks/useSettings";

type TimelineSettingsPanelProps = {
  settings: AppSettings;
  isSaving: boolean;
  onUpdate: (updates: AppSettingsUpdate) => Promise<void>;
};

const GRID_SIZE_OPTIONS = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
] as const;

const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
] as const;

const FILTER_OPTIONS = [
  { value: "all", label: "All Memories" },
  { value: "photos", label: "Photos Only" },
  { value: "videos", label: "Videos Only" },
  { value: "favorites", label: "Favorites" },
] as const;

const GROUPING_OPTIONS = [
  { value: "year", label: "By Year" },
  { value: "month", label: "By Month" },
  { value: "day", label: "By Day" },
] as const;

export default function TimelineSettingsPanel({ settings, isSaving, onUpdate }: TimelineSettingsPanelProps) {
  return (
    <div className="grid gap-6">
      <SettingsCard
        eyebrow="Timeline"
        title="Memories Defaults"
        description="Control how the memories view opens, groups media, and remembers your preferred browsing state."
      >
        <SettingRow
          title="Default Grid Size"
          description="Choose the thumbnail density the memories view should prefer."
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

        <SettingRow
          title="Default Sort"
          description="Pick the order memories should use when the timeline first opens."
        >
          <PopoverSelect
            label="Default Sort"
            icon={SlidersHorizontal}
            value={settings.timeline_default_sort}
            disabled={isSaving}
            onChange={(value) => void onUpdate({ timeline_default_sort: value as AppSettings["timeline_default_sort"] })}
            options={[...SORT_OPTIONS]}
          />
        </SettingRow>

        <SettingRow
          title="Default Filter"
          description="Choose the default content slice for the memories timeline."
        >
          <PopoverSelect
            label="Default Filter"
            icon={SlidersHorizontal}
            value={settings.timeline_default_filter}
            disabled={isSaving}
            onChange={(value) => void onUpdate({ timeline_default_filter: value as AppSettings["timeline_default_filter"] })}
            options={[...FILTER_OPTIONS]}
          />
        </SettingRow>

        <SettingRow
          title="Date Grouping"
          description="Set how the timeline should group memories by date."
        >
          <PopoverSelect
            label="Date Grouping"
            icon={CalendarRange}
            value={settings.timeline_date_grouping}
            disabled={isSaving}
            onChange={(value) => void onUpdate({ timeline_date_grouping: value as AppSettings["timeline_date_grouping"] })}
            options={[...GROUPING_OPTIONS]}
          />
        </SettingRow>

        <SettingRow
          title="Remember Last Timeline Changes"
          description="When enabled, changing sort, filter, grouping, or undated visibility in Memories updates these defaults automatically."
        >
          <ToggleSwitch
            label="Remember Last Timeline Changes"
            checked={settings.remember_last_timeline_filters}
            disabled={isSaving}
            onCheckedChange={(checked) => void onUpdate({ remember_last_timeline_filters: checked })}
          />
        </SettingRow>

        <SettingRow
          title="Show Undated Assets"
          description="Keep memories without an exported capture timestamp visible in the timeline."
        >
          <ToggleSwitch
            label="Show Undated Assets"
            checked={settings.show_undated_assets}
            disabled={isSaving}
            onCheckedChange={(checked) => void onUpdate({ show_undated_assets: checked })}
          />
        </SettingRow>
      </SettingsCard>
    </div>
  );
}
