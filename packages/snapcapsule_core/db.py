from collections.abc import Generator
from contextlib import contextmanager

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, sessionmaker

from snapcapsule_core.config import get_settings
from snapcapsule_core.models import Base

settings = get_settings()

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def init_database() -> None:
    Base.metadata.create_all(bind=engine)
    with engine.begin() as connection:
        inspector = inspect(connection)
        columns = {column["name"] for column in inspector.get_columns("assets")}

        if "is_favorite" not in columns:
            connection.execute(text("ALTER TABLE assets ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT FALSE"))
        if "tags" not in columns:
            connection.execute(text("ALTER TABLE assets ADD COLUMN tags JSON NOT NULL DEFAULT '[]'::json"))

        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_assets_is_favorite ON assets (is_favorite)"))


def get_db_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
