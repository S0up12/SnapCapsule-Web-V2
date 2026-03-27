from __future__ import annotations

import uuid
from pathlib import Path
from types import SimpleNamespace

from PIL import Image
from snapcapsule_core.config import Settings
from snapcapsule_core.models.enums import MediaType
from snapcapsule_core.services.media_processor import MediaProcessor
from snapcapsule_core.services.thumbnail_repairs import (
    find_missing_plain_thumbnail_candidates,
    find_thumbnail_rebuild_candidates,
    generate_missing_plain_thumbnails,
    rebuild_thumbnail_files,
)


def _make_settings(tmp_path: Path) -> Settings:
    return Settings(
        raw_media_dir=str(tmp_path / "raw"),
        thumbnail_dir=str(tmp_path / "thumbnails"),
        ingest_root_dir=str(tmp_path / "ingest"),
    )


def _save_image(path: Path, color: tuple[int, int, int] | tuple[int, int, int, int], size: tuple[int, int], *, mode: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.new(mode, size, color).save(path)


def test_find_missing_plain_thumbnail_candidates_skips_assets_with_existing_plain_thumbnail(tmp_path: Path):
    processor = MediaProcessor(_make_settings(tmp_path))
    asset_id = uuid.uuid4()
    media_path = tmp_path / "source" / "memory.jpg"
    overlay_path = tmp_path / "source" / "memory_overlay.png"
    _save_image(media_path, (0, 0, 255), (120, 80), mode="RGB")
    _save_image(overlay_path, (255, 0, 0, 128), (60, 40), mode="RGBA")

    overlay_thumbnail = processor.generate_thumbnail(
        str(asset_id),
        media_path,
        MediaType.IMAGE,
        overlay_path,
        include_overlay=True,
    )
    processor.generate_thumbnail(
        str(asset_id),
        media_path,
        MediaType.IMAGE,
        overlay_path,
        include_overlay=False,
    )

    asset = SimpleNamespace(
        id=asset_id,
        media_type=MediaType.IMAGE,
        original_path=str(media_path),
        overlay_path=str(overlay_path),
        thumbnail_path=str(overlay_thumbnail),
    )

    candidates, stats = find_missing_plain_thumbnail_candidates([asset], processor=processor)

    assert candidates == []
    assert stats == {
        "eligible_assets": 1,
        "already_present": 1,
        "candidates": 0,
    }


def test_generate_missing_plain_thumbnails_creates_plain_variant(tmp_path: Path):
    processor = MediaProcessor(_make_settings(tmp_path))
    asset_id = uuid.uuid4()
    media_path = tmp_path / "source" / "memory.jpg"
    overlay_path = tmp_path / "source" / "memory_overlay.png"
    _save_image(media_path, (0, 0, 255), (120, 80), mode="RGB")
    _save_image(overlay_path, (255, 0, 0, 128), (60, 40), mode="RGBA")

    asset = SimpleNamespace(
        id=asset_id,
        media_type=MediaType.IMAGE,
        original_path=str(media_path),
        overlay_path=str(overlay_path),
        thumbnail_path=str(tmp_path / "thumbnails" / f"{asset_id}.jpg"),
    )

    candidates, stats = find_missing_plain_thumbnail_candidates([asset], processor=processor)
    result = generate_missing_plain_thumbnails(candidates, processor=processor, apply_changes=True)

    assert stats == {
        "eligible_assets": 1,
        "already_present": 0,
        "candidates": 1,
    }
    assert result == {
        "ready_to_generate": 1,
        "generated": 1,
        "missing_original": 0,
        "failed": 0,
    }
    assert processor.thumbnail_destination_path(str(asset_id), include_overlay=False).exists()


def test_find_missing_plain_thumbnail_candidates_treats_legacy_jpeg_as_present(tmp_path: Path):
    processor = MediaProcessor(_make_settings(tmp_path))
    asset_id = uuid.uuid4()
    media_path = tmp_path / "source" / "memory.jpg"
    overlay_path = tmp_path / "source" / "memory_overlay.png"
    _save_image(media_path, (0, 0, 255), (120, 80), mode="RGB")
    _save_image(overlay_path, (255, 0, 0, 128), (60, 40), mode="RGBA")

    legacy_plain_path = processor.thumbnail_destination_path(str(asset_id), include_overlay=False, extension=".jpg")
    _save_image(legacy_plain_path, (0, 0, 255), (120, 80), mode="RGB")

    asset = SimpleNamespace(
        id=asset_id,
        media_type=MediaType.IMAGE,
        original_path=str(media_path),
        overlay_path=str(overlay_path),
        thumbnail_path=str(tmp_path / "thumbnails" / f"{asset_id}.jpg"),
    )

    candidates, stats = find_missing_plain_thumbnail_candidates([asset], processor=processor)

    assert candidates == []
    assert stats == {
        "eligible_assets": 1,
        "already_present": 1,
        "candidates": 0,
    }


def test_rebuild_thumbnail_files_regenerates_overlay_and_plain_variants(tmp_path: Path):
    processor = MediaProcessor(_make_settings(tmp_path))
    asset_id = uuid.uuid4()
    media_path = tmp_path / "source" / "memory.jpg"
    overlay_path = tmp_path / "source" / "memory_overlay.png"
    _save_image(media_path, (0, 0, 255), (120, 80), mode="RGB")
    _save_image(overlay_path, (255, 0, 0, 128), (60, 40), mode="RGBA")

    asset = SimpleNamespace(
        id=asset_id,
        media_type=MediaType.IMAGE,
        original_path=str(media_path),
        overlay_path=str(overlay_path),
        thumbnail_path=None,
    )

    candidates = find_thumbnail_rebuild_candidates([asset])
    result = rebuild_thumbnail_files(candidates, processor=processor, apply_changes=True)

    assert result == {
        "ready_to_rebuild": 1,
        "rebuilt": 1,
        "missing_original": 0,
        "failed": 0,
    }
    assert processor.thumbnail_destination_path(str(asset_id), include_overlay=True).exists()
    assert processor.thumbnail_destination_path(str(asset_id), include_overlay=False).exists()
