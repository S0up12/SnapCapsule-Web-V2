from __future__ import annotations

import pytest
from snapcapsule_core import db


class _DummyConnection:
    def __init__(self) -> None:
        self.statements: list[object] = []

    def execute(self, statement: object) -> None:
        self.statements.append(statement)


class _DummyBegin:
    def __init__(self, connection: _DummyConnection) -> None:
        self._connection = connection

    def __enter__(self) -> _DummyConnection:
        return self._connection

    def __exit__(self, exc_type, exc, tb) -> None:
        return None


class _DummyEngine:
    def __init__(self, connection: _DummyConnection) -> None:
        self._connection = connection

    def begin(self) -> _DummyBegin:
        return _DummyBegin(self._connection)


def test_init_database_only_checks_connectivity_when_schema_is_present(monkeypatch):
    connection = _DummyConnection()

    class _Inspector:
        @staticmethod
        def has_table(name: str) -> bool:
            assert name == "alembic_version"
            return True

    monkeypatch.setattr(db, "engine", _DummyEngine(connection))
    monkeypatch.setattr(db, "inspect", lambda conn: _Inspector())

    db.init_database()

    assert len(connection.statements) == 1
    assert str(connection.statements[0]) == "SELECT 1"


def test_init_database_requires_explicit_migrations(monkeypatch):
    connection = _DummyConnection()

    class _Inspector:
        @staticmethod
        def has_table(name: str) -> bool:
            assert name == "alembic_version"
            return False

    monkeypatch.setattr(db, "engine", _DummyEngine(connection))
    monkeypatch.setattr(db, "inspect", lambda conn: _Inspector())

    with pytest.raises(RuntimeError, match="alembic upgrade head"):
        db.init_database()

    assert len(connection.statements) == 1
    assert str(connection.statements[0]) == "SELECT 1"
