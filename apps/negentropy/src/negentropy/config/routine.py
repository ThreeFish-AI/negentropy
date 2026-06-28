"""Routine 子系统配置 — 长周期自主任务迭代执行。

承载 Routine 编排循环（Evaluator-Optimizer + Reflexion）的配置开关与默认预算。
特性默认关闭（``enabled=False``），灰度开启后由 ``routine_inspector`` 心跳驱动。

env 前缀 ``NE_ROUTINE_``；YAML 节点 ``routine:``。

参考文献：
[1] Anthropic, *Building Effective AI Agents*, 2024. Evaluator-Optimizer 工作流。
[2] N. Shinn et al., "Reflexion: Language Agents with Verbal Reinforcement Learning,"
    in *Proc. NeurIPS*, 2023. arXiv:2303.11366. 跨迭代自反思记忆。
"""

from __future__ import annotations

from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, PydanticBaseSettingsSource, SettingsConfigDict


class RoutineSettings(BaseSettings):
    """Routine 编排循环配置。

    Inspector 心跳间隔、并发上限、崩溃恢复 lease、评估器重试、默认预算等。
    所有运行期硬约束（守卫）均在代码层强制，配置仅提供默认值与调优旋钮。
    """

    model_config = SettingsConfigDict(
        env_prefix="NE_ROUTINE_",
        env_nested_delimiter="__",
        extra="ignore",
        frozen=True,
    )

    enabled: bool = Field(
        default=False,
        description="是否启用 Routine 编排循环（默认关闭，灰度开启）。关闭时 inspector handler 直接 no-op。",
    )
    capture_events: bool = Field(
        default=True,
        description="是否捕获并持久化迭代「全过程」动作级审计事件（工具调用/结果/评估），并经 SSE 实时推送。",
    )
    inspector_interval_seconds: int = Field(
        default=25, ge=5, le=600, description="routine_inspector 心跳 tick 间隔（秒）"
    )
    max_concurrent_executions: int = Field(
        default=2, ge=1, le=32, description="全局并发 Claude Code 执行上限（进程内信号量）"
    )
    lease_slack_seconds: int = Field(
        default=60, ge=10, description="Runner lease 宽裕量：lease = 执行超时 + 此值，用于崩溃恢复 reaper 判定"
    )
    gate_timeout_seconds: int = Field(default=120, ge=10, description="verification_command 命令门控执行超时（秒）")
    checkpoint_commit_enabled: bool = Field(
        default=True,
        description="worktree routine 每个成功 IMPLEMENT/FINALIZE 迭代后，引擎确定性 auto-commit 检查点"
        "（git add -A && git commit，仅本地不推送）。防 worktree 丢失致进度损毁、为 PR 留存提交历史；"
        "不依赖 CC 遵循 prompt 指令（ISSUE-114）。",
    )
    acceptance_unmet_score_cap: int = Field(
        default=0,
        ge=0,
        le=100,
        description="验收未达成（Judge 报 acceptance_met=false）时的确定性评分上限；0=关闭（默认，"
        "退化原行为）。>0 时把「未满足 Acceptance 即封顶」由散文规则提升为引擎机制，防小模型评分越线。"
        "per-routine 可经 config.acceptance_unmet_score_cap 覆盖。",
    )
    max_reflections_injected: int = Field(
        default=5, ge=1, le=50, description="注入下一次迭代 prompt 的最近反思条数（Reflexion 窗口）"
    )
    eval_failure_patience: int = Field(
        default=3, ge=1, description="评估器连续失败容忍次数，超过则终止 routine 为 unrecoverable_error"
    )
    evaluate_judge_timeout_seconds: int = Field(
        default=60,
        ge=10,
        le=600,
        description="LLM-as-Judge 单次调用显式超时（秒）。缺失时 litellm 默认无超时，慢/挂起的推理模型"
        "调用会无界阻塞，曾是「卡在 Evaluate」的根因之一。",
    )
    evaluate_max_concurrent: int = Field(
        default=4,
        ge=1,
        le=32,
        description="后台评估并发上限（进程内信号量）。Evaluate 已从心跳剥离为后台任务，受此限流。",
    )
    evaluate_lease_slack_seconds: int = Field(
        default=60,
        ge=10,
        description="后台评估迭代的 lease 宽裕量：lease = gate 超时 + judge 超时 + 此值，用于崩溃恢复 reaper 判定。",
    )
    context_reset_max: int = Field(
        default=10,
        ge=0,
        le=50,
        description="CC 会话上下文窗口耗尽时自动重置 session 冷启动（同 worktree 续干）的最大次数；"
        "超过则不再重置、落回 unrecoverable_error 防 runaway。0=关闭自愈，退化为原行为。",
    )
    default_max_iterations: int = Field(
        default=20, ge=1, description="创建 routine 时 max_iterations 的默认值（硬上限守卫）"
    )
    default_max_cost_usd: float = Field(
        default=5.0, ge=0.0, description="创建 routine 时 max_cost_usd 的默认值（成本熔断守卫）"
    )
    default_max_turns: int = Field(
        default=1000,
        ge=1,
        description="Routine 单次迭代 Claude Code 执行的默认最大交互轮次；被 routine.config.max_turns 覆盖。",
    )
    max_events_per_iter: int = Field(
        default=5000,
        ge=100,
        le=100000,
        description="单迭代至多捕获的动作事件数（Full View 审计上限）；防 DB/SSE 膨胀。"
        "超出后追加 _truncated 伪事件并停止捕获，Claude Code 进程本身不受影响。",
    )
    default_iteration_timeout_seconds: int = Field(
        default=10800,
        ge=300,
        le=86400,
        description="Routine 单次迭代的默认执行超时（秒）；被 routine.config.timeout_seconds 覆盖。默认 3h。",
    )
    evaluator_model: str | None = Field(
        default=None,
        description="评估器 LLM-as-Judge 模型覆盖；为空时走 task_registry 的 routine.evaluate 解析",
    )
    event_streaming_flush_seconds: int = Field(
        default=30,
        ge=5,
        le=300,
        description="StreamingEventPersister 增量 flush 间隔（秒）；"
        "迭代执行期间每隔此时间将已捕获事件增量落库，使页面 reload 后仍可见审计步骤",
    )

    # --- 隔离 worktree（基于基线分支的隔离工作区 + 自动 PR 回基线）---
    worktree_root: str | None = Field(
        default=None,
        description="隔离 worktree 的根目录；为空时运行期解析为仓库同级目录 <project_parent>/.negentropy-worktrees",
    )
    worktree_cleanup: Literal["on_success", "always", "never"] = Field(
        default="on_success",
        description="终态 worktree 回收策略：on_success（成功即清、失败保留供调试）| always | never",
    )
    git_remote: str = Field(default="origin", description="fetch / PR base 归一所用的 git 远端名")
    git_fetch_before_worktree: bool = Field(
        default=True, description="建 worktree 前 best-effort `git fetch <remote> <baseline>`（带超时，失败不阻断）"
    )
    git_timeout_seconds: int = Field(default=120, ge=5, description="单条 git 子命令执行超时（秒）")

    # --- Claude Code 交互式工具自动应答（AskUserQuestion 拦截）---
    auto_answer_questions: bool = Field(
        default=True,
        description="启用 Claude Code AskUserQuestion 自动应答：当 headless 执行中 CC 调用 AskUserQuestion "
        "时，Engine LLM 基于 Routine 上下文生成回答并通过 stdin 回传，使 CC 继续执行而非失败退出。",
    )
    auto_answer_model: str | None = Field(
        default=None,
        description="自动应答 LLM 模型覆盖；为空时走 task_registry 的 routine.auto_answer 解析。",
    )
    auto_answer_timeout_seconds: int = Field(
        default=30,
        ge=5,
        le=120,
        description="单次自动应答 LLM 调用的超时（秒）；超时后 fallback 硬编码回答。",
    )
    auto_answer_max_per_iteration: int = Field(
        default=5,
        ge=1,
        le=20,
        description="单次迭代内自动应答次数上限；防止 runaway（CC 反复问同样问题）。",
    )

    # --- Plan Review（NegentropyEngine 自动审阅 Claude Code 的 Plan）---
    plan_review_enabled: bool = Field(
        default=True,
        description="启用 Plan 自动审阅：当 Claude Code 在 PLAN 阶段提交方案并调用 AskUserQuestion "
        "等待审阅时，NegentropyEngine 自动执行 Agent-as-Judge 审阅，产出 approve/refine 决策。"
        "审阅结果通过 stdin 回传给 CC，实现迭代内闭环。",
    )
    plan_review_model: str | None = Field(
        default=None,
        description="Plan 审阅 LLM 模型覆盖；为空时走 task_registry 的 routine.plan_review 解析。",
    )
    plan_review_timeout_seconds: int = Field(
        default=120,
        ge=10,
        le=300,
        description="单次 Plan 审阅 LLM 调用的超时（秒）。默认 120：强模型（如 claude-sonnet-4-6）"
        "审阅大型方案需 >60s，过小会触发 litellm.Timeout 致评审失败、CC 落回 'Answer questions?'（ISSUE-129）。"
        "per-routine 可经 config.plan_review_timeout_seconds 覆盖。",
    )
    plan_review_unified_loop: bool = Field(
        default=True,
        description="启用「单迭代内 Plan→Review→Implement 闭环」：对所有 worktree routine，引擎在同一 Iteration "
        "内串接两段 Claude Code 调用——①plan 模式(原生只读写锁)+真实 Plan Review 钩子(ExitPlanMode/"
        "AskUserQuestion 均评审、含 refine 闭环)，批准后捕获会话；②acceptEdits + --resume 续接同一会话完成实施。"
        "评审与实施同属一个迭代气泡、会话上下文连续，取代旧的 PLAN/IMPLEMENT 分裂两迭代流程。"
        "关闭则回退旧行为（phased 走两迭代、flat 无评审），无需改代码即可一键回退。",
    )
    plan_review_max_refines: int = Field(
        default=5,
        ge=1,
        le=50,
        description="单个 Iteration 内 Plan Review 的最大轮次（默认 5）。CC 据 refine 反馈反复修订重提方案时，"
        "评审钩子据 sidecar 已评轮次计数；达上限后强制放行（不再调用 PlanReviewer），由 CC 直接进入实施、"
        "下游 gate+Judge 兜底，防止 refine 闭环无限空耗 turns/预算。"
        "per-routine 可经 config.plan_review_max_refines 覆盖。",
    )
    plan_review_max_plan_chars: int = Field(
        default=200_000,
        ge=2000,
        le=1_000_000,
        description="单次 Plan 审阅提交给 judge 的方案最大字符数（默认 200000）。现代 judge 模型"
        "（claude-sonnet-4-6 等）上下文达 200K tokens，过小的截断会让 judge 看不到方案尾部、"
        "反复误判『不完整 / Phase 缺失』致 refine 闭环结构性无法收敛（历史卡环根因）。仅极端超长方案"
        "才会触发截断，且截断时会在末尾附显式标记，告知 judge 勿据未见尾部扣完整性分。"
        "per-routine 可经 config.plan_review_max_plan_chars 覆盖。",
    )

    # --- 上下文压缩（迭代内：提前触发 auto-compact + 迭代内重试续接）---
    context_compact_enabled: bool = Field(
        default=True,
        description="启用迭代内上下文压缩：提前触发 CC auto-compact + 迭代内重试续接，"
        "延长单次迭代寿命，减少跨迭代冷启动。",
    )
    context_compact_threshold_pct: int = Field(
        default=70,
        ge=20,
        le=90,
        description="注入 CLAUDE_AUTOCOMPACT_PCT_OVERRIDE 的百分比阈值。"
        "值越小压缩越早越频繁，但留出更多 headroom。默认 70（即 context 达 70% 时触发压缩）。",
    )
    context_compact_max_retries: int = Field(
        default=2,
        ge=0,
        le=5,
        description="单次迭代内遇到 context_exhausted 时的最大重试次数。"
        "每次重试在当前迭代内以新 session 续接。0=禁用迭代内重试，直接走跨迭代冷启动。",
    )

    # --- 迭代记忆提取（Routine → Memory Module）---
    # 参见 docs/concepts/039-the-routine-system.md §Memory Integration。
    # 将迭代执行-评估闭环中的经验知识提炼为结构化记忆，由 Memory Module 统一维护。
    memory_extraction_enabled: bool = Field(
        default=True,
        description="启用迭代记忆提取：评估完成后 LLM 分析迭代数据，提取有价值的经验记忆存入 Memory Module。",
    )
    memory_extraction_model: str | None = Field(
        default=None,
        description="记忆提取 LLM 模型覆盖；为空时走 task_registry 的 routine.memory_extract 解析",
    )
    memory_extraction_max_memories_per_iter: int = Field(
        default=5,
        ge=0,
        le=20,
        description="单次迭代至多提取的记忆条数；0=不限制。",
    )
    memory_extraction_on_termination: bool = Field(
        default=True,
        description="仅在 routine 终止时执行记忆提取（而非每次迭代后）。减少 LLM 调用成本，但延迟记忆可用性。",
    )
    memory_extraction_min_score: int = Field(
        default=0,
        ge=0,
        le=100,
        description="仅当迭代评分 >= 此阈值时提取记忆；0=始终提取（含失败迭代，从中提取错误恢复策略）。",
    )

    # --- 记忆注入（Memory → Routine Prompt）---
    memory_injection_enabled: bool = Field(
        default=True,
        description="启用记忆注入：派发迭代时从 Memory Module 检索相关记忆注入 prompt。",
    )
    memory_injection_max_tokens: int = Field(
        default=500,
        ge=0,
        le=2000,
        description="注入 prompt 的记忆上下文最大 token 预算。",
    )

    # --- pdf-fidelity-patrol（PDF→Markdown 高保真自拟合巡检 · Scheduler Task）---
    # 巡检 = 一个绑定「negentropy」Repository 的 Routine（worktree + FINALIZE 开 PR + 0-100
    # 评估闭环）；其 Claude Code 会话即 NegentropyEngine，依全局技能 pdf-fidelity-restore
    # 反复调度三系部（Contemplation 视觉对比+评分 / Action 改 perceives+重转 / Internalization
    # 记忆）。详见 engine/routine/patrol_prompt.py 与 handlers/pdf_fidelity_patrol.py。
    patrol_enabled: bool = Field(
        default=False,
        description="启用 pdf-fidelity_patrol 巡检 handler（依赖 routine.enabled；二者皆开才生效）。",
    )
    patrol_repo_local_path: str | None = Field(
        default=None,
        description="巡检 worktree 的源仓库根（引擎宿主机上 negentropy 主仓 checkout 路径）；"
        "为空时尝试从 negentropy 包路径向上推导。无法确定则 handler 返回 not configured，"
        "需改用 Interface/Repositories 手工注册。",
    )
    patrol_repo_github_url: str = Field(
        default="https://github.com/ThreeFish-AI/negentropy",
        description="注册到 repositories 的 GitHub 地址（展示/溯源用，非克隆来源）。",
    )
    patrol_baseline_branch: str = Field(
        default="origin/feature/1.x.x",
        description="巡检 worktree 的基线分支 + PR base（如 origin/feature/1.x.x）。",
    )
    patrol_input_dir: str = Field(
        default="/tmp/negentropy-patrol",
        description="源 PDF 暂存与候选 Markdown 输出根目录（按 doc_id 建子目录）。",
    )
    patrol_max_iterations_per_doc: int = Field(
        default=400,
        ge=1,
        le=500,
        description="单文档巡检 Routine 的迭代硬上限（拟合到满分或触上限即终止）。",
    )
    patrol_max_cost_usd_per_doc: float = Field(
        default=1500.0,
        ge=0.0,
        description="单文档巡检 Routine 的成本熔断（USD）。巡检是重自治任务（opus + 扩展思考"
        " + perceives 重转 + worktree），单轮约 $3-4；默认 1500 容许数百轮深度拟合收敛。"
        "原 30 仅容许 ~8 轮即触顶；按需在当前基础上 ×50（400 轮 / $1500）以支持长链路自拟合。",
    )
    patrol_regression_sample_size: int = Field(
        default=6,
        ge=1,
        le=30,
        description="非回归基线样本数（首次巡检时分层抽取的生产 PDF 文档数）。",
    )

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        from ._base import YamlDictSource, get_yaml_section

        return (
            init_settings,
            env_settings,
            dotenv_settings,
            YamlDictSource(settings_cls, get_yaml_section("routine")),
            file_secret_settings,
        )


__all__ = ["RoutineSettings"]
