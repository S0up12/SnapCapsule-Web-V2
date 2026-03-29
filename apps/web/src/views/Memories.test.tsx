import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import Memories from "./Memories";

const useMemoryGridPreferences = vi.fn();
const useTimeline = vi.fn();
const useTimelineTags = vi.fn();
const useToggleFavorite = vi.fn();
const useBulkSetFavorite = vi.fn();
const useBulkUpdateTags = vi.fn();
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
  useBulkSetFavorite: () => useBulkSetFavorite(),
  useBulkUpdateTags: () => useBulkUpdateTags(),
  useUpdateAssetTags: () => useUpdateAssetTags(),
  useDeleteTimelineTag: () => useDeleteTimelineTag(),
}));

vi.mock("../components/VirtualTimelineGrid", () => ({
  default: ({
    assets,
    selectionMode,
    selectedAssetIds,
    onToggleSelection,
  }: {
    assets: Array<{ id: string }>;
    selectionMode: boolean;
    selectedAssetIds: Set<string>;
    onToggleSelection: (asset: { id: string }, shiftKey: boolean) => void;
  }) => (
    <div>
      <div>Timeline Grid</div>
      <div data-testid="selected-count">{selectedAssetIds.size}</div>
      {selectionMode
        ? assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              onClick={(event) => onToggleSelection(asset, event.shiftKey)}
            >
              Select {asset.id}
            </button>
          ))
        : null}
    </div>
  ),
}));

vi.mock("../components/Lightbox", () => ({
  default: () => <div>Lightbox</div>,
}));

vi.mock("../components/memories/TagEditorModal", () => ({
  default: () => <div>Tag Editor</div>,
}));

vi.mock("../components/memories/BulkSelectionBar", () => ({
  default: () => <div>Bulk Selection Bar</div>,
}));

vi.mock("../components/memories/BulkTagModal", () => ({
  default: () => <div>Bulk Tag Modal</div>,
}));

describe("Memories", () => {
  beforeEach(() => {
    useMemoryGridPreferences.mockReturnValue({
      autoplayVideosInGrid: false,
      defaultGridSize: "medium",
      preferBrowserPlayback: true,
      muteVideoPreviews: true,
      loopVideoPreviews: true,
      videoPreviewHoverDelay: "1.2s",
      autoplayVideosInLightbox: true,
      timelineDefaultSort: "newest",
      timelineDefaultFilter: "all",
      timelineDateGrouping: "year",
      timelinePageSize: 100,
      rememberLastTimelineFilters: false,
      showUndatedAssets: true,
      saveSettings: vi.fn(),
      isLoading: false,
    });
    useTimelineTags.mockReturnValue({
      data: ["trip", "beach"],
    });
    useToggleFavorite.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    });
    useBulkSetFavorite.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    });
    useBulkUpdateTags.mockReturnValue({
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
  });

  it("updates timeline query state when sort, filter, and tag controls change", async () => {
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

    render(<Memories />);

      expect(useTimeline).toHaveBeenLastCalledWith({
        sort: "desc",
        filter: "all",
        pageSize: 100,
        includeUndated: true,
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
        pageSize: 100,
        includeUndated: true,
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
        pageSize: 100,
        includeUndated: true,
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
        pageSize: 100,
        includeUndated: true,
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
        pageSize: 100,
        includeUndated: true,
        tag: "trip",
        dateFrom: null,
        dateTo: null,
        search: "sunrise",
      });
    });
  });

  it("selects an inclusive range when shift-clicking in selection mode", async () => {
    useTimeline.mockReturnValue({
      assets: [
        {
          id: "asset-1",
          taken_at: null,
          media_type: "image",
          is_favorite: false,
          tags: [],
          has_overlay: false,
        },
        {
          id: "asset-2",
          taken_at: null,
          media_type: "image",
          is_favorite: false,
          tags: [],
          has_overlay: false,
        },
        {
          id: "asset-3",
          taken_at: null,
          media_type: "image",
          is_favorite: false,
          tags: [],
          has_overlay: false,
        },
      ],
      total: 3,
      summary: {
        total_assets: 3,
        total_photos: 3,
        total_videos: 0,
      },
      isLoading: false,
      isError: false,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
    });

    render(<Memories />);

    fireEvent.click(screen.getByRole("button", { name: /select/i }));
    fireEvent.click(screen.getByRole("button", { name: "Select asset-1" }));
    fireEvent.click(screen.getByRole("button", { name: "Select asset-3" }), { shiftKey: true });

    await waitFor(() => {
      expect(screen.getByTestId("selected-count")).toHaveTextContent("3");
      expect(screen.getByText("Bulk Selection Bar")).toBeInTheDocument();
    });
  });
});
