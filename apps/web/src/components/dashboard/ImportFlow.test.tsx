import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import ImportFlow from "./ImportFlow";

const useActiveIngestion = vi.fn();
const useCancelIngestionJob = vi.fn();
const useRetryIngestionJob = vi.fn();
const useAcknowledgeIngestionIssues = vi.fn();
const useClearIngestionHistory = vi.fn();
const useRecentIngestionJobs = vi.fn();
const useFailedIngestionItems = vi.fn();

vi.mock("../../hooks/useActiveIngestion", () => ({
  useActiveIngestion: () => useActiveIngestion(),
}));

vi.mock("../../hooks/useIngestionJob", () => ({
  isTerminalIngestionStatus: (status: string) => ["completed", "failed", "canceled"].includes(status),
  useCancelIngestionJob: () => useCancelIngestionJob(),
  useRetryIngestionJob: () => useRetryIngestionJob(),
  useAcknowledgeIngestionIssues: () => useAcknowledgeIngestionIssues(),
  useClearIngestionHistory: () => useClearIngestionHistory(),
  useRecentIngestionJobs: (...args: unknown[]) => useRecentIngestionJobs(...args),
  useFailedIngestionItems: (...args: unknown[]) => useFailedIngestionItems(...args),
}));

describe("ImportFlow", () => {
  it("renders failed item diagnostics and recovery actions for partial imports", async () => {
    const job = {
      id: "job-1",
      source_kind: "upload",
      source_name: "snap-export-batch",
      source_path: "/srv/snapcapsule/ingest/upload-bundle",
      workspace_path: null,
      celery_task_id: "task-1",
      status: "failed",
      detail_message: "Completed with issues",
      progress_percent: 100,
      total_assets: 12,
      processed_assets: 10,
      failed_assets: 2,
      error_message: "ffmpeg probe failed",
      created_at: "2026-03-27T10:00:00Z",
      updated_at: "2026-03-27T10:05:00Z",
      finished_at: "2026-03-27T10:06:00Z",
      raw_metadata: {
        uploaded_filenames: ["part-001.zip", "part-002.zip"],
        issues_reviewed: false,
        metrics_totals: {
          read_bytes: 0,
          write_bytes: 0,
          operations: 0,
        },
        metrics_samples: [],
      },
    };

    const clearFinishedJob = vi.fn();
    const setTrackedJobId = vi.fn();
    const retryMutateAsync = vi.fn().mockResolvedValue({
      job_id: "job-2",
      task_id: "task-2",
      status: "queued",
      message: "Queued",
    });
    const acknowledgeMutateAsync = vi.fn().mockResolvedValue({
      ...job,
      raw_metadata: {
        ...job.raw_metadata,
        issues_reviewed: true,
      },
    });
    const refetch = vi.fn().mockResolvedValue(undefined);

    useActiveIngestion.mockReturnValue({
      activeJob: null,
      activeJobId: null,
      clearFinishedJob,
      finishedJob: job,
      isRestoringActiveJob: false,
      resumeError: null,
      setTrackedJobId,
    });
    useCancelIngestionJob.mockReturnValue({
      isPending: false,
      mutate: vi.fn(),
    });
    useRetryIngestionJob.mockReturnValue({
      isPending: false,
      mutateAsync: retryMutateAsync,
    });
    useAcknowledgeIngestionIssues.mockReturnValue({
      isPending: false,
      mutateAsync: acknowledgeMutateAsync,
    });
    useClearIngestionHistory.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    });
    useRecentIngestionJobs.mockReturnValue({
      data: { items: [job], total: 1 },
      refetch,
    });
    useFailedIngestionItems.mockReturnValue({
      isLoading: false,
      data: {
        items: [
          {
            asset_id: "asset-1",
            filename: "broken-video.mp4",
            media_type: "video",
            processing_state: "failed_probe",
            error_message: "ffmpeg probe failed",
            source_path: "/srv/source/broken-video.mp4",
            available_path: "/srv/source/broken-video.mp4",
          },
        ],
        total: 1,
      },
    });

    render(<ImportFlow onRefreshDashboard={vi.fn()} />);

    expect(screen.getByText("Failed Items")).toBeInTheDocument();
    expect(screen.getByText("broken-video.mp4")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open file" })).toHaveAttribute(
      "href",
      "/api/ingest/job-1/failed-items/asset-1/file",
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry import" }));

    await waitFor(() => {
      expect(retryMutateAsync).toHaveBeenCalledWith("job-1");
    });
    expect(setTrackedJobId).toHaveBeenCalledWith("job-2");

    fireEvent.click(screen.getByRole("button", { name: "Mark issues reviewed" }));

    await waitFor(() => {
      expect(acknowledgeMutateAsync).toHaveBeenCalledWith("job-1");
    });
    await waitFor(() => {
      expect(refetch).toHaveBeenCalled();
    });
  });
});
