import { Ban, LoaderCircle, RefreshCw, UploadCloud } from "lucide-react";
import { useEffect, useId, useRef, useState, type ChangeEvent, type DragEvent } from "react";

import {
  isTerminalIngestionStatus,
  useCancelIngestionJob,
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

function statusHeading(status: IngestionJob["status"]) {
  switch (status) {
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

function statusTone(status: IngestionJob["status"]) {
  if (status === "completed") {
    return {
      ring: "border-emerald-300/20 bg-emerald-300/[0.12] text-emerald-100",
      bar: "bg-emerald-300",
      chip: "border-emerald-300/20 bg-emerald-300/[0.1] text-emerald-100",
    };
  }
  if (status === "failed" || status === "canceled") {
    return {
      ring: "border-rose-300/20 bg-rose-300/[0.12] text-rose-100",
      bar: "bg-rose-300",
      chip: "border-rose-300/20 bg-rose-300/[0.1] text-rose-100",
    };
  }
  return {
    ring: "border-sky-300/20 bg-sky-300/[0.12] text-sky-100",
    bar: "bg-sky-300",
    chip: "border-sky-300/20 bg-sky-300/[0.1] text-sky-100",
  };
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
  const lastRefreshedCompletedJobId = useRef<string | null>(null);

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

  const liveJob = activeJob ?? lastFinishedJob;
  const liveJobTone = liveJob ? statusTone(liveJob.status) : null;
  const showLiveJob = uploadState.stage !== "uploading" && (liveJob !== null || isResumingActiveJob);

  return (
    <section className={`mx-auto flex w-full ${isCompact ? "max-w-none" : "max-w-[1520px]"} flex-col gap-6`}>
      {!isCompact ? (
        <div className="overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(135deg,_rgba(7,14,24,0.98),_rgba(7,25,40,0.92),_rgba(4,8,14,0.98))] shadow-2xl shadow-black/30">
          <div className="grid gap-8 px-6 py-8 md:px-10 md:py-10 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-sky-200/70">
                {showLiveJob ? "Ingestion Activity" : "First Import"}
              </p>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
                {showLiveJob
                  ? "Your import is running in the background."
                  : "Add your Snapchat export ZIP files."}
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-300">
                {showLiveJob
                  ? "You can refresh the page at any time and SnapCapsule will reconnect to the current import until it finishes."
                  : "Drop one or more exported Snapchat ZIP files here and SnapCapsule will process them in the background."}
              </p>
            </div>

            <div className="rounded-[1.9rem] border border-sky-300/10 bg-white/[0.045] p-5 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">How It Works</p>
              <div className="mt-4 grid gap-3 text-sm text-slate-300">
                <div className="rounded-[1.2rem] border border-white/10 bg-black/15 px-4 py-3">
                  1. Upload one ZIP or a full multi-part batch together.
                </div>
                <div className="rounded-[1.2rem] border border-white/10 bg-black/15 px-4 py-3">
                  2. SnapCapsule processes the import in the background.
                </div>
                <div className="rounded-[1.2rem] border border-white/10 bg-black/15 px-4 py-3">
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
            ? "border-sky-300/50 bg-sky-300/[0.08] shadow-[0_25px_60px_rgba(8,47,73,0.35)]"
            : "border-white/10 bg-white/[0.03] hover:border-sky-300/25 hover:bg-white/[0.05]",
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
                "flex items-center justify-center rounded-full border border-sky-300/20 bg-sky-300/[0.12] text-sky-100",
                isCompact ? "h-16 w-16" : "h-20 w-20",
              ].join(" ")}
            >
              <LoaderCircle className="h-9 w-9 animate-spin" />
            </div>
            <h2 className={`mt-6 font-semibold text-white ${isCompact ? "text-xl" : "text-2xl"}`}>{uploadState.message}</h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-400">
              Your files are being uploaded now. Once that is done, the import will continue in the background.
            </p>
          </div>
        ) : isResumingActiveJob ? (
          <div className="flex flex-col items-center">
            <div
              className={[
                "flex items-center justify-center rounded-full border border-sky-300/20 bg-sky-300/[0.12] text-sky-100",
                isCompact ? "h-16 w-16" : "h-20 w-20",
              ].join(" ")}
            >
              <LoaderCircle className="h-9 w-9 animate-spin" />
            </div>
            <h2 className={`mt-6 font-semibold text-white ${isCompact ? "text-xl" : "text-2xl"}`}>
              Restoring import progress
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-400">
              SnapCapsule found an active import and is restoring its current progress.
            </p>
          </div>
        ) : showLiveJob && liveJob && liveJobTone ? (
          <div className="flex max-w-2xl flex-col items-center">
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
            <h2 className={`mt-6 font-semibold text-white ${isCompact ? "text-xl" : "text-2xl"}`}>
              {statusHeading(liveJob.status)}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              {liveJob.error_message ?? liveJob.detail_message ?? "The ingestion worker is updating the archive."}
            </p>
            <div className="mt-6 w-full max-w-xl">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                <span>Progress</span>
                <span>{liveJob.progress_percent}%</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ${liveJobTone.bar}`}
                  style={{ width: `${Math.max(4, liveJob.progress_percent)}%` }}
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {liveJob.total_assets > 0 ? (
                <p className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  {liveJob.processed_assets}/{liveJob.total_assets} processed
                </p>
              ) : null}
              {liveJob.failed_assets > 0 ? (
                <p className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
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
                    className="inline-flex items-center gap-2 rounded-[1rem] border border-sky-300/20 bg-sky-300/[0.1] px-4 py-3 text-sm font-medium text-sky-100 transition hover:border-sky-300/35 hover:bg-sky-300/[0.16]"
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
                    className="inline-flex items-center gap-2 rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-white/15 hover:bg-white/[0.08]"
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
                  className="inline-flex items-center gap-2 rounded-[1rem] border border-rose-300/20 bg-rose-300/[0.1] px-4 py-3 text-sm font-medium text-rose-100 transition hover:border-rose-300/35 hover:bg-rose-300/[0.16] disabled:cursor-not-allowed disabled:opacity-70"
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
                "flex items-center justify-center rounded-[2rem] border border-white/10 bg-white/[0.05] text-sky-100 shadow-xl shadow-black/25 transition group-hover:scale-[1.02] group-hover:border-sky-300/20 group-hover:bg-sky-300/[0.08]",
                isCompact ? "h-20 w-20" : "h-24 w-24",
              ].join(" ")}
            >
              <UploadCloud className="h-10 w-10" />
            </div>
            <h2 className={`mt-6 font-semibold tracking-tight text-white ${isCompact ? "text-2xl" : "text-3xl"}`}>
              {isCompact ? "Add more Snapchat Export .zip files" : "Drag and drop your Snapchat Export .zip files here"}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">
              {isCompact
                ? "Drop one or more ZIP files here, or click to browse."
                : "You can also click anywhere in this area to browse for one or more ZIP files from your computer."}
            </p>
            <div className="mt-6 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Multi-part ZIP batches supported
            </div>
            {uploadState.stage !== "error" && uploadState.message ? (
              <div className="mt-6 rounded-[1.2rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
                {uploadState.message}
              </div>
            ) : null}
            {uploadState.stage === "error" ? (
              <div className="mt-6 rounded-[1.2rem] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                {uploadState.message}
              </div>
            ) : null}
          </div>
        )}
      </label>
    </section>
  );
}
