import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export type TimelineAsset = {
  id: string;
  taken_at: string | null;
  media_type: "image" | "video";
};

type TimelinePage = {
  items: TimelineAsset[];
  limit: number;
  offset: number;
  total: number;
  has_more: boolean;
};

const PAGE_SIZE = 100;

async function fetchTimelinePage(offset: number): Promise<TimelinePage> {
  const response = await fetch(`/api/timeline?limit=${PAGE_SIZE}&offset=${offset}`);
  if (!response.ok) {
    throw new Error(`Timeline request failed with ${response.status}`);
  }

  return (await response.json()) as TimelinePage;
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

export function getThumbnailUrl(assetId: string) {
  return `/api/asset/${assetId}/thumbnail`;
}

export function getOriginalUrl(assetId: string) {
  return `/api/asset/${assetId}/original`;
}

export function useTimeline() {
  const query = useInfiniteQuery({
    queryKey: ["timeline"],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchTimelinePage(pageParam),
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

  return {
    ...query,
    assets,
    total,
    pageSize: PAGE_SIZE,
  };
}
