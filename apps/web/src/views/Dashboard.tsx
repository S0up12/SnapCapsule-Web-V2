import { LoaderCircle } from "lucide-react";

import DashboardStats from "../components/dashboard/DashboardStats";
import ImportFlow from "../components/dashboard/ImportFlow";
import { useDashboardStats } from "../hooks/useDashboardStats";

function DashboardLoading() {
  return (
    <section className="mx-auto flex min-h-[36rem] w-full max-w-[1520px] items-center justify-center rounded-[2rem] border border-white/10 bg-white/[0.035]">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-sky-300/20 bg-sky-300/[0.12] text-sky-100">
          <LoaderCircle className="h-9 w-9 animate-spin" />
        </div>
        <h2 className="mt-6 text-2xl font-semibold text-white">Loading</h2>
      </div>
    </section>
  );
}

export default function Dashboard() {
  const statsQuery = useDashboardStats();

  if (statsQuery.isLoading) {
    return <DashboardLoading />;
  }

  if (statsQuery.isError) {
    return (
      <section className="mx-auto flex w-full max-w-[1520px] flex-col gap-6">
        <div className="rounded-[1.6rem] border border-rose-400/20 bg-rose-400/10 px-5 py-4 text-sm text-rose-100">
          {statsQuery.error instanceof Error ? statsQuery.error.message : "Failed to load dashboard stats."}
        </div>
      </section>
    );
  }

  if (!statsQuery.data || statsQuery.data.total_assets === 0) {
    return <ImportFlow onRefreshDashboard={() => void statsQuery.refetch()} />;
  }

  return <DashboardStats stats={statsQuery.data} onRefreshDashboard={() => void statsQuery.refetch()} />;
}
