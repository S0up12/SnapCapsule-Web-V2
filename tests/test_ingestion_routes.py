from __future__ import annotations

import hashlib
import uuid
from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient
from snapcapsule_core.models import Asset, IngestionJob
from snapcapsule_core.models.enums import AssetSource, IngestionJobStatus, IngestionSourceKind, MediaType

from apps.api.app.api.routes import ingestion as ingestion_routes


def _build_ingestion_app(SessionLocal, session_scope, monkeypatch) -> TestClient:
    monkeypatch.setattr(ingestion_routes, "session_scope", session_scope)
    app = FastAPI()
    app.include_router(ingestion_routes.router)
    return TestClient(app)


def test_list_recent_ingestion_jobs_returns_newest_first(db_session_factory, monkeypatch, tmp_path):
    SessionLocal, session_scope = db_session_factory
    with session_scope() as session:
        older = IngestionJob(
            id=uuid.uuid4(),
            source_kind=IngestionSourceKind.DIRECTORY,
            source_name="older",
            source_path=str(tmp_path / "older"),
            status=IngestionJobStatus.COMPLETED,
            detail_message="Done",
            progress_percent=100,
            created_at=datetime(2026, 3, 19, 12, 0, tzinfo=UTC),
        )
        newer = IngestionJob(
            id=uuid.uuid4(),
            source_kind=IngestionSourceKind.DIRECTORY,
            source_name="newer",
            source_path=str(tmp_path / "newer"),
            status=IngestionJobStatus.FAILED,
            detail_message="Failed",
            progress_percent=100,
            error_message="Boom",
            created_at=datetime(2026, 3, 20, 12, 0, tzinfo=UTC),
        )
        session.add_all([older, newer])

    client = _build_ingestion_app(SessionLocal, session_scope, monkeypatch)

    response = client.get("/api/ingest/recent")

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 2
    assert payload["items"][0]["source_name"] == "newer"
    assert payload["items"][1]["source_name"] == "older"
    assert payload["items"][0]["raw_metadata"] is None


def test_retry_ingestion_job_creates_new_job_and_dispatches_task(db_session_factory, monkeypatch, tmp_path):
    SessionLocal, session_scope = db_session_factory
    source_dir = tmp_path / "export"
    source_dir.mkdir()

    with session_scope() as session:
        original = IngestionJob(
            id=uuid.uuid4(),
            source_kind=IngestionSourceKind.DIRECTORY,
            source_name="export",
            source_path=str(source_dir),
            status=IngestionJobStatus.FAILED,
            detail_message="Failed",
            progress_percent=100,
            error_message="Some error",
            raw_metadata={"archive_count": 2},
        )
        session.add(original)
        original_id = original.id

    queued_job_ids: list[str] = []

    def fake_delay(job_id: str):
        queued_job_ids.append(job_id)
        return SimpleNamespace(id=f"celery-{job_id}")

    monkeypatch.setattr(ingestion_routes.extract_and_parse, "delay", fake_delay)
    client = _build_ingestion_app(SessionLocal, session_scope, monkeypatch)

    response = client.post(f"/api/ingest/{original_id}/retry")

    assert response.status_code == 200
    payload = response.json()
    assert payload["job_id"] != str(original_id)
    assert queued_job_ids == [payload["job_id"]]

    with session_scope() as session:
        jobs = session.query(IngestionJob).order_by(IngestionJob.created_at.asc(), IngestionJob.id.asc()).all()
        assert len(jobs) == 2
        retried_job = jobs[-1]
        assert retried_job.source_path == str(source_dir)
        assert retried_job.status == IngestionJobStatus.QUEUED
        assert retried_job.celery_task_id == f"celery-{retried_job.id}"
        assert retried_job.raw_metadata == {"archive_count": 2}


def test_retry_ingestion_job_rejects_active_job(db_session_factory, monkeypatch, tmp_path):
    SessionLocal, session_scope = db_session_factory
    source_dir = tmp_path / "export"
    source_dir.mkdir()

    with session_scope() as session:
        active_job = IngestionJob(
            id=uuid.uuid4(),
            source_kind=IngestionSourceKind.DIRECTORY,
            source_name="export",
            source_path=str(source_dir),
            status=IngestionJobStatus.PARSING,
            detail_message="Parsing",
            progress_percent=20,
        )
        session.add(active_job)
        active_job_id = active_job.id

    client = _build_ingestion_app(SessionLocal, session_scope, monkeypatch)

    response = client.post(f"/api/ingest/{active_job_id}/retry")

    assert response.status_code == 409
    assert response.json()["detail"] == "This ingestion job is still active."


def test_retry_upload_ingestion_job_reuses_existing_workspace_path(db_session_factory, monkeypatch, tmp_path):
    SessionLocal, session_scope = db_session_factory
    source_dir = tmp_path / "upload-bundle"
    source_dir.mkdir()
    workspace_dir = tmp_path / "workspace-existing"
    workspace_dir.mkdir()

    with session_scope() as session:
        original = IngestionJob(
            id=uuid.uuid4(),
            source_kind=IngestionSourceKind.UPLOAD,
            source_name="bundle",
            source_path=str(source_dir),
            workspace_path=str(workspace_dir),
            status=IngestionJobStatus.FAILED,
            detail_message="Failed",
            progress_percent=100,
            raw_metadata={"uploaded_filenames": ["part1.zip"], "events": [{"at": datetime.now(UTC).isoformat(), "message": "Started"}]},
        )
        session.add(original)
        original_id = original.id

    queued_job_ids: list[str] = []

    def fake_delay(job_id: str):
        queued_job_ids.append(job_id)
        return SimpleNamespace(id=f"celery-{job_id}")

    monkeypatch.setattr(ingestion_routes.extract_and_parse, "delay", fake_delay)
    client = _build_ingestion_app(SessionLocal, session_scope, monkeypatch)

    response = client.post(f"/api/ingest/{original_id}/retry")

    assert response.status_code == 200
    payload = response.json()
    assert queued_job_ids == [payload["job_id"]]

    with session_scope() as session:
        jobs = session.query(IngestionJob).order_by(IngestionJob.created_at.asc(), IngestionJob.id.asc()).all()
        retried_job = jobs[-1]
        assert retried_job.source_kind == IngestionSourceKind.UPLOAD
        assert retried_job.workspace_path == str(workspace_dir)
        assert retried_job.raw_metadata is not None
        assert retried_job.raw_metadata["uploaded_filenames"] == ["part1.zip"]
        assert retried_job.raw_metadata["events"][0]["message"] == "Started"


def test_cancel_ingestion_job_marks_terminal_progress_complete(db_session_factory, monkeypatch, tmp_path):
    SessionLocal, session_scope = db_session_factory
    source_dir = tmp_path / "export"
    source_dir.mkdir()

    with session_scope() as session:
        active_job = IngestionJob(
            id=uuid.uuid4(),
            source_kind=IngestionSourceKind.DIRECTORY,
            source_name="export",
            source_path=str(source_dir),
            status=IngestionJobStatus.EXTRACTING,
            celery_task_id="task-123",
            detail_message="Extracting",
            progress_percent=10,
        )
        session.add(active_job)
        active_job_id = active_job.id

    revoked: list[tuple[str, bool]] = []

    def fake_revoke(task_id: str, terminate: bool = False):
        revoked.append((task_id, terminate))

    monkeypatch.setattr(ingestion_routes.celery_app.control, "revoke", fake_revoke)
    client = _build_ingestion_app(SessionLocal, session_scope, monkeypatch)

    response = client.post("/api/ingest/cancel", json={"job_id": str(active_job_id)})

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "canceled"
    assert payload["progress_percent"] == 100
    assert revoked == [("task-123", True)]


def test_start_ingestion_reuses_stable_upload_bundle_path_for_identical_uploads(db_session_factory, monkeypatch, tmp_path):
    SessionLocal, session_scope = db_session_factory
    upload_dir = tmp_path / "uploads"
    workspace_dir = tmp_path / "workspaces"
    upload_dir.mkdir()
    workspace_dir.mkdir()

    monkeypatch.setattr(
        ingestion_routes,
        "settings",
        SimpleNamespace(
            ingest_upload_dir=upload_dir,
            ingest_workspace_dir=workspace_dir,
        ),
    )

    queued_job_ids: list[str] = []

    def fake_delay(job_id: str):
        queued_job_ids.append(job_id)
        return SimpleNamespace(id=f"celery-{job_id}")

    monkeypatch.setattr(ingestion_routes.extract_and_parse, "delay", fake_delay)
    client = _build_ingestion_app(SessionLocal, session_scope, monkeypatch)

    first_response = client.post(
        "/api/ingest",
        files={"archives": ("part1.zip", BytesIO(b"same-zip-batch"), "application/zip")},
    )
    second_response = client.post(
        "/api/ingest",
        files={"archives": ("part1.zip", BytesIO(b"same-zip-batch"), "application/zip")},
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert second_response.json()["job_id"] == first_response.json()["job_id"]

    with session_scope() as session:
        jobs = session.query(IngestionJob).order_by(IngestionJob.created_at.asc(), IngestionJob.id.asc()).all()
        assert len(jobs) == 1
        first_job = jobs[0]
        assert Path(first_job.source_path).parent == upload_dir
        assert Path(first_job.workspace_path or "").parent == workspace_dir
        assert first_job.raw_metadata is not None
        assert first_job.raw_metadata["bundle_fingerprint"] == Path(first_job.source_path).name
        assert len(first_job.raw_metadata["archive_checksums"]) == 1


def test_start_ingestion_reuses_existing_completed_upload_batch(db_session_factory, monkeypatch, tmp_path):
    SessionLocal, session_scope = db_session_factory
    upload_dir = tmp_path / "uploads"
    workspace_dir = tmp_path / "workspaces"
    upload_dir.mkdir()
    workspace_dir.mkdir()

    monkeypatch.setattr(
        ingestion_routes,
        "settings",
        SimpleNamespace(
            ingest_upload_dir=upload_dir,
            ingest_workspace_dir=workspace_dir,
        ),
    )

    archive_checksum = hashlib.sha256(b"same-zip-batch").hexdigest()
    bundle_fingerprint = ingestion_routes._bundle_fingerprint(
        [
            {
                "name": "part1.zip",
                "stored_name": "001-part1.zip",
                "size_bytes": len(b"same-zip-batch"),
                "checksum_sha256": archive_checksum,
            }
        ]
    )

    with session_scope() as session:
        session.add(
            IngestionJob(
                id=uuid.uuid4(),
                source_kind=IngestionSourceKind.UPLOAD,
                source_name="part1.zip",
                source_path=str(upload_dir / bundle_fingerprint),
                workspace_path=str(workspace_dir / bundle_fingerprint),
                status=IngestionJobStatus.COMPLETED,
                detail_message="Ingestion completed",
                progress_percent=100,
                raw_metadata={
                    "bundle_fingerprint": bundle_fingerprint,
                    "uploaded_filenames": ["part1.zip"],
                    "archive_checksums": [archive_checksum],
                },
            )
        )

    queued_job_ids: list[str] = []

    def fake_delay(job_id: str):
        queued_job_ids.append(job_id)
        return SimpleNamespace(id=f"celery-{job_id}")

    monkeypatch.setattr(ingestion_routes.extract_and_parse, "delay", fake_delay)
    client = _build_ingestion_app(SessionLocal, session_scope, monkeypatch)

    response = client.post(
        "/api/ingest",
        files={"archives": ("part1.zip", BytesIO(b"same-zip-batch"), "application/zip")},
    )

    assert response.status_code == 200
    assert response.json()["status"] == IngestionJobStatus.COMPLETED.value
    assert queued_job_ids == []

    with session_scope() as session:
        assert session.query(IngestionJob).count() == 1


def test_start_ingestion_ignores_already_imported_zip_files_inside_mixed_upload(db_session_factory, monkeypatch, tmp_path):
    SessionLocal, session_scope = db_session_factory
    upload_dir = tmp_path / "uploads"
    workspace_dir = tmp_path / "workspaces"
    upload_dir.mkdir()
    workspace_dir.mkdir()

    monkeypatch.setattr(
        ingestion_routes,
        "settings",
        SimpleNamespace(
            ingest_upload_dir=upload_dir,
            ingest_workspace_dir=workspace_dir,
        ),
    )

    existing_checksum = hashlib.sha256(b"existing-zip").hexdigest()
    with session_scope() as session:
        session.add(
            IngestionJob(
                id=uuid.uuid4(),
                source_kind=IngestionSourceKind.UPLOAD,
                source_name="existing.zip",
                source_path=str(upload_dir / "existing-bundle"),
                workspace_path=str(workspace_dir / "existing-bundle"),
                status=IngestionJobStatus.COMPLETED,
                detail_message="Ingestion completed",
                progress_percent=100,
                raw_metadata={
                    "bundle_fingerprint": "existing-bundle",
                    "uploaded_filenames": ["existing.zip"],
                    "archive_checksums": [existing_checksum],
                },
            )
        )

    queued_job_ids: list[str] = []

    def fake_delay(job_id: str):
        queued_job_ids.append(job_id)
        return SimpleNamespace(id=f"celery-{job_id}")

    monkeypatch.setattr(ingestion_routes.extract_and_parse, "delay", fake_delay)
    client = _build_ingestion_app(SessionLocal, session_scope, monkeypatch)

    response = client.post(
        "/api/ingest",
        files=[
            ("archives", ("existing.zip", BytesIO(b"existing-zip"), "application/zip")),
            ("archives", ("new.zip", BytesIO(b"new-zip"), "application/zip")),
        ],
    )

    assert response.status_code == 200
    assert queued_job_ids == [response.json()["job_id"]]

    with session_scope() as session:
        jobs = session.query(IngestionJob).order_by(IngestionJob.created_at.asc(), IngestionJob.id.asc()).all()
        assert len(jobs) == 2
        new_job = jobs[-1]
        assert new_job.raw_metadata is not None
        assert new_job.raw_metadata["uploaded_filenames"] == ["new.zip"]
        assert new_job.raw_metadata["skipped_duplicate_archives"] == ["existing.zip"]
        assert len(new_job.raw_metadata["archive_checksums"]) == 1


def test_failed_ingestion_item_routes_expose_files_and_acknowledgement(db_session_factory, monkeypatch, tmp_path):
    SessionLocal, session_scope = db_session_factory
    raw_media_dir = tmp_path / "raw"
    thumbnail_dir = tmp_path / "thumbs"
    raw_media_dir.mkdir()
    thumbnail_dir.mkdir()
    source_file = tmp_path / "broken.mp4"
    source_file.write_bytes(b"broken-video")

    monkeypatch.setattr(
        ingestion_routes,
        "settings",
        SimpleNamespace(
            raw_media_dir=str(raw_media_dir),
            thumbnail_dir=str(thumbnail_dir),
            ingest_upload_dir=tmp_path / "uploads",
            ingest_workspace_dir=tmp_path / "workspaces",
        ),
    )

    with session_scope() as session:
        job = IngestionJob(
            id=uuid.uuid4(),
            source_kind=IngestionSourceKind.UPLOAD,
            source_name="bundle",
            source_path=str(tmp_path / "bundle"),
            status=IngestionJobStatus.FAILED,
            detail_message="Completed with issues",
            progress_percent=100,
            total_assets=10,
            processed_assets=9,
            failed_assets=1,
            error_message="ffprobe exited 1",
        )
        session.add(job)
        session.flush()

        asset = Asset(
            id=uuid.uuid4(),
            source_type=AssetSource.MEMORY,
            media_type=MediaType.VIDEO,
            original_path=str(source_file),
            raw_metadata={
                "job_id": str(job.id),
                "processing": "failed_probe",
                "processing_error": "ffprobe exited 1",
                "source_path": str(source_file),
            },
        )
        session.add(asset)
        job_id = job.id
        asset_id = asset.id

    client = _build_ingestion_app(SessionLocal, session_scope, monkeypatch)

    failed_items_response = client.get(f"/api/ingest/{job_id}/failed-items")

    assert failed_items_response.status_code == 200
    failed_items_payload = failed_items_response.json()
    assert failed_items_payload["total"] == 1
    assert failed_items_payload["items"][0]["asset_id"] == str(asset_id)
    assert failed_items_payload["items"][0]["filename"] == "broken.mp4"
    assert failed_items_payload["items"][0]["available_path"] == str(source_file)

    file_response = client.get(f"/api/ingest/{job_id}/failed-items/{asset_id}/file")

    assert file_response.status_code == 200
    assert file_response.content == b"broken-video"

    acknowledge_response = client.post(f"/api/ingest/{job_id}/acknowledge-issues")

    assert acknowledge_response.status_code == 200
    assert acknowledge_response.json()["raw_metadata"]["issues_reviewed"] is True


def test_clear_ingestion_history_removes_only_terminal_jobs(db_session_factory, monkeypatch, tmp_path):
    SessionLocal, session_scope = db_session_factory

    with session_scope() as session:
        completed_job = IngestionJob(
            id=uuid.uuid4(),
            source_kind=IngestionSourceKind.DIRECTORY,
            source_name="completed",
            source_path=str(tmp_path / "completed"),
            status=IngestionJobStatus.COMPLETED,
            detail_message="Done",
            progress_percent=100,
        )
        failed_job = IngestionJob(
            id=uuid.uuid4(),
            source_kind=IngestionSourceKind.DIRECTORY,
            source_name="failed",
            source_path=str(tmp_path / "failed"),
            status=IngestionJobStatus.FAILED,
            detail_message="Failed",
            progress_percent=100,
        )
        active_job = IngestionJob(
            id=uuid.uuid4(),
            source_kind=IngestionSourceKind.DIRECTORY,
            source_name="active",
            source_path=str(tmp_path / "active"),
            status=IngestionJobStatus.PROCESSING_MEDIA,
            detail_message="Processing",
            progress_percent=55,
        )
        session.add_all([completed_job, failed_job, active_job])
        active_job_id = active_job.id

    client = _build_ingestion_app(SessionLocal, session_scope, monkeypatch)

    response = client.delete("/api/ingest/history")

    assert response.status_code == 200
    payload = response.json()
    assert payload["affected_items"] == 2

    with session_scope() as session:
        jobs = session.query(IngestionJob).order_by(IngestionJob.created_at.asc(), IngestionJob.id.asc()).all()
        assert len(jobs) == 1
        assert jobs[0].id == active_job_id
