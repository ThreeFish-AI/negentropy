"""
Memory Governance Service 单元测试

测试遗忘曲线计算、审计决策执行等核心逻辑。
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta

import pytest


class TestRetentionScoreCalculation:
    """多因子遗忘曲线公式单元测试

    验证五因子自适应模型:
        retention = min(1.0, time_decay × frequency_boost × type_multiplier × semantic_importance / 5.0 + recency_bonus)
    """

    @pytest.fixture
    def governance_service(self):
        """创建 MemoryGovernanceService 实例（mock DB）"""
        from negentropy.engine.governance.memory import MemoryGovernanceService

        service = MemoryGovernanceService.__new__(MemoryGovernanceService)
        return service

    @pytest.mark.asyncio
    async def test_fresh_memory_high_score(self, governance_service):
        """刚创建的记忆应该有较高的保留分数"""
        now = datetime.now()
        score = await governance_service.calculate_retention_score(
            memory_id="test-1",
            access_count=0,
            last_accessed_at=now,
            created_at=now,
            related_count=0,
        )
        # 新记忆: time_decay=1.0, frequency_boost=1.0, type=1.0, semantic=1.0
        # retention = 1.0 * 1.0 * 1.0 * 1.0 / 5.0 + 0.1(recency) = 0.3
        assert 0.25 <= score <= 0.35

    @pytest.mark.asyncio
    async def test_frequently_accessed_memory(self, governance_service):
        """高频访问的记忆应该有更高的保留分数"""
        now = datetime.now()
        score = await governance_service.calculate_retention_score(
            memory_id="test-2",
            access_count=100,
            last_accessed_at=now,
            created_at=now - timedelta(days=30),
            related_count=0,
        )
        # access_count=100: frequency_boost = 1 + ln(101) ≈ 5.62
        # time_decay ≈ 1.0, recency_bonus ≈ 0.092
        # retention = min(1.0, 1.0 * 5.62 * 1.0 * 1.0 / 5.0 + 0.092) = 1.0
        assert score >= 0.9

    @pytest.mark.asyncio
    async def test_old_unaccessed_memory_decays(self, governance_service):
        """长期未访问的记忆应该有较低的保留分数"""
        now = datetime.now()
        score = await governance_service.calculate_retention_score(
            memory_id="test-3",
            access_count=0,
            last_accessed_at=now - timedelta(days=30),
            created_at=now - timedelta(days=30),
            related_count=0,
        )
        # 30 days: time_decay = e^(-0.1*30) ≈ 0.05, recency_bonus ≈ 0
        # retention ≈ 0.05 * 1.0 / 5.0 ≈ 0.01
        assert score < 0.15

    @pytest.mark.asyncio
    async def test_exponential_decay_formula(self, governance_service):
        """验证指数衰减公式的正确性（含 recency_bonus）"""
        now = datetime.now()
        lambda_ = 0.1

        for days in [1, 7, 14, 30, 60]:
            score = await governance_service.calculate_retention_score(
                memory_id=f"test-decay-{days}",
                access_count=0,
                last_accessed_at=now - timedelta(days=days),
                created_at=now - timedelta(days=days),
                lambda_=lambda_,
                related_count=0,
            )
            expected_decay = math.exp(-lambda_ * days)
            recency_bonus = max(0, 1.0 - days / 365.0) * 0.1
            expected_score = min(1.0, expected_decay * 1.0 / 5.0 + recency_bonus)
            assert abs(score - expected_score) < 0.01, f"Day {days}: expected {expected_score:.4f}, got {score:.4f}"

    @pytest.mark.asyncio
    async def test_score_bounded_0_1(self, governance_service):
        """保留分数应始终在 [0, 1] 范围内"""
        now = datetime.now()

        # 极端情况：非常旧 + 未访问
        score_low = await governance_service.calculate_retention_score(
            memory_id="test-low",
            access_count=0,
            last_accessed_at=now - timedelta(days=3650),
            created_at=now - timedelta(days=3650),
            related_count=0,
        )
        assert 0.0 <= score_low <= 1.0

        # 极端情况：刚访问 + 超高频
        score_high = await governance_service.calculate_retention_score(
            memory_id="test-high",
            access_count=1000000,
            last_accessed_at=now,
            created_at=now,
            related_count=0,
        )
        assert 0.0 <= score_high <= 1.0

    @pytest.mark.asyncio
    async def test_custom_lambda(self, governance_service):
        """自定义 λ 参数应影响衰减速度"""
        now = datetime.now()
        last_access = now - timedelta(days=10)

        score_slow = await governance_service.calculate_retention_score(
            memory_id="test-slow",
            access_count=0,
            last_accessed_at=last_access,
            created_at=last_access,
            lambda_=0.01,  # 慢衰减
            related_count=0,
        )

        score_fast = await governance_service.calculate_retention_score(
            memory_id="test-fast",
            access_count=0,
            last_accessed_at=last_access,
            created_at=last_access,
            lambda_=1.0,  # 快衰减
            related_count=0,
        )

        assert score_slow > score_fast
