import { ArrowDownWideNarrow, LoaderCircle, MessageSquareText, Mic, Search } from "lucide-react";
import { Fragment, startTransition, useEffect, useMemo, useRef, useState } from "react";

import Lightbox from "../components/Lightbox";
import { useShowMemoryOverlays } from "../hooks/useOverlayPreference";
import { getOriginalUrl, getThumbnailUrl, type TimelineAsset } from "../hooks/useTimeline";
import { useChatMessages, useChats, type ChatConversation, type ChatMediaAsset, type ChatMessageGroup } from "../hooks/useChats";

function formatConversationTime(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function avatarInitials(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "SC";
  }

  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<]+/gi;
const TRAILING_PUNCTUATION = /[),.!?:;\]]+$/;

function normalizeMessageLink(rawValue: string) {
  const trimmed = rawValue.trim();
  const trailing = trimmed.match(TRAILING_PUNCTUATION)?.[0] ?? "";
  const urlText = trailing ? trimmed.slice(0, -trailing.length) : trimmed;

  if (!urlText) {
    return null;
  }

  const href = /^https?:\/\//i.test(urlText) ? urlText : `https://${urlText}`;
  try {
    new URL(href);
  } catch {
    return null;
  }

  return {
    href,
    label: urlText,
    trailing,
  };
}

function renderMessageText(text: string, isMe: boolean) {
  const segments: Array<string | { href: string; label: string }> = [];
  let cursor = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const matchedText = match[0];
    const start = match.index ?? 0;
    const normalized = normalizeMessageLink(matchedText);
    if (!normalized) {
      continue;
    }

    if (start > cursor) {
      segments.push(text.slice(cursor, start));
    }

    segments.push({
      href: normalized.href,
      label: normalized.label,
    });

    if (normalized.trailing) {
      segments.push(normalized.trailing);
    }

    cursor = start + matchedText.length;
  }

  if (cursor < text.length) {
    segments.push(text.slice(cursor));
  }

  if (segments.length === 0) {
    segments.push(text);
  }

  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-6">
      {segments.map((segment, index) =>
        typeof segment === "string" ? (
          <Fragment key={index}>{segment}</Fragment>
        ) : (
          <a
            key={index}
            href={segment.href}
            target="_blank"
            rel="noreferrer"
            className={[
              "underline decoration-current/45 underline-offset-4 transition hover:decoration-current",
              isMe ? "text-white" : "text-sky-700 dark:text-sky-300",
            ].join(" ")}
          >
            {segment.label}
          </a>
        )
      )}
    </p>
  );
}

function ConversationRow({
  conversation,
  isSelected,
  onSelect,
}: {
  conversation: ChatConversation;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "flex w-full items-center gap-3 rounded-[1.2rem] border px-3 py-3 text-left transition",
        isSelected
          ? "border-sky-300/20 bg-sky-400/[0.12] shadow-[0_18px_36px_rgba(8,47,73,0.12)] dark:text-white"
          : "border-transparent hover:border-slate-200 hover:bg-slate-50/90 dark:hover:border-white/10 dark:hover:bg-white/[0.045]",
      ].join(" ")}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.28),_rgba(14,165,233,0.14),_rgba(15,23,42,0.08))] text-sm font-semibold text-slate-900 dark:text-white">
        {avatarInitials(conversation.display_name)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{conversation.display_name}</p>
          <span className="shrink-0 text-[11px] uppercase tracking-[0.18em] text-slate-500">
            {formatConversationTime(conversation.latest_at)}
          </span>
        </div>
        <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-400">{conversation.latest_preview}</p>
      </div>
    </button>
  );
}

function ChatMediaThumbnail({
  asset,
  showOverlays,
  onOpen,
}: {
  asset: ChatMediaAsset;
  showOverlays: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="overflow-hidden rounded-[1rem] border border-black/10 bg-black/5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]"
    >
      <img
        src={getThumbnailUrl(asset.id, asset.has_overlay ? 1 : 0, showOverlays)}
        alt={asset.media_type}
        loading="lazy"
        decoding="async"
        className="h-40 w-28 object-cover"
      />
    </button>
  );
}

function ChatVoiceMessage({
  asset,
}: {
  asset: ChatMediaAsset;
}) {
  return (
    <div className="flex w-[19rem] max-w-full items-center gap-3 rounded-[1rem] border border-black/10 bg-black/5 px-3 py-2.5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500/14 text-sky-700 dark:text-sky-200">
        <Mic className="h-4.5 w-4.5" />
      </div>
      <audio
        controls
        preload="metadata"
        src={getOriginalUrl(asset.id)}
        className="block min-w-0 flex-1"
      />
    </div>
  );
}

function MessageBubble({
  message,
  showOverlays,
  onOpenMedia,
}: {
  message: ChatMessageGroup;
  showOverlays: boolean;
  onOpenMedia: (assetId: string) => void;
}) {
  return (
    <div className={`flex ${message.is_me ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[min(44rem,85%)] ${message.is_me ? "items-end" : "items-start"} flex flex-col`}>
        <span className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          {message.sender_label}
        </span>
        <div
          className={[
            "rounded-[1.35rem] px-4 py-3 shadow-sm",
            message.is_me
              ? "bg-sky-500 text-white shadow-sky-900/10"
              : "border border-slate-200/80 bg-white text-slate-900 dark:border-white/10 dark:bg-slate-950/75 dark:text-slate-100",
          ].join(" ")}
        >
          {message.text ? (
            renderMessageText(message.text, message.is_me)
          ) : null}

          {message.media_assets.length > 0 ? (
            <div className={`${message.text ? "mt-3" : ""} flex flex-wrap gap-2`}>
              {message.media_assets.map((asset) =>
                asset.media_type === "audio" ? (
                  <ChatVoiceMessage key={asset.id} asset={asset} />
                ) : (
                  <ChatMediaThumbnail
                    key={asset.id}
                    asset={asset}
                    showOverlays={showOverlays}
                    onOpen={() => onOpenMedia(asset.id)}
                  />
                )
              )}
            </div>
          ) : null}
        </div>
        <span className="mt-1.5 px-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
          {formatMessageTime(message.sent_at)}
        </span>
      </div>
    </div>
  );
}

export default function Chats() {
  const showOverlays = useShowMemoryOverlays();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [filter, setFilter] = useState<"all" | "has_media">("all");
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const conversationsQuery = useChats({ search, sort, filter });
  const conversations = conversationsQuery.data?.items ?? [];
  const selectedConversation = conversations.find((conversation) => conversation.id === selectedChatId) ?? null;
  const messagesQuery = useChatMessages(selectedChatId);
  const messageScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!conversations.length) {
      setSelectedChatId(null);
      return;
    }
    if (selectedChatId && conversations.some((conversation) => conversation.id === selectedChatId)) {
      return;
    }
    setSelectedChatId(conversations[0].id);
  }, [conversations, selectedChatId]);

  useEffect(() => {
    const element = messageScrollRef.current;
    if (!element || !messagesQuery.data) {
      return;
    }
    element.scrollTop = element.scrollHeight;
  }, [messagesQuery.data, selectedChatId]);

  const flattenedMedia = useMemo(() => {
    const items: TimelineAsset[] = [];
    for (const message of messagesQuery.data?.items ?? []) {
      for (const asset of message.media_assets) {
        if (asset.media_type === "audio") {
          continue;
        }
        items.push({
          id: asset.id,
          taken_at: asset.taken_at,
          media_type: asset.media_type,
          is_favorite: asset.is_favorite,
          tags: asset.tags,
          has_overlay: asset.has_overlay,
        });
      }
    }
    return items;
  }, [messagesQuery.data?.items]);

  return (
    <section className="flex h-[calc(100vh-10rem)] min-h-[42rem] w-full overflow-hidden rounded-[1.9rem] border border-slate-200/80 bg-white/84 shadow-[0_28px_80px_rgba(15,23,42,0.1)] dark:border-white/10 dark:bg-white/[0.045] dark:shadow-black/25">
      <aside className="flex w-[30%] min-w-[20rem] max-w-[28rem] flex-col border-r border-slate-200/80 bg-white/78 dark:border-white/10 dark:bg-slate-950/55">
        <div className="border-b border-slate-200/80 px-4 py-4 dark:border-white/10">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search conversations"
              className="w-full rounded-[1rem] border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-sky-400 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-100"
            />
          </div>

          <div className="mt-3 flex gap-2">
            <label className="inline-flex flex-1 items-center gap-2 rounded-[1rem] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-200">
              <ArrowDownWideNarrow className="h-4 w-4 text-slate-500" />
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as "newest" | "oldest")}
                className="w-full bg-transparent outline-none"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </label>

            <label className="inline-flex flex-1 items-center gap-2 rounded-[1rem] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-200">
              <MessageSquareText className="h-4 w-4 text-slate-500" />
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as "all" | "has_media")}
                className="w-full bg-transparent outline-none"
              >
                <option value="all">All</option>
                <option value="has_media">Has Media</option>
              </select>
            </label>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {conversationsQuery.isLoading ? (
            <div className="flex h-full items-center justify-center">
              <LoaderCircle className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : conversationsQuery.isError ? (
            <div className="rounded-[1.1rem] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              {conversationsQuery.error instanceof Error
                ? conversationsQuery.error.message
                : "Failed to load conversations."}
            </div>
          ) : conversations.length > 0 ? (
            <div className="space-y-2">
              {conversations.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  isSelected={conversation.id === selectedChatId}
                  onSelect={() => setSelectedChatId(conversation.id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">No conversations match this search.</p>
            </div>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {selectedConversation ? (
          <>
            <header className="border-b border-slate-200/80 px-5 py-4 dark:border-white/10">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{selectedConversation.display_name}</h2>
            </header>

            <div
              ref={messageScrollRef}
              className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(241,245,249,0.95))] px-5 py-5 dark:bg-[linear-gradient(180deg,rgba(8,14,24,0.92),rgba(5,10,18,0.98))]"
            >
              {messagesQuery.isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <LoaderCircle className="h-7 w-7 animate-spin text-slate-400" />
                </div>
              ) : messagesQuery.isError ? (
                <div className="rounded-[1.2rem] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  {messagesQuery.error instanceof Error ? messagesQuery.error.message : "Failed to load chat messages."}
                </div>
              ) : (
                <div className="space-y-4">
                  {messagesQuery.data?.items.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      showOverlays={showOverlays}
                      onOpenMedia={(assetId) => {
                        const index = flattenedMedia.findIndex((asset) => asset.id === assetId);
                        if (index < 0) {
                          return;
                        }
                        startTransition(() => {
                          setLightboxIndex(index);
                        });
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(241,245,249,0.95))] px-6 text-center dark:bg-[linear-gradient(180deg,rgba(8,14,24,0.92),rgba(5,10,18,0.98))]">
            <div className="rounded-full border border-slate-200/80 bg-white/90 p-4 text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
              <MessageSquareText className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-slate-950 dark:text-white">Select a conversation to start reading</h2>
            <p className="mt-3 max-w-lg text-sm leading-7 text-slate-600 dark:text-slate-400">
              Choose a conversation from the left pane to load its messages and saved media in chronological order.
            </p>
          </div>
        )}
      </div>

      {lightboxIndex !== null && flattenedMedia[lightboxIndex] ? (
        <Lightbox
          assets={flattenedMedia}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={(nextIndex) => {
            if (nextIndex < 0 || nextIndex >= flattenedMedia.length) {
              return;
            }
            startTransition(() => {
              setLightboxIndex(nextIndex);
            });
          }}
        />
      ) : null}
    </section>
  );
}
