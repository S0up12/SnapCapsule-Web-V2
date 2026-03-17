import { useQuery } from "@tanstack/react-query";

export type DashboardStats = {
  total_assets: number;
  total_memories: number;
  total_photos: number;
  total_videos: number;
};

async function fetchDashboardStats(): Promise<DashboardStats> {
  const response = await fetch("/api/stats");
  if (!response.ok) {
    throw new Error(`Stats request failed with ${response.status}`);
  }

  return (await response.json()) as DashboardStats;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchDashboardStats,
    staleTime: 15_000,
  });
}
