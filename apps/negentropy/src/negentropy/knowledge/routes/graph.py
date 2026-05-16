"""Auto-extracted route module: Knowledge Graph endpoints."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import ValidationError  # noqa: F401

from negentropy.auth.deps import get_optional_user
from negentropy.auth.service import AuthUser
from negentropy.db.session import AsyncSessionLocal
from negentropy.knowledge._shared import (
    _KG_BUILD_BG_TASKS,
    _get_dao,
    _get_graph_service,
    _get_service,
    _normalize_pipeline_run_payload,
)
from negentropy.knowledge.api_helpers import _map_exception_to_http, _resolve_app_name, _resolve_corpus_model_ids
from negentropy.knowledge.exceptions import KnowledgeError
from negentropy.knowledge.ingestion.embedding import build_embedding_fn
from negentropy.knowledge.schemas import (
    GraphBuildRequest,
    GraphBuildResponse,
    GraphNeighborsRequest,
    GraphPathRequest,
    GraphSearchRequest,
    GraphSearchResponse,
    GraphUpsertRequest,
    KnowledgePipelinesResponse,
    PipelineCancelRequest,
    PipelineCancelResponse,
    PipelineRunRecordResponse,
    PipelinesUpsertRequest,
    PipelineUpsertRecordResponse,
    PipelineUpsertResponse,
)
from negentropy.knowledge.types import (
    GraphBuildConfig,
    GraphQueryConfig,
)
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


@router.get("/graph")
async def get_graph(app_name: str | None = Query(default=None)) -> dict[str, Any]:
    resolved_app = _resolve_app_name(app_name)
    dao = _get_dao()
    latest = await dao.get_latest_graph(resolved_app)
    graph = latest.payload if latest else {}
    runs = await dao.list_graph_runs(resolved_app, limit=20)
    return {
        "nodes": graph.get("nodes", []),
        "edges": graph.get("edges", []),
        "runs": [
            {
                "run_id": run.run_id,
                "status": run.status,
                "version": run.version,
                "updated_at": run.updated_at.isoformat() if run.updated_at else None,
            }
            for run in runs
        ],
    }


@router.post("/graph")
async def upsert_graph(payload: GraphUpsertRequest) -> dict[str, Any]:
    resolved_app = _resolve_app_name(payload.app_name)
    dao = _get_dao()
    result = await dao.upsert_graph_run(
        app_name=resolved_app,
        run_id=payload.run_id,
        status=payload.status,
        payload=payload.graph.model_dump(),
        idempotency_key=payload.idempotency_key,
        expected_version=payload.expected_version,
    )
    if result.status == "conflict":
        raise HTTPException(status_code=409, detail="Graph run version conflict")
    return {"status": result.status, "graph": result.record}


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


# ============================================================================
# Knowledge Graph API Endpoints (Phase 1 Enhancement)
# ============================================================================


@router.post("/base/{corpus_id}/graph/build")
async def build_knowledge_graph(
    corpus_id: UUID,
    payload: GraphBuildRequest,
) -> GraphBuildResponse:
    """构建知识图谱

    从语料库的知识块中提取实体和关系，构建知识图谱。

    Args:
        corpus_id: 语料库 ID
        payload: 构建配置

    Returns:
        构建结果统计
    """
    resolved_app = _resolve_app_name(payload.app_name)

    logger.info(
        "api_graph_build_started",
        corpus_id=str(corpus_id),
        app_name=resolved_app,
        enable_llm=payload.enable_llm_extraction,
    )

    try:
        # 获取语料库中的所有知识块
        service = _get_service()
        knowledge_items, total_count, _, _ = await service.list_knowledge(
            corpus_id=corpus_id,
            app_name=resolved_app,
            limit=10000,  # 获取所有
        )

        if total_count == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "NO_KNOWLEDGE", "message": "No knowledge chunks found in corpus"},
            )

        # Hierarchical 语料库：仅使用 parent chunk 构建 KG，
        # 避免 child chunk 参与实体/关系抽取造成冗余。
        # 非 hierarchical 语料库无 parent chunk，保持全量使用。
        from negentropy.knowledge.service import CHUNK_ROLE_PARENT

        parent_items = [
            item for item in knowledge_items if (item.metadata or {}).get("chunk_role") == CHUNK_ROLE_PARENT
        ]
        if parent_items:
            knowledge_items = parent_items

        # 准备知识块数据（含 id 用于增量构建跳过判断）
        chunks = [
            {
                "id": str(item.id),
                "content": item.content,
                "metadata": item.metadata or {},
            }
            for item in knowledge_items
        ]

        # 构建配置
        config = GraphBuildConfig(
            enable_llm_extraction=payload.enable_llm_extraction,
            llm_model=payload.llm_model,
            min_entity_confidence=payload.min_entity_confidence,
            min_relation_confidence=payload.min_relation_confidence,
            batch_size=payload.batch_size,
            incremental=payload.incremental,
            extraction_schema_name=payload.extraction_schema,
        )

        # Fire-and-forget：同步创建 build run 记录（<1s），立即返回 run_id，
        # 实际构建在后台 asyncio.Task 中执行。前端通过轮询 build-runs/latest 获取进度。
        graph_service = _get_graph_service()
        ctx = await graph_service._init_build_run(
            corpus_id=corpus_id,
            app_name=resolved_app,
            chunks=chunks,
            config=config,
        )

        async def _run_build_background() -> None:
            try:
                result = await graph_service._execute_build(ctx)
                logger.info(
                    "api_graph_build_completed",
                    corpus_id=str(corpus_id),
                    run_id=result.run_id,
                    entity_count=result.entity_count,
                    relation_count=result.relation_count,
                )
            except Exception as exc:
                logger.error(
                    "api_graph_build_background_failed",
                    corpus_id=str(corpus_id),
                    run_id=ctx.run_id,
                    error=str(exc),
                )

        task = asyncio.create_task(_run_build_background())
        _KG_BUILD_BG_TASKS.add(task)
        task.add_done_callback(_KG_BUILD_BG_TASKS.discard)

        logger.info(
            "api_graph_build_enqueued",
            corpus_id=str(corpus_id),
            run_id=ctx.run_id,
            chunk_count=len(chunks),
        )

        return GraphBuildResponse(
            run_id=ctx.run_id,
            corpus_id=corpus_id,
            status="running",
            entity_count=0,
            relation_count=0,
            chunks_processed=0,
            elapsed_seconds=0.0,
        )

    except KnowledgeError as exc:
        raise _map_exception_to_http(exc) from exc


@router.post(
    "/base/{corpus_id}/graph/runs/{run_id}/cancel",
    response_model=PipelineCancelResponse,
)
async def cancel_kg_build_run(
    corpus_id: UUID,
    run_id: str,
    payload: PipelineCancelRequest = Body(default_factory=PipelineCancelRequest),  # noqa: B008
    user: AuthUser | None = Depends(get_optional_user),
) -> PipelineCancelResponse:
    """协作式取消正在运行的 KG Build Run。

    路径携带 `corpus_id` 与 `run_id`：`kg_build_runs` 表按 corpus_id 索引，路径
    携带是 RESTful 规范；run_id 用于 KG repository 内的条件 UPDATE 定位。立即
    返回 cancelling/cancelled/noop，task 在 emit_phase 阶段边界（最长 30s）感知
    后写终态；进程内同 worker 通过 in-memory event 秒级感知（R-9 修补）。

    Errors:
        404: KG build run 不存在；
        409: KG build run 已 terminal（completed/failed/cancelled）。
    """
    from .cancellation import signal_cancel

    resolved_app = _resolve_app_name(payload.app_name)
    cancellation_meta: dict[str, Any] = {
        "requested_at": datetime.now(UTC).isoformat(),
        "requested_by": user.email if user else None,
        "reason": payload.reason or "user_cancel",
        "corpus_id": str(corpus_id),
    }

    # Reuse default GraphService 的 repository（避免新建 connection pool）
    graph_service = _get_graph_service()
    repository = graph_service._repository  # 内部 Repo 引用，私有但稳定（同 build_graph 共用）
    new_status, record = await repository.request_build_run_cancel(
        run_id=run_id,
        app_name=resolved_app,
        cancellation_meta=cancellation_meta,
    )

    if new_status == "not_found":
        raise HTTPException(status_code=404, detail="KG build run not found")
    if new_status == "terminal":
        current = record.status if record else "unknown"
        raise HTTPException(
            status_code=409,
            detail=f"KG build run is in terminal state: {current}",
        )

    in_process = signal_cancel(run_id) if record else False

    record_dict: dict[str, Any] = {}
    if record is not None:
        record_dict = {
            "id": str(record.id),
            "run_id": record.run_id,
            "status": record.status,
            "corpus_id": str(record.corpus_id),
            "progress_percent": record.progress_percent,
            "warnings": record.warnings or [],
        }

    return PipelineCancelResponse(
        status=new_status,
        run_id=run_id,
        in_process=in_process,
        record=record_dict,
    )


@router.get("/base/{corpus_id}/graph", response_model=dict[str, Any])
async def get_corpus_graph(
    corpus_id: UUID,
    app_name: str | None = Query(default=None),
    include_runs: bool = Query(default=False),
    as_of: datetime | None = Query(
        default=None,
        description=(
            "可选时态快照时刻 (ISO-8601)；提供时仅返回在该时刻有效的关系。"
            "用于双时态时间穿梭检索 (Snodgrass & Ahn, 1985)。"
        ),
    ),
) -> dict[str, Any]:
    """获取语料库的知识图谱

    Args:
        corpus_id: 语料库 ID
        app_name: 应用名称
        include_runs: 是否包含构建历史
        as_of: 可选时态快照时刻

    Returns:
        图谱数据（节点和边）
    """
    resolved_app = _resolve_app_name(app_name)

    logger.debug(
        "api_get_corpus_graph",
        corpus_id=str(corpus_id),
        app_name=resolved_app,
        include_runs=include_runs,
        as_of=as_of.isoformat() if as_of else None,
    )

    graph_service = _get_graph_service()
    graph = await graph_service.get_graph(
        corpus_id=corpus_id,
        app_name=resolved_app,
        include_runs=include_runs,
        as_of=as_of,
    )

    return {
        "nodes": [
            {
                "id": node.id,
                "label": node.label,
                "type": node.node_type,
                "importance": node.metadata.get("importance_score"),
                "community_id": node.metadata.get("community_id"),
                "metadata": node.metadata,
            }
            for node in graph.nodes
        ],
        "edges": [
            {
                "source": edge.source,
                "target": edge.target,
                "label": edge.label,
                "type": edge.edge_type,
                "weight": edge.weight,
                "metadata": edge.metadata,
            }
            for edge in graph.edges
        ],
        "runs": graph.runs or [],
    }


@router.post("/base/{corpus_id}/graph/search", response_model=GraphSearchResponse)
async def search_knowledge_graph(
    corpus_id: UUID,
    payload: GraphSearchRequest,
) -> GraphSearchResponse:
    """图谱混合检索

    结合向量相似度和图结构分数进行检索。

    Args:
        corpus_id: 语料库 ID
        payload: 检索请求

    Returns:
        检索结果
    """
    resolved_app = _resolve_app_name(payload.app_name)

    logger.info(
        "api_graph_search_started",
        corpus_id=str(corpus_id),
        app_name=resolved_app,
        query=payload.query[:50],
        mode=payload.mode,
    )

    try:
        # 生成查询向量（embedding 不可用时降级为 None）
        # 注入 Corpus 自己绑定的 embedding_config_id，与 ingestion 写入 chunk
        # embedding 时同一份配置 → 同一向量空间 → 余弦相似度有意义。
        query_embedding: list[float] | None = None
        async with AsyncSessionLocal() as _emb_db:
            embedding_config_id, _ = await _resolve_corpus_model_ids(_emb_db, corpus_id)
        embedding_fn = build_embedding_fn(embedding_config_id)
        try:
            query_embedding = await embedding_fn(payload.query)
        except Exception as emb_exc:
            logger.warning(
                "api_graph_search_embedding_fallback",
                error=str(emb_exc),
            )

        # 查询配置
        config = GraphQueryConfig(
            max_depth=payload.max_depth,
            limit=payload.limit,
            semantic_weight=(payload.semantic_weight if query_embedding else 0.0),
            graph_weight=(payload.graph_weight if query_embedding else 1.0),
            include_neighbors=payload.include_neighbors,
            neighbor_limit=payload.neighbor_limit,
        )

        # 执行检索
        graph_service = _get_graph_service()
        result = await graph_service.search(
            corpus_id=corpus_id,
            app_name=resolved_app,
            query=payload.query,
            query_embedding=query_embedding,
            config=config,
            as_of=payload.as_of,
        )

        logger.info(
            "api_graph_search_completed",
            corpus_id=str(corpus_id),
            result_count=result.total_count,
            query_time_ms=result.query_time_ms,
        )

        return GraphSearchResponse(
            count=result.total_count,
            query_time_ms=result.query_time_ms,
            items=[
                {
                    "entity": {
                        "id": item.entity.id,
                        "label": item.entity.label,
                        "type": item.entity.node_type,
                        "metadata": item.entity.metadata,
                    },
                    "semantic_score": item.semantic_score,
                    "graph_score": item.graph_score,
                    "combined_score": item.combined_score,
                    "neighbors": [
                        {
                            "id": n.id,
                            "label": n.label,
                            "type": n.node_type,
                        }
                        for n in item.neighbors
                    ],
                }
                for item in result.entities
            ],
        )

    except Exception as exc:
        logger.error("api_graph_search_failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "GRAPH_SEARCH_ERROR", "message": str(exc)},
        ) from exc


@router.post("/graph/neighbors")
async def find_entity_neighbors(
    payload: GraphNeighborsRequest,
) -> dict[str, Any]:
    """查询实体邻居

    Args:
        payload: 邻居查询请求

    Returns:
        邻居节点列表
    """
    logger.debug(
        "api_find_neighbors",
        entity_id=payload.entity_id,
        max_depth=payload.max_depth,
    )

    graph_service = _get_graph_service()
    neighbors = await graph_service.find_neighbors(
        entity_id=payload.entity_id,
        max_depth=payload.max_depth,
        limit=payload.limit,
        as_of=payload.as_of,
    )

    return {
        "entity_id": payload.entity_id,
        "count": len(neighbors),
        "neighbors": [
            {
                "id": node.id,
                "label": node.label,
                "type": node.node_type,
                "metadata": node.metadata,
            }
            for node in neighbors
        ],
    }


@router.post("/graph/path")
async def find_entity_path(
    payload: GraphPathRequest,
) -> dict[str, Any]:
    """查询两点间最短路径

    Args:
        payload: 路径查询请求

    Returns:
        路径节点 ID 列表
    """
    logger.debug(
        "api_find_path",
        source_id=payload.source_id,
        target_id=payload.target_id,
        max_depth=payload.max_depth,
    )

    graph_service = _get_graph_service()
    path = await graph_service.find_path(
        source_id=payload.source_id,
        target_id=payload.target_id,
        max_depth=payload.max_depth,
        as_of=payload.as_of,
    )

    return {
        "source_id": payload.source_id,
        "target_id": payload.target_id,
        "found": path is not None,
        "path": path,
        "length": len(path) if path else 0,
    }


@router.delete("/base/{corpus_id}/graph", status_code=status.HTTP_204_NO_CONTENT)
async def clear_corpus_graph(
    corpus_id: UUID,
    app_name: str | None = Query(default=None),
) -> None:
    """清除语料库的图谱数据

    Args:
        corpus_id: 语料库 ID
        app_name: 应用名称
    """
    resolved_app = _resolve_app_name(app_name)

    logger.info(
        "api_clear_graph",
        corpus_id=str(corpus_id),
        app_name=resolved_app,
    )

    graph_service = _get_graph_service()
    count = await graph_service.clear_graph(corpus_id)

    logger.info(
        "api_graph_cleared",
        corpus_id=str(corpus_id),
        nodes_cleared=count,
    )


@router.get("/base/{corpus_id}/graph/history")
async def get_graph_build_history(
    corpus_id: UUID,
    app_name: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    """获取图谱构建历史

    Args:
        corpus_id: 语料库 ID
        app_name: 应用名称
        limit: 结果数量限制

    Returns:
        构建运行历史列表
    """
    resolved_app = _resolve_app_name(app_name)

    graph_service = _get_graph_service()
    runs = await graph_service.get_build_history(
        corpus_id=corpus_id,
        app_name=resolved_app,
        limit=limit,
    )

    return {
        "corpus_id": str(corpus_id),
        "count": len(runs),
        "runs": [
            {
                "id": str(run.id),
                "run_id": run.run_id,
                "status": run.status,
                "entity_count": run.entity_count,
                "relation_count": run.relation_count,
                "extractor_config": run.extractor_config,
                "model_name": run.model_name,
                "error_message": run.error_message,
                "started_at": run.started_at.isoformat() if run.started_at else None,
                "completed_at": run.completed_at.isoformat() if run.completed_at else None,
                "created_at": run.created_at.isoformat() if run.created_at else None,
                "progress_percent": float(run.progress_percent) if run.progress_percent else 0.0,
                "warnings": run.warnings,
            }
            for run in runs
        ],
    }
