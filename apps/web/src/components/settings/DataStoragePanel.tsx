import { CheckCircle2, HardDrive, ImageUp, RotateCcw, ScanSearch, Trash2, Video } from "lucide-react";

import SettingsCard from "./SettingsCard";
import SettingRow from "./SettingRow";
import type { LibraryDiagnostics, SystemActionResponse } from "../../hooks/useSystemStatus";

type DataStoragePanelProps = {
  isRescanning: boolean;
  isRebuildingThumbnails: boolean;
  isRebuildingPlayback: boolean;
  isCleaningPlayback: boolean;
  isVerifyingLibrary: boolean;
  isResetting: boolean;
  libraryDiagnostics: LibraryDiagnostics | undefined;
  onRescan: () => Promise<void>;
  onRebuildThumbnails: () => Promise<void>;
  onRebuildPlayback: () => Promise<void>;
  onCleanPlayback: () => Promise<void>;
  onVerifyLibrary: () => Promise<void>;
  onReset: () => Promise<void>;
  actionFeedback: SystemActionResponse | null;
};

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  const units = ["KB", "MB", "GB", "TB"];
  let current = value / 1024;
  let unitIndex = 0;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }
  return `${current.toFixed(current >= 10 || unitIndex === 0 ? 1 : 2)} ${units[unitIndex]}`;
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[1.15rem] border border-slate-200/70 bg-slate-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/[0.035]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-100">{value}</p>
    </div>
  );
}

export default function DataStoragePanel({
  isRescanning,
  isRebuildingThumbnails,
  isRebuildingPlayback,
  isCleaningPlayback,
  isVerifyingLibrary,
  isResetting,
  libraryDiagnostics,
  onRescan,
  onRebuildThumbnails,
  onRebuildPlayback,
  onCleanPlayback,
  onVerifyLibrary,
  onReset,
  actionFeedback,
}: DataStoragePanelProps) {
  return (
    <div className="grid gap-6">
      <SettingsCard
        eyebrow="Library"
        title="Storage And Integrity"
        description="Monitor how much space the archive uses and surface missing files or stale playback derivatives before they become user-facing problems."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard label="Originals" value={formatBytes(libraryDiagnostics?.storage.raw_media_bytes ?? 0)} />
          <MetricCard label="Thumbnails" value={formatBytes(libraryDiagnostics?.storage.thumbnail_bytes ?? 0)} />
          <MetricCard label="Playback Cache" value={formatBytes(libraryDiagnostics?.storage.playback_cache_bytes ?? 0)} />
          <MetricCard label="Workspaces" value={formatBytes(libraryDiagnostics?.storage.ingest_workspace_bytes ?? 0)} />
          <MetricCard label="Uploads" value={formatBytes(libraryDiagnostics?.storage.ingest_upload_bytes ?? 0)} />
          <MetricCard label="Total" value={formatBytes(libraryDiagnostics?.storage.total_bytes ?? 0)} />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Assets" value={libraryDiagnostics?.integrity.total_assets ?? 0} />
          <MetricCard label="Videos" value={libraryDiagnostics?.integrity.video_assets ?? 0} />
          <MetricCard label="Playback Files" value={libraryDiagnostics?.integrity.playback_derivatives ?? 0} />
          <MetricCard label="Playback Orphans" value={libraryDiagnostics?.integrity.orphaned_playback_files ?? 0} />
          <MetricCard label="Missing Originals" value={libraryDiagnostics?.integrity.missing_original_files ?? 0} />
          <MetricCard label="Missing Thumbnails" value={libraryDiagnostics?.integrity.missing_thumbnail_files ?? 0} />
          <MetricCard label="Missing Overlays" value={libraryDiagnostics?.integrity.missing_overlay_files ?? 0} />
          <MetricCard label="Playback Errors" value={libraryDiagnostics?.integrity.playback_error_assets ?? 0} />
        </div>
      </SettingsCard>

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
          title="Rebuild browser playback cache"
          description="Generate or refresh browser-compatible playback files for video assets in the background."
        >
          <button
            type="button"
            disabled={isRebuildingPlayback}
            onClick={() => void onRebuildPlayback()}
            className="inline-flex items-center gap-2 rounded-[1rem] border border-sky-300/20 bg-sky-400/[0.12] px-4 py-3 text-sm font-medium text-sky-950 transition hover:border-sky-300/30 hover:bg-sky-400/[0.18] disabled:cursor-not-allowed disabled:opacity-60 dark:text-sky-100"
          >
            <Video className="h-4 w-4" />
            {isRebuildingPlayback ? "Queueing rebuild..." : "Rebuild Playback Cache"}
          </button>
        </SettingRow>

        <SettingRow
          title="Clean orphaned playback cache"
          description="Remove cached browser playback files that are no longer referenced by any current video asset."
        >
          <button
            type="button"
            disabled={isCleaningPlayback}
            onClick={() => void onCleanPlayback()}
            className="inline-flex items-center gap-2 rounded-[1rem] border border-sky-300/20 bg-sky-400/[0.12] px-4 py-3 text-sm font-medium text-sky-950 transition hover:border-sky-300/30 hover:bg-sky-400/[0.18] disabled:cursor-not-allowed disabled:opacity-60 dark:text-sky-100"
          >
            <HardDrive className="h-4 w-4" />
            {isCleaningPlayback ? "Cleaning cache..." : "Clean Playback Cache"}
          </button>
        </SettingRow>

        <SettingRow
          title="Verify library file links"
          description="Scan the archive for missing originals, thumbnails, and overlay files."
        >
          <button
            type="button"
            disabled={isVerifyingLibrary}
            onClick={() => void onVerifyLibrary()}
            className="inline-flex items-center gap-2 rounded-[1rem] border border-sky-300/20 bg-sky-400/[0.12] px-4 py-3 text-sm font-medium text-sky-950 transition hover:border-sky-300/30 hover:bg-sky-400/[0.18] disabled:cursor-not-allowed disabled:opacity-60 dark:text-sky-100"
          >
            <ScanSearch className="h-4 w-4" />
            {isVerifyingLibrary ? "Verifying..." : "Verify Library"}
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
