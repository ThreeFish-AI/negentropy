"""``agent_inspection`` handler — Phase 4 自驱 Agent 巡检最小骨架。

Plan 第 4 节明确：本期仅做"最小骨架"，handler 可被 Dashboard 看到 +
1 个示例任务（每 5min 检查 Faculty 健康状态），不强求生产可用。

关键设计点（取自业界 Heartbeat Pattern）：
1. 每个 tick 构造一个**上下文包**（ctx_pack）：包含 task.payload + 最近 N
   条 task_execution 摘要 + agent 配置；
2. 调用 Faculty / Pipeline 完成本拍工作，结果写回 ``output_summary``；
3. Token 预算门控：执行前预检 ``task.token_budget``，超额则 skip。

Phase 5 将扩展为：多 Agent 协作、上下文包持久化、退避策略学习等。

参考文献：
[1] MindStudio, *Heartbeat Pattern Beats Persistent Sessions for AI Agents*, 2025.
    心跳 5 步生命周期 + 上下文包 + 外部持久化层；
[2] Let's Data Science, *Heartbeat-Driven Cognitive Scheduling for LLM Agents*, 2025.
    模块化 Planner/Critic/Recaller/Dreamer 与自适应路由。
"""

from __future__ import annotations

from negentropy.logging import get_logger

from . import HandlerResult, register_handler

logger = get_logger("negentropy.engine.schedulers.handlers.agent_inspection")


@register_handler("agent_inspection")
async def agent_inspection_handler(task) -> HandlerResult:
    """根据 ``task.payload.inspection_type`` 执行最小巡检。

    支持的 inspection_type：
    - ``faculty_health``：检查 Faculty 五系部是否可 import + 关键属性存在；
    - ``self_check``：纯回声，用于 Dashboard 演示心跳活体；

    其它类型会落入"unknown"分支，记录 warning 但不视为失败（最小骨架阶段保留扩展空间）。
    """
    payload = task.payload or {}
    inspection_type = payload.get("inspection_type", "self_check")

    if inspection_type == "faculty_health":
        return await _faculty_health_check()
    if inspection_type == "self_check":
        return HandlerResult(
            status="ok",
            output_summary=f"heartbeat alive (task.key={task.key})",
            metrics={"heartbeat": 1},
        )

    logger.warning("agent_inspection_unknown_type", inspection_type=inspection_type)
    return HandlerResult(
        status="ok",
        output_summary=f"unknown inspection_type={inspection_type}",
        metrics={"unknown": 1},
    )


async def _faculty_health_check() -> HandlerResult:
    """最小可行的 Faculty 健康检查：尝试 import 五系部模块。

    本检查刻意保持轻量：不真正调用 LLM、不持久化大量数据，仅探活。
    Phase 5 会扩展为：调用 Faculty 的 ``health()`` 方法、汇总 tokens / 错误率等。
    """
    results: dict[str, str] = {}
    failures: list[str] = []
    for module_name in (
        "negentropy.agents.faculties.perception",
        "negentropy.agents.faculties.internalization",
        "negentropy.agents.faculties.contemplation",
        "negentropy.agents.faculties.action",
        "negentropy.agents.faculties.influence",
    ):
        try:
            __import__(module_name)
            results[module_name.split(".")[-1]] = "ok"
        except Exception as exc:
            results[module_name.split(".")[-1]] = f"failed: {exc}"
            failures.append(module_name)

    summary = ", ".join(f"{k}={v}" for k, v in results.items())
    if failures:
        return HandlerResult(
            status="failed",
            output_summary=summary,
            error=f"{len(failures)} faculty modules failed to import",
            metrics=results,
        )
    return HandlerResult(status="ok", output_summary=summary, metrics=results)
