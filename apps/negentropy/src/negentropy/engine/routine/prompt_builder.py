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

from negentropy.config import settings

from .phase import PHASE_FINALIZE, PHASE_IMPLEMENT, PHASE_PLAN, is_worktree_routine
from .workspace import normalize_base_branch


class _RoutineLike(Protocol):
    goal: str
    acceptance_criteria: str
    reflections: dict[str, Any]
    claude_session_id: str | None
    current_phase: str
    baseline_branch: str | None
    work_branch: str | None
    cwd: str | None


def build_prompt(
    routine: _RoutineLike,
    *,
    max_reflections: int = 5,
    memory_context: str | None = None,
) -> str:
    """构建发送给 Claude Code 的迭代 prompt（按相位分支）。

    通用部分：目标 + 验收标准 + [记忆上下文] + 最近 N 条反思（Reflexion 注入，来自
    ``routine.reflections["items"]``）。尾部指令依相位而定：

    - PLAN     仅产出方案、禁写盘（plan 模式），待人工审批；
    - FINALIZE 自检 ruff/pytest、修复、建 PR 并回带 ``PR_URL=`` sentinel；
    - IMPLEMENT（含扁平工作流）首轮「开始」/续接「继续」—— 与相位化前一致。

    Args:
        routine: Routine-like 对象
        max_reflections: 注入的最近反思条数
        memory_context: 可选的记忆上下文文本（来自 Memory Module 检索）
    """
    phase = getattr(routine, "current_phase", PHASE_IMPLEMENT) or PHASE_IMPLEMENT
    is_resume = bool(routine.claude_session_id)
    worktree = is_worktree_routine(routine)

    parts: list[str] = [
        f"# 目标 (Goal)\n{routine.goal.strip()}",
        f"# 验收标准 (Acceptance Criteria)\n{routine.acceptance_criteria.strip()}",
    ]

    # 记忆注入：在验收标准之后插入经验知识上下文（由编排器在派发时检索）。
    if memory_context:
        parts.append(
            "# 相关经验记忆 (Relevant Past Knowledge)\n"
            "以下是你此前自主任务中积累的经验知识，请参考但不必盲从：\n" + memory_context
        )

    # 隔离工作区上下文（worktree routine 各相位通用）：约束 CC 仅在隔离 worktree 内改动，
    # 严禁切换/推送基线或 master/main。work_branch 在首个 launch 前由引擎创建写入。
    if worktree:
        baseline = getattr(routine, "baseline_branch", None) or "(baseline)"
        work_branch = getattr(routine, "work_branch", None)
        parts.append(
            "# 隔离工作区 (Isolated Worktree)\n你正在一个隔离 git worktree（当前工作目录）中工作：\n"
            f"- 工作分支：`{work_branch or '（引擎将基于基线创建）'}`\n"
            f"- 基线分支：`{baseline}`\n\n"
            "## 作用域限制 (Scope Constraints)\n"
            "**读取范围**：仅允许读取以下目录中的文件：\n"
            "   1. 当前工作目录（worktree）及其子目录\n"
            "   2. Goal 中通过绝对路径明确引用的外部目录（仅限引用处）\n"
            "**绝不**浏览、列出或读取工作目录的兄弟目录、父目录的其他子项目、"
            "源项目目录、或任何与任务无关的本地文件系统路径。\n"
            "worktree 包含基线分支的完整检出，无需引用源项目。\n\n"
            "**写入范围**：仅在当前工作目录内改动；"
            "**绝不**切换分支、推送或污染基线分支与 master/main。\n\n"
            "**例外**：WebSearch、WebFetch 等 internet 工具不受此限制。"
        )

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
            "请给出正交分解维度、改动清单、预计爆炸半径与验证策略。\n\n"
            "**重要**：当你完成实现方案后，请使用 AskUserQuestion 工具提交方案等待审阅，"
            '询问："Plan 已完成，请审阅。"\n'
            "审阅者（NegentropyEngine）将评审你的方案并给出反馈：\n"
            "- 若方案通过审阅，你将收到批准指令，此时直接退出 Plan 模式即可；\n"
            "- 若方案需要完善，你将收到具体的修改建议，请据此继续完善方案后再次提交审阅。"
        )
    elif phase == PHASE_FINALIZE and worktree:
        # worktree routine：注入引擎确定性计算的具体分支名（base / head），CC 执行 push + 建 PR。
        base = normalize_base_branch(getattr(routine, "baseline_branch", "") or "", settings.routine.git_remote)
        wb = getattr(routine, "work_branch", None) or "<work_branch>"
        parts.append(
            "# 收尾 (Finalize)\n验收标准已达标，现在隔离 worktree 内进行收尾交付：\n"
            "1. 运行 `uv run ruff check` 与 `uv run pytest`，修复全部失败；\n"
            "2. `git add -A` 后按仓库规范 `git commit`（**切勿**推送 master/main 等主分支）；\n"
            f"3. 推送工作分支到远端：`git push -u origin {wb}`；\n"
            f"4. 若该分支已存在 PR 则复用，否则创建："
            f"`gh pr create --base {base} --head {wb} --title <简洁标题> --body <变更概述>`；\n"
            "5. **在最终回复的第一行单独输出 `PR_URL=<完整链接>`**（务必置顶，以便系统捕获）；\n"
            "6. 不要自行合并 PR —— 合并由人工完成。"
        )
    elif phase == PHASE_FINALIZE:
        # 旧扁平 routine（无 baseline）：保留泛化收尾文案。
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

    # worktree routine 的 IMPLEMENT 相位迭代检查点：每轮收尾提交，避免长任务进度仅以未提交工作树
    # 形态滞留（worktree 若被重建/清理则丢失），并为后续 FINALIZE 建 PR / 人工审查留存 git 历史。
    # 仅提交、不推送——推送与建 PR 是 FINALIZE 相位的职责。
    if worktree and phase == PHASE_IMPLEMENT:
        parts.append(
            "# 迭代检查点 (Checkpoint Commit)\n"
            "本轮改动完成后，在隔离 worktree 内执行 `git add -A && git commit`（按仓库规范写 message）"
            "将进度提交到当前工作分支：\n"
            "- **务必提交**——跨迭代保留成果、防 worktree 重建致工作丢失，并为收尾建 PR 留存提交历史；\n"
            "- **切勿**推送（`git push`）、**切勿**切换或污染基线/master/main 分支（推送与建 PR 属 FINALIZE 相位）；\n"
            "- 无实质改动则跳过提交即可。"
        )

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
