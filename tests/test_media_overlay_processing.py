from __future__ import annotations

import uuid
from pathlib import Path
from types import SimpleNamespace

from PIL import Image, ImageChops

from apps.api.app.api.routes import assets as asset_routes
from snapcapsule_core.config import Settings
from snapcapsule_core.models.enums import MediaType
from snapcapsule_core.services.media_processor import MediaProcessor


def _make_settings(tmp_path: Path) -> Settings:
    return Settings(
        raw_media_dir=str(tmp_path / "raw"),
        thumbnail_dir=str(tmp_path / "thumbnails"),
        ingest_root_dir=str(tmp_path / "ingest"),
    )


def _save_image(path: Path, color: tuple[int, int, int] | tuple[int, int, int, int], size: tuple[int, int], *, mode: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.new(mode, size, color).save(path)


def _assert_images_differ(left_path: Path, right_path: Path) -> None:
    with Image.open(left_path) as left, Image.open(right_path) as right:
        difference = ImageChops.difference(left.convert("RGB"), right.convert("RGB"))
        assert difference.getbbox() is not None


def test_generate_image_thumbnail_respects_overlay_toggle(tmp_path: Path):
    settings = _make_settings(tmp_path)
    processor = MediaProcessor(settings)

    media_path = tmp_path / "source" / "memory.jpg"
    overlay_path = tmp_path / "source" / "memory_overlay.png"
    _save_image(media_path, (0, 0, 255), (120, 80), mode="RGB")
    _save_image(overlay_path, (255, 0, 0, 128), (60, 40), mode="RGBA")

    composited_thumbnail = processor.generate_thumbnail(
        "with-overlay",
        media_path,
        MediaType.IMAGE,
        overlay_path,
        include_overlay=True,
    )
    plain_thumbnail = processor.generate_thumbnail(
        "without-overlay",
        media_path,
        MediaType.IMAGE,
        overlay_path,
        include_overlay=False,
    )

    assert composited_thumbnail is not None
    assert plain_thumbnail is not None
    assert composited_thumbnail.exists()
    assert plain_thumbnail.exists()
    _assert_images_differ(composited_thumbnail, plain_thumbnail)


def test_generate_video_thumbnail_composites_overlay_on_extracted_frame(tmp_path: Path, monkeypatch):
    settings = _make_settings(tmp_path)
    processor = MediaProcessor(settings)
    video_path = tmp_path / "source" / "memory.mp4"
    overlay_path = tmp_path / "source" / "memory_overlay.png"
    video_path.parent.mkdir(parents=True, exist_ok=True)
    video_path.write_bytes(b"fake-video")
    _save_image(overlay_path, (255, 0, 0, 128), (80, 60), mode="RGBA")

    ffmpeg_calls: list[list[str]] = []

    def fake_run(command: list[str], **_: object):
        ffmpeg_calls.append(command)
        destination = Path(command[-1])
        if destination.name == "frame.jpg":
            _save_image(destination, (0, 0, 255), (160, 120), mode="RGB")
        elif destination.suffix.lower() == ".jpg":
            _save_image(destination, (0, 0, 255), (160, 120), mode="RGB")
        return SimpleNamespace(returncode=0)

    monkeypatch.setattr("snapcapsule_core.services.media_processor.subprocess.run", fake_run)

    thumbnail_path = processor.generate_thumbnail(
        "video-overlay",
        video_path,
        MediaType.VIDEO,
        overlay_path,
        include_overlay=True,
    )
    plain_thumbnail_path = processor.generate_thumbnail(
        "video-plain",
        video_path,
        MediaType.VIDEO,
        overlay_path,
        include_overlay=False,
    )

    assert thumbnail_path is not None
    assert plain_thumbnail_path is not None
    assert thumbnail_path.exists()
    assert plain_thumbnail_path.exists()
    assert any(Path(call[-1]).name == "frame.jpg" for call in ffmpeg_calls)
    assert any("scale=360:-1" in call for command in ffmpeg_calls for call in command)
    _assert_images_differ(thumbnail_path, plain_thumbnail_path)


def test_resolve_thumbnail_path_generates_plain_thumbnail_when_overlay_disabled(tmp_path: Path, monkeypatch):
    settings = _make_settings(tmp_path)
    processor = MediaProcessor(settings)
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

    asset = SimpleNamespace(
        id=asset_id,
        media_type=MediaType.IMAGE,
        original_path=str(media_path),
        overlay_path=str(overlay_path),
        thumbnail_path=str(overlay_thumbnail),
    )

    monkeypatch.setattr(asset_routes, "MediaProcessor", lambda: processor)

    plain_thumbnail = asset_routes._resolve_thumbnail_path(asset, include_overlay=False)

    assert plain_thumbnail.name.endswith("_plain.jpg")
    assert plain_thumbnail.exists()
    _assert_images_differ(Path(asset.thumbnail_path), plain_thumbnail)
