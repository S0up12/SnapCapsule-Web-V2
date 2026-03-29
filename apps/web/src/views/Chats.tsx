import { ArrowDownWideNarrow, ChevronDown, ChevronUp, LoaderCircle, MessageSquareText, Pause, Play, Search, Volume2 } from "lucide-react";
import { Fragment, startTransition, useEffect, useMemo, useRef, useState } from "react";

import PopoverSelect from "../components/controls/PopoverSelect";
import Lightbox from "../components/Lightbox";
import PrivacyText from "../components/privacy/PrivacyText";
import { useShowMemoryOverlays } from "../hooks/useOverlayPreference";
import { usePrivacyPreferences } from "../hooks/usePrivacyPreferences";
import { resolveAppSettings, useSettings } from "../hooks/useSettings";
import { getOriginalUrl, getThumbnailUrl, type TimelineAsset } from "../hooks/useTimeline";
import { useChatMessages, useChats, type ChatConversation, type ChatMediaAsset, type ChatMessageGroup } from "../hooks/useChats";
import { listMatchedChatMessageIds, messageMatchesChatSearch, normalizeChatSearch } from "./chatSearch";

type SenderTone = {
  labelClass: string;
  poleClass: string;
  linkClass: string;
  hoverDotClass: string;
};

const PRIVATE_ME_TONE: SenderTone = {
  labelClass: "text-rose-500 dark:text-rose-400",
  poleClass: "bg-rose-500 dark:bg-rose-400",
  linkClass: "text-rose-700 dark:text-rose-300",
  hoverDotClass: "bg-rose-500 dark:bg-rose-400",
};

const PRIVATE_OTHER_TONE: SenderTone = {
  labelClass: "text-sky-500 dark:text-sky-400",
  poleClass: "bg-sky-500 dark:bg-sky-400",
  linkClass: "text-sky-700 dark:text-sky-300",
  hoverDotClass: "bg-sky-500 dark:bg-sky-400",
};

const GROUP_TONES: SenderTone[] = [
  {
    labelClass: "text-cyan-400 dark:text-cyan-300",
    poleClass: "bg-cyan-400 dark:bg-cyan-300",
    linkClass: "text-cyan-700 dark:text-cyan-300",
    hoverDotClass: "bg-cyan-400 dark:bg-cyan-300",
  },
  {
    labelClass: "text-lime-500 dark:text-lime-400",
    poleClass: "bg-lime-500 dark:bg-lime-400",
    linkClass: "text-lime-700 dark:text-lime-300",
    hoverDotClass: "bg-lime-500 dark:bg-lime-400",
  },
  {
    labelClass: "text-fuchsia-500 dark:text-fuchsia-400",
    poleClass: "bg-fuchsia-500 dark:bg-fuchsia-400",
    linkClass: "text-fuchsia-700 dark:text-fuchsia-300",
    hoverDotClass: "bg-fuchsia-500 dark:bg-fuchsia-400",
  },
  {
    labelClass: "text-amber-500 dark:text-amber-400",
    poleClass: "bg-amber-500 dark:bg-amber-400",
    linkClass: "text-amber-700 dark:text-amber-300",
    hoverDotClass: "bg-amber-500 dark:bg-amber-400",
  },
  {
    labelClass: "text-violet-500 dark:text-violet-400",
    poleClass: "bg-violet-500 dark:bg-violet-400",
    linkClass: "text-violet-700 dark:text-violet-300",
    hoverDotClass: "bg-violet-500 dark:bg-violet-400",
  },
  {
    labelClass: "text-emerald-500 dark:text-emerald-400",
    poleClass: "bg-emerald-500 dark:bg-emerald-400",
    linkClass: "text-emerald-700 dark:text-emerald-300",
    hoverDotClass: "bg-emerald-500 dark:bg-emerald-400",
  },
];

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

function formatMessageTime(value: string, hideExactTimestamps: boolean) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  if (hideExactTimestamps) {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
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

function hashSenderLabel(value: string) {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function buildSenderToneMap(messages: ChatMessageGroup[], isGroupChat: boolean) {
  const tones = new Map<string, SenderTone>();

  for (const message of messages) {
    const key = message.sender_label || message.sender || "Unknown";
    if (tones.has(key)) {
      continue;
    }

    if (!isGroupChat) {
      tones.set(key, message.is_me ? PRIVATE_ME_TONE : PRIVATE_OTHER_TONE);
      continue;
    }

    const paletteIndex = hashSenderLabel(key.toLowerCase()) % GROUP_TONES.length;
    tones.set(key, GROUP_TONES[paletteIndex]);
  }

  return tones;
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

function renderSearchHighlights(text: string, normalizedSearch: string) {
  if (!normalizedSearch) {
    return text;
  }

  const lowerText = text.toLocaleLowerCase();
  const pieces: Array<string | { type: "match"; value: string }> = [];
  let cursor = 0;

  while (cursor < text.length) {
    const matchIndex = lowerText.indexOf(normalizedSearch, cursor);
    if (matchIndex < 0) {
      pieces.push(text.slice(cursor));
      break;
    }

    if (matchIndex > cursor) {
      pieces.push(text.slice(cursor, matchIndex));
    }

    pieces.push({
      type: "match",
      value: text.slice(matchIndex, matchIndex + normalizedSearch.length),
    });
    cursor = matchIndex + normalizedSearch.length;
  }

  if (pieces.length === 0) {
    pieces.push(text);
  }

  return pieces.map((piece, index) =>
    typeof piece === "string" ? (
      <Fragment key={index}>{piece}</Fragment>
    ) : (
      <mark
        key={index}
        className="rounded bg-amber-200/90 px-0.5 text-slate-950 dark:bg-amber-300/35 dark:text-white"
      >
        {piece.value}
      </mark>
    ),
  );
}

function renderMessageText(text: string, linkClass: string, normalizedSearch: string) {
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
          <Fragment key={index}>{renderSearchHighlights(segment, normalizedSearch)}</Fragment>
        ) : (
          <a
            key={index}
            href={segment.href}
            target="_blank"
            rel="noreferrer"
            className={[
              "underline decoration-current/45 underline-offset-4 transition hover:decoration-current",
              linkClass,
            ].join(" ")}
          >
            {renderSearchHighlights(segment.label, normalizedSearch)}
          </a>
        )
      )}
    </p>
  );
}

function formatAudioClock(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return "0:00";
  }
  const totalSeconds = Math.floor(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function ConversationRow({
  conversation,
  isSelected,
  blurPrivateNames,
  onSelect,
}: {
  conversation: ChatConversation;
  isSelected: boolean;
  blurPrivateNames: boolean;
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
          <PrivacyText
            blurred={blurPrivateNames}
            className="truncate text-sm font-semibold text-slate-900 dark:text-white"
          >
            {conversation.display_name}
          </PrivacyText>
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
  const [previewSize, setPreviewSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    setPreviewSize(null);
  }, [asset.id]);

  function fitPreviewBox(width: number, height: number) {
    const maxWidth = 220;
    const maxHeight = 260;
    const scale = Math.min(maxWidth / width, maxHeight / height, 1);
    setPreviewSize({
      width: Math.max(96, Math.round(width * scale)),
      height: Math.max(96, Math.round(height * scale)),
    });
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="overflow-hidden rounded-[1rem] border border-slate-300/80 bg-white/90 shadow-sm transition hover:border-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/20"
      style={
        previewSize
          ? {
              width: `${previewSize.width}px`,
              height: `${previewSize.height}px`,
            }
          : {
              width: "168px",
              height: "220px",
            }
      }
    >
      <img
        src={getThumbnailUrl(asset.id, asset.has_overlay ? 1 : 0, showOverlays)}
        alt={asset.media_type}
        loading="lazy"
        decoding="async"
        onLoad={(event) => {
          const element = event.currentTarget;
          if (element.naturalWidth > 0 && element.naturalHeight > 0) {
            fitPreviewBox(element.naturalWidth, element.naturalHeight);
          }
        }}
        className="h-full w-full object-cover"
      />
    </button>
  );
}

function ChatVoiceMessage({
  asset,
}: {
  asset: ChatMediaAsset;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const element = audioRef.current;
    return () => {
      element?.pause();
    };
  }, []);

  function syncFromAudio() {
    const element = audioRef.current;
    if (!element) {
      return;
    }
    setCurrentTime(element.currentTime || 0);
    setDuration(element.duration || 0);
    setIsPlaying(!element.paused && !element.ended);
  }

  function handleTogglePlayback() {
    const element = audioRef.current;
    if (!element) {
      return;
    }
    if (element.paused) {
      void element.play().then(() => {
        syncFromAudio();
      }).catch(() => {
        setIsPlaying(false);
      });
      return;
    }
    element.pause();
    syncFromAudio();
  }

  return (
    <div className="w-[18.5rem] max-w-full rounded-[1.1rem] border border-slate-300/70 bg-white/72 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
      <audio
        ref={audioRef}
        preload="metadata"
        src={getOriginalUrl(asset.id)}
        onLoadedMetadata={syncFromAudio}
        onTimeUpdate={syncFromAudio}
        onPlay={syncFromAudio}
        onPause={syncFromAudio}
        onEnded={syncFromAudio}
        className="hidden"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleTogglePlayback}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-900/6 dark:text-slate-100 dark:hover:bg-white/8"
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
        >
          {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
        </button>
        <span className="w-[4.75rem] shrink-0 text-xs font-medium tabular-nums text-slate-700 dark:text-slate-200">
          {formatAudioClock(currentTime)} / {formatAudioClock(duration)}
        </span>
        <input
          type="range"
          min={0}
          max={duration > 0 ? duration : 0}
          step={0.1}
          value={Math.min(currentTime, duration || currentTime)}
          onChange={(event) => {
            const nextTime = Number(event.target.value);
            const element = audioRef.current;
            if (!element || Number.isNaN(nextTime)) {
              return;
            }
            element.currentTime = nextTime;
            setCurrentTime(nextTime);
          }}
          className="h-2 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-slate-300/90 accent-slate-700 dark:bg-white/18 dark:accent-white [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-slate-700 dark:[&::-moz-range-thumb]:bg-white [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-[-3px] [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-slate-700 dark:[&::-webkit-slider-thumb]:bg-white"
          aria-label="Seek audio"
        />
        <Volume2 className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  showOverlays,
  senderTone,
  searchTerm,
  isSearchMatch,
  isActiveSearchMatch,
  blurPrivateNames,
  hideExactTimestamps,
  onOpenMedia,
}: {
  message: ChatMessageGroup;
  showOverlays: boolean;
  senderTone: SenderTone;
  searchTerm: string;
  isSearchMatch: boolean;
  isActiveSearchMatch: boolean;
  blurPrivateNames: boolean;
  hideExactTimestamps: boolean;
  onOpenMedia: (assetId: string) => void;
}) {
  const audioAssets = message.media_assets.filter((asset) => asset.media_type === "audio");
  const visualAssets = message.media_assets.filter((asset) => asset.media_type !== "audio");

  return (
    <div className="flex justify-start">
      <div className="max-w-[min(46rem,94%)]">
        <div className="flex items-center gap-3 px-1">
          <PrivacyText
            blurred={blurPrivateNames}
            className={["text-[11px] font-semibold uppercase tracking-[0.22em]", senderTone.labelClass].join(" ")}
          >
            {message.sender_label}
          </PrivacyText>
        </div>
        <div className="group mt-1.5 inline-flex items-stretch gap-3">
          <div className={["w-[3px] shrink-0 rounded-full", senderTone.poleClass].join(" ")} />
          <div
            className={[
              "min-w-0 flex-1 rounded-r-[1.35rem] rounded-bl-[0.45rem] border bg-white/88 px-4 py-3 text-slate-900 shadow-sm transition duration-150 group-hover:shadow-md dark:bg-slate-950/70 dark:text-slate-100",
              isActiveSearchMatch
                ? "border-amber-300 shadow-[0_18px_45px_rgba(245,158,11,0.2)] dark:border-amber-300/60 dark:shadow-[0_18px_45px_rgba(245,158,11,0.14)]"
                : isSearchMatch
                  ? "border-amber-200/80 dark:border-amber-300/35"
                  : "border-slate-200/80 group-hover:border-slate-300 dark:border-white/10 dark:group-hover:border-white/16 dark:group-hover:shadow-black/25",
            ].join(" ")}
          >
            {message.text ? renderMessageText(message.text, senderTone.linkClass, searchTerm) : null}

            {message.media_assets.length > 0 ? (
              <div className={`${message.text ? "mt-3" : ""} space-y-2`}>
                {visualAssets.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {visualAssets.map((asset) => (
                      <ChatMediaThumbnail
                        key={asset.id}
                        asset={asset}
                        showOverlays={showOverlays}
                        onOpen={() => onOpenMedia(asset.id)}
                      />
                    ))}
                  </div>
                ) : null}
                {audioAssets.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {audioAssets.map((asset) => (
                      <ChatVoiceMessage key={asset.id} asset={asset} />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="inline-flex min-h-[2.75rem] items-center px-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400 opacity-0 transition duration-150 group-hover:opacity-100">
            <span>{formatMessageTime(message.sent_at, hideExactTimestamps)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Chats() {
  const showOverlays = useShowMemoryOverlays();
  const { blurPrivateNames, hideExactTimestamps } = usePrivacyPreferences();
  const settings = resolveAppSettings(useSettings().data);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [filter, setFilter] = useState<"all" | "has_media">("all");
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeMatchIndex, setActiveMatchIndex] = useState<number | null>(null);
  const normalizedSearch = useMemo(() => normalizeChatSearch(search), [search]);

  const conversationsQuery = useChats({ search, sort, filter });
  const conversations = useMemo(
    () => conversationsQuery.data?.items ?? [],
    [conversationsQuery.data?.items],
  );
  const selectedConversation = conversations.find((conversation) => conversation.id === selectedChatId) ?? null;
  const messagesQuery = useChatMessages(selectedChatId);
  const messageScrollRef = useRef<HTMLDivElement | null>(null);
  const messageElementRefs = useRef(new Map<string, HTMLDivElement | null>());

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
    if (!element || !messagesQuery.data || normalizedSearch) {
      return;
    }
    element.scrollTop = element.scrollHeight;
  }, [messagesQuery.data, normalizedSearch, selectedChatId]);

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

  const senderTones = useMemo(
    () => buildSenderToneMap(messagesQuery.data?.items ?? [], selectedConversation?.is_group ?? false),
    [messagesQuery.data?.items, selectedConversation?.is_group],
  );
  const matchedMessageIds = useMemo(
    () => listMatchedChatMessageIds(messagesQuery.data?.items ?? [], normalizedSearch),
    [messagesQuery.data?.items, normalizedSearch],
  );
  const activeMatchedMessageId = activeMatchIndex !== null ? matchedMessageIds[activeMatchIndex] ?? null : null;
  const sortOptions = useMemo(
    () => [
      { value: "newest", label: "Newest First" },
      { value: "oldest", label: "Oldest First" },
    ],
    [],
  );
  const filterOptions = useMemo(
    () => [
      { value: "all", label: "All" },
      { value: "has_media", label: "Has Media" },
    ],
    [],
  );

  useEffect(() => {
    if (!matchedMessageIds.length) {
      setActiveMatchIndex(null);
      return;
    }
    setActiveMatchIndex(0);
  }, [matchedMessageIds, selectedChatId]);

  useEffect(() => {
    if (!activeMatchedMessageId) {
      return;
    }
    messageElementRefs.current.get(activeMatchedMessageId)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [activeMatchedMessageId]);

  function jumpToMatch(direction: "previous" | "next") {
    if (!matchedMessageIds.length) {
      return;
    }

    setActiveMatchIndex((current) => {
      if (current === null) {
        return 0;
      }

      if (direction === "previous") {
        return current === 0 ? matchedMessageIds.length - 1 : current - 1;
      }

      return current === matchedMessageIds.length - 1 ? 0 : current + 1;
    });
  }

  return (
    <section className="flex h-full min-h-0 w-full overflow-hidden rounded-[1.9rem] border border-slate-200/80 bg-white/84 shadow-[0_28px_80px_rgba(15,23,42,0.1)] dark:border-white/10 dark:bg-white/[0.045] dark:shadow-black/25">
      <aside className="flex w-[30%] min-w-[20rem] max-w-[28rem] flex-col border-r border-slate-200/80 bg-white/78 dark:border-white/10 dark:bg-slate-950/55">
        <div className="border-b border-slate-200/80 px-4 py-4 dark:border-white/10">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search chats and messages"
              aria-label="Search chats and messages"
              className="w-full rounded-[1rem] border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-sky-400 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-100"
            />
          </div>

          <div className="mt-3 flex gap-2">
            <PopoverSelect
              label="Sort conversations"
              icon={ArrowDownWideNarrow}
              value={sort}
              onChange={(value) => setSort(value as "newest" | "oldest")}
              options={sortOptions}
              fullWidth
            />

            <PopoverSelect
              label="Filter conversations"
              icon={MessageSquareText}
              value={filter}
              onChange={(value) => setFilter(value as "all" | "has_media")}
              options={filterOptions}
              fullWidth
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {conversationsQuery.isLoading ? (
            <div className="flex h-full items-center justify-center">
              <LoaderCircle className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : conversationsQuery.isError ? (
            <div className="rounded-[1.1rem] border border-rose-300/40 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-100">
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
                  blurPrivateNames={blurPrivateNames}
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <PrivacyText
                  blurred={blurPrivateNames}
                  className="text-lg font-semibold text-slate-950 dark:text-white"
                >
                  {selectedConversation.display_name}
                </PrivacyText>
                {normalizedSearch ? (
                  matchedMessageIds.length > 0 ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/70 bg-amber-100/80 px-2.5 py-1 text-xs font-medium text-amber-950 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">
                      <span>{matchedMessageIds.length} matches</span>
                      <span className="text-[11px] uppercase tracking-[0.16em] text-amber-800/80 dark:text-amber-100/70">
                        {activeMatchIndex !== null ? `${activeMatchIndex + 1} of ${matchedMessageIds.length}` : `1 of ${matchedMessageIds.length}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => jumpToMatch("previous")}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full transition hover:bg-black/6 dark:hover:bg-white/8"
                        aria-label="Previous search match"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => jumpToMatch("next")}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full transition hover:bg-black/6 dark:hover:bg-white/8"
                        aria-label="Next search match"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-full border border-slate-200/80 bg-slate-100/80 px-3 py-1 text-xs font-medium text-slate-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300">
                      No message matches in this conversation
                    </div>
                  )
                ) : null}
              </div>
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
                <div className="rounded-[1.2rem] border border-rose-300/40 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-100">
                  {messagesQuery.error instanceof Error ? messagesQuery.error.message : "Failed to load chat messages."}
                </div>
              ) : (
                <div className="space-y-5">
                  {messagesQuery.data?.items.map((message) => (
                    <div
                      key={message.id}
                      ref={(element) => {
                        messageElementRefs.current.set(message.id, element);
                      }}
                    >
                      <MessageBubble
                        message={message}
                        showOverlays={showOverlays}
                        senderTone={
                          senderTones.get(message.sender_label || message.sender || "Unknown") ??
                          (message.is_me ? PRIVATE_ME_TONE : PRIVATE_OTHER_TONE)
                        }
                        searchTerm={normalizedSearch}
                        isSearchMatch={messageMatchesChatSearch(message, normalizedSearch)}
                        isActiveSearchMatch={message.id === activeMatchedMessageId}
                        blurPrivateNames={blurPrivateNames}
                        hideExactTimestamps={hideExactTimestamps}
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
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(241,245,249,0.95))] px-6 text-center dark:bg-[linear-gradient(180deg,rgba(8,14,24,0.92),rgba(5,10,18,0.98))]">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Select a conversation.</p>
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
          preferBrowserPlayback={settings.prefer_browser_playback}
          autoplayVideosInLightbox={settings.autoplay_videos_in_lightbox}
        />
      ) : null}
    </section>
  );
}
