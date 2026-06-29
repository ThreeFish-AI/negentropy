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
    stage: str | None = None,
    kb_retrieval: bool = False,
) -> str:
    """构建发送给 Claude Code 的迭代 prompt（按相位/段分支）。

    通用部分：目标 + 验收标准 + [记忆上下文] + [知识库检索引导] + 最近 N 条反思
    （Reflexion 注入，来自 ``routine.reflections["items"]``）。尾部指令依相位而定：

    - PLAN     仅产出方案、禁写盘（plan 模式），提交评审；
    - FINALIZE 自检 ruff/pytest、修复、建 PR 并回带 ``PR_URL=`` sentinel；
    - IMPLEMENT（含扁平工作流）首轮「开始」/续接「继续」—— 与相位化前一致。

    Args:
        routine: Routine-like 对象
        max_reflections: 注入的最近反思条数
        memory_context: 可选的记忆上下文文本（来自 Memory Module 检索）
        stage: 显式覆盖本次 prompt 的「段」。统一闭环（``plan_review_unified_loop``）下，引擎在
            同一迭代内先以 ``stage=PHASE_PLAN`` 取 plan 段 prompt（ExitPlanMode/AskUserQuestion 均
            被评审），批准后以默认（``stage=None`` → 按 ``current_phase``）取 implement 段 prompt。
            为空时沿用旧逻辑（相位由 ``routine.current_phase`` 决定）。
        kb_retrieval: 引擎内置知识库检索 MCP 是否可用（``kb_mcp_available()``）。
            为 True 时注入「知识库检索」段落：介绍 ``mcp__knowledge__*`` 工具与引用要求。
    """
    # 显式 plan 段（统一闭环）：prompt 漏斗到 AskUserQuestion 提交；ExitPlanMode 仍被钩子真实评审作安全网。
    unified_plan = stage == PHASE_PLAN
    phase = stage or getattr(routine, "current_phase", PHASE_IMPLEMENT) or PHASE_IMPLEMENT
    is_resume = bool(routine.claude_session_id)
    worktree = is_worktree_routine(routine)

    parts: list[str] = [
        f"# 目标 (Goal)\n{routine.goal.strip()}",
        f"# 验收标准 (Acceptance Criteria)\n{routine.acceptance_criteria.strip()}",
    ]

    # 记忆注入：在验收标准之后插入经验知识上下文（由编排器在派发时检索）。
    # 每条记忆行已带 Memory id 短码与日期（见 orchestrator._retrieve_memory_context），
    # 此处同步给出引用要求，使产出可溯源（引用来源 + 原文摘录）。
    if memory_context:
        parts.append(
            "# 相关经验记忆 (Relevant Past Knowledge)\n"
            "以下是你此前自主任务中积累的经验记忆（每条带 Memory id 与日期），请参考但不必盲从。\n"
            "**引用要求**：当你的方案、结论或总结实际使用了某条记忆时，必须标注其来源\n"
            "（格式：`依据 Memory <id8> (<日期>)`）并附该记忆的原文短摘录（≤ 50 字，引号括起）；\n"
            "未使用的记忆无需提及，严禁假装引用不存在的记忆。\n" + memory_context
        )

    # 知识库检索引导：引擎内置 MCP 可用时注入（kb_mcp_available()，由编排器在派发时判定）。
    # 工具结果自带 citation 元数据，此处给出引用要求使产出可溯源（引用来源 + 原文摘录）。
    if kb_retrieval:
        parts.append(
            "# 知识库检索 (Knowledge Base Retrieval)\n"
            "你可调用系统知识库 MCP 工具检索内部沉淀的知识与文献：\n"
            "- `mcp__knowledge__kb_search(query, top_k, corpus_filter?, search_mode?)`："
            "混合检索（语义+关键词），返回带引用元数据的原文片段；\n"
            "- `mcp__knowledge__kg_search_global(query, corpus_filter?, max_communities?)`："
            "「主题概览/整体趋势」类问题的知识图谱全局摘要。\n"
            "**引用要求（重要）**：\n"
            "1. 产出中引用检索结果时，正文以 `[N]`（结果的 `citation_id`）标注，"
            "文末附 `formatted_citation` 原样列表；\n"
            "2. 引述原文必须取自结果的 `snippet` 字段并注明 `source_uri`，"
            "不得凭记忆转述或虚构；\n"
            "3. 检索无结果（count=0）时如实说明「知识库无相关记录」，严禁编造来源。"
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

    if phase == PHASE_PLAN and unified_plan:
        # 统一闭环 plan 段：方案提交**统一漏斗到 AskUserQuestion**（确定性载体，全文写 question 字段）；
        # ExitPlanMode 仍被钩子真实评审作兜底安全网（CC 反射误调也不会绕过评审），但 prompt 不引导其使用。
        parts.append(
            "# 规划 (Plan ONLY)\n本段**仅产出实现方案，禁止写入或修改任何文件**（plan 模式）：\n"
            "请给出正交分解维度、改动清单、预计爆炸半径与验证策略。\n\n"
            "**提交审阅（重要）**：完成方案后，调用 **AskUserQuestion** 工具把方案提交给 NegentropyEngine 审阅。\n"
            "  - 把你的**完整方案全文写入该工具的 `question` 字段**（审阅者只读取该字段，故方案务必完整自包含）；\n"
            "  - **必须**同时提供 `options`，设为「批准方案」与「需要完善」两项"
            "（缺少 `options` 该工具调用会直接报错）；\n"
            "  - **不要调用 ExitPlanMode**（plan 模式无头环境下它必报错、徒增空转）。\n"
            "NegentropyEngine 将在**同一轮内**通过该工具的返回结果直接给你审阅反馈：\n"
            "  - 若返回「🔄 需完善」：请据反馈**修订方案后再次调用 AskUserQuestion 提交审阅**，直至通过；\n"
            "  - 若返回「✅ 已通过/已批准」：请**直接结束本轮回复**，**不要再调用任何工具**——"
            "引擎将在**同一迭代内**自动续接你的会话进入实施阶段（headless 下勿自行退出 plan 模式或写文件）。"
        )
    elif phase == PHASE_PLAN:
        # Legacy（统一闭环关、phased PLAN 相位）：仅 AskUserQuestion 被评审，ExitPlanMode 自动放行。
        parts.append(
            "# 规划 (Plan ONLY)\n本轮**仅产出实现方案，禁止写入或修改任何文件**（plan 模式）：\n"
            "请给出正交分解维度、改动清单、预计爆炸半径与验证策略。\n\n"
            "**提交审阅（重要）**：完成方案后，调用 **AskUserQuestion** 工具提交给 NegentropyEngine 审阅。\n"
            "  - 把你的**完整方案全文写入该工具的 `question` 字段**（审阅者只读取该字段，故方案务必完整自包含）；\n"
            "  - `options` 设为「批准方案」与「需要完善」两项。\n"
            "NegentropyEngine 将在**同一轮内**通过该工具的返回结果直接给你审阅反馈：\n"
            "  - 若返回「✅ 已通过/已批准」：请**直接结束本轮回复**，**不要调用 ExitPlanMode 或任何工具**——"
            "引擎会自动推进到实施阶段并派发实施迭代（plan 模式下 ExitPlanMode 在无头环境必报错、徒增空转）；\n"
            "  - 若返回「🔄 需完善」：请据反馈**修订方案后再次调用 AskUserQuestion 提交审阅**，直至通过。"
        )
    elif phase == PHASE_FINALIZE and worktree:
        # worktree routine：注入引擎确定性计算的具体分支名（base / head），CC 执行 push + 建 PR。
        base = normalize_base_branch(getattr(routine, "baseline_branch", "") or "", settings.routine.git_remote)
        wb = getattr(routine, "work_branch", None) or "<work_branch>"
        parts.append(
            "# 收尾 (Finalize)\n验收标准已达标，现在隔离 worktree 内进行收尾交付：\n"
            f"0. **先判定有无可交付改动**：`git rev-list --count {base}..HEAD`——\n"
            "   - 输出为 `0`（无提交，如本文档已达标、本轮未改任何代码）：**跳过下列 push/PR**，"
            "在最终回复**第一行**单独输出 `PR_URL=NONE`（无代码交付）后直接收尾——"
            "引擎据 worktree 相对基线 0 提交判定为 clean no-op 成功，无需 PR；\n"
            "   - 输出 ≥ `1`：继续下列建 PR 步骤；\n"
            "1. 运行 `uv run ruff check` 与 `uv run pytest`，修复全部失败；\n"
            "2. `git add -A` 后按仓库规范 `git commit`（**切勿**推送 master/main 等主分支）；\n"
            f"3. 推送工作分支到远端：`git push -u origin {wb}`；\n"
            f"4. **PR 复用优先**：先查该工作分支是否已有 PR——`gh pr view {wb} --json url -q .url`；\n"
            "   - 若已输出链接，**直接复用该链接**，切勿再 `gh pr create`"
            "（head 分支已有 PR 时 `gh pr create` 会报错，导致收尾失败）；\n"
            f"   - 仅当**无**既存 PR 时才创建："
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
