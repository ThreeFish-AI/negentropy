"""Integration：``negentropy seed-demo`` 幂等性 / reset / events 级联（需真实 pgvector）。

前置：tests/conftest.py 的会话级 autouse fixture 已创建 ``<db>_test`` 并 upgrade head，
故 schema 就绪。本测试经 ``AsyncSessionLocal``（已指向测试库）校验：
  - 首次写入：1 thread + 2 events + 1 memory + 1 fact（按 seed_marker 计）
  - 重复（reset=False）：幂等跳过，计数不变
  - reset=True：清除后重建，events 经 thread FK ondelete=CASCADE 级联
"""

from __future__ import annotations

import json

from sqlalchemy import text

from negentropy.cli_seed import _DEMO_MARKER, _seed_demo_with_reset
from negentropy.db import AsyncSessionLocal

_MARKER = json.dumps({"seed_marker": _DEMO_MARKER})


async def _count(session, table: str) -> int:
    # ``CAST(:m AS jsonb)`` 而非 ``:m::jsonb``：后者命名参数紧邻 ``::`` 会触发
    # asyncpg「syntax error at or near ":"」，与 cli_seed 保持一致。
    return (
        await session.execute(
            text(f"SELECT count(*) FROM negentropy.{table} WHERE metadata @> CAST(:m AS jsonb)"),
            {"m": _MARKER},
        )
    ).scalar()


async def _count_events(session) -> int:
    return (
        await session.execute(
            text(
                "SELECT count(*) FROM negentropy.events e "
                "JOIN negentropy.threads t ON e.thread_id = t.id "
                "WHERE t.metadata @> CAST(:m AS jsonb)"
            ),
            {"m": _MARKER},
        )
    ).scalar()


async def test_seed_demo_idempotent_reset_and_events():
    # 1) 首次写入（reset=True）
    await _seed_demo_with_reset("dev-user", reset=True)
    async with AsyncSessionLocal() as s:
        assert await _count(s, "threads") == 1
        assert await _count(s, "memories") == 1
        assert await _count(s, "facts") == 1
        assert await _count_events(s) == 2

    # 2) 重复（reset=False）→ 幂等跳过，计数不变
    await _seed_demo_with_reset("dev-user", reset=False)
    async with AsyncSessionLocal() as s:
        assert await _count(s, "threads") == 1
        assert await _count(s, "facts") == 1
        assert await _count_events(s) == 2

    # 3) reset=True → 清除后重建（仍是 1 thread / 2 events）
    await _seed_demo_with_reset("dev-user", reset=True)
    async with AsyncSessionLocal() as s:
        assert await _count(s, "threads") == 1
        assert await _count_events(s) == 2
