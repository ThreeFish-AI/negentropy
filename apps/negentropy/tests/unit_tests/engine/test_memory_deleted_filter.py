"""Memory search soft-delete filter regression tests."""

from __future__ import annotations

from sqlalchemy.dialects import postgresql

import negentropy.db.session as db_session
from negentropy.engine.adapters.postgres.memory_service import PostgresMemoryService


class _EmptyResult:
    def fetchall(self):
        return []

    def scalars(self):
        return self

    def all(self):
        return []


class _CaptureSession:
    def __init__(self, seen: list[object]) -> None:
        self._seen = seen

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def execute(self, stmt, params=None):
        self._seen.append(stmt)
        return _EmptyResult()


def _compile(stmt: object) -> str:
    return str(stmt.compile(dialect=postgresql.dialect()))


async def test_deleted_filter_is_present_in_search_paths(monkeypatch) -> None:
    seen: list[object] = []
    monkeypatch.setattr(db_session, "AsyncSessionLocal", lambda: _CaptureSession(seen))

    service = PostgresMemoryService()

    await service._hybrid_search_native(
        app_name="app",
        user_id="alice",
        query="hello",
        query_embedding=[0.1, 0.2, 0.3],
    )
    await service._keyword_search(app_name="app", user_id="alice", query="hello")
    await service._vector_search(app_name="app", user_id="alice", query_embedding=[0.1, 0.2, 0.3])
    await service._ilike_search(app_name="app", user_id="alice", query="hello")

    sql = "\n".join(_compile(stmt) for stmt in seen)

    assert "metadata->>'deleted'" in sql
    assert "metadata ->>" in sql
    assert "IS DISTINCT FROM" in sql
