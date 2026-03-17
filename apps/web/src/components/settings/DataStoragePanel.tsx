import { CheckCircle2, RotateCcw, Trash2 } from "lucide-react";

import SettingsCard from "./SettingsCard";
import SettingRow from "./SettingRow";
import type { AppSettings } from "../../hooks/useSettings";
import type { SystemActionResponse } from "../../hooks/useSystemStatus";

type DataStoragePanelProps = {
  settings: AppSettings;
  isRescanning: boolean;
  isResetting: boolean;
  onRescan: () => Promise<void>;
  onReset: () => Promise<void>;
  actionFeedback: SystemActionResponse | null;
};

function PathPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] border border-slate-200/70 bg-slate-50/80 px-4 py-3 dark:border-white/10 dark:bg-slate-950/55">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-2 break-all font-mono text-xs leading-6 text-slate-700 dark:text-slate-300">{value}</p>
    </div>
  );
}

export default function DataStoragePanel({
  settings,
  isRescanning,
  isResetting,
  onRescan,
  onReset,
  actionFeedback,
}: DataStoragePanelProps) {
  return (
    <div className="grid gap-6">
      <SettingsCard
        eyebrow="Data & Storage"
        title="Archive storage"
        description="These paths reflect the mounted Docker volumes currently backing your imported media."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <PathPill label="Raw Media" value={settings.storage.raw_media_dir} />
          <PathPill label="Thumbnails" value={settings.storage.thumbnail_dir} />
        </div>
      </SettingsCard>

      <SettingsCard
        eyebrow="Maintenance"
        title="Library actions"
        description="Run safe maintenance operations without leaving the web interface."
      >
        <SettingRow
          title="Re-scan Library"
          description="Queue a background scan for any mounted archive folders placed under the backend rescan directory."
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
          description="Delete imported metadata plus generated raw and thumbnail files. Your saved settings will remain."
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
