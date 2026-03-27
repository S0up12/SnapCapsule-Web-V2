import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useToggleFavorite } from "./useAssetActions";

type TimelineCache = {
  pages: Array<{
    items: Array<{
      id: string;
      is_favorite: boolean;
      tags: string[];
    }>;
  }>;
};

type ChatMessagesCache = {
  items: Array<{
    media_assets: Array<{
      id: string;
      is_favorite: boolean;
      tags: string[];
    }>;
  }>;
};

type StoriesCache = {
  items: Array<{
    items: Array<{
      id: string;
      is_favorite: boolean;
      tags: string[];
    }>;
  }>;
};

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useToggleFavorite", () => {
  it("patches cached timeline, story, and chat assets after a successful mutation", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    queryClient.setQueryData(["timeline", "desc", "all", "", "", ""], {
      pageParams: [0],
      pages: [
        {
          items: [
            {
              id: "asset-1",
              taken_at: null,
              media_type: "image",
              is_favorite: false,
              tags: [],
              has_overlay: false,
            },
          ],
          limit: 100,
          offset: 0,
          total: 1,
          has_more: false,
          summary: {
            total_assets: 1,
            total_photos: 1,
            total_videos: 0,
          },
        },
      ],
    });
    queryClient.setQueryData(["chat-messages", "chat-1"], {
      items: [
        {
          id: "message-1",
          sender: "Me",
          sender_label: "ME",
          is_me: true,
          text: "",
          sent_at: "2026-03-27T11:00:00Z",
          media_assets: [
            {
              id: "asset-1",
              taken_at: null,
              media_type: "image",
              is_favorite: false,
              tags: [],
              has_overlay: false,
            },
          ],
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
      has_more: false,
    });
    queryClient.setQueryData(["stories"], {
      items: [
        {
          id: "story-1",
          title: "Story",
          story_type: "private",
          total_items: 1,
          earliest_posted_at: null,
          latest_posted_at: null,
          items: [
            {
              id: "asset-1",
              taken_at: null,
              media_type: "image",
              is_favorite: false,
              tags: [],
              has_overlay: false,
            },
          ],
        },
      ],
      total_collections: 1,
      total_story_items: 1,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "asset-1",
          is_favorite: true,
          tags: ["favorite"],
        }),
      }),
    );

    const { result } = renderHook(() => useToggleFavorite(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync("asset-1");

    await waitFor(() => {
      const timeline = queryClient.getQueryData<TimelineCache>(["timeline", "desc", "all", "", "", ""]);
      expect(timeline).toBeTruthy();
      expect(timeline!.pages[0].items[0]).toMatchObject({
        id: "asset-1",
        is_favorite: true,
        tags: ["favorite"],
      });
      const chatMessages = queryClient.getQueryData<ChatMessagesCache>(["chat-messages", "chat-1"]);
      expect(chatMessages).toBeTruthy();
      expect(chatMessages!.items[0].media_assets[0]).toMatchObject({
        id: "asset-1",
        is_favorite: true,
        tags: ["favorite"],
      });
      const stories = queryClient.getQueryData<StoriesCache>(["stories"]);
      expect(stories).toBeTruthy();
      expect(stories!.items[0].items[0]).toMatchObject({
        id: "asset-1",
        is_favorite: true,
        tags: ["favorite"],
      });
    });
  });
});
