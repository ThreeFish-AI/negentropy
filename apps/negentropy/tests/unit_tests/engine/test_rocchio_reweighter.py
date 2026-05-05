"""
Rocchio 相关性权重计算器 单元测试

测试 G1 阶段即将实现的 RocchioReweighter 的预期接口。
当前使用内联实现 compute_relevance_weight 进行测试验证。

接口定义:
    compute_relevance_weight(helpful_count, irrelevant_count, total_count) -> float
    基于 Rocchio 反馈公式: weight = 1.0 + beta * helpful_ratio - gamma * irrelevant_ratio
    结果 clamp 到 [0.5, 2.0]，低于最小反馈阈值时返回 1.0。
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# 内联实现（G1 阶段将提取到 RocchioReweighter 类中）
# ---------------------------------------------------------------------------


def compute_relevance_weight(
    helpful_count: int,
    irrelevant_count: int,
    total_count: int,
    *,
    beta: float = 0.75,
    gamma: float = 0.15,
    min_count: int = 3,
) -> float:
    """基于 Rocchio 反馈公式计算记忆相关性权重。

    weight = 1.0 + beta × (helpful / total) - gamma × (irrelevant / total)
    当 total < min_count 时返回 1.0（数据不足，不调整）。

    Args:
        helpful_count: 有帮助的反馈数
        irrelevant_count: 无关的反馈数
        total_count: 总反馈数
        beta: 正反馈系数
        gamma: 负反馈系数
        min_count: 最小反馈阈值

    Returns:
        权重值，clamp 到 [0.5, 2.0]
    """
    if total_count < min_count:
        return 1.0
    helpful_ratio = helpful_count / total_count
    irrelevant_ratio = irrelevant_count / total_count
    weight = 1.0 + (beta * helpful_ratio) - (gamma * irrelevant_ratio)
    return max(0.5, min(2.0, weight))


# ---------------------------------------------------------------------------
# 测试
# ---------------------------------------------------------------------------


class TestNoFeedback:
    """无反馈时权重应为 1.0（中性，不调整）。"""

    def test_zero_counts_returns_one(self) -> None:
        """所有计数为 0 时返回 1.0。"""
        assert compute_relevance_weight(0, 0, 0) == 1.0

    def test_below_min_count_returns_one(self) -> None:
        """总反馈数低于 min_count 时返回 1.0。"""
        assert compute_relevance_weight(2, 0, 2) == 1.0

    def test_at_min_count_not_returns_one(self) -> None:
        """总反馈数达到 min_count 时，权重应根据反馈计算（不再返回 1.0）。"""
        weight = compute_relevance_weight(3, 0, 3)
        assert weight > 1.0  # 全部 helpful


class TestAllHelpful:
    """全部 helpful 反馈场景。"""

    def test_all_helpful_above_one(self) -> None:
        """全部 helpful 反馈时权重应 > 1.0。"""
        weight = compute_relevance_weight(10, 0, 10)
        assert weight > 1.0

    def test_all_helpful_exact_formula(self) -> None:
        """全部 helpful 时权重应等于 1.0 + beta。"""
        weight = compute_relevance_weight(10, 0, 10, beta=0.75)
        expected = 1.0 + 0.75 * 1.0  # helpful_ratio = 1.0
        assert abs(weight - expected) < 0.001


class TestAllIrrelevant:
    """全部 irrelevant 反馈场景。"""

    def test_all_irrelevant_below_one(self) -> None:
        """全部 irrelevant 反馈时权重应 < 1.0。"""
        weight = compute_relevance_weight(0, 10, 10)
        assert weight < 1.0

    def test_all_irrelevant_exact_formula(self) -> None:
        """全部 irrelevant 时权重应等于 1.0 - gamma。"""
        weight = compute_relevance_weight(0, 10, 10, gamma=0.15)
        expected = 1.0 - 0.15 * 1.0  # irrelevant_ratio = 1.0
        assert abs(weight - expected) < 0.001


class TestMixedFeedback:
    """混合反馈场景。"""

    def test_mixed_feedback_weight_in_range(self) -> None:
        """混合反馈权重应在 [0.5, 2.0] 范围内。"""
        weight = compute_relevance_weight(5, 3, 10)
        assert 0.5 <= weight <= 2.0

    def test_more_helpful_than_irrelevant(self) -> None:
        """helpful 多于 irrelevant 时权重应 > 1.0。"""
        weight = compute_relevance_weight(7, 2, 10)
        assert weight > 1.0

    def test_more_irrelevant_than_helpful(self) -> None:
        """irrelevant 远多于 helpful 时权重应 < 1.0（需要足够大的比例差）。"""
        # beta=0.75, gamma=0.15 时，helpful_ratio 和 irrelevant_ratio 需满足：
        # 1.0 + 0.75*h - 0.15*i < 1.0 → 0.75*h < 0.15*i → h/i < 0.2
        # helpful=1, irrelevant=9: h/i=0.111 < 0.2
        weight = compute_relevance_weight(1, 9, 10)
        assert weight < 1.0

    def test_equal_helpful_irrelevant(self) -> None:
        """helpful 和 irrelevant 相等时，权重取决于 beta vs gamma 的相对大小。"""
        weight = compute_relevance_weight(5, 5, 10)
        # beta * 0.5 - gamma * 0.5 = 0.75 * 0.5 - 0.15 * 0.5 = 0.3
        # 所以 weight = 1.0 + 0.3 = 1.3
        assert weight > 1.0  # beta > gamma


class TestClamping:
    """权重 clamp 到 [0.5, 2.0] 的边界场景。"""

    def test_weight_clamped_at_two(self) -> None:
        """极端正反馈时权重不应超过 2.0。"""
        # beta=10.0 让公式计算值远超 2.0
        weight = compute_relevance_weight(100, 0, 100, beta=10.0)
        assert weight == 2.0

    def test_weight_clamped_at_half(self) -> None:
        """极端负反馈时权重不应低于 0.5。"""
        # gamma=10.0 让公式计算值远低于 0.5
        weight = compute_relevance_weight(0, 100, 100, gamma=10.0)
        assert weight == 0.5

    def test_normal_range_no_clamping(self) -> None:
        """正常参数下权重不应触发 clamp。"""
        weight = compute_relevance_weight(5, 3, 10)
        assert weight != 0.5
        assert weight != 2.0


class TestRocchioFormula:
    """验证 Rocchio 公式: weight = 1.0 + beta * helpful_ratio - gamma * irrelevant_ratio。"""

    def test_formula_matches_manual_calculation(self) -> None:
        """手动计算验证公式正确性。"""
        # helpful=6, irrelevant=2, total=10
        # helpful_ratio = 0.6, irrelevant_ratio = 0.2
        # weight = 1.0 + 0.75 * 0.6 - 0.15 * 0.2 = 1.0 + 0.45 - 0.03 = 1.42
        weight = compute_relevance_weight(6, 2, 10, beta=0.75, gamma=0.15)
        assert abs(weight - 1.42) < 0.001

    def test_custom_beta_gamma(self) -> None:
        """自定义 beta / gamma 参数应正确影响权重。"""
        # helpful=8, irrelevant=2, total=10
        # weight = 1.0 + 1.0 * 0.8 - 0.5 * 0.2 = 1.0 + 0.8 - 0.1 = 1.7
        weight = compute_relevance_weight(8, 2, 10, beta=1.0, gamma=0.5)
        assert abs(weight - 1.7) < 0.001

    def test_helpful_ratio_dominates(self) -> None:
        """helpful_ratio 的系数 (beta) 大于 irrelevant_ratio 的系数 (gamma)。"""
        # 即使 helpful 和 irrelevant 各占一半，权重也应 > 1.0
        weight = compute_relevance_weight(50, 50, 100)
        assert weight > 1.0


class TestMinFeedbackThreshold:
    """最小反馈阈值测试。"""

    def test_below_threshold_returns_one(self) -> None:
        """反馈总数低于 min_count 时返回 1.0。"""
        assert compute_relevance_weight(2, 1, 2, min_count=3) == 1.0

    def test_at_threshold_computes_weight(self) -> None:
        """反馈总数等于 min_count 时，应计算实际权重。"""
        weight = compute_relevance_weight(3, 0, 3, min_count=3)
        assert weight != 1.0  # 全部 helpful，应 > 1.0
        assert weight > 1.0

    def test_above_threshold_computes_weight(self) -> None:
        """反馈总数超过 min_count 时，应计算实际权重。"""
        weight = compute_relevance_weight(10, 0, 10, min_count=3)
        assert weight > 1.0

    def test_custom_min_count(self) -> None:
        """自定义 min_count 应正确生效。"""
        # total=5 < min_count=10 → return 1.0
        assert compute_relevance_weight(5, 0, 5, min_count=10) == 1.0
        # total=10 >= min_count=10 → compute
        weight = compute_relevance_weight(10, 0, 10, min_count=10)
        assert weight > 1.0
