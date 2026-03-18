import { ArrowDownWideNarrow, ArrowUpWideNarrow, LoaderCircle, SlidersHorizontal, Tags } from "lucide-react";
import { type ReactNode, startTransition, useMemo, useState } from "react";

import Lightbox from "../components/Lightbox";
import VirtualTimelineGrid from "../components/VirtualTimelineGrid";
import TagEditorModal from "../components/memories/TagEditorModal";
import { useToggleFavorite, useUpdateAssetTags } from "../hooks/useAssetActions";
import {
  useTimeline,
  useTimelineTags,
  type TimelineAsset,
  type TimelineFilter,
  type TimelineSort,
} from "../hooks/useTimeline";

function ControlSelect({
  label,
  icon: Icon,
  value,
  onChange,
  children,
}: {
  label: string;
  icon: typeof SlidersHorizontal;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-[1rem] border border-slate-200/80 bg-white/90 px-3 py-2 text-sm text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-950/65 dark:text-slate-200">
      <Icon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-transparent pr-6 text-sm font-medium outline-none"
      >
        {children}
      </select>
    </label>
  );
}

export default function Memories() {
  const [sort, setSort] = useState<TimelineSort>("desc");
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [tagEditorAsset, setTagEditorAsset] = useState<TimelineAsset | null>(null);

  const timelineQuery = useTimeline({
    sort,
    filter,
    tag: activeTag,
  });
  const timelineTagsQuery = useTimelineTags();
  const toggleFavorite = useToggleFavorite();
  const updateAssetTags = useUpdateAssetTags();

  const {
    assets,
    total,
    summary,
    isLoading,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = timelineQuery;

  const selectedAsset = selectedIndex !== null ? assets[selectedIndex] : null;

  const summaryText = useMemo(() => {
    if (isLoading) {
      return "Loading";
    }
    return `${summary.total_assets} memories • ${summary.total_photos} photos • ${summary.total_videos} videos`;
  }, [isLoading, summary.total_assets, summary.total_photos, summary.total_videos]);

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1740px] flex-col gap-5 overflow-hidden">
      <section className="flex flex-col gap-4 rounded-[1.6rem] border border-slate-200/80 bg-white/82 px-5 py-4 shadow-[0_22px_60px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.045] md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border border-slate-200/80 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-200">
            {summaryText}
          </span>
          <ControlSelect
            label="Sort"
            icon={sort === "desc" ? ArrowDownWideNarrow : ArrowUpWideNarrow}
            value={sort}
            onChange={(value) => setSort(value as TimelineSort)}
          >
            <option value="desc">Newest First</option>
            <option value="asc">Oldest First</option>
          </ControlSelect>

          <ControlSelect
            label="Filter"
            icon={SlidersHorizontal}
            value={filter}
            onChange={(value) => setFilter(value as TimelineFilter)}
          >
            <option value="all">All</option>
            <option value="favorites">Favorites</option>
            <option value="photos">Photos Only</option>
            <option value="videos">Videos Only</option>
          </ControlSelect>

          <ControlSelect
            label="Tag"
            icon={Tags}
            value={activeTag ?? ""}
            onChange={(value) => setActiveTag(value || null)}
          >
            <option value="">All Tags</option>
            {(timelineTagsQuery.data ?? []).map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </ControlSelect>
        </div>
      </section>

      {isError ? (
        <div className="rounded-[1.25rem] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error instanceof Error ? error.message : "Failed to load memories."}
        </div>
      ) : null}

      {!isError ? (
        <VirtualTimelineGrid
          assets={assets}
          total={total}
          hasNextPage={Boolean(hasNextPage)}
          isFetchingNextPage={isFetchingNextPage}
          isInitialLoading={isLoading}
          fetchNextPage={fetchNextPage}
          onOpenAsset={(index) => {
            startTransition(() => {
              setSelectedIndex(index);
            });
          }}
          onToggleFavorite={async (asset) => {
            await toggleFavorite.mutateAsync(asset.id);
          }}
          onEditTags={(asset) => {
            setTagEditorAsset(asset);
          }}
        />
      ) : null}

      {(isFetchingNextPage || toggleFavorite.isPending || updateAssetTags.isPending) && assets.length > 0 ? (
        <div className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/92 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-700 shadow-lg shadow-slate-900/10 backdrop-blur dark:border-white/10 dark:bg-slate-950/90 dark:text-slate-200 dark:shadow-black/30">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          {isFetchingNextPage ? "Fetching more assets" : "Saving changes"}
        </div>
      ) : null}

      {selectedAsset && selectedIndex !== null ? (
        <Lightbox
          assets={assets}
          currentIndex={selectedIndex}
          onClose={() => setSelectedIndex(null)}
          onNavigate={(nextIndex) => {
            if (nextIndex < 0 || nextIndex >= assets.length) {
              return;
            }
            startTransition(() => {
              setSelectedIndex(nextIndex);
            });
          }}
        />
      ) : null}

      {tagEditorAsset ? (
        <TagEditorModal
          assetId={tagEditorAsset.id}
          initialTags={tagEditorAsset.tags}
          onClose={() => setTagEditorAsset(null)}
          onSave={async (tags) => {
            await updateAssetTags.mutateAsync({ assetId: tagEditorAsset.id, tags });
          }}
        />
      ) : null}
    </div>
  );
}
