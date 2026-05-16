"""``pipeline_watchdog`` handler — 收敛 KB/KG pipeline 长尾。

从 ``bootstrap.py:485-520`` 的 inline ``_pipeline_watchdog_tick`` 平移而来。
设计原因详见 ISSUE-080：``update_build_run`` SQL 守卫修复后，watchdog 仅作 backstop。
"""

from __future__ import annotations

from negentropy.logging import get_logger

from . import HandlerResult, register_handler

logger = get_logger("negentropy.engine.schedulers.handlers.pipeline_watchdog")


@register_handler("pipeline_watchdog")
async def pipeline_watchdog_handler(task) -> HandlerResult:
    """收敛 KB + KG pipeline runs 的长尾。"""
    from negentropy.knowledge.dao import KnowledgeRunDao
    from negentropy.knowledge.graph.repository import AgeGraphRepository

    forced_failed = 0
    forced_cancelled = 0
    kb_result: dict = {"forced_failed": 0, "forced_cancelled": 0}
    kg_result: dict = {"forced_failed": 0, "forced_cancelled": 0}

    try:
        dao = KnowledgeRunDao()
        kb_result = await dao.finalize_stale_pipeline_runs()
    except Exception as exc:
        logger.exception("pipeline_watchdog_kb_failed", error=str(exc))
        return HandlerResult(status="failed", error=f"kb watchdog: {exc}")

    try:
        kg_repo = AgeGraphRepository()
        kg_result = await kg_repo.finalize_stale_kg_build_runs()
    except Exception as exc:
        # 单独 try/except：KG 失败不污染 KB 路径
        logger.exception("pipeline_watchdog_kg_failed", error=str(exc))

    forced_failed = kb_result.get("forced_failed", 0) + kg_result.get("forced_failed", 0)
    forced_cancelled = kb_result.get("forced_cancelled", 0) + kg_result.get("forced_cancelled", 0)

    summary = f"kb={kb_result} kg={kg_result}"
    if forced_failed > 0 or forced_cancelled > 0:
        logger.info(
            "pipeline_watchdog_finalized",
            forced_failed=forced_failed,
            forced_cancelled=forced_cancelled,
            kb=kb_result,
            kg=kg_result,
        )

    return HandlerResult(
        status="ok",
        output_summary=summary,
        metrics={
            "forced_failed": forced_failed,
            "forced_cancelled": forced_cancelled,
        },
    )
