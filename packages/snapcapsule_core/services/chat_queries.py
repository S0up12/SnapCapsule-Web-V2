from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import exists, func, select
from sqlalchemy.orm import Session, selectinload

from snapcapsule_core.models import Asset, ChatMessage, ChatThread, chat_message_assets
from snapcapsule_core.models.enums import MediaType


@dataclass(frozen=True, slots=True)
class ChatFilters:
    search: str = ""
    sort: str = "newest"
    filter_name: str = "all"


@dataclass(frozen=True, slots=True)
class ChatConversationRecord:
    id: uuid.UUID
    display_name: str
    latest_at: datetime | None
    latest_preview: str
    has_media: bool
    is_group: bool


@dataclass(frozen=True, slots=True)
class ChatMediaAssetRecord:
    id: uuid.UUID
    taken_at: datetime | None
    media_type: MediaType
    is_favorite: bool
    tags: tuple[str, ...]
    has_overlay: bool


@dataclass(frozen=True, slots=True)
class ChatMessageGroupRecord:
    id: str
    sender: str
    sender_label: str
    is_me: bool
    text: str
    sent_at: datetime
    media_assets: tuple[ChatMediaAssetRecord, ...]


def _normalize_sender(value: str | None) -> str:
    if not value:
        return ""
    return str(value).strip().lower()


def _is_me_sender(thread: ChatThread, sender: str) -> bool:
    normalized_sender = _normalize_sender(sender)
    if normalized_sender in {"me", "myself", "you"}:
        return True

    normalized_thread = _normalize_sender(thread.external_id)
    if not thread.is_group and normalized_sender and normalized_thread and normalized_sender != normalized_thread:
        return True

    return False


def _sender_label(thread: ChatThread, sender: str) -> str:
    if _is_me_sender(thread, sender):
        return "ME"
    return sender or thread.title or thread.external_id


def _message_preview(thread: ChatThread, sender: str | None, body: str | None, media_count: int) -> str:
    text = (body or "").strip()
    if not text and media_count > 0:
        text = "Media attachment"
    if not text:
        return "No messages yet"

    if sender and _is_me_sender(thread, sender):
        return f"You: {text}"
    return text


def list_chat_threads(session: Session, filters: ChatFilters) -> list[ChatConversationRecord]:
    ranked_messages = (
        select(
            ChatMessage.id.label("message_id"),
            ChatMessage.thread_id.label("thread_id"),
            ChatMessage.sent_at.label("sent_at"),
            ChatMessage.sender.label("sender"),
            ChatMessage.body.label("body"),
            func.row_number()
            .over(
                partition_by=ChatMessage.thread_id,
                order_by=(ChatMessage.sent_at.desc(), ChatMessage.id.desc()),
            )
            .label("message_rank"),
        )
        .subquery()
    )
    latest_messages = (
        select(
            ranked_messages.c.message_id,
            ranked_messages.c.thread_id,
            ranked_messages.c.sent_at,
            ranked_messages.c.sender,
            ranked_messages.c.body,
        )
        .where(ranked_messages.c.message_rank == 1)
        .subquery()
    )
    latest_media_counts = (
        select(
            chat_message_assets.c.message_id.label("message_id"),
            func.count(chat_message_assets.c.asset_id).label("media_count"),
        )
        .group_by(chat_message_assets.c.message_id)
        .subquery()
    )
    has_media = exists(
        select(1)
        .select_from(ChatMessage)
        .join(chat_message_assets, chat_message_assets.c.message_id == ChatMessage.id)
        .where(ChatMessage.thread_id == ChatThread.id)
    )

    statement = select(
        ChatThread.id,
        ChatThread.title,
        ChatThread.external_id,
        ChatThread.is_group,
        latest_messages.c.sent_at.label("latest_at"),
        latest_messages.c.sender.label("latest_sender"),
        latest_messages.c.body.label("latest_body"),
        func.coalesce(latest_media_counts.c.media_count, 0).label("latest_media_count"),
        has_media.label("has_media"),
    )
    statement = (
        statement.outerjoin(latest_messages, latest_messages.c.thread_id == ChatThread.id)
        .outerjoin(latest_media_counts, latest_media_counts.c.message_id == latest_messages.c.message_id)
    )

    if filters.search:
        search_value = f"%{filters.search.strip()}%"
        statement = statement.where(
            ChatThread.title.ilike(search_value) | ChatThread.external_id.ilike(search_value)
        )

    if filters.filter_name == "has_media":
        statement = statement.where(has_media)

    order_column = latest_messages.c.sent_at.asc() if filters.sort == "oldest" else latest_messages.c.sent_at.desc()
    statement = statement.order_by(order_column.nullslast(), ChatThread.title.asc(), ChatThread.external_id.asc())

    rows = session.execute(statement).all()
    records: list[ChatConversationRecord] = []
    for row in rows:
        display_name = row.title or row.external_id
        thread = ChatThread(
            id=row.id,
            title=row.title,
            external_id=row.external_id,
            is_group=row.is_group,
        )
        records.append(
            ChatConversationRecord(
                id=row.id,
                display_name=display_name,
                latest_at=row.latest_at,
                latest_preview=_message_preview(
                    thread,
                    row.latest_sender,
                    row.latest_body,
                    int(row.latest_media_count or 0),
                ),
                has_media=bool(row.has_media),
                is_group=bool(row.is_group),
            )
        )
    return records


def get_chat_thread(session: Session, chat_id: uuid.UUID) -> ChatThread | None:
    return session.get(ChatThread, chat_id)


def list_grouped_chat_messages(
    session: Session,
    *,
    chat_id: uuid.UUID,
    limit: int,
    offset: int,
    group_by_minute: bool = True,
) -> tuple[list[ChatMessageGroupRecord], int]:
    thread = session.get(ChatThread, chat_id)
    if thread is None:
        return [], 0

    messages = session.execute(
        select(ChatMessage)
        .where(ChatMessage.thread_id == chat_id)
        .options(selectinload(ChatMessage.assets))
        .order_by(ChatMessage.sent_at.asc(), ChatMessage.id.asc())
    ).scalars().all()

    grouped: list[ChatMessageGroupRecord] = []
    last_sender_label: str | None = None
    last_minute: str | None = None

    for message in messages:
        if not message.body and not message.assets:
            continue

        sender_label = _sender_label(thread, message.sender)
        is_me = _is_me_sender(thread, message.sender)
        minute_key = message.sent_at.strftime("%Y%m%d%H%M")
        media_assets = tuple(
            ChatMediaAssetRecord(
                id=asset.id,
                taken_at=asset.taken_at,
                media_type=asset.media_type,
                is_favorite=asset.is_favorite,
                tags=tuple(asset.tags or ()),
                has_overlay=bool(asset.overlay_path),
            )
            for asset in sorted(
                message.assets,
                key=lambda asset: (asset.taken_at or message.sent_at, str(asset.id)),
            )
            if asset.media_type in {MediaType.IMAGE, MediaType.VIDEO, MediaType.AUDIO}
        )

        if group_by_minute and grouped and sender_label == last_sender_label and minute_key == last_minute:
            previous = grouped[-1]
            text = previous.text
            if message.body:
                text = f"{text}\n{message.body}" if text else message.body
            grouped[-1] = ChatMessageGroupRecord(
                id=previous.id,
                sender=previous.sender,
                sender_label=previous.sender_label,
                is_me=previous.is_me,
                text=text,
                sent_at=previous.sent_at,
                media_assets=previous.media_assets + media_assets,
            )
            continue

        grouped.append(
            ChatMessageGroupRecord(
                id=str(message.id),
                sender=message.sender,
                sender_label=sender_label,
                is_me=is_me,
                text=message.body or "",
                sent_at=message.sent_at,
                media_assets=media_assets,
            )
        )
        last_sender_label = sender_label
        last_minute = minute_key

    total = len(grouped)
    return grouped[offset: offset + limit], total
