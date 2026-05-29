"""/scheduler/* 聚合 API — Phase 4 Dashboard 后端契约。

端点清单：
- GET  /scheduler/kpis                KPI 卡片数据
- GET  /scheduler/tasks               任务清单（多维筛选）
- GET  /scheduler/tasks/{id}          单任务详情 + 最近执行
- GET  /scheduler/executions          执行历史（分页 + 多维筛选）
- GET  /scheduler/stats               分组聚合（角色/场景/Agent/Owner/Handler）
- GET  /scheduler/handlers            Handler manifest（统一定义协议）
- POST /scheduler/tasks               创建任务
- PUT  /scheduler/tasks/{id}          更新任务
- DELETE /scheduler/tasks/{id}        删除任务
- POST /scheduler/tasks/{id}/run      手动触发
- POST /scheduler/tasks/{id}/toggle   启停
- GET  /scheduler/stream              SSE 实时执行事件

参考文献：
[1] FastAPI Docs, *Server-Sent Events with StreamingResponse*. SSE 实现模式。
[2] Plan §7, §11 — 聚合 API 设计与缓存策略。
"""

from __future__ import annotations

import asyncio
import json
import time as _time
from datetime import UTC, datetime, timedelta
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Path, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import and_, case, func, select, update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from negentropy.config import settings
from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.agent import Agent
from negentropy.models.scheduled_task import ScheduledTask, TaskExecution
from negentropy.models.state import UserState

logger = get_logger("negentropy.interface.scheduler_api")

router = APIRouter(prefix="/scheduler", tags=["scheduler"])


# ---------------------------------------------------------------------------
# 工具：时间窗解析
# ---------------------------------------------------------------------------

_WINDOWS = {
    "1h": timedelta(hours=1),
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
}


def _window_to_delta(window: str) -> timedelta:
    return _WINDOWS.get(window, _WINDOWS["24h"])


def _utcnow() -> datetime:
    return datetime.now(UTC)


# ---------------------------------------------------------------------------
# 10s in-memory 缓存（避免 Dashboard 高频请求打 DB）
# ---------------------------------------------------------------------------


class _TTLCache:
    """单进程 TTL cache。Plan 第 7 节确认 stats / kpis 加 10s 缓存。"""

    def __init__(self, ttl_seconds: float = 10.0) -> None:
        self._ttl = ttl_seconds
        self._store: dict[str, tuple[float, Any]] = {}
        self._lock = asyncio.Lock()

    async def get_or_compute(self, key: str, compute):
        async with self._lock:
            now = _time.monotonic()
            cached = self._store.get(key)
            if cached and (now - cached[0] < self._ttl):
                return cached[1]
        value = await compute()
        async with self._lock:
            self._store[key] = (_time.monotonic(), value)
        return value

    def invalidate(self) -> None:
        self._store.clear()


_STATS_CACHE = _TTLCache(ttl_seconds=10.0)


# ---------------------------------------------------------------------------
# 序列化
# ---------------------------------------------------------------------------


def _serialize_task(t: ScheduledTask, recent: list[str] | None = None) -> dict[str, Any]:
    return {
        "id": str(t.id),
        "key": t.key,
        "handler_kind": t.handler_kind,
        "trigger_type": t.trigger_type,
        "interval_seconds": t.interval_seconds,
        "cron_expr": t.cron_expr,
        "enabled": t.enabled,
        "owner_id": t.owner_id,
        "participant_id": t.participant_id,
        "agent_id": str(t.agent_id) if t.agent_id else None,
        "role": t.role,
        "scenario": t.scenario,
        "category": t.category,
        "display_name": t.display_name,
        "description": t.description,
        "last_fire_at": t.last_fire_at.isoformat() if t.last_fire_at else None,
        "next_fire_at": t.next_fire_at.isoformat() if t.next_fire_at else None,
        "last_status": t.last_status,
        "last_error": t.last_error,
        "consecutive_failures": t.consecutive_failures,
        "total_runs": t.total_runs,
        "max_concurrency": t.max_concurrency,
        "token_budget": t.token_budget,
        "backoff_until": t.backoff_until.isoformat() if t.backoff_until else None,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
        "payload": t.payload or {},
        "recent": recent or [],
        "is_system": t.is_system,
    }


def _serialize_execution(e: TaskExecution, task: ScheduledTask | None = None) -> dict[str, Any]:
    return {
        "id": str(e.id),
        "task_id": str(e.task_id),
        "task_key": task.key if task else None,
        "handler_kind": task.handler_kind if task else None,
        "role": task.role if task else None,
        "scenario": task.scenario if task else None,
        "category": task.category if task else None,
        "started_at": e.started_at.isoformat() if e.started_at else None,
        "finished_at": e.finished_at.isoformat() if e.finished_at else None,
        "status": e.status,
        "duration_ms": e.duration_ms,
        "tokens_used": e.tokens_used,
        "output_summary": e.output_summary,
        "error": e.error,
        "fire_reason": e.fire_reason,
        "skill_id": str(e.skill_id) if e.skill_id else None,
        "skill_schedule_id": str(e.skill_schedule_id) if e.skill_schedule_id else None,
        "memory_id": str(e.memory_id) if e.memory_id else None,
        "pipeline_run_id": str(e.pipeline_run_id) if e.pipeline_run_id else None,
        "thread_id": str(e.thread_id) if e.thread_id else None,
    }


# ---------------------------------------------------------------------------
# GET /scheduler/kpis
# ---------------------------------------------------------------------------


@router.get("/kpis")
async def get_kpis(window: Literal["1h", "24h", "7d"] = Query("24h")) -> dict[str, Any]:
    """返回 Dashboard 顶部 6 卡片所需 KPI 指标。"""

    async def _compute():
        since = _utcnow() - _window_to_delta(window)
        async with AsyncSessionLocal() as db:
            total_tasks = (await db.execute(select(func.count(ScheduledTask.id)))).scalar() or 0
            enabled_tasks = (
                await db.execute(select(func.count(ScheduledTask.id)).where(ScheduledTask.enabled.is_(True)))
            ).scalar() or 0
            running = (
                await db.execute(select(func.count(TaskExecution.id)).where(TaskExecution.status == "running"))
            ).scalar() or 0

            # 窗口内 runs / success / failed / avg_latency
            window_stmt = select(
                func.count(TaskExecution.id),
                func.sum(case((TaskExecution.status == "ok", 1), else_=0)),
                func.sum(case((TaskExecution.status == "failed", 1), else_=0)),
                func.avg(TaskExecution.duration_ms),
            ).where(TaskExecution.started_at >= since)
            row = (await db.execute(window_stmt)).one()
            runs = int(row[0] or 0)
            success = int(row[1] or 0)
            failed = int(row[2] or 0)
            avg_latency_ms = float(row[3] or 0)

            success_rate = (success / runs) if runs else 0.0
            return {
                "window": window,
                "total_tasks": total_tasks,
                "enabled_tasks": enabled_tasks,
                "runs": runs,
                "success": success,
                "failed": failed,
                "running": running,
                "success_rate": round(success_rate, 4),
                "avg_latency_ms": round(avg_latency_ms, 2),
            }

    return await _STATS_CACHE.get_or_compute(f"kpis:{window}", _compute)


# ---------------------------------------------------------------------------
# GET /scheduler/tasks
# ---------------------------------------------------------------------------


@router.get("/tasks")
async def list_tasks(
    enabled: bool | None = Query(None),
    role: str | None = Query(None),
    scenario: str | None = Query(None),
    agent: str | None = Query(None),
    owner: str | None = Query(None),
    handler_kind: str | None = Query(None),
    q: str | None = Query(None, description="模糊搜索 key / display_name"),
    limit: int = Query(50, ge=1, le=200),
    cursor: str | None = Query(None, description="ISO 时间戳，按 updated_at 倒序分页"),
) -> dict[str, Any]:
    """任务清单 + 最近 3 次执行状态（用于 ◐◐◐ 简明指示）。"""

    async with AsyncSessionLocal() as db:
        stmt = select(ScheduledTask)
        clauses: list[Any] = []
        if enabled is not None:
            clauses.append(ScheduledTask.enabled.is_(enabled))
        if role:
            clauses.append(ScheduledTask.role == role)
        if scenario:
            clauses.append(ScheduledTask.scenario == scenario)
        if agent:
            try:
                clauses.append(ScheduledTask.agent_id == UUID(agent))
            except (ValueError, TypeError):
                pass
        if owner:
            clauses.append(ScheduledTask.owner_id == owner)
        if handler_kind:
            clauses.append(ScheduledTask.handler_kind == handler_kind)
        if q:
            like = f"%{q}%"
            clauses.append((ScheduledTask.key.ilike(like)) | (ScheduledTask.display_name.ilike(like)))
        if cursor:
            try:
                cursor_dt = datetime.fromisoformat(cursor)
                clauses.append(ScheduledTask.updated_at < cursor_dt)
            except ValueError:
                pass
        if clauses:
            stmt = stmt.where(and_(*clauses))
        stmt = stmt.order_by(ScheduledTask.updated_at.desc()).limit(limit + 1)
        rows = (await db.execute(stmt)).scalars().all()

        has_more = len(rows) > limit
        rows = rows[:limit]

        # 批量取每个 task 的最近 3 次执行状态：
        # 用 ROW_NUMBER OVER (PARTITION BY task_id ORDER BY started_at DESC) 保证
        # 每个 task_id 都能取到自己的前 3 行，避免单个高频任务（如 watchdog 每 60s
        # 一次）按全表 LIMIT 排序后挤占低频任务（如 agent_inspection 每 5min 一次）
        # 的状态点指示位。
        task_ids = [r.id for r in rows]
        recent_map: dict[UUID, list[str]] = {tid: [] for tid in task_ids}
        if task_ids:
            rn_col = (
                func.row_number()
                .over(
                    partition_by=TaskExecution.task_id,
                    order_by=TaskExecution.started_at.desc(),
                )
                .label("rn")
            )
            ranked = (
                select(
                    TaskExecution.task_id.label("task_id"),
                    TaskExecution.status.label("status"),
                    rn_col,
                )
                .where(TaskExecution.task_id.in_(task_ids))
                .subquery()
            )
            recent_stmt = (
                select(ranked.c.task_id, ranked.c.status)
                .where(ranked.c.rn <= 3)
                .order_by(ranked.c.task_id, ranked.c.rn)
            )
            for tid, st in (await db.execute(recent_stmt)).all():
                recent_map[tid].append(st)

        items = [_serialize_task(r, recent=recent_map.get(r.id, [])) for r in rows]
        next_cursor = rows[-1].updated_at.isoformat() if has_more and rows else None
        return {"items": items, "next_cursor": next_cursor}


# ---------------------------------------------------------------------------
# GET /scheduler/tasks/{id}
# ---------------------------------------------------------------------------


@router.get("/tasks/{task_id}")
async def get_task(task_id: UUID = Path(...), recent_limit: int = Query(50, ge=1, le=200)) -> dict[str, Any]:
    async with AsyncSessionLocal() as db:
        task = await db.get(ScheduledTask, task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="task not found")
        recent_stmt = (
            select(TaskExecution)
            .where(TaskExecution.task_id == task_id)
            .order_by(TaskExecution.started_at.desc())
            .limit(recent_limit)
        )
        recent = (await db.execute(recent_stmt)).scalars().all()
        return {
            **_serialize_task(task, recent=[r.status for r in recent[:3]]),
            "recent_executions": [_serialize_execution(e, task) for e in recent],
        }


# ---------------------------------------------------------------------------
# GET /scheduler/executions
# ---------------------------------------------------------------------------


@router.get("/executions")
async def list_executions(
    task_id: UUID | None = Query(None),
    status_filter: Literal["ok", "failed", "running", "cancelled", "timeout"] | None = Query(None, alias="status"),
    since: datetime | None = Query(None),
    until: datetime | None = Query(None),
    role: str | None = Query(None),
    scenario: str | None = Query(None),
    agent: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    cursor: str | None = Query(None, description="ISO 时间戳，按 started_at 倒序分页"),
) -> dict[str, Any]:
    async with AsyncSessionLocal() as db:
        stmt = select(TaskExecution, ScheduledTask).join(ScheduledTask, ScheduledTask.id == TaskExecution.task_id)
        clauses: list[Any] = []
        if task_id is not None:
            clauses.append(TaskExecution.task_id == task_id)
        if status_filter:
            clauses.append(TaskExecution.status == status_filter)
        if since:
            clauses.append(TaskExecution.started_at >= since)
        if until:
            clauses.append(TaskExecution.started_at <= until)
        if role:
            clauses.append(ScheduledTask.role == role)
        if scenario:
            clauses.append(ScheduledTask.scenario == scenario)
        if agent:
            try:
                clauses.append(ScheduledTask.agent_id == UUID(agent))
            except (ValueError, TypeError):
                pass
        if cursor:
            try:
                cursor_dt = datetime.fromisoformat(cursor)
                clauses.append(TaskExecution.started_at < cursor_dt)
            except ValueError:
                pass
        if clauses:
            stmt = stmt.where(and_(*clauses))
        stmt = stmt.order_by(TaskExecution.started_at.desc()).limit(limit + 1)
        rows = (await db.execute(stmt)).all()
        has_more = len(rows) > limit
        rows = rows[:limit]
        items = [_serialize_execution(e, t) for e, t in rows]
        next_cursor = rows[-1][0].started_at.isoformat() if has_more and rows else None
        return {"items": items, "next_cursor": next_cursor}


# ---------------------------------------------------------------------------
# GET /scheduler/stats
# ---------------------------------------------------------------------------


@router.get("/stats")
async def get_stats(
    group_by: Literal["role", "scenario", "agent", "owner", "handler_kind", "category"] = Query(...),
    window: Literal["1h", "24h", "7d"] = Query("24h"),
) -> dict[str, Any]:
    """按指定维度聚合执行历史，驱动 Dashboard 多维统计图。"""

    cache_key = f"stats:{group_by}:{window}"

    async def _compute():
        since = _utcnow() - _window_to_delta(window)
        column_map = {
            "role": ScheduledTask.role,
            "scenario": ScheduledTask.scenario,
            "agent": ScheduledTask.agent_id,
            "owner": ScheduledTask.owner_id,
            "handler_kind": ScheduledTask.handler_kind,
            "category": ScheduledTask.category,
        }
        group_col = column_map[group_by]

        async with AsyncSessionLocal() as db:
            stmt = (
                select(
                    group_col.label("bucket_key"),
                    func.count(TaskExecution.id).label("runs"),
                    func.sum(case((TaskExecution.status == "ok", 1), else_=0)).label("success"),
                    func.sum(case((TaskExecution.status == "failed", 1), else_=0)).label("failed"),
                    func.avg(TaskExecution.duration_ms).label("avg_ms"),
                )
                .join(ScheduledTask, ScheduledTask.id == TaskExecution.task_id)
                .where(TaskExecution.started_at >= since)
                .group_by(group_col)
                .order_by(func.count(TaskExecution.id).desc())
            )
            rows = (await db.execute(stmt)).all()

            # --- Label resolution: owner / agent 维度需将 ID 映射为可读名称 ---
            label_map: dict[str, str] = {}
            none_label = "unknown"

            if group_by == "owner":
                owner_ids = [str(r.bucket_key) for r in rows if r.bucket_key is not None]
                if owner_ids:
                    user_rows = (
                        await db.execute(
                            select(UserState.user_id, UserState.state).where(
                                UserState.user_id.in_(owner_ids),
                                UserState.app_name == settings.app_name,
                            )
                        )
                    ).all()
                    for uid, state in user_rows:
                        profile = (state or {}).get("profile", {})
                        label_map[uid] = profile.get("name") or profile.get("email") or uid
                none_label = "System"

            elif group_by == "agent":
                agent_ids = [r.bucket_key for r in rows if r.bucket_key is not None]
                if agent_ids:
                    agent_rows = (
                        await db.execute(
                            select(Agent.id, Agent.display_name, Agent.name).where(
                                Agent.id.in_(agent_ids),
                            )
                        )
                    ).all()
                    for aid, dname, name in agent_rows:
                        label_map[str(aid)] = dname or name or str(aid)
                none_label = "Unassigned"

            buckets = []
            for r in rows:
                raw_key = str(r.bucket_key) if r.bucket_key is not None else None
                if raw_key is None:
                    bucket_key = none_label
                    label = none_label
                else:
                    bucket_key = raw_key
                    label = label_map.get(raw_key, raw_key)
                runs = int(r.runs or 0)
                success = int(r.success or 0)
                failed = int(r.failed or 0)
                buckets.append(
                    {
                        "key": bucket_key,
                        "label": label,
                        "runs": runs,
                        "success": success,
                        "failed": failed,
                        "success_rate": round(success / runs, 4) if runs else 0.0,
                        "avg_ms": round(float(r.avg_ms or 0), 2),
                    }
                )
            return {"group_by": group_by, "window": window, "buckets": buckets}

    return await _STATS_CACHE.get_or_compute(cache_key, _compute)


# ---------------------------------------------------------------------------
# POST /scheduler/tasks/{id}/run
# ---------------------------------------------------------------------------


@router.post("/tasks/{task_id}/run")
async def manual_run_task(task_id: UUID) -> dict[str, Any]:
    """手动触发一次任务执行。"""
    from negentropy.engine.schedulers.registry import ensure_registry_started

    registry = await ensure_registry_started()
    if registry is None:
        raise HTTPException(status_code=503, detail="scheduler registry disabled")

    # 校验 task 存在
    async with AsyncSessionLocal() as db:
        task = await db.get(ScheduledTask, task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="task not found")

    execution_id = await registry.dispatch(task_id, fire_reason="manual")
    _STATS_CACHE.invalidate()
    return {"ok": True, "execution_id": str(execution_id) if execution_id else None}


# ---------------------------------------------------------------------------
# POST /scheduler/tasks/{id}/toggle
# ---------------------------------------------------------------------------


class ToggleBody(BaseModel):
    enabled: bool


@router.post("/tasks/{task_id}/toggle")
async def toggle_task(task_id: UUID, body: ToggleBody) -> dict[str, Any]:
    async with AsyncSessionLocal() as db:
        task = await db.get(ScheduledTask, task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="task not found")
        try:
            await db.execute(update(ScheduledTask).where(ScheduledTask.id == task_id).values(enabled=body.enabled))
            await db.commit()
        except SQLAlchemyError as exc:
            logger.warning("toggle_task_failed", task_id=str(task_id), error=str(exc))
            raise HTTPException(status_code=500, detail=f"toggle failed: {exc}") from exc
    _STATS_CACHE.invalidate()
    return {"ok": True, "enabled": body.enabled}


# ---------------------------------------------------------------------------
# GET /scheduler/stream (SSE)
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Handler Manifest — 统一定义协议
# ---------------------------------------------------------------------------


def _serialize_descriptor(d: HandlerDescriptor) -> dict[str, Any]:  # noqa: F821
    """将 HandlerDescriptor dataclass 序列化为 API 响应 dict。"""
    from negentropy.engine.schedulers.handlers import PayloadField

    def _field(f: PayloadField) -> dict[str, Any]:
        result: dict[str, Any] = {
            "name": f.name,
            "label": f.label,
            "type": f.type,
            "required": f.required,
        }
        if f.default is not None:
            result["default"] = f.default
        if f.enum_options:
            result["enum_options"] = list(f.enum_options)
        if f.help_text:
            result["help_text"] = f.help_text
        if f.applies_when:
            result["applies_when"] = list(f.applies_when)
        return result

    return {
        "handler_kind": d.handler_kind,
        "label": d.label,
        "description": d.description,
        "trigger_types": list(d.supported_trigger_types),
        "payload_fields": [_field(f) for f in d.payload_fields],
        "discriminator_field": d.discriminator_field,
        "default_trigger_type": d.default_trigger_type,
        "supports_token_budget": d.supports_token_budget,
    }


@router.get("/handlers")
async def list_handler_descriptors() -> dict[str, Any]:
    """返回所有已注册 Handler 的能力描述（驱动 UI 动态表单）。"""
    from negentropy.engine.schedulers.handlers import _bootstrap_default_handlers, list_descriptors

    _bootstrap_default_handlers()  # 幂等：确保 handler 模块已 import → 描述器已注册
    return {"items": [_serialize_descriptor(d) for d in list_descriptors()]}


# ---------------------------------------------------------------------------
# CRUD — Pydantic 请求模型
# ---------------------------------------------------------------------------


class TaskCreateRequest(BaseModel):
    key: str = Field(..., min_length=1, max_length=192, description="任务唯一标识，创建后不可变")
    handler_kind: str = Field(..., min_length=1, max_length=64)
    trigger_type: Literal["interval", "cron", "oneshot"]
    interval_seconds: float | None = None
    cron_expr: str | None = None
    enabled: bool = True
    owner_id: str | None = None
    participant_id: str | None = None
    agent_id: UUID | None = None
    role: str | None = None
    scenario: str | None = None
    category: str | None = None
    display_name: str | None = None
    description: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    max_concurrency: int = Field(default=1, ge=1)
    token_budget: int | None = Field(default=None, ge=0)


class TaskUpdateRequest(BaseModel):
    handler_kind: str | None = None
    trigger_type: Literal["interval", "cron", "oneshot"] | None = None
    interval_seconds: float | None = None
    cron_expr: str | None = None
    enabled: bool | None = None
    owner_id: str | None = None
    participant_id: str | None = None
    agent_id: UUID | None = None
    role: str | None = None
    scenario: str | None = None
    category: str | None = None
    display_name: str | None = None
    description: str | None = None
    payload: dict[str, Any] | None = None
    max_concurrency: int | None = Field(default=None, ge=1)
    token_budget: int | None = Field(default=None, ge=0)


# ---------------------------------------------------------------------------
# CRUD — 共享校验
# ---------------------------------------------------------------------------


def _validate_task_spec(
    handler_kind: str,
    trigger_type: str,
    interval_seconds: float | None,
    cron_expr: str | None,
    payload: dict[str, Any],
) -> None:
    """纯函数校验任务定义一致性。失败抛 HTTPException(400)。"""
    from negentropy.engine.schedulers.handlers import (
        HANDLER_REGISTRY,
        _bootstrap_default_handlers,
        get_descriptor,
    )

    _bootstrap_default_handlers()

    # 1. handler_kind 合法性
    if handler_kind not in HANDLER_REGISTRY:
        raise HTTPException(status_code=400, detail=f"unknown handler_kind: {handler_kind}")

    # 2. trigger 一致性
    if trigger_type == "interval":
        if not interval_seconds or interval_seconds <= 0:
            raise HTTPException(status_code=400, detail="interval trigger requires interval_seconds > 0")
        if cron_expr:
            raise HTTPException(status_code=400, detail="interval trigger must not have cron_expr")
    elif trigger_type == "cron":
        if not cron_expr:
            raise HTTPException(status_code=400, detail="cron trigger requires cron_expr")
        if interval_seconds:
            raise HTTPException(status_code=400, detail="cron trigger must not have interval_seconds")
        # croniter 校验
        try:
            from croniter import croniter

            croniter(cron_expr, _utcnow())
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"invalid cron expression: {exc}") from exc
    elif trigger_type == "oneshot":
        if interval_seconds or cron_expr:
            raise HTTPException(status_code=400, detail="oneshot trigger must not have interval_seconds or cron_expr")
    else:
        raise HTTPException(status_code=400, detail=f"invalid trigger_type: {trigger_type}")

    # 3. trigger_type ∈ descriptor.supported_trigger_types
    descriptor = get_descriptor(handler_kind)
    if descriptor and descriptor.supported_trigger_types and trigger_type not in descriptor.supported_trigger_types:
        raise HTTPException(
            status_code=400,
            detail=f"handler {handler_kind} does not support trigger_type {trigger_type}, "
            f"supported: {list(descriptor.supported_trigger_types)}",
        )

    # 4. payload 校验 against manifest
    if descriptor and descriptor.payload_fields:
        _validate_payload_against_manifest(payload, descriptor)


def _validate_payload_against_manifest(
    payload: dict[str, Any],
    descriptor: HandlerDescriptor,  # noqa: F821
) -> None:
    """校验 payload 字段与 manifest 一致性。"""

    # 判别式字段值
    discriminator_value: str | None = None
    if descriptor.discriminator_field:
        discriminator_value = payload.get(descriptor.discriminator_field)
        if discriminator_value is None:
            # 判别式字段缺失 → 宽松放行（edit 可能只改了 trigger 等非 payload 字段）
            return

    known_names: set[str] = set()
    for pf in descriptor.payload_fields:
        known_names.add(pf.name)
        # 判别式依赖过滤
        if pf.applies_when and discriminator_value and discriminator_value not in pf.applies_when:
            continue
        # enum 校验
        if pf.type == "enum" and pf.enum_options:
            val = payload.get(pf.name)
            if val is not None and val not in pf.enum_options:
                raise HTTPException(
                    status_code=400,
                    detail=f"payload.{pf.name} invalid enum value '{val}', options: {list(pf.enum_options)}",
                )
        # required 校验（仅对可见字段）
        if pf.required and pf.name not in payload:
            raise HTTPException(status_code=400, detail=f"payload.{pf.name} is required")


def _compute_next_fire_for_spec(
    trigger_type: str, interval_seconds: float | None, cron_expr: str | None
) -> datetime | None:
    """根据 trigger 配置计算 next_fire_at（与 registry._compute_next_fire 对齐）。"""
    now = _utcnow()
    if trigger_type == "interval" and interval_seconds:
        return now + timedelta(seconds=float(interval_seconds))
    if trigger_type == "cron" and cron_expr:
        try:
            from croniter import croniter

            return croniter(cron_expr, now).get_next(datetime)
        except Exception:
            return now + timedelta(minutes=5)
    # oneshot: 首次设 now 让它立即被 claim
    if trigger_type == "oneshot":
        return now
    return now


# ---------------------------------------------------------------------------
# CRUD — POST /scheduler/tasks
# ---------------------------------------------------------------------------


@router.post("/tasks", status_code=201)
async def create_task(body: TaskCreateRequest) -> dict[str, Any]:
    """创建新的调度任务。"""
    _validate_task_spec(body.handler_kind, body.trigger_type, body.interval_seconds, body.cron_expr, body.payload)

    async with AsyncSessionLocal() as db:
        # key 唯一性
        existing = (await db.execute(select(ScheduledTask).where(ScheduledTask.key == body.key))).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=409, detail=f"task key '{body.key}' already exists")

        next_fire = _compute_next_fire_for_spec(body.trigger_type, body.interval_seconds, body.cron_expr)
        task = ScheduledTask(
            key=body.key,
            handler_kind=body.handler_kind,
            trigger_type=body.trigger_type,
            interval_seconds=body.interval_seconds,
            cron_expr=body.cron_expr,
            enabled=body.enabled,
            owner_id=body.owner_id,
            participant_id=body.participant_id,
            agent_id=body.agent_id,
            role=body.role,
            scenario=body.scenario,
            category=body.category,
            display_name=body.display_name,
            description=body.description,
            payload=body.payload,
            max_concurrency=body.max_concurrency,
            token_budget=body.token_budget,
            next_fire_at=next_fire,
        )
        db.add(task)
        try:
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            raise HTTPException(status_code=409, detail=f"conflict: {exc}") from exc
        except SQLAlchemyError as exc:
            await db.rollback()
            logger.warning("create_task_failed", key=body.key, error=str(exc))
            raise HTTPException(status_code=500, detail=f"create failed: {exc}") from exc
        await db.refresh(task)

    _STATS_CACHE.invalidate()
    return _serialize_task(task)


# ---------------------------------------------------------------------------
# CRUD — PUT /scheduler/tasks/{id}
# ---------------------------------------------------------------------------


@router.put("/tasks/{task_id}")
async def update_task(task_id: UUID, body: TaskUpdateRequest) -> dict[str, Any]:
    """更新调度任务定义（key 不可变）。"""
    async with AsyncSessionLocal() as db:
        task = await db.get(ScheduledTask, task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="task not found")
        if task.is_system:
            raise HTTPException(
                status_code=409,
                detail="system task cannot be modified; disable it instead",
            )

        # 收集 exclude_unset 字段（区分"未传"与"显式传 null"）
        update_data = body.model_dump(exclude_unset=True)
        if not update_data:
            return _serialize_task(task)

        # 合并现有值 + 新值，形成完整视图用于校验
        merged_handler = update_data.get("handler_kind", task.handler_kind)
        merged_trigger = update_data.get("trigger_type", task.trigger_type)
        merged_interval = update_data.get("interval_seconds", task.interval_seconds)
        merged_cron = update_data.get("cron_expr", task.cron_expr)
        merged_payload = update_data.get("payload", task.payload or {})

        # trigger 切换时清空旧字段
        if "trigger_type" in update_data:
            new_tt = update_data["trigger_type"]
            if new_tt == "oneshot":
                merged_interval = None
                merged_cron = None
                if "interval_seconds" not in update_data:
                    update_data["interval_seconds"] = None
                if "cron_expr" not in update_data:
                    update_data["cron_expr"] = None
            elif new_tt == "interval":
                merged_cron = None
                if "cron_expr" not in update_data:
                    update_data["cron_expr"] = None
            elif new_tt == "cron":
                merged_interval = None
                if "interval_seconds" not in update_data:
                    update_data["interval_seconds"] = None

        _validate_task_spec(merged_handler, merged_trigger, merged_interval, merged_cron, merged_payload)

        # 检测 schedule 变更 → 重算 next_fire_at
        schedule_changed = any(k in update_data for k in ("trigger_type", "interval_seconds", "cron_expr"))

        # 应用更新
        for field_name, value in update_data.items():
            if field_name == "agent_id" and value is not None:
                value = UUID(str(value))
            setattr(task, field_name, value)

        if schedule_changed:
            task.next_fire_at = _compute_next_fire_for_spec(
                task.trigger_type,
                task.interval_seconds,
                task.cron_expr,
            )

        try:
            await db.commit()
        except SQLAlchemyError as exc:
            await db.rollback()
            logger.warning("update_task_failed", task_id=str(task_id), error=str(exc))
            raise HTTPException(status_code=500, detail=f"update failed: {exc}") from exc
        await db.refresh(task)

    _STATS_CACHE.invalidate()
    return _serialize_task(task)


# ---------------------------------------------------------------------------
# CRUD — DELETE /scheduler/tasks/{id}
# ---------------------------------------------------------------------------


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: UUID) -> dict[str, Any]:
    """删除调度任务（系统种子任务不可删除）。"""
    async with AsyncSessionLocal() as db:
        task = await db.get(ScheduledTask, task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="task not found")
        if task.is_system:
            raise HTTPException(
                status_code=409,
                detail=f"system task '{task.key}' cannot be deleted; use toggle to disable instead",
            )
        try:
            await db.delete(task)
            await db.commit()
        except SQLAlchemyError as exc:
            await db.rollback()
            logger.warning("delete_task_failed", task_id=str(task_id), error=str(exc))
            raise HTTPException(status_code=500, detail=f"delete failed: {exc}") from exc

    _STATS_CACHE.invalidate()
    return {"ok": True, "deleted_task_id": str(task_id)}


# ---------------------------------------------------------------------------
# GET /scheduler/stream (SSE)
# ---------------------------------------------------------------------------


@router.get("/stream")
async def scheduler_stream(
    request: Request,
    task_id: UUID | None = Query(None),
) -> StreamingResponse:
    """SSE 实时推送执行事件 + 5s 心跳 keepalive。

    每个 SSE event 形如：
        event: execution
        data: {"id":"...","task_id":"...","status":"ok",...}

    心跳每 5s 一条 `: ping\\n\\n` 注释行，让代理 / 浏览器保持长连。
    """
    from negentropy.engine.schedulers.registry import ensure_registry_started

    registry = await ensure_registry_started()
    if registry is None:
        raise HTTPException(status_code=503, detail="scheduler registry disabled")

    async def _gen():
        queue = await registry.bus.subscribe()
        try:
            yield b": connected\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=5.0)
                except TimeoutError:
                    # 心跳保活
                    yield b": ping\n\n"
                    continue
                # 服务关停哨兵：让 StreamingResponse 立即收尾，配合 P0-2 lifespan 的
                # 主动 close_all_subscribers，避免 uvicorn 卡在「等连接关闭」。
                if event.get("__shutdown__"):
                    yield b": shutdown\n\n"
                    break
                if task_id is not None and event.get("task_id") != str(task_id):
                    continue
                payload = json.dumps(event, ensure_ascii=False)
                yield f"event: execution\ndata: {payload}\n\n".encode()
        finally:
            await registry.bus.unsubscribe(queue)

    return StreamingResponse(
        _gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


__all__ = ["router"]
