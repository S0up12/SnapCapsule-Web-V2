from __future__ import annotations

import hashlib
import json
import re
import shutil
import uuid
import zipfile
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import Any, Callable

from bs4 import BeautifulSoup
from sqlalchemy import select
from sqlalchemy.orm import Session

from snapcapsule_core.models import Asset, ChatMessage, ChatThread, IngestionJob, MemoryCollection, MemoryItem, StoryCollection, StoryItem
from snapcapsule_core.models.enums import AssetSource, ChatMessageSource, IngestionJobStatus, IngestionSourceKind, MediaType, StoryType

DATE_PATTERN = re.compile(r"(\d{4}-\d{2}-\d{2})")
MEDIA_ID_DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".webm", ".mkv", ".m4v"}
MEDIA_SUFFIXES = ("_overlay", "_caption", "_image", "_video", "_media", "_main")
CHAT_MEDIA_MATCH_MAX_DELTA_SECONDS = 5
SNAP_MEDIA_MATCH_MAX_DELTA_SECONDS = 5
MERGEABLE_JSON_FILES = {
    "chat_history.json",
    "snap_history.json",
    "memories_history.json",
    "stories_history.json",
    "story_history.json",
    "stories.json",
}
MEDIA_DIRECTORIES = ("chat_media", "memories", "stories", "story_media")


@dataclass(slots=True)
class IndexedAsset:
    asset: Asset
    source_path: Path
    overlay_source_path: Path | None
    source_type: AssetSource
    taken_at: datetime | None
    snapchat_media_id: str | None
    claimed: bool = False


@dataclass(slots=True)
class IndexedAssetState:
    all_assets: list[IndexedAsset]
    chat_media_id_map: dict[str, IndexedAsset]
    chat_date_buckets: dict[str, list[IndexedAsset]]
    memory_date_buckets: dict[str, list[IndexedAsset]]
    story_date_buckets: dict[str, list[IndexedAsset]]


@dataclass(slots=True)
class PreparedSource:
    roots: list[Path]
    workspace_path: Path | None
    preserve_source: bool


class IngestionService:
    def __init__(self, settings):
        self.settings = settings

    def prepare_source(self, job: IngestionJob) -> PreparedSource:
        source_path = Path(job.source_path)
        if job.source_kind == IngestionSourceKind.DIRECTORY:
            return PreparedSource(
                roots=[self.find_snap_root(source_path)],
                workspace_path=None,
                preserve_source=True,
            )

        workspace_path = self.settings.ingest_workspace_dir / str(job.id)
        if workspace_path.exists():
            shutil.rmtree(workspace_path)
        workspace_path.mkdir(parents=True, exist_ok=True)
        fragments_root = workspace_path / "_parts"
        fragments_root.mkdir(parents=True, exist_ok=True)

        archive_paths = sorted(
            archive_path
            for archive_path in source_path.glob("*.zip")
            if archive_path.is_file()
        )
        if not archive_paths:
            raise FileNotFoundError(f"No ZIP archives found in upload bundle: {source_path}")

        roots: list[Path] = []
        for index, archive_path in enumerate(archive_paths, start=1):
            extract_root = fragments_root / f"part-{index:03d}"
            extract_root.mkdir(parents=True, exist_ok=True)
            self.safe_extract_zip(archive_path, extract_root)
            roots.append(self.find_snap_root(extract_root))

        return PreparedSource(
            roots=roots,
            workspace_path=workspace_path,
            preserve_source=False,
        )

    def safe_extract_zip(self, archive_path: Path, destination: Path) -> None:
        with zipfile.ZipFile(archive_path, "r") as archive:
            for member in archive.infolist():
                if not self.is_safe_zip_member(member.filename):
                    continue
                target = destination / member.filename
                if member.is_dir():
                    target.mkdir(parents=True, exist_ok=True)
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(member) as source, target.open("wb") as handle:
                    shutil.copyfileobj(source, handle)

    def merge_snap_root(self, source_root: Path, destination_root: Path, archive_label: str) -> None:
        destination_root.mkdir(parents=True, exist_ok=True)

        for directory_name in MEDIA_DIRECTORIES:
            self.merge_directory(
                source_root / directory_name,
                destination_root / directory_name,
                keep_existing=True,
            )

        self.merge_directory(
            source_root / "html",
            destination_root / "html",
            keep_existing=False,
            rename_conflicts=True,
            conflict_suffix=archive_label,
        )

        json_source_dirs = [
            (source_root / "json", destination_root / "json"),
            (source_root, destination_root),
        ]
        for source_dir, destination_dir in json_source_dirs:
            if not source_dir.exists() or not source_dir.is_dir():
                continue
            for json_file in source_dir.glob("*.json"):
                self.merge_json_file(
                    json_file,
                    destination_dir / json_file.name,
                )

    def merge_directory(
        self,
        source_dir: Path,
        destination_dir: Path,
        *,
        keep_existing: bool,
        rename_conflicts: bool = False,
        conflict_suffix: str | None = None,
    ) -> None:
        if not source_dir.exists():
            return

        for source_path in source_dir.rglob("*"):
            if source_path.name.startswith("."):
                continue

            relative_path = source_path.relative_to(source_dir)
            target_path = destination_dir / relative_path
            if source_path.is_dir():
                target_path.mkdir(parents=True, exist_ok=True)
                continue

            target_path.parent.mkdir(parents=True, exist_ok=True)
            if target_path.exists():
                if keep_existing:
                    continue
                if rename_conflicts and not self.files_match(source_path, target_path):
                    suffix = conflict_suffix or "duplicate"
                    target_path = target_path.with_name(
                        f"{target_path.stem}__{suffix}{target_path.suffix}"
                    )
                else:
                    continue

            shutil.copy2(source_path, target_path)

    def merge_json_file(self, source_path: Path, destination_path: Path) -> None:
        destination_path.parent.mkdir(parents=True, exist_ok=True)
        if not destination_path.exists():
            shutil.copy2(source_path, destination_path)
            return

        if source_path.name not in MERGEABLE_JSON_FILES:
            return

        with destination_path.open("r", encoding="utf-8") as existing_handle:
            existing_payload = json.load(existing_handle)
        with source_path.open("r", encoding="utf-8") as incoming_handle:
            incoming_payload = json.load(incoming_handle)

        if source_path.name in {"chat_history.json", "snap_history.json"}:
            merged_payload = self.merge_conversation_payload(existing_payload, incoming_payload)
        elif source_path.name == "memories_history.json":
            merged_payload = self.merge_memories_payload(existing_payload, incoming_payload)
        else:
            merged_payload = self.merge_generic_json_payload(existing_payload, incoming_payload)

        with destination_path.open("w", encoding="utf-8") as handle:
            json.dump(merged_payload, handle, indent=2)

    @staticmethod
    def merge_conversation_payload(existing_payload: Any, incoming_payload: Any) -> dict[str, Any]:
        existing_dict = existing_payload if isinstance(existing_payload, dict) else {}
        incoming_dict = incoming_payload if isinstance(incoming_payload, dict) else {}

        merged: dict[str, Any] = {
            key: value
            for key, value in existing_dict.items()
        }
        for conversation_id, payload in incoming_dict.items():
            if isinstance(payload, list):
                existing_messages = merged.get(conversation_id)
                target_messages = list(existing_messages) if isinstance(existing_messages, list) else []
                seen_signatures = {
                    IngestionService.json_signature(message)
                    for message in target_messages
                }
                for message in payload:
                    signature = IngestionService.json_signature(message)
                    if signature in seen_signatures:
                        continue
                    target_messages.append(message)
                    seen_signatures.add(signature)
                merged[conversation_id] = target_messages
            elif isinstance(payload, dict):
                nested_existing = merged.get(conversation_id)
                merged[conversation_id] = IngestionService.merge_conversation_payload(
                    nested_existing if isinstance(nested_existing, dict) else {},
                    payload,
                )
            elif conversation_id not in merged:
                merged[conversation_id] = payload

        return merged

    @staticmethod
    def merge_memories_payload(existing_payload: Any, incoming_payload: Any) -> dict[str, Any]:
        merged = existing_payload if isinstance(existing_payload, dict) else {}
        incoming = incoming_payload if isinstance(incoming_payload, dict) else {}

        merged_items = list(merged.get("Saved Media", [])) if isinstance(merged.get("Saved Media"), list) else []
        seen_signatures = {
            IngestionService.json_signature(item)
            for item in merged_items
        }
        for item in incoming.get("Saved Media", []):
            signature = IngestionService.json_signature(item)
            if signature in seen_signatures:
                continue
            merged_items.append(item)
            seen_signatures.add(signature)

        result = {
            key: value
            for key, value in merged.items()
        }
        for key, value in incoming.items():
            if key != "Saved Media" and key not in result:
                result[key] = value
        result["Saved Media"] = merged_items
        return result

    @staticmethod
    def merge_generic_json_payload(existing_payload: Any, incoming_payload: Any) -> Any:
        if isinstance(existing_payload, list) and isinstance(incoming_payload, list):
            merged_items = list(existing_payload)
            seen_signatures = {
                IngestionService.json_signature(item)
                for item in merged_items
            }
            for item in incoming_payload:
                signature = IngestionService.json_signature(item)
                if signature in seen_signatures:
                    continue
                merged_items.append(item)
                seen_signatures.add(signature)
            return merged_items

        if isinstance(existing_payload, dict) and isinstance(incoming_payload, dict):
            merged = {
                key: value
                for key, value in existing_payload.items()
            }
            for key, value in incoming_payload.items():
                if key not in merged:
                    merged[key] = value
                    continue
                merged[key] = IngestionService.merge_generic_json_payload(merged[key], value)
            return merged

        return existing_payload

    @staticmethod
    def json_signature(payload: Any) -> str:
        return json.dumps(payload, sort_keys=True, default=str)

    @staticmethod
    def files_match(source_path: Path, target_path: Path) -> bool:
        if source_path.stat().st_size != target_path.stat().st_size:
            return False
        with source_path.open("rb") as source_handle, target_path.open("rb") as target_handle:
            while True:
                source_chunk = source_handle.read(1024 * 1024)
                target_chunk = target_handle.read(1024 * 1024)
                if source_chunk != target_chunk:
                    return False
                if not source_chunk:
                    return True

    @staticmethod
    def is_safe_zip_member(name: str) -> bool:
        if not name:
            return False
        cleaned = name.replace("\\", "/")
        posix = PurePosixPath(cleaned)
        if posix.is_absolute() or ".." in posix.parts:
            return False
        win = PureWindowsPath(cleaned)
        if win.is_absolute() or win.drive:
            return False
        return True

    def find_snap_root(self, path: Path) -> Path:
        if not path.exists() or not path.is_dir():
            raise FileNotFoundError(f"Import path not found: {path}")
        if (path / "json").exists() or (path / "html").exists():
            return path
        for child in path.iterdir():
            if child.is_dir() and ((child / "json").exists() or (child / "html").exists()):
                return child
        return path

    def run_ingestion(
        self,
        session: Session,
        job: IngestionJob,
        root_paths: list[Path],
        *,
        cancel_check: Callable[[], None] | None = None,
    ) -> IndexedAssetState:
        if cancel_check is not None:
            cancel_check()

        indexed_assets = self.index_assets(session, job, root_paths)
        if cancel_check is not None:
            cancel_check()

        seen_chat_keys: set[str] = set()
        seen_snap_keys: set[str] = set()

        self.parse_chats(session, root_paths, indexed_assets, seen_chat_keys)
        if cancel_check is not None:
            cancel_check()
        self.parse_snap_history(session, root_paths, indexed_assets, seen_snap_keys)
        if cancel_check is not None:
            cancel_check()
        self.parse_memories(session, root_paths, indexed_assets)
        if cancel_check is not None:
            cancel_check()
        self.parse_stories(session, root_paths, indexed_assets)
        if cancel_check is not None:
            cancel_check()

        job.total_assets = len(indexed_assets.all_assets)
        job.processed_assets = 0
        job.failed_assets = 0
        if job.total_assets == 0:
            job.status = IngestionJobStatus.COMPLETED
            job.detail_message = "Ingestion completed with no media assets"
            job.progress_percent = 100
            job.finished_at = datetime.now(UTC)
        else:
            job.status = IngestionJobStatus.PROCESSING_MEDIA
            job.detail_message = "Queued media processing"
            job.progress_percent = 50

        return indexed_assets

    def index_assets(self, session: Session, job: IngestionJob, root_paths: list[Path]) -> IndexedAssetState:
        chat_media_id_map: dict[str, IndexedAsset] = {}
        chat_date_buckets: dict[str, list[IndexedAsset]] = {}
        memory_date_buckets: dict[str, list[IndexedAsset]] = {}
        story_date_buckets: dict[str, list[IndexedAsset]] = {}
        indexed_assets: list[IndexedAsset] = []

        for root_path in root_paths:
            media_folders = [
                (root_path / "chat_media", AssetSource.CHAT),
                (root_path / "memories", AssetSource.MEMORY),
                (root_path / "stories", AssetSource.STORY),
                (root_path / "story_media", AssetSource.STORY),
            ]

            for folder, source_type in media_folders:
                if not folder.exists():
                    continue

                groups: dict[str, dict[str, Path | datetime | None]] = {}
                for file_path in folder.rglob("*"):
                    if not file_path.is_file() or file_path.name.startswith("."):
                        continue
                    stem_id = self.normalize_media_stem(file_path)
                    group = groups.setdefault(stem_id, {"main": None, "overlay": None, "ts": None})
                    if self.is_overlay_variant(file_path):
                        group["overlay"] = file_path
                        continue

                    current_main = group["main"]
                    if current_main is None or self.prefer_media_candidate(file_path, current_main):
                        group["main"] = file_path
                        group["ts"] = self.best_timestamp(file_path)

                for stem_id, payload in groups.items():
                    main_file = payload["main"]
                    if main_file is None:
                        continue

                    taken_at = payload["ts"]
                    overlay_file = payload["overlay"]
                    media_type = self.detect_media_type(main_file)
                    external_id = f"{main_file.relative_to(root_path).parent.as_posix()}:{stem_id}"
                    asset = session.scalar(
                        select(Asset).where(
                            Asset.external_id == external_id,
                            Asset.source_type == source_type,
                        )
                    )
                    if asset is None:
                        asset = Asset(
                            external_id=external_id,
                            source_type=source_type,
                            media_type=media_type,
                            original_path=str(main_file.resolve()),
                        )
                        session.add(asset)
                        session.flush()

                    asset.original_path = str(main_file.resolve())
                    asset.overlay_path = str(overlay_file.resolve()) if overlay_file else None
                    asset.file_size_bytes = main_file.stat().st_size
                    asset.taken_at = taken_at
                    asset.raw_metadata = {
                        "job_id": str(job.id),
                        "source_path": str(main_file.resolve()),
                        "overlay_source_path": str(overlay_file.resolve()) if overlay_file else None,
                        "relative_path": main_file.relative_to(root_path).as_posix(),
                        "processing": "queued",
                    }

                    indexed = IndexedAsset(
                        asset=asset,
                        source_path=main_file.resolve(),
                        overlay_source_path=overlay_file.resolve() if overlay_file else None,
                        source_type=source_type,
                        taken_at=taken_at,
                        snapchat_media_id=self.extract_chat_media_id(stem_id) if source_type == AssetSource.CHAT else None,
                    )
                    indexed_assets.append(indexed)

                    if indexed.snapchat_media_id:
                        chat_media_id_map.setdefault(indexed.snapchat_media_id, indexed)

                    if indexed.taken_at is None:
                        continue
                    date_key = indexed.taken_at.strftime("%Y-%m-%d")
                    if source_type == AssetSource.CHAT:
                        chat_date_buckets.setdefault(date_key, []).append(indexed)
                    elif source_type == AssetSource.MEMORY:
                        memory_date_buckets.setdefault(date_key, []).append(indexed)
                    elif source_type == AssetSource.STORY:
                        story_date_buckets.setdefault(date_key, []).append(indexed)

        for bucket in (chat_date_buckets, memory_date_buckets, story_date_buckets):
            for values in bucket.values():
                values.sort(key=lambda entry: entry.taken_at or datetime.min.replace(tzinfo=UTC))

        return IndexedAssetState(
            all_assets=indexed_assets,
            chat_media_id_map=chat_media_id_map,
            chat_date_buckets=chat_date_buckets,
            memory_date_buckets=memory_date_buckets,
            story_date_buckets=story_date_buckets,
        )

    def parse_chats(
        self,
        session: Session,
        root_paths: list[Path],
        state: IndexedAssetState,
        seen_dedupe_keys: set[str],
    ) -> None:
        payload = self.load_chat_payload(root_paths)
        if not isinstance(payload, dict):
            return

        for conversation_id, content in payload.items():
            if isinstance(content, list):
                self.parse_chat_message_list(session, str(conversation_id), content, state, seen_dedupe_keys)
            elif isinstance(content, dict):
                for nested_conversation_id, messages in content.items():
                    if isinstance(messages, list):
                        self.parse_chat_message_list(
                            session,
                            str(nested_conversation_id),
                            messages,
                            state,
                            seen_dedupe_keys,
                        )

    def parse_chat_message_list(
        self,
        session: Session,
        conversation_id: str,
        messages: list[dict[str, Any]],
        state: IndexedAssetState,
        seen_dedupe_keys: set[str],
    ) -> None:
        title = next((entry.get("Conversation Title") for entry in messages if entry.get("Conversation Title")), None)
        thread = self.get_or_create_thread(session, conversation_id, title)

        parsed_messages: list[tuple[dict[str, Any], datetime]] = []
        for entry in messages:
            timestamp = self.parse_datetime(entry.get("Created"))
            if timestamp is None:
                continue
            parsed_messages.append((entry, timestamp))
        parsed_messages.sort(key=lambda item: item[1])

        for entry, timestamp in parsed_messages:
            sender = str(entry.get("From", "Unknown"))
            content = str(entry.get("Content", "") or "")
            media_type = str(entry.get("Media Type", "TEXT") or "TEXT")
            media_ids = self.parse_media_ids(entry.get("Media IDs"))
            linked_assets = self.find_assets_for_message(timestamp, media_ids, media_type, state)
            dedupe_key = self.build_message_dedupe_key(
                thread.external_id,
                sender,
                content,
                timestamp,
                ChatMessageSource.CHAT_HISTORY,
                [linked.asset.id for linked in linked_assets],
            )
            if dedupe_key in seen_dedupe_keys:
                continue
            existing = session.scalar(select(ChatMessage).where(ChatMessage.dedupe_key == dedupe_key))
            if existing is not None:
                seen_dedupe_keys.add(dedupe_key)
                continue

            message = ChatMessage(
                thread=thread,
                sender=sender,
                body=content,
                sent_at=timestamp,
                message_type=media_type,
                source=ChatMessageSource.CHAT_HISTORY,
                dedupe_key=dedupe_key,
                raw_media_ids=media_ids,
                raw_payload=entry,
            )
            message.assets = [linked.asset for linked in linked_assets]
            session.add(message)
            seen_dedupe_keys.add(dedupe_key)

    def parse_snap_history(
        self,
        session: Session,
        root_paths: list[Path],
        state: IndexedAssetState,
        seen_dedupe_keys: set[str],
    ) -> None:
        payload = self.load_merged_json_payload(root_paths, "snap_history.json", self.merge_conversation_payload)
        if not payload or not isinstance(payload, dict):
            return

        for conversation_id, messages in payload.items():
            if not isinstance(messages, list):
                continue

            title = next((entry.get("Conversation Title") for entry in messages if entry.get("Conversation Title")), None)
            thread = self.get_or_create_thread(session, str(conversation_id), title)

            snap_entries: list[tuple[dict[str, Any], datetime]] = []
            for entry in messages:
                media_type = str(entry.get("Media Type", "") or "").strip()
                if not media_type or media_type.upper() == "TEXT":
                    continue
                timestamp = self.parse_datetime(entry.get("Created"))
                if timestamp is None:
                    continue
                snap_entries.append((entry, timestamp))

            snap_entries.sort(key=lambda item: item[1])
            for entry, timestamp in snap_entries:
                linked_asset = self.find_snap_history_asset(timestamp, state)
                if linked_asset is None:
                    continue

                sender = str(entry.get("From", "Unknown"))
                media_type = str(entry.get("Media Type", "MEDIA") or "MEDIA")
                dedupe_key = self.build_message_dedupe_key(
                    thread.external_id,
                    sender,
                    "",
                    timestamp,
                    ChatMessageSource.SNAP_HISTORY,
                    [linked_asset.asset.id],
                )
                if dedupe_key in seen_dedupe_keys:
                    continue
                if session.scalar(select(ChatMessage).where(ChatMessage.dedupe_key == dedupe_key)) is not None:
                    seen_dedupe_keys.add(dedupe_key)
                    continue

                message = ChatMessage(
                    thread=thread,
                    sender=sender,
                    body="",
                    sent_at=timestamp,
                    message_type=media_type,
                    source=ChatMessageSource.SNAP_HISTORY,
                    dedupe_key=dedupe_key,
                    raw_media_ids=None,
                    raw_payload=entry,
                )
                message.assets = [linked_asset.asset]
                session.add(message)
                seen_dedupe_keys.add(dedupe_key)

    def parse_memories(self, session: Session, root_paths: list[Path], state: IndexedAssetState) -> None:
        memory_assets = [entry for entry in state.all_assets if entry.source_type == AssetSource.MEMORY]
        if not memory_assets:
            return

        collection = session.scalar(select(MemoryCollection).where(MemoryCollection.title == "Saved Media"))
        if collection is None:
            collection = MemoryCollection(title="Saved Media")
            session.add(collection)
            session.flush()

        payload = self.load_merged_json_payload(root_paths, "memories_history.json", self.merge_memories_payload)
        items = payload.get("Saved Media", []) if isinstance(payload, dict) else []

        assigned_assets: list[tuple[IndexedAsset, dict[str, Any] | None]] = []
        if items:
            for item in items:
                timestamp = self.parse_datetime(item.get("Date"))
                asset = self.find_bucket_asset(state.memory_date_buckets, timestamp)
                if asset is not None:
                    assigned_assets.append((asset, item))
        else:
            for asset in sorted(memory_assets, key=lambda entry: entry.taken_at or datetime.min.replace(tzinfo=UTC)):
                if asset.claimed:
                    continue
                asset.claimed = True
                assigned_assets.append((asset, None))

        existing_asset_ids = {
            row[0]
            for row in session.execute(
                select(MemoryItem.asset_id).where(MemoryItem.collection_id == collection.id)
            )
        }
        position = 0
        for asset, payload in assigned_assets:
            if asset.asset.id in existing_asset_ids:
                continue
            session.add(
                MemoryItem(
                    collection=collection,
                    asset=asset.asset,
                    taken_at=asset.taken_at,
                    position=position,
                    raw_payload=payload,
                )
            )
            position += 1

    def parse_stories(self, session: Session, root_paths: list[Path], state: IndexedAssetState) -> None:
        story_assets = [entry for entry in state.all_assets if entry.source_type == AssetSource.STORY]
        if not story_assets:
            return

        entries: list[dict[str, Any]] = []
        for candidate in ("stories_history.json", "story_history.json", "stories.json"):
            payload = self.load_merged_json_payload(root_paths, candidate, self.merge_generic_json_payload)
            entries = self.flatten_story_payload(payload)
            if entries:
                break

        if not entries:
            collection = self.get_or_create_story_collection(session, "Stories", StoryType.UNKNOWN, None)
            self.attach_story_assets(session, collection, story_assets, None)
            return

        grouped_entries: dict[str, list[dict[str, Any]]] = {}
        for entry in entries:
            key = str(entry.get("Story Name") or entry.get("Title") or "Stories")
            grouped_entries.setdefault(key, []).append(entry)

        for title, group in grouped_entries.items():
            raw_type = str(group[0].get("Story Type") or "").strip().lower()
            story_type = StoryType(raw_type) if raw_type in {item.value for item in StoryType} else StoryType.UNKNOWN
            collection = self.get_or_create_story_collection(session, title, story_type, title)
            assigned: list[IndexedAsset] = []
            for entry in group:
                timestamp = self.parse_datetime(entry.get("Date")) or self.parse_datetime(entry.get("Created")) or self.parse_datetime(entry.get("Timestamp"))
                asset = self.find_bucket_asset(state.story_date_buckets, timestamp)
                if asset is not None:
                    assigned.append(asset)
            self.attach_story_assets(session, collection, assigned, group)

    def attach_story_assets(
        self,
        session: Session,
        collection: StoryCollection,
        assets: list[IndexedAsset],
        payload: list[dict[str, Any]] | None,
    ) -> None:
        existing_asset_ids = {
            row[0]
            for row in session.execute(
                select(StoryItem.asset_id).where(StoryItem.collection_id == collection.id)
            )
        }
        for position, asset in enumerate(assets):
            if asset.asset.id in existing_asset_ids:
                continue
            session.add(
                StoryItem(
                    collection=collection,
                    asset=asset.asset,
                    posted_at=asset.taken_at,
                    position=position,
                    raw_payload=(payload[position] if payload and position < len(payload) else None),
                )
            )

    def get_or_create_story_collection(
        self,
        session: Session,
        title: str,
        story_type: StoryType,
        external_id: str | None,
    ) -> StoryCollection:
        collection = session.scalar(select(StoryCollection).where(StoryCollection.title == title))
        if collection is None:
            collection = StoryCollection(title=title, story_type=story_type, external_id=external_id)
            session.add(collection)
            session.flush()
        else:
            collection.story_type = story_type
        return collection

    def get_or_create_thread(self, session: Session, conversation_id: str, title: str | None) -> ChatThread:
        thread = session.scalar(select(ChatThread).where(ChatThread.external_id == conversation_id))
        if thread is None:
            thread = ChatThread(
                external_id=conversation_id,
                title=title,
                is_group=bool(title and title != conversation_id),
            )
            session.add(thread)
            session.flush()
        elif title:
            thread.title = title
            thread.is_group = bool(title and title != conversation_id)
        return thread

    def find_assets_for_message(
        self,
        timestamp: datetime,
        media_ids: list[str],
        message_type: str,
        state: IndexedAssetState,
    ) -> list[IndexedAsset]:
        if media_ids:
            explicit_matches: list[IndexedAsset] = []
            seen_asset_ids: set[uuid.UUID] = set()
            for media_id in media_ids:
                match = state.chat_media_id_map.get(media_id)
                if match is None or match.asset.id in seen_asset_ids:
                    continue
                explicit_matches.append(match)
                seen_asset_ids.add(match.asset.id)
            if explicit_matches:
                for match in explicit_matches:
                    match.claimed = True
                return explicit_matches

        if message_type.upper() == "TEXT":
            return []

        matched_asset = self.find_precise_bucket_asset(
            state.chat_date_buckets,
            timestamp,
            max_delta_seconds=CHAT_MEDIA_MATCH_MAX_DELTA_SECONDS,
        )
        return [matched_asset] if matched_asset is not None else []

    def find_snap_history_asset(self, timestamp: datetime, state: IndexedAssetState) -> IndexedAsset | None:
        return self.find_precise_bucket_asset(
            state.chat_date_buckets,
            timestamp,
            max_delta_seconds=SNAP_MEDIA_MATCH_MAX_DELTA_SECONDS,
        )

    def find_bucket_asset(
        self,
        buckets: dict[str, list[IndexedAsset]],
        timestamp: datetime | None,
    ) -> IndexedAsset | None:
        if timestamp is None:
            return None
        bucket = buckets.get(timestamp.strftime("%Y-%m-%d"), [])
        for candidate in bucket:
            if candidate.claimed:
                continue
            candidate.claimed = True
            return candidate
        return None

    def find_precise_bucket_asset(
        self,
        buckets: dict[str, list[IndexedAsset]],
        timestamp: datetime | None,
        *,
        max_delta_seconds: int,
    ) -> IndexedAsset | None:
        if timestamp is None:
            return None

        bucket = buckets.get(timestamp.strftime("%Y-%m-%d"), [])
        candidates: list[tuple[float, IndexedAsset]] = []
        for candidate in bucket:
            if candidate.claimed or candidate.taken_at is None:
                continue
            if not self.has_precise_timestamp(candidate.taken_at):
                continue

            delta_seconds = abs((candidate.taken_at - timestamp).total_seconds())
            if delta_seconds > max_delta_seconds:
                continue
            candidates.append((delta_seconds, candidate))

        if not candidates:
            return None

        candidates.sort(key=lambda item: (item[0], item[1].taken_at or datetime.min.replace(tzinfo=UTC), str(item[1].asset.id)))
        if len(candidates) > 1 and candidates[0][0] == candidates[1][0]:
            return None

        matched = candidates[0][1]
        matched.claimed = True
        return matched

    @staticmethod
    def flatten_story_payload(payload: Any) -> list[dict[str, Any]]:
        if isinstance(payload, list):
            return [entry for entry in payload if isinstance(entry, dict)]
        if isinstance(payload, dict):
            items: list[dict[str, Any]] = []
            for value in payload.values():
                if isinstance(value, list):
                    items.extend(entry for entry in value if isinstance(entry, dict))
            return items
        return []

    def load_chat_payload(self, root_paths: list[Path]) -> dict[str, Any]:
        merged_payload: dict[str, Any] = {}
        for root_path in root_paths:
            chat_history_path = self.resolve_json_file(root_path, "chat_history.json")
            if chat_history_path and chat_history_path.exists():
                with chat_history_path.open("r", encoding="utf-8") as handle:
                    payload = json.load(handle)
            else:
                html_dir = root_path / "html" / "chat_history"
                payload = self.parse_html_directory(html_dir) if html_dir.exists() else {}

            merged_payload = self.merge_conversation_payload(merged_payload, payload)

        return merged_payload

    def load_merged_json_payload(
        self,
        root_paths: list[Path],
        filename: str,
        merge_function: Callable[[Any, Any], Any],
    ) -> Any:
        merged_payload: Any = None
        for root_path in root_paths:
            json_path = self.resolve_json_file(root_path, filename)
            if not json_path or not json_path.exists():
                continue
            with json_path.open("r", encoding="utf-8") as handle:
                payload = json.load(handle)
            merged_payload = payload if merged_payload is None else merge_function(merged_payload, payload)
        return merged_payload

    @staticmethod
    def resolve_json_file(root_path: Path, filename: str) -> Path | None:
        json_dir = root_path / "json"
        if (json_dir / filename).exists():
            return json_dir / filename
        if (root_path / filename).exists():
            return root_path / filename
        return None

    @staticmethod
    def parse_html_directory(html_dir: Path) -> dict[str, list[dict[str, Any]]]:
        chats: dict[str, list[dict[str, Any]]] = {}
        for html_file in html_dir.glob("*.html"):
            with html_file.open("r", encoding="utf-8") as handle:
                soup = BeautifulSoup(handle, "html.parser")
            title = soup.find("title")
            conversation_id = title.text.replace("Snapchat - ", "").strip() if title else html_file.stem
            messages: list[dict[str, Any]] = []
            for row in soup.find_all("tr"):
                columns = row.find_all("td")
                if len(columns) < 3:
                    continue
                messages.append(
                    {
                        "From": columns[0].text.strip(),
                        "Media Type": columns[1].text.strip(),
                        "Created": columns[2].text.strip().replace(" UTC", "") + " UTC",
                        "Content": columns[3].text.strip() if len(columns) > 3 else "",
                    }
                )
            if messages:
                chats[conversation_id] = messages
        return chats

    @staticmethod
    def parse_media_ids(raw_value: Any) -> list[str]:
        if not raw_value:
            return []
        if not isinstance(raw_value, str):
            raw_value = str(raw_value)
        return [token.strip() for token in re.split(r"[|,]", raw_value) if token.strip()]

    @staticmethod
    def parse_datetime(raw_value: Any) -> datetime | None:
        if raw_value is None:
            return None
        value = str(raw_value).replace(" UTC", "").strip()
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError:
            parsed = None
            for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
                try:
                    parsed = datetime.strptime(value, fmt)
                    break
                except ValueError:
                    continue
            if parsed is None:
                return None
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=UTC)
        return parsed

    @staticmethod
    def build_message_dedupe_key(
        conversation_id: str,
        sender: str,
        body: str,
        timestamp: datetime,
        source: ChatMessageSource,
        asset_ids: list[Any],
    ) -> str:
        payload = json.dumps(
            {
                "conversation_id": conversation_id,
                "sender": sender,
                "body": body,
                "timestamp": timestamp.isoformat(),
                "source": source.value,
                "asset_ids": [str(asset_id) for asset_id in sorted(asset_ids, key=str)],
            },
            sort_keys=True,
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    @staticmethod
    def normalize_media_stem(path: Path) -> str:
        name = path.stem
        for suffix in MEDIA_SUFFIXES:
            if name.endswith(suffix):
                return name[: -len(suffix)]
        return name

    @staticmethod
    def is_overlay_variant(path: Path) -> bool:
        return path.stem.endswith(("_overlay", "_caption"))

    @staticmethod
    def detect_media_type(path: Path) -> MediaType:
        suffix = path.suffix.lower()
        if suffix in VIDEO_EXTENSIONS:
            return MediaType.VIDEO
        if suffix == ".m4a":
            return MediaType.AUDIO
        return MediaType.IMAGE

    @staticmethod
    def extract_chat_media_id(stem_id: str) -> str | None:
        parts = stem_id.split("_", 1)
        if len(parts) != 2:
            return None
        date_part, media_id = parts
        if not MEDIA_ID_DATE_PATTERN.match(date_part):
            return None
        if not media_id.startswith("b~"):
            return None
        return media_id

    @staticmethod
    def prefer_media_candidate(candidate: Path, current: Path) -> bool:
        candidate_is_video = candidate.suffix.lower() in VIDEO_EXTENSIONS
        current_is_video = current.suffix.lower() in VIDEO_EXTENSIONS
        if candidate_is_video and not current_is_video:
            return True
        if not candidate_is_video and current_is_video:
            return False
        return IngestionService.media_rank(candidate) < IngestionService.media_rank(current)

    @staticmethod
    def media_rank(path: Path) -> int:
        stem = path.stem
        if stem.endswith("_video") or stem.endswith("_image"):
            return 0
        if stem.endswith("_main"):
            return 1
        if stem.endswith("_media"):
            return 2
        return 3

    @staticmethod
    def best_timestamp(path: Path) -> datetime | None:
        match = DATE_PATTERN.search(path.name)
        if not match:
            return None
        filename_date = datetime.strptime(match.group(1), "%Y-%m-%d").replace(tzinfo=UTC)
        try:
            stat_date = datetime.fromtimestamp(path.stat().st_mtime, tz=UTC)
            if stat_date.year == filename_date.year and stat_date.month == filename_date.month:
                return stat_date
        except OSError:
            return filename_date
        return filename_date

    @staticmethod
    def has_precise_timestamp(timestamp: datetime) -> bool:
        return any((timestamp.hour, timestamp.minute, timestamp.second, timestamp.microsecond))
