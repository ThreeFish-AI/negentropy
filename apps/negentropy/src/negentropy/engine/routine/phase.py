"""Routine 相位状态机 — 纯函数/常量，无 IO，可独立单元测试。

将「相位」概念正交收敛于此：相位决定 Claude Code 的 permission_mode、prompt 形态与
SUCCESS 语义的解释方式。相位推进的副作用（DB 写、终止判定）留在 orchestrator。

相位语义（仅 ``workflow=phased`` 的 routine 启用三相位推进）::

    PLAN ──(产出计划, plan 模式)──► IMPLEMENT ──(score≥阈值且gate通过)──► FINALIZE ──(捕获 PR)──► succeeded

扁平工作流（默认）：routine 自始至终处于 IMPLEMENT 相位，行为与相位化前完全一致
（无 plan-only 首轮、无 PR 收尾，IMPLEMENT 命中成功即终止 succeeded）。

参考文献：
[1] Anthropic, *Building Effective AI Agents*, 2024. Orchestrator-Workers / Evaluator-Optimizer。
"""

from __future__ import annotations

import re
from typing import Any

PHASE_PLAN = "plan"
PHASE_IMPLEMENT = "implement"
PHASE_FINALIZE = "finalize"

# 相位 → claude permission_mode：PLAN 仅规划禁写；IMPLEMENT/FINALIZE 需落盘。
_PERM_BY_PHASE = {
    PHASE_PLAN: "plan",
    PHASE_IMPLEMENT: "acceptEdits",
    PHASE_FINALIZE: "acceptEdits",
}

# PR 链接捕获：优先约定 sentinel ``PR_URL=<链接>``，兜底裸 GitHub PR URL。
# sentinel 要求 ``https://`` 前缀（防御畸形/非 URL 值被当作成功信号）。
_PR_URL_RE = re.compile(r"PR_URL=(https?://\S+)")
_PR_URL_FALLBACK_RE = re.compile(r"https://github\.com/[^\s)\]]+/pull/\d+")


def is_phased(config: dict[str, Any] | None) -> bool:
    """该 routine 是否启用 PLAN 前置相位（plan→implement→finalize 三相位）。

    注意：PLAN 前置相位仍是 opt-in（``config.workflow=='phased'``）。FINALIZE（push+PR）终止步
    则由 ``is_worktree_routine`` 决定是否通用——见其文档。
    """
    return bool(config) and config.get("workflow") == "phased"


def is_worktree_routine(routine: Any) -> bool:
    """该 routine 是否启用隔离 worktree + 通用 FINALIZE/PR（判定式 = ``baseline_branch`` 非空）。

    worktree routine：引擎基于 ``baseline_branch`` 建隔离 worktree，CC 在其中工作，收尾以 PR 回基线。
    其相位机始终启用——IMPLEMENT 命中成功推进 FINALIZE（不再直接 succeeded），FINALIZE 捕获 PR 才
    succeeded；PLAN 前置相位是否启用仍取决于 ``is_phased``。``baseline_branch`` 为空者（未回填的旧行）
    退回旧扁平终止语义，并会被 API 的 start 守卫拦截，安全过渡。
    """
    return bool(getattr(routine, "baseline_branch", None))


def initial_phase(config: dict[str, Any] | None) -> str:
    """创建时的初始相位：phased → PLAN；否则（扁平）→ IMPLEMENT。"""
    return PHASE_PLAN if is_phased(config) else PHASE_IMPLEMENT


def permission_mode_for(phase: str) -> str:
    """相位对应的 claude permission_mode（未知相位兜底 acceptEdits）。"""
    return _PERM_BY_PHASE.get(phase, "acceptEdits")


def extract_pr_url(text: str | None) -> str | None:
    """从 Claude Code 最终回复中提取 PR 链接（sentinel 优先，裸链接兜底）。"""
    if not text:
        return None
    m = _PR_URL_RE.search(text)
    if m:
        return m.group(1).rstrip(".,)]")
    m = _PR_URL_FALLBACK_RE.search(text)
    return m.group(0) if m else None


__all__ = [
    "PHASE_PLAN",
    "PHASE_IMPLEMENT",
    "PHASE_FINALIZE",
    "is_phased",
    "is_worktree_routine",
    "initial_phase",
    "permission_mode_for",
    "extract_pr_url",
]
