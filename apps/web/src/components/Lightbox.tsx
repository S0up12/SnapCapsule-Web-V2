import { ChevronLeft, ChevronRight, Clapperboard, Image as ImageIcon, X } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";

import { formatTimelineDate, getOriginalUrl, type TimelineAsset } from "../hooks/useTimeline";

type LightboxProps = {
  assets: TimelineAsset[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (nextIndex: number) => void;
};

export default function Lightbox({ assets, currentIndex, onClose, onNavigate }: LightboxProps) {
  const asset = assets[currentIndex] ?? null;
  const [mediaFailed, setMediaFailed] = useState(false);

  const goPrevious = useEffectEvent(() => {
    if (currentIndex <= 0) {
      return;
    }
    onNavigate(currentIndex - 1);
  });

  const goNext = useEffectEvent(() => {
    if (currentIndex >= assets.length - 1) {
      return;
    }
    onNavigate(currentIndex + 1);
  });

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      onClose();
      return;
    }
    if (event.key === "ArrowLeft") {
      goPrevious();
      return;
    }
    if (event.key === "ArrowRight") {
      goNext();
    }
  });

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  useEffect(() => {
    setMediaFailed(false);
  }, [asset?.id, asset?.media_type]);

  if (!asset) {
    return null;
  }

  const date = formatTimelineDate(asset.taken_at);
  const mediaUrl = getOriginalUrl(asset.id);
  const isVideo = asset.media_type === "video";

  return (
    <div className="fixed inset-0 z-50 bg-black/95 p-3 sm:p-5" onClick={onClose}>
      <div
        className="relative flex h-full w-full flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#060c14] shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Viewer</p>
            <div className="mt-2 flex items-center gap-3">
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-100">
                {isVideo ? "Video" : "Photo"}
              </span>
              <p className="text-sm text-slate-300">{date.label}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs uppercase tracking-[0.2em] text-slate-400 sm:inline-flex">
              {currentIndex + 1} / {assets.length}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-slate-200 transition hover:bg-white/[0.1]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(24,38,59,0.42),_rgba(4,6,10,0.96)_60%)] px-3 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => onNavigate(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/10 bg-black/50 p-3 text-white transition hover:bg-black/70 disabled:cursor-not-allowed disabled:opacity-40 sm:left-6"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate(currentIndex + 1)}
            disabled={currentIndex >= assets.length - 1}
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/10 bg-black/50 p-3 text-white transition hover:bg-black/70 disabled:cursor-not-allowed disabled:opacity-40 sm:right-6"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="relative flex h-full w-full max-w-[min(96vw,1400px)] items-center justify-center">
            {!mediaFailed ? (
              isVideo ? (
                <video
                  key={asset.id}
                  src={mediaUrl}
                  controls
                  playsInline
                  preload="metadata"
                  autoPlay
                  onError={() => setMediaFailed(true)}
                  className="max-h-full max-w-full rounded-[1.5rem] object-contain"
                />
              ) : (
                <img
                  key={asset.id}
                  src={mediaUrl}
                  alt={date.label}
                  onError={() => setMediaFailed(true)}
                  className="max-h-full max-w-full rounded-[1.5rem] object-contain"
                />
              )
            ) : (
              <div className="flex min-h-[320px] w-full max-w-3xl flex-col items-center justify-center rounded-[1.5rem] border border-white/10 bg-white/[0.03] px-6 text-center text-slate-400">
                <div className="rounded-2xl bg-white/[0.05] p-4 text-slate-200">
                  {isVideo ? <Clapperboard className="h-7 w-7" /> : <ImageIcon className="h-7 w-7" />}
                </div>
                <p className="mt-4 text-lg font-medium text-slate-200">Full-resolution media is unavailable.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
