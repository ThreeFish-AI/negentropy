"""Auto-extracted route module: KG build progress SSE/polling."""

from __future__ import annotations

import asyncio
import json
from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from pydantic import ValidationError  # noqa: F401

from negentropy.knowledge._shared import (
    _get_graph_service,
)
from negentropy.knowledge.api_helpers import _resolve_app_name
from negentropy.logging import get_logger

if TYPE_CHECKING:
    pass

# Lifecycle schema imports
from negentropy.knowledge.lifecycle_schemas import (  # noqa: F401
    AssignDocumentRequest,
    CatalogTreeResponse,
    CategorySuggestionResponse,
    DocumentProvenanceResponse,
    WikiEntryContentResponse,
    WikiNavTreeResponse,
    WikiPublishActionResponse,
)

logger = get_logger("negentropy.knowledge.api")
router = APIRouter()


@router.get("/base/{corpus_id}/graph/build-runs/latest")
async def get_latest_kg_build_run(
    corpus_id: UUID,
    app_name: str | None = Query(default=None),
    only_active: bool = Query(
        default=False,
        description=(
            "仅返回 pending/running 的活跃 run。客户端 Pill 在锁定 run_id 前用 true 轮询，"
            "避免拿到历史 completed/failed run 被误判为新 run 的终态（与 SSE 发现期 grace 等价）。"
        ),
    ),
) -> dict[str, Any]:
    """获取指定 corpus 最新一次 KG 构建运行的状态快照（轮询友好）。

    每次请求返回最新 DB 行的 JSON 快照，包含 progress_percent 与当前 phase。

    - ``only_active=true`` 且无活跃 run → 返回 ``{"status": "pending"}``（仍处发现期，客户端继续轮询）。
    - ``only_active=false`` 且无任何 run → 返回 ``{"status": "idle"}``（终态）。

    设计动机：``enqueue_kg_build`` 使用 ``asyncio.create_task`` fire-and-forget，
    ``ingest_paper`` 返回 ``kg_enqueued`` 时后台尚未走到 ``GraphService.create_build_run`` 的插入点。
    若客户端首轮就用 ``only_active=false``，会拿到该 corpus 历史上一条 completed/failed run，
    导致 Pill 误报终态并卸载。SSE 端点（见 ``stream_latest_kg_build_progress``）通过
    ``only_active=run_id_seen is None`` + 10s grace 显式规避，本端点通过 query 参数同等暴露。
    """

    resolved_app = _resolve_app_name(app_name)
    repository = _get_graph_service()._repository  # noqa: SLF001

    record = await repository.get_latest_build_run(
        corpus_id=corpus_id,
        app_name=resolved_app,
        only_active=only_active,
    )

    if record is None:
        # only_active=True 表示客户端仍处发现期，回 "pending" 让其继续轮询；
        # only_active=False 表示客户端已放弃发现期或允许历史 run，无 run 即真终态 "idle"。
        status = "pending" if only_active else "idle"
        return {"status": status, "corpus_id": str(corpus_id)}

    # 从 warnings JSONB 提取最后一条 _phase 条目（与 SSE 端点逻辑一致）
    phase: str | None = None
    phase_detail: dict[str, Any] | None = None
    if record.warnings:
        for entry in reversed(record.warnings):
            if isinstance(entry, dict) and "_phase" in entry:
                meta = entry["_phase"]
                if isinstance(meta, dict):
                    phase = meta.get("name")
                    phase_detail = meta
                break

    completed_at_iso = record.completed_at.isoformat() if isinstance(record.completed_at, datetime) else None

    return {
        "run_id": record.run_id,
        "status": record.status,
        "progress_percent": float(record.progress_percent or 0.0),
        "entity_count": int(record.entity_count or 0),
        "relation_count": int(record.relation_count or 0),
        "error_message": record.error_message,
        "completed_at": completed_at_iso,
        "phase": phase,
        "phase_detail": phase_detail,
    }


@router.get("/base/{corpus_id}/graph/build-runs/latest/progress/stream")
async def stream_latest_kg_build_progress(
    corpus_id: UUID,
    app_name: str | None = Query(default=None),
    poll_interval_ms: int = Query(default=1000, ge=250, le=10000),
    max_seconds: int = Query(default=900, ge=10, le=3600),
):
    """SSE 流式推送指定 corpus 最新一次 KG build run 的进度。

    用例：``ingest_paper`` 返回 ``kg_status="kg_enqueued"`` 后，前端用 corpus_id 订阅本端点。
    """
    from datetime import datetime

    resolved_app = _resolve_app_name(app_name)
    repository = _get_graph_service()._repository  # noqa: SLF001  KG service 私有 repo 复用

    async def _event_stream():
        deadline = asyncio.get_running_loop().time() + max_seconds
        last_payload: dict[str, Any] | None = None
        run_id_seen: str | None = None
        # 发现期 grace 窗口：ingest_paper 返回 kg_enqueued 后，前端立刻打开 SSE，
        # 此时后台 _run_kg_build_background 可能尚未走到 GraphService.create_build_run
        # 的插入点；若 corpus 历史上有过 completed/failed run，直接 only_active=False
        # 会拿到旧 run 的终态 payload，导致前端误报「已完成 / 失败」。
        # 因此发现期统一用 only_active=True 等待新 run 出现，超过 grace 仍无活跃 run
        # 才认定 idle 终态。锁定 run_id 之后再切到 only_active=False 以便捕获终态行。
        no_active_grace_seconds = 10
        no_active_started_at: float | None = None

        try:
            while asyncio.get_running_loop().time() < deadline:
                try:
                    record = await repository.get_latest_build_run(
                        corpus_id=corpus_id,
                        app_name=resolved_app,
                        only_active=run_id_seen is None,
                    )
                except Exception as exc:
                    yield f"data: {json.dumps({'status': 'error', 'error_message': str(exc)})}\n\n"
                    return

                if record is None:
                    if run_id_seen is None:
                        # 发现期：active run 尚未出现，按 poll_interval_ms 继续等待
                        now = asyncio.get_running_loop().time()
                        if no_active_started_at is None:
                            no_active_started_at = now
                        elif now - no_active_started_at > no_active_grace_seconds:
                            yield f"data: {json.dumps({'status': 'idle'})}\n\n"
                            return
                        await asyncio.sleep(poll_interval_ms / 1000.0)
                        continue
                    # 跟踪期 latest=None 不应发生（数据是持久化的）；保守告知 idle
                    yield f"data: {json.dumps({'status': 'idle'})}\n\n"
                    return

                # 锁定首次见到的 run_id，避免后续中途出现新 run 时跨 run 跳变
                if run_id_seen is None:
                    run_id_seen = record.run_id
                elif record.run_id != run_id_seen:
                    # 跨 run 切换：终结当前 SSE，让前端按需重订
                    yield f"data: {json.dumps({'status': 'switched', 'run_id': run_id_seen})}\n\n"
                    return

                completed_at_iso = (
                    record.completed_at.isoformat() if isinstance(record.completed_at, datetime) else None
                )

                # 从 warnings JSONB 中提取最后一条 _phase 条目（service.emit_phase 写入），
                # 透传给前端 KgBuildProgressPill 渲染中文阶段标签。warnings 终态会剥离 _phase
                # （见 service._strip_phase_entries），所以 status=completed 时 phase 为 None。
                phase: str | None = None
                phase_detail: dict[str, Any] | None = None
                if record.warnings:
                    for entry in reversed(record.warnings):
                        if isinstance(entry, dict) and "_phase" in entry:
                            meta = entry["_phase"]
                            if isinstance(meta, dict):
                                phase = meta.get("name")
                                phase_detail = meta
                            break

                payload = {
                    "run_id": record.run_id,
                    "status": record.status,
                    "progress_percent": float(record.progress_percent or 0.0),
                    "entity_count": int(record.entity_count or 0),
                    "relation_count": int(record.relation_count or 0),
                    "error_message": record.error_message,
                    "completed_at": completed_at_iso,
                    "phase": phase,
                    "phase_detail": phase_detail,
                }
                # 仅当 payload 与上次有差异时才推送，节省客户端 reflow
                if payload != last_payload:
                    yield f"data: {json.dumps(payload)}\n\n"
                    last_payload = payload

                if record.status in ("completed", "failed"):
                    return

                await asyncio.sleep(poll_interval_ms / 1000.0)
            # 到达 max_seconds：发一条 timeout 终态
            yield f"data: {json.dumps({'status': 'timeout'})}\n\n"
        except asyncio.CancelledError:
            # 客户端断开
            return

    return StreamingResponse(
        _event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",  # 禁用 nginx buffering
            "Connection": "keep-alive",
        },
    )
