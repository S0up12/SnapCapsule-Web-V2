import { ExternalLink, RefreshCcw, Trash } from "lucide-react";

import SettingsCard from "./SettingsCard";
import SettingRow from "./SettingRow";
import ToggleSwitch from "./ToggleSwitch";
import type { AppSettings, AppSettingsUpdate } from "../../hooks/useSettings";
import type { SystemActionResponse, SystemStatus } from "../../hooks/useSystemStatus";

type DeveloperSettingsPanelProps = {
  settings: AppSettings;
  systemStatus: SystemStatus | undefined;
  isSaving: boolean;
  isClearingCache: boolean;
  onUpdate: (updates: AppSettingsUpdate) => Promise<void>;
  onClearCache: () => Promise<void>;
  actionFeedback: SystemActionResponse | null;
};

const STATUS_STYLES: Record<string, string> = {
  idle: "border-emerald-300/25 bg-emerald-400/[0.12] text-emerald-700 dark:text-emerald-100",
  processing: "border-amber-300/25 bg-amber-400/[0.12] text-amber-700 dark:text-amber-100",
  offline: "border-rose-300/25 bg-rose-500/[0.12] text-rose-700 dark:text-rose-100",
};

export default function DeveloperSettingsPanel({
  settings,
  systemStatus,
  isSaving,
  isClearingCache,
  onUpdate,
  onClearCache,
  actionFeedback,
}: DeveloperSettingsPanelProps) {
  const statusTone = STATUS_STYLES[systemStatus?.worker_state ?? "offline"] ?? STATUS_STYLES.offline;

  return (
    <div className="grid gap-6">
      <SettingsCard
        eyebrow="Developer"
        title="Diagnostics and tooling"
        description="Operator-friendly controls for inspecting the live API, worker state, and temporary cache."
      >
        <SettingRow
          title="OpenAPI Documentation"
          description="Open the interactive FastAPI documentation in a new browser tab."
        >
          <a
            href="/docs"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm transition hover:border-sky-300/40 hover:text-sky-700 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100 dark:hover:text-sky-100"
          >
            <ExternalLink className="h-4 w-4" />
            Open API Docs
          </a>
        </SettingRow>

        <SettingRow
          title="Enable Debug Logging"
          description="Raise the backend application log level so development issues are easier to diagnose."
        >
          <ToggleSwitch
            label="Enable Debug Logging"
            checked={settings.enable_debug_logging}
            disabled={isSaving}
            onCheckedChange={(checked) => void onUpdate({ enable_debug_logging: checked })}
          />
        </SettingRow>

        <SettingRow
          title="Clear Temporary Cache"
          description="Remove uploaded ZIPs and extracted workspaces without touching imported media already in the archive."
        >
          <button
            type="button"
            disabled={isClearingCache}
            onClick={() => void onClearCache()}
            className="inline-flex items-center gap-2 rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm transition hover:border-amber-300/40 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100 dark:hover:text-amber-100"
          >
            <Trash className="h-4 w-4" />
            {isClearingCache ? "Clearing cache..." : "Clear Cache"}
          </button>
        </SettingRow>

        {actionFeedback ? (
          <div className="mt-2 rounded-[1rem] border border-sky-300/20 bg-sky-400/[0.08] px-4 py-3 text-sm text-sky-700 dark:text-sky-100">
            {actionFeedback.message}
          </div>
        ) : null}
      </SettingsCard>

      <SettingsCard
        eyebrow="System Status"
        title="Worker and queue health"
        description="A lightweight live snapshot of the Celery worker pool and Redis-backed task queues."
      >
        <div className="grid gap-4 md:grid-cols-[1.3fr_0.7fr_0.7fr_0.7fr]">
          <div className={`rounded-[1.2rem] border px-4 py-4 ${statusTone}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] opacity-80">Worker State</p>
            <p className="mt-3 text-lg font-semibold">{systemStatus?.worker_label ?? "Loading..."}</p>
          </div>

          <div className="rounded-[1.2rem] border border-slate-200/70 bg-slate-50/80 px-4 py-4 dark:border-white/10 dark:bg-slate-950/55">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Workers Online</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">
              {systemStatus?.workers_online ?? 0}
            </p>
          </div>

          <div className="rounded-[1.2rem] border border-slate-200/70 bg-slate-50/80 px-4 py-4 dark:border-white/10 dark:bg-slate-950/55">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Active Tasks</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">
              {systemStatus?.active_tasks ?? 0}
            </p>
          </div>

          <div className="rounded-[1.2rem] border border-slate-200/70 bg-slate-50/80 px-4 py-4 dark:border-white/10 dark:bg-slate-950/55">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Queued Tasks</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">
              {systemStatus?.queued_tasks ?? 0}
            </p>
          </div>
        </div>

        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-300">
          <RefreshCcw className="h-3.5 w-3.5" />
          Refreshes automatically every 10 seconds
        </div>
      </SettingsCard>
    </div>
  );
}
