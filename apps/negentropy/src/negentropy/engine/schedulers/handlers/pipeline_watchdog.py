"""``pipeline_watchdog`` handler — 收敛 KB/KG pipeline 长尾。

从 ``bootstrap.py:485-520`` 的 inline ``_pipeline_watchdog_tick`` 平移而来。
设计原因详见 ISSUE-080：``update_build_run`` SQL 守卫修复后，watchdog 仅作 backstop。
"""

from __future__ import annotations

from negentropy.logging import get_logger

from . import HandlerDescriptor, HandlerResult, register_descriptor, register_handler

logger = get_logger("negentropy.engine.schedulers.handlers.pipeline_watchdog")

register_descriptor(
    HandlerDescriptor(
        handler_kind="pipeline_watchdog",
        label="Pipeline Watchdog",
        description="收敛 KB/KG Pipeline 长尾状态的定时巡检",
        supported_trigger_types=("interval",),
        default_trigger_type="interval",
    ),
)


@register_handler("pipeline_watchdog")
async def pipeline_watchdog_handler(task) -> HandlerResult:
    """收敛 KB + KG pipeline runs 的长尾。

    错误语义：
    - KB 子流程抛错 → ``status='failed'``，立即返回（KG 不再尝试）；
    - KB 成功 + KG 抛错 → ``status='failed'``，``error`` 暴露 KG 异常字符串；
      `metrics.kg_ok=False` 让 Dashboard 与告警链路可见；
      ``consecutive_failures`` 自然累加，agent_inspection 的退避策略由此生效，
      避免 KG 长期不可用时整链路静默。
    """
    from negentropy.knowledge.dao import KnowledgeRunDao
    from negentropy.knowledge.graph.repository import AgeGraphRepository

    kb_result: dict = {"forced_failed": 0, "forced_cancelled": 0}
    kg_result: dict = {"forced_failed": 0, "forced_cancelled": 0}
    kg_error: str | None = None

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
        # KG 失败不阻断 KB 已经收敛的结果，但必须在 handler 输出里可见。
        logger.exception("pipeline_watchdog_kg_failed", error=str(exc))
        kg_error = str(exc)

    forced_failed = kb_result.get("forced_failed", 0) + kg_result.get("forced_failed", 0)
    forced_cancelled = kb_result.get("forced_cancelled", 0) + kg_result.get("forced_cancelled", 0)

    summary = f"kb={kb_result} kg={kg_result}"
    if kg_error:
        summary += f" kg_error={kg_error}"
    if forced_failed > 0 or forced_cancelled > 0:
        logger.info(
            "pipeline_watchdog_finalized",
            forced_failed=forced_failed,
            forced_cancelled=forced_cancelled,
            kb=kb_result,
            kg=kg_result,
        )

    metrics = {
        "forced_failed": forced_failed,
        "forced_cancelled": forced_cancelled,
        "kb_ok": True,
        "kg_ok": kg_error is None,
    }
    if kg_error:
        return HandlerResult(
            status="failed",
            output_summary=summary,
            error=f"kg watchdog: {kg_error}",
            metrics=metrics,
        )
    return HandlerResult(
        status="ok",
        output_summary=summary,
        metrics=metrics,
    )
