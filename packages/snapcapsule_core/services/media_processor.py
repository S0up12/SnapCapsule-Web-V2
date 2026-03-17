from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageOps

from snapcapsule_core.config import Settings, get_settings
from snapcapsule_core.models.enums import AssetSource, MediaType

VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".webm", ".mkv", ".m4v"}


class MediaProcessor:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()

    def raw_destination_path(self, asset_id: str, source_type: AssetSource, suffix: str) -> Path:
        return Path(self.settings.raw_media_dir) / source_type.value / f"{asset_id}{suffix.lower()}"

    def overlay_destination_path(self, asset_id: str, source_type: AssetSource, suffix: str) -> Path:
        return Path(self.settings.raw_media_dir) / source_type.value / f"{asset_id}_overlay{suffix.lower()}"

    def thumbnail_destination_path(self, asset_id: str) -> Path:
        return Path(self.settings.thumbnail_dir) / f"{asset_id}.jpg"

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
    ) -> Path | None:
        destination = self.thumbnail_destination_path(asset_id)
        destination.parent.mkdir(parents=True, exist_ok=True)

        if media_type == MediaType.IMAGE:
            return self._generate_image_thumbnail(media_path, destination, overlay_path)
        if media_type == MediaType.VIDEO:
            return self._generate_video_thumbnail(media_path, destination)
        return None

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
            image = ImageOps.exif_transpose(image)
            if image.mode not in ("RGB", "RGBA"):
                image = image.convert("RGBA" if "A" in image.getbands() else "RGB")

            if overlay_path and Path(overlay_path).exists():
                with Image.open(overlay_path) as overlay:
                    overlay = ImageOps.exif_transpose(overlay).convert("RGBA")
                    base = image.convert("RGBA")
                    if overlay.size != base.size:
                        overlay = overlay.resize(base.size, Image.Resampling.LANCZOS)
                    image = Image.alpha_composite(base, overlay).convert("RGB")
            elif image.mode != "RGB":
                image = image.convert("RGB")

            image.thumbnail((360, 360), Image.Resampling.LANCZOS)
            image.save(destination, format="JPEG", quality=60, optimize=True)

        return destination

    def _generate_video_thumbnail(self, media_path: str | Path, destination: Path) -> Path:
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
            "-q:v",
            "8",
            str(destination),
        ]
        subprocess.run(
            command,
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=20,
        )
        return destination

    def _probe_stream_types(self, media_path: str | Path) -> set[str]:
        command = [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "stream=codec_type",
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
        return {
            str(stream.get("codec_type", "")).strip().lower()
            for stream in streams
            if isinstance(stream, dict) and stream.get("codec_type")
        }
