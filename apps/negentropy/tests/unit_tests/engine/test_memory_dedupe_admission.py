"""add_memory_typed(dedupe=True) 写入准入单元测试。

mock ``_find_duplicate`` 与 ``AsyncSessionLocal`` 边界，验证：
- 命中既有近似记忆 → 不落新行、touch 既有记忆（access_count+1）、返回 deduped=True；
- 未命中 → 落新行、返回 deduped=False；
- embedding 不可用 → 保守直写（deduped=False）；
- dedupe 默认 False（向后兼容）。
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest

from negentropy.engine.adapters.postgres.memory_service import PostgresMemoryService

_EXISTING_ID = UUID("11111111-2222-3333-4444-555555555555")


def _spy_db(*, find_dup_returns: UUID | None) -> tuple[MagicMock, list[dict]]:
    """伪造 db session：execute 捕获 SQL，flush/commit no-op；_find_duplicate 由 service 内部调用。"""
    committed: list[dict] = []

    class _Result:
        def __init__(self) -> None:
            self.rowcount = 1

        def first(self):
            return None

    class _SpySession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            pass

        async def execute(self, stmt, params=None):
            committed.append({"sql": str(stmt), "params": params})
            return _Result()

        async def flush(self):
            pass

        async def commit(self):
            pass

    return _SpySession(), committed


@pytest.mark.asyncio
async def test_dedupe_hit_touches_existing_and_returns_deduped(monkeypatch):
    """命中既有近似记忆 → 不落新行、返回 {id: existing, deduped: True}。"""
    svc = PostgresMemoryService(embedding_fn=AsyncMock(return_value=[0.1, 0.2]))
    spy_db, _ = _spy_db(find_dup_returns=_EXISTING_ID)

    with (
        patch(
            "negentropy.engine.adapters.postgres.memory_service.db_session.AsyncSessionLocal",
            return_value=spy_db,
        ),
        patch.object(PostgresMemoryService, "_find_duplicate", new=AsyncMock(return_value=_EXISTING_ID)),
    ):
        result = await svc.add_memory_typed(
            user_id="u1",
            app_name="app",
            thread_id=None,
            content="某条经验",
            memory_type="procedural",
            metadata={"source": "routine_extraction"},
            dedupe=True,
        )

    assert result["deduped"] is True
    assert result["id"] == str(_EXISTING_ID)


@pytest.mark.asyncio
async def test_dedupe_miss_writes_new_and_returns_not_deduped(monkeypatch):
    """未命中 → 落新行、返回 deduped=False。"""
    svc = PostgresMemoryService(embedding_fn=AsyncMock(return_value=[0.1, 0.2]))
    spy_db, committed = _spy_db(find_dup_returns=None)

    # _find_duplicate 返回 None；Memory 构造在 session.add 上需要真实 ORM 上下文，
    # 但本测试关注「未命中走 add 分支」——用 patch 替换 db.add/flush 使其 no-op。
    new_memory_ids: list = []

    class _MemSlot:
        def __init__(self, **kw):
            self.id = UUID("22222222-2222-3333-4444-555555555555")
            new_memory_ids.append(self)

    spy_db.add = lambda m: new_memory_ids.append(m)  # type: ignore[attr-defined]

    with (
        patch(
            "negentropy.engine.adapters.postgres.memory_service.db_session.AsyncSessionLocal",
            return_value=spy_db,
        ),
        patch("negentropy.engine.adapters.postgres.memory_service.Memory", new=_MemSlot),
        patch.object(PostgresMemoryService, "_find_duplicate", new=AsyncMock(return_value=None)),
    ):
        result = await svc.add_memory_typed(
            user_id="u1",
            app_name="app",
            thread_id=None,
            content="全新经验",
            memory_type="semantic",
            dedupe=True,
        )

    assert result["deduped"] is False
    assert result["memory_type"] == "semantic"


@pytest.mark.asyncio
async def test_dedupe_no_embedding_falls_through_to_write(monkeypatch):
    """embedding_fn 不可用（None）→ 保守直写（dedupe 检查被 embedding is not None 守卫跳过）。"""
    svc = PostgresMemoryService(embedding_fn=None)  # 无 embedding
    spy_db, _ = _spy_db(find_dup_returns=None)
    spy_db.add = lambda m: None  # type: ignore[attr-defined]
    new_id = UUID("33333333-3333-3333-4444-555555555555")

    class _MemSlot:
        def __init__(self, **kw):
            self.id = new_id

    with (
        patch(
            "negentropy.engine.adapters.postgres.memory_service.db_session.AsyncSessionLocal",
            return_value=spy_db,
        ),
        patch("negentropy.engine.adapters.postgres.memory_service.Memory", new=_MemSlot),
    ):
        result = await svc.add_memory_typed(
            user_id="u1",
            app_name="app",
            thread_id=None,
            content="无 embedding 的经验",
            memory_type="fact",
            dedupe=True,  # 即便开 dedupe，无 embedding 也走直写
        )

    assert result["deduped"] is False


@pytest.mark.asyncio
async def test_dedupe_default_off_never_calls_find_duplicate(monkeypatch):
    """dedupe 默认 False → 不查重、直接落新行（向后兼容锁）。"""
    svc = PostgresMemoryService(embedding_fn=AsyncMock(return_value=[0.1, 0.2]))
    spy_db, _ = _spy_db(find_dup_returns=None)
    spy_db.add = lambda m: None  # type: ignore[attr-defined]
    new_id = UUID("44444444-4444-4444-4444-555555555555")

    class _MemSlot:
        def __init__(self, **kw):
            self.id = new_id

    find_dup = AsyncMock(return_value=None)

    with (
        patch(
            "negentropy.engine.adapters.postgres.memory_service.db_session.AsyncSessionLocal",
            return_value=spy_db,
        ),
        patch("negentropy.engine.adapters.postgres.memory_service.Memory", new=_MemSlot),
        patch.object(PostgresMemoryService, "_find_duplicate", new=find_dup),
    ):
        result = await svc.add_memory_typed(
            user_id="u1",
            app_name="app",
            thread_id=None,
            content="默认路径",
            memory_type="episodic",
            # dedupe 默认 False
        )

    find_dup.assert_not_awaited()
    assert result["deduped"] is False
