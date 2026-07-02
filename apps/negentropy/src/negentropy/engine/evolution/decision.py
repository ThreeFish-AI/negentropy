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


def pre_propose_check(*, inflight_count: int, max_inflight: int = 1) -> Decision:
    """派发新提案前守卫：单在途（每 target 至多 max_inflight 个非终态提案）。"""
    if inflight_count >= max_inflight:
        return Decision("skip", REASON_CONCURRENT_INFLIGHT, {"inflight": inflight_count})
    return Decision("hold")


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
) -> Decision:
    """金丝雀窗口结束判定：双确认（在线指标）→ promote；任一退化 → rollback。

    样本不足 → ``hold``（继续等，不立即 rollback，给 canary 攒样本的时间）。
    门槛比 shadow 宽：helpful_ratio 允许 0 改进（只要不下降）。
    """
    if candidate.sample_n < min_samples:
        return Decision("hold", REASON_INSUFFICIENT_SAMPLES, {"candidate_n": candidate.sample_n})
    zhr_regression = candidate.zero_hit_rate - baseline.zero_hit_rate
    hr_gain = candidate.helpful_ratio - baseline.helpful_ratio
    if zhr_regression > zero_hit_regression_max:
        return Decision("rollback", REASON_ROLLED_BACK, {"zhr_regression": zhr_regression})
    if hr_gain < 0:
        return Decision("rollback", REASON_ROLLED_BACK, {"hr_gain": hr_gain})
    return Decision("promote", REASON_PROMOTED, {"hr_gain": hr_gain, "zhr_regression": zhr_regression})


__all__ = [
    "Decision",
    "REASON_PROMOTED",
    "REASON_REJECTED",
    "REASON_ROLLED_BACK",
    "REASON_INSUFFICIENT_SAMPLES",
    "REASON_BOUND_VIOLATION",
    "REASON_CONCURRENT_INFLIGHT",
    "REASON_NO_CHANGE",
    "MIN_SAMPLE_N",
    "HELPFUL_RATIO_MIN_IMPROVEMENT",
    "ZERO_HIT_REGRESSION_MAX",
    "WEIGHT_LOWER_BOUND",
    "WEIGHT_UPPER_BOUND",
    "WEIGHT_MAX_STEP",
    "clamp_weight",
    "is_within_bounds",
    "pre_propose_check",
    "decide_shadow",
    "decide_canary",
]
