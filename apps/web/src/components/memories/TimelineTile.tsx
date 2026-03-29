import type { MouseEvent } from "react";
import { memo, useEffect, useRef, useState } from "react";
import { CheckCircle2, Star, Tags } from "lucide-react";

import { getMemoryMediaTypeIcon } from "./mediaTypeIcons";
import { getOverlayUrl, getPlaybackUrl, getThumbnailUrl, type TimelineAsset } from "../../hooks/useTimeline";

const VIDEO_HOVER_PREVIEW_DELAY_MS = 1200;

export default memo(function TimelineTile({
  asset,
  index,
  width,
  height,
  autoplayVideosInGrid,
  showOverlays,
  selectionMode,
  isSelected,
  onOpenAsset,
  onToggleFavorite,
  onEditTags,
  onToggleSelection,
  onRequestContextMenu,
}: {
  asset: TimelineAsset;
  index: number;
  width: number;
  height: number;
  autoplayVideosInGrid: boolean;
  showOverlays: boolean;
  selectionMode: boolean;
  isSelected: boolean;
  onOpenAsset: (index: number) => void;
  onToggleFavorite: (asset: TimelineAsset) => void;
  onEditTags: (asset: TimelineAsset) => void;
  onToggleSelection: (asset: TimelineAsset, shiftKey: boolean) => void;
  onRequestContextMenu: (event: MouseEvent<HTMLButtonElement>, asset: TimelineAsset, index: number) => void;
}) {
  const hoverPreviewTimeoutRef = useRef<number | null>(null);
  const [isPreviewingVideo, setIsPreviewingVideo] = useState(false);
  const canPreviewVideo = autoplayVideosInGrid && asset.media_type === "video";
  const thumbnailUrl = getThumbnailUrl(asset.id, asset.has_overlay ? 1 : 0, showOverlays);
  const mediaUrl = getPlaybackUrl(asset.id, asset.has_overlay ? 1 : 0);
  const overlayUrl = asset.has_overlay ? getOverlayUrl(asset.id, 1) : null;
  const MediaTypeIcon = getMemoryMediaTypeIcon(asset.media_type);

  useEffect(() => {
    setIsPreviewingVideo(false);
  }, [asset.id, canPreviewVideo]);

  useEffect(() => {
    return () => {
      if (hoverPreviewTimeoutRef.current !== null) {
        window.clearTimeout(hoverPreviewTimeoutRef.current);
      }
    };
  }, []);

  function clearHoverPreviewTimeout() {
    if (hoverPreviewTimeoutRef.current === null) {
      return;
    }
    window.clearTimeout(hoverPreviewTimeoutRef.current);
    hoverPreviewTimeoutRef.current = null;
  }

  function handleMouseEnter() {
    if (!canPreviewVideo || isPreviewingVideo) {
      return;
    }
    clearHoverPreviewTimeout();
    hoverPreviewTimeoutRef.current = window.setTimeout(() => {
      setIsPreviewingVideo(true);
      hoverPreviewTimeoutRef.current = null;
    }, VIDEO_HOVER_PREVIEW_DELAY_MS);
  }

  function handleMouseLeave() {
    clearHoverPreviewTimeout();
    if (isPreviewingVideo) {
      setIsPreviewingVideo(false);
    }
  }

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onBlur={handleMouseLeave}
      className={[
        "group relative overflow-hidden rounded-[1.35rem] border bg-white text-left shadow-[0_18px_40px_rgba(15,23,42,0.08)] transition dark:bg-slate-950 dark:shadow-black/25",
        selectionMode
          ? isSelected
            ? "border-sky-400 shadow-[0_24px_60px_rgba(14,165,233,0.22)] dark:border-sky-300"
            : "border-slate-200/70 hover:border-sky-300/30 dark:border-white/10"
          : "border-slate-200/70 hover:-translate-y-0.5 hover:border-sky-300/30 hover:shadow-[0_24px_60px_rgba(15,23,42,0.14)] dark:border-white/10",
      ].join(" ")}
      style={{ width, height }}
    >
      <button
        type="button"
        onClick={(event) => {
          if (selectionMode) {
            onToggleSelection(asset, event.shiftKey);
            return;
          }
          onOpenAsset(index);
        }}
        onContextMenu={(event) => {
          if (selectionMode) {
            event.preventDefault();
            onToggleSelection(asset, event.shiftKey);
            return;
          }
          onRequestContextMenu(event, asset, index);
        }}
        className="block h-full w-full"
        aria-label={selectionMode ? `${isSelected ? "Deselect" : "Select"} ${asset.media_type}` : `Open ${asset.media_type}`}
      >
        {isPreviewingVideo ? (
          <div className="relative h-full w-full">
            <video
              src={mediaUrl}
              poster={thumbnailUrl}
              muted
              loop
              playsInline
              autoPlay
              preload="metadata"
              disablePictureInPicture
              className="h-full w-full object-cover"
            />
            {showOverlays && overlayUrl ? (
              <img
                src={overlayUrl}
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              />
            ) : null}
          </div>
        ) : (
          <img src={thumbnailUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 transition duration-200 group-hover:opacity-100" />
      </button>

      {selectionMode ? (
        <div className="pointer-events-none absolute left-3 top-3 z-10">
          <span
            className={[
              "inline-flex h-7 w-7 items-center justify-center rounded-full border shadow-sm transition",
              isSelected
                ? "border-sky-400 bg-sky-500 text-white"
                : "border-white/50 bg-black/35 text-white/80",
            ].join(" ")}
          >
            <CheckCircle2 className="h-4.5 w-4.5" />
          </span>
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 z-10 grid grid-cols-[1fr_auto_1fr] items-center px-3 pb-3">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite(asset);
          }}
          className={[
            "inline-flex items-center justify-self-start p-1 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] transition duration-150",
            selectionMode
              ? "pointer-events-none opacity-0"
              : asset.is_favorite
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
          ].join(" ")}
          aria-label={asset.is_favorite ? "Remove from favorites" : "Add to favorites"}
          title={asset.is_favorite ? "Unfavorite" : "Favorite"}
        >
          <Star className={asset.is_favorite ? "h-4 w-4 fill-amber-300 text-amber-300" : "h-4 w-4 text-white/92"} />
        </button>

        <div className="pointer-events-none inline-flex items-center justify-center text-white opacity-0 transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
          <MediaTypeIcon className="h-4 w-4 text-white/92 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]" />
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onEditTags(asset);
          }}
          className={[
            "inline-flex items-center justify-self-end p-1 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] transition duration-150",
            selectionMode ? "pointer-events-none opacity-0" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
          ].join(" ")}
          aria-label="Edit tags"
          title="Edit tags"
        >
          <Tags className="h-4 w-4 text-white/92" />
        </button>
      </div>
    </div>
  );
});
