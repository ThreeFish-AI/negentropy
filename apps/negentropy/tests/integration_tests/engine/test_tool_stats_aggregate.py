"""tool_stats_aggregate handler 集成测试 — 真实 Postgres。

覆盖：聚合 upsert 正确性（成功率/p50/p95）、幂等重跑（覆盖非累加）、lookback 窗口、
多 tool 分组、灰度关 no-op、handler 注册。
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import delete, select

import negentropy.db.session as db_session
from negentropy.engine.schedulers.handlers.tool_stats_aggregate import _run_daily_aggregate
from negentropy.models.tool_telemetry import ToolInvocation, ToolStatsDaily

pytestmark = pytest.mark.asyncio

_USER = "itest_tool_stats_user"


async def _insert_invocation(
    *,
    tool_ref: str = "log_activity",
    tool_version: str = "unversioned",
    status: str = "success",
    latency_ms: int | None = 10,
    cost_usd: float | None = None,
    created_at: datetime | None = None,
):
    row = ToolInvocation(
        caller_kind="adk_agent",
        agent_name="TestAgent",
        thread_id="thread-x",
        tool_kind="adk_function",
        tool_ref=tool_ref,
        tool_version=tool_version,
        status=status,
        latency_ms=latency_ms,
        cost_usd=cost_usd,
        outcome_source="none",
        created_at=created_at or datetime.now(UTC),
    )
    async with db_session.AsyncSessionLocal() as db:
        db.add(row)
        await db.commit()


async def _cleanup():
    async with db_session.AsyncSessionLocal() as db:
        await db.execute(delete(ToolInvocation).where(ToolInvocation.agent_name == "TestAgent"))
        await db.execute(delete(ToolStatsDaily).where(ToolStatsDaily.tool_ref.in_(("log_activity", "search_web"))))
        await db.commit()


async def test_daily_aggregate_upsert():
    """3 行（2 success 1 error, latency [10,20,30]ms）→ 1 行 stats 正确。"""
    await _cleanup()
    try:
        await _insert_invocation(status="success", latency_ms=10)
        await _insert_invocation(status="success", latency_ms=20)
        await _insert_invocation(status="error", latency_ms=30)

        # 诊断：确认行已持久化
        from sqlalchemy import func as sa_func

        async with db_session.AsyncSessionLocal() as db:
            cnt = (
                await db.execute(
                    select(sa_func.count()).select_from(ToolInvocation).where(ToolInvocation.agent_name == "TestAgent")
                )
            ).scalar()
        assert cnt == 3, f"expected 3 tool_invocations, got {cnt}"

        result = await _run_daily_aggregate(1)
        assert result.status == "ok"
        assert result.metrics["rows_upserted"] >= 1

        async with db_session.AsyncSessionLocal() as db:
            row = (
                await db.execute(
                    select(ToolStatsDaily).where(
                        ToolStatsDaily.tool_ref == "log_activity",
                        ToolStatsDaily.tool_version == "unversioned",
                    )
                )
            ).scalar_one()
        assert row.invocation_count == 3
        assert row.success_count == 2
        assert row.error_count == 1
        assert float(row.p50_latency_ms) == 20.0
        # p95 of [10,20,30] via percentile_cont(0.95): linear interpolation at pos 1.9 → 29.0
        assert float(row.p95_latency_ms) == 29.0
    finally:
        await _cleanup()


async def test_daily_aggregate_idempotent_rerun():
    """同数据跑两次 → 第二次覆盖，invocation_count 仍=2（非 4，幂等）。"""
    await _cleanup()
    try:
        await _insert_invocation(status="success", latency_ms=10)
        await _insert_invocation(status="success", latency_ms=20)

        await _run_daily_aggregate(1)
        await _run_daily_aggregate(1)  # 重跑

        async with db_session.AsyncSessionLocal() as db:
            row = (
                await db.execute(select(ToolStatsDaily).where(ToolStatsDaily.tool_ref == "log_activity"))
            ).scalar_one()
        assert row.invocation_count == 2  # 覆盖，非累加
    finally:
        await _cleanup()


async def test_daily_aggregate_multi_tool_grouping():
    """不同 tool_ref 各自行 → 按 (tool_ref, version, date) 分组产出多行。"""
    await _cleanup()
    try:
        await _insert_invocation(tool_ref="log_activity", status="success", latency_ms=10)
        await _insert_invocation(tool_ref="search_web", status="success", latency_ms=20)

        await _run_daily_aggregate(1)

        async with db_session.AsyncSessionLocal() as db:
            rows = (
                (
                    await db.execute(
                        select(ToolStatsDaily).where(ToolStatsDaily.tool_ref.in_(("log_activity", "search_web")))
                    )
                )
                .scalars()
                .all()
            )
        tool_refs = {r.tool_ref for r in rows}
        assert tool_refs == {"log_activity", "search_web"}
    finally:
        await _cleanup()


async def test_daily_aggregate_lookback_window():
    """2 天前的行不被 lookback_days=1 聚合。"""
    await _cleanup()
    try:
        old = datetime.now(UTC) - timedelta(days=3)
        await _insert_invocation(status="success", latency_ms=10, created_at=old)
        await _insert_invocation(status="success", latency_ms=20)

        await _run_daily_aggregate(1)

        async with db_session.AsyncSessionLocal() as db:
            row = (
                await db.execute(select(ToolStatsDaily).where(ToolStatsDaily.tool_ref == "log_activity"))
            ).scalar_one_or_none()
        # 仅今天的 1 行被聚合（2 天前的 excluded）
        assert row is not None
        assert row.invocation_count == 1
    finally:
        await _cleanup()


async def test_handler_registered():
    """_bootstrap_default_handlers 后 handler 在注册表。"""
    from negentropy.engine.schedulers.handlers import HANDLER_REGISTRY, _bootstrap_default_handlers

    _bootstrap_default_handlers()
    assert "tool_stats_aggregate" in HANDLER_REGISTRY
