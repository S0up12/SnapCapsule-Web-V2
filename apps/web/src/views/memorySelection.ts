import type { TimelineAsset } from "../hooks/useTimeline";

type MemorySelectionResult = {
  selectedAssetIds: string[];
  anchorAssetId: string | null;
};

export function applyMemorySelection({
  currentSelectedAssetIds,
  assets,
  clickedAssetId,
  shiftKey,
  anchorAssetId,
}: {
  currentSelectedAssetIds: string[];
  assets: TimelineAsset[];
  clickedAssetId: string;
  shiftKey: boolean;
  anchorAssetId: string | null;
}): MemorySelectionResult {
  if (shiftKey && anchorAssetId) {
    const anchorIndex = assets.findIndex((asset) => asset.id === anchorAssetId);
    const clickedIndex = assets.findIndex((asset) => asset.id === clickedAssetId);

    if (anchorIndex >= 0 && clickedIndex >= 0) {
      const [start, end] = anchorIndex <= clickedIndex ? [anchorIndex, clickedIndex] : [clickedIndex, anchorIndex];
      const rangeIds = assets.slice(start, end + 1).map((asset) => asset.id);

      return {
        selectedAssetIds: [...new Set([...currentSelectedAssetIds, ...rangeIds])],
        anchorAssetId: clickedAssetId,
      };
    }
  }

  const nextSelectedAssetIds = currentSelectedAssetIds.includes(clickedAssetId)
    ? currentSelectedAssetIds.filter((assetId) => assetId !== clickedAssetId)
    : [...currentSelectedAssetIds, clickedAssetId];

  return {
    selectedAssetIds: nextSelectedAssetIds,
    anchorAssetId: clickedAssetId,
  };
}
