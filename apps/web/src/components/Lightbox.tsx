import { ChevronLeft, ChevronRight, Clapperboard, Image as ImageIcon, X } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { useShowMemoryOverlays } from "../hooks/useOverlayPreference";
import { formatTimelineDate, getOriginalUrl, getOverlayUrl, type TimelineAsset } from "../hooks/useTimeline";

type LightboxProps = {
  assets: TimelineAsset[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (nextIndex: number) => void;
};

export default function Lightbox({ assets, currentIndex, onClose, onNavigate }: LightboxProps) {
  const asset = assets[currentIndex] ?? null;
  const showOverlays = useShowMemoryOverlays();
  const [mediaFailed, setMediaFailed] = useState(false);
  const [overlayFailed, setOverlayFailed] = useState(false);
  const [mediaBox, setMediaBox] = useState<{ width: number; height: number } | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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
    setOverlayFailed(false);
    setMediaBox(null);
  }, [asset?.id, asset?.media_type]);

  if (!asset) {
    return null;
  }

  const date = formatTimelineDate(asset.taken_at);
  const mediaUrl = getOriginalUrl(asset.id, asset.has_overlay ? 1 : 0);
  const overlayUrl = getOverlayUrl(asset.id, asset.has_overlay ? 1 : 0);
  const isVideo = asset.media_type === "video";

  function fitMediaBox(width: number, height: number) {
    const maxWidth = Math.min(window.innerWidth - 112, 1400);
    const maxHeight = Math.max(240, window.innerHeight - 220);
    const scale = Math.min(maxWidth / width, maxHeight / height, 1);
    setMediaBox({
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    });
  }

  const measureActiveMedia = useEffectEvent(() => {
    if (isVideo) {
      const element = videoRef.current;
      if (element && element.videoWidth > 0 && element.videoHeight > 0) {
        fitMediaBox(element.videoWidth, element.videoHeight);
      }
      return;
    }

    const element = imageRef.current;
    if (element && element.complete && element.naturalWidth > 0 && element.naturalHeight > 0) {
      fitMediaBox(element.naturalWidth, element.naturalHeight);
    }
  });

  useEffect(() => {
    if (!asset) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      measureActiveMedia();
    });
    const handleResize = () => {
      measureActiveMedia();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
    };
  }, [asset?.id, asset?.media_type, measureActiveMedia]);

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

          <div className="relative flex h-full w-full min-h-0 min-w-0 max-w-[min(96vw,1400px)] items-center justify-center overflow-hidden">
            {!mediaFailed ? (
              <div
                className="relative inline-grid max-h-full max-w-full min-h-0 min-w-0 place-items-center overflow-hidden rounded-[1.5rem]"
                style={
                  mediaBox
                    ? {
                        width: `${mediaBox.width}px`,
                        height: `${mediaBox.height}px`,
                      }
                    : {
                        maxWidth: "min(96vw, 1400px)",
                        maxHeight: "calc(100vh - 220px)",
                      }
                }
              >
                {isVideo ? (
                  <video
                    key={asset.id}
                    ref={videoRef}
                    src={mediaUrl}
                    controls
                    playsInline
                    preload="metadata"
                    autoPlay
                    onError={() => setMediaFailed(true)}
                    onLoadedMetadata={(event) => {
                      const element = event.currentTarget;
                      if (element.videoWidth > 0 && element.videoHeight > 0) {
                        fitMediaBox(element.videoWidth, element.videoHeight);
                      }
                    }}
                    className="col-start-1 row-start-1 block h-full w-full rounded-[1.5rem] object-contain"
                  />
                ) : (
                  <img
                    key={asset.id}
                    ref={imageRef}
                    src={mediaUrl}
                    alt={date.label}
                    onError={() => setMediaFailed(true)}
                    onLoad={(event) => {
                      const element = event.currentTarget;
                      if (element.naturalWidth > 0 && element.naturalHeight > 0) {
                        fitMediaBox(element.naturalWidth, element.naturalHeight);
                      }
                    }}
                    className="col-start-1 row-start-1 block h-full w-full rounded-[1.5rem] object-contain"
                  />
                )}
                {showOverlays && asset.has_overlay && !overlayFailed ? (
                  <img
                    src={overlayUrl}
                    alt=""
                    aria-hidden="true"
                    onError={() => setOverlayFailed(true)}
                    className="pointer-events-none absolute inset-0 h-full w-full rounded-[1.5rem] object-fill"
                  />
                ) : null}
              </div>
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
