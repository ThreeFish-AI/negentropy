"""skill 双相门 + 反事实归因纯函数单测（综述 §8 held-out gain / backward retention / §9.4 防 Goodhart）。

对齐 ``test_evolution_decision.py`` 范式：frozen dataclass 视图注入、纯函数无 IO。
"""

from __future__ import annotations

from dataclasses import dataclass

from negentropy.engine.evolution import decision as d


@dataclass
class _R:
    """满足 decision._RunView Protocol 的轻量视图。"""

    score_mean: float
    regression_count: int
    n_cases: int
    pass_rate: float = 0.0


# ---------------------------------------------------------------------------
# compute_run_regression
# ---------------------------------------------------------------------------


def test_compute_run_regression_counts_only_overlapping_regressions():
    base = {"c1": 80.0, "c2": 70.0, "c3": 90.0}
    cand = {"c1": 60.0, "c2": 68.0, "c4": 95.0}  # c1: -20 回退；c2: -2 非回退；c4 不在基线
    assert d.compute_run_regression(baseline_scores=base, candidate_scores=cand) == 1


def test_compute_run_regression_empty_when_candidate_all_improve():
    base = {"c1": 60.0, "c2": 50.0}
    cand = {"c1": 70.0, "c2": 55.0}
    assert d.compute_run_regression(baseline_scores=base, candidate_scores=cand) == 0


# ---------------------------------------------------------------------------
# decide_skill_shadow（visible 集 held-out gain 门）
# ---------------------------------------------------------------------------


def test_shadow_hold_when_insufficient_cases():
    dec = d.decide_skill_shadow(baseline=_R(70, 0, 3), candidate=_R(80, 0, 3))
    assert dec.action == "hold"
    assert dec.reason == d.REASON_INSUFFICIENT_SAMPLES


def test_shadow_reject_when_gain_below_min():
    dec = d.decide_skill_shadow(baseline=_R(70, 0, 10), candidate=_R(71, 0, 10))  # gain 1 < 2
    assert dec.action == "reject"
    assert dec.reason == d.REASON_NO_GAIN


def test_shadow_hold_advance_when_gain_meets_min():
    dec = d.decide_skill_shadow(baseline=_R(70, 0, 10), candidate=_R(75, 0, 10))  # gain 5 >= 2
    assert dec.action == "hold"
    assert dec.detail == {"gain": 5.0}


def test_shadow_gain_threshold_boundary():
    # gain 恰好 == visible_gain_min（2.0）→ 不 reject（< 才 reject）
    dec = d.decide_skill_shadow(baseline=_R(70, 0, 10), candidate=_R(72, 0, 10))
    assert dec.action == "hold"


# ---------------------------------------------------------------------------
# decide_skill_canary（holdout 集零回归 + 不漂移门）
# ---------------------------------------------------------------------------


def test_canary_hold_when_insufficient_cases():
    dec = d.decide_skill_canary(baseline=_R(70, 0, 3), candidate=_R(75, 0, 3))
    assert dec.action == "hold"
    assert dec.reason == d.REASON_INSUFFICIENT_SAMPLES


def test_canary_rollback_on_any_holdout_regression():
    dec = d.decide_skill_canary(baseline=_R(70, 0, 10), candidate=_R(75, 1, 10))  # 1 回退 > 0 容忍
    assert dec.action == "rollback"
    assert dec.reason == d.REASON_ROLLED_BACK


def test_canary_rollback_on_drift():
    dec = d.decide_skill_canary(baseline=_R(80, 0, 10), candidate=_R(78, 0, 10))  # drift 2 > 1
    assert dec.action == "rollback"
    assert dec.reason == d.REASON_ROLLED_BACK


def test_canary_promote_when_clean_no_regression():
    dec = d.decide_skill_canary(baseline=_R(70, 0, 10), candidate=_R(72, 0, 10))  # 候选更高、零回退
    assert dec.action == "promote"
    assert dec.reason == d.REASON_PROMOTED


def test_canary_promote_when_equal_scores_no_regression():
    dec = d.decide_skill_canary(baseline=_R(70, 0, 10), candidate=_R(70, 0, 10))  # 平、零回退
    assert dec.action == "promote"


# ---------------------------------------------------------------------------
# decide_longitudinal_drift（纵向复评门，综述 §8 #3）
# ---------------------------------------------------------------------------


def test_longitudinal_hold_when_insufficient_cases():
    dec = d.decide_longitudinal_drift(promotion_mean=72.0, recheck=_R(60, 0, 3))
    assert dec.action == "hold"
    assert dec.reason == d.REASON_INSUFFICIENT_SAMPLES


def test_longitudinal_rollback_on_drift():
    dec = d.decide_longitudinal_drift(promotion_mean=72.0, recheck=_R(60, 0, 10))  # drift 12 > 3
    assert dec.action == "rollback"
    assert dec.reason == d.REASON_ROLLED_BACK


def test_longitudinal_hold_when_stable():
    dec = d.decide_longitudinal_drift(promotion_mean=72.0, recheck=_R(71, 0, 10))  # drift 1 <= 3
    assert dec.action == "hold"


# ---------------------------------------------------------------------------
# decide_safety_nonregression（SI #6，综述 §8 + §9.3）
# ---------------------------------------------------------------------------


def test_safety_promote_when_zero_regression():
    dec = d.decide_safety_nonregression(baseline=_R(90, 0, 10), candidate=_R(88, 0, 10))
    assert dec.action == "promote"  # 均值降但零 case 回退 → 安全不退化


def test_safety_rollback_on_any_regression():
    dec = d.decide_safety_nonregression(baseline=_R(90, 0, 10), candidate=_R(90, 1, 10))
    assert dec.action == "rollback"
    assert dec.reason == d.REASON_ROLLED_BACK


def test_safety_hold_when_insufficient_cases():
    dec = d.decide_safety_nonregression(baseline=_R(90, 0, 3), candidate=_R(90, 0, 3))
    assert dec.action == "hold"


# ---------------------------------------------------------------------------
# improvement_efficiency（SI #4）
# ---------------------------------------------------------------------------


def test_improvement_efficiency_ratio():
    assert d.improvement_efficiency(score_gain=10.0, cost_units=5.0) == 2.0


def test_improvement_efficiency_zero_cost_returns_none():
    assert d.improvement_efficiency(score_gain=10.0, cost_units=0.0) is None
    assert d.improvement_efficiency(score_gain=10.0, cost_units=-1.0) is None


# ---------------------------------------------------------------------------
# decide_runtime_canary_online（在线 error-rate 门，综述 §9.3，R6-b）
# ---------------------------------------------------------------------------


def test_runtime_canary_online_hold_when_insufficient_samples():
    dec = d.decide_runtime_canary_online(candidate_err_rate=0.5, candidate_n=3, baseline_err_rate=0.1)
    assert dec.action == "hold"
    assert dec.reason == d.REASON_INSUFFICIENT_SAMPLES


def test_runtime_canary_online_rollback_on_error_regression():
    # 候选 error-rate 0.4 vs 基线 0.1 → regression 0.3 > 0.1 → rollback
    dec = d.decide_runtime_canary_online(candidate_err_rate=0.4, candidate_n=20, baseline_err_rate=0.1)
    assert dec.action == "rollback"
    assert dec.reason == d.REASON_ROLLED_BACK


def test_runtime_canary_online_promote_when_no_regression():
    # 候选 error-rate 0.12 vs 基线 0.1 → regression 0.02 <= 0.1 → promote
    dec = d.decide_runtime_canary_online(candidate_err_rate=0.12, candidate_n=20, baseline_err_rate=0.1)
    assert dec.action == "promote"
