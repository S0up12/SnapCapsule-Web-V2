import { CheckCircle2, RotateCcw, Trash2 } from "lucide-react";

import SettingsCard from "./SettingsCard";
import SettingRow from "./SettingRow";
import type { SystemActionResponse } from "../../hooks/useSystemStatus";

type DataStoragePanelProps = {
  storage: {
    raw_media_dir: string;
    thumbnail_dir: string;
    library_archives_dir: string;
    ingest_cache_dir: string;
  };
  isRescanning: boolean;
  isResetting: boolean;
  onRescan: () => Promise<void>;
  onReset: () => Promise<void>;
  actionFeedback: SystemActionResponse | null;
};

export default function DataStoragePanel({
  storage,
  isRescanning,
  isResetting,
  onRescan,
  onReset,
  actionFeedback,
}: DataStoragePanelProps) {
  return (
    <div className="grid gap-6">
      <SettingsCard title="Library">
        <div className="mb-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-[1rem] border border-slate-200/70 bg-slate-50/85 px-4 py-3 dark:border-white/10 dark:bg-white/[0.035]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Raw Media</p>
            <p className="mt-2 break-all text-sm text-slate-900 dark:text-slate-100">{storage.raw_media_dir}</p>
          </div>
          <div className="rounded-[1rem] border border-slate-200/70 bg-slate-50/85 px-4 py-3 dark:border-white/10 dark:bg-white/[0.035]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Thumbnails</p>
            <p className="mt-2 break-all text-sm text-slate-900 dark:text-slate-100">{storage.thumbnail_dir}</p>
          </div>
          <div className="rounded-[1rem] border border-slate-200/70 bg-slate-50/85 px-4 py-3 dark:border-white/10 dark:bg-white/[0.035]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Library Archives</p>
            <p className="mt-2 break-all text-sm text-slate-900 dark:text-slate-100">{storage.library_archives_dir}</p>
          </div>
          <div className="rounded-[1rem] border border-slate-200/70 bg-slate-50/85 px-4 py-3 dark:border-white/10 dark:bg-white/[0.035]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Ingest Cache</p>
            <p className="mt-2 break-all text-sm text-slate-900 dark:text-slate-100">{storage.ingest_cache_dir}</p>
          </div>
        </div>

        <SettingRow
          title="Scan for new archive folders"
          description="Look for new archive folders that were added to the mounted library archives path outside the upload flow."
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
