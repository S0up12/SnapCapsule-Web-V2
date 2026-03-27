import { getThumbnailUrl } from "./useTimeline";

describe("getThumbnailUrl", () => {
  it("uses a variant-specific cache key for overlay and plain thumbnails", () => {
    expect(getThumbnailUrl("asset-1", 1, true)).toBe("/api/asset/asset-1/thumbnail?v=1-thumb-v2-overlay");
    expect(getThumbnailUrl("asset-1", 1, false)).toBe(
      "/api/asset/asset-1/thumbnail?v=1-thumb-v2-plain&include_overlay=false",
    );
  });
});
