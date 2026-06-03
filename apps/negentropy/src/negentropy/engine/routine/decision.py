"""Routine 决策守卫 — 纯函数，无 IO，可独立单元测试。

将「何时终止 / 何时继续」的全部判定逻辑收敛于此，与编排副作用（DB / Claude Code 调用）
正交解耦。守卫均为硬编码上限（非模型自律），对齐业界对自主循环失控的防护共识
（OpenHands MAX_ITERATIONS；Claude Code --max-turns/--max-budget-usd；$47k agent loop 教训）。

参考文献：
[1] Anthropic, *Building Effective AI Agents*, 2024. "include stopping conditions
    (such as a maximum number of iterations) to maintain control."
[2] N. Shinn et al., "Reflexion," NeurIPS, 2023. 进度停滞 / 振荡的反思驱动终止。
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol


class _RoutineLike(Protocol):
    """决策所需的 Routine 只读视图（避免与 ORM 强耦合，便于测试注入）。"""

    status: str
    max_iterations: int | None
    max_cost_usd: float | None
    deadline_at: datetime | None
    success_score_threshold: int
    no_progress_patience: int
    iteration_count: int
    total_cost_usd: float
    best_score: int | None


class _IterationLike(Protocol):
    """决策所需的迭代只读视图。"""

    seq: int
    exec_status: str | None
    score: int | None
    verdict: str | None
    gate_exit_code: int | None
    metrics: dict | None


# 终止原因常量（与 Routine.termination_reason 列约定一致）
REASON_SUCCESS = "success"
REASON_MAX_ITERATIONS = "max_iterations"
REASON_MAX_COST = "max_cost"
REASON_DEADLINE = "deadline"
REASON_NO_PROGRESS = "no_progress"
REASON_OSCILLATION = "oscillation"
REASON_UNRECOVERABLE = "unrecoverable_error"

# 连续执行/评估失败达到此次数判定为不可恢复
_CONSECUTIVE_FAILURE_LIMIT = 3


@dataclass(frozen=True, slots=True)
class Decision:
    """决策结果。``action ∈ {continue, terminate}``；terminate 时携带 reason。"""

    action: str  # "continue" | "terminate"
    reason: str | None = None

    @property
    def is_terminate(self) -> bool:
        return self.action == "terminate"


def _utcnow() -> datetime:
    return datetime.now(UTC)


def pre_dispatch_check(routine: _RoutineLike, *, now: datetime | None = None) -> Decision:
    """派发新迭代前的预算守卫。

    在创建下一个迭代之前调用：若任一硬上限已触达，返回 terminate 阻止继续派发。
    """
    now = now or _utcnow()

    if routine.max_iterations is not None and routine.iteration_count >= routine.max_iterations:
        return Decision("terminate", REASON_MAX_ITERATIONS)

    if routine.max_cost_usd is not None and routine.total_cost_usd >= routine.max_cost_usd:
        return Decision("terminate", REASON_MAX_COST)

    if routine.deadline_at is not None:
        deadline = routine.deadline_at
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=UTC)
        if now >= deadline:
            return Decision("terminate", REASON_DEADLINE)

    return Decision("continue")


def decide(
    routine: _RoutineLike,
    latest: _IterationLike,
    history: list[_IterationLike],
    *,
    now: datetime | None = None,
    max_context_resets: int = 0,
) -> Decision:
    """评估后的核心决策：成功 / 终止 / 继续。

    Args:
        routine: 路由只读视图（已含本轮反规范化的 iteration_count / total_cost / best_score）。
        latest: 刚完成评估的最新迭代。
        history: 全部已评估迭代（按 seq 升序），用于停滞 / 振荡 / 连续失败判定。
        now: 注入当前时间（测试用）。
        max_context_resets: 上下文耗尽自动重置上限（>0 时，标记 ``metrics.context_exhausted``
            的失败被视为"可自愈"，不计入连续执行失败——runaway 由 Runner 侧重置计数上限兜底）。
            默认 0 = 关闭该豁免，退化为原行为（向后兼容）。纯函数边界：上限由调用方显式注入，
            decision 不读 settings。

    Returns:
        Decision。优先级：成功 > 不可恢复 > 预算/截止 > 停滞 > 振荡 > 继续。
    """
    now = now or _utcnow()

    # 1) 成功：评分达标 AND（无门控 或 门控通过）
    if latest.score is not None and latest.score >= routine.success_score_threshold:
        if latest.gate_exit_code in (None, 0):
            return Decision("terminate", REASON_SUCCESS)

    # 2) 不可恢复：judge 显式判定 / 连续执行失败 / 连续评估失败
    if latest.verdict == "unrecoverable":
        return Decision("terminate", REASON_UNRECOVERABLE)
    if _consecutive_exec_failures(history, max_context_resets=max_context_resets) >= _CONSECUTIVE_FAILURE_LIMIT:
        return Decision("terminate", REASON_UNRECOVERABLE)

    # 3) 预算 / 截止（评估后再查一次，确保本轮成本计入后即时熔断）
    budget = pre_dispatch_check(routine, now=now)
    if budget.is_terminate:
        return budget

    # 4) 进度停滞：最近 N 次评分均未超过历史最优
    if _is_no_progress(routine, history):
        return Decision("terminate", REASON_NO_PROGRESS)

    # 5) 振荡：verdict 在 progressing/regressed 间反复横跳且分数无上升趋势
    if _is_oscillating(history):
        return Decision("terminate", REASON_OSCILLATION)

    return Decision("continue")


def _consecutive_exec_failures(history: list[_IterationLike], *, max_context_resets: int = 0) -> int:
    """从尾部起连续 ``exec_status ∈ {error, timeout}`` 的迭代数。

    当 ``max_context_resets > 0`` 时，标记 ``metrics.context_exhausted`` 的失败被视为"可自愈"——
    透明跳过（既不计数也不中断扫描），因为它们会被 Runner 侧的"重置 session 冷启动"自愈。
    这避免上下文耗尽的连续失败被误判为 ``unrecoverable``；runaway 由 Runner 的
    ``reflections._context_resets`` 上限兜底（达上限后不再标记 context_exhausted，自然计入此处）。
    """
    count = 0
    for it in reversed(history):
        if it.exec_status in ("error", "timeout"):
            if max_context_resets > 0 and (getattr(it, "metrics", None) or {}).get("context_exhausted"):
                continue  # 可自愈失败：透明跳过，不计数也不 break
            count += 1
        else:
            break
    return count


def _is_no_progress(routine: _RoutineLike, history: list[_IterationLike]) -> bool:
    """最近 ``no_progress_patience`` 次评分无一超过「窗口之前」的历史最优则视为停滞。

    基线取最近窗口之前的迭代最优分（``routine.best_score`` 含窗口自身，直接比较会恒真）；
    需窗口之前另有评分历史方可能触发，不足时不判停滞（给探索留出空间）。
    """
    patience = routine.no_progress_patience
    if patience <= 0:
        return False
    scored = [it for it in history if it.score is not None]
    if len(scored) < patience:
        return False
    # 基线 = 最近窗口之前的迭代最优分；窗口内若创出新高即视为有进展。
    best = max((it.score for it in scored[:-patience]), default=None)
    if best is None:
        return False  # 窗口前无评分历史 → 不判停滞
    recent = scored[-patience:]
    return all(it.score <= best for it in recent)


def _is_oscillating(history: list[_IterationLike]) -> bool:
    """振荡判定：最近至少 4 次评分无净增长，且 verdict 在改善/退步间交替。"""
    scored = [it for it in history if it.score is not None]
    if len(scored) < 4:
        return False
    recent = scored[-4:]
    scores = [it.score for it in recent]
    # 净增长（末 - 首）非正，说明整体未推进
    net_gain = scores[-1] - scores[0]
    if net_gain > 0:
        return False
    verdicts = [it.verdict for it in recent if it.verdict in ("progressing", "regressed")]
    if len(verdicts) < 3:
        return False
    # 存在方向反转（progressing↔regressed）
    flips = sum(1 for a, b in zip(verdicts, verdicts[1:], strict=False) if a != b)
    return flips >= 2


__all__ = [
    "Decision",
    "pre_dispatch_check",
    "decide",
    "REASON_SUCCESS",
    "REASON_MAX_ITERATIONS",
    "REASON_MAX_COST",
    "REASON_DEADLINE",
    "REASON_NO_PROGRESS",
    "REASON_OSCILLATION",
    "REASON_UNRECOVERABLE",
]
