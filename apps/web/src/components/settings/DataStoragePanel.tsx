import { CheckCircle2, ImageUp, RotateCcw, Trash2 } from "lucide-react";

import SettingsCard from "./SettingsCard";
import SettingRow from "./SettingRow";
import type { SystemActionResponse } from "../../hooks/useSystemStatus";

type DataStoragePanelProps = {
  isRescanning: boolean;
  isRebuildingThumbnails: boolean;
  isResetting: boolean;
  onRescan: () => Promise<void>;
  onRebuildThumbnails: () => Promise<void>;
  onReset: () => Promise<void>;
  actionFeedback: SystemActionResponse | null;
};

export default function DataStoragePanel({
  isRescanning,
  isRebuildingThumbnails,
  isResetting,
  onRescan,
  onRebuildThumbnails,
  onReset,
  actionFeedback,
}: DataStoragePanelProps) {
  return (
    <div className="grid gap-6">
      <SettingsCard title="Library">
        <SettingRow
          title="Scan for new archive folders"
          description="Look for new archive folders that were added to the library location outside the upload flow."
        >
          <button
            type="button"
            disabled={isRescanning}
            onClick={() => void onRescan()}
            className="inline-flex items-center gap-2 rounded-[1rem] border border-sky-300/20 bg-sky-400/[0.12] px-4 py-3 text-sm font-medium text-sky-950 transition hover:border-sky-300/30 hover:bg-sky-400/[0.18] disabled:cursor-not-allowed disabled:opacity-60 dark:text-sky-100"
          >
            <RotateCcw className="h-4 w-4" />
            {isRescanning ? "Queueing rescan..." : "Re-scan Library"}
          </button>
        </SettingRow>

        <SettingRow
          title="Rebuild thumbnail cache"
          description="Regenerate all image and video thumbnails in the background using the current thumbnail pipeline."
        >
          <button
            type="button"
            disabled={isRebuildingThumbnails}
            onClick={() => void onRebuildThumbnails()}
            className="inline-flex items-center gap-2 rounded-[1rem] border border-sky-300/20 bg-sky-400/[0.12] px-4 py-3 text-sm font-medium text-sky-950 transition hover:border-sky-300/30 hover:bg-sky-400/[0.18] disabled:cursor-not-allowed disabled:opacity-60 dark:text-sky-100"
          >
            <ImageUp className="h-4 w-4" />
            {isRebuildingThumbnails ? "Queueing rebuild..." : "Rebuild Thumbnail Cache"}
          </button>
        </SettingRow>

        <SettingRow
          title="Clear Database & Start Over"
          description="Remove imported data and generated media so you can rebuild the library from scratch. Your saved preferences stay."
          destructive
        >
          <button
            type="button"
            disabled={isResetting}
            onClick={() => void onReset()}
            className="inline-flex items-center gap-2 rounded-[1rem] border border-rose-300/20 bg-rose-500/[0.12] px-4 py-3 text-sm font-medium text-rose-700 transition hover:border-rose-300/30 hover:bg-rose-500/[0.18] disabled:cursor-not-allowed disabled:opacity-60 dark:text-rose-100"
          >
            <Trash2 className="h-4 w-4" />
            {isResetting ? "Resetting archive..." : "Clear Database & Start Over"}
          </button>
        </SettingRow>

        {actionFeedback ? (
          <div className="mt-2 inline-flex items-start gap-3 rounded-[1rem] border border-emerald-300/20 bg-emerald-400/[0.08] px-4 py-3 text-sm text-emerald-700 dark:text-emerald-100">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{actionFeedback.message}</span>
          </div>
        ) : null}
      </SettingsCard>
    </div>
  );
}
