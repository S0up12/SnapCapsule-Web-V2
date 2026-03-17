import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type SystemStatus = {
  worker_state: "offline" | "idle" | "processing" | string;
  worker_label: string;
  workers_online: number;
  active_tasks: number;
  queued_tasks: number;
  debug_logging_enabled: boolean;
};

export type SystemActionResponse = {
  status: string;
  message: string;
  affected_items: number;
};

async function fetchSystemStatus(): Promise<SystemStatus> {
  const response = await fetch("/api/system/status");
  if (!response.ok) {
    throw new Error(`System status request failed with ${response.status}`);
  }

  return (await response.json()) as SystemStatus;
}

async function postSystemAction(path: string): Promise<SystemActionResponse> {
  const response = await fetch(path, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`System action failed with ${response.status}`);
  }

  return (await response.json()) as SystemActionResponse;
}

export function useSystemStatus() {
  return useQuery({
    queryKey: ["system-status"],
    queryFn: fetchSystemStatus,
    staleTime: 10_000,
    refetchInterval: 10_000,
  });
}

export function useSystemAction(path: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => postSystemAction(path),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["system-status"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      void queryClient.invalidateQueries({ queryKey: ["timeline"] });
    },
  });
}
