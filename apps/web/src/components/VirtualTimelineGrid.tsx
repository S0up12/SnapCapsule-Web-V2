import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import { Camera, Clapperboard, LoaderCircle, Star } from "lucide-react";
import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";

import AssetContextMenu from "./memories/AssetContextMenu";
import { formatTimelineDate, formatTimelineGroup, getOriginalUrl, getThumbnailUrl, type TimelineAsset } from "../hooks/useTimeline";

type GridRow =
  | {
      type: "header";
      key: string;
      label: string;
      shortLabel: string;
      count: number;
    }
  | {
      type: "assets";
      key: string;
      items: Array<{ asset: TimelineAsset; index: number }>;
    };

type VirtualTimelineGridProps = {
  assets: TimelineAsset[];
  total: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isInitialLoading: boolean;
  fetchNextPage: () => Promise<unknown>;
  onOpenAsset: (index: number) => void;
  onToggleFavorite: (asset: TimelineAsset) => Promise<void>;
  onEditTags: (asset: TimelineAsset) => void;
};

type ContextMenuState = {
  asset: TimelineAsset;
  index: number;
  x: number;
  y: number;
};

const GRID_GAP = 14;
const MIN_TILE_WIDTH = 148;
const PORTRAIT_RATIO = 16 / 9;
const HEADER_ROW_ESTIMATE = 90;
const SCROLL_FETCH_THRESHOLD = 1200;
const BOTTOM_STATUS_THRESHOLD = 220;

function TimelineTile({
  asset,
  width,
  height,
  onOpen,
  onContextAction,
}: {
  asset: TimelineAsset;
  width: number;
  height: number;
  onOpen: () => void;
  onContextAction: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const date = formatTimelineDate(asset.taken_at);

  return (
    <button
      type="button"
      onClick={onOpen}
      onContextMenu={onContextAction}
      className="group relative overflow-hidden rounded-[1.35rem] border border-slate-200/70 bg-white text-left shadow-[0_18px_40px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:border-sky-300/30 hover:shadow-[0_24px_60px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-slate-950 dark:shadow-black/25"
      style={{ width, height }}
    >
      <img
        src={getThumbnailUrl(asset.id)}
        alt={date.label}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/82 via-black/18 to-transparent opacity-0 transition duration-200 group-hover:opacity-100">
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-3 pb-3 pt-12 text-white">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.2em] text-white/72">{date.shortLabel}</p>
            <div className="mt-1 inline-flex items-center gap-2 text-xs text-white/92">
              {asset.media_type === "video" ? <Clapperboard className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
              <span>{asset.media_type === "video" ? "Video" : "Photo"}</span>
            </div>
          </div>

          {asset.is_favorite ? (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/14 bg-white/10 backdrop-blur">
              <Star className="h-4 w-4 fill-amber-300 text-amber-300" />
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function LoadingState() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
      {Array.from({ length: 18 }, (_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-[1.25rem] border border-slate-200/70 bg-white/80 dark:border-white/10 dark:bg-white/[0.035]"
          style={{ aspectRatio: "9 / 16" }}
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[440px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-slate-300/70 bg-white/65 px-6 text-center dark:border-white/10 dark:bg-white/[0.02]">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Memories</p>
      <h2 className="mt-5 text-2xl font-semibold text-slate-950 dark:text-white">No memories match this filter</h2>
      <p className="mt-3 max-w-lg text-sm leading-7 text-slate-600 dark:text-slate-400">
        Try removing a tag or switching the filter back to all memories to repopulate the virtual grid.
      </p>
    </div>
  );
}

function downloadOriginal(assetId: string) {
  const link = document.createElement("a");
  link.href = getOriginalUrl(assetId);
  link.download = "";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function copyShareableLink(assetId: string) {
  const value = `${window.location.origin}${getOriginalUrl(assetId)}`;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement("input");
  input.value = value;
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

export default function VirtualTimelineGrid({
  assets,
  total,
  hasNextPage,
  isFetchingNextPage,
  isInitialLoading,
  fetchNextPage,
  onOpenAsset,
  onToggleFavorite,
  onEditTags,
}: VirtualTimelineGridProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [showBottomStatus, setShowBottomStatus] = useState(false);
  const activeStickyIndexRef = useRef(0);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const updateWidth = () => {
      setContainerWidth(element.clientWidth);
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const closeMenu = () => {
      setContextMenu(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    window.addEventListener("click", closeMenu);
    window.addEventListener("contextmenu", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("contextmenu", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  const columnCount = Math.max(2, Math.floor((Math.max(containerWidth, 320) + GRID_GAP) / (MIN_TILE_WIDTH + GRID_GAP)));
  const tileWidth = Math.max(
    132,
    Math.floor((Math.max(containerWidth, 320) - GRID_GAP * (columnCount - 1)) / columnCount),
  );
  const tileHeight = Math.max(220, Math.floor(tileWidth * PORTRAIT_RATIO));

  const { rows, stickyIndexes } = useMemo(() => {
    const grouped = new Map<
      string,
      { label: string; shortLabel: string; items: Array<{ asset: TimelineAsset; index: number }> }
    >();

    for (const [index, asset] of assets.entries()) {
      const formatted = formatTimelineGroup(asset.taken_at);
      const group = grouped.get(formatted.key) ?? {
        label: formatted.label,
        shortLabel: formatted.shortLabel,
        items: [],
      };
      group.items.push({ asset, index });
      grouped.set(formatted.key, group);
    }

    const nextRows: GridRow[] = [];
    const nextStickyIndexes: number[] = [];

    for (const [groupKey, group] of grouped.entries()) {
      nextStickyIndexes.push(nextRows.length);
      nextRows.push({
        type: "header",
        key: `${groupKey}-header`,
        label: group.label,
        shortLabel: group.shortLabel,
        count: group.items.length,
      });

      for (let index = 0; index < group.items.length; index += columnCount) {
        nextRows.push({
          type: "assets",
          key: `${groupKey}-row-${index}`,
          items: group.items.slice(index, index + columnCount),
        });
      }
    }

    return { rows: nextRows, stickyIndexes: nextStickyIndexes };
  }, [assets, columnCount]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => (rows[index]?.type === "header" ? HEADER_ROW_ESTIMATE : tileHeight + GRID_GAP),
    overscan: 8,
    rangeExtractor: (range) => {
      const activeStickyIndex =
        [...stickyIndexes].reverse().find((index) => range.startIndex >= index) ?? stickyIndexes[0] ?? 0;
      activeStickyIndexRef.current = activeStickyIndex;

      return [...new Set([activeStickyIndex, ...defaultRangeExtractor(range)])].sort((a, b) => a - b);
    },
  });

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const handleScrollState = () => {
      const remainingScroll = element.scrollHeight - element.scrollTop - element.clientHeight;
      const nextShowBottomStatus = remainingScroll <= BOTTOM_STATUS_THRESHOLD;
      setShowBottomStatus((current) => (current === nextShowBottomStatus ? current : nextShowBottomStatus));

      if (!hasNextPage || isFetchingNextPage) {
        return;
      }

      if (remainingScroll <= SCROLL_FETCH_THRESHOLD) {
        void fetchNextPage();
      }
    };

    handleScrollState();
    element.addEventListener("scroll", handleScrollState, { passive: true });

    return () => {
      element.removeEventListener("scroll", handleScrollState);
    };
  }, [assets.length, fetchNextPage, hasNextPage, isFetchingNextPage, rows.length]);

  if (isInitialLoading) {
    return <LoadingState />;
  }

  if (assets.length === 0) {
    return <EmptyState />;
  }

  return (
    <>
      <div className="rounded-[1.75rem] border border-slate-200/70 bg-white/75 p-3 shadow-[0_24px_60px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-slate-950/55 dark:shadow-black/20 sm:p-4">
        <div
          ref={scrollRef}
          className="relative h-[calc(100vh-16rem)] min-h-[560px] overflow-auto rounded-[1.35rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,248,252,0.96))] p-3 dark:border-white/5 dark:bg-[linear-gradient(180deg,rgba(8,14,24,0.95),rgba(4,8,14,0.98))]"
        >
          <div
            style={{
              height: rowVirtualizer.getTotalSize(),
              position: "relative",
              width: "100%",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) {
                return null;
              }

              const isActiveStickyHeader =
                row.type === "header" && activeStickyIndexRef.current === virtualRow.index;

              return (
                <div
                  key={row.key}
                  ref={rowVirtualizer.measureElement}
                  data-index={virtualRow.index}
                  style={
                    isActiveStickyHeader
                      ? {
                          position: "sticky",
                          top: 0,
                          zIndex: 20,
                          width: "100%",
                        }
                      : {
                          position: "absolute",
                          left: 0,
                          top: 0,
                          width: "100%",
                          transform: `translateY(${virtualRow.start}px)`,
                        }
                  }
                >
                  {row.type === "header" ? (
                    <div className="pb-[14px] pt-1">
                      <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,250,252,0.94))] px-4 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(8,14,24,0.96),rgba(4,8,14,0.92))] dark:shadow-black/20">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-700/75 dark:text-cyan-300/70">
                            {row.shortLabel}
                          </p>
                          <h3 className="mt-1 text-sm font-medium text-slate-950 dark:text-white sm:text-base">{row.label}</h3>
                        </div>
                        <span className="rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
                          {row.count}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="grid pb-[14px]"
                      style={{
                        gap: GRID_GAP,
                        gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                      }}
                    >
                      {row.items.map(({ asset, index }) => (
                        <TimelineTile
                          key={asset.id}
                          asset={asset}
                          width={tileWidth}
                          height={tileHeight}
                          onOpen={() => onOpenAsset(index)}
                          onContextAction={(event) => {
                            event.preventDefault();
                            const estimatedWidth = 240;
                            const estimatedHeight = 248;
                            const x = Math.min(event.clientX, window.innerWidth - estimatedWidth - 16);
                            const y = Math.min(event.clientY, window.innerHeight - estimatedHeight - 16);
                            setContextMenu({
                              asset,
                              index,
                              x,
                              y,
                            });
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-3 pb-3">
            {isFetchingNextPage && showBottomStatus ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs uppercase tracking-[0.22em] text-slate-700 shadow-lg shadow-slate-900/5 backdrop-blur dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-300 dark:shadow-black/20">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Loading next page
              </div>
            ) : null}
            {!hasNextPage && total > 0 && showBottomStatus ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs uppercase tracking-[0.22em] text-slate-500 shadow-lg shadow-slate-900/5 backdrop-blur dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-500 dark:shadow-black/20">
                End of timeline
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {contextMenu ? (
        <AssetContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isFavorite={contextMenu.asset.is_favorite}
          onViewFullSize={() => {
            onOpenAsset(contextMenu.index);
            setContextMenu(null);
          }}
          onToggleFavorite={() => {
            void onToggleFavorite(contextMenu.asset);
            setContextMenu(null);
          }}
          onEditTags={() => {
            onEditTags(contextMenu.asset);
            setContextMenu(null);
          }}
          onDownloadOriginal={() => {
            downloadOriginal(contextMenu.asset.id);
            setContextMenu(null);
          }}
          onCopyShareableLink={() => {
            void copyShareableLink(contextMenu.asset.id);
            setContextMenu(null);
          }}
        />
      ) : null}
    </>
  );
}
