import { render, screen } from "@testing-library/react";

import Lightbox from "./Lightbox";

const useShowMemoryOverlays = vi.fn();

vi.mock("../hooks/useOverlayPreference", () => ({
  useShowMemoryOverlays: () => useShowMemoryOverlays(),
}));

describe("Lightbox", () => {
  const asset = {
    id: "asset-1",
    taken_at: "2026-03-27T10:00:00Z",
    media_type: "image" as const,
    is_favorite: false,
    tags: ["trip"],
    has_overlay: true,
  };

  it("renders the overlay layer when overlay visibility is enabled", () => {
    useShowMemoryOverlays.mockReturnValue(true);

    const { container } = render(
      <Lightbox
        assets={[asset]}
        currentIndex={0}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByText("Viewer")).toBeInTheDocument();
    expect(container.querySelector('img[alt]')).not.toBeNull();
    expect(container.querySelectorAll("img")).toHaveLength(2);
  });

  it("hides the overlay layer when overlay visibility is disabled", () => {
    useShowMemoryOverlays.mockReturnValue(false);

    const { container } = render(
      <Lightbox
        assets={[asset]}
        currentIndex={0}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByText("Viewer")).toBeInTheDocument();
    expect(container.querySelector('img[alt]')).not.toBeNull();
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });
});
