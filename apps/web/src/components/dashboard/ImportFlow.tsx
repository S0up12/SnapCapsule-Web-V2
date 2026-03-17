import { LoaderCircle, RefreshCw, UploadCloud } from "lucide-react";
import { useId, useState, type ChangeEvent, type DragEvent } from "react";

type ImportFlowProps = {
  onRefreshDashboard: () => void;
  variant?: "full" | "compact";
};

type UploadState =
  | { stage: "idle"; message?: string }
  | { stage: "uploading"; message: string }
  | { stage: "success"; message: string; jobIds: string[] }
  | { stage: "error"; message: string };

export default function ImportFlow({ onRefreshDashboard, variant = "full" }: ImportFlowProps) {
  const inputId = useId();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>({ stage: "idle" });
  const isCompact = variant === "compact";

  async function uploadArchives(files: File[]) {
    const validFiles = files.filter((file) => file.name.toLowerCase().endsWith(".zip"));
    if (validFiles.length === 0) {
      setUploadState({ stage: "error", message: "Please upload one or more Snapchat export ZIP files." });
      return;
    }

    const rejectedCount = files.length - validFiles.length;
    const jobIds: string[] = [];
    const failures: string[] = [];

    for (const [index, file] of validFiles.entries()) {
      const formData = new FormData();
      formData.append("archive", file);

      setUploadState({
        stage: "uploading",
        message:
          validFiles.length === 1
            ? "Uploading to server..."
            : `Uploading ${index + 1} of ${validFiles.length}: ${file.name}`,
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

        const payload = (await response.json()) as { job_id: string };
        jobIds.push(payload.job_id);
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Upload failed";
        failures.push(`${file.name}: ${reason}`);
      }
    }

    if (jobIds.length > 0) {
      const messageParts = [
        `${jobIds.length} archive${jobIds.length === 1 ? "" : "s"} queued for background processing.`,
        "You can keep adding more Snapchat exports whenever you want.",
      ];

      if (rejectedCount > 0) {
        messageParts.push(`${rejectedCount} non-ZIP file${rejectedCount === 1 ? " was" : "s were"} ignored.`);
      }

      if (failures.length > 0) {
        messageParts.push(`${failures.length} upload${failures.length === 1 ? "" : "s"} failed.`);
      }

      setUploadState({
        stage: "success",
        jobIds,
        message: messageParts.join(" "),
      });
      return;
    }

    setUploadState({
      stage: "error",
      message: failures.join(" "),
    });
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

  return (
    <section className={`mx-auto flex w-full ${isCompact ? "max-w-none" : "max-w-[1520px]"} flex-col gap-6`}>
      {!isCompact ? (
        <div className="overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(135deg,_rgba(7,14,24,0.98),_rgba(7,25,40,0.92),_rgba(4,8,14,0.98))] shadow-2xl shadow-black/30">
          <div className="grid gap-8 px-6 py-8 md:px-10 md:py-10 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-sky-200/70">First Import</p>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Bring your Snapchat archive online without touching server paths.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-300">
                Drop the exported Snapchat ZIP file here and SnapCapsule will upload it, queue the ingestion job, and
                process your photos and videos in the background.
              </p>
            </div>

            <div className="rounded-[1.9rem] border border-sky-300/10 bg-white/[0.045] p-5 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">What Happens Next</p>
              <div className="mt-4 grid gap-3 text-sm text-slate-300">
                <div className="rounded-[1.2rem] border border-white/10 bg-black/15 px-4 py-3">
                  1. The ZIP uploads to the backend over the web interface.
                </div>
                <div className="rounded-[1.2rem] border border-white/10 bg-black/15 px-4 py-3">
                  2. Background workers parse chats, memories, and media files.
                </div>
                <div className="rounded-[1.2rem] border border-white/10 bg-black/15 px-4 py-3">
                  3. Thumbnails are generated so the grid stays fast once the archive is ready.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
            return;
          }
          setIsDragging(false);
        }}
        onDrop={handleDrop}
        className={[
          "group flex cursor-pointer flex-col items-center justify-center rounded-[2rem] border border-dashed px-6 py-8 text-center transition",
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
            <h2 className={`mt-6 font-semibold text-white ${isCompact ? "text-xl" : "text-2xl"}`}>
              {uploadState.message}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-400">
              The archive is being transferred into the backend container. Once the upload finishes, processing will
              continue asynchronously.
            </p>
          </div>
        ) : uploadState.stage === "success" ? (
          <div className="flex max-w-2xl flex-col items-center">
            <div
              className={[
                "flex items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-300/[0.12] text-emerald-100",
                isCompact ? "h-16 w-16" : "h-20 w-20",
              ].join(" ")}
            >
              <UploadCloud className="h-9 w-9" />
            </div>
            <h2 className={`mt-6 font-semibold text-white ${isCompact ? "text-xl" : "text-2xl"}`}>
              Background processing started
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">{uploadState.message}</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {uploadState.jobIds.slice(0, 3).map((jobId) => (
                <p
                  key={jobId}
                  className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400"
                >
                  Job {jobId}
                </p>
              ))}
              {uploadState.jobIds.length > 3 ? (
                <p className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  +{uploadState.jobIds.length - 3} more
                </p>
              ) : null}
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onRefreshDashboard}
                className="inline-flex items-center gap-2 rounded-[1rem] border border-sky-300/20 bg-sky-300/[0.1] px-4 py-3 text-sm font-medium text-sky-100 transition hover:border-sky-300/35 hover:bg-sky-300/[0.16]"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh dashboard
              </button>
              <label
                htmlFor={inputId}
                className="inline-flex cursor-pointer items-center gap-2 rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-white/15 hover:bg-white/[0.08]"
              >
                Upload more ZIPs
              </label>
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
              {isCompact
                ? "Add more Snapchat Export .zip files"
                : "Drag and drop your Snapchat Export .zip file here"}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">
              {isCompact
                ? "Drop one or more ZIP files here, or click to browse. New exports can be added to the archive whenever you need."
                : "You can also click anywhere in this area to browse for one or more ZIP files from your computer."}
            </p>
            <div className="mt-6 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Multiple ZIP uploads supported
            </div>
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
