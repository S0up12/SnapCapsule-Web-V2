from __future__ import annotations

import os
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime
from urllib.parse import SplitResult, urlsplit, urlunsplit

import psycopg
import pytest
from psycopg import sql
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from snapcapsule_core.models import Asset, Base, MemoryCollection, MemoryItem
from snapcapsule_core.models.enums import AssetSource, MediaType


def _derive_test_database_url() -> str:
    explicit = os.getenv("SNAPCAPSULE_TEST_DATABASE_URL")
    if explicit:
        return explicit

    base = os.getenv("SNAPCAPSULE_DATABASE_URL", "postgresql+psycopg://snapcapsule:snapcapsule@db:5432/snapcapsule")
    parts = urlsplit(base)
    database_name = parts.path.rsplit("/", 1)[-1] or "snapcapsule"
    test_name = database_name if database_name.endswith("_test") else f"{database_name}_test"
    return urlunsplit(SplitResult(parts.scheme, parts.netloc, f"/{test_name}", parts.query, parts.fragment))


def _to_driver_url(url: str) -> str:
    return url.replace("+psycopg", "", 1)


def _with_database_name(url: str, database_name: str) -> str:
    parts = urlsplit(url)
    return urlunsplit(SplitResult(parts.scheme, parts.netloc, f"/{database_name}", parts.query, parts.fragment))


TEST_DATABASE_URL = _derive_test_database_url()


def _ensure_test_database_exists() -> None:
    admin_url = _with_database_name(_to_driver_url(TEST_DATABASE_URL), "postgres")
    database_name = urlsplit(TEST_DATABASE_URL).path.lstrip("/")

    with psycopg.connect(admin_url, autocommit=True) as connection:
        exists = connection.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s",
            (database_name,),
        ).fetchone()
        if exists is None:
            connection.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database_name)))


@pytest.fixture(scope="session")
def engine():
    _ensure_test_database_exists()
    engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    try:
        yield engine
    finally:
        Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture()
def db_session(engine) -> Iterator[Session]:
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, autoflush=False, autocommit=False, expire_on_commit=False)
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture()
def db_session_factory(engine):
    with engine.begin() as connection:
        for table in reversed(Base.metadata.sorted_tables):
            connection.execute(table.delete())

    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)

    @contextmanager
    def _session_scope() -> Iterator[Session]:
        session = SessionLocal()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    try:
        yield SessionLocal, _session_scope
    finally:
        with engine.begin() as connection:
            for table in reversed(Base.metadata.sorted_tables):
                connection.execute(table.delete())


@pytest.fixture()
def make_asset(db_session: Session):
    collection = MemoryCollection(title="Saved Media")
    db_session.add(collection)
    db_session.flush()

    counter = 0

    def _create(
        *,
        source_type: AssetSource = AssetSource.MEMORY,
        media_type: MediaType = MediaType.IMAGE,
        taken_at: datetime | None = None,
        is_favorite: bool = False,
        tags: list[str] | None = None,
        include_thumbnail: bool = True,
        include_original: bool = True,
    ) -> Asset:
        nonlocal counter
        counter += 1

        extension = {
            MediaType.IMAGE: "jpg",
            MediaType.VIDEO: "mp4",
            MediaType.AUDIO: "m4a",
        }[media_type]
        asset = Asset(
            source_type=source_type,
            media_type=media_type,
            original_path=f"/tmp/test-original-{counter}-{uuid.uuid4()}.{extension}" if include_original else "",
            thumbnail_path=f"/tmp/test-thumb-{counter}-{uuid.uuid4()}.jpg" if include_thumbnail else None,
            taken_at=taken_at,
            is_favorite=is_favorite,
            tags=list(tags or ()),
        )
        db_session.add(asset)
        db_session.flush()

        if source_type == AssetSource.MEMORY:
            db_session.add(
                MemoryItem(
                    collection_id=collection.id,
                    asset_id=asset.id,
                    taken_at=taken_at,
                    position=counter,
                )
            )
            db_session.flush()

        return asset

    return _create
