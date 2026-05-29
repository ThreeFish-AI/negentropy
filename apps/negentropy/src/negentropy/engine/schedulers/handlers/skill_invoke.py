"""``skill_invoke`` handler — 替代旧 ``register_skill_scheduler._tick``。

行为约定：
- ``task.payload`` 中应包含 ``skill_schedule_id``（指回旧 ``skill_schedules`` 行）；
- 实际执行复用 ``agents.skill_scheduler.execute_schedule_once`` 保持单一事实源；
- 旧 ``/skills/{id}/schedules/*`` API 写入仍走旧表，本 handler 仅消费。
"""

from __future__ import annotations

from uuid import UUID

from negentropy.logging import get_logger

from . import HandlerDescriptor, HandlerResult, PayloadField, register_descriptor, register_handler

logger = get_logger("negentropy.engine.schedulers.handlers.skill_invoke")

register_descriptor(
    HandlerDescriptor(
        handler_kind="skill_invoke",
        label="Skill Invoke",
        description="根据 skill_schedule_id 触发一次 Skill 执行",
        supported_trigger_types=("cron", "interval"),
        default_trigger_type="cron",
        payload_fields=(
            PayloadField(
                name="skill_schedule_id",
                label="Skill Schedule ID",
                type="string",
                required=True,
                help_text="关联的 skill_schedule 行 UUID",
            ),
        ),
    ),
)


@register_handler("skill_invoke")
async def skill_invoke_handler(task) -> HandlerResult:
    """根据 ``task.payload.skill_schedule_id`` 触发一次 Skill 执行。"""

    payload = task.payload or {}
    schedule_id_str = payload.get("skill_schedule_id")
    if not schedule_id_str:
        return HandlerResult(status="failed", error="missing payload.skill_schedule_id")

    try:
        schedule_id = UUID(str(schedule_id_str))
    except (ValueError, TypeError) as exc:
        return HandlerResult(status="failed", error=f"invalid skill_schedule_id: {exc}")

    try:
        from negentropy.agents.skill_scheduler import execute_schedule_once

        await execute_schedule_once(schedule_id)
        return HandlerResult(
            status="ok",
            skill_schedule_id=schedule_id,
            output_summary=f"skill_schedule {schedule_id} executed",
        )
    except Exception as exc:
        logger.warning("skill_invoke_handler_failed", schedule_id=str(schedule_id), error=str(exc))
        return HandlerResult(status="failed", error=str(exc), skill_schedule_id=schedule_id)
