import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import Memories from "./Memories";

const useMemoryGridPreferences = vi.fn();
const useTimeline = vi.fn();
const useTimelineTags = vi.fn();
const useToggleFavorite = vi.fn();
const useUpdateAssetTags = vi.fn();
const useDeleteTimelineTag = vi.fn();

vi.mock("../hooks/useMemoryGridPreferences", () => ({
  useMemoryGridPreferences: () => useMemoryGridPreferences(),
}));

vi.mock("../hooks/useTimeline", async () => {
  const actual = await vi.importActual<typeof import("../hooks/useTimeline")>("../hooks/useTimeline");
  return {
    ...actual,
    useTimeline: (...args: unknown[]) => useTimeline(...args),
    useTimelineTags: () => useTimelineTags(),
  };
});

vi.mock("../hooks/useAssetActions", () => ({
  useToggleFavorite: () => useToggleFavorite(),
  useUpdateAssetTags: () => useUpdateAssetTags(),
  useDeleteTimelineTag: () => useDeleteTimelineTag(),
}));

vi.mock("../components/VirtualTimelineGrid", () => ({
  default: () => <div>Timeline Grid</div>,
}));

vi.mock("../components/Lightbox", () => ({
  default: () => <div>Lightbox</div>,
}));

vi.mock("../components/memories/TagEditorModal", () => ({
  default: () => <div>Tag Editor</div>,
}));

describe("Memories", () => {
  it("updates timeline query state when sort, filter, and tag controls change", async () => {
    useMemoryGridPreferences.mockReturnValue({
      autoplayVideosInGrid: false,
      defaultGridSize: "medium",
    });
    useTimeline.mockReturnValue({
      assets: [],
      total: 0,
      summary: {
        total_assets: 0,
        total_photos: 0,
        total_videos: 0,
      },
      isLoading: false,
      isError: false,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
    });
    useTimelineTags.mockReturnValue({
      data: ["trip", "beach"],
    });
    useToggleFavorite.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    });
    useUpdateAssetTags.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    });
    useDeleteTimelineTag.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    });

    render(<Memories />);

    expect(useTimeline).toHaveBeenLastCalledWith({
      sort: "desc",
      filter: "all",
      tag: null,
      dateFrom: null,
      dateTo: null,
      search: null,
    });

    fireEvent.click(screen.getByRole("button", { name: /sort/i }));
    fireEvent.click(screen.getByRole("button", { name: "Oldest First" }));

    await waitFor(() => {
      expect(useTimeline).toHaveBeenLastCalledWith({
        sort: "asc",
        filter: "all",
        tag: null,
        dateFrom: null,
        dateTo: null,
        search: null,
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /filter/i }));
    fireEvent.click(screen.getByRole("button", { name: "Favorites" }));

    await waitFor(() => {
      expect(useTimeline).toHaveBeenLastCalledWith({
        sort: "asc",
        filter: "favorites",
        tag: null,
        dateFrom: null,
        dateTo: null,
        search: null,
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /tag/i }));
    fireEvent.click(screen.getByRole("button", { name: "trip" }));

    await waitFor(() => {
      expect(useTimeline).toHaveBeenLastCalledWith({
        sort: "asc",
        filter: "favorites",
        tag: "trip",
        dateFrom: null,
        dateTo: null,
        search: null,
      });
    });

    fireEvent.change(screen.getByRole("searchbox", { name: "Search memories" }), {
      target: { value: "sunrise" },
    });

    await waitFor(() => {
      expect(useTimeline).toHaveBeenLastCalledWith({
        sort: "asc",
        filter: "favorites",
        tag: "trip",
        dateFrom: null,
        dateTo: null,
        search: "sunrise",
      });
    });
  });
});
