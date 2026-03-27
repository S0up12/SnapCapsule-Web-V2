import { useQuery } from "@tanstack/react-query";

export type StoryAsset = {
  id: string;
  taken_at: string | null;
  media_type: "image" | "video";
  is_favorite: boolean;
  tags: string[];
  has_overlay: boolean;
};

export type StoryCollection = {
  id: string;
  title: string;
  story_type: "private" | "public" | "saved" | "unknown";
  total_items: number;
  earliest_posted_at: string | null;
  latest_posted_at: string | null;
  items: StoryAsset[];
};

export type StoryActivityEntry = {
  story_date: string | null;
  story_url: string | null;
  action_type: string | null;
  view_duration_seconds: number | null;
};

export type StoriesActivitySummary = {
  spotlight_history_count: number;
  shared_story_count: number;
  latest_story_date: string | null;
  spotlight_history: StoryActivityEntry[];
  shared_story_activity: StoryActivityEntry[];
};

type StoriesResponse = {
  items: StoryCollection[];
  total_collections: number;
  total_story_items: number;
  activity: StoriesActivitySummary;
};

async function fetchStories(): Promise<StoriesResponse> {
  const response = await fetch("/api/stories");
  if (!response.ok) {
    throw new Error(`Stories request failed with ${response.status}`);
  }

  return (await response.json()) as StoriesResponse;
}

export function useStories() {
  return useQuery({
    queryKey: ["stories"],
    queryFn: fetchStories,
    staleTime: 15_000,
  });
}
