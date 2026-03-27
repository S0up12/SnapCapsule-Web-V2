import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import { LoaderCircle, type LucideIcon } from "lucide-react";
import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AppSettings } from "../hooks/useSettings";
import { useShowMemoryOverlays } from "../hooks/useOverlayPreference";
import { formatTimelineGroup, type TimelineAsset } from "../hooks/useTimeline";
import AssetContextMenu from "./memories/AssetContextMenu";
import TimelineTile from "./memories/TimelineTile";
import { EmptyState, LoadingState } from "./memories/TimelineGridStates";

type GridRow =
  | { type: "header"; key: string; label: string; shortLabel: string; count: number }
  | { type: "assets"; key: string; items: Array<{ asset: TimelineAsset; index: number }> };

type VirtualTimelineGridProps = {
  assets: TimelineAsset[];
  total: number;
  autoplayVideosInGrid: boolean;
  defaultGridSize: AppSettings["default_grid_size"];
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
const PORTRAIT_RATIO = 16 / 9;
const HEADER_ROW_HEIGHT = 90;
const SCROLL_FETCH_THRESHOLD = 1200;
const BOTTOM_STATUS_THRESHOLD = 220;
const GRID_SIZE_MIN_TILE_WIDTH: Record<AppSettings["default_grid_size"], number> = {
  small: 124,
  medium: 148,
  large: 196,
};

function downloadOriginal(assetId: string) {
  const link = document.createElement("a");
  link.href = `/api/asset/${assetId}/original`;
  link.download = "";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function copyShareableLink(assetId: string) {
  const value = `${window.location.origin}/api/asset/${assetId}/original`;
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

function BottomStatus({
  isFetchingNextPage,
  hasNextPage,
  total,
  showBottomStatus,
  Icon,
}: {
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  total: number;
  showBottomStatus: boolean;
  Icon: LucideIcon;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-3 pb-3">
      {isFetchingNextPage && showBottomStatus ? (
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs uppercase tracking-[0.22em] text-slate-700 shadow-lg shadow-slate-900/5 backdrop-blur dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-300 dark:shadow-black/20">
          <Icon className="h-4 w-4 animate-spin" />
          Loading next page
        </div>
      ) : null}
      {!hasNextPage && total > 0 && showBottomStatus ? (
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs uppercase tracking-[0.22em] text-slate-500 shadow-lg shadow-slate-900/5 backdrop-blur dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-500 dark:shadow-black/20">
          End of timeline
        </div>
      ) : null}
    </div>
  );
}

export default function VirtualTimelineGrid({
  assets,
  total,
  autoplayVideosInGrid,
  defaultGridSize,
  hasNextPage,
  isFetchingNextPage,
  isInitialLoading,
  fetchNextPage,
  onOpenAsset,
  onToggleFavorite,
  onEditTags,
}: VirtualTimelineGridProps) {
  const showOverlays = useShowMemoryOverlays();
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [showBottomStatus, setShowBottomStatus] = useState(false);
  const activeStickyIndexRef = useRef(0);

  const handleScrollElementRef = useCallback((node: HTMLDivElement | null) => {
    setScrollElement(node);
  }, []);
  const handleOpenAsset = useCallback((index: number) => onOpenAsset(index), [onOpenAsset]);
  const handleRequestContextMenu = useCallback((event: MouseEvent<HTMLButtonElement>, asset: TimelineAsset, index: number) => {
    event.preventDefault();
    setContextMenu({
      asset,
      index,
      x: Math.min(event.clientX, window.innerWidth - 256),
      y: Math.min(event.clientY, window.innerHeight - 264),
    });
  }, []);
  const handleToggleFavorite = useCallback(
    (asset: TimelineAsset) => {
      void onToggleFavorite(asset);
    },
    [onToggleFavorite],
  );
  const handleEditTags = useCallback((asset: TimelineAsset) => onEditTags(asset), [onEditTags]);

  useEffect(() => {
    if (!scrollElement) {
      return;
    }
    const observer = new ResizeObserver(() => {
      setContainerWidth(scrollElement.clientWidth);
    });
    setContainerWidth(scrollElement.clientWidth);
    observer.observe(scrollElement);
    return () => observer.disconnect();
  }, [scrollElement]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }
    const closeMenu = () => setContextMenu(null);
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

  const minTileWidth = GRID_SIZE_MIN_TILE_WIDTH[defaultGridSize];
  const columnCount = Math.max(2, Math.floor((Math.max(containerWidth, 320) + GRID_GAP) / (minTileWidth + GRID_GAP)));
  const tileWidth = Math.max(132, Math.floor((Math.max(containerWidth, 320) - GRID_GAP * (columnCount - 1)) / columnCount));
  const tileHeight = Math.max(220, Math.floor(tileWidth * PORTRAIT_RATIO));

  const { rows, stickyIndexes } = useMemo(() => {
    const grouped = new Map<string, { label: string; shortLabel: string; items: Array<{ asset: TimelineAsset; index: number }> }>();
    for (const [index, asset] of assets.entries()) {
      const formatted = formatTimelineGroup(asset.taken_at);
      const group = grouped.get(formatted.key) ?? { label: formatted.label, shortLabel: formatted.shortLabel, items: [] };
      group.items.push({ asset, index });
      grouped.set(formatted.key, group);
    }

    const nextRows: GridRow[] = [];
    const nextStickyIndexes: number[] = [];
    for (const [groupKey, group] of grouped.entries()) {
      nextStickyIndexes.push(nextRows.length);
      nextRows.push({ type: "header", key: `${groupKey}-header`, label: group.label, shortLabel: group.shortLabel, count: group.items.length });
      for (let index = 0; index < group.items.length; index += columnCount) {
        nextRows.push({ type: "assets", key: `${groupKey}-row-${index}`, items: group.items.slice(index, index + columnCount) });
      }
    }
    return { rows: nextRows, stickyIndexes: nextStickyIndexes };
  }, [assets, columnCount]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElement,
    getItemKey: (index) => rows[index]?.key ?? index,
    estimateSize: (index) => (rows[index]?.type === "header" ? HEADER_ROW_HEIGHT : tileHeight + GRID_GAP),
    overscan: 12,
    rangeExtractor: (range) => {
      const activeStickyIndex = [...stickyIndexes].reverse().find((index) => range.startIndex >= index) ?? stickyIndexes[0] ?? 0;
      activeStickyIndexRef.current = activeStickyIndex;
      return [...new Set([activeStickyIndex, ...defaultRangeExtractor(range)])].sort((a, b) => a - b);
    },
  });

  useEffect(() => {
    if (!scrollElement) {
      return;
    }
    const handleScrollState = () => {
      const remainingScroll = scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight;
      setShowBottomStatus((current) => {
        const nextShowBottomStatus = remainingScroll <= BOTTOM_STATUS_THRESHOLD;
        return current === nextShowBottomStatus ? current : nextShowBottomStatus;
      });
      if (hasNextPage && !isFetchingNextPage && remainingScroll <= SCROLL_FETCH_THRESHOLD) {
        void fetchNextPage();
      }
    };
    handleScrollState();
    scrollElement.addEventListener("scroll", handleScrollState, { passive: true });
    return () => {
      scrollElement.removeEventListener("scroll", handleScrollState);
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, scrollElement]);

  if (isInitialLoading) {
    return <LoadingState />;
  }
  if (assets.length === 0) {
    return <EmptyState />;
  }

  return (
    <>
      <div className="min-h-0 flex-1 rounded-[1.75rem] border border-slate-200/70 bg-white/75 p-3 shadow-[0_24px_60px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-slate-950/55 dark:shadow-black/20 sm:p-4">
        <div
          ref={handleScrollElementRef}
          className="relative h-full min-h-0 overflow-auto overscroll-contain rounded-[1.35rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,248,252,0.96))] p-3 [scrollbar-gutter:stable] dark:border-white/5 dark:bg-[linear-gradient(180deg,rgba(8,14,24,0.95),rgba(4,8,14,0.98))]"
        >
          <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative", width: "100%" }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) {
                return null;
              }

              const style =
                row.type === "header" && activeStickyIndexRef.current === virtualRow.index
                  ? { position: "sticky" as const, top: 0, zIndex: 20, width: "100%" }
                  : { position: "absolute" as const, left: 0, top: 0, width: "100%", willChange: "transform", transform: `translateY(${virtualRow.start}px)` };

              return (
                <div key={row.key} data-index={virtualRow.index} style={style}>
                  {row.type === "header" ? (
                    <div className="pb-[14px] pt-1">
                      <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,250,252,0.94))] px-4 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(8,14,24,0.96),rgba(4,8,14,0.92))] dark:shadow-black/20">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-700/75 dark:text-cyan-300/70">{row.shortLabel}</p>
                          <h3 className="mt-1 text-sm font-medium text-slate-950 dark:text-white sm:text-base">{row.label}</h3>
                        </div>
                        <span className="rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
                          {row.count}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="grid pb-[14px]" style={{ gap: GRID_GAP, gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
                      {row.items.map(({ asset, index }) => (
                        <TimelineTile
                          key={asset.id}
                          asset={asset}
                          index={index}
                          width={tileWidth}
                          height={tileHeight}
                          autoplayVideosInGrid={autoplayVideosInGrid}
                          showOverlays={showOverlays}
                          onOpenAsset={handleOpenAsset}
                          onToggleFavorite={handleToggleFavorite}
                          onEditTags={handleEditTags}
                          onRequestContextMenu={handleRequestContextMenu}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <BottomStatus
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={hasNextPage}
            total={total}
            showBottomStatus={showBottomStatus}
            Icon={LoaderCircle}
          />
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
