"""Routine prompt 构建 — 目标 + 验收标准 + 累积反思（Reflexion 注入）。

闭环中 Executor（Claude Code）通过 ``resume_session_id`` 保有自身工作上下文；
本模块注入的是 Evaluator 产出的「外部反馈」——历次迭代的反思，使下一次执行
针对性地修正已知缺陷。这正是 Reflexion 的 episodic replay 机制。

参考文献：
[1] N. Shinn et al., "Reflexion: Language Agents with Verbal Reinforcement Learning,"
    NeurIPS, 2023. arXiv:2303.11366.
"""

from __future__ import annotations

from typing import Any, Protocol

from .phase import PHASE_FINALIZE, PHASE_IMPLEMENT, PHASE_PLAN


class _RoutineLike(Protocol):
    goal: str
    acceptance_criteria: str
    reflections: dict[str, Any]
    claude_session_id: str | None
    current_phase: str


def build_prompt(routine: _RoutineLike, *, max_reflections: int = 5) -> str:
    """构建发送给 Claude Code 的迭代 prompt（按相位分支）。

    通用部分：目标 + 验收标准 + 最近 N 条反思（Reflexion 注入，来自
    ``routine.reflections["items"]``）。尾部指令依相位而定：

    - PLAN     仅产出方案、禁写盘（plan 模式），待人工审批；
    - FINALIZE 自检 ruff/pytest、修复、建 PR 并回带 ``PR_URL=`` sentinel；
    - IMPLEMENT（含扁平工作流）首轮「开始」/续接「继续」—— 与相位化前一致。
    """
    phase = getattr(routine, "current_phase", PHASE_IMPLEMENT) or PHASE_IMPLEMENT
    is_resume = bool(routine.claude_session_id)

    parts: list[str] = [
        f"# 目标 (Goal)\n{routine.goal.strip()}",
        f"# 验收标准 (Acceptance Criteria)\n{routine.acceptance_criteria.strip()}",
    ]

    reflections = _recent_reflections(routine, max_reflections)
    if reflections:
        bullet = "\n".join(f"- {r}" for r in reflections)
        parts.append(
            "# 既往迭代的反馈 (Feedback from previous attempts)\n"
            "以下是对你此前尝试的评估反馈，请逐条针对性改进：\n" + bullet
        )

    if phase == PHASE_PLAN:
        parts.append(
            "# 规划 (Plan ONLY)\n本轮**仅产出实现方案，禁止写入或修改任何文件**（plan 模式）：\n"
            "请给出正交分解维度、改动清单、预计爆炸半径与验证策略。\n"
            "方案将提交人工审批，通过后再进入实现阶段。"
        )
    elif phase == PHASE_FINALIZE:
        parts.append(
            "# 收尾 (Finalize)\n验收标准已达标，现进行收尾交付：\n"
            "1. 运行 `uv run ruff check` 与 `uv run pytest`，修复全部失败；\n"
            "2. `git add -A` 后按仓库规范 `git commit`（切勿推送 master/main 等主分支）；\n"
            "3. 若当前分支已存在 PR 则复用，否则用 `gh pr create` 基于工作分支创建 PR"
            "（标题+正文概述变更，base 为基础分支）；\n"
            "4. **在最终回复的第一行单独输出 `PR_URL=<完整链接>`**（务必置顶，以便系统捕获）；\n"
            "5. 不要自行合并 PR —— 合并由人工完成。"
        )
    elif is_resume:
        parts.append("# 继续 (Continue)\n请在既有会话上下文基础上继续推进，聚焦上述反馈中尚未满足的验收标准项。")
    else:
        parts.append("# 开始 (Start)\n请着手完成上述目标，确保产出可被验收标准客观检验。")

    return "\n\n".join(parts)


def _recent_reflections(routine: _RoutineLike, limit: int) -> list[str]:
    """取最近 ``limit`` 条反思文本（顺序保持，旧→新）。"""
    raw = (routine.reflections or {}).get("items", [])
    if not isinstance(raw, list):
        return []
    items = [str(x).strip() for x in raw if str(x).strip()]
    if limit > 0:
        items = items[-limit:]
    return items


def append_reflection(reflections: dict[str, Any] | None, reflection: str) -> dict[str, Any]:
    """向反思记忆追加一条；返回新 dict（不原地修改，便于 ORM 变更检测）。

    JSONB 列原地 mutate 不会被 SQLAlchemy 标脏，故必须整体重赋值。
    """
    text = (reflection or "").strip()
    existing = list((reflections or {}).get("items", []))
    if text:
        existing.append(text)
    return {"items": existing}


__all__ = ["build_prompt", "append_reflection"]
