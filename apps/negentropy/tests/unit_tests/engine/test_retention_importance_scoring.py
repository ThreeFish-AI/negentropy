"""
Retention 与 Importance 评分单元测试

覆盖 calculate_importance_score 五因子公式、类型常量映射、
以及 calculate_retention_score 的 related_count / memory_type 边界场景。
"""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from negentropy.engine.governance.memory import (
    _MEMORY_TYPE_DECAY_RATES,
    _MEMORY_TYPE_IMPORTANCE_WEIGHT,
    _MEMORY_TYPE_MULTIPLIER,
    VALID_MEMORY_TYPES,
    MemoryGovernanceService,
)

# ---------------------------------------------------------------------------
# Fixture
# ---------------------------------------------------------------------------


@pytest.fixture()
def svc() -> MemoryGovernanceService:
    """创建无 DB 依赖的 MemoryGovernanceService 实例"""
    return MemoryGovernanceService.__new__(MemoryGovernanceService)


# ===================================================================
# 1. Importance Score — calculate_importance_score
# ===================================================================


class TestImportanceScore:
    """五因子重要性评分单元测试

    公式:
        importance = min(1.0,
            base_activation * 0.30
          + access_frequency * 0.25
          + fact_support * 0.20
          + type_weight * 0.15
          + recency_bonus * 0.10)
    """

    def test_fresh_memory_gets_recency_bonus(self, svc: MemoryGovernanceService) -> None:
        """days_since_creation=0 时 recency_bonus = 1.0，贡献 0.10"""
        score = svc.calculate_importance_score(
            access_count=0,
            memory_type="episodic",
            related_fact_count=0,
            days_since_creation=0.0,
            days_since_last_access=0.0,
        )
        assert score > 0.0
        # recency_bonus=1.0 → 0.10, type_weight(episodic)=0.4 → 0.06
        # base_activation(0 access)=0.1 → 0.03
        # access_frequency=0.0 → 0.0
        # fact_support=0.0 → 0.0
        # total ≈ 0.19
        assert score == pytest.approx(0.19, abs=0.01)

    def test_old_memory_lower_importance(self, svc: MemoryGovernanceService) -> None:
        """days_since_creation=365 时 recency_bonus = 0"""
        score_fresh = svc.calculate_importance_score(
            days_since_creation=0.0,
            memory_type="episodic",
            access_count=0,
            related_fact_count=0,
            days_since_last_access=0.0,
        )
        score_old = svc.calculate_importance_score(
            days_since_creation=365.0,
            memory_type="episodic",
            access_count=0,
            related_fact_count=0,
            days_since_last_access=365.0,
        )
        assert score_fresh > score_old

    def test_type_weight_ordering(self, svc: MemoryGovernanceService) -> None:
        """不同类型的重要性权重：preference > procedural > fact > episodic"""
        scores: dict[str, float] = {}
        for mt in ("preference", "procedural", "fact", "episodic"):
            scores[mt] = svc.calculate_importance_score(
                access_count=0,
                memory_type=mt,
                related_fact_count=0,
                days_since_creation=0.0,
                days_since_last_access=0.0,
            )
        assert scores["preference"] > scores["procedural"]
        assert scores["procedural"] > scores["fact"]
        assert scores["fact"] > scores["episodic"]

    def test_core_type_highest_importance(self, svc: MemoryGovernanceService) -> None:
        """core 类型 type_weight=1.0，重要性最高"""
        score_core = svc.calculate_importance_score(
            access_count=0,
            memory_type="core",
            related_fact_count=0,
            days_since_creation=0.0,
            days_since_last_access=0.0,
        )
        score_episodic = svc.calculate_importance_score(
            access_count=0,
            memory_type="episodic",
            related_fact_count=0,
            days_since_creation=0.0,
            days_since_last_access=0.0,
        )
        assert score_core > score_episodic

    def test_more_access_count_higher_importance(self, svc: MemoryGovernanceService) -> None:
        """access_count 越高 → access_frequency 和 base_activation 越大"""
        score_low = svc.calculate_importance_score(
            access_count=1,
            memory_type="episodic",
            related_fact_count=0,
            days_since_creation=0.0,
            days_since_last_access=0.0,
        )
        score_high = svc.calculate_importance_score(
            access_count=100,
            memory_type="episodic",
            related_fact_count=0,
            days_since_creation=0.0,
            days_since_last_access=0.0,
        )
        assert score_high > score_low

    def test_more_related_facts_higher_importance(self, svc: MemoryGovernanceService) -> None:
        """related_fact_count 越多 → fact_support 越高"""
        score_few = svc.calculate_importance_score(
            access_count=0,
            memory_type="episodic",
            related_fact_count=1,
            days_since_creation=0.0,
            days_since_last_access=0.0,
        )
        score_many = svc.calculate_importance_score(
            access_count=0,
            memory_type="episodic",
            related_fact_count=10,
            days_since_creation=0.0,
            days_since_last_access=0.0,
        )
        assert score_many > score_few

    def test_fact_support_saturates_at_10(self, svc: MemoryGovernanceService) -> None:
        """related_fact_count >= 10 时 fact_support 上限为 1.0"""
        score_10 = svc.calculate_importance_score(
            access_count=0,
            memory_type="episodic",
            related_fact_count=10,
            days_since_creation=0.0,
            days_since_last_access=0.0,
        )
        score_100 = svc.calculate_importance_score(
            access_count=0,
            memory_type="episodic",
            related_fact_count=100,
            days_since_creation=0.0,
            days_since_last_access=0.0,
        )
        assert score_10 == score_100

    def test_score_always_in_0_1(self, svc: MemoryGovernanceService) -> None:
        """评分始终在 [0, 1] 范围内"""
        # 极大 access_count + 全部加成
        score = svc.calculate_importance_score(
            access_count=100000,
            memory_type="core",
            related_fact_count=50,
            days_since_creation=0.0,
            days_since_last_access=0.0,
        )
        assert 0.0 <= score <= 1.0

        # 极低
        score_zero = svc.calculate_importance_score(
            access_count=0,
            memory_type="episodic",
            related_fact_count=0,
            days_since_creation=365.0,
            days_since_last_access=365.0,
        )
        assert 0.0 <= score_zero <= 1.0

    def test_all_zeros(self, svc: MemoryGovernanceService) -> None:
        """全零参数时评分 > 0（base_activation 默认 0.1 + type_weight）"""
        score = svc.calculate_importance_score(
            access_count=0,
            memory_type="episodic",
            related_fact_count=0,
            days_since_creation=365.0,
            days_since_last_access=365.0,
        )
        # base_activation=0.1 → 0.03, type_weight=0.4 → 0.06
        # access_frequency=0, fact_support=0, recency_bonus=0
        assert score == pytest.approx(0.09, abs=0.01)
        assert score >= 0.0

    def test_access_frequency_saturates_at_100(self, svc: MemoryGovernanceService) -> None:
        """access_count=100 时 access_frequency = log(101)/log(101) = 1.0"""
        score_100 = svc.calculate_importance_score(
            access_count=100,
            memory_type="episodic",
            related_fact_count=0,
            days_since_creation=0.0,
            days_since_last_access=0.0,
        )
        score_1000 = svc.calculate_importance_score(
            access_count=1000,
            memory_type="episodic",
            related_fact_count=0,
            days_since_creation=0.0,
            days_since_last_access=0.0,
        )
        # access_frequency 已饱和，但 base_activation 仍可能略增
        assert score_1000 >= score_100

    def test_recency_bonus_ninety_day_decay(self, svc: MemoryGovernanceService) -> None:
        """recency_bonus 在 90 天时归零"""
        score_89 = svc.calculate_importance_score(
            access_count=0,
            memory_type="episodic",
            related_fact_count=0,
            days_since_creation=89.0,
            days_since_last_access=0.0,
        )
        score_90 = svc.calculate_importance_score(
            access_count=0,
            memory_type="episodic",
            related_fact_count=0,
            days_since_creation=90.0,
            days_since_last_access=0.0,
        )
        # 89 天还有微量 recency_bonus，90 天归零
        assert score_89 > score_90

    def test_unknown_type_uses_default_weight(self, svc: MemoryGovernanceService) -> None:
        """未知 memory_type 使用 _DEFAULT_IMPORTANCE_WEIGHT = 0.4（等同 episodic）"""
        score_unknown = svc.calculate_importance_score(
            access_count=0,
            memory_type="unknown_type",
            related_fact_count=0,
            days_since_creation=0.0,
            days_since_last_access=0.0,
        )
        score_episodic = svc.calculate_importance_score(
            access_count=0,
            memory_type="episodic",
            related_fact_count=0,
            days_since_creation=0.0,
            days_since_last_access=0.0,
        )
        assert score_unknown == score_episodic


# ===================================================================
# 2. Type Multiplier / Importance Weight 常量
# ===================================================================


class TestTypeConstants:
    """验证类型映射常量完整性"""

    def test_memory_type_multiplier_values(self) -> None:
        """_MEMORY_TYPE_MULTIPLIER 各类型的正确值"""
        expected = {
            "core": 1.5,
            "semantic": 1.4,
            "preference": 1.3,
            "procedural": 1.2,
            "fact": 1.15,
            "episodic": 1.0,
        }
        for mt, expected_val in expected.items():
            assert _MEMORY_TYPE_MULTIPLIER[mt] == expected_val, f"{mt}: expected {expected_val}"

    def test_memory_type_multiplier_ordering(self) -> None:
        """core > semantic > preference > procedural > fact > episodic"""
        order = ["core", "semantic", "preference", "procedural", "fact", "episodic"]
        for i in range(len(order) - 1):
            assert _MEMORY_TYPE_MULTIPLIER[order[i]] > _MEMORY_TYPE_MULTIPLIER[order[i + 1]]

    def test_memory_type_importance_weight_values(self) -> None:
        """_MEMORY_TYPE_IMPORTANCE_WEIGHT 各类型的正确值"""
        expected = {
            "core": 1.0,
            "semantic": 0.95,
            "preference": 0.9,
            "procedural": 0.75,
            "fact": 0.6,
            "episodic": 0.4,
        }
        for mt, expected_val in expected.items():
            assert _MEMORY_TYPE_IMPORTANCE_WEIGHT[mt] == expected_val, f"{mt}: expected {expected_val}"

    def test_memory_type_importance_weight_ordering(self) -> None:
        """core > semantic > preference > procedural > fact > episodic"""
        order = ["core", "semantic", "preference", "procedural", "fact", "episodic"]
        for i in range(len(order) - 1):
            assert _MEMORY_TYPE_IMPORTANCE_WEIGHT[order[i]] > _MEMORY_TYPE_IMPORTANCE_WEIGHT[order[i + 1]]

    def test_valid_memory_types_matches_decay_rates(self) -> None:
        """VALID_MEMORY_TYPES 必须与 _MEMORY_TYPE_DECAY_RATES 键集一致"""
        assert VALID_MEMORY_TYPES == frozenset(_MEMORY_TYPE_DECAY_RATES.keys())

    def test_all_types_present_in_all_dicts(self) -> None:
        """所有六个类型在三个映射中都有定义"""
        expected_types = {"core", "semantic", "preference", "procedural", "fact", "episodic"}
        assert set(_MEMORY_TYPE_DECAY_RATES.keys()) == expected_types
        assert set(_MEMORY_TYPE_MULTIPLIER.keys()) == expected_types
        assert set(_MEMORY_TYPE_IMPORTANCE_WEIGHT.keys()) == expected_types


# ===================================================================
# 3. Retention Score 边界场景（补充已有 test_memory_governance.py）
# ===================================================================


class TestRetentionScoreEdgeCases:
    """calculate_retention_score 的 related_count / memory_type 边界测试"""

    @pytest.mark.asyncio
    async def test_related_count_boosts_score(self, svc: MemoryGovernanceService) -> None:
        """related_count > 0 通过 semantic_importance 因子提升分数"""
        now = datetime.now()
        score_zero = await svc.calculate_retention_score(
            memory_id="test-rel-0",
            access_count=0,
            last_accessed_at=now,
            created_at=now,
            related_count=0,
        )
        score_five = await svc.calculate_retention_score(
            memory_id="test-rel-5",
            access_count=0,
            last_accessed_at=now,
            created_at=now,
            related_count=5,
        )
        assert score_five > score_zero

    @pytest.mark.asyncio
    async def test_related_count_saturates(self, svc: MemoryGovernanceService) -> None:
        """related_count >= 5 时 semantic_importance 达到上限 1.5"""
        now = datetime.now()
        score_5 = await svc.calculate_retention_score(
            memory_id="test-sat-5",
            access_count=0,
            last_accessed_at=now,
            created_at=now,
            related_count=5,
        )
        score_50 = await svc.calculate_retention_score(
            memory_id="test-sat-50",
            access_count=0,
            last_accessed_at=now,
            created_at=now,
            related_count=50,
        )
        # semantic_importance = 1.0 + min(0.5, count * 0.1)
        # count=5 → 1.5, count=50 → 1.5（已饱和）
        # 注：calculate_retention_score 内部调用 datetime.now()，
        # 两次调用间有微秒级时间差，故使用 approx 比较
        assert score_5 == pytest.approx(score_50, abs=1e-6)

    @pytest.mark.asyncio
    async def test_core_type_highest_retention(self, svc: MemoryGovernanceService) -> None:
        """core 类型 type_multiplier=1.5，保留分数最高"""
        now = datetime.now()
        score_core = await svc.calculate_retention_score(
            memory_id="test-type-core",
            access_count=0,
            last_accessed_at=now,
            created_at=now,
            memory_type="core",
            related_count=0,
        )
        score_episodic = await svc.calculate_retention_score(
            memory_id="test-type-episodic",
            access_count=0,
            last_accessed_at=now,
            created_at=now,
            memory_type="episodic",
            related_count=0,
        )
        assert score_core > score_episodic

    @pytest.mark.asyncio
    async def test_semantic_type_slow_decay(self, svc: MemoryGovernanceService) -> None:
        """semantic 类型衰减率 0.005，远低于 episodic 的 0.10"""
        now = datetime.now()
        last_access = now - timedelta(days=30)
        score_semantic = await svc.calculate_retention_score(
            memory_id="test-sem",
            access_count=0,
            last_accessed_at=last_access,
            created_at=last_access,
            memory_type="semantic",
            related_count=0,
        )
        score_episodic = await svc.calculate_retention_score(
            memory_id="test-epi",
            access_count=0,
            last_accessed_at=last_access,
            created_at=last_access,
            memory_type="episodic",
            related_count=0,
        )
        assert score_semantic > score_episodic

    @pytest.mark.asyncio
    async def test_core_type_zero_decay(self, svc: MemoryGovernanceService) -> None:
        """core 类型衰减率 0.0，即使长期未访问也不衰减"""
        now = datetime.now()
        long_ago = now - timedelta(days=365)
        score = await svc.calculate_retention_score(
            memory_id="test-core-nodecay",
            access_count=0,
            last_accessed_at=long_ago,
            created_at=long_ago,
            memory_type="core",
            related_count=0,
        )
        # time_decay = e^(0 * days) = 1.0
        # frequency_boost = 1.0, type_multiplier = 1.5, semantic_importance = 1.0
        # recency_bonus = 0 (365 days > 365 threshold → 0)
        # retention = 1.0 * 1.0 * 1.5 * 1.0 / 5.0 + 0 = 0.3
        assert score == pytest.approx(0.3, abs=0.01)

    @pytest.mark.asyncio
    async def test_very_recent_access_vs_old_creation(self, svc: MemoryGovernanceService) -> None:
        """recent last_accessed_at + old created_at：时间衰减低但 recency_bonus 也低"""
        now = datetime.now()
        score = await svc.calculate_retention_score(
            memory_id="test-recent-old",
            access_count=0,
            last_accessed_at=now,
            created_at=now - timedelta(days=200),
            related_count=0,
        )
        # time_decay ≈ 1.0（刚访问）
        # recency_bonus = max(0, 1.0 - 200/365) * 0.1 ≈ 0.045
        # retention = 1.0 * 1.0 * 1.0 * 1.0 / 5.0 + 0.045 = 0.245
        assert 0.2 <= score <= 0.3
