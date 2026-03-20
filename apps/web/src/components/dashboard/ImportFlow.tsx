import { AlertCircle, Ban, CheckCheck, Clock3, ExternalLink, FolderArchive, LoaderCircle, RefreshCw, RotateCcw, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useId, useRef, useState, type ChangeEvent, type DragEvent } from "react";

import {
  useAcknowledgeIngestionIssues,
  useClearIngestionHistory,
  useFailedIngestionItems,
  isTerminalIngestionStatus,
  useCancelIngestionJob,
  useRecentIngestionJobs,
  useRetryIngestionJob,
  type IngestionJob,
  type IngestionStartResponse,
} from "../../hooks/useIngestionJob";
import { useActiveIngestion } from "../../hooks/useActiveIngestion";

type ImportFlowProps = {
  onRefreshDashboard: () => void;
  variant?: "full" | "compact";
};

type UploadState =
  | { stage: "idle"; message?: string }
  | { stage: "uploading"; message: string }
  | { stage: "error"; message: string };

function isPartialImportSuccess(job: IngestionJob) {
  return job.status === "failed" && job.processed_assets > 0 && job.failed_assets > 0 && job.total_assets > job.failed_assets;
}

function hasReviewedIssues(job: IngestionJob) {
  return Boolean(job.raw_metadata?.issues_reviewed);
}

function statusHeading(job: IngestionJob) {
  if (isPartialImportSuccess(job) && hasReviewedIssues(job)) {
    return "Background ingestion completed";
  }
  if (isPartialImportSuccess(job)) {
    return "Background ingestion completed with minor issues";
  }

  switch (job.status) {
    case "queued":
      return "Queued for background work";
    case "extracting":
      return "Extracting uploaded archives";
    case "parsing":
      return "Parsing Snapchat export data";
    case "processing_media":
      return "Processing media files";
    case "completed":
      return "Background ingestion completed";
    case "canceled":
      return "Background ingestion canceled";
    case "failed":
      return "Background ingestion failed";
    default:
      return "Background ingestion running";
  }
}

function statusTone(job: IngestionJob) {
  if (job.status === "completed" || (isPartialImportSuccess(job) && hasReviewedIssues(job))) {
    return {
      ring: "border-emerald-300/30 bg-emerald-100 text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-300/[0.12] dark:text-emerald-100",
      bar: "bg-emerald-300",
      chip: "border-emerald-300/30 bg-emerald-50 text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-300/[0.1] dark:text-emerald-100",
    };
  }
  if (isPartialImportSuccess(job)) {
    return {
      ring: "border-amber-300/30 bg-amber-100 text-amber-700 dark:border-amber-300/20 dark:bg-amber-300/[0.12] dark:text-amber-100",
      bar: "bg-amber-300",
      chip: "border-amber-300/30 bg-amber-50 text-amber-700 dark:border-amber-300/20 dark:bg-amber-300/[0.1] dark:text-amber-100",
    };
  }
  if (job.status === "failed" || job.status === "canceled") {
    return {
      ring: "border-rose-300/30 bg-rose-100 text-rose-700 dark:border-rose-300/20 dark:bg-rose-300/[0.12] dark:text-rose-100",
      bar: "bg-rose-300",
      chip: "border-rose-300/30 bg-rose-50 text-rose-700 dark:border-rose-300/20 dark:bg-rose-300/[0.1] dark:text-rose-100",
    };
  }
  return {
    ring: "border-sky-300/30 bg-sky-100 text-sky-700 dark:border-sky-300/20 dark:bg-sky-300/[0.12] dark:text-sky-100",
    bar: "bg-sky-300",
    chip: "border-sky-300/30 bg-sky-50 text-sky-700 dark:border-sky-300/20 dark:bg-sky-300/[0.1] dark:text-sky-100",
  };
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusShortLabel(job: IngestionJob) {
  if (isPartialImportSuccess(job) && hasReviewedIssues(job)) {
    return "Completed";
  }
  if (isPartialImportSuccess(job)) {
    return "Completed with issues";
  }

  switch (job.status) {
    case "queued":
      return "Queued";
    case "extracting":
      return "Extracting";
    case "parsing":
      return "Parsing";
    case "processing_media":
      return "Processing";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "canceled":
      return "Canceled";
    default:
      return "Unknown";
  }
}

function recoveryHint(job: IngestionJob) {
  if (!isTerminalIngestionStatus(job.status)) {
    return "This import keeps running in the background. Refreshing the page or switching views will not interrupt it.";
  }
  if (isPartialImportSuccess(job) && hasReviewedIssues(job)) {
    return "This import is ready to browse. A small number of failed items were reviewed, and you can still inspect them below if needed.";
  }
  if (isPartialImportSuccess(job)) {
    return "Most of this import finished successfully. A small number of media items could not be processed, but the rest of the archive is ready to browse.";
  }
  if (job.status === "failed") {
    return "This import ended with an error. You can review the source details below and retry the same source if it is still available.";
  }
  if (job.status === "canceled") {
    return "This import was canceled before finishing. You can retry the same source when you are ready.";
  }
  return "This import finished successfully. The archive is already available, but you can still rerun the same source if needed.";
}

function jobCanRetry(job: IngestionJob) {
  return isTerminalIngestionStatus(job.status);
}

function phaseLabel(job: IngestionJob) {
  switch (job.status) {
    case "extracting":
      return "Extraction";
    case "parsing":
      return "Parsing";
    case "processing_media":
      return "Media processing";
    case "queued":
      return "Queued";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "canceled":
      return "Canceled";
    default:
      return "Import";
  }
}

function formatRate(bytesPerSecond: number) {
  const value = Math.max(0, bytesPerSecond);
  if (value >= 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB/s`;
  }
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB/s`;
  }
  if (value >= 1024) {
    return `${(value / 1024).toFixed(1)} KB/s`;
  }
  return `${value.toFixed(0)} B/s`;
}

function formatCountRate(value: number) {
  const normalized = Math.max(0, value);
  return normalized >= 10 ? `${normalized.toFixed(0)}/s` : `${normalized.toFixed(1)}/s`;
}

function formatBytes(value: number) {
  const absolute = Math.max(0, value);
  if (absolute >= 1024 * 1024 * 1024) {
    return `${(absolute / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (absolute >= 1024 * 1024) {
    return `${(absolute / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (absolute >= 1024) {
    return `${(absolute / 1024).toFixed(1)} KB`;
  }
  return `${absolute.toFixed(0)} B`;
}

function buildMetricPath(values: number[]) {
  if (values.length === 0) {
    return "";
  }

  const maxValue = Math.max(...values, 1);
  const baselineY = 34;
  return values
    .map((value, index) => {
      const x = values.length === 1 ? 100 : (index / (values.length - 1)) * 100;
      const y = baselineY - (value / maxValue) * 26;
      return `${x},${Math.max(6, Math.min(baselineY, y)).toFixed(2)}`;
    })
    .join(" ");
}

function MetricGraph({
  label,
  value,
  secondary,
  samples,
  toneClassName,
}: {
  label: string;
  value: string;
  secondary: string;
  samples: number[];
  toneClassName: string;
}) {
  const points = buildMetricPath(samples);
  const baselineY = 34;
  const areaPoints = points ? `0,${baselineY} ${points} 100,${baselineY}` : "";

  return (
    <div className="rounded-[1.25rem] border border-slate-200/80 bg-slate-50/90 px-4 py-3 text-left dark:border-white/10 dark:bg-[#0b141d]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{label}</p>
        <p className={`text-sm font-semibold ${toneClassName}`}>{value}</p>
      </div>
      <svg viewBox="0 0 100 40" className="mt-3 h-20 w-full overflow-visible">
        {areaPoints ? <polygon points={areaPoints} className={toneClassName} fill="currentColor" fillOpacity="0.5" /> : null}
        {points ? (
          <polyline
            points={points}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
            strokeLinecap="round"
            className={toneClassName}
          />
        ) : (
          <line x1="0" y1={baselineY} x2="100" y2={baselineY} className={`${toneClassName} opacity-40`} stroke="currentColor" strokeWidth="2" />
        )}
      </svg>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{secondary}</p>
    </div>
  );
}

export default function ImportFlow({ onRefreshDashboard, variant = "full" }: ImportFlowProps) {
  const inputId = useId();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>({ stage: "idle" });
  const {
    activeJob,
    activeJobId,
    clearFinishedJob,
    finishedJob: lastFinishedJob,
    isRestoringActiveJob: isResumingActiveJob,
    resumeError,
    setTrackedJobId,
  } = useActiveIngestion();
  const cancelMutation = useCancelIngestionJob();
  const isCompact = variant === "compact";
  const retryMutation = useRetryIngestionJob();
  const acknowledgeIssuesMutation = useAcknowledgeIngestionIssues();
  const clearHistoryMutation = useClearIngestionHistory();
  const recentJobsQuery = useRecentIngestionJobs(isCompact ? 5 : 8);
  const lastRefreshedCompletedJobId = useRef<string | null>(null);
  const recentJobs = recentJobsQuery.data?.items ?? [];
  const recentFinishedJob = lastFinishedJob ? recentJobs.find((job) => job.id === lastFinishedJob.id) ?? null : null;

  useEffect(() => {
    if (!lastFinishedJob) {
      return;
    }

    setUploadState({ stage: "idle" });

    if (lastFinishedJob.status === "completed" && lastRefreshedCompletedJobId.current !== lastFinishedJob.id) {
      lastRefreshedCompletedJobId.current = lastFinishedJob.id;
      onRefreshDashboard();
    }
  }, [lastFinishedJob, onRefreshDashboard]);

  useEffect(() => {
    if (!resumeError) {
      return;
    }

    setUploadState({
      stage: "error",
      message: resumeError,
    });
  }, [resumeError]);

  async function uploadArchives(files: File[]) {
    const validFiles = files.filter((file) => file.name.toLowerCase().endsWith(".zip"));
    if (validFiles.length === 0) {
      setUploadState({ stage: "error", message: "Please upload one or more Snapchat export ZIP files." });
      return;
    }

    const rejectedCount = files.length - validFiles.length;
    const formData = new FormData();
    for (const file of validFiles) {
      formData.append("archives", file);
    }

    clearFinishedJob();
    setUploadState({
      stage: "uploading",
      message:
        validFiles.length === 1
          ? "Uploading archive to server..."
          : `Uploading ${validFiles.length} archives to one ingestion job...`,
    });

    try {
      const response = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let message = `Upload failed with ${response.status}`;
        try {
          const payload = (await response.json()) as { detail?: string };
          if (payload.detail) {
            message = payload.detail;
          }
        } catch {
          // Keep the fallback message.
        }
        throw new Error(message);
      }

      const payload = (await response.json()) as IngestionStartResponse;
      setTrackedJobId(payload.job_id);
      setUploadState({
        stage: "idle",
        message:
          rejectedCount > 0
            ? `${rejectedCount} non-ZIP file${rejectedCount === 1 ? " was" : "s were"} ignored.`
            : undefined,
      });
    } catch (error) {
      setUploadState({
        stage: "error",
        message: error instanceof Error ? error.message : "Upload failed",
      });
    }
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    void uploadArchives(Array.from(fileList));
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    handleFiles(event.target.files);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    if (showLiveJob || uploadState.stage === "uploading") {
      return;
    }
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }
    setIsDragging(false);
  }

  function handleGuardedDrop(event: DragEvent<HTMLLabelElement>) {
    if (showLiveJob || uploadState.stage === "uploading") {
      event.preventDefault();
      return;
    }
    handleDrop(event);
  }

  const liveJob = activeJob ?? recentFinishedJob ?? lastFinishedJob;
  const liveJobTone = liveJob ? statusTone(liveJob) : null;
  const showLiveJob = uploadState.stage !== "uploading" && (liveJob !== null || isResumingActiveJob);
  const diagnosticJob = liveJob;
  const metricSamples = liveJob?.raw_metadata?.metrics_samples ?? [];
  const metricTotals = liveJob?.raw_metadata?.metrics_totals ?? null;
  const showFailedItems = Boolean(
    diagnosticJob &&
      isTerminalIngestionStatus(diagnosticJob.status) &&
      diagnosticJob.failed_assets > 0,
  );
  const failedItemsQuery = useFailedIngestionItems(diagnosticJob?.id ?? null, showFailedItems);
  const failedItems = failedItemsQuery.data?.items ?? [];
  const issuesReviewed = Boolean(diagnosticJob?.raw_metadata?.issues_reviewed);

  async function handleRetry(job: IngestionJob) {
    try {
      const payload = await retryMutation.mutateAsync(job.id);
      setTrackedJobId(payload.job_id);
      setUploadState({ stage: "idle" });
    } catch (error) {
      setUploadState({
        stage: "error",
        message: error instanceof Error ? error.message : "Retry failed",
      });
    }
  }

  async function handleAcknowledgeIssues(job: IngestionJob) {
    try {
      await acknowledgeIssuesMutation.mutateAsync(job.id);
      setUploadState({ stage: "idle" });
      void recentJobsQuery.refetch();
    } catch (error) {
      setUploadState({
        stage: "error",
        message: error instanceof Error ? error.message : "Failed to update import issues",
      });
    }
  }

  async function handleClearHistory() {
    try {
      await clearHistoryMutation.mutateAsync();
      if (!activeJob && diagnosticJob && isTerminalIngestionStatus(diagnosticJob.status)) {
        clearFinishedJob();
      }
      setUploadState({ stage: "idle" });
    } catch (error) {
      setUploadState({
        stage: "error",
        message: error instanceof Error ? error.message : "Failed to clear import history",
      });
    }
  }

  return (
    <section className={`mx-auto flex w-full ${isCompact ? "max-w-none" : "max-w-[1520px]"} flex-col gap-6`}>
      {!isCompact ? (
        <div className="overflow-hidden rounded-[2.25rem] border border-slate-200/80 bg-[linear-gradient(135deg,_rgba(255,255,255,0.96),_rgba(235,245,255,0.95),_rgba(222,236,249,0.98))] shadow-[0_28px_80px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-[linear-gradient(135deg,_rgba(7,14,24,0.98),_rgba(7,25,40,0.92),_rgba(4,8,14,0.98))] dark:shadow-2xl dark:shadow-black/30">
          <div className="grid gap-8 px-6 py-8 md:px-10 md:py-10 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-sky-700/70 dark:text-sky-200/70">
                {showLiveJob ? "Ingestion Activity" : "First Import"}
              </p>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 dark:text-white md:text-5xl">
                {showLiveJob
                  ? "Your import is running in the background."
                  : "Add your Snapchat export ZIP files."}
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                {showLiveJob
                  ? "You can refresh the page at any time and SnapCapsule will reconnect to the current import until it finishes."
                  : "Drop one or more exported Snapchat ZIP files here and SnapCapsule will process them in the background."}
              </p>
            </div>

            <div className="rounded-[1.9rem] border border-slate-200/80 bg-white/70 p-5 backdrop-blur dark:border-sky-300/10 dark:bg-white/[0.045]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">How It Works</p>
              <div className="mt-4 grid gap-3 text-sm text-slate-600 dark:text-slate-300">
                <div className="rounded-[1.2rem] border border-slate-200/80 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-black/15">
                  1. Upload one ZIP or a full multi-part batch together.
                </div>
                <div className="rounded-[1.2rem] border border-slate-200/80 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-black/15">
                  2. SnapCapsule processes the import in the background.
                </div>
                <div className="rounded-[1.2rem] border border-slate-200/80 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-black/15">
                  3. You can come back later and keep using the app while it finishes.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <label
        htmlFor={inputId}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleGuardedDrop}
        className={[
          "group flex flex-col items-center justify-center rounded-[2rem] border border-dashed px-6 py-8 text-center transition",
          showLiveJob || uploadState.stage === "uploading" ? "cursor-default" : "cursor-pointer",
          isCompact ? "min-h-[20rem]" : "min-h-[30rem]",
          isDragging
            ? "border-sky-300/50 bg-sky-100/80 shadow-[0_25px_60px_rgba(8,47,73,0.14)] dark:bg-sky-300/[0.08] dark:shadow-[0_25px_60px_rgba(8,47,73,0.35)]"
            : "border-slate-200/80 bg-white/78 hover:border-sky-300/35 hover:bg-sky-50/80 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-sky-300/25 dark:hover:bg-white/[0.05]",
        ].join(" ")}
      >
        <input
          id={inputId}
          type="file"
          accept=".zip,application/zip"
          multiple
          className="sr-only"
          onChange={handleInputChange}
          disabled={showLiveJob || uploadState.stage === "uploading"}
        />

        {uploadState.stage === "uploading" ? (
          <div className="flex flex-col items-center">
            <div
              className={[
                "flex items-center justify-center rounded-full border border-sky-300/30 bg-sky-100 text-sky-700 dark:border-sky-300/20 dark:bg-sky-300/[0.12] dark:text-sky-100",
                isCompact ? "h-16 w-16" : "h-20 w-20",
              ].join(" ")}
            >
              <LoaderCircle className="h-9 w-9 animate-spin" />
            </div>
            <h2 className={`mt-6 font-semibold text-slate-950 dark:text-white ${isCompact ? "text-xl" : "text-2xl"}`}>{uploadState.message}</h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-400">
              Your files are being uploaded now. Once that is done, the import will continue in the background.
            </p>
          </div>
        ) : isResumingActiveJob ? (
          <div className="flex flex-col items-center">
            <div
              className={[
                "flex items-center justify-center rounded-full border border-sky-300/30 bg-sky-100 text-sky-700 dark:border-sky-300/20 dark:bg-sky-300/[0.12] dark:text-sky-100",
                isCompact ? "h-16 w-16" : "h-20 w-20",
              ].join(" ")}
            >
              <LoaderCircle className="h-9 w-9 animate-spin" />
            </div>
            <h2 className={`mt-6 font-semibold text-slate-950 dark:text-white ${isCompact ? "text-xl" : "text-2xl"}`}>
              Restoring import progress
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-400">
              SnapCapsule found an active import and is restoring its current progress.
            </p>
          </div>
        ) : showLiveJob && liveJob && liveJobTone ? (
          <div className="flex max-w-4xl flex-col items-center">
            <div
              className={[
                "flex items-center justify-center rounded-full border",
                liveJobTone.ring,
                isCompact ? "h-16 w-16" : "h-20 w-20",
              ].join(" ")}
            >
              {isTerminalIngestionStatus(liveJob.status) ? (
                liveJob.status === "canceled" ? (
                  <Ban className="h-9 w-9" />
                ) : (
                  <UploadCloud className="h-9 w-9" />
                )
              ) : (
                <LoaderCircle className="h-9 w-9 animate-spin" />
              )}
            </div>
            <h2 className={`mt-6 font-semibold text-slate-950 dark:text-white ${isCompact ? "text-xl" : "text-2xl"}`}>
              {statusHeading(liveJob)}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
              {isPartialImportSuccess(liveJob)
                ? `${liveJob.processed_assets.toLocaleString()} of ${liveJob.total_assets.toLocaleString()} media items were processed successfully. ${liveJob.failed_assets.toLocaleString()} item${liveJob.failed_assets === 1 ? "" : "s"} ${hasReviewedIssues(liveJob) ? "were skipped after review." : "need attention."}`
                : liveJob.error_message ?? liveJob.detail_message ?? "The ingestion worker is updating the archive."}
            </p>
            <div className="mt-6 grid w-full gap-3 md:grid-cols-3">
              <MetricGraph
                label="Read"
                value={formatRate(metricSamples.at(-1)?.read_bps ?? 0)}
                secondary={`Total ${formatBytes(metricTotals?.read_bytes ?? 0)}`}
                samples={metricSamples.map((sample) => sample.read_bps)}
                toneClassName="text-sky-500 dark:text-sky-300"
              />
              <MetricGraph
                label="Write"
                value={formatRate(metricSamples.at(-1)?.write_bps ?? 0)}
                secondary={`Total ${formatBytes(metricTotals?.write_bytes ?? 0)}`}
                samples={metricSamples.map((sample) => sample.write_bps)}
                toneClassName="text-emerald-500 dark:text-emerald-300"
              />
              <MetricGraph
                label="Operations"
                value={formatCountRate(metricSamples.at(-1)?.operations_per_sec ?? 0)}
                secondary={`Total ${Math.max(0, metricTotals?.operations ?? 0).toLocaleString()} actions`}
                samples={metricSamples.map((sample) => sample.operations_per_sec)}
                toneClassName="text-violet-500 dark:text-violet-300"
              />
            </div>
            <div className="mt-6 w-full max-w-xl">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                <span>{phaseLabel(liveJob)}</span>
                <span>{liveJob.progress_percent}%</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ${liveJobTone.bar}`}
                  style={{ width: `${Math.max(4, liveJob.progress_percent)}%` }}
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {liveJob.total_assets > 0 ? (
                <p className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] ${liveJobTone.chip}`}>
                  {liveJob.processed_assets}/{liveJob.total_assets} processed
                </p>
              ) : null}
              {liveJob.failed_assets > 0 ? (
                <p className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] ${liveJobTone.chip}`}>
                  {liveJob.failed_assets} failed
                </p>
              ) : null}
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {isTerminalIngestionStatus(liveJob.status) ? (
                <>
                  <button
                    type="button"
                    onClick={onRefreshDashboard}
                    className="inline-flex items-center gap-2 rounded-[1rem] border border-sky-300/30 bg-sky-100 px-4 py-3 text-sm font-medium text-sky-900 transition hover:border-sky-300/45 hover:bg-sky-200/70 dark:border-sky-300/20 dark:bg-sky-300/[0.1] dark:text-sky-100 dark:hover:border-sky-300/35 dark:hover:bg-sky-300/[0.16]"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh dashboard
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearFinishedJob();
                      setUploadState({ stage: "idle" });
                    }}
                    className="inline-flex items-center gap-2 rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-white/15 dark:hover:bg-white/[0.08]"
                  >
                    Upload more ZIPs
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!activeJobId) {
                      return;
                    }
                    cancelMutation.mutate(activeJobId);
                  }}
                  disabled={cancelMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-[1rem] border border-rose-300/30 bg-rose-100 px-4 py-3 text-sm font-medium text-rose-700 transition hover:border-rose-300/45 hover:bg-rose-200/70 disabled:cursor-not-allowed disabled:opacity-70 dark:border-rose-300/20 dark:bg-rose-300/[0.1] dark:text-rose-100 dark:hover:border-rose-300/35 dark:hover:bg-rose-300/[0.16]"
                >
                  {cancelMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                  Cancel ingestion
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex max-w-3xl flex-col items-center">
            <div
              className={[
                "flex items-center justify-center rounded-[2rem] border border-sky-300/30 bg-sky-100 text-sky-700 shadow-[0_20px_45px_rgba(15,23,42,0.08)] transition group-hover:scale-[1.02] group-hover:border-sky-300/45 group-hover:bg-sky-200/70 dark:border-white/10 dark:bg-white/[0.05] dark:text-sky-100 dark:shadow-xl dark:shadow-black/25 dark:group-hover:border-sky-300/20 dark:group-hover:bg-sky-300/[0.08]",
                isCompact ? "h-20 w-20" : "h-24 w-24",
              ].join(" ")}
            >
              <UploadCloud className="h-10 w-10" />
            </div>
            <h2 className={`mt-6 font-semibold tracking-tight text-slate-950 dark:text-white ${isCompact ? "text-2xl" : "text-3xl"}`}>
              {isCompact ? "Add more Snapchat Export .zip files" : "Drag and drop your Snapchat Export .zip files here"}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-400">
              {isCompact
                ? "Drop one or more ZIP files here, or click to browse."
                : "You can also click anywhere in this area to browse for one or more ZIP files from your computer."}
            </p>
            <div className="mt-6 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:border-white/10 dark:bg-black/20">
              Multi-part ZIP batches supported
            </div>
            {uploadState.stage !== "error" && uploadState.message ? (
              <div className="mt-6 rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-black/20 dark:text-slate-300">
                {uploadState.message}
              </div>
            ) : null}
            {uploadState.stage === "error" ? (
              <div className="mt-6 rounded-[1.2rem] border border-rose-300/40 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-100">
                {uploadState.message}
              </div>
            ) : null}
          </div>
        )}
      </label>

      {(diagnosticJob || recentJobs.length > 0) ? (
        <div className={`grid gap-4 ${diagnosticJob ? "xl:grid-cols-[1.05fr_0.95fr]" : ""}`}>
          {diagnosticJob ? (
            <section className="rounded-[1.7rem] border border-slate-200/80 bg-white/88 p-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-xl dark:shadow-black/20">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Import Details</p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{diagnosticJob.source_name}</h3>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] ${statusTone(diagnosticJob).chip}`}>
                  {statusShortLabel(diagnosticJob)}
                </span>
              </div>

              <div className="mt-5 rounded-[1.2rem] border border-slate-200/80 bg-slate-50 px-4 py-4 dark:border-white/10 dark:bg-black/15">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-slate-500 dark:text-slate-300" />
                  <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{recoveryHint(diagnosticJob)}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.2rem] border border-slate-200/80 bg-slate-50 px-4 py-4 dark:border-white/10 dark:bg-black/15">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Source</p>
                  <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {diagnosticJob.source_kind === "upload" ? "Uploaded ZIP batch" : "Mounted directory"}
                  </p>
                  <p className="mt-2 break-all text-sm leading-6 text-slate-600 dark:text-slate-300">{diagnosticJob.source_path}</p>
                </div>
                <div className="rounded-[1.2rem] border border-slate-200/80 bg-slate-50 px-4 py-4 dark:border-white/10 dark:bg-black/15">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Timing</p>
                  <div className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    <p><span className="font-medium text-slate-900 dark:text-slate-100">Started:</span> {formatDateTime(diagnosticJob.created_at)}</p>
                    <p><span className="font-medium text-slate-900 dark:text-slate-100">Updated:</span> {formatDateTime(diagnosticJob.updated_at)}</p>
                    {diagnosticJob.finished_at ? (
                      <p><span className="font-medium text-slate-900 dark:text-slate-100">Finished:</span> {formatDateTime(diagnosticJob.finished_at)}</p>
                    ) : null}
                  </div>
                </div>
              </div>

              {(diagnosticJob.raw_metadata?.uploaded_filenames?.length ?? 0) > 0 ? (
                <div className="mt-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Archive Files</p>
                  <div className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-2">
                    {diagnosticJob.raw_metadata?.uploaded_filenames?.map((filename) => (
                      <div
                        key={filename}
                        className="rounded-[1.1rem] border border-slate-200/80 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:border-white/10 dark:bg-black/15 dark:text-slate-200"
                      >
                        {filename}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {diagnosticJob.error_message && !isPartialImportSuccess(diagnosticJob) ? (
                <div className="mt-5 rounded-[1.2rem] border border-rose-300/40 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-100">
                  {diagnosticJob.error_message}
                </div>
              ) : null}

              {diagnosticJob.error_message && isPartialImportSuccess(diagnosticJob) ? (
                <div
                  className={`mt-5 rounded-[1.2rem] px-4 py-3 text-sm ${
                    issuesReviewed
                      ? "border border-emerald-300/30 bg-emerald-50 text-emerald-800 dark:border-emerald-300/20 dark:bg-emerald-300/[0.12] dark:text-emerald-100"
                      : "border border-amber-300/40 bg-amber-50 text-amber-800 dark:border-amber-300/20 dark:bg-amber-300/[0.12] dark:text-amber-100"
                  }`}
                >
                  {issuesReviewed ? "Reviewed issue" : "Last failed item"}: {diagnosticJob.error_message}
                </div>
              ) : null}

              {showFailedItems ? (
                <div className="mt-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Failed Items</p>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        Open the original failed file directly for troubleshooting, or mark the remaining issues as reviewed.
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] ${
                        issuesReviewed
                          ? "border border-emerald-300/30 bg-emerald-50 text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-300/[0.1] dark:text-emerald-100"
                          : "border border-amber-300/30 bg-amber-50 text-amber-700 dark:border-amber-300/20 dark:bg-amber-300/[0.1] dark:text-amber-100"
                      }`}
                    >
                      {issuesReviewed ? "Reviewed" : `${diagnosticJob.failed_assets} open issue${diagnosticJob.failed_assets === 1 ? "" : "s"}`}
                    </span>
                  </div>

                  {failedItemsQuery.isLoading ? (
                    <div className="mt-3 rounded-[1.2rem] border border-slate-200/80 bg-slate-50 px-4 py-4 text-sm text-slate-600 dark:border-white/10 dark:bg-black/15 dark:text-slate-300">
                      Loading failed items...
                    </div>
                  ) : failedItems.length > 0 ? (
                    <div className="mt-3 max-h-72 space-y-3 overflow-y-auto pr-2">
                      {failedItems.map((item) => (
                        <article
                          key={item.asset_id}
                          className="rounded-[1.15rem] border border-slate-200/80 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-black/15"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{item.filename}</p>
                              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                {item.error_message ?? "Processing failed without a detailed error message."}
                              </p>
                            </div>
                            {item.processing_state ? (
                              <span className="shrink-0 rounded-full border border-slate-200/80 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                                {item.processing_state.replaceAll("_", " ")}
                              </span>
                            ) : null}
                          </div>
                          {(item.source_path || item.available_path) ? (
                            <p className="mt-2 break-all text-xs leading-5 text-slate-500 dark:text-slate-400">
                              {item.available_path ?? item.source_path}
                            </p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {item.available_path ? (
                              <a
                                href={`/api/ingest/${diagnosticJob.id}/failed-items/${item.asset_id}/file`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 rounded-[0.95rem] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-white/15 dark:hover:bg-white/[0.08]"
                              >
                                <ExternalLink className="h-4 w-4" />
                                Open file
                              </a>
                            ) : (
                              <span className="rounded-[0.95rem] border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
                                File unavailable
                              </span>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-[1.2rem] border border-slate-200/80 bg-slate-50 px-4 py-4 text-sm text-slate-600 dark:border-white/10 dark:bg-black/15 dark:text-slate-300">
                      Failed items could not be resolved for this import.
                    </div>
                  )}
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {jobCanRetry(diagnosticJob) ? (
                  <button
                    type="button"
                    onClick={() => void handleRetry(diagnosticJob)}
                    disabled={retryMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-white/15 dark:hover:bg-white/[0.08]"
                  >
                    {retryMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    Retry import
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void recentJobsQuery.refetch()}
                  className="inline-flex items-center gap-2 rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-white/15 dark:hover:bg-white/[0.08]"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh diagnostics
                </button>
                {showFailedItems && !issuesReviewed ? (
                  <button
                    type="button"
                    onClick={() => void handleAcknowledgeIssues(diagnosticJob)}
                    disabled={acknowledgeIssuesMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-[1rem] border border-amber-300/30 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 transition hover:border-amber-300/45 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-amber-300/20 dark:bg-amber-300/[0.1] dark:text-amber-100 dark:hover:border-amber-300/35 dark:hover:bg-amber-300/[0.16]"
                  >
                    {acknowledgeIssuesMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
                    Mark issues reviewed
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className={`rounded-[1.7rem] border border-slate-200/80 bg-white/88 p-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-xl dark:shadow-black/20 ${diagnosticJob ? "" : "max-w-[52rem]"}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Recent Imports</p>
                <h3 className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">Job history</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleClearHistory()}
                  disabled={clearHistoryMutation.isPending || recentJobs.length === 0}
                  className="inline-flex items-center gap-2 rounded-[0.95rem] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-white/15 dark:hover:bg-white/[0.08]"
                >
                  {clearHistoryMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Clear history
                </button>
                <Clock3 className="h-5 w-5 text-slate-500 dark:text-slate-300" />
              </div>
            </div>

            {recentJobs.length === 0 ? (
              <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">No import history yet.</p>
            ) : (
              <div className="mt-5 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                {recentJobs.map((job) => (
                  <article
                    key={job.id}
                    className="rounded-[1.2rem] border border-slate-200/80 bg-slate-50 px-4 py-4 dark:border-white/10 dark:bg-black/15"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <FolderArchive className="h-4.5 w-4.5 text-slate-500 dark:text-slate-300" />
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{job.source_name}</p>
                        </div>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{job.error_message ?? job.detail_message ?? "No extra details."}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] ${statusTone(job).chip}`}>
                        {statusShortLabel(job)}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      <span className="rounded-full border border-slate-200/80 bg-white px-2.5 py-1 dark:border-white/10 dark:bg-white/[0.04]">
                        {formatDateTime(job.created_at)}
                      </span>
                      <span className="rounded-full border border-slate-200/80 bg-white px-2.5 py-1 dark:border-white/10 dark:bg-white/[0.04]">
                        {job.processed_assets}/{job.total_assets || 0} processed
                      </span>
                      {job.failed_assets > 0 ? (
                        <span className="rounded-full border border-rose-300/30 bg-rose-50 px-2.5 py-1 text-rose-700 dark:border-rose-300/20 dark:bg-rose-300/[0.1] dark:text-rose-100">
                          {job.failed_assets} failed
                        </span>
                      ) : null}
                    </div>

                    {jobCanRetry(job) ? (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => void handleRetry(job)}
                          disabled={retryMutation.isPending}
                          className="inline-flex items-center gap-2 rounded-[0.95rem] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-white/15 dark:hover:bg-white/[0.08]"
                        >
                          {retryMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                          Retry source
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}
