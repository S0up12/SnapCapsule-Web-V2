import { LoaderCircle } from "lucide-react";
import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import Lightbox from "../components/Lightbox";
import BulkSelectionBar from "../components/memories/BulkSelectionBar";
import BulkTagModal from "../components/memories/BulkTagModal";
import MemoriesToolbar from "../components/memories/MemoriesToolbar";
import TagEditorModal from "../components/memories/TagEditorModal";
import VirtualTimelineGrid from "../components/VirtualTimelineGrid";
import { useBulkSetFavorite, useBulkUpdateTags, useDeleteTimelineTag, useToggleFavorite, useUpdateAssetTags } from "../hooks/useAssetActions";
import { useMemoryGridPreferences } from "../hooks/useMemoryGridPreferences";
import { useTimeline, useTimelineTags, type TimelineAsset, type TimelineDateGrouping, type TimelineFilter, type TimelineSort } from "../hooks/useTimeline";
import { applyMemorySelection } from "./memorySelection";

function settingsSortToTimelineSort(value: "newest" | "oldest"): TimelineSort {
  return value === "oldest" ? "asc" : "desc";
}

function timelineSortToSettingsSort(value: TimelineSort): "newest" | "oldest" {
  return value === "asc" ? "oldest" : "newest";
}

function hoverDelayToMs(value: "off" | "0.6s" | "1.2s" | "2s") {
  switch (value) {
    case "off":
      return null;
    case "0.6s":
      return 600;
    case "2s":
      return 2000;
    case "1.2s":
    default:
      return 1200;
  }
}

export default function Memories() {
  const {
    autoplayVideosInGrid,
    defaultGridSize,
    preferBrowserPlayback,
    muteVideoPreviews,
    loopVideoPreviews,
    videoPreviewHoverDelay,
    autoplayVideosInLightbox,
    timelineDefaultSort,
    timelineDefaultFilter,
    timelineDateGrouping,
    timelinePageSize,
    rememberLastTimelineFilters,
    showUndatedAssets: defaultShowUndatedAssets,
    saveSettings,
    isLoading: isLoadingPreferences,
  } = useMemoryGridPreferences();
  const hasAppliedSettingsRef = useRef(false);
  const [sort, setSort] = useState<TimelineSort>(settingsSortToTimelineSort(timelineDefaultSort));
  const [filter, setFilter] = useState<TimelineFilter>(timelineDefaultFilter);
  const [grouping, setGrouping] = useState<TimelineDateGrouping>(timelineDateGrouping);
  const [showUndatedAssets, setShowUndatedAssets] = useState(defaultShowUndatedAssets);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [selectionAnchorAssetId, setSelectionAnchorAssetId] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [tagEditorAsset, setTagEditorAsset] = useState<TimelineAsset | null>(null);
  const [bulkTagMode, setBulkTagMode] = useState<"add" | "remove" | null>(null);
  const deferredSearch = useDeferredValue(search.trim());

  const timelineQuery = useTimeline({
    sort,
    filter,
    pageSize: timelinePageSize,
    includeUndated: showUndatedAssets,
    tag: activeTag,
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
    search: deferredSearch || null,
  });
  const timelineTagsQuery = useTimelineTags();
  const toggleFavorite = useToggleFavorite();
  const bulkSetFavorite = useBulkSetFavorite();
  const bulkUpdateTags = useBulkUpdateTags();
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
  const selectedAssetIdsSet = useMemo(() => new Set(selectedAssetIds), [selectedAssetIds]);
  const selectedAssets = useMemo(
    () => assets.filter((asset) => selectedAssetIdsSet.has(asset.id)),
    [assets, selectedAssetIdsSet],
  );
  const hoverPreviewDelayMs = useMemo(() => hoverDelayToMs(videoPreviewHoverDelay), [videoPreviewHoverDelay]);

  useEffect(() => {
    if (isLoadingPreferences || hasAppliedSettingsRef.current) {
      return;
    }

    setSort(settingsSortToTimelineSort(timelineDefaultSort));
    setFilter(timelineDefaultFilter);
    setGrouping(timelineDateGrouping);
    setShowUndatedAssets(defaultShowUndatedAssets);
    hasAppliedSettingsRef.current = true;
  }, [
    defaultShowUndatedAssets,
    isLoadingPreferences,
    timelineDateGrouping,
    timelineDefaultFilter,
    timelineDefaultSort,
  ]);

  async function persistRememberedTimelineSettings(
    updates: Partial<{
      timeline_default_sort: "newest" | "oldest";
      timeline_default_filter: TimelineFilter;
      timeline_date_grouping: TimelineDateGrouping;
      show_undated_assets: boolean;
    }>,
  ) {
    if (!rememberLastTimelineFilters) {
      return;
    }
    await saveSettings(updates);
  }

  useEffect(() => {
    if (!selectionMode) {
      return;
    }
    const visibleAssetIds = new Set(assets.map((asset) => asset.id));
    setSelectedAssetIds((current) => current.filter((assetId) => visibleAssetIds.has(assetId)));
    setSelectionAnchorAssetId((current) => (current && visibleAssetIds.has(current) ? current : null));
  }, [assets, selectionMode]);

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1740px] flex-col gap-5 overflow-hidden">
      <MemoriesToolbar
        sort={sort}
        filter={filter}
        grouping={grouping}
        showUndatedAssets={showUndatedAssets}
        activeTag={activeTag}
        dateFrom={dateFrom}
        dateTo={dateTo}
        search={search}
        selectionMode={selectionMode}
        selectedCount={selectedAssetIds.length}
        isLoading={isLoading}
        totalAssets={summary.total_assets}
        totalPhotos={summary.total_photos}
        totalVideos={summary.total_videos}
        availableTags={timelineTagsQuery.data ?? []}
        onSortChange={(value) => {
          setSort(value);
          void persistRememberedTimelineSettings({ timeline_default_sort: timelineSortToSettingsSort(value) });
        }}
        onFilterChange={(value) => {
          setFilter(value);
          void persistRememberedTimelineSettings({ timeline_default_filter: value });
        }}
        onGroupingChange={(value) => {
          setGrouping(value);
          void persistRememberedTimelineSettings({ timeline_date_grouping: value });
        }}
        onShowUndatedChange={(value) => {
          setShowUndatedAssets(value);
          void persistRememberedTimelineSettings({ show_undated_assets: value });
        }}
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
        onToggleSelectionMode={() => {
          setSelectionMode((current) => {
            if (current) {
              setSelectedAssetIds([]);
              setSelectionAnchorAssetId(null);
            }
            return !current;
          });
        }}
      />

      {selectionMode && selectedAssetIds.length > 0 ? (
        <BulkSelectionBar
          selectedCount={selectedAssetIds.length}
          isSaving={bulkSetFavorite.isPending || bulkUpdateTags.isPending}
          onClearSelection={() => {
            setSelectedAssetIds([]);
            setSelectionAnchorAssetId(null);
          }}
          onFavoriteSelected={async () => {
            await bulkSetFavorite.mutateAsync({ assets: selectedAssets, isFavorite: true });
            setSelectedAssetIds([]);
            setSelectionAnchorAssetId(null);
          }}
          onUnfavoriteSelected={async () => {
            await bulkSetFavorite.mutateAsync({ assets: selectedAssets, isFavorite: false });
            setSelectedAssetIds([]);
            setSelectionAnchorAssetId(null);
          }}
          onAddTags={() => setBulkTagMode("add")}
          onRemoveTags={() => setBulkTagMode("remove")}
        />
      ) : null}

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
          preferBrowserPlayback={preferBrowserPlayback}
          muteVideoPreviews={muteVideoPreviews}
          loopVideoPreviews={loopVideoPreviews}
          hoverPreviewDelayMs={hoverPreviewDelayMs}
          defaultGridSize={defaultGridSize}
          grouping={grouping}
          hasNextPage={Boolean(hasNextPage)}
          isFetchingNextPage={isFetchingNextPage}
          isInitialLoading={isLoading}
          fetchNextPage={fetchNextPage}
          selectionMode={selectionMode}
          selectedAssetIds={selectedAssetIdsSet}
          onToggleSelection={(asset, shiftKey) => {
            const nextSelection = applyMemorySelection({
              currentSelectedAssetIds: selectedAssetIds,
              assets,
              clickedAssetId: asset.id,
              shiftKey,
              anchorAssetId: selectionAnchorAssetId,
            });
            setSelectedAssetIds(nextSelection.selectedAssetIds);
            setSelectionAnchorAssetId(nextSelection.anchorAssetId);
          }}
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

      {(isFetchingNextPage || toggleFavorite.isPending || bulkSetFavorite.isPending || bulkUpdateTags.isPending || updateAssetTags.isPending || deleteTimelineTag.isPending) && assets.length > 0 ? (
        <div className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/92 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-700 shadow-lg shadow-slate-900/10 backdrop-blur dark:border-white/10 dark:bg-slate-950/90 dark:text-slate-200 dark:shadow-black/30">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          {isFetchingNextPage
            ? "Fetching more assets"
            : deleteTimelineTag.isPending
              ? "Deleting tag"
              : bulkUpdateTags.isPending || bulkSetFavorite.isPending
                ? "Applying bulk changes"
                : "Saving changes"}
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
          preferBrowserPlayback={preferBrowserPlayback}
          autoplayVideosInLightbox={autoplayVideosInLightbox}
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

      {bulkTagMode ? (
        <BulkTagModal
          mode={bulkTagMode}
          selectedCount={selectedAssetIds.length}
          availableTags={timelineTagsQuery.data ?? []}
          onClose={() => setBulkTagMode(null)}
          onApply={async (tags) => {
            await bulkUpdateTags.mutateAsync({
              assets: selectedAssets,
              tags,
              mode: bulkTagMode,
            });
            setSelectedAssetIds([]);
            setSelectionAnchorAssetId(null);
          }}
        />
      ) : null}
    </div>
  );
}
