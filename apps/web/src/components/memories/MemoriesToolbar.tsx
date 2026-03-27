import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  Images,
  SlidersHorizontal,
  Tags,
  X,
} from "lucide-react";
import { useMemo } from "react";

import PopoverSelect from "../controls/PopoverSelect";
import type { TimelineFilter, TimelineSort } from "../../hooks/useTimeline";
import DateRangePicker from "./DateRangePicker";
import { getMemoryMediaTypeIcon } from "./mediaTypeIcons";

type MemoriesToolbarProps = {
  sort: TimelineSort;
  filter: TimelineFilter;
  activeTag: string | null;
  dateFrom: string;
  dateTo: string;
  isLoading: boolean;
  totalAssets: number;
  totalPhotos: number;
  totalVideos: number;
  availableTags: string[];
  onSortChange: (value: TimelineSort) => void;
  onFilterChange: (value: TimelineFilter) => void;
  onTagChange: (value: string | null) => void;
  onDateChange: (value: { dateFrom: string; dateTo: string }) => void;
  onClearDates: () => void;
};

export default function MemoriesToolbar(props: MemoriesToolbarProps) {
  const {
    sort,
    filter,
    activeTag,
    dateFrom,
    dateTo,
    isLoading,
    totalAssets,
    totalPhotos,
    totalVideos,
    availableTags,
    onSortChange,
    onFilterChange,
    onTagChange,
    onDateChange,
    onClearDates,
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
  const PhotoIcon = getMemoryMediaTypeIcon("image");
  const VideoIcon = getMemoryMediaTypeIcon("video");

  return (
    <section className="flex flex-col gap-4 rounded-[1.6rem] border border-slate-200/80 bg-white/82 px-5 py-4 shadow-[0_22px_60px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.045] md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-2">
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
        <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} onChange={onDateChange} />
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
