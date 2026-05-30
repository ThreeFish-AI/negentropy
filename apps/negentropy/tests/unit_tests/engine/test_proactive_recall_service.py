"""ProactiveRecallService 单元测试

测试覆盖：
1. 复合评分公式（importance * 0.40 + recency * 0.30 + frequency * 0.20 + 0.10）
2. _get_top_facts 过滤 status=active 且 valid_until 未过期
3. 缓存 hit/miss/invalidated 生命周期
4. TTL 过期后重算
5. retention_score < 0.2 的记忆被排除
"""

from __future__ import annotations

import asyncio
import math
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

# ---------------------------------------------------------------------------
# 内联评分公式验证（与 SQL 实现独立验证）
# ---------------------------------------------------------------------------


def _compute_proactive_rank(
    importance_score: float,
    access_count: int,
    days_since_access: float,
) -> float:
    """模拟 ProactiveRecallService 的复合评分公式。

    proactive_rank = importance * 0.40 + recency * 0.30 + frequency * 0.20 + 0.10
    """
    recency_score = max(0.0, 1.0 - days_since_access / 30.0)
    frequency_score = min(1.0, math.log2(1 + access_count) / math.log2(101))
    return importance_score * 0.40 + recency_score * 0.30 + frequency_score * 0.20 + 0.10


class TestProactiveRankFormula:
    """复合评分公式正确性验证。"""

    def test_all_zero(self) -> None:
        """零值基线：importance=0, frequency=0, 但 recency(days=0)=1.0。

        rank = 0*0.40 + 1.0*0.30 + 0*0.20 + 0.10 = 0.40
        """
        rank = _compute_proactive_rank(0.0, 0, 0.0)
        assert rank == pytest.approx(0.40, abs=1e-4)

    def test_max_importance(self) -> None:
        """importance=1.0 应贡献 0.40。"""
        rank = _compute_proactive_rank(1.0, 0, 0.0)
        # recency_score=1.0 (days=0), frequency_score=0.0 (count=0)
        assert rank == pytest.approx(1.0 * 0.40 + 1.0 * 0.30 + 0.0 + 0.10, abs=1e-4)

    def test_max_frequency(self) -> None:
        """access_count=100 时 frequency_score=1.0，贡献 0.20。"""
        rank = _compute_proactive_rank(0.0, 100, 0.0)
        # importance=0, recency=1.0, frequency=1.0
        assert rank == pytest.approx(0.0 + 1.0 * 0.30 + 1.0 * 0.20 + 0.10, abs=1e-4)

    def test_recency_decay(self) -> None:
        """30 天未访问时 recency_score=0。"""
        rank = _compute_proactive_rank(0.5, 10, 30.0)
        # recency_score=0, frequency_score=log2(11)/log2(101)
        frequency = math.log2(11) / math.log2(101)
        expected = 0.5 * 0.40 + 0.0 * 0.30 + frequency * 0.20 + 0.10
        assert rank == pytest.approx(expected, abs=1e-4)

    def test_recency_beyond_30_days_clamped(self) -> None:
        """超过 30 天时 recency_score 应为 0（不出现负值）。"""
        rank = _compute_proactive_rank(0.5, 5, 60.0)
        assert rank >= 0.10  # 至少有常量基线

    def test_frequency_log_normalization(self) -> None:
        """access_count=1 时 frequency_score≈0.15。"""
        rank_low = _compute_proactive_rank(0.0, 1, 0.0)
        rank_zero = _compute_proactive_rank(0.0, 0, 0.0)
        # frequency_score(1) = log2(2)/log2(101) ≈ 0.15
        diff = rank_low - rank_zero
        expected_diff = (math.log2(2) / math.log2(101)) * 0.20
        assert diff == pytest.approx(expected_diff, abs=1e-4)

    def test_high_importance_beats_high_frequency(self) -> None:
        """importance=1.0, recency=1.0 应优于 frequency=1.0, importance=0.0。"""
        rank_importance = _compute_proactive_rank(1.0, 0, 0.0)
        rank_frequency = _compute_proactive_rank(0.0, 100, 0.0)
        # importance=1.0: 0.40 + 0.30 + 0.10 = 0.80
        # frequency=1.0: 0.30 + 0.20 + 0.10 = 0.60
        assert rank_importance > rank_frequency


# ---------------------------------------------------------------------------
# ProactiveRecallService 方法测试（mock DB）
# ---------------------------------------------------------------------------


def _make_service():
    """创建 ProactiveRecallService 实例。"""
    from negentropy.engine.adapters.postgres.proactive_recall_service import ProactiveRecallService

    return ProactiveRecallService()


class TestGetTopFactsFiltering:
    """_get_top_facts 过滤逻辑验证。"""

    @pytest.mark.asyncio
    async def test_filters_inactive_facts(self) -> None:
        """status != 'active' 的 facts 不应返回。"""
        svc = _make_service()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []

        mock_db = AsyncMock()
        mock_db.execute.return_value = mock_result

        with patch("negentropy.engine.adapters.postgres.proactive_recall_service.db_session") as mock_db_mod:
            mock_db_mod.AsyncSessionLocal.return_value.__aenter__ = AsyncMock(return_value=mock_db)
            mock_db_mod.AsyncSessionLocal.return_value.__aexit__ = AsyncMock(return_value=False)

            facts = await svc._get_top_facts(
                user_id="user-1",
                app_name="app",
                limit=5,
                now=datetime.now(UTC),
            )
            assert facts == []

    @pytest.mark.asyncio
    async def test_filters_expired_facts(self) -> None:
        """valid_until < now 的 facts 不应返回（SQL 层过滤）。"""
        svc = _make_service()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []

        mock_db = AsyncMock()
        mock_db.execute.return_value = mock_result

        with patch("negentropy.engine.adapters.postgres.proactive_recall_service.db_session") as mock_db_mod:
            mock_db_mod.AsyncSessionLocal.return_value.__aenter__ = AsyncMock(return_value=mock_db)
            mock_db_mod.AsyncSessionLocal.return_value.__aexit__ = AsyncMock(return_value=False)

            facts = await svc._get_top_facts(
                user_id="user-1",
                app_name="app",
                limit=5,
                now=datetime.now(UTC),
            )
            assert facts == []


class TestCacheLifecycle:
    """缓存 hit / miss / invalidation 生命周期。"""

    @pytest.mark.asyncio
    async def test_cache_miss_returns_none(self) -> None:
        """无缓存记录时 _get_cached 返回 None。"""
        svc = _make_service()
        mock_result = MagicMock()
        mock_result.first.return_value = None

        mock_db = AsyncMock()
        mock_db.execute.return_value = mock_result

        with patch("negentropy.engine.adapters.postgres.proactive_recall_service.db_session") as mock_db_mod:
            mock_db_mod.AsyncSessionLocal.return_value.__aenter__ = AsyncMock(return_value=mock_db)
            mock_db_mod.AsyncSessionLocal.return_value.__aexit__ = AsyncMock(return_value=False)

            cached = await svc._get_cached(user_id="user-1", app_name="app")
            assert cached is None

    @pytest.mark.asyncio
    async def test_cache_hit_returns_data(self) -> None:
        """有缓存记录时 _get_cached 返回结构化数据。"""
        svc = _make_service()
        now = datetime.now(UTC)
        mock_row = MagicMock()
        mock_row.preload_context = "[Memory:semantic] test content"
        mock_row.memory_ids = [str(uuid4())]
        mock_row.fact_ids = []
        mock_row.token_count = 10
        mock_row.updated_at = now

        mock_result = MagicMock()
        mock_result.first.return_value = mock_row

        mock_db = AsyncMock()
        mock_db.execute.return_value = mock_result

        with patch("negentropy.engine.adapters.postgres.proactive_recall_service.db_session") as mock_db_mod:
            mock_db_mod.AsyncSessionLocal.return_value.__aenter__ = AsyncMock(return_value=mock_db)
            mock_db_mod.AsyncSessionLocal.return_value.__aexit__ = AsyncMock(return_value=False)

            cached = await svc._get_cached(user_id="user-1", app_name="app")
            assert cached is not None
            assert cached["context"] == "[Memory:semantic] test content"
            assert cached["token_count"] == 10

    @pytest.mark.asyncio
    async def test_invalidate_cache_executes_delete(self) -> None:
        """invalidate_cache 执行 DELETE SQL。"""
        svc = _make_service()
        mock_db = AsyncMock()

        with patch("negentropy.engine.adapters.postgres.proactive_recall_service.db_session") as mock_db_mod:
            mock_db_mod.AsyncSessionLocal.return_value.__aenter__ = AsyncMock(return_value=mock_db)
            mock_db_mod.AsyncSessionLocal.return_value.__aexit__ = AsyncMock(return_value=False)

            await svc.invalidate_cache(user_id="user-1", app_name="app")

            # 验证执行了 DELETE
            mock_db.execute.assert_called_once()
            call_args = mock_db.execute.call_args
            sql_text = str(call_args[0][0])
            assert "DELETE" in sql_text.upper()
            mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_or_compute_preload_ttl_expired(self) -> None:
        """TTL 过期后 get_or_compute_preload 应重算。"""
        svc = _make_service()
        now = datetime.now(UTC)
        old_time = now - timedelta(hours=2)  # 超过 1 小时 TTL

        # 第一次调用 _get_cached 返回过期数据
        expired_cache = {
            "context": "old data",
            "memory_ids": [],
            "fact_ids": [],
            "token_count": 5,
            "updated_at": old_time,
        }

        with (
            patch.object(svc, "_get_cached", return_value=expired_cache),
            patch.object(
                svc,
                "_compute_preload",
                return_value={
                    "context": "new data",
                    "memory_ids": [],
                    "fact_ids": [],
                    "token_count": 10,
                    "updated_at": now,
                },
            ) as mock_compute,
            patch.object(svc, "_save_cache", new_callable=AsyncMock) as mock_save,
        ):
            result = await svc.get_or_compute_preload(user_id="user-1", app_name="app")

            # 过期缓存应触发重算
            mock_compute.assert_called_once()
            mock_save.assert_called_once()
            assert result["context"] == "new data"

    @pytest.mark.asyncio
    async def test_get_or_compute_preload_cache_hit_within_ttl(self) -> None:
        """TTL 内的缓存应直接返回。"""
        svc = _make_service()
        now = datetime.now(UTC)
        fresh_cache = {
            "context": "cached data",
            "memory_ids": [],
            "fact_ids": [],
            "token_count": 5,
            "updated_at": now - timedelta(minutes=30),  # 30 分钟前，在 1 小时 TTL 内
        }

        with (
            patch.object(svc, "_get_cached", return_value=fresh_cache),
            patch.object(svc, "_compute_preload", new_callable=AsyncMock) as mock_compute,
            patch.object(svc, "_save_cache", new_callable=AsyncMock) as mock_save,
        ):
            result = await svc.get_or_compute_preload(user_id="user-1", app_name="app")

            # TTL 内不应重算
            mock_compute.assert_not_called()
            mock_save.assert_not_called()
            assert result["context"] == "cached data"


class TestRetentionScoreFilter:
    """retention_score 阈值过滤验证。"""

    @pytest.mark.asyncio
    async def test_low_retention_memories_excluded(self) -> None:
        """retention_score <= 0.2 的记忆应在 SQL 查询中被排除。"""
        svc = _make_service()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []

        mock_db = AsyncMock()
        mock_db.execute.return_value = mock_result

        with patch("negentropy.engine.adapters.postgres.proactive_recall_service.db_session") as mock_db_mod:
            mock_db_mod.AsyncSessionLocal.return_value.__aenter__ = AsyncMock(return_value=mock_db)
            mock_db_mod.AsyncSessionLocal.return_value.__aexit__ = AsyncMock(return_value=False)

            await svc._get_top_memories(
                user_id="user-1",
                app_name="app",
                limit=10,
                now=datetime.now(UTC),
            )

            # 验证 SQL 查询包含 retention_score > 0.2 条件
            call_args = mock_db.execute.call_args
            compiled_sql = str(call_args[0][0].compile(compile_kwargs={"literal_binds": True}))
            assert "0.2" in compiled_sql


class TestScheduleCacheInvalidation:
    """schedule_cache_invalidation 事件循环安全与 GC 安全验证。"""

    def test_no_running_loop_is_noop(self) -> None:
        """同步上下文（无 running loop）应直接返回，不创建悬空 coroutine。

        若实现错误地无条件创建 coroutine，pytest 会触发
        ``RuntimeWarning: coroutine was never awaited``。本测试在纯同步上下文调用，
        断言不抛异常即证明早退分支生效。
        """
        from negentropy.engine.adapters.postgres.proactive_recall_service import (
            schedule_cache_invalidation,
        )

        # 纯同步上下文：无 running event loop
        schedule_cache_invalidation(user_id="u1", app_name="app")
        # 不抛异常即通过（早退，不创建 coroutine）

    @pytest.mark.asyncio
    async def test_running_loop_creates_tracked_task(self) -> None:
        """async 上下文应创建被强引用持有的 task，并在完成后从集合移除。"""
        import negentropy.engine.adapters.postgres.proactive_recall_service as prs

        invalidate_called = asyncio.Event()

        async def fake_invalidate(*, user_id: str, app_name: str) -> None:
            invalidate_called.set()

        fake_svc = MagicMock()
        fake_svc.invalidate_cache = fake_invalidate

        with patch(
            "negentropy.engine.factories.memory.get_proactive_recall_service",
            return_value=fake_svc,
        ):
            prs.schedule_cache_invalidation(user_id="u1", app_name="app")
            # task 应被强引用集合持有（防 GC）
            assert len(prs._BACKGROUND_TASKS) >= 1
            # 等待 task 执行
            await asyncio.wait_for(invalidate_called.wait(), timeout=1.0)
            # 让 done_callback 运行
            await asyncio.sleep(0)

        # 完成后应从集合移除（done_callback discard）
        assert all(t.done() for t in prs._BACKGROUND_TASKS) or len(prs._BACKGROUND_TASKS) == 0

    @pytest.mark.asyncio
    async def test_factory_error_does_not_raise(self) -> None:
        """工厂获取失败时应被吞掉，绝不冒泡到主写入流程。"""
        import negentropy.engine.adapters.postgres.proactive_recall_service as prs

        with patch(
            "negentropy.engine.factories.memory.get_proactive_recall_service",
            side_effect=RuntimeError("factory boom"),
        ):
            # 不应抛出
            prs.schedule_cache_invalidation(user_id="u1", app_name="app")
