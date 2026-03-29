from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

from snapcapsule_core.config import Settings
from snapcapsule_core.models.enums import MediaType
from snapcapsule_core.services.media_processor import MediaProcessor


def _make_settings(tmp_path: Path) -> Settings:
    return Settings(
        raw_media_dir=str(tmp_path / "raw"),
        thumbnail_dir=str(tmp_path / "thumbnails"),
        ingest_root_dir=str(tmp_path / "ingest"),
    )


def test_ensure_browser_playback_reuses_browser_safe_h264_mp4(tmp_path: Path, monkeypatch):
    settings = _make_settings(tmp_path)
    processor = MediaProcessor(settings)
    media_path = tmp_path / "source" / "clip.mp4"
    media_path.parent.mkdir(parents=True, exist_ok=True)
    media_path.write_bytes(b"original-video")

    ffmpeg_calls: list[list[str]] = []

    def fake_run(command: list[str], **_: object):
        if command[0] == "ffprobe":
            return SimpleNamespace(
                returncode=0,
                stdout=json.dumps(
                    {
                        "streams": [
                            {"codec_type": "video", "codec_name": "h264"},
                            {"codec_type": "audio", "codec_name": "aac"},
                        ]
                    }
                ),
            )
        ffmpeg_calls.append(command)
        return SimpleNamespace(returncode=0, stdout="")

    monkeypatch.setattr("snapcapsule_core.services.media_processor.subprocess.run", fake_run)

    playback_path = processor.ensure_browser_playback("safe-video", media_path, MediaType.VIDEO)

    assert playback_path == media_path
    assert ffmpeg_calls == []


def test_ensure_browser_playback_transcodes_hevc_video_once_and_caches_result(tmp_path: Path, monkeypatch):
    settings = _make_settings(tmp_path)
    processor = MediaProcessor(settings)
    media_path = tmp_path / "source" / "clip.mp4"
    media_path.parent.mkdir(parents=True, exist_ok=True)
    media_path.write_bytes(b"original-video")

    ffmpeg_calls: list[list[str]] = []

    def fake_run(command: list[str], **_: object):
        if command[0] == "ffprobe":
            return SimpleNamespace(
                returncode=0,
                stdout=json.dumps(
                    {
                        "streams": [
                            {"codec_type": "video", "codec_name": "hevc"},
                            {"codec_type": "audio", "codec_name": "aac"},
                        ]
                    }
                ),
            )

        ffmpeg_calls.append(command)
        destination = Path(command[-1])
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(b"transcoded-video")
        return SimpleNamespace(returncode=0, stdout="")

    monkeypatch.setattr("snapcapsule_core.services.media_processor.subprocess.run", fake_run)

    first_playback_path = processor.ensure_browser_playback("hevc-video", media_path, MediaType.VIDEO)
    second_playback_path = processor.ensure_browser_playback("hevc-video", media_path, MediaType.VIDEO)

    assert first_playback_path == second_playback_path
    assert first_playback_path.name == "hevc-video.mp4"
    assert first_playback_path.parent.name == "playback"
    assert first_playback_path.exists()
    assert first_playback_path.read_bytes() == b"transcoded-video"
    assert len(ffmpeg_calls) == 1
