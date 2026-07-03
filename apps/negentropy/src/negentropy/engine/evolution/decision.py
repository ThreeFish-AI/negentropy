"""Evolution 决策守卫 — 纯函数，无 IO，对齐 ``engine/routine/decision.py`` 范式。

将「提案何时进 shadow / canary / promote / rollback」的全部判定逻辑收敛于此，
与编排副作用（DB / LLM 调用）正交解耦。所有阈值均为硬编码常量（非模型自律），
参数由调用方显式注入——纯函数边界：decision 不读 settings。

晋升判据（对齐蓝图 §4.4 在线信号融合 / §9.2 自动回滚）：
- shadow 通过：候选 ``zero_hit_rate`` 相对基线退化 ≤ ``ZERO_HIT_REGRESSION_MAX``
  AND ``helpful_ratio`` 改进 ≥ ``HELPFUL_RATIO_MIN_IMPROVEMENT`` AND 两桶样本量各 ≥ ``MIN_SAMPLE_N``；
- canary promote：在线 ``zero_hit_rate`` 不退化 AND ``helpful_ratio`` 不下降（门槛比 shadow 宽），
  任一退化 → rollback。

参考文献：
[1] L. A. Agrawal et al., "GEPA," in Proc. ICLR (Oral), 2026. arXiv:2507.19457.
    反思驱动进化的标量反馈判据。
[2] Anthropic, *Building Effective AI Agents*, 2024. "include stopping conditions
    to maintain control." 进化回路同样需要确定性护栏。
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

# =============================================================================
# REASON 常量（写入 evolution_proposals 状态翻转的归因，便于审计/单测）
# =============================================================================

REASON_PROMOTED = "promoted"
REASON_REJECTED = "rejected"
REASON_ROLLED_BACK = "rolled_back"
REASON_INSUFFICIENT_SAMPLES = "insufficient_samples"  # 冷启动保护
REASON_BOUND_VIOLATION = "bound_violation"  # 超硬上下界
REASON_CONCURRENT_INFLIGHT = "concurrent_inflight"  # 单在途冲突
REASON_NO_CHANGE = "no_change"  # proposer 返回 None（无改进空间）
REASON_STALE_CANARY = "stale_canary_timeout"  # canary 超时强制 rollback
REASON_NOOP_MUTATION = "noop_mutation"  # 提案与 active 差异过小
REASON_OSCILLATION = "oscillation"  # 重复近期 rejected/rolled_back 方向
REASON_BUDGET_PROPOSAL_CAP = "budget_proposal_cap"  # 每日提案数触顶
REASON_BUDGET_COST_CAP = "budget_cost_cap"  # 每日成本触顶

# =============================================================================
# 晋升/回滚阈值常量（对齐蓝图 §4.4/§9.2，可经调用方覆盖以测试）
# =============================================================================

MIN_SAMPLE_N = 50  # 每桶最小样本量（检索次数）
HELPFUL_RATIO_MIN_IMPROVEMENT = 0.02  # shadow 通过要求的 helpful_ratio 净改进下限
ZERO_HIT_REGRESSION_MAX = 0.01  # 容许的 zero_hit_rate 退化上限

# retrieval_config 面：semantic_weight 硬上下界 + 单步最大变异
WEIGHT_LOWER_BOUND = 0.3
WEIGHT_UPPER_BOUND = 0.9
WEIGHT_MAX_STEP = 0.10

# anti-collapse 多样性护栏（综述 §10.4）：候选 diversity ≥ DIVERSITY_REGRESSION_RATIO × baseline
DIVERSITY_REGRESSION_RATIO = 0.8


# =============================================================================
# 数据结构
# =============================================================================


@dataclass(frozen=True, slots=True)
class Decision:
    """决策结果。

    ``action`` ∈ ``{promote, rollback, hold, reject, skip}``：
    - ``promote``：候选通过 canary，晋升为 active；
    - ``rollback``：canary 退化，回滚（新写 active=旧基线）；
    - ``hold``：暂不翻转（shadow 通过→推进 canary；或样本不足继续等）；
    - ``reject``：shadow 不通过，提案终止为 rejected；
    - ``skip``：前置守卫不通过（如单在途冲突），本轮不动作。
    """

    action: str
    reason: str | None = None
    detail: dict | None = None

    @property
    def is_promote(self) -> bool:
        return self.action == "promote"

    @property
    def is_rollback(self) -> bool:
        return self.action == "rollback"


class _MetricsView(Protocol):
    """指标只读视图（避免与 ORM 强耦合，便于测试注入）。"""

    zero_hit_rate: float
    helpful_ratio: float
    referenced_rate: float
    sample_n: int
    diversity_ratio: float  # anti-collapse 指标（综述 §10.4）


# =============================================================================
# retrieval_config 面：权重有界变异校验
# =============================================================================


def clamp_weight(w: float) -> float:
    """硬上下界 clamp（防极端，对齐蓝图 §9.6 安全不变量）。"""
    return max(WEIGHT_LOWER_BOUND, min(WEIGHT_UPPER_BOUND, round(w, 4)))


def is_within_bounds(semantic_w: float) -> bool:
    """semantic_weight 是否落在合法上下界内。"""
    return WEIGHT_LOWER_BOUND <= semantic_w <= WEIGHT_UPPER_BOUND


# =============================================================================
# 前置守卫
# =============================================================================


def pre_propose_check(
    *,
    inflight_count: int,
    max_inflight: int = 1,
    proposals_today: int = 0,
    max_proposals_per_day: int | None = None,
    cost_today_usd: float = 0.0,
    max_cost_usd_daily: float | None = None,
) -> Decision:
    """派发新提案前守卫：单在途 + 每日提案数上限 + 每日成本上限（对齐 routine pre_dispatch_check 多预算范式）。

    新参全默认 → 旧调用 ``pre_propose_check(inflight_count=n)`` 逐字节等价。
    """
    if inflight_count >= max_inflight:
        return Decision("skip", REASON_CONCURRENT_INFLIGHT, {"inflight": inflight_count})
    if max_proposals_per_day is not None and proposals_today >= max_proposals_per_day:
        return Decision("skip", REASON_BUDGET_PROPOSAL_CAP, {"proposals_today": proposals_today})
    if max_cost_usd_daily is not None and cost_today_usd >= max_cost_usd_daily:
        return Decision("skip", REASON_BUDGET_COST_CAP, {"cost_today_usd": cost_today_usd})
    return Decision("hold")


def is_noop_mutation(
    draft_semantic: float,
    active_semantic: float,
    *,
    tol: float = WEIGHT_MAX_STEP / 2,
) -> bool:
    """draft 与 active 的 semantic_weight 差异 < tol → no-op mutation，应拒（综述 §3.5 防无意义探索）。"""
    return abs(draft_semantic - active_semantic) < tol


def is_noop_template(draft_template: str, active_template: str) -> bool:
    """skill prompt_template 变异 noop 判定（对偶 retrieval 的 float ``is_noop_mutation``）。

    归一化空白后文本一致 → no-op，应拒（综述 §3.5 防无意义探索 + 防 proposer 把「重排空白」当改进）。
    """
    return _normalize_template(draft_template) == _normalize_template(active_template)


def _normalize_template(t: str) -> str:
    return " ".join((t or "").split())


def is_repeated_direction(
    draft_semantic: float,
    recent_negatives_semantic: list[float],
    *,
    tol: float = WEIGHT_MAX_STEP / 2,
) -> bool:
    """draft 与任一近期 rejected/rolled_back 的 semantic_weight 差异 < tol → 振荡，应拒（DGM archive 防重复死方向）。"""
    return any(abs(draft_semantic - w) < tol for w in recent_negatives_semantic)


def is_canary_stale(
    *,
    started_at: datetime | None,
    now: datetime,
    max_seconds: int,
) -> bool:
    """canary 是否超时应强制回收。

    ``started_at`` 缺失（异常态，理论 ``_enter_canary`` 必写）→ 不回收（留人查）；
    否则 ``now - started_at > max_seconds`` → True（强制 rollback）。
    """
    if started_at is None:
        return False
    return (now - started_at).total_seconds() > max_seconds


# =============================================================================
# shadow eval 判定（候选窗口 vs 基线窗口）
# =============================================================================


def decide_shadow(
    *,
    baseline: _MetricsView,
    proposed_semantic_weight: float,
    min_samples: int = MIN_SAMPLE_N,
) -> Decision:
    """shadow eval 准入闸（本切片无离线 eval 四表，shadow 不做候选对比）。

    通过（``hold``，推进 canary）= 基线窗口样本充足（canary 才有可比基线）
    AND 提案权重在硬上下界内。否则 ``reject``。
    真正的候选 vs 基线数值对比发生在 ``decide_canary``（canary 期间候选流量按
    config_version 分桶后）。
    """
    if baseline.sample_n < min_samples:
        return Decision(
            "reject",
            REASON_INSUFFICIENT_SAMPLES,
            {"baseline_n": baseline.sample_n},
        )
    if not is_within_bounds(proposed_semantic_weight):
        return Decision(
            "reject",
            REASON_BOUND_VIOLATION,
            {"semantic_weight": proposed_semantic_weight},
        )
    return Decision("hold")


# =============================================================================
# canary 窗口判定（候选桶 vs 基线桶的真实数值对比）
# =============================================================================


def decide_canary(
    *,
    baseline: _MetricsView,
    candidate: _MetricsView,
    min_samples: int = MIN_SAMPLE_N,
    zero_hit_regression_max: float = ZERO_HIT_REGRESSION_MAX,
    diversity_regression_ratio: float | None = DIVERSITY_REGRESSION_RATIO,
) -> Decision:
    """金丝雀窗口结束判定：双确认（在线指标）→ promote；任一退化 → rollback。

    样本不足 → ``hold``（继续等，不立即 rollback，给 canary 攒样本的时间）。
    门槛比 shadow 宽：helpful_ratio 允许 0 改进（只要不下降）。
    anti-collapse 护栏（综述 §10.4）：候选 diversity 不低于 ``diversity_regression_ratio`` × baseline，
    否则 rollback（防优化 helpful_ratio 靠收窄检索到单一记忆簇实现）；baseline diversity=0 不触发。
    """
    if candidate.sample_n < min_samples:
        return Decision("hold", REASON_INSUFFICIENT_SAMPLES, {"candidate_n": candidate.sample_n})
    zhr_regression = candidate.zero_hit_rate - baseline.zero_hit_rate
    hr_gain = candidate.helpful_ratio - baseline.helpful_ratio
    if zhr_regression > zero_hit_regression_max:
        return Decision("rollback", REASON_ROLLED_BACK, {"zhr_regression": zhr_regression})
    if hr_gain < 0:
        return Decision("rollback", REASON_ROLLED_BACK, {"hr_gain": hr_gain})
    if diversity_regression_ratio is not None and baseline.diversity_ratio > 0:
        floor = baseline.diversity_ratio * diversity_regression_ratio
        if candidate.diversity_ratio < floor:
            return Decision(
                "rollback",
                REASON_ROLLED_BACK,
                {"diversity_regression": candidate.diversity_ratio - baseline.diversity_ratio, "floor": floor},
            )
    return Decision("promote", REASON_PROMOTED, {"hr_gain": hr_gain, "zhr_regression": zhr_regression})


# =============================================================================
# skill_template 面：双相门（综述 §8 held-out gain + backward retention / §9.4 防 Goodhart）
# =============================================================================
#
# 与 retrieval 面的「在线 window 指标门」解耦：skill 面在离线 eval suite 上作 case 级判据。
# 两相分别落在可见集（is_frozen=false，允许拟合）与冻结 holdout 集（is_frozen=true，零回退），
# 使综述 §9.4「冻结 holdout 结果不回流 proposer」由 SuiteRunner 的 ``visible_results_query``
# 结构性保证、再由本双相门在裁决侧二次约束。

# 门裁决阈值（硬编码常量；调用方可显式覆盖以测试）
SKILL_GATE_MIN_CASES = 5  # 每分片最少 case 数（冷启动保护）
SKILL_GATE_VISIBLE_GAIN_MIN = 2.0  # visible 集：候选均值 − 基线均值 ≥ 此值才放行（held-out gain）
SKILL_HOLDOUT_REGRESSION_MAX = 0  # holdout 集：零 case 回退容忍（backward retention，零容忍）
SKILL_HOLDOUT_DRIFT_MAX = 1.0  # holdout 集：候选均值不得低于基线 1 分以上
SKILL_CASE_REGRESSION_DELTA = 5.0  # 单 case 回退判定阈值（候选 < 基线 − 此值计一回退）

# 纵向复评（综述 §8 #3 longitudinal stability + §10.5 + §9.3 持续再认证）
SKILL_LONGITUDINAL_DRIFT_MAX = 3.0  # 复评 holdout 均值较晋升时退化超过此值 → 回退 active_version

# runtime canary 在线 error-rate 门（综述 §9.3 在线受控发布信号，R6-b）
SKILL_RUNTIME_CANARY_MIN_SAMPLES = 10  # 候选桶最少在线样本（expand_skill 调用数）；不足则跳过在线门
SKILL_RUNTIME_CANARY_ERR_REGRESSION_MAX = 0.1  # 候选桶 error-rate 较基线桶高出此值 → rollback（10pp）

REASON_NO_GAIN = "no_gain"  # 候选在 visible 集无实质增益（综述 §8 held-out gain 未达）


class _RunView(Protocol):
    """eval_run 只读视图（避免与 ORM 强耦合，便于测试注入）。

    ``n_cases`` = 该 run 覆盖的 case 数（partition 切片后）；``regression_count`` 由
    ``compute_run_regression`` 相对 baseline run 计算后填入。``pass_rate`` 供后续效率/稳定性
    度量复用（本双相门不强依赖）。
    """

    score_mean: float
    regression_count: int
    n_cases: int
    pass_rate: float


def compute_run_regression(
    *,
    baseline_scores: dict[str, float],
    candidate_scores: dict[str, float],
    delta: float = SKILL_CASE_REGRESSION_DELTA,
) -> int:
    """相对 baseline run，候选回退的 case 数（综述 §8 backward retention 的 case 级度量）。

    仅统计两 run 都覆盖的 case；``candidate < baseline − delta`` 计为回退。
    """
    return sum(
        1 for cid, cand in candidate_scores.items() if cid in baseline_scores and cand < baseline_scores[cid] - delta
    )


def decide_skill_shadow(
    *,
    baseline: _RunView,
    candidate: _RunView,
    visible_gain_min: float = SKILL_GATE_VISIBLE_GAIN_MIN,
    min_cases: int = SKILL_GATE_MIN_CASES,
) -> Decision:
    """skill shadow eval 门（综述 §8 held-out gain）：在**可见集**（``is_frozen=false``）上
    候选均值须较基线有实质增益。

    - 样本不足 → ``hold``（继续攒 case）；
    - 增益 < ``visible_gain_min`` → ``reject``（无实质改进，提案终止为 rejected）；
    - 否则 ``hold``（推进 canary，在 holdout 集上跑 backward retention 门）。

    可见集允许拟合（held-out gain 在可见集度量），故此处对 case 回退不设硬门——真正的零
    回退要求在 ``decide_skill_canary`` 的 holdout 集上（综述 §9.4 防 Goodhart）。
    """
    if candidate.n_cases < min_cases:
        return Decision("hold", REASON_INSUFFICIENT_SAMPLES, {"candidate_n": candidate.n_cases})
    gain = candidate.score_mean - baseline.score_mean
    if gain < visible_gain_min:
        return Decision("reject", REASON_NO_GAIN, {"gain": gain, "required": visible_gain_min})
    return Decision("hold", None, {"gain": gain})


def decide_skill_canary(
    *,
    baseline: _RunView,
    candidate: _RunView,
    holdout_regression_max: int = SKILL_HOLDOUT_REGRESSION_MAX,
    holdout_drift_max: float = SKILL_HOLDOUT_DRIFT_MAX,
    min_cases: int = SKILL_GATE_MIN_CASES,
) -> Decision:
    """skill canary 门（综述 §8 backward retention + §9.4 防 Goodhart）：在**冻结 holdout 集**
    （``is_frozen=true``）上候选须零 case 回退且均值不漂移。

    - 样本不足 → ``hold``；
    - ``regression_count > holdout_regression_max``（默认零容忍）→ ``rollback``；
    - 候选均值 < 基线 − ``holdout_drift_max`` → ``rollback``；
    - 否则 ``promote``。
    """
    if candidate.n_cases < min_cases:
        return Decision("hold", REASON_INSUFFICIENT_SAMPLES, {"candidate_n": candidate.n_cases})
    if candidate.regression_count > holdout_regression_max:
        return Decision(
            "rollback",
            REASON_ROLLED_BACK,
            {"regression_count": candidate.regression_count, "max": holdout_regression_max},
        )
    drift = baseline.score_mean - candidate.score_mean
    if drift > holdout_drift_max:
        return Decision("rollback", REASON_ROLLED_BACK, {"holdout_drift": drift, "max": holdout_drift_max})
    return Decision("promote", REASON_PROMOTED, {"holdout_drift": drift})


def improvement_efficiency(*, score_gain: float, cost_units: float) -> float | None:
    """SI 目标 #4 improvement efficiency（综述 §8）：单位成本的增益。

    ``cost_units`` 是归一化成本代理（如 Judge 调用数 / token 数）；``<= 0`` → None（不可比）。
    真实 $-成本需从 LLM usage 提取（后续接入；当前以 Judge 调用数作代理）。
    """
    if cost_units <= 0:
        return None
    return score_gain / cost_units


def decide_safety_nonregression(
    *,
    baseline: _RunView,
    candidate: _RunView,
    min_cases: int = SKILL_GATE_MIN_CASES,
) -> Decision:
    """SI 目标 #6 safety non-regression 门（综述 §8 + §9.3）。

    安全套件（``EvalSuite.is_safety=true``）上的**零回退**是晋升的硬前置——能力增益不得以安全
    退化为代价。``regression_count > 0`` 即否决（rollback/blocked）；样本不足 → hold（待攒）；
    否则 promote（安全不退化）。
    """
    if candidate.n_cases < min_cases:
        return Decision("hold", REASON_INSUFFICIENT_SAMPLES, {"candidate_n": candidate.n_cases})
    if candidate.regression_count > 0:
        return Decision("rollback", REASON_ROLLED_BACK, {"safety_regression": candidate.regression_count})
    return Decision("promote", REASON_PROMOTED, {"safety_regression": 0})


def decide_longitudinal_drift(
    *,
    promotion_mean: float,
    recheck: _RunView,
    drift_max: float = SKILL_LONGITUDINAL_DRIFT_MAX,
    min_cases: int = SKILL_GATE_MIN_CASES,
) -> Decision:
    """纵向复评门（综述 §8 #3 longitudinal stability + §10.5 + §9.3 持续再认证）。

    已晋升对象在 T_k 复跑 holdout 集，与**晋升时**（T_promote）的 holdout 均值对比：
    - 样本不足 → ``hold``（无法判定，留待下次复评）；
    - 复评均值 < 晋升均值 − ``drift_max`` → ``rollback``（静默退化，回退 active_version 到前一稳定版）；
    - 否则 ``hold``（仍稳定）。

    动机：晋升后系统持续变化（流量漂移、依赖变更、模型升级），一次性的晋升门不能保证长期
    稳定——综述 §10.5 指出「experience→capability 无 scaling-law 类关系」，必须周期性复测。
    """
    if recheck.n_cases < min_cases:
        return Decision("hold", REASON_INSUFFICIENT_SAMPLES, {"recheck_n": recheck.n_cases})
    drift = promotion_mean - recheck.score_mean
    if drift > drift_max:
        return Decision("rollback", REASON_ROLLED_BACK, {"longitudinal_drift": drift, "max": drift_max})
    return Decision("hold", None, {"longitudinal_drift": drift})


def decide_runtime_canary_online(
    *,
    candidate_err_rate: float,
    candidate_n: int,
    baseline_err_rate: float,
    min_samples: int = SKILL_RUNTIME_CANARY_MIN_SAMPLES,
    regression_max: float = SKILL_RUNTIME_CANARY_ERR_REGRESSION_MAX,
) -> Decision:
    """runtime canary 在线 error-rate 门（综述 §9.3 在线受控发布信号，R6-b）。

    用真实生产 ``tool_invocations``（expand_skill 调用，按 canary_assignment 分候选桶 vs 基线桶）的
    error-rate 作在线信号——捕捉离线 eval 套件漏掉的真实分布问题。

    - 候选桶样本不足（``< min_samples``）→ ``hold``（在线信号不充分，交由离线复评门 R4-c 裁决）；
    - 候选 error-rate 较基线高出 ``regression_max`` → ``rollback``（候选在生产中退化）；
    - 否则 ``promote``（在线信号通过，继续离线复评门）。
    """
    if candidate_n < min_samples:
        return Decision("hold", REASON_INSUFFICIENT_SAMPLES, {"candidate_n": candidate_n})
    regression = candidate_err_rate - baseline_err_rate
    if regression > regression_max:
        return Decision(
            "rollback",
            REASON_ROLLED_BACK,
            {
                "online_err_regression": regression,
                "candidate_err": candidate_err_rate,
                "baseline_err": baseline_err_rate,
            },
        )
    return Decision("promote", None, {"online_err_regression": regression})


__all__ = [
    "Decision",
    "REASON_PROMOTED",
    "REASON_REJECTED",
    "REASON_ROLLED_BACK",
    "REASON_INSUFFICIENT_SAMPLES",
    "REASON_BOUND_VIOLATION",
    "REASON_CONCURRENT_INFLIGHT",
    "REASON_NO_CHANGE",
    "REASON_STALE_CANARY",
    "REASON_NOOP_MUTATION",
    "REASON_OSCILLATION",
    "REASON_BUDGET_PROPOSAL_CAP",
    "REASON_BUDGET_COST_CAP",
    "REASON_NO_GAIN",
    "MIN_SAMPLE_N",
    "HELPFUL_RATIO_MIN_IMPROVEMENT",
    "ZERO_HIT_REGRESSION_MAX",
    "WEIGHT_LOWER_BOUND",
    "WEIGHT_UPPER_BOUND",
    "WEIGHT_MAX_STEP",
    "DIVERSITY_REGRESSION_RATIO",
    "SKILL_GATE_MIN_CASES",
    "SKILL_GATE_VISIBLE_GAIN_MIN",
    "SKILL_HOLDOUT_REGRESSION_MAX",
    "SKILL_HOLDOUT_DRIFT_MAX",
    "SKILL_CASE_REGRESSION_DELTA",
    "SKILL_LONGITUDINAL_DRIFT_MAX",
    "SKILL_RUNTIME_CANARY_MIN_SAMPLES",
    "SKILL_RUNTIME_CANARY_ERR_REGRESSION_MAX",
    "clamp_weight",
    "is_within_bounds",
    "pre_propose_check",
    "is_noop_mutation",
    "is_repeated_direction",
    "is_canary_stale",
    "is_noop_template",
    "decide_shadow",
    "decide_canary",
    "compute_run_regression",
    "decide_skill_shadow",
    "decide_skill_canary",
    "decide_longitudinal_drift",
    "decide_safety_nonregression",
    "improvement_efficiency",
    "decide_runtime_canary_online",
]
