"""记忆重要性评分单元测试

覆盖 MemoryGovernanceService.calculate_importance_score() 的五因子公式：

1. 基础激活 (ACT-R base-level activation)
2. 访问频率 (log-saturated access count)
3. 事实支撑 (related fact count / 10)
4. 类型权重 (preference > procedural > fact > episodic)
5. 时效性加成 (recency bonus within 90 days)

参考文献:
[1] J. R. Anderson et al., "An integrated theory of the mind,"
    Psychological Review, vol. 111, no. 4, pp. 1036–1060, 2004.
"""

import pytest

from negentropy.engine.governance.memory import MemoryGovernanceService


@pytest.fixture
def svc() -> MemoryGovernanceService:
    return MemoryGovernanceService()


class TestCalculateImportanceScore:
    def test_fresh_episodic_memory_default(self, svc: MemoryGovernanceService) -> None:
        score = svc.calculate_importance_score(
            access_count=0,
            memory_type="episodic",
            related_fact_count=0,
            days_since_creation=0.0,
            days_since_last_access=0.0,
        )
        assert 0.0 <= score <= 1.0
        assert score >= 0.1  # type_weight(0.4)*0.15 + recency_bonus(1.0)*0.10 >= 0.16

    def test_preference_type_weights_highest(self, svc: MemoryGovernanceService) -> None:
        pref = svc.calculate_importance_score(memory_type="preference")
        proc = svc.calculate_importance_score(memory_type="procedural")
        fact = svc.calculate_importance_score(memory_type="fact")
        epis = svc.calculate_importance_score(memory_type="episodic")
        assert pref > proc > fact > epis

    def test_frequently_accessed_memory_high_score(self, svc: MemoryGovernanceService) -> None:
        low = svc.calculate_importance_score(access_count=0)
        high = svc.calculate_importance_score(access_count=50)
        assert high > low

    def test_fact_support_boosts_score(self, svc: MemoryGovernanceService) -> None:
        no_facts = svc.calculate_importance_score(related_fact_count=0)
        with_facts = svc.calculate_importance_score(related_fact_count=8)
        assert with_facts > no_facts

    def test_recency_bonus_decay(self, svc: MemoryGovernanceService) -> None:
        fresh = svc.calculate_importance_score(days_since_creation=0.0)
        old = svc.calculate_importance_score(days_since_creation=100.0)
        assert fresh > old

    def test_score_bounded_0_1(self, svc: MemoryGovernanceService) -> None:
        score = svc.calculate_importance_score(
            access_count=1000,
            memory_type="preference",
            related_fact_count=100,
            days_since_creation=0.0,
            days_since_last_access=0.0,
        )
        assert score <= 1.0
        assert score >= 0.0

    def test_old_memory_no_recency_bonus(self, svc: MemoryGovernanceService) -> None:
        score = svc.calculate_importance_score(days_since_creation=365.0)
        assert score >= 0.0
        # recency_bonus = max(0, 1 - 365/90) = 0, score should be lower
        recent = svc.calculate_importance_score(days_since_creation=1.0)
        assert recent > score

    def test_zero_access_count(self, svc: MemoryGovernanceService) -> None:
        score = svc.calculate_importance_score(access_count=0, days_since_last_access=0.0)
        assert 0.0 <= score <= 1.0

    def test_unknown_memory_type_uses_default(self, svc: MemoryGovernanceService) -> None:
        score = svc.calculate_importance_score(memory_type="unknown_type")
        assert 0.0 <= score <= 1.0

    def test_saturates_at_high_access_count(self, svc: MemoryGovernanceService) -> None:
        score_100 = svc.calculate_importance_score(access_count=100)
        score_10000 = svc.calculate_importance_score(access_count=10000)
        # Both should be high, but 10000 shouldn't be dramatically higher
        assert score_10000 - score_100 < 0.3
