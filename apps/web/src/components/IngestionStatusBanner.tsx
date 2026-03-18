import { LoaderCircle } from "lucide-react";
import { Link } from "react-router-dom";

import { useActiveIngestion } from "../hooks/useActiveIngestion";
import type { IngestionJob } from "../hooks/useIngestionJob";

function statusLabel(status: IngestionJob["status"]) {
  switch (status) {
    case "queued":
      return "Queued";
    case "extracting":
      return "Extracting archives";
    case "parsing":
      return "Parsing Snapchat export";
    case "processing_media":
      return "Processing media";
    default:
      return "Import in progress";
  }
}

export default function IngestionStatusBanner() {
  const { activeJob, isRestoringActiveJob } = useActiveIngestion();
  const showLiveJob = activeJob !== null;

  if (!showLiveJob && !isRestoringActiveJob) {
    return null;
  }

  return (
    <div className="border-b border-sky-200/70 bg-[linear-gradient(135deg,_rgba(224,242,254,0.96),_rgba(186,230,253,0.9),_rgba(224,242,254,0.98))] px-4 py-3 text-slate-900 shadow-[0_10px_30px_rgba(14,165,233,0.08)] dark:border-sky-300/10 dark:bg-[linear-gradient(135deg,_rgba(8,27,39,0.98),_rgba(9,45,61,0.95),_rgba(6,17,24,0.98))] dark:text-slate-100 md:px-6 xl:px-8">
      <div className="mx-auto flex w-full max-w-[1520px] flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-sky-300/30 bg-sky-300/15 text-sky-700 dark:text-sky-100">
            <LoaderCircle className="h-5 w-5 animate-spin" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-700/75 dark:text-sky-200/70">
              Background Import
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
              {isRestoringActiveJob
                ? "Restoring the active import after page load."
                : `${statusLabel(activeJob!.status)} at ${activeJob!.progress_percent}%`}
            </p>
            <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-300">
              {isRestoringActiveJob
                ? "SnapCapsule is reconnecting to the current import job."
                : activeJob!.detail_message ?? "SnapCapsule is still processing your export in the background."}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {showLiveJob && activeJob!.total_assets > 0 ? (
            <div className="rounded-full border border-sky-300/25 bg-white/50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-700 dark:bg-white/5 dark:text-slate-200">
              {activeJob!.processed_assets}/{activeJob!.total_assets} done
            </div>
          ) : null}
          <Link
            to="/"
            className="inline-flex items-center rounded-[0.95rem] border border-sky-300/30 bg-white/60 px-4 py-2 text-sm font-medium text-slate-900 transition hover:border-sky-400/45 hover:bg-white/80 dark:bg-white/5 dark:text-slate-100 dark:hover:border-sky-300/40 dark:hover:bg-white/10"
          >
            View import
          </Link>
        </div>
      </div>
    </div>
  );
}
