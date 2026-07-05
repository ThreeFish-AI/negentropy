"""Routine 评分轨迹分析 — 纯函数，无 IO，可独立单元测试。

为「证据锚定的纵向评估」（Anchored Longitudinal Judging）提供两类能力：
1. ``score_trajectory`` —— 把同一 Routine 已评估迭代序列编译成结构化统计
   （趋势 / 振幅 / 振荡次数 / 方向），供决策与 Judge 锚点共用；
2. ``format_anchor_context`` / ``build_anchor_audit`` —— 将轨迹渲染为注入 LLM-as-Judge
   的中文锚点段与可审计 metrics 摘要。

设计对齐 ``decision.py`` 范式：Protocol 只读视图 + frozen dataclass + 纯函数（不读 settings）。
调用方（orchestrator/evaluator/decision）显式注入参数与策略开关，本模块只负责机制。

参考文献：
[1] C. Jiang et al., "Self-Improving Agents in the Era of Experience:
    A Survey of Self- to Meta-Evolution," 2026. §8 纵向评估 / §10.3 弱反馈信用分配。
[2] N. Shinn et al., "Reflexion," NeIPS, 2023. 跨迭代自反思。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

# direction 启发式阈值（模块级常量，内部调参不外露）
_OSC_AMPLITUDE_MIN = 15  # 窗口内 max-min ≥ 此值且方向反转足够 → 视为振荡
_OSC_FLIPS_MIN = 2
_SLOPE_IMPROVING = 1.0
_SLOPE_DECLINING = -1.0

DIRECTION_INSUFFICIENT = "insufficient"
DIRECTION_IMPROVING = "improving"
DIRECTION_DECLINING = "declining"
DIRECTION_OSCILLATING = "oscillating"
DIRECTION_FLAT = "flat"


class _IterationLike(Protocol):
    """轨迹分析所需的迭代只读视图（结构化鸭子类型，不与 decision 的 Protocol 耦合）。"""

    seq: int
    score: int | None
    verdict: str | None


@dataclass(frozen=True, slots=True)
class TrajectoryStats:
    """评分轨迹统计快照。

    - ``best`` 取自 **全量** floored history（非仅窗口）——锚点要展示「本次尝试历史最优」；
    - ``net_gain`` / ``slope`` / ``amplitude`` / ``flips`` 仅在最近 ``window`` 窗口内统计；
    - ``delta`` = ``last`` - ``prev``（相邻两轮变化，锚点一致性约束的参照）。
    """

    n_scored: int
    best: int | None
    last: int | None
    prev: int | None
    delta: int | None
    net_gain: int | None
    slope: float | None
    amplitude: int | None
    flips: int
    direction: str


def score_trajectory(history: list[_IterationLike], *, window: int = 5) -> TrajectoryStats:
    """把已评估迭代序列编译成 ``TrajectoryStats``。

    Args:
        history: 已评估迭代（按 seq 升序）；调用方负责 floor 过滤（重启后旧迭代不进锚点）。
        window: 窗口统计（net_gain/slope/amplitude/flips）取最近 K 轮；``best`` 仍取全量。
    """
    scored = [it for it in history if it.score is not None]
    n_scored = len(scored)
    if n_scored == 0:
        return TrajectoryStats(
            n_scored=0,
            best=None,
            last=None,
            prev=None,
            delta=None,
            net_gain=None,
            slope=None,
            amplitude=None,
            flips=0,
            direction=DIRECTION_INSUFFICIENT,
        )

    best = max(it.score for it in scored)  # type: ignore[arg-type]
    last = scored[-1].score
    prev = scored[-2].score if n_scored >= 2 else None
    delta = (last - prev) if (last is not None and prev is not None) else None

    w = max(1, window)
    window_scores = [it.score for it in scored[-w:]]  # type: ignore[misc]
    net_gain, slope, amplitude, flips = _window_stats(window_scores)
    direction = _classify(n_scored, slope, amplitude, flips)

    return TrajectoryStats(
        n_scored=n_scored,
        best=best,
        last=last,
        prev=prev,
        delta=delta,
        net_gain=net_gain,
        slope=slope,
        amplitude=amplitude,
        flips=flips,
        direction=direction,
    )


def _window_stats(scores: list[int]) -> tuple[int | None, float | None, int | None, int]:
    """窗口内：净变化 / 最小二乘斜率 / 振幅 / 相邻非零 delta 符号反转次数。"""
    n = len(scores)
    if n == 0:
        return None, None, None, 0
    amplitude = max(scores) - min(scores)
    if n < 2:
        return None, None, amplitude, 0
    net_gain = scores[-1] - scores[0]
    # 最小二乘斜率：x 为索引 0..n-1
    xs = list(range(n))
    mx = sum(xs) / n
    my = sum(scores) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, scores, strict=True))
    den = sum((x - mx) ** 2 for x in xs)
    slope = num / den if den else 0.0
    # flips：相邻 delta 符号反转（零 delta 跳过）
    deltas = [scores[i + 1] - scores[i] for i in range(n - 1)]
    flips = 0
    prev_sign = 0
    for d in deltas:
        sign = (d > 0) - (d < 0)
        if sign == 0:
            continue
        if prev_sign != 0 and sign != prev_sign:
            flips += 1
        prev_sign = sign
    return net_gain, slope, amplitude, flips


def _classify(n: int, slope: float | None, amplitude: int | None, flips: int) -> str:
    """方向启发式（顺序敏感）：不足 → 振荡 → 上升 → 下降 → 平坦。

    振荡优先于斜率：高振幅 + 多次反转的轨迹即便带趋势，本质仍是振荡（ISSUE-128 真实轨迹即此）。
    """
    if n < 2 or slope is None:
        return DIRECTION_INSUFFICIENT
    if (amplitude or 0) >= _OSC_AMPLITUDE_MIN and flips >= _OSC_FLIPS_MIN:
        return DIRECTION_OSCILLATING
    if slope > _SLOPE_IMPROVING:
        return DIRECTION_IMPROVING
    if slope < _SLOPE_DECLINING:
        return DIRECTION_DECLINING
    return DIRECTION_FLAT


def format_anchor_context(
    history: list[_IterationLike],
    *,
    window: int = 5,
    reflection_max_chars: int = 200,
) -> str:
    """渲染注入 Judge prompt 的中文锚点段。

    无任何有分历史 → 返回 ``""``（调用方据此回退原模板，保证逐字节兼容）。
    需要迭代对象带 ``phase`` / ``reflection`` 属性（缺失则宽容降级）。
    """
    scored = [it for it in history if it.score is not None]
    if not scored:
        return ""

    stats = score_trajectory(history, window=window)
    w = max(1, window)
    recent = scored[-w:]

    lines: list[str] = []
    for it in recent:
        phase = getattr(it, "phase", None) or "?"
        verdict = it.verdict or "N/A"
        lines.append(f"- 第 {it.seq} 轮[{phase}]：{it.score} 分（{verdict}）")
    trajectory_lines = "\n".join(lines)

    best_line = f"本次尝试历史最优：{stats.best} 分"
    prev_line = ""
    if stats.prev is not None:
        prev_verdict = recent[-2].verdict if len(recent) >= 2 else scored[-2].verdict
        prev_line = f"；上一轮：{stats.prev} 分（{prev_verdict or 'N/A'}）"

    stats_line = (
        f"近 {len(recent)} 轮统计：净变化 {stats.net_gain:+d}，振幅 {stats.amplitude}，趋势 {stats.direction}。"
        if stats.net_gain is not None and stats.amplitude is not None
        else ""
    )

    prev_reflection = getattr(recent[-1], "reflection", None) or ""
    reflection_block = ""
    if prev_reflection:
        reflection_block = f"\n上一轮给执行者的改进建议：\n「{prev_reflection[:reflection_max_chars]}」"

    sections = [
        "# 评分轨迹（历史锚点）",
        "这不是一次孤立评估：同一执行者正在同一任务上连续迭代改进，"
        f"以下是其最近 {len(recent)} 轮的评估轨迹（按时间先后）：",
        trajectory_lines,
        best_line + prev_line + ("。" if not stats_line else "") + stats_line,
    ]
    if reflection_block:
        sections.append(reflection_block)
    return "\n".join(s for s in sections if s)


def build_anchor_audit(
    history: list[_IterationLike],
    *,
    window: int = 5,
    reflection_max_chars: int = 200,
) -> dict:
    """构造写入 ``RoutineIteration.metrics`` 的锚点审计摘要（JSONB 友好）。"""
    scored = [it for it in history if it.score is not None]
    stats = score_trajectory(history, window=window)
    w = max(1, window)
    recent = scored[-w:]

    prev_reflection = getattr(recent[-1], "reflection", None) if recent else None
    prev_verdict = recent[-2].verdict if len(recent) >= 2 else (scored[-2].verdict if len(scored) >= 2 else None)

    return {
        "window": w,
        "n_scored": stats.n_scored,
        "trajectory": [[it.seq, it.score, it.verdict] for it in recent],
        "best": stats.best,
        "prev_score": stats.prev,
        "prev_verdict": prev_verdict,
        "stats": {
            "net_gain": stats.net_gain,
            "slope": round(stats.slope, 2) if stats.slope is not None else None,
            "amplitude": stats.amplitude,
            "flips": stats.flips,
            "direction": stats.direction,
        },
        "prev_reflection_excerpt": (prev_reflection or "")[:reflection_max_chars] or None,
    }


__all__ = [
    "TrajectoryStats",
    "score_trajectory",
    "format_anchor_context",
    "build_anchor_audit",
    "DIRECTION_INSUFFICIENT",
    "DIRECTION_IMPROVING",
    "DIRECTION_DECLINING",
    "DIRECTION_OSCILLATING",
    "DIRECTION_FLAT",
]
