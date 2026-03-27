import { LoaderCircle } from "lucide-react";
import { startTransition, useDeferredValue, useState } from "react";

import Lightbox from "../components/Lightbox";
import MemoriesToolbar from "../components/memories/MemoriesToolbar";
import TagEditorModal from "../components/memories/TagEditorModal";
import VirtualTimelineGrid from "../components/VirtualTimelineGrid";
import { useDeleteTimelineTag, useToggleFavorite, useUpdateAssetTags } from "../hooks/useAssetActions";
import { useMemoryGridPreferences } from "../hooks/useMemoryGridPreferences";
import { useTimeline, useTimelineTags, type TimelineAsset, type TimelineFilter, type TimelineSort } from "../hooks/useTimeline";

export default function Memories() {
  const { autoplayVideosInGrid, defaultGridSize } = useMemoryGridPreferences();
  const [sort, setSort] = useState<TimelineSort>("desc");
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [tagEditorAsset, setTagEditorAsset] = useState<TimelineAsset | null>(null);
  const deferredSearch = useDeferredValue(search.trim());

  const timelineQuery = useTimeline({
    sort,
    filter,
    tag: activeTag,
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
    search: deferredSearch || null,
  });
  const timelineTagsQuery = useTimelineTags();
  const toggleFavorite = useToggleFavorite();
  const updateAssetTags = useUpdateAssetTags();
  const deleteTimelineTag = useDeleteTimelineTag();

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

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1740px] flex-col gap-5 overflow-hidden">
      <MemoriesToolbar
        sort={sort}
        filter={filter}
        activeTag={activeTag}
        dateFrom={dateFrom}
        dateTo={dateTo}
        search={search}
        isLoading={isLoading}
        totalAssets={summary.total_assets}
        totalPhotos={summary.total_photos}
        totalVideos={summary.total_videos}
        availableTags={timelineTagsQuery.data ?? []}
        onSortChange={setSort}
        onFilterChange={setFilter}
        onTagChange={setActiveTag}
        onDateChange={({ dateFrom: nextDateFrom, dateTo: nextDateTo }) => {
          setDateFrom(nextDateFrom);
          setDateTo(nextDateTo);
        }}
        onSearchChange={setSearch}
        onClearSearch={() => {
          setSearch("");
        }}
        onClearDates={() => {
          setDateFrom("");
          setDateTo("");
        }}
      />

      {isError ? (
        <div className="rounded-[1.25rem] border border-rose-300/40 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-100">
          {error instanceof Error ? error.message : "Failed to load memories."}
        </div>
      ) : null}

      {!isError ? (
        <VirtualTimelineGrid
          assets={assets}
          total={total}
          autoplayVideosInGrid={autoplayVideosInGrid}
          defaultGridSize={defaultGridSize}
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

      {(isFetchingNextPage || toggleFavorite.isPending || updateAssetTags.isPending || deleteTimelineTag.isPending) && assets.length > 0 ? (
        <div className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/92 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-700 shadow-lg shadow-slate-900/10 backdrop-blur dark:border-white/10 dark:bg-slate-950/90 dark:text-slate-200 dark:shadow-black/30">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          {isFetchingNextPage ? "Fetching more assets" : deleteTimelineTag.isPending ? "Deleting tag" : "Saving changes"}
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
          onToggleFavorite={async (asset) => {
            await toggleFavorite.mutateAsync(asset.id);
          }}
          onEditTags={(asset) => {
            setTagEditorAsset(asset);
          }}
        />
      ) : null}

      {tagEditorAsset ? (
        <TagEditorModal
          assetId={tagEditorAsset.id}
          initialTags={tagEditorAsset.tags}
          availableTags={timelineTagsQuery.data ?? []}
          onClose={() => setTagEditorAsset(null)}
          onSave={async (tags) => {
            await updateAssetTags.mutateAsync({ assetId: tagEditorAsset.id, tags });
          }}
          onDeleteTag={async (tag) => {
            await deleteTimelineTag.mutateAsync(tag);
            if (activeTag?.trim().toLocaleLowerCase() === tag.trim().toLocaleLowerCase()) {
              setActiveTag(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}
