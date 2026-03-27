from __future__ import annotations

import argparse
from collections.abc import Iterable
from pathlib import Path

from snapcapsule_core.config import get_settings
from snapcapsule_core.db import SessionLocal, session_scope
from snapcapsule_core.models import Asset, ChatMessage, ChatThread
from snapcapsule_core.models.enums import AssetSource, ChatMessageSource
from snapcapsule_core.services.ingestion import IndexedAsset, IndexedAssetState, IngestionService
from sqlalchemy import select
from sqlalchemy.orm import selectinload


def build_chat_asset_state(service: IngestionService) -> IndexedAssetState:
    with session_scope() as session:
        assets = session.scalars(
            select(Asset)
            .where(Asset.source_type == AssetSource.CHAT)
            .order_by(Asset.taken_at, Asset.id)
        ).all()

    indexed_assets: list[IndexedAsset] = []
    chat_media_id_map: dict[str, IndexedAsset] = {}
    chat_date_buckets: dict[str, list[IndexedAsset]] = {}

    for asset in assets:
        source_path = Path(asset.original_path)
        overlay_source_path = Path(asset.overlay_path) if asset.overlay_path else None

        stem_id: str | None = None
        if asset.external_id and ":" in asset.external_id:
            stem_id = asset.external_id.split(":", 1)[1]
        if not stem_id:
            stem_id = service.normalize_media_stem(source_path)

        indexed = IndexedAsset(
            asset=asset,
            source_path=source_path,
            overlay_source_path=overlay_source_path,
            source_type=AssetSource.CHAT,
            taken_at=asset.taken_at,
            snapchat_media_id=service.extract_chat_media_id(stem_id),
        )
        indexed_assets.append(indexed)

        if indexed.snapchat_media_id:
            chat_media_id_map.setdefault(indexed.snapchat_media_id, indexed)

        if indexed.taken_at is None:
            continue
        date_key = indexed.taken_at.strftime("%Y-%m-%d")
        chat_date_buckets.setdefault(date_key, []).append(indexed)

    for values in chat_date_buckets.values():
        values.sort(key=lambda entry: entry.taken_at or entry.asset.created_at)

    return IndexedAssetState(
        all_assets=indexed_assets,
        chat_media_id_map=chat_media_id_map,
        chat_date_buckets=chat_date_buckets,
        memory_date_buckets={},
        story_date_buckets={},
    )


def load_messages(source: ChatMessageSource) -> list[ChatMessage]:
    with session_scope() as session:
        return session.scalars(
            select(ChatMessage)
            .join(ChatThread, ChatThread.id == ChatMessage.thread_id)
            .options(selectinload(ChatMessage.assets))
            .where(ChatMessage.source == source)
            .order_by(ChatThread.external_id, ChatMessage.sent_at, ChatMessage.id)
        ).all()


def resolve_media_ids(service: IngestionService, message: ChatMessage) -> list[str]:
    if message.raw_media_ids:
        return [str(media_id) for media_id in message.raw_media_ids if str(media_id).strip()]
    if not isinstance(message.raw_payload, dict):
        return []
    return service.parse_media_ids(message.raw_payload.get("Media IDs"))


def sync_message_links(
    service: IngestionService,
    state: IndexedAssetState,
    messages: Iterable[ChatMessage],
    *,
    source: ChatMessageSource,
    apply_changes: bool,
) -> dict[str, int]:
    relinked = 0
    matched = 0
    unmatched = 0
    unchanged = 0

    session = SessionLocal()
    try:
        for message in messages:
            persistent = session.get(ChatMessage, message.id, options=(selectinload(ChatMessage.assets),))
            if persistent is None:
                continue

            if source == ChatMessageSource.CHAT_HISTORY:
                linked_assets = service.find_assets_for_message(
                    persistent.sent_at,
                    resolve_media_ids(service, persistent),
                    persistent.message_type,
                    state,
                )
                next_assets = [entry.asset for entry in linked_assets]
            else:
                linked_asset = service.find_snap_history_asset(persistent.sent_at, state)
                next_assets = [linked_asset.asset] if linked_asset is not None else []

            next_asset_ids = [asset.id for asset in next_assets]
            next_persistent_assets = [session.get(Asset, asset_id) for asset_id in next_asset_ids]
            next_persistent_assets = [asset for asset in next_persistent_assets if asset is not None]

            before_ids = {asset.id for asset in persistent.assets}
            after_ids = {asset.id for asset in next_persistent_assets}
            if before_ids == after_ids:
                unchanged += 1
            else:
                relinked += 1
                persistent.assets = next_persistent_assets

            if next_persistent_assets:
                matched += 1
            else:
                unmatched += 1
        if apply_changes:
            session.commit()
        else:
            session.rollback()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

    return {
        "total": relinked + unchanged,
        "relinked": relinked,
        "matched": matched,
        "unmatched": unmatched,
        "unchanged": unchanged,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Rebuild chat-to-media links from existing imported database records without re-uploading data.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Persist rebuilt links. Omit to run in dry-run mode.",
    )
    args = parser.parse_args()

    settings = get_settings()
    service = IngestionService(settings)
    state = build_chat_asset_state(service)

    chat_history_messages = load_messages(ChatMessageSource.CHAT_HISTORY)
    snap_history_messages = load_messages(ChatMessageSource.SNAP_HISTORY)

    if not args.apply:
        chat_stats = sync_message_links(
            service,
            state,
            chat_history_messages,
            source=ChatMessageSource.CHAT_HISTORY,
            apply_changes=False,
        )
        snap_stats = sync_message_links(
            service,
            state,
            snap_history_messages,
            source=ChatMessageSource.SNAP_HISTORY,
            apply_changes=False,
        )
        print("Dry run complete. No database changes were saved.")
    else:
        chat_stats = sync_message_links(
            service,
            state,
            chat_history_messages,
            source=ChatMessageSource.CHAT_HISTORY,
            apply_changes=True,
        )
        snap_stats = sync_message_links(
            service,
            state,
            snap_history_messages,
            source=ChatMessageSource.SNAP_HISTORY,
            apply_changes=True,
        )
        print("Rebuild complete. Database changes were saved.")

    print("")
    print("CHAT_HISTORY")
    print(f"  total:     {chat_stats['total']}")
    print(f"  relinked:  {chat_stats['relinked']}")
    print(f"  matched:   {chat_stats['matched']}")
    print(f"  unmatched: {chat_stats['unmatched']}")
    print(f"  unchanged: {chat_stats['unchanged']}")
    print("")
    print("SNAP_HISTORY")
    print(f"  total:     {snap_stats['total']}")
    print(f"  relinked:  {snap_stats['relinked']}")
    print(f"  matched:   {snap_stats['matched']}")
    print(f"  unmatched: {snap_stats['unmatched']}")
    print(f"  unchanged: {snap_stats['unchanged']}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
