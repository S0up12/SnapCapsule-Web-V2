import { Film, ImageIcon, LayoutDashboard } from "lucide-react";

import type { DashboardStats as DashboardStatsData } from "../../hooks/useDashboardStats";
import ImportFlow from "./ImportFlow";

type DashboardStatsProps = {
  stats: DashboardStatsData;
  onRefreshDashboard: () => void;
};

function StatCard({
  title,
  value,
  icon: Icon,
  accentClassName,
}: {
  title: string;
  value: number;
  icon: typeof LayoutDashboard;
  accentClassName: string;
}) {
  return (
    <article className="rounded-[1.5rem] border border-slate-200/80 bg-white/88 p-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-white/[0.045] dark:shadow-xl dark:shadow-black/20">
      <div className={`inline-flex rounded-[1rem] p-3 ${accentClassName}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{value.toLocaleString()}</p>
    </article>
  );
}

export default function DashboardStats({ stats, onRefreshDashboard }: DashboardStatsProps) {
  return (
    <section className="mx-auto flex w-full max-w-[1520px] flex-col gap-6">
      <div className="overflow-hidden rounded-[2.25rem] border border-slate-200/80 bg-[linear-gradient(135deg,_rgba(255,255,255,0.96),_rgba(235,245,255,0.95),_rgba(222,236,249,0.98))] shadow-[0_28px_80px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-[linear-gradient(135deg,_rgba(9,17,28,0.98),_rgba(10,31,46,0.92),_rgba(5,9,16,0.98))] dark:shadow-2xl dark:shadow-black/30">
        <div className="grid gap-8 px-6 py-8 md:px-10 md:py-10 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-sky-700/70 dark:text-sky-200/70">Library Ready</p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 dark:text-white md:text-5xl">
              Your Snapchat archive is ready to browse.
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
              Keep adding new exports whenever you want. Your existing memories stay available while new imports are processed in the background.
            </p>
          </div>

          <div className="rounded-[1.9rem] border border-slate-200/80 bg-white/70 p-5 backdrop-blur dark:border-white/10 dark:bg-white/[0.045]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">At A Glance</p>
            <div className="mt-4 rounded-[1.35rem] border border-emerald-300/30 bg-emerald-50 px-5 py-4 dark:border-emerald-300/10 dark:bg-emerald-300/[0.08]">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-100">Imports can be added any time</p>
              <p className="mt-2 text-sm leading-6 text-emerald-700/85 dark:text-emerald-50/85">
                Your photos, videos, and chats stay available while you continue building the archive with more Snapchat exports.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Total Memories"
          value={stats.total_memories}
          icon={LayoutDashboard}
          accentClassName="bg-sky-100 text-sky-700 dark:bg-sky-300/[0.14] dark:text-sky-100"
        />
        <StatCard
          title="Total Photos"
          value={stats.total_photos}
          icon={ImageIcon}
          accentClassName="bg-emerald-100 text-emerald-700 dark:bg-emerald-300/[0.14] dark:text-emerald-100"
        />
        <StatCard
          title="Total Videos"
          value={stats.total_videos}
          icon={Film}
          accentClassName="bg-amber-100 text-amber-700 dark:bg-amber-300/[0.14] dark:text-amber-100"
        />
      </div>

      <div>
        <section className="rounded-[1.7rem] border border-slate-200/80 bg-white/88 p-4 shadow-[0_20px_45px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-xl dark:shadow-black/20">
          <ImportFlow variant="compact" onRefreshDashboard={onRefreshDashboard} />
        </section>
      </div>
    </section>
  );
}
