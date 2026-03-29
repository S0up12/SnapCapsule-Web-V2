from __future__ import annotations

from contextlib import contextmanager
from types import SimpleNamespace

from snapcapsule_core.models.enums import MediaType
from snapcapsule_core.services import system_tools


def test_reset_archive_data_clears_profile_snapshot_but_keeps_preferences(monkeypatch, tmp_path):
    raw_media_dir = tmp_path / "raw"
    thumbnail_dir = tmp_path / "thumbs"
    upload_dir = tmp_path / "uploads"
    workspace_dir = tmp_path / "workspaces"
    ingest_root_dir = tmp_path / "ingest"
    for directory in (raw_media_dir, thumbnail_dir, upload_dir, workspace_dir, ingest_root_dir):
        directory.mkdir(parents=True, exist_ok=True)

    (raw_media_dir / "stale.jpg").write_text("raw", encoding="utf-8")
    (thumbnail_dir / "stale-thumb.jpg").write_text("thumb", encoding="utf-8")
    (upload_dir / "bundle.zip").write_text("upload", encoding="utf-8")
    (workspace_dir / "workspace.tmp").write_text("workspace", encoding="utf-8")

    preferences_path = ingest_root_dir / "user-preferences.json"
    snapshot_path = ingest_root_dir / "profile-snapshot.json"
    preferences_path.write_text('{"dark_mode": true}', encoding="utf-8")
    snapshot_path.write_text('{"account": {"username": "sammy"}}', encoding="utf-8")

    drop_calls: list[object] = []
    create_calls: list[object] = []
    monkeypatch.setattr(system_tools.Base.metadata, "drop_all", lambda bind: drop_calls.append(bind))
    monkeypatch.setattr(system_tools.Base.metadata, "create_all", lambda bind: create_calls.append(bind))
    settings = SimpleNamespace(
        raw_media_dir=str(raw_media_dir),
        thumbnail_dir=str(thumbnail_dir),
        ingest_upload_dir=upload_dir,
        ingest_workspace_dir=workspace_dir,
        profile_snapshot_path=snapshot_path,
    )

    result = system_tools.reset_archive_data(settings)

    assert result.status == "ok"
    assert not snapshot_path.exists()
    assert preferences_path.exists()
    assert list(raw_media_dir.iterdir()) == []
    assert list(thumbnail_dir.iterdir()) == []
    assert list(upload_dir.iterdir()) == []
    assert list(workspace_dir.iterdir()) == []
    assert len(drop_calls) == 1
    assert len(create_calls) == 1


def test_queue_thumbnail_rebuild_queues_background_task(monkeypatch, tmp_path):
    queued = []
    
    class FakeQuery:
        def filter(self, *_args, **_kwargs):
            return self

        def count(self):
            return 1

    @contextmanager
    def fake_session_scope():
        yield SimpleNamespace(query=lambda _model: FakeQuery())

    monkeypatch.setattr(system_tools, "session_scope", fake_session_scope)
    monkeypatch.setattr(system_tools.rebuild_thumbnail_cache, "delay", lambda: queued.append("queued"))
    settings = SimpleNamespace(
        thumbnail_dir=str(tmp_path / "thumbs"),
    )

    result = system_tools.queue_thumbnail_rebuild(settings)

    assert result.status == "accepted"
    assert result.affected_items == 1
    assert queued == ["queued"]


def test_queue_thumbnail_rebuild_returns_ok_when_no_assets(monkeypatch, tmp_path):
    queued = []

    class FakeQuery:
        def filter(self, *_args, **_kwargs):
            return self

        def count(self):
            return 0

    @contextmanager
    def fake_session_scope():
        yield SimpleNamespace(query=lambda _model: FakeQuery())

    monkeypatch.setattr(system_tools, "session_scope", fake_session_scope)
    monkeypatch.setattr(system_tools.rebuild_thumbnail_cache, "delay", lambda: queued.append("queued"))
    settings = SimpleNamespace(
        thumbnail_dir=str(tmp_path / "thumbs"),
    )

    result = system_tools.queue_thumbnail_rebuild(settings)

    assert result.status == "ok"
    assert result.affected_items == 0
    assert queued == []


def test_queue_playback_rebuild_queues_background_task(monkeypatch, tmp_path):
    queued = []

    class FakeQuery:
        def filter(self, *_args, **_kwargs):
            return self

        def count(self):
            return 2

    @contextmanager
    def fake_session_scope():
        yield SimpleNamespace(query=lambda _model: FakeQuery())

    monkeypatch.setattr(system_tools, "session_scope", fake_session_scope)
    monkeypatch.setattr(system_tools.rebuild_playback_cache, "delay", lambda: queued.append("queued"))
    settings = SimpleNamespace(
        thumbnail_dir=str(tmp_path / "thumbs"),
    )

    result = system_tools.queue_playback_rebuild(settings)

    assert result.status == "accepted"
    assert result.affected_items == 2
    assert queued == ["queued"]


def test_clean_playback_cache_removes_orphans(monkeypatch, tmp_path):
    playback_root = tmp_path / "thumbs" / "playback"
    playback_root.mkdir(parents=True, exist_ok=True)
    (playback_root / "keep.mp4").write_text("keep", encoding="utf-8")
    (playback_root / "remove.mp4").write_text("remove", encoding="utf-8")

    @contextmanager
    def fake_session_scope():
        query = SimpleNamespace(
            filter=lambda *_args, **_kwargs: SimpleNamespace(all=lambda: [("keep",)]),
        )
        yield SimpleNamespace(query=lambda _model: query)

    monkeypatch.setattr(system_tools, "session_scope", fake_session_scope)
    settings = SimpleNamespace(
        thumbnail_dir=str(tmp_path / "thumbs"),
    )

    result = system_tools.clean_playback_cache(settings)

    assert result.status == "ok"
    assert result.affected_items == 1
    assert (playback_root / "keep.mp4").exists()
    assert not (playback_root / "remove.mp4").exists()


def test_get_library_diagnostics_reports_storage_and_missing_files(monkeypatch, tmp_path):
    raw_media_dir = tmp_path / "raw"
    thumbnail_dir = tmp_path / "thumbs"
    workspace_dir = tmp_path / "workspaces"
    upload_dir = tmp_path / "uploads"
    playback_dir = thumbnail_dir / "playback"
    for directory in (raw_media_dir, thumbnail_dir, workspace_dir, upload_dir, playback_dir):
        directory.mkdir(parents=True, exist_ok=True)

    original_file = raw_media_dir / "asset-1.jpg"
    original_file.write_text("raw", encoding="utf-8")
    thumbnail_file = thumbnail_dir / "asset-1.webp"
    thumbnail_file.write_text("thumb", encoding="utf-8")
    (playback_dir / "asset-2.mp4").write_text("playback", encoding="utf-8")
    (playback_dir / "orphan.mp4").write_text("orphan", encoding="utf-8")
    (workspace_dir / "workspace.tmp").write_text("workspace", encoding="utf-8")
    (upload_dir / "archive.zip").write_text("upload", encoding="utf-8")

    assets = [
        SimpleNamespace(
            id="asset-1",
            media_type=MediaType.IMAGE,
            original_path=str(original_file),
            thumbnail_path=str(thumbnail_file),
            overlay_path=None,
            raw_metadata=None,
        ),
        SimpleNamespace(
            id="asset-2",
            media_type=MediaType.VIDEO,
            original_path=str(raw_media_dir / "missing.mp4"),
            thumbnail_path=str(thumbnail_dir / "missing.webp"),
            overlay_path=str(raw_media_dir / "missing-overlay.png"),
            raw_metadata={"playback_error": "codec failure"},
        ),
    ]

    @contextmanager
    def fake_session_scope():
        yield SimpleNamespace(query=lambda _model: SimpleNamespace(all=lambda: assets))

    monkeypatch.setattr(system_tools, "session_scope", fake_session_scope)
    settings = SimpleNamespace(
        raw_media_dir=str(raw_media_dir),
        thumbnail_dir=str(thumbnail_dir),
        ingest_workspace_dir=workspace_dir,
        ingest_upload_dir=upload_dir,
    )

    diagnostics = system_tools.get_library_diagnostics(settings)

    assert diagnostics.integrity.total_assets == 2
    assert diagnostics.integrity.video_assets == 1
    assert diagnostics.integrity.playback_derivatives == 2
    assert diagnostics.integrity.orphaned_playback_files == 1
    assert diagnostics.integrity.missing_original_files == 1
    assert diagnostics.integrity.missing_thumbnail_files == 1
    assert diagnostics.integrity.missing_overlay_files == 1
    assert diagnostics.integrity.playback_error_assets == 1
    assert diagnostics.storage.total_bytes > 0
