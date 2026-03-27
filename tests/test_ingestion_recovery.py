from __future__ import annotations

import uuid
from pathlib import Path
from types import SimpleNamespace

from snapcapsule_core.models import IngestionJob
from snapcapsule_core.models.enums import IngestionJobStatus, IngestionSourceKind
from snapcapsule_core.tasks import ingestion as ingestion_tasks

from apps.worker.app import worker as worker_module


def test_resume_interrupted_ingestion_jobs_requeues_existing_sources_and_fails_missing_ones(
    db_session_factory,
    monkeypatch,
    tmp_path,
):
    SessionLocal, session_scope = db_session_factory
    recoverable_source = tmp_path / "recoverable-export"
    recoverable_source.mkdir()

    with session_scope() as session:
        recoverable_job = IngestionJob(
            id=uuid.uuid4(),
            source_kind=IngestionSourceKind.DIRECTORY,
            source_name="recoverable",
            source_path=str(recoverable_source),
            status=IngestionJobStatus.PARSING,
            detail_message="Parsing",
            progress_percent=35,
        )
        missing_job = IngestionJob(
            id=uuid.uuid4(),
            source_kind=IngestionSourceKind.DIRECTORY,
            source_name="missing",
            source_path=str(tmp_path / "missing-export"),
            status=IngestionJobStatus.PROCESSING_MEDIA,
            detail_message="Processing",
            progress_percent=80,
        )
        session.add_all([recoverable_job, missing_job])

    queued_job_ids: list[str] = []

    def fake_delay(job_id: str):
        queued_job_ids.append(job_id)
        return SimpleNamespace(id=f"celery-{job_id}")

    monkeypatch.setattr(worker_module, "session_scope", session_scope)
    monkeypatch.setattr(worker_module.extract_and_parse, "delay", fake_delay)

    worker_module.resume_interrupted_ingestion_jobs()

    assert queued_job_ids == [str(recoverable_job.id)]

    with session_scope() as session:
        refreshed_recoverable = session.get(IngestionJob, recoverable_job.id)
        refreshed_missing = session.get(IngestionJob, missing_job.id)

        assert refreshed_recoverable.status == IngestionJobStatus.QUEUED
        assert refreshed_recoverable.detail_message == "Recovered after worker restart"
        assert refreshed_recoverable.progress_percent == 0
        assert refreshed_recoverable.celery_task_id == f"celery-{recoverable_job.id}"

        assert refreshed_missing.status == IngestionJobStatus.FAILED
        assert refreshed_missing.error_message == "The uploaded archive bundle or source directory is no longer available."
        assert refreshed_missing.progress_percent == 100


def test_extract_and_parse_ignores_duplicate_active_task_without_running_ingestion(
    db_session_factory,
    monkeypatch,
):
    SessionLocal, session_scope = db_session_factory
    job_id = uuid.uuid4()

    with session_scope() as session:
        session.add(
            IngestionJob(
                id=job_id,
                source_kind=IngestionSourceKind.DIRECTORY,
                source_name="duplicate-guard",
                source_path=str(Path("/tmp")),
                status=IngestionJobStatus.QUEUED,
                celery_task_id="existing-task-id",
                detail_message="Queued",
                progress_percent=0,
            )
        )

    class GuardedIngestionService:
        def __init__(self, settings):
            self.settings = settings

        def prepare_source(self, job):
            raise AssertionError("prepare_source should not run for duplicate tasks")

    monkeypatch.setattr(ingestion_tasks, "session_scope", session_scope)
    monkeypatch.setattr(ingestion_tasks, "IngestionService", GuardedIngestionService)
    monkeypatch.setattr(ingestion_tasks, "get_settings", lambda: SimpleNamespace())

    result = ingestion_tasks.extract_and_parse.apply(args=[str(job_id)], task_id="new-task-id").get()

    assert result == {"job_id": str(job_id), "status": "ignored"}

    with session_scope() as session:
        refreshed_job = session.get(IngestionJob, job_id)
        assert refreshed_job.celery_task_id == "existing-task-id"
        assert refreshed_job.status == IngestionJobStatus.QUEUED
