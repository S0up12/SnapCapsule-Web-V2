import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Column,
    JSON,
    BigInteger,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from snapcapsule_core.models.base import Base, TimestampMixin
from snapcapsule_core.models.enums import (
    AssetSource,
    ChatMessageSource,
    IngestionJobStatus,
    IngestionSourceKind,
    MediaType,
    StoryType,
)

chat_message_assets = Table(
    "chat_message_assets",
    Base.metadata,
    Column("message_id", UUID(as_uuid=True), ForeignKey("chat_messages.id", ondelete="CASCADE"), primary_key=True),
    Column("asset_id", UUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), primary_key=True),
    Index("ix_chat_message_assets_asset_id", "asset_id"),
)


class Asset(TimestampMixin, Base):
    __tablename__ = "assets"
    __table_args__ = (
        UniqueConstraint("original_path", name="uq_assets_original_path"),
        Index("ix_assets_taken_at_media_type", "taken_at", "media_type"),
        Index("ix_assets_source_type_taken_at", "source_type", "taken_at"),
        Index("ix_assets_is_favorite", "is_favorite"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_id: Mapped[str | None] = mapped_column(String(255), index=True)
    source_type: Mapped[AssetSource] = mapped_column(
        Enum(AssetSource, name="asset_source"),
        default=AssetSource.UNKNOWN,
        nullable=False,
    )
    media_type: Mapped[MediaType] = mapped_column(Enum(MediaType, name="media_type"), nullable=False, index=True)
    original_path: Mapped[str] = mapped_column(Text, nullable=False)
    thumbnail_path: Mapped[str | None] = mapped_column(Text)
    overlay_path: Mapped[str | None] = mapped_column(Text)
    checksum_sha256: Mapped[str | None] = mapped_column(String(64), index=True)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    taken_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    raw_metadata: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    chat_messages: Mapped[list["ChatMessage"]] = relationship(
        secondary=chat_message_assets,
        back_populates="assets",
    )
    memory_items: Mapped[list["MemoryItem"]] = relationship(back_populates="asset", cascade="all, delete-orphan")
    story_items: Mapped[list["StoryItem"]] = relationship(back_populates="asset", cascade="all, delete-orphan")


class IngestionJob(TimestampMixin, Base):
    __tablename__ = "ingestion_jobs"
    __table_args__ = (
        Index("ix_ingestion_jobs_status_created_at", "status", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_kind: Mapped[IngestionSourceKind] = mapped_column(
        Enum(IngestionSourceKind, name="ingestion_source_kind"),
        nullable=False,
    )
    source_name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_path: Mapped[str] = mapped_column(Text, nullable=False)
    workspace_path: Mapped[str | None] = mapped_column(Text)
    celery_task_id: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[IngestionJobStatus] = mapped_column(
        Enum(IngestionJobStatus, name="ingestion_job_status"),
        default=IngestionJobStatus.QUEUED,
        nullable=False,
    )
    detail_message: Mapped[str | None] = mapped_column(String(255))
    progress_percent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_assets: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    processed_assets: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed_assets: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    raw_metadata: Mapped[dict[str, Any] | None] = mapped_column(JSON)


class ChatThread(TimestampMixin, Base):
    __tablename__ = "chat_threads"
    __table_args__ = (
        UniqueConstraint("external_id", name="uq_chat_threads_external_id"),
        Index("ix_chat_threads_title", "title"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_id: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str | None] = mapped_column(String(255))
    is_group: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    raw_metadata: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    messages: Mapped[list["ChatMessage"]] = relationship(back_populates="thread", cascade="all, delete-orphan")


class ChatMessage(TimestampMixin, Base):
    __tablename__ = "chat_messages"
    __table_args__ = (
        UniqueConstraint("dedupe_key", name="uq_chat_messages_dedupe_key"),
        Index("ix_chat_messages_thread_sent_at", "thread_id", "sent_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    thread_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("chat_threads.id", ondelete="CASCADE"), nullable=False)
    sender: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    message_type: Mapped[str] = mapped_column(String(64), default="TEXT", nullable=False)
    source: Mapped[ChatMessageSource] = mapped_column(
        Enum(ChatMessageSource, name="chat_message_source"),
        default=ChatMessageSource.CHAT_HISTORY,
        nullable=False,
    )
    dedupe_key: Mapped[str] = mapped_column(String(128), nullable=False)
    raw_media_ids: Mapped[list[str] | None] = mapped_column(JSON)
    raw_payload: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    thread: Mapped["ChatThread"] = relationship(back_populates="messages")
    assets: Mapped[list[Asset]] = relationship(secondary=chat_message_assets, back_populates="chat_messages")


class MemoryCollection(TimestampMixin, Base):
    __tablename__ = "memory_collections"
    __table_args__ = (
        UniqueConstraint("external_id", name="uq_memory_collections_external_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_id: Mapped[str | None] = mapped_column(String(255))
    title: Mapped[str] = mapped_column(String(255), default="Saved Media", nullable=False)
    raw_metadata: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    items: Mapped[list["MemoryItem"]] = relationship(back_populates="collection", cascade="all, delete-orphan")


class MemoryItem(TimestampMixin, Base):
    __tablename__ = "memory_items"
    __table_args__ = (
        UniqueConstraint("collection_id", "asset_id", name="uq_memory_items_collection_asset"),
        Index("ix_memory_items_taken_at", "taken_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    collection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("memory_collections.id", ondelete="CASCADE"),
        nullable=False,
    )
    asset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    taken_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    position: Mapped[int | None] = mapped_column(Integer)
    raw_payload: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    collection: Mapped["MemoryCollection"] = relationship(back_populates="items")
    asset: Mapped[Asset] = relationship(back_populates="memory_items")


class StoryCollection(TimestampMixin, Base):
    __tablename__ = "story_collections"
    __table_args__ = (
        UniqueConstraint("external_id", name="uq_story_collections_external_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_id: Mapped[str | None] = mapped_column(String(255))
    title: Mapped[str | None] = mapped_column(String(255))
    story_type: Mapped[StoryType] = mapped_column(
        Enum(StoryType, name="story_type"),
        default=StoryType.UNKNOWN,
        nullable=False,
    )
    raw_metadata: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    items: Mapped[list["StoryItem"]] = relationship(back_populates="collection", cascade="all, delete-orphan")


class StoryItem(TimestampMixin, Base):
    __tablename__ = "story_items"
    __table_args__ = (
        UniqueConstraint("collection_id", "asset_id", name="uq_story_items_collection_asset"),
        Index("ix_story_items_posted_at", "posted_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    collection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("story_collections.id", ondelete="CASCADE"),
        nullable=False,
    )
    asset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    position: Mapped[int | None] = mapped_column(Integer)
    raw_payload: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    collection: Mapped["StoryCollection"] = relationship(back_populates="items")
    asset: Mapped[Asset] = relationship(back_populates="story_items")
