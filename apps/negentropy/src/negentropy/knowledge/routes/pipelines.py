"""Auto-extracted route module: Pipeline CRUD + Stats."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import ValidationError  # noqa: F401
from sqlalchemy import func, select

from negentropy.auth.deps import get_optional_user
from negentropy.auth.service import AuthUser
from negentropy.db.session import AsyncSessionLocal
from negentropy.knowledge._shared import (
    _get_dao,
)
from negentropy.knowledge.api_helpers import _resolve_app_name
from negentropy.knowledge.schemas import (
    ApiStatsResponse,
    KnowledgePipelinesResponse,
    PipelineCancelRequest,
    PipelineCancelResponse,
    PipelineRunRecordResponse,
    PipelinesResponse,
    PipelinesUpsertRequest,
    PipelineUpsertRecordResponse,
    PipelineUpsertResponse,
)
from negentropy.logging import get_logger
from negentropy.models.perception import Corpus, Knowledge

if TYPE_CHECKING:
    pass

from negentropy.knowledge._shared import _normalize_pipeline_run_payload

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


@router.get("/pipelines/overview", response_model=PipelinesResponse)
async def get_pipelines_overview(app_name: str | None = Query(default=None)) -> PipelinesResponse:
    resolved_app = _resolve_app_name(app_name)
    dao = _get_dao()
    pipeline_runs = [
        (run.payload or {}) | {"run_id": run.run_id, "status": run.status, "version": run.version}
        for run in await dao.list_pipeline_runs(resolved_app, limit=10)
    ]
    alerts = []
    async with AsyncSessionLocal() as db:
        corpus_count = await db.scalar(select(func.count()).select_from(Corpus).where(Corpus.app_name == resolved_app))
        # Dashboard 计数统一为 parent chunk 口径，复用 repository 的 per-corpus fallback 逻辑，
        # 确保混合 hierarchical / non-hierarchical 语料库场景下计数准确。
        from negentropy.knowledge.retrieval.repository import KnowledgeRepository

        repo = KnowledgeRepository()
        corpora_with_counts = await repo.list_corpora_with_counts(app_name=resolved_app)
        knowledge_count = sum(parent_or_all for _, parent_or_all, _ in corpora_with_counts)
        last_build_at = await db.scalar(
            select(func.max(Knowledge.updated_at)).where(Knowledge.app_name == resolved_app)
        )

    return PipelinesResponse(
        corpus_count=corpus_count or 0,
        knowledge_count=knowledge_count or 0,
        last_build_at=last_build_at.isoformat() if last_build_at else None,
        pipeline_runs=pipeline_runs or [],
        alerts=alerts or [],
    )


@router.get("/pipelines", response_model=KnowledgePipelinesResponse)
async def get_pipelines(
    app_name: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> KnowledgePipelinesResponse:
    resolved_app = _resolve_app_name(app_name)
    dao = _get_dao()
    total = await dao.count_pipeline_runs(resolved_app)
    runs = await dao.list_pipeline_runs(resolved_app, limit=limit, offset=offset)
    return KnowledgePipelinesResponse(
        count=total,
        runs=[
            PipelineRunRecordResponse(
                id=str(run.id),
                run_id=run.run_id,
                status=run.status,
                version=run.version,
                **_normalize_pipeline_run_payload(run.payload),
            )
            for run in runs
        ],
        last_updated_at=runs[0].updated_at.isoformat() if runs else None,
    )


@router.post("/pipelines", response_model=PipelineUpsertResponse)
async def upsert_pipelines(payload: PipelinesUpsertRequest) -> PipelineUpsertResponse:
    resolved_app = _resolve_app_name(payload.app_name)
    dao = _get_dao()
    result = await dao.upsert_pipeline_run(
        app_name=resolved_app,
        run_id=payload.run_id,
        status=payload.status,
        payload=payload.payload,
        idempotency_key=payload.idempotency_key,
        expected_version=payload.expected_version,
    )
    if result.status == "conflict":
        raise HTTPException(status_code=409, detail="Pipeline run version conflict")
    return PipelineUpsertResponse(
        status=result.status,
        pipeline=PipelineUpsertRecordResponse(**result.record),
    )


@router.post(
    "/pipelines/{run_id}/cancel",
    response_model=PipelineCancelResponse,
)
async def cancel_pipeline_run(
    run_id: str,
    payload: PipelineCancelRequest = Body(default_factory=PipelineCancelRequest),  # noqa: B008
    user: AuthUser | None = Depends(get_optional_user),
) -> PipelineCancelResponse:
    """协作式取消正在运行的 KB Pipeline Run。

    立即返回 cancelling/cancelled/noop 状态，task 在下一个 stage 边界（通常 < 5s）
    感知信号并写终态；多 worker 场景下依赖 DB 兜底（最长一个 stage 周期）。
    采用条件 UPDATE 规避与 `tracker._persist` 的 race（R-7 修补）。

    Errors:
        404: Run 不存在；
        409: Run 已是 terminal 状态（completed/failed/cancelled）。
    """
    from .cancellation import signal_cancel

    resolved_app = _resolve_app_name(payload.app_name)
    dao = _get_dao()
    cancellation_meta: dict[str, Any] = {
        "requested_at": datetime.now(UTC).isoformat(),
        "requested_by": user.email if user else None,
        "reason": payload.reason or "user_cancel",
    }
    new_status, record = await dao.request_pipeline_run_cancel(
        app_name=resolved_app,
        run_id=run_id,
        cancellation_meta=cancellation_meta,
    )

    if new_status == "not_found":
        raise HTTPException(status_code=404, detail="Pipeline run not found")
    if new_status == "terminal":
        current = record.status if record else "unknown"
        raise HTTPException(
            status_code=409,
            detail=f"Pipeline run is in terminal state: {current}",
        )

    # 进程内 fast-path 信号；False 表示 task 在其他 worker，依赖 DB 兜底
    in_process = signal_cancel(run_id) if record else False

    record_dict: dict[str, Any] = {}
    if record is not None:
        record_dict = {
            "id": str(record.id),
            "run_id": record.run_id,
            "status": record.status,
            "version": record.version,
            "updated_at": record.updated_at.isoformat() if record.updated_at else None,
            "payload": record.payload or {},
        }

    return PipelineCancelResponse(
        status=new_status,
        run_id=run_id,
        in_process=in_process,
        record=record_dict,
    )


# operation_name 格式: "{METHOD} {path}"，例如 "POST /knowledge/base/{uuid}/search"
ENDPOINT_PATTERNS: dict[str, list[str]] = {
    "search": [r"^POST /knowledge/base/[^/]+/search$"],
    "ingest": [r"^POST /knowledge/base/[^/]+/ingest$"],  # 精确匹配，不会匹配 ingest_url
    "ingest_url": [r"^POST /knowledge/base/[^/]+/ingest_url$"],
    "replace_source": [r"^POST /knowledge/base/[^/]+/replace_source$"],
    "list_knowledge": [r"^GET /knowledge/base/[^/]+/knowledge$"],
    "create_corpus": [r"^POST /knowledge/base$"],  # 精确匹配（无 UUID）
    "delete_corpus": [r"^DELETE /knowledge/base/[^/]+$"],  # 精确匹配 UUID
}


@router.get("/stats", response_model=ApiStatsResponse)
async def get_api_stats(
    app_name: str | None = Query(default=None),
    period_hours: int = Query(default=24, ge=1, le=720, description="统计周期（小时）"),
    endpoint: str | None = Query(default=None, description="API endpoint ID (如 search, ingest)"),
) -> ApiStatsResponse:
    """获取 Knowledge API 调用统计

    从 traces 表聚合统计 Knowledge API 的调用情况。
    支持按单个端点过滤，或返回所有 Knowledge API 的汇总统计。

    Args:
        app_name: 应用名称（可选）
        period_hours: 统计周期，默认 24 小时
        endpoint: API 端点 ID（可选），如 "search"、"ingest" 等

    Returns:
        ApiStatsResponse: 包含总调用数、成功数、失败数和平均延迟
    """
    from datetime import timedelta

    from sqlalchemy import and_, or_, select
    from sqlalchemy import func as sql_func

    from negentropy.models.observability import Trace

    resolved_app = _resolve_app_name(app_name)
    start_time = datetime.utcnow() - timedelta(hours=period_hours)

    async with AsyncSessionLocal() as db:
        # 构建过滤条件
        conditions = [Trace.start_time >= start_time]

        if endpoint and endpoint in ENDPOINT_PATTERNS:
            # 按单个端点过滤，使用 PostgreSQL 正则表达式 (~) 进行精确匹配
            patterns = ENDPOINT_PATTERNS[endpoint]
            or_conditions = [Trace.operation_name.op("~")(p) for p in patterns]
            conditions.append(or_(*or_conditions))
        else:
            # 默认：所有 Knowledge API
            conditions.append(Trace.operation_name.op("~")(r"/knowledge/"))

        stmt = select(
            sql_func.count().label("total_calls"),
            sql_func.count().filter(Trace.status_code == "OK").label("success_count"),
            sql_func.count().filter(Trace.status_code != "OK").label("failed_count"),
            sql_func.avg(Trace.duration_ns).label("avg_duration_ns"),
        ).where(and_(*conditions))

        result = await db.execute(stmt)
        row = result.one()

        total_calls = row.total_calls or 0
        success_count = row.success_count or 0
        failed_count = row.failed_count or 0
        avg_duration_ns = row.avg_duration_ns or 0

        # 纳秒转换为毫秒
        avg_latency_ms = avg_duration_ns / 1_000_000 if avg_duration_ns else 0.0

        logger.debug(
            "API stats queried",
            app_name=resolved_app,
            period_hours=period_hours,
            endpoint=endpoint,
            total_calls=total_calls,
            success_count=success_count,
            avg_latency_ms=avg_latency_ms,
        )

        return ApiStatsResponse(
            total_calls=total_calls,
            success_count=success_count,
            failed_count=failed_count,
            avg_latency_ms=round(avg_latency_ms, 2),
        )
