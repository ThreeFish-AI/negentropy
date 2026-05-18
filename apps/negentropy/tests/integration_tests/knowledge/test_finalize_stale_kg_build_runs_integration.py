"""``AgeGraphRepository.finalize_stale_kg_build_runs`` 集成测试。

回归目标（root cause）:
    旧 SQL ``(:running_threshold || ' minutes')::interval`` 中 ``||`` 是 PostgreSQL 字符串拼接，
    要求两侧为 text；而 ``finalize_stale_kg_build_runs`` 入参 ``running_threshold_minutes``
    与 ``cancelling_threshold_minutes`` 默认为 ``int(30)`` / ``int(2)``。asyncpg 在
    prepared-statement 编码阶段严格校验类型，直接抛 ``TypeError: expected str, got int``，
    被 SQLAlchemy 翻译为 ``asyncpg.exceptions.DataError``，导致 ``pipeline_watchdog`` 调度
    每个 tick 失败（详见 ``engine/schedulers/handlers/pipeline_watchdog.py``）。

修复方案：raw SQL 改用 ``make_interval(mins => :p)``，原生接收 ``int4``，与本仓库既有范式
``engine/adapters/postgres/memory_automation_service.py`` 中 ``make_interval(days => p_min_age_days)``
保持一致。

为何必须用集成测试：bug 触发点在 asyncpg native type encoder（C 扩展层），单元测试（mock /
SQLite）无法复现；必须连接真 PostgreSQL 才能验证。
"""

from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from negentropy.knowledge.graph.repository import AgeGraphRepository
from negentropy.models.base import NEGENTROPY_SCHEMA

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def stale_kg_runs(db_engine):
    """插入 1 条 stale ``running`` 与 1 条 stale ``cancelling`` 用例数据。

    使用唯一 ``app_name`` 隔离作用域，避免污染共享开发 DB 中无关 run；
    teardown 阶段按 ``app_name`` 清理，保证测试可重复。
    """
    app_name = f"watchdog-test-{uuid4().hex[:8]}"
    running_id = uuid4()
    cancelling_id = uuid4()
    sf = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
    async with sf() as s:
        await s.execute(
            text(f"""
                INSERT INTO {NEGENTROPY_SCHEMA}.kg_build_runs
                    (id, app_name, status, created_at, updated_at)
                VALUES
                    (:rid, :app, 'running',    NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours'),
                    (:cid, :app, 'cancelling', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours')
            """),
            {"rid": running_id, "cid": cancelling_id, "app": app_name},
        )
        await s.commit()

    yield app_name, running_id, cancelling_id

    async with sf() as s:
        await s.execute(
            text(f"DELETE FROM {NEGENTROPY_SCHEMA}.kg_build_runs WHERE app_name = :app"),
            {"app": app_name},
        )
        await s.commit()


@pytest.fixture
async def db_session(db_engine):
    """绑定到测试 engine 的独立 AsyncSession，供 ``AgeGraphRepository`` 注入。"""
    sf = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
    async with sf() as s:
        yield s


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestFinalizeStaleKgBuildRunsIntegration:
    """``finalize_stale_kg_build_runs`` 行为级回归测试。"""

    async def test_running_and_cancelling_converge_without_dataerror(self, db_engine, db_session, stale_kg_runs):
        """主路径：running → failed、cancelling → cancelled，且不抛 asyncpg DataError。"""
        app_name, running_id, cancelling_id = stale_kg_runs

        # 注入 session 让 repository 走测试 engine；该调用是 pre-fix 必然抛
        # ``asyncpg.exceptions.DataError: invalid input for query argument $2: 30
        # (expected str, got int)`` 的入口。
        repo = AgeGraphRepository(session=db_session)
        result = await repo.finalize_stale_kg_build_runs(app_name=app_name)

        assert result == {"forced_failed": 1, "forced_cancelled": 1}

        # 用独立连接 verify 实际持久化结果（绕开 ORM 缓存，确保读到 DB 真值）。
        sf = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        async with sf() as verify_session:
            rows = (
                (
                    await verify_session.execute(
                        text(f"""
                        SELECT id, status, completed_at, error_message
                          FROM {NEGENTROPY_SCHEMA}.kg_build_runs
                         WHERE app_name = :app
                    """),
                        {"app": app_name},
                    )
                )
                .mappings()
                .all()
            )

        by_id = {r["id"]: r for r in rows}
        assert by_id[running_id]["status"] == "failed"
        assert by_id[running_id]["completed_at"] is not None
        assert "forcibly marked as failed" in (by_id[running_id]["error_message"] or "")
        assert by_id[cancelling_id]["status"] == "cancelled"
        assert by_id[cancelling_id]["completed_at"] is not None

    async def test_default_int_thresholds_pass_asyncpg_encoding(self, db_session, stale_kg_runs):
        """回归锁死：默认阈值为 int(30, 2)，pre-fix 直接抛 asyncpg DataError。"""
        app_name, *_ = stale_kg_runs

        # 不显式传 threshold，走 30 / 2 默认值——正是 production 触发 bug 的入参形态。
        repo = AgeGraphRepository(session=db_session)
        result = await repo.finalize_stale_kg_build_runs(app_name=app_name)

        assert isinstance(result, dict)
        assert result["forced_failed"] >= 0
        assert result["forced_cancelled"] >= 0

    async def test_fresh_run_not_affected(self, db_engine, db_session):
        """边界用例：新鲜 ``running`` 行（updated_at = NOW()）不应被收敛为 failed。"""
        app_name = f"watchdog-fresh-{uuid4().hex[:8]}"
        fresh_id = uuid4()

        sf = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        async with sf() as s:
            await s.execute(
                text(f"""
                    INSERT INTO {NEGENTROPY_SCHEMA}.kg_build_runs
                        (id, app_name, status, created_at, updated_at)
                    VALUES (:rid, :app, 'running', NOW(), NOW())
                """),
                {"rid": fresh_id, "app": app_name},
            )
            await s.commit()

        try:
            repo = AgeGraphRepository(session=db_session)
            result = await repo.finalize_stale_kg_build_runs(app_name=app_name)
            assert result == {"forced_failed": 0, "forced_cancelled": 0}

            async with sf() as verify_session:
                row = (
                    (
                        await verify_session.execute(
                            text(f"""
                            SELECT status FROM {NEGENTROPY_SCHEMA}.kg_build_runs WHERE id = :rid
                        """),
                            {"rid": fresh_id},
                        )
                    )
                    .mappings()
                    .one()
                )
            assert row["status"] == "running"
        finally:
            async with sf() as s:
                await s.execute(
                    text(f"DELETE FROM {NEGENTROPY_SCHEMA}.kg_build_runs WHERE app_name = :app"),
                    {"app": app_name},
                )
                await s.commit()
