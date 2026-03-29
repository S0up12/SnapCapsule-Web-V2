from functools import lru_cache
from pathlib import Path, PurePosixPath
from urllib.parse import SplitResult, urlsplit, urlunsplit

from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_ROOT = PROJECT_ROOT / "data"


class Settings(BaseSettings):
    project_name: str = "SnapCapsule Web"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://snapcapsule:snapcapsule@127.0.0.1:5432/snapcapsule"
    redis_url: str = "redis://127.0.0.1:6379/0"
    celery_broker_url: str | None = None
    celery_result_backend: str | None = None
    raw_media_dir: str = str(DATA_ROOT / "raw")
    thumbnail_dir: str = str(DATA_ROOT / "thumbnails")
    ingest_root_dir: str = str(DATA_ROOT / "ingest")
    allowed_origins: str = "http://localhost:3000,http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        env_prefix="SNAPCAPSULE_",
        extra="ignore",
    )

    def model_post_init(self, __context: object) -> None:
        if _is_running_in_container():
            return

        self.database_url = _replace_container_hostname(self.database_url, "db", "127.0.0.1")
        self.redis_url = _replace_container_hostname(self.redis_url, "redis", "127.0.0.1")

        if self.celery_broker_url:
            self.celery_broker_url = _replace_container_hostname(self.celery_broker_url, "redis", "127.0.0.1")
        if self.celery_result_backend:
            self.celery_result_backend = _replace_container_hostname(self.celery_result_backend, "redis", "127.0.0.1")

        self.raw_media_dir = _replace_container_storage_path(self.raw_media_dir, "raw")
        self.thumbnail_dir = _replace_container_storage_path(self.thumbnail_dir, "thumbnails")
        self.ingest_root_dir = _replace_container_storage_path(self.ingest_root_dir, "ingest")

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
    def ingest_upload_dir(self) -> Path:
        return Path(self.ingest_root_dir) / "uploads"

    @property
    def ingest_workspace_dir(self) -> Path:
        return Path(self.ingest_root_dir) / "workspaces"

    @property
    def ingest_archive_dir(self) -> Path:
        return Path(self.ingest_root_dir) / "archives"

    @property
    def preferences_file_path(self) -> Path:
        return Path(self.ingest_root_dir) / "user-preferences.json"

    @property
    def profile_snapshot_path(self) -> Path:
        return Path(self.ingest_root_dir) / "profile-snapshot.json"

    def ensure_storage_dirs(self) -> None:
        Path(self.raw_media_dir).mkdir(parents=True, exist_ok=True)
        Path(self.thumbnail_dir).mkdir(parents=True, exist_ok=True)
        Path(self.ingest_root_dir).mkdir(parents=True, exist_ok=True)
        self.ingest_upload_dir.mkdir(parents=True, exist_ok=True)
        self.ingest_workspace_dir.mkdir(parents=True, exist_ok=True)
        self.ingest_archive_dir.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    return Settings()


def _is_running_in_container() -> bool:
    return Path("/.dockerenv").exists()


def _replace_container_hostname(url: str, source_host: str, target_host: str) -> str:
    parts = urlsplit(url)
    if parts.hostname != source_host:
        return url

    auth = ""
    if parts.username:
        auth = parts.username
        if parts.password is not None:
            auth = f"{auth}:{parts.password}"
        auth = f"{auth}@"

    port = f":{parts.port}" if parts.port is not None else ""
    netloc = f"{auth}{target_host}{port}"
    return urlunsplit(SplitResult(parts.scheme, netloc, parts.path, parts.query, parts.fragment))


def _replace_container_storage_path(path_value: str, relative_dir: str) -> str:
    container_root = PurePosixPath("/srv/snapcapsule")
    pure_path = PurePosixPath(path_value)
    try:
        suffix = pure_path.relative_to(container_root)
    except ValueError:
        return path_value

    if suffix.parts != (relative_dir,):
        return path_value

    return str(DATA_ROOT / relative_dir)
