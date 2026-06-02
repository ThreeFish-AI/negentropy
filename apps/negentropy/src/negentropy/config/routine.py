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
    max_reflections_injected: int = Field(
        default=5, ge=1, le=50, description="注入下一次迭代 prompt 的最近反思条数（Reflexion 窗口）"
    )
    eval_failure_patience: int = Field(
        default=3, ge=1, description="评估器连续失败容忍次数，超过则终止 routine 为 unrecoverable_error"
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
