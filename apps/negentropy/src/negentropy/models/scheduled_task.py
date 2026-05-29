"""统一调度任务模型 — Phase 4 心跳调度引擎的事实源。

定位（与 [[skill_schedules]] 的关系）：
- ``scheduled_tasks``：所有定时任务（cron / interval / oneshot）的单一注册源；
- ``skill_schedules``：仅服务 Skill 子集，保留向后兼容；Phase 4 通过 data migration
  把每一行回填为 ``scheduled_tasks`` 中 ``handler_kind='skill_invoke'`` 的记录，
  ``payload.skill_schedule_id`` 指回原 FK，让 ``/skills/{id}/schedules/*`` API
  零行为变更。

参考文献：
[1] MindStudio, *Heartbeat Pattern Beats Persistent Sessions for AI Agents*, 2025.
    心跳完整 5 步生命周期 + 外部持久化层 + 上下文包模式。
[2] PostgreSQL Docs, *FOR UPDATE SKIP LOCKED*. 多 worker 安全消费保证。
[3] Scheduling Agent Supervisor Pattern. 心跳健康检测 + 监督模型。
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import NEGENTROPY_SCHEMA, Base, TimestampMixin, UUIDMixin


class ScheduledTask(Base, UUIDMixin, TimestampMixin):
    """统一调度任务 — 替代散布在代码里的 register 调用 + skill_schedules 单一来源。

    五维元数据（``role`` / ``scenario`` / ``category`` / ``agent_id`` / ``owner_id``）
    驱动 Dashboard 多维统计与权限判定。具体取值约束在 handler 层（见
    ``engine/schedulers/handlers/__init__.py`` 的 ``HANDLER_REGISTRY``）。
    """

    __tablename__ = "scheduled_tasks"

    key: Mapped[str] = mapped_column(String(192), unique=True, nullable=False)
    handler_kind: Mapped[str] = mapped_column(String(64), nullable=False)
    trigger_type: Mapped[str] = mapped_column(String(16), nullable=False)
    interval_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    cron_expr: Mapped[str | None] = mapped_column(String(64), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    owner_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    participant_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    agent_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    role: Mapped[str | None] = mapped_column(String(64), nullable=True)
    scenario: Mapped[str | None] = mapped_column(String(64), nullable=True)
    category: Mapped[str | None] = mapped_column(String(32), nullable=True)

    display_name: Mapped[str | None] = mapped_column(String(192), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    last_fire_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_fire_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_status: Mapped[str | None] = mapped_column(String(16), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    consecutive_failures: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    total_runs: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")

    max_concurrency: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    token_budget: Mapped[int | None] = mapped_column(Integer, nullable=True)
    backoff_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    is_system: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        comment="系统种子任务标记：由迁移种子写入，不可通过 UI 删除",
    )

    executions: Mapped[list[TaskExecution]] = relationship(
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="TaskExecution.started_at.desc()",
    )

    __table_args__ = (
        Index("ix_scheduled_tasks_due", "enabled", "next_fire_at"),
        Index("ix_scheduled_tasks_handler", "handler_kind", "enabled"),
        Index("ix_scheduled_tasks_agent", "agent_id"),
        Index("ix_scheduled_tasks_scenario", "scenario", "category"),
        Index("ix_scheduled_tasks_owner", "owner_id"),
        {"schema": NEGENTROPY_SCHEMA},
    )


class TaskExecution(Base, UUIDMixin):
    """单次执行历史 — Dashboard 时间线与多维统计的事实表。

    设计取舍：
    - 不写 ``updated_at``：执行历史是 append-only 不可变事件流，行级再 UPDATE 仅有
      ``status running → ok|failed`` 一次状态翻转；避免与 ``TimestampMixin`` 耦合。
    - ``fire_reason ∈ {tick, manual, replay}``：区分调度源便于审计与回放。
    """

    __tablename__ = "task_executions"

    task_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(f"{NEGENTROPY_SCHEMA}.scheduled_tasks.id", ondelete="CASCADE"),
        nullable=False,
    )

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tokens_used: Mapped[int | None] = mapped_column(Integer, nullable=True)

    skill_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    skill_schedule_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    memory_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    pipeline_run_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    thread_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    output_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    fire_reason: Mapped[str] = mapped_column(String(16), nullable=False, default="tick", server_default="tick")

    task: Mapped[ScheduledTask] = relationship(back_populates="executions")

    __table_args__ = (
        Index("ix_task_executions_task_time", "task_id", "started_at"),
        Index("ix_task_executions_status_time", "status", "started_at"),
        {"schema": NEGENTROPY_SCHEMA},
    )


__all__ = ["ScheduledTask", "TaskExecution"]
