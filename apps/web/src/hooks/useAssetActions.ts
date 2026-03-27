import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";

type AssetMutationResponse = {
  id: string;
  is_favorite: boolean;
  tags: string[];
};

type TagDeleteResponse = {
  tag: string;
  affected_assets: number;
};

type TimelineItem = AssetMutationResponse & {
  taken_at: string | null;
  media_type: "image" | "video";
  has_overlay: boolean;
};

type TimelinePage = {
  items: TimelineItem[];
  limit: number;
  offset: number;
  total: number;
  has_more: boolean;
  summary: {
    total_assets: number;
    total_photos: number;
    total_videos: number;
  };
};

type ChatMediaAsset = AssetMutationResponse & {
  taken_at: string | null;
  media_type: "image" | "video" | "audio";
  has_overlay: boolean;
};

type ChatMessagesResponse = {
  items: Array<{
    id: string;
    sender: string;
    sender_label: string;
    is_me: boolean;
    text: string;
    sent_at: string;
    media_assets: ChatMediaAsset[];
  }>;
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
};

type StoryAsset = AssetMutationResponse & {
  taken_at: string | null;
  media_type: "image" | "video";
  has_overlay: boolean;
};

type StoriesResponse = {
  items: Array<{
    id: string;
    title: string;
    story_type: "private" | "public" | "saved" | "unknown";
    total_items: number;
    earliest_posted_at: string | null;
    latest_posted_at: string | null;
    items: StoryAsset[];
  }>;
  total_collections: number;
  total_story_items: number;
};

async function postFavorite(assetId: string): Promise<AssetMutationResponse> {
  const response = await fetch(`/api/asset/${assetId}/favorite`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Favorite update failed with ${response.status}`);
  }

  return (await response.json()) as AssetMutationResponse;
}

async function postTags(assetId: string, tags: string[]): Promise<AssetMutationResponse> {
  const response = await fetch(`/api/asset/${assetId}/tags`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tags }),
  });
  if (!response.ok) {
    throw new Error(`Tag update failed with ${response.status}`);
  }

  return (await response.json()) as AssetMutationResponse;
}

async function deleteTimelineTag(tag: string): Promise<TagDeleteResponse> {
  const response = await fetch(`/api/timeline/tags/${encodeURIComponent(tag)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Tag delete failed with ${response.status}`);
  }

  return (await response.json()) as TagDeleteResponse;
}

function invalidateTimelineQueries(queryClient: ReturnType<typeof useQueryClient>, { includeTags }: { includeTags: boolean }) {
  void queryClient.invalidateQueries({ queryKey: ["timeline"] });
  if (includeTags) {
    void queryClient.invalidateQueries({ queryKey: ["timeline-tags"] });
  }
}

function applyAssetMutation(queryClient: ReturnType<typeof useQueryClient>, nextAsset: AssetMutationResponse) {
  queryClient.setQueriesData<InfiniteData<TimelinePage>>({ queryKey: ["timeline"] }, (current) => {
    if (!current) {
      return current;
    }

    return {
      ...current,
      pages: current.pages.map((page) => ({
        ...page,
        items: page.items.map((item) =>
          item.id === nextAsset.id
            ? {
                ...item,
                is_favorite: nextAsset.is_favorite,
                tags: nextAsset.tags,
              }
            : item,
        ),
      })),
    };
  });

  queryClient.setQueriesData<ChatMessagesResponse>({ queryKey: ["chat-messages"] }, (current) => {
    if (!current) {
      return current;
    }

    return {
      ...current,
      items: current.items.map((message) => ({
        ...message,
        media_assets: message.media_assets.map((asset) =>
          asset.id === nextAsset.id
            ? {
                ...asset,
                is_favorite: nextAsset.is_favorite,
                tags: nextAsset.tags,
              }
            : asset,
        ),
      })),
    };
  });

  queryClient.setQueryData<StoriesResponse>(["stories"], (current) => {
    if (!current) {
      return current;
    }

    return {
      ...current,
      items: current.items.map((collection) => ({
        ...collection,
        items: collection.items.map((asset) =>
          asset.id === nextAsset.id
            ? {
                ...asset,
                is_favorite: nextAsset.is_favorite,
                tags: nextAsset.tags,
              }
            : asset,
        ),
      })),
    };
  });
}

function removeDeletedTagFromCaches(queryClient: ReturnType<typeof useQueryClient>, tag: string) {
  const normalizedKey = tag.trim().toLocaleLowerCase();
  if (!normalizedKey) {
    return;
  }

  queryClient.setQueriesData<InfiniteData<TimelinePage>>({ queryKey: ["timeline"] }, (current) => {
    if (!current) {
      return current;
    }

    return {
      ...current,
      pages: current.pages.map((page) => ({
        ...page,
        items: page.items.map((item) => ({
          ...item,
          tags: item.tags.filter((value) => value.trim().toLocaleLowerCase() !== normalizedKey),
        })),
      })),
    };
  });

  queryClient.setQueriesData<ChatMessagesResponse>({ queryKey: ["chat-messages"] }, (current) => {
    if (!current) {
      return current;
    }

    return {
      ...current,
      items: current.items.map((message) => ({
        ...message,
        media_assets: message.media_assets.map((asset) => ({
          ...asset,
          tags: asset.tags.filter((value) => value.trim().toLocaleLowerCase() !== normalizedKey),
        })),
      })),
    };
  });

  queryClient.setQueryData<StoriesResponse>(["stories"], (current) => {
    if (!current) {
      return current;
    }

    return {
      ...current,
      items: current.items.map((collection) => ({
        ...collection,
        items: collection.items.map((asset) => ({
          ...asset,
          tags: asset.tags.filter((value) => value.trim().toLocaleLowerCase() !== normalizedKey),
        })),
      })),
    };
  });

  queryClient.setQueryData<string[]>(["timeline-tags"], (current) =>
    (current ?? []).filter((value) => value.trim().toLocaleLowerCase() !== normalizedKey),
  );
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postFavorite,
    onSuccess: (updated) => {
      applyAssetMutation(queryClient, updated);
      invalidateTimelineQueries(queryClient, { includeTags: false });
    },
  });
}

export function useUpdateAssetTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ assetId, tags }: { assetId: string; tags: string[] }) => postTags(assetId, tags),
    onSuccess: (updated) => {
      applyAssetMutation(queryClient, updated);
      invalidateTimelineQueries(queryClient, { includeTags: true });
    },
  });
}

export function useDeleteTimelineTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTimelineTag,
    onSuccess: (deleted) => {
      removeDeletedTagFromCaches(queryClient, deleted.tag);
      invalidateTimelineQueries(queryClient, { includeTags: true });
    },
  });
}
