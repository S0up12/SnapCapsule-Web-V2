from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    project_name: str = "SnapCapsule Web"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://snapcapsule:snapcapsule@db:5432/snapcapsule"
    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str | None = None
    celery_result_backend: str | None = None
    raw_media_dir: str = "/srv/snapcapsule/raw"
    thumbnail_dir: str = "/srv/snapcapsule/thumbnails"
    library_archives_dir: str | None = None
    ingest_cache_dir: str | None = None
    ingest_root_dir: str | None = None
    allowed_origins: str = "http://localhost:3000,http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="SNAPCAPSULE_",
        extra="ignore",
    )

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    @property
    def broker_url(self) -> str:
        return self.celery_broker_url or self.redis_url

    @property
    def result_backend(self) -> str:
        return self.celery_result_backend or self.redis_url

    @property
    def ingest_cache_root_dir(self) -> Path:
        if self.ingest_cache_dir:
            return Path(self.ingest_cache_dir)
        if self.ingest_root_dir:
            return Path(self.ingest_root_dir)
        return Path("/srv/snapcapsule/cache")

    @property
    def ingest_upload_dir(self) -> Path:
        return self.ingest_cache_root_dir / "uploads"

    @property
    def ingest_workspace_dir(self) -> Path:
        return self.ingest_cache_root_dir / "workspaces"

    @property
    def ingest_archive_dir(self) -> Path:
        if self.library_archives_dir:
            return Path(self.library_archives_dir)
        return self.ingest_cache_root_dir / "archives"

    @property
    def preferences_file_path(self) -> Path:
        return self.ingest_cache_root_dir / "user-preferences.json"

    @property
    def profile_snapshot_path(self) -> Path:
        return self.ingest_cache_root_dir / "profile-snapshot.json"

    def ensure_storage_dirs(self) -> None:
        Path(self.raw_media_dir).mkdir(parents=True, exist_ok=True)
        Path(self.thumbnail_dir).mkdir(parents=True, exist_ok=True)
        self.ingest_cache_root_dir.mkdir(parents=True, exist_ok=True)
        self.ingest_upload_dir.mkdir(parents=True, exist_ok=True)
        self.ingest_workspace_dir.mkdir(parents=True, exist_ok=True)
        self.ingest_archive_dir.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    return Settings()
