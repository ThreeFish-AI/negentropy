"""/scheduler/* 聚合 API — Phase 4 Dashboard 后端契约。

端点清单（Plan 第 7 节）：
- GET  /scheduler/kpis          KPI 卡片数据
- GET  /scheduler/tasks         任务清单（多维筛选）
- GET  /scheduler/tasks/{id}    单任务详情 + 最近执行
- GET  /scheduler/executions    执行历史（分页 + 多维筛选）
- GET  /scheduler/stats         分组聚合（角色/场景/Agent/Owner/Handler）
- POST /scheduler/tasks/{id}/run     手动触发
- POST /scheduler/tasks/{id}/toggle  启停
- GET  /scheduler/stream        SSE 实时执行事件

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
from pydantic import BaseModel
from sqlalchemy import and_, case, func, select, update
from sqlalchemy.exc import SQLAlchemyError

from negentropy.config import settings
from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.scheduled_task import ScheduledTask, TaskExecution
from negentropy.models.state import UserState
from negentropy.models.sub_agent import SubAgent

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
                            select(SubAgent.id, SubAgent.display_name, SubAgent.name).where(
                                SubAgent.id.in_(agent_ids),
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
