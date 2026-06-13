"""Integration：``negentropy seed-demo`` 幂等性 / reset / events 级联（需真实 pgvector）。

前置：tests/conftest.py 的会话级 autouse fixture 已创建 ``<db>_test`` 并 upgrade head，
故 schema 就绪。本测试经 ``AsyncSessionLocal``（已指向测试库）校验：
  - 首次写入：1 thread + 2 events + 1 memory + 1 fact
  - 重复（reset=False）：幂等跳过，计数不变
  - reset=True：清除后重建，events 经 thread FK ondelete=CASCADE 级联

锚点约定：demo 行仅在 ``threads.metadata`` 携带 seed_marker（``facts`` 表无 metadata 列），
故子行（memories/facts/events）一律经 ``thread_id`` JOIN demo thread 统计，绝不谓词其 metadata。
"""

from __future__ import annotations

import json

from sqlalchemy import text

import negentropy.db.session as db_session
from negentropy.cli_seed import _DEMO_MARKER, _seed_demo_with_reset

_MARKER = json.dumps({"seed_marker": _DEMO_MARKER})


async def _count_threads(session) -> int:
    # threads.metadata 为 demo 锚点
    return (
        await session.execute(
            text("SELECT count(*) FROM negentropy.threads WHERE metadata @> CAST(:m AS jsonb)"),
            {"m": _MARKER},
        )
    ).scalar()


async def _count_via_thread(session, table: str) -> int:
    """子行（memories/facts/events）经 thread_id JOIN demo thread 统计。"""
    return (
        await session.execute(
            text(
                f"SELECT count(*) FROM negentropy.{table} c "
                "JOIN negentropy.threads t ON c.thread_id = t.id "
                "WHERE t.metadata @> CAST(:m AS jsonb)"
            ),
            {"m": _MARKER},
        )
    ).scalar()


async def test_seed_demo_idempotent_reset_and_events():
    # 1) 首次写入（reset=True）
    await _seed_demo_with_reset("dev-user", reset=True)
    async with db_session.AsyncSessionLocal() as s:
        assert await _count_threads(s) == 1
        assert await _count_via_thread(s, "events") == 2
        assert await _count_via_thread(s, "memories") == 1
        assert await _count_via_thread(s, "facts") == 1

    # 2) 重复（reset=False）→ 幂等跳过，计数不变
    await _seed_demo_with_reset("dev-user", reset=False)
    async with db_session.AsyncSessionLocal() as s:
        assert await _count_threads(s) == 1
        assert await _count_via_thread(s, "events") == 2
        assert await _count_via_thread(s, "facts") == 1

    # 3) reset=True → 清除后重建（仍是 1 thread / 2 events / 1 fact）
    await _seed_demo_with_reset("dev-user", reset=True)
    async with db_session.AsyncSessionLocal() as s:
        assert await _count_threads(s) == 1
        assert await _count_via_thread(s, "events") == 2
        assert await _count_via_thread(s, "facts") == 1
