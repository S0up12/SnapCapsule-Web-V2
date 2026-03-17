import { HardDrive, LoaderCircle, SlidersHorizontal, TerminalSquare } from "lucide-react";
import { useEffect, useState } from "react";

import DataStoragePanel from "../components/settings/DataStoragePanel";
import DeveloperSettingsPanel from "../components/settings/DeveloperSettingsPanel";
import GeneralSettingsPanel from "../components/settings/GeneralSettingsPanel";
import type { AppSettingsUpdate } from "../hooks/useSettings";
import { useSettings } from "../hooks/useSettings";
import { useSystemAction, useSystemStatus, type SystemActionResponse } from "../hooks/useSystemStatus";

const CATEGORY_ITEMS = [
  {
    id: "general",
    label: "General",
    description: "Theme, autoplay, and gallery defaults.",
    icon: SlidersHorizontal,
  },
  {
    id: "storage",
    label: "Data & Storage",
    description: "Volume paths, rescans, and archive reset actions.",
    icon: HardDrive,
  },
  {
    id: "developer",
    label: "Developer",
    description: "API docs, worker state, and debug controls.",
    icon: TerminalSquare,
  },
] as const;

type CategoryId = (typeof CATEGORY_ITEMS)[number]["id"];

export default function Settings() {
  const [activeCategory, setActiveCategory] = useState<CategoryId>("general");
  const [dataFeedback, setDataFeedback] = useState<SystemActionResponse | null>(null);
  const [developerFeedback, setDeveloperFeedback] = useState<SystemActionResponse | null>(null);

  const settingsQuery = useSettings();
  const systemStatusQuery = useSystemStatus();
  const rescanAction = useSystemAction("/api/system/rescan");
  const clearCacheAction = useSystemAction("/api/system/clear-cache");
  const resetAction = useSystemAction("/api/system/reset");

  useEffect(() => {
    if (!settingsQuery.data) {
      return;
    }

    document.documentElement.classList.toggle("dark", settingsQuery.data.dark_mode);
    window.localStorage.setItem("snapcapsule:dark-mode", String(settingsQuery.data.dark_mode));
  }, [settingsQuery.data]);

  async function handleUpdateSettings(updates: AppSettingsUpdate) {
    const updated = await settingsQuery.saveSettings(updates);
    document.documentElement.classList.toggle("dark", updated.dark_mode);
    window.localStorage.setItem("snapcapsule:dark-mode", String(updated.dark_mode));
    await systemStatusQuery.refetch();
  }

  async function handleRescan() {
    setDeveloperFeedback(null);
    const result = await rescanAction.mutateAsync();
    setDataFeedback(result);
  }

  async function handleClearCache() {
    setDataFeedback(null);
    const result = await clearCacheAction.mutateAsync();
    setDeveloperFeedback(result);
  }

  async function handleReset() {
    const confirmed = window.confirm(
      "Clear the database and generated media files? You will need to re-import your Snapchat exports afterward.",
    );
    if (!confirmed) {
      return;
    }

    setDeveloperFeedback(null);
    const result = await resetAction.mutateAsync();
    setDataFeedback(result);
  }

  if (settingsQuery.isLoading) {
    return (
      <section className="mx-auto flex min-h-[36rem] w-full max-w-[1600px] items-center justify-center rounded-[2rem] border border-slate-200/70 bg-white/80 dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-sky-300/20 bg-sky-300/[0.12] text-sky-100">
            <LoaderCircle className="h-9 w-9 animate-spin" />
          </div>
          <h2 className="mt-6 text-2xl font-semibold text-slate-950 dark:text-white">Loading settings</h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-400">
            Pulling saved preferences, storage details, and the current worker status from the backend.
          </p>
        </div>
      </section>
    );
  }

  if (settingsQuery.isError || !settingsQuery.data) {
    return (
      <section className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
        <div className="rounded-[1.4rem] border border-rose-400/20 bg-rose-400/10 px-5 py-4 text-sm text-rose-100">
          {settingsQuery.error instanceof Error ? settingsQuery.error.message : "Failed to load settings."}
        </div>
      </section>
    );
  }

  const settings = settingsQuery.data;

  return (
    <section className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-[linear-gradient(135deg,_rgba(255,255,255,0.96),_rgba(240,248,255,0.95),_rgba(232,240,250,0.96))] px-6 py-8 shadow-[0_28px_80px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-[linear-gradient(135deg,_rgba(10,18,30,0.98),_rgba(18,23,42,0.94),_rgba(7,11,20,0.98))] dark:shadow-black/30 md:px-8 md:py-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-sky-700/75 dark:text-sky-200/70">
          Settings Workspace
        </p>
        <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950 dark:text-white md:text-5xl">
              Settings
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-700 dark:text-slate-300">
              Tune interface defaults, inspect storage mounts, and run developer-friendly maintenance tasks without
              leaving the web app.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-300">
            {settingsQuery.isSaving ? "Saving..." : "Preferences persist instantly"}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="h-fit rounded-[1.8rem] border border-slate-200/70 bg-white/85 p-4 shadow-[0_22px_60px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.045]">
          <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Categories</p>
          <nav className="mt-4 space-y-2">
            {CATEGORY_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeCategory === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveCategory(item.id)}
                  className={[
                    "flex w-full items-start gap-3 rounded-[1.2rem] border px-3 py-3 text-left transition",
                    isActive
                      ? "border-sky-300/20 bg-sky-400/[0.12] text-slate-950 shadow-[0_18px_36px_rgba(8,47,73,0.14)] dark:text-white"
                      : "border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50/90 dark:text-slate-400 dark:hover:border-white/10 dark:hover:bg-white/[0.045]",
                  ].join(" ")}
                >
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-slate-200/80 bg-white text-slate-800 shadow-sm dark:border-white/10 dark:bg-slate-950/55 dark:text-slate-200">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{item.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-500">
                      {item.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0">
          {activeCategory === "general" ? (
            <GeneralSettingsPanel
              settings={settings}
              isSaving={settingsQuery.isSaving}
              onUpdate={handleUpdateSettings}
            />
          ) : null}

          {activeCategory === "storage" ? (
            <DataStoragePanel
              settings={settings}
              isRescanning={rescanAction.isPending}
              isResetting={resetAction.isPending}
              onRescan={handleRescan}
              onReset={handleReset}
              actionFeedback={dataFeedback}
            />
          ) : null}

          {activeCategory === "developer" ? (
            <DeveloperSettingsPanel
              settings={settings}
              systemStatus={systemStatusQuery.data}
              isSaving={settingsQuery.isSaving}
              isClearingCache={clearCacheAction.isPending}
              onUpdate={handleUpdateSettings}
              onClearCache={handleClearCache}
              actionFeedback={developerFeedback}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
