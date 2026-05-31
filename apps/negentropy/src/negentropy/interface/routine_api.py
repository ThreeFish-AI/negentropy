"""/routines/* 聚合 API — Routine 长周期自主任务的后端契约。

端点清单：
- GET    /routines                          路由清单（status/owner/q 筛选 + 游标分页）
- GET    /routines/kpis                      KPI 卡片数据
- GET    /routines/presets                   内置 Routine 预设模版列表
- POST   /routines/from-preset               从预设创建路由
- GET    /routines/{id}                      单路由详情 + 最近迭代
- GET    /routines/{id}/iterations           迭代历史（分页）
- POST   /routines                           创建路由（status=pending）
- PUT    /routines/{id}                      更新路由（非运行态）
- DELETE /routines/{id}                      删除路由（非运行态）
- POST   /routines/{id}/start                启动（pending/paused → running）
- POST   /routines/{id}/pause                暂停（running → paused，中止在途迭代）
- POST   /routines/{id}/resume               恢复（paused → running）
- POST   /routines/{id}/cancel               取消（→ cancelled）
- POST   /routines/{id}/iterations/{iid}/approve   审批通过待执行迭代
- POST   /routines/{id}/iterations/{iid}/reject    驳回待执行迭代
- GET    /routines/stream                    SSE 实时事件（routine + iteration）

鉴权由 ``AuthMiddleware`` 在中间件层统一处理，端点不显式 Depends（对齐 scheduler_api）。

参考文献：
[1] FastAPI Docs, *Server-Sent Events with StreamingResponse*. SSE 实现模式。
[2] Anthropic, *Building Effective AI Agents*, 2024. Evaluator-Optimizer 控制接口。
"""

from __future__ import annotations

import asyncio
import json
import time as _time
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

import negentropy.db.session as db_session
from negentropy.config import settings
from negentropy.engine.routine import phase as phase_mod
from negentropy.logging import get_logger
from negentropy.models.routine import Routine, RoutineIteration

logger = get_logger("negentropy.interface.routine_api")

router = APIRouter(prefix="/routines", tags=["routines"])

# 终态：不可再启动 / 编辑调度
_TERMINAL = ("succeeded", "failed", "cancelled")
_ACTIVE = ("running", "paused")
_NON_TERMINAL_ITER = ("pending_approval", "dispatched", "in_flight", "executed")
_DEFAULT_RECENT_ITERATIONS = 20


def _utcnow() -> datetime:
    return datetime.now(UTC)


# ---------------------------------------------------------------------------
# 10s TTL 缓存（KPI 高频请求降压）
# ---------------------------------------------------------------------------


class _TTLCache:
    def __init__(self, ttl_seconds: float = 10.0) -> None:
        self._ttl = ttl_seconds
        self._store: dict[str, tuple[float, Any]] = {}

    def get(self, key: str) -> Any | None:
        item = self._store.get(key)
        if item is None:
            return None
        ts, value = item
        if _time.monotonic() - ts > self._ttl:
            self._store.pop(key, None)
            return None
        return value

    def set(self, key: str, value: Any) -> None:
        self._store[key] = (_time.monotonic(), value)

    def invalidate(self) -> None:
        self._store.clear()


_KPI_CACHE = _TTLCache(ttl_seconds=10.0)


# ---------------------------------------------------------------------------
# DTO
# ---------------------------------------------------------------------------


class RoutineCreateRequest(BaseModel):
    key: str = Field(..., min_length=1, max_length=192)
    title: str = Field(..., min_length=1, max_length=255)
    goal: str = Field(..., min_length=1)
    acceptance_criteria: str = Field(..., min_length=1)
    cwd: str | None = None
    verification_command: str | None = None
    max_iterations: int | None = Field(default=None, ge=1, le=1000)
    max_cost_usd: float | None = Field(default=None, ge=0)
    deadline_at: datetime | None = None
    success_score_threshold: int = Field(default=85, ge=0, le=100)
    no_progress_patience: int = Field(default=3, ge=1, le=50)
    approval_mode: Literal["auto", "first", "every"] = "auto"
    config: dict[str, Any] = Field(default_factory=dict)
    owner_id: str | None = None
    agent_id: UUID | None = None
    display_name: str | None = None
    description: str | None = None


class RoutineUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    goal: str | None = None
    acceptance_criteria: str | None = None
    cwd: str | None = None
    verification_command: str | None = None
    max_iterations: int | None = Field(default=None, ge=1, le=1000)
    max_cost_usd: float | None = Field(default=None, ge=0)
    deadline_at: datetime | None = None
    success_score_threshold: int | None = Field(default=None, ge=0, le=100)
    no_progress_patience: int | None = Field(default=None, ge=1, le=50)
    approval_mode: Literal["auto", "first", "every"] | None = None
    config: dict[str, Any] | None = None
    display_name: str | None = None
    description: str | None = None


class ControlBody(BaseModel):
    reason: str | None = None


class RoutineFromPresetRequest(BaseModel):
    preset_id: str = Field(..., min_length=1)
    key: str = Field(..., min_length=1, max_length=192)
    cwd: str = Field(..., min_length=1)


# ---------------------------------------------------------------------------
# 序列化
# ---------------------------------------------------------------------------


def _serialize_routine(r: Routine, *, iterations: list[RoutineIteration] | None = None) -> dict[str, Any]:
    data: dict[str, Any] = {
        "id": str(r.id),
        "key": r.key,
        "title": r.title,
        "display_name": r.display_name,
        "description": r.description,
        "goal": r.goal,
        "acceptance_criteria": r.acceptance_criteria,
        "cwd": r.cwd,
        "verification_command": r.verification_command,
        "status": r.status,
        "termination_reason": r.termination_reason,
        "current_phase": r.current_phase,
        "pr_url": r.pr_url,
        "max_iterations": r.max_iterations,
        "max_cost_usd": r.max_cost_usd,
        "deadline_at": r.deadline_at.isoformat() if r.deadline_at else None,
        "success_score_threshold": r.success_score_threshold,
        "no_progress_patience": r.no_progress_patience,
        "approval_mode": r.approval_mode,
        "iteration_count": r.iteration_count,
        "total_cost_usd": r.total_cost_usd,
        "best_score": r.best_score,
        "last_score": r.last_score,
        "claude_session_id": r.claude_session_id,
        "reflections": (r.reflections or {}).get("items", []),
        "config": r.config or {},
        "owner_id": r.owner_id,
        "agent_id": str(r.agent_id) if r.agent_id else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }
    if iterations is not None:
        data["iterations"] = [_serialize_iteration(it) for it in iterations]
    return data


def _serialize_iteration(it: RoutineIteration) -> dict[str, Any]:
    return {
        "id": str(it.id),
        "routine_id": str(it.routine_id),
        "seq": it.seq,
        "status": it.status,
        "phase": it.phase,
        "prompt": it.prompt,
        "resume_session_id": it.resume_session_id,
        "exec_status": it.exec_status,
        "summary": it.summary,
        "claude_session_id": it.claude_session_id,
        "cost_usd": it.cost_usd,
        "turn_count": it.turn_count,
        "exec_error": it.exec_error,
        "score": it.score,
        "verdict": it.verdict,
        "reflection": it.reflection,
        "eval_error": it.eval_error,
        "gate_exit_code": it.gate_exit_code,
        "started_at": it.started_at.isoformat() if it.started_at else None,
        "finished_at": it.finished_at.isoformat() if it.finished_at else None,
    }


# ---------------------------------------------------------------------------
# GET /routines/kpis
# ---------------------------------------------------------------------------


@router.get("/kpis")
async def get_kpis() -> dict[str, Any]:
    """KPI 卡片：总数 / 运行中 / 已成功 / 已失败 / 累计成本 / 平均迭代数。"""
    cached = _KPI_CACHE.get("kpis")
    if cached is not None:
        return cached

    async with db_session.AsyncSessionLocal() as db:
        status_counts_rows = (await db.execute(select(Routine.status, func.count()).group_by(Routine.status))).all()
        status_counts = {row[0]: row[1] for row in status_counts_rows}
        total = sum(status_counts.values())
        total_cost = (await db.execute(select(func.coalesce(func.sum(Routine.total_cost_usd), 0.0)))).scalar() or 0.0
        avg_iter = (await db.execute(select(func.coalesce(func.avg(Routine.iteration_count), 0.0)))).scalar() or 0.0

    result = {
        "total": total,
        "running": status_counts.get("running", 0),
        "paused": status_counts.get("paused", 0),
        "succeeded": status_counts.get("succeeded", 0),
        "failed": status_counts.get("failed", 0),
        "cancelled": status_counts.get("cancelled", 0),
        "pending": status_counts.get("pending", 0),
        "total_cost_usd": round(float(total_cost), 4),
        "avg_iterations": round(float(avg_iter), 2),
    }
    _KPI_CACHE.set("kpis", result)
    return result


# ---------------------------------------------------------------------------
# GET /routines/presets
# POST /routines/from-preset
# 声明在 /{routine_id} 之前，确保字面路径优先于路径参数匹配。
# ---------------------------------------------------------------------------


@router.get("/presets")
async def list_routine_presets() -> list[dict[str, Any]]:
    """内置 Routine 预设模版列表。"""
    from negentropy.agents.routine_presets import load_all

    presets = load_all()
    return [
        {
            "preset_id": p.preset_id,
            "display_name": p.display_name,
            "description": p.description,
            "category": p.category,
            "version": p.version,
            "features_showcase": p.features_showcase,
            "approval_mode": p.approval_mode,
            "has_verification_command": p.verification_command is not None,
        }
        for p in presets
    ]


@router.post("/from-preset", status_code=201)
async def create_routine_from_preset(body: RoutineFromPresetRequest) -> dict[str, Any]:
    """从内置预设创建 Routine。用户提供 key + cwd，其余字段由预设填充。"""
    from negentropy.agents.routine_presets import load_all

    presets = {p.preset_id: p for p in load_all()}
    preset = presets.get(body.preset_id)
    if preset is None:
        raise HTTPException(status_code=404, detail=f"Preset '{body.preset_id}' not found")

    create_req = RoutineCreateRequest(
        key=body.key,
        title=preset.title,
        goal=preset.goal,
        acceptance_criteria=preset.acceptance_criteria,
        cwd=body.cwd,
        verification_command=preset.verification_command,
        max_iterations=preset.max_iterations,
        max_cost_usd=preset.max_cost_usd,
        success_score_threshold=preset.success_score_threshold,
        no_progress_patience=preset.no_progress_patience,
        approval_mode=preset.approval_mode,
        config=preset.config or {},
        display_name=preset.display_name,
        description=preset.description,
    )
    return await create_routine(create_req)


# ---------------------------------------------------------------------------
# GET /routines/stream (SSE)
# 声明在 /{routine_id} 之前，确保字面路径 /stream 优先于路径参数匹配。
# ---------------------------------------------------------------------------


@router.get("/stream")
async def routine_stream(request: Request, routine_id: UUID | None = Query(None)) -> StreamingResponse:
    """SSE 实时推送 routine / iteration 事件 + 5s 心跳保活。

    事件形如：
        event: routine
        data: {"id":"...","status":"running",...}
        event: iteration
        data: {"id":"...","routine_id":"...","status":"executed",...}
    """
    from negentropy.engine.routine.bus import get_bus

    bus = get_bus()

    async def _gen():
        queue = await bus.subscribe()
        try:
            yield b": connected\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=5.0)
                except TimeoutError:
                    yield b": ping\n\n"
                    continue
                if event.get("__shutdown__"):
                    yield b": shutdown\n\n"
                    break
                if routine_id is not None:
                    rid = str(routine_id)
                    ev_rid = event.get("routine_id") or event.get("id")
                    if ev_rid != rid:
                        continue
                ev_type = event.get("type", "routine")
                payload = json.dumps(event, ensure_ascii=False)
                yield f"event: {ev_type}\ndata: {payload}\n\n".encode()
        finally:
            await bus.unsubscribe(queue)

    return StreamingResponse(
        _gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ---------------------------------------------------------------------------
# GET /routines
# ---------------------------------------------------------------------------


@router.get("")
async def list_routines(
    status: str | None = Query(None),
    owner_id: str | None = Query(None),
    q: str | None = Query(None, description="按 key / title 模糊搜索"),
    limit: int = Query(50, ge=1, le=200),
    cursor: str | None = Query(None, description="上一页末尾 updated_at ISO 串"),
) -> dict[str, Any]:
    """路由清单：多维筛选 + 基于 updated_at 的游标分页。"""
    async with db_session.AsyncSessionLocal() as db:
        stmt = select(Routine)
        if status:
            stmt = stmt.where(Routine.status == status)
        if owner_id:
            stmt = stmt.where(Routine.owner_id == owner_id)
        if q:
            like = f"%{q}%"
            stmt = stmt.where((Routine.key.ilike(like)) | (Routine.title.ilike(like)))
        if cursor:
            try:
                cursor_dt = datetime.fromisoformat(cursor)
                stmt = stmt.where(Routine.updated_at < cursor_dt)
            except ValueError:
                raise HTTPException(status_code=400, detail="invalid cursor") from None
        stmt = stmt.order_by(Routine.updated_at.desc()).limit(limit + 1)
        rows = (await db.execute(stmt)).scalars().all()

    has_more = len(rows) > limit
    rows = rows[:limit]
    next_cursor = rows[-1].updated_at.isoformat() if has_more and rows else None
    return {
        "items": [_serialize_routine(r) for r in rows],
        "next_cursor": next_cursor,
        "has_more": has_more,
    }


# ---------------------------------------------------------------------------
# GET /routines/{id}
# ---------------------------------------------------------------------------


@router.get("/{routine_id}")
async def get_routine(
    routine_id: UUID,
    recent: int = Query(_DEFAULT_RECENT_ITERATIONS, ge=1, le=200),
) -> dict[str, Any]:
    async with db_session.AsyncSessionLocal() as db:
        r = await db.get(Routine, routine_id)
        if r is None:
            raise HTTPException(status_code=404, detail="routine not found")
        iterations = (
            (
                await db.execute(
                    select(RoutineIteration)
                    .where(RoutineIteration.routine_id == routine_id)
                    .order_by(RoutineIteration.seq.desc())
                    .limit(recent)
                )
            )
            .scalars()
            .all()
        )
    return _serialize_routine(r, iterations=list(iterations))


# ---------------------------------------------------------------------------
# GET /routines/{id}/iterations
# ---------------------------------------------------------------------------


@router.get("/{routine_id}/iterations")
async def list_iterations(
    routine_id: UUID,
    limit: int = Query(50, ge=1, le=200),
    before_seq: int | None = Query(None, description="分页：返回 seq 小于此值的迭代"),
) -> dict[str, Any]:
    async with db_session.AsyncSessionLocal() as db:
        if await db.get(Routine, routine_id) is None:
            raise HTTPException(status_code=404, detail="routine not found")
        stmt = select(RoutineIteration).where(RoutineIteration.routine_id == routine_id)
        if before_seq is not None:
            stmt = stmt.where(RoutineIteration.seq < before_seq)
        stmt = stmt.order_by(RoutineIteration.seq.desc()).limit(limit + 1)
        rows = (await db.execute(stmt)).scalars().all()

    has_more = len(rows) > limit
    rows = rows[:limit]
    return {
        "items": [_serialize_iteration(it) for it in rows],
        "has_more": has_more,
        "next_before_seq": rows[-1].seq if has_more and rows else None,
    }


# ---------------------------------------------------------------------------
# POST /routines
# ---------------------------------------------------------------------------


@router.post("")
async def create_routine(body: RoutineCreateRequest) -> dict[str, Any]:
    async with db_session.AsyncSessionLocal() as db:
        routine = Routine(
            key=body.key,
            title=body.title,
            goal=body.goal,
            acceptance_criteria=body.acceptance_criteria,
            cwd=body.cwd,
            verification_command=body.verification_command,
            status="pending",
            max_iterations=body.max_iterations
            if body.max_iterations is not None
            else settings.routine.default_max_iterations,
            max_cost_usd=body.max_cost_usd if body.max_cost_usd is not None else settings.routine.default_max_cost_usd,
            deadline_at=body.deadline_at,
            success_score_threshold=body.success_score_threshold,
            no_progress_patience=body.no_progress_patience,
            approval_mode=body.approval_mode,
            config=body.config or {},
            current_phase=phase_mod.initial_phase(body.config or {}),
            reflections={},
            owner_id=body.owner_id,
            agent_id=body.agent_id,
            display_name=body.display_name,
            description=body.description,
        )
        db.add(routine)
        try:
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            raise HTTPException(status_code=409, detail=f"routine key '{body.key}' already exists") from exc
        except SQLAlchemyError as exc:
            await db.rollback()
            logger.warning("create_routine_failed", error=str(exc))
            raise HTTPException(status_code=500, detail=f"create failed: {exc}") from exc
        await db.refresh(routine)

    _KPI_CACHE.invalidate()
    return _serialize_routine(routine)


# ---------------------------------------------------------------------------
# PUT /routines/{id}
# ---------------------------------------------------------------------------


@router.put("/{routine_id}")
async def update_routine(routine_id: UUID, body: RoutineUpdateRequest) -> dict[str, Any]:
    async with db_session.AsyncSessionLocal() as db:
        r = await db.get(Routine, routine_id)
        if r is None:
            raise HTTPException(status_code=404, detail="routine not found")
        if r.status == "running":
            raise HTTPException(status_code=409, detail="cannot edit a running routine; pause it first")

        update_data = body.model_dump(exclude_unset=True)
        for field_name, value in update_data.items():
            setattr(r, field_name, value)

        try:
            await db.commit()
        except SQLAlchemyError as exc:
            await db.rollback()
            logger.warning("update_routine_failed", routine_id=str(routine_id), error=str(exc))
            raise HTTPException(status_code=500, detail=f"update failed: {exc}") from exc
        await db.refresh(r)

    _KPI_CACHE.invalidate()
    return _serialize_routine(r)


# ---------------------------------------------------------------------------
# DELETE /routines/{id}
# ---------------------------------------------------------------------------


@router.delete("/{routine_id}")
async def delete_routine(routine_id: UUID) -> dict[str, Any]:
    async with db_session.AsyncSessionLocal() as db:
        r = await db.get(Routine, routine_id)
        if r is None:
            raise HTTPException(status_code=404, detail="routine not found")
        if r.status in _ACTIVE:
            raise HTTPException(status_code=409, detail=f"cannot delete a {r.status} routine; cancel it first")
        try:
            await db.delete(r)
            await db.commit()
        except SQLAlchemyError as exc:
            await db.rollback()
            logger.warning("delete_routine_failed", routine_id=str(routine_id), error=str(exc))
            raise HTTPException(status_code=500, detail=f"delete failed: {exc}") from exc

    _KPI_CACHE.invalidate()
    return {"ok": True, "deleted_routine_id": str(routine_id)}


# ---------------------------------------------------------------------------
# 控制动作：start / pause / resume / cancel
# ---------------------------------------------------------------------------


@router.post("/{routine_id}/start")
async def start_routine(routine_id: UUID, body: ControlBody | None = None) -> dict[str, Any]:
    """启动：pending/paused → running。"""
    async with db_session.AsyncSessionLocal() as db:
        r = await db.get(Routine, routine_id)
        if r is None:
            raise HTTPException(status_code=404, detail="routine not found")
        if r.status not in ("pending", "paused"):
            raise HTTPException(status_code=409, detail=f"cannot start from status '{r.status}'")
        r.status = "running"
        r.termination_reason = None
        await db.commit()
        await db.refresh(r)
    _KPI_CACHE.invalidate()
    await _publish_routine(r)
    return _serialize_routine(r)


@router.post("/{routine_id}/pause")
async def pause_routine(routine_id: UUID, body: ControlBody | None = None) -> dict[str, Any]:
    """暂停：running → paused，并中止当前在途迭代。"""
    async with db_session.AsyncSessionLocal() as db:
        r = await db.get(Routine, routine_id)
        if r is None:
            raise HTTPException(status_code=404, detail="routine not found")
        if r.status != "running":
            raise HTTPException(status_code=409, detail=f"cannot pause from status '{r.status}'")
        r.status = "paused"
        await db.commit()
        await db.refresh(r)
        await _abort_active_iterations(db, routine_id)
    _KPI_CACHE.invalidate()
    await _publish_routine(r)
    return _serialize_routine(r)


@router.post("/{routine_id}/resume")
async def resume_routine(routine_id: UUID, body: ControlBody | None = None) -> dict[str, Any]:
    """恢复：paused → running。"""
    async with db_session.AsyncSessionLocal() as db:
        r = await db.get(Routine, routine_id)
        if r is None:
            raise HTTPException(status_code=404, detail="routine not found")
        if r.status != "paused":
            raise HTTPException(status_code=409, detail=f"cannot resume from status '{r.status}'")
        r.status = "running"
        await db.commit()
        await db.refresh(r)
    _KPI_CACHE.invalidate()
    await _publish_routine(r)
    return _serialize_routine(r)


@router.post("/{routine_id}/cancel")
async def cancel_routine(routine_id: UUID, body: ControlBody | None = None) -> dict[str, Any]:
    """取消：任意活跃态 → cancelled，中止在途迭代。"""
    async with db_session.AsyncSessionLocal() as db:
        r = await db.get(Routine, routine_id)
        if r is None:
            raise HTTPException(status_code=404, detail="routine not found")
        if r.status in _TERMINAL:
            raise HTTPException(status_code=409, detail=f"routine already terminal: '{r.status}'")
        r.status = "cancelled"
        r.termination_reason = "user_cancelled"
        await db.commit()
        await db.refresh(r)
        await _abort_active_iterations(db, routine_id)
    _KPI_CACHE.invalidate()
    await _publish_routine(r)
    return _serialize_routine(r)


# ---------------------------------------------------------------------------
# 审批门控：approve / reject
# ---------------------------------------------------------------------------


@router.post("/{routine_id}/iterations/{iteration_id}/approve")
async def approve_iteration(routine_id: UUID, iteration_id: UUID) -> dict[str, Any]:
    """审批通过：pending_approval → dispatched（下一 tick 由 Inspector 派发执行）。"""
    async with db_session.AsyncSessionLocal() as db:
        it = await db.get(RoutineIteration, iteration_id)
        if it is None or it.routine_id != routine_id:
            raise HTTPException(status_code=404, detail="iteration not found")
        if it.status != "pending_approval":
            raise HTTPException(status_code=409, detail=f"iteration not pending_approval: '{it.status}'")
        it.status = "dispatched"
        await db.commit()
        await db.refresh(it)
    return _serialize_iteration(it)


@router.post("/{routine_id}/iterations/{iteration_id}/reject")
async def reject_iteration(routine_id: UUID, iteration_id: UUID) -> dict[str, Any]:
    """驳回：pending_approval → aborted。"""
    async with db_session.AsyncSessionLocal() as db:
        it = await db.get(RoutineIteration, iteration_id)
        if it is None or it.routine_id != routine_id:
            raise HTTPException(status_code=404, detail="iteration not found")
        if it.status != "pending_approval":
            raise HTTPException(status_code=409, detail=f"iteration not pending_approval: '{it.status}'")
        it.status = "aborted"
        it.finished_at = _utcnow()
        await db.commit()
        await db.refresh(it)
    return _serialize_iteration(it)


# ---------------------------------------------------------------------------
# 辅助
# ---------------------------------------------------------------------------


async def _abort_active_iterations(db, routine_id: UUID) -> None:
    """中止该 routine 当前在途/待执行迭代：请求 runner abort + 标记 aborted。"""
    from negentropy.engine.routine.runner import get_runner

    runner = get_runner()
    rows = (
        (
            await db.execute(
                select(RoutineIteration).where(
                    RoutineIteration.routine_id == routine_id,
                    RoutineIteration.status.in_(_NON_TERMINAL_ITER),
                )
            )
        )
        .scalars()
        .all()
    )
    now = _utcnow()
    for it in rows:
        runner.request_abort(it.id)
        # executed 等待评估的不强行中止（结果已产出）；其余标记 aborted
        if it.status in ("pending_approval", "dispatched", "in_flight"):
            it.status = "aborted"
            it.finished_at = now
            it.lease_expires_at = None
    await db.commit()


async def _publish_routine(r: Routine) -> None:
    from negentropy.engine.routine.bus import get_bus

    await get_bus().publish(
        {
            "type": "routine",
            "id": str(r.id),
            "status": r.status,
            "termination_reason": r.termination_reason,
            "best_score": r.best_score,
            "last_score": r.last_score,
            "iteration_count": r.iteration_count,
            "total_cost_usd": r.total_cost_usd,
            "current_phase": r.current_phase,
            "pr_url": r.pr_url,
        }
    )


__all__ = ["router"]
