"""``session_title_inspect`` handler — 复用 ``SessionTitleInspector.tick``。

巡检候选 session 的自动标题补齐与刷新。Inspector 本身已存在
（``engine/title_inspector.py``），本 handler 作为薄壳调用 ``tick()``。
"""

from __future__ import annotations

from negentropy.logging import get_logger

from . import HandlerResult, register_handler

logger = get_logger("negentropy.engine.schedulers.handlers.session_title_inspect")


@register_handler("session_title_inspect")
async def session_title_inspect_handler(task) -> HandlerResult:
    from negentropy.config import settings

    if not settings.services.session_title_inspect_enabled:
        return HandlerResult(status="ok", output_summary="disabled by config")

    from negentropy.engine.title_inspector import SessionTitleInspector

    payload = task.payload or {}
    inspector = SessionTitleInspector(
        concurrency=int(payload.get("concurrency", settings.services.session_title_inspect_concurrency)),
        batch_size=int(payload.get("batch_size", settings.services.session_title_inspect_batch_size)),
        min_events=int(payload.get("min_events", settings.services.session_title_inspect_min_events)),
        refresh_event_delta=int(
            payload.get("refresh_event_delta", settings.services.session_title_inspect_refresh_event_delta)
        ),
        max_attempts=int(payload.get("max_attempts", settings.services.session_title_inspect_max_attempts)),
    )

    try:
        await inspector.tick()
        return HandlerResult(status="ok", output_summary="title inspector tick completed")
    except Exception as exc:
        logger.warning("session_title_inspect_failed", error=str(exc))
        return HandlerResult(status="failed", error=str(exc))
