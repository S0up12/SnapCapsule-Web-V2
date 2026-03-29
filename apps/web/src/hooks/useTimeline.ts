import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export type TimelineAsset = {
  id: string;
  taken_at: string | null;
  media_type: "image" | "video";
  is_favorite: boolean;
  tags: string[];
  has_overlay: boolean;
};

type TimelineSummary = {
  total_assets: number;
  total_photos: number;
  total_videos: number;
};

type TimelinePage = {
  items: TimelineAsset[];
  limit: number;
  offset: number;
  total: number;
  has_more: boolean;
  summary: TimelineSummary;
};

export type TimelineSort = "desc" | "asc";
export type TimelineFilter = "all" | "favorites" | "photos" | "videos";
export type TimelineDateGrouping = "year" | "month" | "day";

export type TimelineQueryState = {
  sort: TimelineSort;
  filter: TimelineFilter;
  includeUndated: boolean;
  tag: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  search: string | null;
};

const PAGE_SIZE = 100;

function buildTimelineSearchParams(offset: number, filters: TimelineQueryState) {
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(offset),
    sort: filters.sort,
  });

  if (filters.filter === "favorites") {
    params.set("favorite", "true");
  }
  if (filters.filter === "photos") {
    params.set("media_type", "image");
  }
  if (filters.filter === "videos") {
    params.set("media_type", "video");
  }
  if (filters.tag) {
    params.append("tags", filters.tag);
  }
  if (filters.dateFrom) {
    params.set("date_from", filters.dateFrom);
  }
  if (filters.dateTo) {
    params.set("date_to", filters.dateTo);
  }
  if (filters.search) {
    params.set("search", filters.search);
  }
  if (!filters.includeUndated) {
    params.set("include_undated", "false");
  }

  return params;
}

async function fetchTimelinePage(offset: number, filters: TimelineQueryState): Promise<TimelinePage> {
  const response = await fetch(`/api/timeline?${buildTimelineSearchParams(offset, filters).toString()}`);
  if (!response.ok) {
    throw new Error(`Timeline request failed with ${response.status}`);
  }

  return (await response.json()) as TimelinePage;
}

async function fetchTimelineTags(): Promise<string[]> {
  const response = await fetch("/api/timeline/tags");
  if (!response.ok) {
    throw new Error(`Timeline tag request failed with ${response.status}`);
  }

  const payload = (await response.json()) as { tags: string[] };
  return payload.tags;
}

export function formatTimelineDate(value: string | null) {
  if (!value) {
    return {
      key: "undated",
      label: "Undated",
      shortLabel: "Undated",
    };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return {
      key: "undated",
      label: "Undated",
      shortLabel: "Undated",
    };
  }

  return {
    key: date.toISOString().slice(0, 10),
    label: new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date),
    shortLabel: new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date),
  };
}

export function formatTimelineGroup(value: string | null, grouping: TimelineDateGrouping) {
  if (!value) {
    return {
      key: "undated",
      label: "Undated",
      shortLabel: "Unknown date",
    };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return {
      key: "undated",
      label: "Undated",
      shortLabel: "Unknown date",
    };
  }

  if (grouping === "day") {
    return formatTimelineDate(value);
  }

  if (grouping === "month") {
    return {
      key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat(undefined, {
        month: "long",
        year: "numeric",
      }).format(date),
      shortLabel: "Month",
    };
  }

  const year = date.getUTCFullYear();
  return {
    key: String(year),
    label: String(year),
    shortLabel: "Year",
  };
}

function withQueryParams(
  url: string,
  params: Record<string, string | number | boolean | null | undefined>,
) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }
    searchParams.set(key, String(value));
  }

  const query = searchParams.toString();
  return query ? `${url}?${query}` : url;
}

export function getThumbnailUrl(
  assetId: string,
  cacheKey?: string | number | boolean | null,
  includeOverlay: boolean = true,
) {
  const variant = includeOverlay ? "overlay" : "plain";
  const version = cacheKey === undefined || cacheKey === null ? `thumb-v2-${variant}` : `${cacheKey}-thumb-v2-${variant}`;
  return withQueryParams(`/api/asset/${assetId}/thumbnail`, {
    v: version,
    include_overlay: includeOverlay ? undefined : false,
  });
}

export function getOriginalUrl(assetId: string, cacheKey?: string | number | boolean | null) {
  return withQueryParams(`/api/asset/${assetId}/original`, { v: cacheKey });
}

export function getPlaybackUrl(assetId: string, cacheKey?: string | number | boolean | null) {
  return withQueryParams(`/api/asset/${assetId}/playback`, { v: cacheKey });
}

export function getVideoStreamUrl(
  assetId: string,
  preferBrowserPlayback: boolean,
  cacheKey?: string | number | boolean | null,
) {
  return preferBrowserPlayback ? getPlaybackUrl(assetId, cacheKey) : getOriginalUrl(assetId, cacheKey);
}

export function getOverlayUrl(assetId: string, cacheKey?: string | number | boolean | null) {
  return withQueryParams(`/api/asset/${assetId}/overlay`, { v: cacheKey });
}

export function useTimeline(filters: TimelineQueryState) {
  const query = useInfiniteQuery({
    queryKey: [
      "timeline",
      filters.sort,
      filters.filter,
      filters.includeUndated,
      filters.tag ?? "",
      filters.dateFrom ?? "",
      filters.dateTo ?? "",
      filters.search ?? "",
    ],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchTimelinePage(pageParam, filters),
    getNextPageParam: (lastPage, pages) => {
      if (!lastPage.has_more) {
        return undefined;
      }

      return pages.reduce((count, page) => count + page.items.length, 0);
    },
  });

  const assets = useMemo(() => {
    const seen = new Set<string>();
    const next: TimelineAsset[] = [];

    for (const page of query.data?.pages ?? []) {
      for (const item of page.items) {
        if (seen.has(item.id)) {
          continue;
        }
        seen.add(item.id);
        next.push(item);
      }
    }

    return next;
  }, [query.data?.pages]);

  const total = query.data?.pages[0]?.total ?? 0;
  const summary = query.data?.pages[0]?.summary ?? {
    total_assets: 0,
    total_photos: 0,
    total_videos: 0,
  };

  return {
    ...query,
    assets,
    total,
    summary,
    pageSize: PAGE_SIZE,
  };
}

export function useTimelineTags() {
  return useQuery({
    queryKey: ["timeline-tags"],
    queryFn: fetchTimelineTags,
    staleTime: 30_000,
  });
}
