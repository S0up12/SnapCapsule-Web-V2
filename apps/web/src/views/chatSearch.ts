import type { ChatMessageGroup } from "../hooks/useChats";

export function normalizeChatSearch(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function messageMatchesChatSearch(message: ChatMessageGroup, normalizedSearch: string) {
  if (!normalizedSearch) {
    return false;
  }

  return message.text.toLocaleLowerCase().includes(normalizedSearch);
}

export function listMatchedChatMessageIds(messages: ChatMessageGroup[], normalizedSearch: string) {
  if (!normalizedSearch) {
    return [];
  }

  return messages
    .filter((message) => messageMatchesChatSearch(message, normalizedSearch))
    .map((message) => message.id);
}
