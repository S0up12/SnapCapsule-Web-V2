import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  CalendarRange,
  CircleOff,
  Images,
  MousePointerSquareDashed,
  Search,
  SlidersHorizontal,
  Tags,
  X,
} from "lucide-react";
import { useMemo } from "react";

import PopoverSelect from "../controls/PopoverSelect";
import type { TimelineDateGrouping, TimelineFilter, TimelineSort } from "../../hooks/useTimeline";
import DateRangePicker from "./DateRangePicker";
import { getMemoryMediaTypeIcon } from "./mediaTypeIcons";

type MemoriesToolbarProps = {
  sort: TimelineSort;
  filter: TimelineFilter;
  grouping: TimelineDateGrouping;
  showUndatedAssets: boolean;
  activeTag: string | null;
  dateFrom: string;
  dateTo: string;
  search: string;
  selectionMode: boolean;
  selectedCount: number;
  isLoading: boolean;
  totalAssets: number;
  totalPhotos: number;
  totalVideos: number;
  availableTags: string[];
  onSortChange: (value: TimelineSort) => void;
  onFilterChange: (value: TimelineFilter) => void;
  onGroupingChange: (value: TimelineDateGrouping) => void;
  onShowUndatedChange: (value: boolean) => void;
  onTagChange: (value: string | null) => void;
  onDateChange: (value: { dateFrom: string; dateTo: string }) => void;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  onClearDates: () => void;
  onToggleSelectionMode: () => void;
};

export default function MemoriesToolbar(props: MemoriesToolbarProps) {
  const {
    sort,
    filter,
    grouping,
    showUndatedAssets,
    activeTag,
    dateFrom,
    dateTo,
    search,
    selectionMode,
    selectedCount,
    isLoading,
    totalAssets,
    totalPhotos,
    totalVideos,
    availableTags,
    onSortChange,
    onFilterChange,
    onGroupingChange,
    onShowUndatedChange,
    onTagChange,
    onDateChange,
    onSearchChange,
    onClearSearch,
    onClearDates,
    onToggleSelectionMode,
  } = props;
  const sortOptions = useMemo<Array<{ value: TimelineSort; label: string }>>(
    () => [
      { value: "desc", label: "Newest First" },
      { value: "asc", label: "Oldest First" },
    ],
    [],
  );
  const filterOptions = useMemo<Array<{ value: TimelineFilter; label: string }>>(
    () => [
      { value: "all", label: "All" },
      { value: "favorites", label: "Favorites" },
      { value: "photos", label: "Photos Only" },
      { value: "videos", label: "Videos Only" },
    ],
    [],
  );
  const tagOptions = useMemo(
    () => [{ value: "", label: "All Tags" }, ...availableTags.map((tag) => ({ value: tag, label: tag }))],
    [availableTags],
  );
  const groupingOptions = useMemo<Array<{ value: TimelineDateGrouping; label: string }>>(
    () => [
      { value: "year", label: "Group By Year" },
      { value: "month", label: "Group By Month" },
      { value: "day", label: "Group By Day" },
    ],
    [],
  );
  const PhotoIcon = getMemoryMediaTypeIcon("image");
  const VideoIcon = getMemoryMediaTypeIcon("video");

  return (
    <section className="flex flex-col gap-4 rounded-[1.6rem] border border-slate-200/80 bg-white px-5 py-4 shadow-[0_22px_60px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.045] md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[15rem] flex-1 md:max-w-[22rem]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search memories"
            aria-label="Search memories"
            className="w-full rounded-[1rem] border border-slate-200 bg-slate-50 py-3 pl-10 pr-10 text-sm text-slate-900 outline-none transition focus:border-sky-400 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-100"
          />
          {search ? (
            <button
              type="button"
              onClick={onClearSearch}
              className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-200/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </label>
        <PopoverSelect
          label="Sort"
          icon={sort === "desc" ? ArrowDownWideNarrow : ArrowUpWideNarrow}
          value={sort}
          onChange={(value) => onSortChange(value as TimelineSort)}
          options={sortOptions}
        />
        <PopoverSelect
          label="Filter"
          icon={SlidersHorizontal}
          value={filter}
          onChange={(value) => onFilterChange(value as TimelineFilter)}
          options={filterOptions}
        />
        <PopoverSelect
          label="Tag"
          icon={Tags}
          value={activeTag ?? ""}
          onChange={(value) => onTagChange(value || null)}
          options={tagOptions}
        />
        <PopoverSelect
          label="Group memories"
          icon={CalendarRange}
          value={grouping}
          onChange={(value) => onGroupingChange(value as TimelineDateGrouping)}
          options={groupingOptions}
        />
        <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} onChange={onDateChange} />
        <button
          type="button"
          onClick={() => onShowUndatedChange(!showUndatedAssets)}
          className={[
            "inline-flex items-center gap-2 rounded-[1rem] border px-3 py-2 text-sm font-medium shadow-sm transition",
            showUndatedAssets
              ? "border-slate-200/80 bg-white/90 text-slate-700 hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-slate-950/65 dark:text-slate-200 dark:hover:text-white"
              : "border-amber-300/25 bg-amber-400/[0.12] text-amber-950 dark:text-amber-100",
          ].join(" ")}
        >
          <CircleOff className="h-4 w-4" />
          {showUndatedAssets ? "Undated Visible" : "Undated Hidden"}
        </button>
        <button
          type="button"
          onClick={onToggleSelectionMode}
          className={[
            "inline-flex items-center gap-2 rounded-[1rem] border px-3 py-2 text-sm font-medium shadow-sm transition",
            selectionMode
              ? "border-sky-300/20 bg-sky-400/[0.12] text-sky-950 dark:text-sky-100"
              : "border-slate-200/80 bg-white/90 text-slate-700 hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-slate-950/65 dark:text-slate-200 dark:hover:text-white",
          ].join(" ")}
        >
          <MousePointerSquareDashed className="h-4 w-4" />
          {selectionMode ? `Cancel Select${selectedCount > 0 ? ` (${selectedCount})` : ""}` : "Select"}
        </button>
        {dateFrom || dateTo ? (
          <button
            type="button"
            onClick={onClearDates}
            className="inline-flex items-center gap-2 rounded-[1rem] border border-slate-200/80 bg-white/90 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-slate-950/65 dark:text-slate-200 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
            Clear Dates
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-200">
          <Images className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          <span>{isLoading ? "..." : totalAssets}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-200">
          <PhotoIcon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          <span>{isLoading ? "..." : totalPhotos}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-200">
          <VideoIcon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          <span>{isLoading ? "..." : totalVideos}</span>
        </span>
      </div>
    </section>
  );
}
