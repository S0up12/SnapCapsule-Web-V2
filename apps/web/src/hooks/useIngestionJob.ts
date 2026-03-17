import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type IngestionJobStatus =
  | "queued"
  | "extracting"
  | "parsing"
  | "processing_media"
  | "completed"
  | "canceled"
  | "failed";

export type IngestionStartResponse = {
  job_id: string;
  task_id: string;
  status: IngestionJobStatus;
  message: string;
};

export type IngestionJob = {
  id: string;
  source_kind: "upload" | "directory";
  source_name: string;
  source_path: string;
  workspace_path: string | null;
  celery_task_id: string | null;
  status: IngestionJobStatus;
  detail_message: string | null;
  progress_percent: number;
  total_assets: number;
  processed_assets: number;
  failed_assets: number;
  error_message: string | null;
  created_at: string | null;
  updated_at: string | null;
  finished_at: string | null;
  raw_metadata: {
    archive_count?: number;
    uploaded_filenames?: string[];
  } | null;
};

async function fetchIngestionJob(jobId: string): Promise<IngestionJob> {
  const params = new URLSearchParams({ job_id: jobId });
  const response = await fetch(`/api/ingest/status?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Ingestion status request failed with ${response.status}`);
  }

  return (await response.json()) as IngestionJob;
}

async function cancelIngestionJob(jobId: string): Promise<IngestionJob> {
  const response = await fetch("/api/ingest/cancel", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ job_id: jobId }),
  });

  if (!response.ok) {
    throw new Error(`Cancel request failed with ${response.status}`);
  }

  return (await response.json()) as IngestionJob;
}

export function isTerminalIngestionStatus(status: IngestionJobStatus) {
  return status === "completed" || status === "failed" || status === "canceled";
}

export function useIngestionJob(jobId: string | null) {
  return useQuery({
    queryKey: ["ingestion-job", jobId],
    queryFn: () => fetchIngestionJob(jobId ?? ""),
    enabled: Boolean(jobId),
    staleTime: 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && isTerminalIngestionStatus(status) ? false : 2_000;
    },
  });
}

export function useCancelIngestionJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelIngestionJob,
    onSuccess: (job) => {
      queryClient.setQueryData(["ingestion-job", job.id], job);
    },
  });
}
