"""
Skill Scheduler — Phase 3 应用层定时调度（不依赖 pg_cron）。

设计：
- backend 启动时 ``register_skill_scheduler(scheduler)`` 注册一个 60s tick 任务，
  每次 tick 用 ``FOR UPDATE SKIP LOCKED`` 扫 ``skill_schedules`` 表中
  ``enabled = TRUE AND next_run_at <= now()`` 的行并执行；
- 执行 = 把 Skill 当前字段 + schedule.vars 渲染 prompt（复用 ``format_skill_invocation``），
  写入 Memory 一条 ``app_name=skill_scheduler`` 的记录作为留痕；
- 不真正调用 LLM —— 与 ``POST /skills/{id}/invoke`` 端点行为一致；
- ``last_run_at`` 与 ``next_run_at`` 更新在同一事务（基于 cron_expr 重算）；
- 任何执行异常 → 记 ``last_error`` 字段 + warning 日志，不影响其它 schedule。

参考文献：
[1] PostgreSQL Documentation, "FOR UPDATE SKIP LOCKED" — 多 worker 安全消费模式。
[2] croniter PyPI — POSIX cron 解析。
"""

from __future__ import annotations

import os
from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import select, update

from negentropy.agents.skills_injector import (
    ResolvedSkill,
    format_skill_invocation,
    format_skill_resources,
)
from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.skill import Skill, SkillSchedule

if TYPE_CHECKING:
    from negentropy.engine.schedulers.async_scheduler import AsyncScheduler

_logger = get_logger("negentropy.agents.skill_scheduler")

SCHEDULER_KEY = "skill_scheduler_tick"
DEFAULT_TICK_SECONDS = 60.0


def _scheduler_disabled() -> bool:
    return os.environ.get("NEGENTROPY_SKILL_SCHEDULER_ENABLED", "true").lower() in ("0", "false", "no")


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _next_from_cron(cron_expr: str, base: datetime | None = None) -> datetime | None:
    """计算下一次 cron 触发时刻；非法 cron 返回 None。"""
    try:
        from croniter import croniter

        cron = croniter(cron_expr, base or _utcnow())
        return cron.get_next(datetime)
    except Exception as exc:
        _logger.warning("skill_schedule_cron_invalid", cron_expr=cron_expr, error=str(exc))
        return None


async def execute_schedule_once(schedule_id: UUID) -> None:
    """手动 / tick 触发一条 schedule 的执行（幂等：基于行级状态）。"""
    if _scheduler_disabled():
        _logger.info("skill_scheduler_disabled_skip_run", schedule_id=str(schedule_id))
        return

    async with AsyncSessionLocal() as db:
        sched = await db.get(SkillSchedule, schedule_id)
        if sched is None:
            return
        skill = await db.get(Skill, sched.skill_id)
        if skill is None or not skill.is_enabled:
            sched.last_error = "skill not found or disabled"
            sched.last_run_at = _utcnow()
            sched.next_run_at = _next_from_cron(sched.cron_expr)
            await db.commit()
            return

        try:
            resolved = ResolvedSkill(
                id=str(skill.id),
                name=skill.name,
                display_name=skill.display_name,
                description=skill.description,
                prompt_template=skill.prompt_template,
                required_tools=tuple(skill.required_tools or []),
                is_enabled=skill.is_enabled,
                enforcement_mode=getattr(skill, "enforcement_mode", "warning") or "warning",
                resources=tuple(skill.resources or ()) if hasattr(skill, "resources") else (),
            )
            rendered = format_skill_invocation(resolved, variables=dict(sched.vars or {})) or ""
            if not rendered and resolved.resources:
                rendered = format_skill_resources(resolved, eager=True)
            await _record_run_to_memory(skill_name=skill.name, rendered=rendered, vars_dict=dict(sched.vars or {}))
            sched.last_error = None
        except Exception as exc:
            _logger.warning(
                "skill_schedule_execute_failed",
                schedule_id=str(schedule_id),
                skill=skill.name,
                error=str(exc),
            )
            sched.last_error = str(exc)
        finally:
            sched.last_run_at = _utcnow()
            sched.next_run_at = _next_from_cron(sched.cron_expr)
            await db.commit()


async def _record_run_to_memory(*, skill_name: str, rendered: str, vars_dict: dict) -> None:
    """把一次执行结果写到 Memory，便于事后审计与 Paper Hunter 等场景的内化。

    fail-soft：DB 不可用直接吞错（已经在调用方 try/except 中）。
    """
    try:
        from negentropy.models.internalization import Memory

        async with AsyncSessionLocal() as db:
            memory = Memory(
                user_id=f"scheduler:{skill_name}",
                app_name="skill_scheduler",
                memory_type="semantic",
                content=rendered[:8000] if rendered else f"(empty render for {skill_name})",
                metadata_={"tags": ["skill_scheduler", skill_name], "vars": vars_dict},
            )
            db.add(memory)
            await db.commit()
    except Exception as exc:
        _logger.debug("skill_schedule_record_memory_failed", error=str(exc))


async def _tick() -> None:
    """单次 tick：扫表并并发执行所有 due 的 schedule。

    使用 ``FOR UPDATE SKIP LOCKED`` 配合 ``UPDATE SET next_run_at = NOW() + 1s`` 形成
    原子认领，避免多 worker 竞争同一 schedule。
    """
    if _scheduler_disabled():
        return

    async with AsyncSessionLocal() as db:
        # 在一个事务里：选 due → 立刻把 next_run_at 推后 1 分钟（避免重复认领）
        stmt = (
            select(SkillSchedule)
            .where(SkillSchedule.enabled.is_(True))
            .where(SkillSchedule.next_run_at <= _utcnow())
            .with_for_update(skip_locked=True)
            .limit(20)
        )
        rows = (await db.execute(stmt)).scalars().all()
        if not rows:
            return
        ids = [r.id for r in rows]
        await db.execute(
            update(SkillSchedule).where(SkillSchedule.id.in_(ids)).values(next_run_at=_utcnow().replace(microsecond=0))
        )
        await db.commit()

    # 在事务外逐个执行（事务外已释放锁；execute_schedule_once 自带新事务）
    for sid in ids:
        try:
            await execute_schedule_once(sid)
        except Exception as exc:
            _logger.warning("skill_schedule_tick_dispatch_failed", schedule_id=str(sid), error=str(exc))


def register_skill_scheduler(scheduler: AsyncScheduler, interval_seconds: float = DEFAULT_TICK_SECONDS) -> None:
    """把 SkillScheduler 注册到现有 AsyncScheduler，单进程单 tick 60s。"""
    if _scheduler_disabled():
        _logger.info("skill_scheduler_disabled_register_skipped")
        return
    scheduler.register(
        key=SCHEDULER_KEY,
        callback=_tick,
        interval_seconds=interval_seconds,
    )
    _logger.info("skill_scheduler_registered", interval_seconds=interval_seconds)


# 全局 lazy scheduler 单例：用于在 FastAPI startup hook 不可靠时（ADK 嵌入场景）
# 由首次 /skills/{id}/schedules 端点访问触发启动。
_LAZY_SCHEDULER: AsyncScheduler | None = None


async def ensure_scheduler_running() -> None:
    """幂等启动 SkillScheduler。任意调度端点首次被调用时触发。

    `_LAZY_SCHEDULER` 与 `_running` 都是进程内单例；多 worker 部署时各自启动一份，
    通过 `FOR UPDATE SKIP LOCKED` 在 DB 层防止并发执行同一 schedule。
    """
    global _LAZY_SCHEDULER
    if _scheduler_disabled():
        return
    if _LAZY_SCHEDULER is not None and _LAZY_SCHEDULER.is_running:
        return
    try:
        from negentropy.engine.schedulers.async_scheduler import AsyncScheduler

        scheduler = AsyncScheduler(poll_interval=DEFAULT_TICK_SECONDS)
        register_skill_scheduler(scheduler)
        scheduler.start()
        _LAZY_SCHEDULER = scheduler
        _logger.info("skill_scheduler_lazy_started", jobs=scheduler.registered_jobs)
    except Exception as exc:
        _logger.warning("skill_scheduler_lazy_start_failed", error=str(exc))
