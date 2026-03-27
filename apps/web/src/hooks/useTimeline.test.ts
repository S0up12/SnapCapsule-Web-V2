import type { ReactNode } from "react";

import { getThumbnailUrl } from "./useTimeline";

describe("getThumbnailUrl", () => {
  it("uses a variant-specific cache key for overlay and plain thumbnails", () => {
    expect(getThumbnailUrl("asset-1", 1, true)).toBe("/api/asset/asset-1/thumbnail?v=1-thumb-v2-overlay");
    expect(getThumbnailUrl("asset-1", 1, false)).toBe(
      "/api/asset/asset-1/thumbnail?v=1-thumb-v2-plain&include_overlay=false",
    );
  });
});

describe("timeline search params", () => {
  it("includes search terms in the timeline request query", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [],
        limit: 100,
        offset: 0,
        total: 0,
        has_more: false,
        summary: {
          total_assets: 0,
          total_photos: 0,
          total_videos: 0,
        },
      }),
    });
    globalThis.fetch = fetchMock as typeof globalThis.fetch;
    try {
      const React = await import("react");
      const { useTimeline } = await import("./useTimeline");
      const { renderHook, waitFor } = await import("@testing-library/react");
      const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");

      const queryClient = new QueryClient();
      const wrapper = ({ children }: { children: ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      renderHook(
        () =>
          useTimeline({
            sort: "desc",
            filter: "all",
            tag: null,
            dateFrom: null,
            dateTo: null,
            search: "sunrise june",
          }),
        { wrapper },
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });
      expect(fetchMock.mock.calls[0]?.[0]).toContain("search=sunrise+june");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
