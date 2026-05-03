"""AssociationService — 水平越权防线回归测试

Phase 4 Code Review Fix #2 — ``delete_association`` / ``get_associations`` 必须把
``user_id`` + ``app_name`` 作为 WHERE 条件下推；admin 旁路（None）维持旧行为。
此处只校验编译后的 SQL 是否带上 tenancy 谓词，不连真实 DB。
"""

from __future__ import annotations

from uuid import uuid4

from sqlalchemy.dialects import postgresql

import negentropy.db.session as db_session
from negentropy.engine.adapters.postgres.association_service import AssociationService


class _EmptyResult:
    def __init__(self) -> None:
        self.rowcount = 0

    def fetchall(self):
        return []

    def scalars(self):
        return self

    def all(self):
        return []


class _CaptureSession:
    """收集所有 execute 的语句，供编译断言。"""

    def __init__(self, seen: list[object]) -> None:
        self._seen = seen

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def execute(self, stmt, params=None):
        self._seen.append(stmt)
        return _EmptyResult()

    async def commit(self):
        return None


def _where_clauses(stmts: list[object]) -> list[str]:
    """提取每条语句的 WHERE 子句字符串，避免 SELECT 列表对断言的干扰。"""
    out: list[str] = []
    for s in stmts:
        compiled = str(s.compile(dialect=postgresql.dialect()))
        # 简单切分：取 ' WHERE ' 之后到首个 LIMIT/RETURNING/换行结束的范围
        idx = compiled.find("WHERE")
        if idx == -1:
            out.append("")
            continue
        out.append(compiled[idx:])
    return out


async def test_delete_association_pushes_tenant_filter(monkeypatch) -> None:
    seen: list[object] = []
    monkeypatch.setattr(db_session, "AsyncSessionLocal", lambda: _CaptureSession(seen))

    service = AssociationService()
    await service.delete_association(uuid4(), user_id="alice", app_name="app1")

    wheres = "\n".join(_where_clauses(seen))
    assert "memory_associations.user_id" in wheres
    assert "memory_associations.app_name" in wheres


async def test_delete_association_admin_bypass_no_tenant_filter(monkeypatch) -> None:
    seen: list[object] = []
    monkeypatch.setattr(db_session, "AsyncSessionLocal", lambda: _CaptureSession(seen))

    service = AssociationService()
    await service.delete_association(uuid4())  # 无 user_id/app_name，admin 调用语义

    wheres = "\n".join(_where_clauses(seen))
    assert "memory_associations.user_id" not in wheres
    assert "memory_associations.app_name" not in wheres


async def test_get_associations_pushes_tenant_filter(monkeypatch) -> None:
    seen: list[object] = []
    monkeypatch.setattr(db_session, "AsyncSessionLocal", lambda: _CaptureSession(seen))

    service = AssociationService()
    await service.get_associations(
        item_id=uuid4(),
        user_id="alice",
        app_name="app1",
    )

    wheres = "\n".join(_where_clauses(seen))
    # outgoing + incoming 两条 SELECT 都应带 tenant 谓词
    assert wheres.count("memory_associations.user_id") >= 2
    assert wheres.count("memory_associations.app_name") >= 2


async def test_get_associations_admin_bypass_no_tenant_filter(monkeypatch) -> None:
    seen: list[object] = []
    monkeypatch.setattr(db_session, "AsyncSessionLocal", lambda: _CaptureSession(seen))

    service = AssociationService()
    await service.get_associations(item_id=uuid4())

    wheres = "\n".join(_where_clauses(seen))
    assert "memory_associations.user_id" not in wheres
    assert "memory_associations.app_name" not in wheres
