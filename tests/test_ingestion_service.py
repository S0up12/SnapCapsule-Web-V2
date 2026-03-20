from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

from sqlalchemy import select

from snapcapsule_core.models import Asset, MemoryCollection, MemoryItem
from snapcapsule_core.models.enums import AssetSource, MediaType
from snapcapsule_core.services.ingestion import IndexedAsset, IndexedAssetState, IngestionService


def test_parse_memories_deduplicates_repeated_indexed_assets(db_session):
    service = IngestionService(SimpleNamespace())
    source_path = Path("/tmp/repeated-memory.jpg")
    asset = Asset(
        external_id="memories:repeated-memory",
        source_type=AssetSource.MEMORY,
        media_type=MediaType.IMAGE,
        original_path=str(source_path),
    )
    db_session.add(asset)
    db_session.flush()

    indexed = IndexedAsset(
        asset=asset,
        source_path=source_path,
        overlay_source_path=None,
        source_type=AssetSource.MEMORY,
        taken_at=None,
        snapchat_media_id=None,
    )
    state = IndexedAssetState(
        all_assets=[indexed, indexed],
        chat_media_id_map={},
        chat_date_buckets={},
        memory_date_buckets={},
        story_date_buckets={},
    )

    service.parse_memories(db_session, [], state)
    db_session.flush()

    collection = db_session.scalar(select(MemoryCollection).where(MemoryCollection.title == "Saved Media"))
    assert collection is not None
    memory_items = db_session.execute(select(MemoryItem).where(MemoryItem.collection_id == collection.id)).scalars().all()
    assert len(memory_items) == 1
    assert memory_items[0].asset_id == asset.id
