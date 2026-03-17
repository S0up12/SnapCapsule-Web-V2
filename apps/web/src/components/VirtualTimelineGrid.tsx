import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import { Clapperboard, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { formatTimelineDate, getThumbnailUrl, type TimelineAsset } from "../hooks/useTimeline";

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
};

const GRID_GAP = 14;
const MIN_TILE_WIDTH = 150;

function TimelineTile({
  asset,
  size,
  onOpen,
}: {
  asset: TimelineAsset;
  size: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative overflow-hidden rounded-[1.25rem] border border-white/10 bg-slate-900 text-left shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-cyan-300/20"
      style={{ height: size }}
    >
      <img
        src={getThumbnailUrl(asset.id)}
        alt={formatTimelineDate(asset.taken_at).label}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
        <span className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/85 backdrop-blur">
          {asset.media_type === "video" ? "Video" : "Photo"}
        </span>
        {asset.media_type === "video" ? (
          <span className="rounded-full bg-black/45 p-2 text-white/90 backdrop-blur">
            <Clapperboard className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent px-3 pb-3 pt-10">
        <p className="truncate text-xs uppercase tracking-[0.2em] text-slate-200/90">
          {formatTimelineDate(asset.taken_at).shortLabel}
        </p>
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
          className="aspect-square animate-pulse rounded-[1.25rem] border border-white/10 bg-white/[0.035]"
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[440px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.02] px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Timeline</p>
      <h2 className="mt-5 text-2xl font-semibold text-white">No processed media yet</h2>
      <p className="mt-3 max-w-lg text-sm leading-7 text-slate-400">
        Ingest a Snapchat archive first, then the virtual grid will stream thumbnails from the backend timeline API.
      </p>
    </div>
  );
}

export default function VirtualTimelineGrid({
  assets,
  total,
  hasNextPage,
  isFetchingNextPage,
  isInitialLoading,
  fetchNextPage,
  onOpenAsset,
}: VirtualTimelineGridProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
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

  const columnCount = Math.max(2, Math.floor((Math.max(containerWidth, 320) + GRID_GAP) / (MIN_TILE_WIDTH + GRID_GAP)));
  const tileSize = Math.max(
    132,
    Math.floor((Math.max(containerWidth, 320) - GRID_GAP * (columnCount - 1)) / columnCount),
  );

  const { rows, stickyIndexes } = useMemo(() => {
    const grouped = new Map<string, { label: string; shortLabel: string; items: Array<{ asset: TimelineAsset; index: number }> }>();

    for (const [index, asset] of assets.entries()) {
      const formatted = formatTimelineDate(asset.taken_at);
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
    estimateSize: (index) => (rows[index]?.type === "header" ? 54 : tileSize + GRID_GAP),
    overscan: 8,
    rangeExtractor: (range) => {
      const activeStickyIndex =
        [...stickyIndexes].reverse().find((index) => range.startIndex >= index) ?? stickyIndexes[0] ?? 0;
      activeStickyIndexRef.current = activeStickyIndex;

      return [...new Set([activeStickyIndex, ...defaultRangeExtractor(range)])].sort((a, b) => a - b);
    },
  });

  useEffect(() => {
    const lastItem = rowVirtualizer.getVirtualItems().at(-1);
    if (!lastItem) {
      return;
    }
    if (lastItem.index >= rows.length - 6 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, rowVirtualizer, rows.length]);

  if (isInitialLoading) {
    return <LoadingState />;
  }

  if (assets.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-3 shadow-xl shadow-black/20 sm:p-4">
      <div
        ref={scrollRef}
        className="relative h-[calc(100vh-15.5rem)] min-h-[560px] overflow-auto rounded-[1.35rem] border border-white/5 bg-[linear-gradient(180deg,rgba(8,14,24,0.95),rgba(4,8,14,0.98))] p-3"
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
                style={
                  isActiveStickyHeader
                    ? {
                        position: "sticky",
                        top: 0,
                        zIndex: 20,
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
                  <div className="mb-2 flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 backdrop-blur">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300/70">
                        {row.shortLabel}
                      </p>
                      <h3 className="mt-1 text-sm font-medium text-white sm:text-base">{row.label}</h3>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                      {row.count}
                    </span>
                  </div>
                ) : (
                  <div
                    className="grid"
                    style={{
                      gap: GRID_GAP,
                      gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                    }}
                  >
                    {row.items.map(({ asset, index }) => (
                      <TimelineTile key={asset.id} asset={asset} size={tileSize} onOpen={() => onOpenAsset(index)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="sticky bottom-0 mt-4 flex justify-center pb-1 pt-4">
          {isFetchingNextPage ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/80 px-4 py-2 text-xs uppercase tracking-[0.22em] text-slate-300 backdrop-blur">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading next page
            </div>
          ) : null}
          {!hasNextPage && total > 0 ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/80 px-4 py-2 text-xs uppercase tracking-[0.22em] text-slate-500 backdrop-blur">
              End of timeline
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
