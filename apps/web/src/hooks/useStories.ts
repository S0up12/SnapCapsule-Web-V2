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

type StoriesResponse = {
  items: StoryCollection[];
  total_collections: number;
  total_story_items: number;
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
