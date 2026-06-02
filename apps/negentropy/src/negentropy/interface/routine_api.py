"""/routines/* 聚合 API — Routine 长周期自主任务的后端契约。

端点清单：
- GET    /routines                          路由清单（status/owner/q 筛选 + 游标分页）
- GET    /routines/kpis                      KPI 卡片数据
- GET    /routines/templates                 合并模板列表（内置预设 + 用户模板）
- GET    /routines/{id}                      单路由详情 + 最近迭代
- GET    /routines/{id}/iterations           迭代历史（分页）
- POST   /routines                           创建路由（status=pending）
- PUT    /routines/{id}                      更新路由（非运行态）
- DELETE /routines/{id}                      删除路由（非运行态）
- POST   /routines/{id}/start                启动（pending/paused → running）
- POST   /routines/{id}/pause                暂停（running → paused，中止在途迭代）
- POST   /routines/{id}/resume               恢复（paused → running）
- POST   /routines/{id}/cancel               取消（→ cancelled）
- POST   /routines/{id}/restart              重启（failed/cancelled → running，复位运行态 + 抬高决策水位线）
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
import os
import time as _time
from contextlib import suppress
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
from negentropy.engine.routine import workspace
from negentropy.logging import get_logger
from negentropy.models.routine import Routine, RoutineIteration, RoutineIterationEvent

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
    baseline_branch: str | None = Field(default=None, max_length=255)
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
    is_template: bool = False


class RoutineUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    goal: str | None = None
    acceptance_criteria: str | None = None
    cwd: str | None = None
    baseline_branch: str | None = Field(default=None, max_length=255)
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


class RestartBody(BaseModel):
    keep_reflections: bool = True  # True=携带既往反思（Reflexion 跨尝试学习）；False=清空重来


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
        "baseline_branch": r.baseline_branch,
        "verification_command": r.verification_command,
        "status": r.status,
        "termination_reason": r.termination_reason,
        "current_phase": r.current_phase,
        "pr_url": r.pr_url,
        "work_branch": r.work_branch,
        "worktree_path": r.worktree_path,
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
        "is_template": r.is_template,
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


def _serialize_event(ev: RoutineIterationEvent) -> dict[str, Any]:
    """序列化单条「全过程」动作审计事件（与前端 ``RoutineIterationEventDTO`` 对齐）。"""
    return {
        "id": str(ev.id),
        "iteration_id": str(ev.iteration_id),
        "routine_id": str(ev.routine_id),
        "seq": ev.seq,
        "event_type": ev.event_type,
        "tool_name": ev.tool_name,
        "title": ev.title,
        "payload": ev.payload or {},
        "cost_usd": ev.cost_usd,
        "created_at": ev.created_at.isoformat() if ev.created_at else None,
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
# GET /routines/templates
# 声明在 /{routine_id} 之前，确保字面路径优先于路径参数匹配。
# ---------------------------------------------------------------------------


@router.get("/templates")
async def list_templates(
    category: str | None = Query(None, description="按 category 筛选"),
) -> list[dict[str, Any]]:
    """合并模板列表：内置 YAML 预设（source=builtin）+ 用户自建模板（source=user）。

    返回统一结构，前端区分 source 决定是否允许编辑/删除。
    """
    # ── 1. 内置 YAML 预设 → 统一结构 ──
    from negentropy.agents.routine_presets import load_all

    builtin: list[dict[str, Any]] = []
    for p in load_all():
        if category and p.category != category:
            continue
        builtin.append(
            {
                "id": f"builtin:{p.preset_id}",
                "source": "builtin",
                "key": p.preset_id,
                "display_name": p.display_name,
                "description": p.description,
                "category": p.category,
                "version": p.version,
                "features_showcase": p.features_showcase,
                "title": p.title,
                "goal": p.goal,
                "acceptance_criteria": p.acceptance_criteria,
                "verification_command": p.verification_command,
                "max_iterations": p.max_iterations,
                "max_cost_usd": p.max_cost_usd,
                "success_score_threshold": p.success_score_threshold,
                "no_progress_patience": p.no_progress_patience,
                "approval_mode": p.approval_mode,
                "config": p.config or {},
                "has_verification_command": p.verification_command is not None,
                "owner_id": None,
                "created_at": None,
                "updated_at": None,
            }
        )

    # ── 2. 用户模板（is_template=true 的 Routine 行）→ 统一结构 ──
    user_templates: list[dict[str, Any]] = []
    async with db_session.AsyncSessionLocal() as db:
        stmt = select(Routine).where(Routine.is_template.is_(True)).order_by(Routine.created_at.desc())
        rows = (await db.execute(stmt)).scalars().all()
        for r in rows:
            if category and (r.config or {}).get("category", "general") != category:
                continue
            user_templates.append(
                {
                    "id": str(r.id),
                    "source": "user",
                    "key": r.key,
                    "display_name": r.display_name or r.title,
                    "description": r.description or "",
                    "category": (r.config or {}).get("category", "general"),
                    "version": (r.config or {}).get("version", "1.0.0"),
                    "features_showcase": (r.config or {}).get("features_showcase", []),
                    "title": r.title,
                    "goal": r.goal,
                    "acceptance_criteria": r.acceptance_criteria,
                    "verification_command": r.verification_command,
                    "max_iterations": r.max_iterations,
                    "max_cost_usd": r.max_cost_usd,
                    "success_score_threshold": r.success_score_threshold,
                    "no_progress_patience": r.no_progress_patience,
                    "approval_mode": r.approval_mode,
                    "config": r.config or {},
                    "has_verification_command": r.verification_command is not None,
                    "owner_id": r.owner_id,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                    "updated_at": r.updated_at.isoformat() if r.updated_at else None,
                }
            )

    # ── 3. 合并 + 排序 ──
    merged = builtin + user_templates
    merged.sort(key=lambda t: (t.get("category", ""), t.get("display_name", "")))

    # 后置 category 过滤（已在内置和用户分别过滤的基础上统一再筛一次）
    if category:
        merged = [t for t in merged if t.get("category") == category]

    return merged


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
    is_template: bool | None = Query(None, description="过滤模板行"),
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
        if is_template is not None:
            stmt = stmt.where(Routine.is_template == is_template)
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
# GET /routines/{id}/iterations/{iid}/events
# 「全过程」动作级审计事件流（懒加载；不内联进迭代详情，保持列表/详情载荷小）。
# ---------------------------------------------------------------------------


@router.get("/{routine_id}/iterations/{iteration_id}/events")
async def list_iteration_events(
    routine_id: UUID,
    iteration_id: UUID,
    limit: int = Query(200, ge=1, le=1000),
    after_seq: int | None = Query(None, description="分页：返回 seq 大于此值的事件（升序）"),
) -> dict[str, Any]:
    """单次迭代的「全过程」动作级审计事件流（工具调用/结果/中间消息/结果/门控/评估，按 seq 升序）。"""
    async with db_session.AsyncSessionLocal() as db:
        it = await db.get(RoutineIteration, iteration_id)
        if it is None or it.routine_id != routine_id:
            raise HTTPException(status_code=404, detail="iteration not found")
        stmt = select(RoutineIterationEvent).where(RoutineIterationEvent.iteration_id == iteration_id)
        if after_seq is not None:
            stmt = stmt.where(RoutineIterationEvent.seq > after_seq)
        stmt = stmt.order_by(RoutineIterationEvent.seq.asc()).limit(limit + 1)
        rows = (await db.execute(stmt)).scalars().all()

    has_more = len(rows) > limit
    rows = rows[:limit]
    return {
        "items": [_serialize_event(ev) for ev in rows],
        "has_more": has_more,
        "next_after_seq": rows[-1].seq if has_more and rows else None,
    }


# ---------------------------------------------------------------------------
# POST /routines
# ---------------------------------------------------------------------------


@router.post("")
async def create_routine(body: RoutineCreateRequest) -> dict[str, Any]:
    if body.cwd and not os.path.isdir(body.cwd):
        raise HTTPException(status_code=422, detail=f"cwd directory does not exist: '{body.cwd}'")
    # 提供了 Project Path (cwd) + Baseline Branch 时即时校验仓库/基线（早反馈）。存在性的硬约束
    # 由 start 守卫强制（执行前提），允许 API 侧先创建草稿；前端创建可执行 routine 时已强制二者。
    if body.cwd and body.baseline_branch:
        try:
            await workspace.validate_repo(body.cwd, body.baseline_branch, settings.routine)
        except workspace.WorkspaceError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
    async with db_session.AsyncSessionLocal() as db:
        routine = Routine(
            key=body.key,
            title=body.title,
            goal=body.goal,
            acceptance_criteria=body.acceptance_criteria,
            cwd=body.cwd,
            baseline_branch=body.baseline_branch,
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
            is_template=body.is_template,
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
    if body.cwd and not os.path.isdir(body.cwd):
        raise HTTPException(status_code=422, detail=f"cwd directory does not exist: '{body.cwd}'")
    async with db_session.AsyncSessionLocal() as db:
        r = await db.get(Routine, routine_id)
        if r is None:
            raise HTTPException(status_code=404, detail="routine not found")
        if r.status == "running":
            raise HTTPException(status_code=409, detail="cannot edit a running routine; pause it first")

        update_data = body.model_dump(exclude_unset=True)
        for field_name, value in update_data.items():
            setattr(r, field_name, value)

        # 校验合并后的仓库/基线（仅当二者皆有值时即时校验；强制性由 create + start 守卫保证，
        # 允许增量编辑期间暂缺其一）。
        if not r.is_template and r.cwd and r.baseline_branch:
            try:
                await workspace.validate_repo(r.cwd, r.baseline_branch, settings.routine)
            except workspace.WorkspaceError as exc:
                await db.rollback()
                raise HTTPException(status_code=422, detail=str(exc)) from exc

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
        # 删除前回收隔离 worktree（行将消失，无论策略均须清，避免孤儿；best-effort）。
        if r.worktree_path:
            with suppress(Exception):
                await workspace.remove_worktree(r, settings.routine)
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
        # worktree 隔离守卫（执行硬前提）：可执行 routine 启动前须具备 Project Path (cwd) +
        # Baseline Branch（保护未回填的旧行；模板不在此路径启动），并校验仓库/基线可用。
        if not r.is_template:
            if not (r.cwd and r.baseline_branch):
                raise HTTPException(
                    status_code=409,
                    detail="启动前需补全 Project Path (cwd) 与 Baseline Branch（隔离 worktree 的前提）",
                )
            try:
                await workspace.validate_repo(r.cwd, r.baseline_branch, settings.routine)
            except workspace.WorkspaceError as exc:
                raise HTTPException(status_code=422, detail=str(exc)) from exc
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
        # worktree 隔离守卫（与 start 端点对齐）：非模板 routine 恢复前须具备 cwd + baseline_branch。
        if not r.is_template:
            if not (r.cwd and r.baseline_branch):
                raise HTTPException(
                    status_code=409,
                    detail="恢复前需补全 Project Path (cwd) 与 Baseline Branch（隔离 worktree 的前提）",
                )
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


@router.post("/{routine_id}/restart")
async def restart_routine(routine_id: UUID, body: RestartBody | None = None) -> dict[str, Any]:
    """重新启动失败 / 取消的 routine：非成功终态 → running，复位运行态并开启新一轮尝试。

    复位运行期计数器（迭代数 / 成本 / 评分 / session / 相位 / PR）使预算守卫从零重新计；
    抬高 ``eval_floor_seq`` 至当前 ``MAX(seq)`` 使新一轮的停滞 / 振荡 / 审批判定不被既往迭代污染
    （旧迭代行**保留**供审计，seq 唯一性由 ``_next_seq`` 取 ``MAX(seq)+1`` 保证）。
    ``deadline`` 为绝对时间，无法靠归零复活——已过期则拒绝并引导用户先更新截止时间。
    """
    keep_reflections = body.keep_reflections if body is not None else True
    async with db_session.AsyncSessionLocal() as db:
        r = await db.get(Routine, routine_id, with_for_update=True)
        if r is None:
            raise HTTPException(status_code=404, detail="routine not found")
        if r.status not in ("failed", "cancelled"):
            raise HTTPException(
                status_code=409,
                detail=f"cannot restart from status '{r.status}'; only failed/cancelled routines can be restarted",
            )
        if r.deadline_at is not None:
            deadline = r.deadline_at if r.deadline_at.tzinfo else r.deadline_at.replace(tzinfo=UTC)
            if _utcnow() >= deadline:
                raise HTTPException(
                    status_code=409,
                    detail="deadline has passed; update or clear the deadline before restarting",
                )
        # worktree 隔离守卫（与 start 端点对齐）：非模板 routine 重启前须具备 cwd + baseline_branch。
        if not r.is_template:
            if not (r.cwd and r.baseline_branch):
                raise HTTPException(
                    status_code=409,
                    detail="重启前需补全 Project Path (cwd) 与 Baseline Branch（隔离 worktree 的前提）",
                )

        # 闭合上一轮遗留的全部非终态迭代（含 executed）。终态 routine 理论上不应有在途迭代，
        # 但 cancel 会保留 executed 迭代、且崩溃/reaper 竞态可能遗留孤儿；若不闭合，重启后
        # 这些旧迭代会被 _find_routines_pending_eval / _has_active_iteration 拾取，污染新尝试
        # 评分/反思、阻塞派发甚至即刻误终止。须在抬高 eval_floor_seq 前完成（同一事务内）。
        await _abort_active_iterations(db, routine_id, include_executed=True)

        max_seq = (
            await db.execute(
                select(func.coalesce(func.max(RoutineIteration.seq), 0)).where(
                    RoutineIteration.routine_id == routine_id
                )
            )
        ).scalar_one()

        # 复位运行态（保留任务定义 / 预算策略 / 既往迭代行）
        r.status = "running"
        r.termination_reason = None
        r.iteration_count = 0
        r.total_cost_usd = 0.0
        r.best_score = None
        r.last_score = None
        r.claude_session_id = None
        r.current_phase = phase_mod.initial_phase(r.config)
        r.pr_url = None
        # 隔离 worktree：移除旧工作区并清空运行期句柄，使新一轮尝试从基线重建（best-effort）。
        if r.worktree_path:
            with suppress(Exception):
                await workspace.remove_worktree(r, settings.routine)
        r.worktree_path = None
        r.work_branch = None
        r.eval_floor_seq = int(max_seq)
        if not keep_reflections:
            r.reflections = {}

        await db.commit()
        await db.refresh(r)
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


async def _abort_active_iterations(db, routine_id: UUID, *, include_executed: bool = False) -> None:
    """中止该 routine 当前在途/待执行迭代：请求 runner abort + 标记 aborted。

    默认（pause/cancel）保留 ``executed`` 迭代（结果已产出，待评估）。``include_executed=True``
    时（restart）连同 ``executed`` 一并闭合为 aborted——重启开启全新尝试，上一轮遗留的未评估
    结果不应被新一轮的评估/派发链路拾取（否则会污染新尝试评分/反思甚至即刻误终止）。
    """
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
    abortable = _NON_TERMINAL_ITER if include_executed else ("pending_approval", "dispatched", "in_flight")
    now = _utcnow()
    for it in rows:
        runner.request_abort(it.id)
        # executed 等待评估的默认不强行中止（结果已产出）；其余（含 restart 的 executed）标记 aborted
        if it.status in abortable:
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
