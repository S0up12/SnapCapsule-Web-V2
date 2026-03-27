import { listMatchedChatMessageIds, messageMatchesChatSearch, normalizeChatSearch } from "./chatSearch";

const messages = [
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
    text: "Bring snacks",
    sent_at: "2026-03-20T10:05:00Z",
    media_assets: [],
  },
];

describe("chatSearch", () => {
  it("normalizes whitespace and case", () => {
    expect(normalizeChatSearch("  StaTion ")).toBe("station");
  });

  it("matches search terms against message text", () => {
    expect(messageMatchesChatSearch(messages[0], "station")).toBe(true);
    expect(messageMatchesChatSearch(messages[1], "station")).toBe(false);
  });

  it("returns matched grouped message ids in order", () => {
    expect(listMatchedChatMessageIds(messages, "station")).toEqual(["message-1"]);
  });
});
