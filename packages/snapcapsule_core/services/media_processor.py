from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageOps

from snapcapsule_core.config import Settings, get_settings
from snapcapsule_core.models.enums import AssetSource, MediaType

VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".webm", ".mkv", ".m4v"}
THUMBNAIL_EXTENSION = ".webp"
LEGACY_THUMBNAIL_EXTENSIONS = (THUMBNAIL_EXTENSION, ".jpg")
PLAYBACK_EXTENSION = ".mp4"
BROWSER_SAFE_PLAYBACK_EXTENSIONS = {".mp4", ".m4v"}
BROWSER_SAFE_VIDEO_CODECS = {"h264"}
BROWSER_SAFE_AUDIO_CODECS = {"aac", "mp3"}


class MediaProcessor:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()

    def raw_destination_path(self, asset_id: str, source_type: AssetSource, suffix: str) -> Path:
        return Path(self.settings.raw_media_dir) / source_type.value / f"{asset_id}{suffix.lower()}"

    def overlay_destination_path(self, asset_id: str, source_type: AssetSource, suffix: str) -> Path:
        return Path(self.settings.raw_media_dir) / source_type.value / f"{asset_id}_overlay{suffix.lower()}"

    def thumbnail_destination_path(
        self,
        asset_id: str,
        *,
        include_overlay: bool = True,
        extension: str = THUMBNAIL_EXTENSION,
    ) -> Path:
        suffix = "" if include_overlay else "_plain"
        return Path(self.settings.thumbnail_dir) / f"{asset_id}{suffix}{extension}"

    def resolve_existing_thumbnail_path(self, asset_id: str, *, include_overlay: bool = True) -> Path | None:
        for extension in LEGACY_THUMBNAIL_EXTENSIONS:
            candidate = self.thumbnail_destination_path(asset_id, include_overlay=include_overlay, extension=extension)
            if candidate.exists() and candidate.is_file():
                return candidate
        return None

    def playback_destination_path(
        self,
        asset_id: str,
        *,
        extension: str = PLAYBACK_EXTENSION,
    ) -> Path:
        return Path(self.settings.thumbnail_dir) / "playback" / f"{asset_id}{extension}"

    def resolve_existing_playback_path(
        self,
        asset_id: str,
        *,
        extension: str = PLAYBACK_EXTENSION,
    ) -> Path | None:
        candidate = self.playback_destination_path(asset_id, extension=extension)
        if candidate.exists() and candidate.is_file():
            return candidate
        return None

    def store_media_file(
        self,
        source_path: str | Path,
        destination_path: str | Path,
        *,
        preserve_source: bool,
    ) -> Path:
        source = Path(source_path)
        destination = Path(destination_path)
        destination.parent.mkdir(parents=True, exist_ok=True)

        if destination.exists():
            destination.unlink()

        if preserve_source:
            shutil.copy2(source, destination)
        else:
            shutil.move(str(source), str(destination))

        return destination

    def generate_thumbnail(
        self,
        asset_id: str,
        media_path: str | Path,
        media_type: MediaType,
        overlay_path: str | Path | None = None,
        *,
        include_overlay: bool = True,
    ) -> Path | None:
        destination = self.thumbnail_destination_path(asset_id, include_overlay=include_overlay)
        destination.parent.mkdir(parents=True, exist_ok=True)
        active_overlay_path = overlay_path if include_overlay else None

        if media_type == MediaType.IMAGE:
            return self._generate_image_thumbnail(media_path, destination, active_overlay_path)
        if media_type == MediaType.VIDEO:
            return self._generate_video_thumbnail(media_path, destination, active_overlay_path)
        return None

    def ensure_browser_playback(
        self,
        asset_id: str,
        media_path: str | Path,
        media_type: MediaType,
    ) -> Path:
        source_path = Path(media_path)
        if media_type != MediaType.VIDEO:
            return source_path
        if not self.requires_browser_playback_transcode(source_path):
            return source_path

        existing = self.resolve_existing_playback_path(asset_id)
        if existing is not None:
            return existing

        return self.generate_browser_playback(asset_id, source_path)

    def requires_browser_playback_transcode(self, media_path: str | Path) -> bool:
        source_path = Path(media_path)
        if source_path.suffix.lower() not in BROWSER_SAFE_PLAYBACK_EXTENSIONS:
            return True

        stream_details = self._probe_stream_details(source_path)
        video_codecs = {
            str(stream.get("codec_name", "")).strip().lower()
            for stream in stream_details
            if str(stream.get("codec_type", "")).strip().lower() == "video" and stream.get("codec_name")
        }
        if not video_codecs or not video_codecs.issubset(BROWSER_SAFE_VIDEO_CODECS):
            return True

        audio_codecs = {
            str(stream.get("codec_name", "")).strip().lower()
            for stream in stream_details
            if str(stream.get("codec_type", "")).strip().lower() == "audio" and stream.get("codec_name")
        }
        if audio_codecs and not audio_codecs.issubset(BROWSER_SAFE_AUDIO_CODECS):
            return True

        return False

    def generate_browser_playback(self, asset_id: str, media_path: str | Path) -> Path:
        source_path = Path(media_path)
        destination = self.playback_destination_path(asset_id)
        destination.parent.mkdir(parents=True, exist_ok=True)

        with tempfile.TemporaryDirectory(prefix="snapcapsule-playback-") as temp_dir:
            temp_destination = Path(temp_dir) / destination.name
            command = [
                "ffmpeg",
                "-y",
                "-i",
                str(source_path),
                "-map",
                "0:v:0",
                "-map",
                "0:a:0?",
                "-c:v",
                "libx264",
                "-preset",
                "medium",
                "-crf",
                "23",
                "-pix_fmt",
                "yuv420p",
                "-movflags",
                "+faststart",
                "-c:a",
                "aac",
                "-b:a",
                "128k",
                str(temp_destination),
            ]
            subprocess.run(
                command,
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=300,
            )
            if destination.exists():
                destination.unlink()
            shutil.move(str(temp_destination), str(destination))

        return destination

    def detect_actual_media_type(self, media_path: str | Path, fallback: MediaType) -> MediaType:
        path = Path(media_path)
        if fallback == MediaType.AUDIO or path.suffix.lower() == ".m4a":
            return MediaType.AUDIO
        if fallback != MediaType.VIDEO:
            return fallback

        stream_types = self._probe_stream_types(path)
        if "video" in stream_types:
            return MediaType.VIDEO
        if "audio" in stream_types:
            return MediaType.AUDIO
        return fallback

    def compute_checksum(self, file_path: str | Path) -> str:
        digest = hashlib.sha256()
        with Path(file_path).open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()

    def _generate_image_thumbnail(
        self,
        media_path: str | Path,
        destination: Path,
        overlay_path: str | Path | None = None,
    ) -> Path:
        with Image.open(media_path) as image:
            image = self._compose_overlay(image, overlay_path)
            image.thumbnail((360, 360), Image.Resampling.LANCZOS)
            self._save_thumbnail_image(image, destination)

        return destination

    def _generate_video_thumbnail(
        self,
        media_path: str | Path,
        destination: Path,
        overlay_path: str | Path | None = None,
    ) -> Path:
        with tempfile.TemporaryDirectory(prefix="snapcapsule-thumb-") as temp_dir:
            frame_path = Path(temp_dir) / "frame.jpg"
            command = [
                "ffmpeg",
                "-y",
                "-ss",
                "00:00:00",
                "-i",
                str(media_path),
                "-frames:v",
                "1",
                "-vf",
                "scale=360:-1",
                str(frame_path),
            ]
            subprocess.run(
                command,
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=20,
            )
            with Image.open(frame_path) as frame:
                image = self._compose_overlay(frame, overlay_path)
                image.thumbnail((360, 360), Image.Resampling.LANCZOS)
                self._save_thumbnail_image(image, destination)
        return destination

    def _save_thumbnail_image(self, image: Image.Image, destination: Path) -> None:
        image.save(destination, format="WEBP", quality=72, method=6)

    def _compose_overlay(self, image: Image.Image, overlay_path: str | Path | None = None) -> Image.Image:
        image = ImageOps.exif_transpose(image)
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA" if "A" in image.getbands() else "RGB")

        if overlay_path and Path(overlay_path).exists():
            with Image.open(overlay_path) as overlay:
                overlay = ImageOps.exif_transpose(overlay).convert("RGBA")
                base = image.convert("RGBA")
                if overlay.size != base.size:
                    overlay = overlay.resize(base.size, Image.Resampling.LANCZOS)
                return Image.alpha_composite(base, overlay).convert("RGB")

        if image.mode != "RGB":
            return image.convert("RGB")
        return image

    def _probe_stream_types(self, media_path: str | Path) -> set[str]:
        streams = self._probe_stream_details(media_path)
        return {
            str(stream.get("codec_type", "")).strip().lower()
            for stream in streams
            if isinstance(stream, dict) and stream.get("codec_type")
        }

    def _probe_stream_details(self, media_path: str | Path) -> list[dict[str, object]]:
        command = [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "stream=codec_name,codec_type",
            "-of",
            "json",
            str(media_path),
        ]
        result = subprocess.run(
            command,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=20,
            text=True,
        )
        payload = json.loads(result.stdout or "{}")
        streams = payload.get("streams", [])
        return [stream for stream in streams if isinstance(stream, dict)]
