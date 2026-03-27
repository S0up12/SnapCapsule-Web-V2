import { applyMemorySelection } from "./memorySelection";

const assets = [
  {
    id: "asset-1",
    taken_at: null,
    media_type: "image" as const,
    is_favorite: false,
    tags: [],
    has_overlay: false,
  },
  {
    id: "asset-2",
    taken_at: null,
    media_type: "image" as const,
    is_favorite: false,
    tags: [],
    has_overlay: false,
  },
  {
    id: "asset-3",
    taken_at: null,
    media_type: "image" as const,
    is_favorite: false,
    tags: [],
    has_overlay: false,
  },
  {
    id: "asset-4",
    taken_at: null,
    media_type: "image" as const,
    is_favorite: false,
    tags: [],
    has_overlay: false,
  },
];

describe("applyMemorySelection", () => {
  it("toggles a single item when shift is not pressed", () => {
    expect(
      applyMemorySelection({
        currentSelectedAssetIds: [],
        assets,
        clickedAssetId: "asset-2",
        shiftKey: false,
        anchorAssetId: null,
      }),
    ).toEqual({
      selectedAssetIds: ["asset-2"],
      anchorAssetId: "asset-2",
    });
  });

  it("selects a contiguous range when shift is pressed", () => {
    expect(
      applyMemorySelection({
        currentSelectedAssetIds: ["asset-2"],
        assets,
        clickedAssetId: "asset-4",
        shiftKey: true,
        anchorAssetId: "asset-2",
      }),
    ).toEqual({
      selectedAssetIds: ["asset-2", "asset-3", "asset-4"],
      anchorAssetId: "asset-4",
    });
  });

  it("selects a reverse contiguous range when shift is pressed upward", () => {
    expect(
      applyMemorySelection({
        currentSelectedAssetIds: ["asset-4"],
        assets,
        clickedAssetId: "asset-2",
        shiftKey: true,
        anchorAssetId: "asset-4",
      }),
    ).toEqual({
      selectedAssetIds: ["asset-4", "asset-2", "asset-3"],
      anchorAssetId: "asset-2",
    });
  });
});
