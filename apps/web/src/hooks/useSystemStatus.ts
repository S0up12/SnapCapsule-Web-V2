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

export type LibraryDiagnostics = {
  storage: {
    raw_media_bytes: number;
    thumbnail_bytes: number;
    playback_cache_bytes: number;
    ingest_workspace_bytes: number;
    ingest_upload_bytes: number;
    total_bytes: number;
  };
  integrity: {
    total_assets: number;
    video_assets: number;
    playback_derivatives: number;
    orphaned_playback_files: number;
    missing_original_files: number;
    missing_thumbnail_files: number;
    missing_overlay_files: number;
    playback_error_assets: number;
  };
};

async function fetchSystemStatus(): Promise<SystemStatus> {
  const response = await fetch("/api/system/status");
  if (!response.ok) {
    throw new Error(`System status request failed with ${response.status}`);
  }

  return (await response.json()) as SystemStatus;
}

async function fetchLibraryDiagnostics(): Promise<LibraryDiagnostics> {
  const response = await fetch("/api/system/library");
  if (!response.ok) {
    throw new Error(`Library diagnostics request failed with ${response.status}`);
  }

  return (await response.json()) as LibraryDiagnostics;
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

export function useLibraryDiagnostics() {
  return useQuery({
    queryKey: ["library-diagnostics"],
    queryFn: fetchLibraryDiagnostics,
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
      void queryClient.invalidateQueries({ queryKey: ["library-diagnostics"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      void queryClient.invalidateQueries({ queryKey: ["timeline"] });
    },
  });
}
