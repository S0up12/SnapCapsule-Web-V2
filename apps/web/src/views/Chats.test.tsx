import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import Chats from "./Chats";

const useChats = vi.fn();
const useChatMessages = vi.fn();
const useShowMemoryOverlays = vi.fn();

vi.mock("../hooks/useChats", async () => {
  const actual = await vi.importActual<typeof import("../hooks/useChats")>("../hooks/useChats");
  return {
    ...actual,
    useChats: (...args: unknown[]) => useChats(...args),
    useChatMessages: (...args: unknown[]) => useChatMessages(...args),
  };
});

vi.mock("../hooks/useOverlayPreference", () => ({
  useShowMemoryOverlays: () => useShowMemoryOverlays(),
}));

vi.mock("../components/controls/PopoverSelect", () => ({
  default: () => <div>Popover Select</div>,
}));

vi.mock("../components/Lightbox", () => ({
  default: () => <div>Lightbox</div>,
}));

describe("Chats", () => {
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    scrollIntoView.mockReset();
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    useShowMemoryOverlays.mockReturnValue(true);
    useChats.mockReturnValue({
      data: {
        items: [
          {
            id: "chat-1",
            display_name: "Alex",
            latest_at: "2026-03-20T10:05:00Z",
            latest_preview: "Meet me at the station",
            has_media: false,
            is_group: false,
          },
        ],
        total: 1,
      },
      isLoading: false,
      isError: false,
      error: null,
    });
    useChatMessages.mockReturnValue({
      data: {
        items: [
          {
            id: "message-1",
            sender: "Alex",
            sender_label: "Alex",
            is_me: false,
            text: "Meet me at the station",
            sent_at: "2026-03-20T10:00:00Z",
            media_assets: [],
          },
          {
            id: "message-2",
            sender: "Alex",
            sender_label: "Alex",
            is_me: false,
            text: "The station cafe is still open",
            sent_at: "2026-03-20T10:05:00Z",
            media_assets: [],
          },
        ],
        total: 2,
        limit: 400,
        offset: 0,
        has_more: false,
      },
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  it("searches chats by message body and navigates between in-thread matches", async () => {
    render(<Chats />);

    fireEvent.change(screen.getByRole("textbox", { name: "Search chats and messages" }), {
      target: { value: "station" },
    });

    await waitFor(() => {
      expect(useChats).toHaveBeenLastCalledWith({
        search: "station",
        sort: "newest",
        filter: "all",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("2 matches")).toBeInTheDocument();
      expect(screen.getByText("1 of 2")).toBeInTheDocument();
    });

    expect(scrollIntoView).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Next search match" }));

    await waitFor(() => {
      expect(screen.getByText("2 of 2")).toBeInTheDocument();
    });
  });
});
