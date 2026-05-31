"""Routine 长周期自主任务模型 — Evaluator-Optimizer 闭环的事实源。

定位：
- ``routines``：长周期自主任务的注册源。每个 Routine 携带目标（goal）、验收标准
  （acceptance_criteria）、预算守卫（max_iterations / max_cost_usd / deadline）与生命周期
  状态机。由 Negentropy Engine 担任 Orchestrator + Evaluator。
- ``routine_iterations``：单次 Execute→Evaluate→Decide 周期的 append-mostly 事实表。
  记录发送给 Claude Code 的 prompt、执行结果（summary / session_id / cost）、评估结果
  （score / verdict / reflection）。

闭环：Engine 派发 goal → Claude Code（Executor，可 resume session）执行 → Engine 用
LLM-as-Judge + 可选命令门控评估 → 决策继续迭代（注入累积反思）或终止（成功/失败/预算耗尽）。

参考文献：
[1] Anthropic, *Building Effective AI Agents*, 2024. Evaluator-Optimizer 工作流：
    一个 LLM 生成、另一个评估并反馈，迭代至验收标准满足。
[2] N. Shinn et al., "Reflexion: Language Agents with Verbal Reinforcement Learning,"
    in *Proc. NeurIPS*, 2023. arXiv:2303.11366. 自然语言反思持久化为 episodic memory，
    注入下次迭代。
[3] PostgreSQL Docs, *FOR UPDATE SKIP LOCKED*. 并发巡检 tick 的行级幂等保证。
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import NEGENTROPY_SCHEMA, Base, TimestampMixin, UUIDMixin


class Routine(Base, UUIDMixin, TimestampMixin):
    """长周期自主任务 — Engine 编排 Claude Code 迭代执行直至验收或终止。

    生命周期状态机（``status``）::

        pending ──start──→ running ──score≥threshold──→ succeeded (终态)
          │                 │
          │                 ├── pause ──→ paused ──resume──→ running
          │                 ├── cancel ──→ cancelled (终态)
          │                 └── guardrail/deadline ──→ failed (终态)
          └── cancel ──→ cancelled (终态)

    Human-in-the-Loop（``approval_mode``）：``auto`` 全自动；``first`` 仅首次迭代前需审批；
    ``every`` 每轮迭代前需审批。审批门控在迭代创建时决定初始状态（dispatched vs
    pending_approval）。
    """

    __tablename__ = "routines"

    # --- 标识与归属 ---
    key: Mapped[str] = mapped_column(String(192), unique=True, nullable=False)
    owner_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    agent_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # --- 任务定义 ---
    goal: Mapped[str] = mapped_column(Text, nullable=False)
    acceptance_criteria: Mapped[str] = mapped_column(Text, nullable=False)
    cwd: Mapped[str | None] = mapped_column(Text, nullable=True)
    verification_command: Mapped[str | None] = mapped_column(Text, nullable=True)

    # --- 生命周期 ---
    status: Mapped[str] = mapped_column(
        String(24),
        nullable=False,
        default="pending",
        server_default="pending",
        comment="pending|running|paused|succeeded|failed|cancelled",
    )
    termination_reason: Mapped[str | None] = mapped_column(
        String(48),
        nullable=True,
        comment="success|max_iterations|max_cost|deadline|no_progress|oscillation|unrecoverable_error|user_cancelled",
    )

    # --- 预算守卫（硬上限，代码层强制）---
    max_iterations: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_cost_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    success_score_threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=85, server_default="85")
    no_progress_patience: Mapped[int] = mapped_column(Integer, nullable=False, default=3, server_default="3")

    # --- Human-in-the-Loop ---
    approval_mode: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="auto",
        server_default="auto",
        comment="auto|first|every — 迭代执行前的人工审批级别",
    )

    # --- 相位状态机（仅 config.workflow='phased' 推进三相位；扁平工作流恒为 implement）---
    current_phase: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="implement",
        server_default="implement",
        comment="plan|implement|finalize — 相位状态机指针",
    )
    pr_url: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="FINALIZE 阶段创建的 PR 链接；非空 + succeeded 表示等待人工 Merge",
    )

    # --- 运行期状态（反规范化，加速守卫判定）---
    iteration_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    total_cost_usd: Mapped[float] = mapped_column(Float, nullable=False, default=0.0, server_default="0")
    best_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    claude_session_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # 决策窗口水位线：仅 seq > 此值的迭代参与 decide/审批判定。重启失败 routine 时置为当前
    # MAX(seq)，使新一轮尝试的停滞/振荡/审批判定不被既往迭代「污染」（旧迭代仍保留供审计）。
    eval_floor_seq: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    # --- Reflexion 反思记忆 + Claude Code 配置覆盖 ---
    reflections: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    config: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")

    # --- 模板标记 ---
    is_template: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        comment="true 时本行为 Routine Template，可作为创建 Routine 的模板来源",
    )

    iterations: Mapped[list[RoutineIteration]] = relationship(
        back_populates="routine",
        cascade="all, delete-orphan",
        order_by="RoutineIteration.seq.desc()",
    )

    __table_args__ = (
        Index("ix_routines_status", "status"),
        Index("ix_routines_owner", "owner_id"),
        Index("ix_routines_is_template", "is_template"),
        {"schema": NEGENTROPY_SCHEMA},
    )


class RoutineIteration(Base, UUIDMixin):
    """单次迭代周期 — Execute（Claude Code）→ Evaluate（Judge）→ Decide。

    设计取舍：
    - 不写 ``updated_at``：迭代是 append-mostly 事件流，状态翻转有限
      （dispatched → in_flight → executed → evaluated）。
    - ``lease_expires_at``：进程内后台 Runner 的崩溃恢复 lease；超时未完成由 Inspector
      reaper 标记为 ``reaped`` 并重新派发。
    - ``status`` 状态机::

        [approval≠auto] pending_approval ──approve──→ dispatched
                                          └─reject──→ aborted
        dispatched ──runner pickup──→ in_flight ──result──→ executed ──judge──→ evaluated
                                          │                    │
                                          ├─lease expired─→ reaped
                                          └─user cancel──→ aborted
    """

    __tablename__ = "routine_iterations"

    routine_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(f"{NEGENTROPY_SCHEMA}.routines.id", ondelete="CASCADE"),
        nullable=False,
    )
    seq: Mapped[int] = mapped_column(Integer, nullable=False)

    status: Mapped[str] = mapped_column(
        String(24),
        nullable=False,
        default="dispatched",
        server_default="dispatched",
        comment="pending_approval|dispatched|in_flight|executed|evaluated|reaped|aborted",
    )
    phase: Mapped[str | None] = mapped_column(
        String(16),
        nullable=True,
        comment="plan|implement|finalize — 本迭代所属相位（派发时定格）",
    )

    # --- 执行输入 ---
    prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    resume_session_id: Mapped[str | None] = mapped_column(String(128), nullable=True)

    # --- Claude Code 执行结果 ---
    exec_status: Mapped[str | None] = mapped_column(String(16), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    claude_session_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    cost_usd: Mapped[float] = mapped_column(Float, nullable=False, default=0.0, server_default="0")
    turn_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    exec_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    # --- 评估结果 ---
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    verdict: Mapped[str | None] = mapped_column(
        String(24),
        nullable=True,
        comment="pass|progressing|stalled|regressed|unrecoverable",
    )
    reflection: Mapped[str | None] = mapped_column(Text, nullable=True)
    eval_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    gate_exit_code: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # --- 时序与租约 ---
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    metrics: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")

    routine: Mapped[Routine] = relationship(back_populates="iterations")
    events: Mapped[list[RoutineIterationEvent]] = relationship(
        back_populates="iteration",
        cascade="all, delete-orphan",
        order_by="RoutineIterationEvent.seq.asc()",
    )

    __table_args__ = (
        UniqueConstraint("routine_id", "seq", name="uq_routine_iterations_seq"),
        Index("ix_routine_iterations_routine_seq", "routine_id", "seq"),
        Index("ix_routine_iterations_lease", "status", "lease_expires_at"),
        {"schema": NEGENTROPY_SCHEMA},
    )


class RoutineIterationEvent(Base, UUIDMixin):
    """单次迭代内的**动作级**审计事件 — 「全过程」可审计事实流。

    一轮迭代（Execute→Evaluate）内 Claude Code 执行的每个动作（工具调用 ``tool_use`` /
    工具结果 ``tool_result`` / 中间 ``assistant`` 文本 / 最终 ``result``）以及评估阶段的
    命令门控（``gate``）与 LLM-as-Judge（``evaluation``）各落一行，按 ``seq`` 顺序还原
    「全过程」，供事后审计与 Review，并经 SSE ``action`` 事件实时投递。

    设计取舍：
    - append-only 事件流，仅 ``UUIDMixin`` + 自带 ``created_at``，不写 ``updated_at``。
    - ``seq`` 在单迭代内单调递增：执行动作由 Runner 在写回时定格 0..N-1；门控/评估由
      Orchestrator 在迭代翻转 ``evaluated`` 时以 ``MAX(seq)+1`` 追加。所有写入均
      ``ON CONFLICT (iteration_id, seq) DO NOTHING`` 兜底 reaper/abort/重试竞态。
    - ``payload`` 为归一化后的结构化载荷（input/output/text/context/meta），单字段截断到
      ~16KB、单迭代至多 ~1000 条，防 DB 膨胀（截断处保留可见标记）。
    - 双外键（iteration_id / routine_id）均 ``CASCADE``：随 routine / iteration 删除级联清理。
    """

    __tablename__ = "routine_iteration_events"

    iteration_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(f"{NEGENTROPY_SCHEMA}.routine_iterations.id", ondelete="CASCADE"),
        nullable=False,
    )
    routine_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(f"{NEGENTROPY_SCHEMA}.routines.id", ondelete="CASCADE"),
        nullable=False,
    )
    seq: Mapped[int] = mapped_column(Integer, nullable=False)

    event_type: Mapped[str] = mapped_column(
        String(24),
        nullable=False,
        comment="system|assistant|tool_use|tool_result|result|gate|evaluation",
    )
    tool_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    cost_usd: Mapped[float | None] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    iteration: Mapped[RoutineIteration] = relationship(back_populates="events")

    __table_args__ = (
        UniqueConstraint("iteration_id", "seq", name="uq_routine_iteration_events_seq"),
        Index("ix_routine_iteration_events_iter_seq", "iteration_id", "seq"),
        Index("ix_routine_iteration_events_routine", "routine_id"),
        {"schema": NEGENTROPY_SCHEMA},
    )


__all__ = ["Routine", "RoutineIteration", "RoutineIterationEvent"]
