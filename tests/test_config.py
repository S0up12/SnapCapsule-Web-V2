from pathlib import Path

from snapcapsule_core.config import Settings


def test_settings_normalize_container_defaults_for_host(monkeypatch):
    monkeypatch.setattr("snapcapsule_core.config._is_running_in_container", lambda: False)

    settings = Settings(
        database_url="postgresql+psycopg://snapcapsule:snapcapsule@db:5432/snapcapsule",
        redis_url="redis://redis:6379/0",
        raw_media_dir="/srv/snapcapsule/raw",
        thumbnail_dir="/srv/snapcapsule/thumbnails",
        ingest_root_dir="/srv/snapcapsule/ingest",
    )

    assert settings.database_url == "postgresql+psycopg://snapcapsule:snapcapsule@127.0.0.1:5432/snapcapsule"
    assert settings.redis_url == "redis://127.0.0.1:6379/0"
    assert Path(settings.raw_media_dir).name == "raw"
    assert Path(settings.thumbnail_dir).name == "thumbnails"
    assert Path(settings.ingest_root_dir).name == "ingest"


def test_settings_keep_container_defaults_inside_container(monkeypatch):
    monkeypatch.setattr("snapcapsule_core.config._is_running_in_container", lambda: True)

    settings = Settings(
        database_url="postgresql+psycopg://snapcapsule:snapcapsule@db:5432/snapcapsule",
        redis_url="redis://redis:6379/0",
        raw_media_dir="/srv/snapcapsule/raw",
    )

    assert settings.database_url.endswith("@db:5432/snapcapsule")
    assert settings.redis_url == "redis://redis:6379/0"
    assert settings.raw_media_dir == "/srv/snapcapsule/raw"
