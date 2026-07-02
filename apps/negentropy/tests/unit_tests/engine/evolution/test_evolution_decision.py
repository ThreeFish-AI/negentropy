"""evolution decision 纯函数护栏单测。"""

from __future__ import annotations

from dataclasses import dataclass

from negentropy.engine.evolution import decision as d


@dataclass
class _M:
    """满足 decision._MetricsView Protocol 的轻量视图。"""

    zero_hit_rate: float
    helpful_ratio: float
    referenced_rate: float
    sample_n: int


# ---------------------------------------------------------------------------
# clamp_weight / is_within_bounds
# ---------------------------------------------------------------------------


def test_clamp_weight_lower_and_upper_bounds():
    assert d.clamp_weight(0.1) == 0.3  # 下界
    assert d.clamp_weight(0.95) == 0.9  # 上界
    assert d.clamp_weight(0.65) == 0.65  # 区间内不变
    assert d.clamp_weight(0.3) == 0.3  # 边界
    assert d.clamp_weight(0.9) == 0.9  # 边界


def test_is_within_bounds():
    assert d.is_within_bounds(0.3) is True
    assert d.is_within_bounds(0.9) is True
    assert d.is_within_bounds(0.29) is False
    assert d.is_within_bounds(0.91) is False


# ---------------------------------------------------------------------------
# pre_propose_check
# ---------------------------------------------------------------------------


def test_pre_propose_check_inflight_zero_holds():
    assert d.pre_propose_check(inflight_count=0).action == "hold"


def test_pre_propose_check_inflight_skips():
    dec = d.pre_propose_check(inflight_count=1)
    assert dec.action == "skip"
    assert dec.reason == d.REASON_CONCURRENT_INFLIGHT


# ---------------------------------------------------------------------------
# P0-2：is_canary_stale（canary 超时强制回收判定）
# ---------------------------------------------------------------------------


def test_is_canary_stale_true_when_over_max():
    from datetime import UTC, datetime, timedelta

    now = datetime(2026, 7, 2, 13, 0, 0, tzinfo=UTC)
    started = now - timedelta(seconds=22000)
    assert d.is_canary_stale(started_at=started, now=now, max_seconds=21600) is True


def test_is_canary_stale_false_within_window():
    from datetime import UTC, datetime, timedelta

    now = datetime(2026, 7, 2, 13, 0, 0, tzinfo=UTC)
    started = now - timedelta(seconds=1000)
    assert d.is_canary_stale(started_at=started, now=now, max_seconds=21600) is False


def test_is_canary_stale_no_started_at_is_false():
    """started_at 缺失（异常态）→ 不强回收，留人查。"""
    from datetime import UTC, datetime

    assert d.is_canary_stale(started_at=None, now=datetime(2026, 7, 2, tzinfo=UTC), max_seconds=1) is False


# ---------------------------------------------------------------------------
# decide_shadow（准入闸：基线样本充足 + 提案在界内）
# ---------------------------------------------------------------------------


def test_decide_shadow_insufficient_baseline_samples_rejects():
    baseline = _M(zero_hit_rate=0.4, helpful_ratio=0.5, referenced_rate=0.3, sample_n=10)
    dec = d.decide_shadow(baseline=baseline, proposed_semantic_weight=0.6)
    assert dec.action == "reject"
    assert dec.reason == d.REASON_INSUFFICIENT_SAMPLES


def test_decide_shadow_out_of_bounds_rejects():
    baseline = _M(zero_hit_rate=0.4, helpful_ratio=0.5, referenced_rate=0.3, sample_n=100)
    dec = d.decide_shadow(baseline=baseline, proposed_semantic_weight=0.95)
    assert dec.action == "reject"
    assert dec.reason == d.REASON_BOUND_VIOLATION


def test_decide_shadow_passes_when_samples_and_bounds_ok():
    baseline = _M(zero_hit_rate=0.4, helpful_ratio=0.5, referenced_rate=0.3, sample_n=100)
    dec = d.decide_shadow(baseline=baseline, proposed_semantic_weight=0.65)
    assert dec.action == "hold"


def test_decide_shadow_min_samples_injected_not_read_from_settings():
    """纯函数边界：min_samples 由调用方注入（覆盖默认），不读 settings。"""
    baseline = _M(zero_hit_rate=0.4, helpful_ratio=0.5, referenced_rate=0.3, sample_n=5)
    # 默认 min_samples=50 → reject；注入 min_samples=3 → hold
    assert d.decide_shadow(baseline=baseline, proposed_semantic_weight=0.6, min_samples=3).action == "hold"


# ---------------------------------------------------------------------------
# decide_canary（候选桶 vs 基线桶真实对比）
# ---------------------------------------------------------------------------


def test_decide_canary_insufficient_candidate_samples_holds():
    baseline = _M(zero_hit_rate=0.4, helpful_ratio=0.5, referenced_rate=0.3, sample_n=200)
    candidate = _M(zero_hit_rate=0.38, helpful_ratio=0.55, referenced_rate=0.33, sample_n=10)
    dec = d.decide_canary(baseline=baseline, candidate=candidate)
    assert dec.action == "hold"
    assert dec.reason == d.REASON_INSUFFICIENT_SAMPLES


def test_decide_canary_zero_hit_regression_rolls_back():
    baseline = _M(zero_hit_rate=0.40, helpful_ratio=0.50, referenced_rate=0.3, sample_n=200)
    candidate = _M(zero_hit_rate=0.45, helpful_ratio=0.55, referenced_rate=0.3, sample_n=200)
    dec = d.decide_canary(baseline=baseline, candidate=candidate)
    assert dec.is_rollback
    assert dec.reason == d.REASON_ROLLED_BACK


def test_decide_canary_helpful_drop_rolls_back():
    baseline = _M(zero_hit_rate=0.40, helpful_ratio=0.60, referenced_rate=0.3, sample_n=200)
    candidate = _M(zero_hit_rate=0.38, helpful_ratio=0.50, referenced_rate=0.3, sample_n=200)
    dec = d.decide_canary(baseline=baseline, candidate=candidate)
    assert dec.is_rollback


def test_decide_canary_promotes_when_no_regression():
    baseline = _M(zero_hit_rate=0.40, helpful_ratio=0.50, referenced_rate=0.3, sample_n=200)
    candidate = _M(zero_hit_rate=0.35, helpful_ratio=0.55, referenced_rate=0.33, sample_n=200)
    dec = d.decide_canary(baseline=baseline, candidate=candidate)
    assert dec.is_promote
    assert dec.reason == d.REASON_PROMOTED


def test_decide_canary_zero_helpful_gain_still_promotes():
    """canary 门槛比 shadow 宽：helpful_ratio 允许 0 改进（只要不下降）。"""
    baseline = _M(zero_hit_rate=0.40, helpful_ratio=0.50, referenced_rate=0.3, sample_n=200)
    candidate = _M(zero_hit_rate=0.40, helpful_ratio=0.50, referenced_rate=0.3, sample_n=200)
    assert d.decide_canary(baseline=baseline, candidate=candidate).is_promote
