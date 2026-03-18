import { useQuery } from "@tanstack/react-query";

export type ChatConversation = {
  id: string;
  display_name: string;
  latest_at: string | null;
  latest_preview: string;
  has_media: boolean;
};

export type ChatMediaAsset = {
  id: string;
  taken_at: string | null;
  media_type: "image" | "video" | "audio";
  is_favorite: boolean;
  tags: string[];
  has_overlay: boolean;
};

export type ChatMessageGroup = {
  id: string;
  sender: string;
  sender_label: string;
  is_me: boolean;
  text: string;
  sent_at: string;
  media_assets: ChatMediaAsset[];
};

type ChatListResponse = {
  items: ChatConversation[];
  total: number;
};

type ChatMessagesResponse = {
  items: ChatMessageGroup[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
};

export type ChatListFilters = {
  search: string;
  sort: "newest" | "oldest";
  filter: "all" | "has_media";
};

async function fetchChats(filters: ChatListFilters): Promise<ChatListResponse> {
  const params = new URLSearchParams({
    search: filters.search,
    sort: filters.sort,
    filter: filters.filter,
  });
  const response = await fetch(`/api/chats?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Chats request failed with ${response.status}`);
  }

  return (await response.json()) as ChatListResponse;
}

async function fetchChatMessages(chatId: string): Promise<ChatMessagesResponse> {
  const response = await fetch(`/api/chats/${chatId}/messages?limit=400&offset=0`);
  if (!response.ok) {
    throw new Error(`Chat messages request failed with ${response.status}`);
  }

  return (await response.json()) as ChatMessagesResponse;
}

export function useChats(filters: ChatListFilters) {
  return useQuery({
    queryKey: ["chats", filters.search, filters.sort, filters.filter],
    queryFn: () => fetchChats(filters),
    staleTime: 15_000,
  });
}

export function useChatMessages(chatId: string | null) {
  return useQuery({
    queryKey: ["chat-messages", chatId],
    queryFn: () => fetchChatMessages(chatId as string),
    enabled: Boolean(chatId),
    staleTime: 15_000,
  });
}
