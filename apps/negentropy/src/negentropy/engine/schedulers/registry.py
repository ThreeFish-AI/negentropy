"""ScheduledTaskRegistry — 统一心跳调度的注册中心与调度核心。

设计定位：
- 单一注册入口：替代散落在 ``bootstrap.py`` 的 6 个 startup hook + 每个 service
  自管的 ``scheduler.register`` 调用；
- DB-driven：所有任务存 ``scheduled_tasks`` 表，重启不丢；
- 5s 心跳：内部用 ``AsyncScheduler(poll_interval=5)`` 单 job ``_heartbeat_tick``
  扫表，对每行 ``WHERE enabled AND next_fire_at<=NOW() FOR UPDATE SKIP LOCKED``
  派发到对应 handler；
- 执行历史：每次执行写入 ``task_executions``，Dashboard 单一事实源；
- 实时推送：每条新 ``task_execution`` 通过 ``ExecutionBus``（asyncio.Queue 列表）
  广播给 SSE 订阅者，供 ``/scheduler/stream`` 端点消费。

参考文献：
[1] MindStudio, *Heartbeat Pattern Beats Persistent Sessions for AI Agents*, 2025.
    单心跳 + 上下文包 + 外部持久化层。
[2] PostgreSQL Docs, *FOR UPDATE SKIP LOCKED*. 多 worker 并发安全。
[3] GeeksforGeeks, *Scheduling Agent Supervisor Pattern*. 监督 + 健康检测。
"""

from __future__ import annotations

import asyncio
import os
import time
from collections.abc import AsyncIterator
from contextlib import suppress
from dataclasses import asdict
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.scheduled_task import ScheduledTask, TaskExecution

from .async_scheduler import AsyncScheduler, _resolved_default_poll_interval
from .handlers import HandlerResult, _bootstrap_default_handlers, get_handler

logger = get_logger("negentropy.engine.schedulers.registry")

_REGISTRY_ENABLED_KEY = "NEGENTROPY_UNIFIED_SCHEDULER_ENABLED"
_HEARTBEAT_JOB_KEY = "unified_heartbeat"
_DEFAULT_LEASE_SECONDS = 120.0  # 行级认领的 lease：执行未完前不会被另一 worker 重抢


def _registry_disabled() -> bool:
    """``NEGENTROPY_UNIFIED_SCHEDULER_ENABLED=false`` → 跳过统一注册中心。

    Plan 第 4 节确认作为灰度回退开关。
    """
    return os.environ.get(_REGISTRY_ENABLED_KEY, "true").lower() in ("0", "false", "no")


def _utcnow() -> datetime:
    return datetime.now(UTC)


# ---------------------------------------------------------------------------
# ExecutionBus —— 在进程内把执行事件广播给 SSE 订阅者
# ---------------------------------------------------------------------------


class ExecutionBus:
    """asyncio.Queue fan-out 总线。

    每个 SSE 连接 ``subscribe()`` 获得独立队列；``publish()`` 同时压入所有队列。
    队列满 → 丢弃最旧消息（Dashboard 时间线只需要最新事件）。
    """

    def __init__(self, max_buffer_per_subscriber: int = 64) -> None:
        self._subs: list[asyncio.Queue[dict[str, Any]]] = []
        self._max = max_buffer_per_subscriber
        self._lock = asyncio.Lock()

    async def subscribe(self) -> asyncio.Queue[dict[str, Any]]:
        async with self._lock:
            q: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=self._max)
            self._subs.append(q)
            return q

    async def unsubscribe(self, q: asyncio.Queue[dict[str, Any]]) -> None:
        async with self._lock:
            with suppress(ValueError):
                self._subs.remove(q)

    async def publish(self, event: dict[str, Any]) -> None:
        # 不持锁 publish：subscribe/unsubscribe 在小颗粒度内串行
        for q in list(self._subs):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                # 丢最老的，给最新事件让位
                with suppress(asyncio.QueueEmpty):
                    q.get_nowait()
                with suppress(asyncio.QueueFull):
                    q.put_nowait(event)


# ---------------------------------------------------------------------------
# ScheduledTaskRegistry —— 主调度中心
# ---------------------------------------------------------------------------


class ScheduledTaskRegistry:
    """统一调度任务注册中心（进程内单例）。

    生命周期：
    1. ``ensure_defaults()`` — 启动时把 6 个默认任务幂等插入 ``scheduled_tasks``；
    2. ``start()`` — 创建 ``AsyncScheduler``，注册 ``_heartbeat_tick``；
    3. 心跳 tick → 扫表 → dispatch → 写 ``task_executions`` → bus.publish；
    4. ``stop()`` — 停 scheduler、清订阅、清 inflight。
    """

    def __init__(
        self,
        *,
        poll_interval: float | None = None,
        lease_seconds: float = _DEFAULT_LEASE_SECONDS,
    ) -> None:
        self._scheduler = AsyncScheduler(poll_interval=poll_interval or _resolved_default_poll_interval())
        self._lease_seconds = lease_seconds
        self._bus = ExecutionBus()
        self._started = False

    @property
    def is_running(self) -> bool:
        return self._scheduler.is_running

    @property
    def bus(self) -> ExecutionBus:
        return self._bus

    @property
    def poll_interval(self) -> float:
        return self._scheduler.poll_interval

    # ------------------------------------------------------------------
    # 启停
    # ------------------------------------------------------------------

    async def start(self) -> None:
        if _registry_disabled():
            logger.info("unified_scheduler_registry_disabled")
            return
        if self._started:
            return
        # 触发 handler 装饰器副作用注册
        _bootstrap_default_handlers()
        try:
            await self.ensure_defaults()
        except Exception:
            logger.exception("unified_scheduler_ensure_defaults_failed")
        self._scheduler.register(
            key=_HEARTBEAT_JOB_KEY,
            callback=self._heartbeat_tick,
            interval_seconds=self._scheduler.poll_interval,
        )
        self._scheduler.start()
        self._started = True
        logger.info("unified_scheduler_started", poll_interval=self._scheduler.poll_interval)

    def stop(self) -> None:
        if not self._started:
            return
        self._scheduler.stop()
        self._started = False
        logger.info("unified_scheduler_stopped")

    # ------------------------------------------------------------------
    # 默认任务幂等注入
    # ------------------------------------------------------------------

    async def ensure_defaults(self) -> None:
        """把 Plan 第 5.1 节列出的 5 个非 skill 默认任务幂等插入 DB。

        skill_invoke 任务已通过 0034 migration 从 skill_schedules 回填；
        本函数只关心非 skill 任务的首次注入。
        """
        defaults: list[dict[str, Any]] = [
            dict(
                key="pipeline_watchdog",
                handler_kind="pipeline_watchdog",
                trigger_type="interval",
                interval_seconds=60.0,
                role="sentinel",
                scenario="kg_kb_maintenance",
                category="maintenance",
                display_name="KB/KG Pipeline Watchdog",
                description="收敛 cancelling/running 长尾状态的 KB/KG runs",
            ),
            dict(
                key="session_title_inspect",
                handler_kind="session_title_inspect",
                trigger_type="interval",
                interval_seconds=300.0,
                role="sentinel",
                scenario="session_quality",
                category="maintenance",
                display_name="Session Title Inspector",
                description="周期巡检 Session 标题，补齐与刷新",
            ),
            dict(
                key="cache_warm",
                handler_kind="cache_warm",
                trigger_type="oneshot",
                role="system",
                scenario="bootstrap",
                category="maintenance",
                display_name="Model Config Cache Warm",
                description="启动时预热 LLM/Embedding 配置缓存",
            ),
            dict(
                key="pgvector_check",
                handler_kind="pgvector_check",
                trigger_type="oneshot",
                role="system",
                scenario="bootstrap",
                category="maintenance",
                display_name="pgvector Extension Check",
                description="启动时检查 pgvector 扩展可用性",
            ),
            dict(
                key="agent_inspection_demo",
                handler_kind="agent_inspection",
                trigger_type="interval",
                interval_seconds=300.0,
                role="supervisor",
                scenario="agent_health",
                category="cognitive",
                display_name="Faculty Health Inspector",
                description="每 5min 检查 Faculties 五系部模块可用性（示例巡检任务）",
                payload={"inspection_type": "faculty_health"},
            ),
        ]
        async with AsyncSessionLocal() as db:
            for spec in defaults:
                await _upsert_default_task(db, spec, lease_seconds=self._lease_seconds)
            await db.commit()

    # ------------------------------------------------------------------
    # 心跳 tick：扫表 → 派发
    # ------------------------------------------------------------------

    async def _heartbeat_tick(self) -> None:
        """单次心跳：原子认领 due 行 → 在事务外派发到 handler。"""
        async with AsyncSessionLocal() as db:
            due_rows = await _claim_due_tasks(db, lease_seconds=self._lease_seconds)
            await db.commit()

        if not due_rows:
            return

        # 在事务外派发：handler 自己开新事务，避免长事务持锁
        for task_row in due_rows:
            try:
                await self.dispatch(task_row.id, fire_reason="tick")
            except Exception as exc:
                logger.warning(
                    "unified_scheduler_dispatch_failed",
                    task_id=str(task_row.id),
                    error=str(exc),
                )

    async def dispatch(self, task_id: UUID, *, fire_reason: str = "manual") -> UUID | None:
        """对单个 task 执行一次 dispatch。返回 execution_id（失败返回 None）。

        ``fire_reason ∈ {tick, manual, replay}``：区分调度源便于审计。
        manual 触发在 ``_heartbeat_tick`` 外路径，不会经过 lease 认领，
        因此可能与 tick 的并发 dispatch 重叠；由 ``max_concurrency`` 保证。
        """
        if _registry_disabled():
            return None
        handler = None
        execution_id: UUID | None = None
        started_at = _utcnow()
        started_monotonic = time.monotonic()

        async with AsyncSessionLocal() as db:
            task = await db.get(ScheduledTask, task_id)
            if task is None:
                logger.warning("dispatch_task_not_found", task_id=str(task_id))
                return None
            if not task.enabled and fire_reason != "manual":
                # tick 路径下 disabled 不应被扫到（_claim_due_tasks 已过滤），
                # 但 manual 容许 disabled 状态下手动跑（Plan 7 节 /tasks/{id}/run 语义）
                return None

            handler = get_handler(task.handler_kind)
            if handler is None:
                msg = f"handler_kind={task.handler_kind} not registered"
                logger.warning("dispatch_handler_missing", task_id=str(task_id), handler_kind=task.handler_kind)
                exec_row = TaskExecution(
                    task_id=task.id,
                    started_at=started_at,
                    finished_at=started_at,
                    status="failed",
                    duration_ms=0,
                    error=msg,
                    fire_reason=fire_reason,
                )
                db.add(exec_row)
                task.last_status = "failed"
                task.last_error = msg
                task.consecutive_failures += 1
                await db.commit()
                await db.refresh(exec_row)
                await self._publish_execution(task, exec_row)
                return exec_row.id

            # 先写一条 running 记录，确保即便 handler 崩死也能在 Dashboard 看到 in-flight
            exec_row = TaskExecution(
                task_id=task.id,
                started_at=started_at,
                status="running",
                fire_reason=fire_reason,
            )
            db.add(exec_row)
            await db.commit()
            await db.refresh(exec_row)
            execution_id = exec_row.id

        # 真正执行（不持 DB 事务）
        result: HandlerResult
        try:
            handler_result = await handler(task)
            result = handler_result if isinstance(handler_result, HandlerResult) else HandlerResult(status="ok")
        except Exception as exc:
            logger.exception("dispatch_handler_exception", task_id=str(task_id))
            result = HandlerResult(status="failed", error=str(exc))

        duration_ms = int((time.monotonic() - started_monotonic) * 1000)
        finished_at = _utcnow()

        async with AsyncSessionLocal() as db:
            # 回写 execution
            exec_row = await db.get(TaskExecution, execution_id)
            if exec_row is not None:
                exec_row.finished_at = finished_at
                exec_row.status = result.status
                exec_row.duration_ms = duration_ms
                exec_row.tokens_used = result.tokens_used
                exec_row.output_summary = result.output_summary
                exec_row.error = result.error
                exec_row.skill_id = result.skill_id
                exec_row.skill_schedule_id = result.skill_schedule_id
                exec_row.memory_id = result.memory_id
                exec_row.pipeline_run_id = result.pipeline_run_id
                exec_row.thread_id = result.thread_id

            # 回写 task 状态
            task = await db.get(ScheduledTask, task_id)
            if task is not None:
                task.last_fire_at = started_at
                task.last_status = result.status
                task.last_error = result.error
                task.total_runs += 1
                if result.status == "failed":
                    task.consecutive_failures += 1
                else:
                    task.consecutive_failures = 0
                task.next_fire_at = _compute_next_fire(task)

            await db.commit()
            if exec_row is not None and task is not None:
                await self._publish_execution(task, exec_row)

        return execution_id

    async def _publish_execution(self, task: ScheduledTask, exec_row: TaskExecution) -> None:
        await self._bus.publish(_serialize_execution(task, exec_row))

    # ------------------------------------------------------------------
    # SSE 订阅
    # ------------------------------------------------------------------

    async def stream_executions(self, *, task_id: UUID | None = None) -> AsyncIterator[dict[str, Any]]:
        """SSE 端点消费：异步生成 execution 事件流。"""
        q = await self._bus.subscribe()
        try:
            while True:
                event = await q.get()
                if task_id is not None and event.get("task_id") != str(task_id):
                    continue
                yield event
        finally:
            await self._bus.unsubscribe(q)


# ---------------------------------------------------------------------------
# 辅助：DB SQL
# ---------------------------------------------------------------------------


async def _claim_due_tasks(db: AsyncSession, *, lease_seconds: float) -> list[ScheduledTask]:
    """原子认领 due 任务：FOR UPDATE SKIP LOCKED + 推 next_fire_at 到 lease 之后。

    交易边界：
    1. SELECT due rows with row-lock；
    2. UPDATE next_fire_at = NOW() + lease（避免同 tick 内被另一 worker 再次扫到）；
    3. COMMIT 释放行锁；
    4. 调用方在事务外调度 handler。

    handler 完成后 ``dispatch`` 内部按 ``_compute_next_fire`` 重算正式的
    ``next_fire_at`` 并覆盖本次 lease 占位。
    """
    now = _utcnow()
    stmt = (
        select(ScheduledTask)
        .where(ScheduledTask.enabled.is_(True))
        .where(ScheduledTask.next_fire_at <= now)
        .where((ScheduledTask.backoff_until.is_(None)) | (ScheduledTask.backoff_until <= now))
        .with_for_update(skip_locked=True)
        .limit(50)
    )
    rows = (await db.execute(stmt)).scalars().all()
    if not rows:
        # oneshot 兜底：还未触发过的 oneshot 任务（next_fire_at IS NULL）
        oneshot_stmt = (
            select(ScheduledTask)
            .where(ScheduledTask.enabled.is_(True))
            .where(ScheduledTask.trigger_type == "oneshot")
            .where(ScheduledTask.last_fire_at.is_(None))
            .with_for_update(skip_locked=True)
            .limit(50)
        )
        rows = (await db.execute(oneshot_stmt)).scalars().all()

    if rows:
        ids = [r.id for r in rows]
        # 推 next_fire_at 到 lease 之后，防止重复触发；handler 完成后再覆盖为真实值
        await db.execute(
            update(ScheduledTask)
            .where(ScheduledTask.id.in_(ids))
            .values(next_fire_at=now + timedelta(seconds=lease_seconds))
        )
    return list(rows)


async def _upsert_default_task(db: AsyncSession, spec: dict[str, Any], *, lease_seconds: float) -> None:
    """按 ``key`` 幂等 upsert 默认任务；已存在则只补缺失字段，不覆盖运行态。"""
    key = spec["key"]
    existing = (await db.execute(select(ScheduledTask).where(ScheduledTask.key == key))).scalar_one_or_none()
    if existing is not None:
        # 已存在 → 只补 display_name / description / role / scenario 等元数据，
        # 不动 enabled / interval / cron / 触发态字段，尊重用户在 UI 上的修改。
        for field_name in ("display_name", "description", "role", "scenario", "category"):
            if not getattr(existing, field_name, None) and spec.get(field_name):
                setattr(existing, field_name, spec[field_name])
        # 补 payload 缺省字段（不覆盖已有 keys）
        if spec.get("payload"):
            merged = dict(existing.payload or {})
            for k, v in spec["payload"].items():
                merged.setdefault(k, v)
            existing.payload = merged
        return

    next_fire = _utcnow() if spec.get("trigger_type") == "oneshot" else _utcnow()
    new = ScheduledTask(
        key=key,
        handler_kind=spec["handler_kind"],
        trigger_type=spec["trigger_type"],
        interval_seconds=spec.get("interval_seconds"),
        cron_expr=spec.get("cron_expr"),
        enabled=spec.get("enabled", True),
        role=spec.get("role"),
        scenario=spec.get("scenario"),
        category=spec.get("category"),
        display_name=spec.get("display_name"),
        description=spec.get("description"),
        payload=spec.get("payload") or {},
        max_concurrency=spec.get("max_concurrency", 1),
        token_budget=spec.get("token_budget"),
        next_fire_at=next_fire,
    )
    db.add(new)


def _compute_next_fire(task: ScheduledTask) -> datetime | None:
    """根据 trigger_type 计算下次触发时刻。"""
    now = _utcnow()
    if task.trigger_type == "interval" and task.interval_seconds:
        return now + timedelta(seconds=float(task.interval_seconds))
    if task.trigger_type == "cron" and task.cron_expr:
        try:
            from croniter import croniter

            return croniter(task.cron_expr, now).get_next(datetime)
        except Exception:
            return now + timedelta(minutes=5)  # 兜底：5min 后重试
    # oneshot：用 sentinel 远期日期表示"永不再触发"
    if task.trigger_type == "oneshot":
        return datetime(9999, 1, 1, tzinfo=UTC)
    return None


def _serialize_execution(task: ScheduledTask, exec_row: TaskExecution) -> dict[str, Any]:
    """把 execution 序列化为 SSE 事件 / API 响应通用结构。"""
    return {
        "id": str(exec_row.id),
        "task_id": str(exec_row.task_id),
        "task_key": task.key,
        "handler_kind": task.handler_kind,
        "role": task.role,
        "scenario": task.scenario,
        "category": task.category,
        "started_at": exec_row.started_at.isoformat() if exec_row.started_at else None,
        "finished_at": exec_row.finished_at.isoformat() if exec_row.finished_at else None,
        "status": exec_row.status,
        "duration_ms": exec_row.duration_ms,
        "tokens_used": exec_row.tokens_used,
        "output_summary": exec_row.output_summary,
        "error": exec_row.error,
        "fire_reason": exec_row.fire_reason,
    }


# ---------------------------------------------------------------------------
# 全局单例（与 SkillScheduler lazy 模式一致）
# ---------------------------------------------------------------------------

_GLOBAL_REGISTRY: ScheduledTaskRegistry | None = None
_GLOBAL_REGISTRY_LOCK: asyncio.Lock | None = None


def _get_lock() -> asyncio.Lock:
    global _GLOBAL_REGISTRY_LOCK
    if _GLOBAL_REGISTRY_LOCK is None:
        _GLOBAL_REGISTRY_LOCK = asyncio.Lock()
    return _GLOBAL_REGISTRY_LOCK


def get_registry() -> ScheduledTaskRegistry | None:
    """同步获取已启动的 registry（未启动返回 None）。"""
    return _GLOBAL_REGISTRY


async def ensure_registry_started() -> ScheduledTaskRegistry | None:
    """幂等启动全局 registry；与 SkillScheduler 的 lazy 单例同款。"""
    global _GLOBAL_REGISTRY
    if _registry_disabled():
        return None
    if _GLOBAL_REGISTRY is not None and _GLOBAL_REGISTRY.is_running:
        return _GLOBAL_REGISTRY
    async with _get_lock():
        if _GLOBAL_REGISTRY is not None and _GLOBAL_REGISTRY.is_running:
            return _GLOBAL_REGISTRY
        registry = ScheduledTaskRegistry()
        try:
            await registry.start()
        except Exception:
            logger.exception("unified_scheduler_registry_start_failed")
            return None
        _GLOBAL_REGISTRY = registry
        return registry


def reset_registry_for_tests() -> None:
    """测试钩子：清空全局单例（让 ensure_registry_started 重新初始化）。"""
    global _GLOBAL_REGISTRY, _GLOBAL_REGISTRY_LOCK
    if _GLOBAL_REGISTRY is not None:
        _GLOBAL_REGISTRY.stop()
    _GLOBAL_REGISTRY = None
    _GLOBAL_REGISTRY_LOCK = None


__all__ = [
    "ExecutionBus",
    "ScheduledTaskRegistry",
    "ensure_registry_started",
    "get_registry",
    "reset_registry_for_tests",
]


# 抑制未使用 warning（asdict 在 Phase 5 supervisor 模型中会用到）
_ = asdict
