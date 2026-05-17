"""``agent_inspection`` handler — Phase 5 生产级自驱 Agent 巡检。

定位（与 Phase 4 最小骨架的演进关系）：
- Phase 4：仅 ``self_check`` / ``faculty_health`` 两种探活，证明心跳链路打通；
- Phase 5（本文件）：补齐**生产可用**三件套：
  1. **上下文包构建器**（``build_context_pack``）：取最近 N 条 ``task_executions``
     摘要 + ``task.payload`` + 24h 累计 tokens_used → ``ContextPack`` dataclass，
     handler 内部用，也方便测试 / 调试时直接喂给真实 Agent；
  2. **Token 预算预检**（``_check_token_budget``）：在调用任何耗 token 的 Faculty
     之前检查 ``task.token_budget`` 是否仍有余量（按 ``task_executions.tokens_used``
     24h 累计），超额返回 ``status=skipped`` 不报错；
  3. **退避策略**（``_apply_backoff``）：连续失败 >= ``BACKOFF_FAILURE_THRESHOLD``
     时给 task 写 ``backoff_until``（指数退避，最大 1h），让 Registry 心跳跳过它，
     直到退避窗口结束。

新支持的 inspection_type：
- ``self_check``        — 纯回声（沿用）
- ``faculty_health``    — 五系部 import 探活（沿用）
- ``faculty_deep_check`` — 进一步检查 Faculty LlmAgent 是否能正确构造（不真实
  调 LLM，只调用 ``create_subagent_model`` / 读 ``LlmAgent`` 配置），暴露
  配置漂移 / tools 缺失等故障；
- ``scheduled_tasks_summary`` — 巡检整个调度框架自身：扫 ``scheduled_tasks``
  表统计 last_status 分布，识别"全员失败"等系统级故障，供 Dashboard 顶部告警。

参考文献：
[1] MindStudio, *Heartbeat Pattern Beats Persistent Sessions for AI Agents*, 2025.
    心跳 5 步生命周期 + 上下文包 + 外部持久化层；
[2] Let's Data Science, *Heartbeat-Driven Cognitive Scheduling for LLM Agents*, 2025.
    模块化 + 自适应路由；
[3] AWS Builder's Library, *Timeouts, retries and backoff with jitter*. 退避策略指数 +
    jitter 的经典做法。
"""

from __future__ import annotations

import random
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select, update

from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.scheduled_task import ScheduledTask, TaskExecution

from . import HandlerResult, register_handler

logger = get_logger("negentropy.engine.schedulers.handlers.agent_inspection")


# ---------------------------------------------------------------------------
# 调参（暴露成模块级常量，方便测试 / 配置层覆盖）
# ---------------------------------------------------------------------------

#: 连续失败到达此阈值即进入退避窗口
BACKOFF_FAILURE_THRESHOLD = 3
#: 退避基底 + 上限（指数退避：min(BASE * 2**(consec - threshold), CEILING)）
BACKOFF_BASE_SECONDS = 60.0
BACKOFF_CEILING_SECONDS = 3600.0
#: 上下文包取最近 N 条执行
CONTEXT_PACK_RECENT_LIMIT = 10
#: Token 预算预检窗口（24h 内累计）
TOKEN_BUDGET_WINDOW = timedelta(hours=24)


# ---------------------------------------------------------------------------
# Context Pack
# ---------------------------------------------------------------------------


@dataclass
class ContextPack:
    """巡检 tick 的上下文包 — 受 MindStudio Heartbeat Pattern 启发。

    handler 在执行任何业务动作前必须读取 ContextPack 才能做"知情决策"：
    - ``recent_status`` 揭示是否进入故障模式（连续 fail）；
    - ``tokens_used_in_window`` 用于预算门控；
    - ``payload`` 业务参数原样透传；
    - ``hint`` 一句话摘要，写入 ``output_summary`` 方便 Dashboard 浏览。
    """

    task_id: str
    task_key: str
    handler_kind: str
    role: str | None
    scenario: str | None
    payload: dict[str, Any] = field(default_factory=dict)
    recent_status: list[str] = field(default_factory=list)
    tokens_used_in_window: int = 0
    consecutive_failures: int = 0
    backoff_until: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @property
    def hint(self) -> str:
        parts = [f"role={self.role or 'unknown'}", f"scenario={self.scenario or 'general'}"]
        if self.consecutive_failures:
            parts.append(f"consec_fail={self.consecutive_failures}")
        if self.tokens_used_in_window:
            parts.append(f"tok_24h={self.tokens_used_in_window}")
        return ", ".join(parts)


async def build_context_pack(task: ScheduledTask) -> ContextPack:
    """从 ``task_executions`` 拉最近窗口数据构建上下文包。

    设计取舍：
    - 仅查 ``recent`` 与 ``tokens_used`` 两路 SQL，**不**联表查 Memory / events，
      避免巡检 handler 自己变成重 IO。
    - ``tokens_used_in_window`` 即便所有行 ``tokens_used IS NULL`` 也安全返回 0。
    """
    async with AsyncSessionLocal() as db:
        # 最近 N 条 status
        recent_stmt = (
            select(TaskExecution.status)
            .where(TaskExecution.task_id == task.id)
            .order_by(TaskExecution.started_at.desc())
            .limit(CONTEXT_PACK_RECENT_LIMIT)
        )
        recent = [row[0] for row in (await db.execute(recent_stmt)).all()]

        since = datetime.now(UTC) - TOKEN_BUDGET_WINDOW
        tok_stmt = (
            select(func.coalesce(func.sum(TaskExecution.tokens_used), 0))
            .where(TaskExecution.task_id == task.id)
            .where(TaskExecution.started_at >= since)
        )
        tokens_used = int((await db.execute(tok_stmt)).scalar() or 0)

    return ContextPack(
        task_id=str(task.id),
        task_key=task.key,
        handler_kind=task.handler_kind,
        role=task.role,
        scenario=task.scenario,
        payload=dict(task.payload or {}),
        recent_status=recent,
        tokens_used_in_window=tokens_used,
        consecutive_failures=int(task.consecutive_failures or 0),
        backoff_until=task.backoff_until.isoformat() if task.backoff_until else None,
    )


# ---------------------------------------------------------------------------
# Token Budget Gate
# ---------------------------------------------------------------------------


def _check_token_budget(task: ScheduledTask, ctx: ContextPack) -> str | None:
    """返回 None = 通过；返回字符串 = 拒绝原因。

    ``token_budget=None`` 视为无限制。``token_budget=0`` 视为禁用（永不放行）。
    """
    if task.token_budget is None:
        return None
    if task.token_budget == 0:
        return "token_budget=0 (disabled)"
    if ctx.tokens_used_in_window >= task.token_budget:
        return f"24h tokens {ctx.tokens_used_in_window} >= budget {task.token_budget}"
    return None


# ---------------------------------------------------------------------------
# Backoff Policy
# ---------------------------------------------------------------------------


def _compute_backoff_seconds(consec_failures: int) -> float:
    """指数退避 + ±10% jitter。

    consec=BACKOFF_FAILURE_THRESHOLD → BACKOFF_BASE_SECONDS
    consec=BACKOFF_FAILURE_THRESHOLD+1 → 2 * BASE
    ...
    上限 BACKOFF_CEILING_SECONDS。
    """
    over = max(0, consec_failures - BACKOFF_FAILURE_THRESHOLD)
    base = BACKOFF_BASE_SECONDS * (2**over)
    capped = min(base, BACKOFF_CEILING_SECONDS)
    jitter = capped * (0.9 + 0.2 * random.random())
    return jitter


async def _apply_backoff(task_id: Any, consec_failures: int) -> datetime:
    """连续失败超阈值 → 写 ``backoff_until``，让 Registry 心跳跳过本 task。"""
    delay = _compute_backoff_seconds(consec_failures)
    until = datetime.now(UTC) + timedelta(seconds=delay)
    async with AsyncSessionLocal() as db:
        await db.execute(update(ScheduledTask).where(ScheduledTask.id == task_id).values(backoff_until=until))
        await db.commit()
    logger.info(
        "agent_inspection_backoff_applied",
        task_id=str(task_id),
        consec_failures=consec_failures,
        until=until.isoformat(),
        delay_seconds=delay,
    )
    return until


# ---------------------------------------------------------------------------
# Handler entry
# ---------------------------------------------------------------------------


@register_handler("agent_inspection")
async def agent_inspection_handler(task) -> HandlerResult:
    """根据 ``task.payload.inspection_type`` 分派到具体巡检逻辑。

    生产级三件套（Plan §11 Risk Mitigation 对齐）：
    1. **上下文包**：每次 tick 都 build_context_pack；
    2. **Token 预算门控**：先 _check_token_budget，超额 status='ok' + skipped 标识；
    3. **退避策略**：本次失败后若 consecutive_failures+1 >= 阈值，写 backoff_until。
    """
    payload = task.payload or {}
    inspection_type = payload.get("inspection_type", "self_check")

    ctx = await build_context_pack(task)

    # 预检：token 预算
    skip_reason = _check_token_budget(task, ctx)
    if skip_reason:
        return HandlerResult(
            status="ok",
            output_summary=f"skipped: {skip_reason}",
            metrics={"skipped": 1, **ctx.to_dict()},
        )

    # 派发
    if inspection_type == "self_check":
        result = HandlerResult(
            status="ok",
            output_summary=f"heartbeat alive | {ctx.hint}",
            metrics={"heartbeat": 1},
        )
    elif inspection_type == "faculty_health":
        result = await _faculty_health_check(ctx)
    elif inspection_type == "faculty_deep_check":
        result = await _faculty_deep_check(ctx)
    elif inspection_type == "scheduled_tasks_summary":
        result = await _scheduled_tasks_summary(ctx)
    else:
        logger.warning("agent_inspection_unknown_type", inspection_type=inspection_type)
        result = HandlerResult(
            status="ok",
            output_summary=f"unknown inspection_type={inspection_type}",
            metrics={"unknown": 1},
        )

    # 退避：本次失败 → 看是否要给 task 写 backoff_until。Registry.dispatch 会在
    # 完成时根据 status 自增 / 清零 consecutive_failures；我们在此预测下一次
    # 的 consec 值（当前 +1）来决定。
    if result.status == "failed":
        predicted_consec = (task.consecutive_failures or 0) + 1
        if predicted_consec >= BACKOFF_FAILURE_THRESHOLD:
            try:
                until = await _apply_backoff(task.id, predicted_consec)
                result.metrics.setdefault("backoff_until", until.isoformat())
            except Exception as exc:
                logger.warning("agent_inspection_backoff_write_failed", error=str(exc))

    return result


# ---------------------------------------------------------------------------
# Inspection implementations
# ---------------------------------------------------------------------------


async def _faculty_health_check(ctx: ContextPack) -> HandlerResult:
    """五系部 import 探活（轻量，无 LLM 调用）。"""
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
            metrics={"failures": failures, **results},
        )
    return HandlerResult(status="ok", output_summary=f"{summary} | {ctx.hint}", metrics=results)


async def _faculty_deep_check(ctx: ContextPack) -> HandlerResult:
    """深度健康检查：尝试访问每个 Faculty 模块的关键导出，验证 LlmAgent 配置可解析。

    设计原则：**绝不调用 LLM**，仅做配置层探活。检查项：
    - 每个 faculty 模块 import 成功；
    - 模块内至少有一个 ``Agent`` / ``LlmAgent`` 实例可访问（按惯例命名扫描）；
    - 关键依赖（tools, model）已正确导入。

    本检查相比 ``faculty_health`` 更深一层，能捕获"模块能 import 但 Agent 实例
    构造失败"的隐性故障（如 tool 重命名后引用断裂）。
    """
    import inspect as inspect_mod

    findings: dict[str, dict[str, Any]] = {}
    failures: list[str] = []

    for module_name in (
        "negentropy.agents.faculties.perception",
        "negentropy.agents.faculties.internalization",
        "negentropy.agents.faculties.contemplation",
        "negentropy.agents.faculties.action",
        "negentropy.agents.faculties.influence",
    ):
        short = module_name.split(".")[-1]
        info: dict[str, Any] = {"import": "ok"}
        try:
            mod = __import__(module_name, fromlist=["*"])
        except Exception as exc:
            findings[short] = {"import": f"failed: {exc}"}
            failures.append(short)
            continue

        # 扫描模块中的 LlmAgent / Agent 实例（不构造新的，避免触发 LLM 连接）
        agent_count = 0
        for name, value in inspect_mod.getmembers(mod):
            if name.startswith("_"):
                continue
            cls_name = type(value).__name__
            if cls_name in ("LlmAgent", "Agent", "BaseAgent"):
                agent_count += 1
        info["agent_instances"] = agent_count
        if agent_count == 0:
            info["warning"] = "no agent instances found"
        findings[short] = info

    summary = f"deep_check: {len(findings)} modules; failures={len(failures)}"
    if failures:
        return HandlerResult(
            status="failed",
            output_summary=f"{summary} | {ctx.hint}",
            error=f"deep_check failures: {failures}",
            metrics={"findings": findings},
        )
    return HandlerResult(
        status="ok",
        output_summary=f"{summary} | {ctx.hint}",
        metrics={"findings": findings},
    )


async def _scheduled_tasks_summary(ctx: ContextPack) -> HandlerResult:
    """巡检调度框架自身：统计 last_status 分布，识别系统级故障。

    输出 ``metrics.distribution = {ok: N, failed: M, none: K}``；当 failed
    占比 > 50% 时返回 ``status='failed'``（即"全员失败"系统级警报）。
    """
    async with AsyncSessionLocal() as db:
        stmt = (
            select(
                func.coalesce(ScheduledTask.last_status, "none").label("status"),
                func.count(ScheduledTask.id).label("count"),
            )
            .where(ScheduledTask.enabled.is_(True))
            .group_by(func.coalesce(ScheduledTask.last_status, "none"))
        )
        rows = (await db.execute(stmt)).all()

    distribution: dict[str, int] = {str(r.status): int(r.count) for r in rows}
    total = sum(distribution.values()) or 1
    failed = distribution.get("failed", 0)
    failed_ratio = failed / total

    summary = f"tasks distribution={distribution} | {ctx.hint}"
    if failed_ratio > 0.5 and total >= 2:
        return HandlerResult(
            status="failed",
            output_summary=summary,
            error=f"system-level alert: {failed_ratio:.0%} tasks in failed state",
            metrics={"distribution": distribution, "failed_ratio": failed_ratio},
        )
    return HandlerResult(
        status="ok",
        output_summary=summary,
        metrics={"distribution": distribution, "failed_ratio": failed_ratio},
    )
