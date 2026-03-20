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
    bundle_fingerprint?: string;
    issues_reviewed?: boolean;
    total_upload_bytes?: number;
    metrics_totals?: {
      read_bytes: number;
      write_bytes: number;
      operations: number;
    };
    metrics_samples?: Array<{
      at: string;
      read_bps: number;
      write_bps: number;
      operations_per_sec: number;
      read_bytes_total: number;
      write_bytes_total: number;
      operations_total: number;
    }>;
    events?: Array<{
      at: string;
      message: string;
    }>;
  } | null;
};

export type FailedIngestionItem = {
  asset_id: string;
  filename: string;
  media_type: string;
  processing_state: string | null;
  error_message: string | null;
  source_path: string | null;
  available_path: string | null;
};

export type IngestionJobsListResponse = {
  items: IngestionJob[];
  total: number;
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

async function fetchRecentIngestionJobs(limit: number): Promise<IngestionJobsListResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  const response = await fetch(`/api/ingest/recent?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Recent ingestion request failed with ${response.status}`);
  }

  return (await response.json()) as IngestionJobsListResponse;
}

async function retryIngestionJob(jobId: string): Promise<IngestionStartResponse> {
  const response = await fetch(`/api/ingest/${jobId}/retry`, {
    method: "POST",
  });

  if (!response.ok) {
    let detail = `Retry request failed with ${response.status}`;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) {
        detail = payload.detail;
      }
    } catch {
      // keep fallback
    }
    throw new Error(detail);
  }

  return (await response.json()) as IngestionStartResponse;
}

async function fetchFailedIngestionItems(jobId: string): Promise<{ items: FailedIngestionItem[]; total: number }> {
  const response = await fetch(`/api/ingest/${jobId}/failed-items`);
  if (!response.ok) {
    throw new Error(`Failed-items request failed with ${response.status}`);
  }

  return (await response.json()) as { items: FailedIngestionItem[]; total: number };
}

async function acknowledgeIngestionIssues(jobId: string): Promise<IngestionJob> {
  const response = await fetch(`/api/ingest/${jobId}/acknowledge-issues`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Acknowledge request failed with ${response.status}`);
  }

  return (await response.json()) as IngestionJob;
}

async function clearIngestionHistory(): Promise<{ status: string; message: string; affected_items: number }> {
  const response = await fetch("/api/ingest/history", {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Clear history request failed with ${response.status}`);
  }

  return (await response.json()) as { status: string; message: string; affected_items: number };
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

export function useRecentIngestionJobs(limit: number = 8) {
  return useQuery({
    queryKey: ["recent-ingestion-jobs", limit],
    queryFn: () => fetchRecentIngestionJobs(limit),
    staleTime: 5_000,
    refetchInterval: 5_000,
  });
}

export function useRetryIngestionJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: retryIngestionJob,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["recent-ingestion-jobs"] });
    },
  });
}

export function useFailedIngestionItems(jobId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["ingestion-failed-items", jobId],
    queryFn: () => fetchFailedIngestionItems(jobId ?? ""),
    enabled: Boolean(jobId) && enabled,
    staleTime: 5_000,
    refetchInterval: enabled ? 5_000 : false,
  });
}

export function useAcknowledgeIngestionIssues() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: acknowledgeIngestionIssues,
    onSuccess: (job) => {
      queryClient.setQueryData(["ingestion-job", job.id], job);
      void queryClient.invalidateQueries({ queryKey: ["ingestion-failed-items", job.id] });
      void queryClient.invalidateQueries({ queryKey: ["recent-ingestion-jobs"] });
    },
  });
}

export function useClearIngestionHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: clearIngestionHistory,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["recent-ingestion-jobs"] });
    },
  });
}
