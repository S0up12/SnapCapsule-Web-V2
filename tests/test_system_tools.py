from __future__ import annotations

from contextlib import contextmanager
from types import SimpleNamespace

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
