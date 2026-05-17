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
    _get_kg_entity_service,
    _get_service,
)
from negentropy.knowledge.api_helpers import _map_exception_to_http, _resolve_app_name, _resolve_corpus_model_ids
from negentropy.knowledge.exceptions import KnowledgeError
from negentropy.knowledge.ingestion.embedding import build_embedding_fn
from negentropy.knowledge.schemas import (
    GlobalSearchEvidenceItem,
    GlobalSearchRequest,
    GlobalSearchResponse,
    GraphBuildRequest,
    GraphBuildResponse,
    GraphEntityDetailResponse,
    GraphEntityItem,
    GraphEntityListResponse,
    GraphMetricsResponse,
    GraphNeighborsRequest,
    GraphPathRequest,
    GraphQualityResponse,
    GraphSearchRequest,
    GraphSearchResponse,
    GraphStatsResponse,
    GraphTimelineBucket,
    GraphTimelineResponse,
    GraphUpsertRequest,
    MultiHopEvidenceChainItem,
    MultiHopEvidenceEdgeItem,
    MultiHopReasonRequest,
    MultiHopReasonResponse,
    PipelineCancelRequest,
    PipelineCancelResponse,
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
    from ..cancellation import signal_cancel

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


@router.get("/base/{corpus_id}/graph/entities", response_model=GraphEntityListResponse)
async def list_graph_entities(
    corpus_id: UUID,
    entity_type: str | None = Query(default=None),
    search: str | None = Query(default=None),
    sort_by: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> GraphEntityListResponse:
    """获取语料库的实体列表

    支持按类型筛选、名称搜索和排序（importance 按重要性）。
    """
    entity_svc = _get_kg_entity_service()
    async with AsyncSessionLocal() as db:
        items, total = await entity_svc.list_entities(
            db,
            corpus_id=corpus_id,
            entity_type=entity_type,
            search=search,
            sort_by=sort_by,
            limit=limit,
            offset=offset,
        )
    return GraphEntityListResponse(count=total, items=[GraphEntityItem(**i) for i in items])


@router.get("/base/{corpus_id}/graph/entities/{entity_id}", response_model=GraphEntityDetailResponse)
async def get_graph_entity_detail(
    corpus_id: UUID,
    entity_id: UUID,
) -> GraphEntityDetailResponse:
    """获取实体详情（含关系列表）"""
    entity_svc = _get_kg_entity_service()
    async with AsyncSessionLocal() as db:
        detail = await entity_svc.get_entity_detail(db, entity_id=entity_id, corpus_id=corpus_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Entity not found")
    return GraphEntityDetailResponse(**detail)


@router.get("/base/{corpus_id}/graph/stats", response_model=GraphStatsResponse)
async def get_graph_stats(
    corpus_id: UUID,
    app_name: str | None = Query(default=None),
) -> GraphStatsResponse:
    """获取图谱统计信息"""
    graph_service = _get_graph_service()
    async with AsyncSessionLocal() as db:
        stats = await graph_service.get_stats(db, corpus_id=corpus_id)
    return GraphStatsResponse(**stats)


@router.get("/base/{corpus_id}/graph/metrics", response_model=GraphMetricsResponse)
async def get_graph_metrics(
    corpus_id: UUID,
    limit: int = Query(default=10, ge=1, le=50),
) -> GraphMetricsResponse:
    """获取图谱构建指标趋势

    返回最近 N 次 build 的定量指标（实体数、关系数等），
    用于质量趋势监控。metrics 仅在 build 有警告时附带详细指标快照。
    """
    import json

    from sqlalchemy import text

    from negentropy.models.base import NEGENTROPY_SCHEMA

    async with AsyncSessionLocal() as db:
        rows = await db.execute(
            text(f"""
                SELECT run_id, status, entity_count, relation_count,
                       chunks_processed, progress_percent, warnings,
                       started_at, completed_at, created_at
                FROM {NEGENTROPY_SCHEMA}.kg_build_runs
                WHERE corpus_id = :corpus_id
                ORDER BY created_at DESC
                LIMIT :limit
            """),
            {"corpus_id": str(corpus_id), "limit": limit},
        )

        builds = []
        for row in rows:
            build_entry: dict[str, Any] = {
                "run_id": row.run_id,
                "status": row.status,
                "entity_count": row.entity_count or 0,
                "relation_count": row.relation_count or 0,
                "chunks_processed": row.chunks_processed or 0,
                "progress_percent": float(row.progress_percent or 0),
                "started_at": row.started_at.isoformat() if row.started_at else None,
                "completed_at": row.completed_at.isoformat() if row.completed_at else None,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            warnings_data = row.warnings
            if warnings_data:
                if isinstance(warnings_data, str):
                    try:
                        warnings_data = json.loads(warnings_data)
                    except (json.JSONDecodeError, TypeError):
                        warnings_data = []
                if isinstance(warnings_data, list):
                    for w in warnings_data:
                        if isinstance(w, dict) and "_metrics" in w:
                            build_entry["metrics"] = w["_metrics"]
                            break

            builds.append(build_entry)

    return GraphMetricsResponse(builds=builds)


@router.get("/base/{corpus_id}/graph/quality", response_model=GraphQualityResponse)
async def get_graph_quality(corpus_id: UUID) -> GraphQualityResponse:
    """图谱质量评估 (Paulheim, 2017)

    返回图谱的完整性、正确性和一致性量化指标：
    - 悬空边（source/target 不存在）
    - 孤立实体（零度节点）
    - 社区分配覆盖率
    - 实体置信度均值
    - 关系证据支持率
    - 综合质量评分 (0.0–1.0)
    """
    from ..graph.quality import validate_graph_quality

    async with AsyncSessionLocal() as db:
        report = await validate_graph_quality(db, corpus_id)
    return GraphQualityResponse(
        total_entities=report.total_entities,
        total_relations=report.total_relations,
        dangling_edges=report.dangling_edges,
        orphan_entities=report.orphan_entities,
        community_coverage=report.community_coverage,
        entity_confidence_avg=report.entity_confidence_avg,
        relation_evidence_ratio=report.relation_evidence_ratio,
        type_distribution=report.type_distribution,
        quality_score=report.quality_score,
    )


@router.post(
    "/base/{corpus_id}/graph/multi_hop_reason",
    response_model=MultiHopReasonResponse,
)
async def multi_hop_reason_knowledge_graph(
    corpus_id: UUID,
    payload: MultiHopReasonRequest,
) -> MultiHopReasonResponse:
    """多跳推理 + Provenance 证据链（G4）

    流水线：seed 抽取（若未提供）→ Personalized PageRank → top-K → 反向追溯
    最短路径并组装三元组证据链。
    """
    import json
    import re
    import time

    from sqlalchemy import text as sa_text

    from negentropy.models.base import NEGENTROPY_SCHEMA

    from ..graph.graph_algorithms import compute_personalized_pagerank
    from ..graph.provenance import ProvenanceBuilder, evidence_chain_to_dict

    start = time.time()

    seeds: list[str]
    if payload.seed_entities:
        seeds = list(payload.seed_entities)
    else:
        candidates: set[str] = set()
        for match in re.findall(r"\b[A-Z][a-zA-Z0-9_-]+\b", payload.query):
            candidates.add(match)
        for match in re.findall(r"[一-鿿][一-鿿\w]{1,29}", payload.query):
            candidates.add(match)
        for match in re.findall(r"[\"“「]([^\"”」]+)[\"”」]", payload.query):
            candidates.add(match.strip())
        seeds = sorted(candidates)

    logger.info(
        "api_multi_hop_reason_started",
        corpus_id=str(corpus_id),
        query=payload.query[:80],
        seed_count=len(seeds),
    )

    async with AsyncSessionLocal() as db:
        if not seeds:
            logger.info("multi_hop_reason_no_seeds_fallback", corpus_id=str(corpus_id))
            return MultiHopReasonResponse(
                query=payload.query,
                seeds=[],
                answer_entities=[],
                evidence_chain=[],
                latency_ms=(time.time() - start) * 1000,
            )

        _UUID_RE = re.compile(r"[0-9a-fA-F]{32}|[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}")

        def _escape_like(pattern: str) -> str:
            return pattern.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")

        seed_ids: list[str] = []
        for s in seeds:
            cleaned = s.replace("entity:", "")
            if _UUID_RE.fullmatch(cleaned):
                seed_ids.append(cleaned)
                continue
            escaped = _escape_like(s)
            row = (
                await db.execute(
                    sa_text(f"""
                    SELECT id FROM {NEGENTROPY_SCHEMA}.kg_entities
                    WHERE corpus_id = :cid AND is_active = true
                      AND (name ILIKE :exact ESCAPE '\\' OR name ILIKE :prefix ESCAPE '\\')
                    ORDER BY (CASE WHEN name ILIKE :exact ESCAPE '\\' THEN 0 ELSE 1 END),
                             confidence DESC NULLS LAST
                    LIMIT 1
                """),
                    {"cid": str(corpus_id), "exact": escaped, "prefix": f"{escaped}%"},
                )
            ).first()
            if row is not None:
                seed_ids.append(str(row.id))

        if not seed_ids:
            try:
                async with AsyncSessionLocal() as _fb_db:
                    fb_emb_id, _ = await _resolve_corpus_model_ids(_fb_db, corpus_id)
                fb_embedding_fn = build_embedding_fn(fb_emb_id)
                fb_query_embedding = await fb_embedding_fn(payload.query)
                fb_graph_service = _get_graph_service()
                fb_hybrid = await fb_graph_service.search(
                    corpus_id=corpus_id,
                    app_name=_resolve_app_name(None),
                    query=payload.query,
                    query_embedding=fb_query_embedding,
                )
                for item in fb_hybrid.entities[:5]:
                    eid = item.entity.id.replace("entity:", "")
                    if eid and eid not in seed_ids:
                        seed_ids.append(eid)
                if seed_ids:
                    seeds = list(seed_ids)
                    logger.info(
                        "multi_hop_reason_seeds_from_hybrid_fallback",
                        corpus_id=str(corpus_id),
                        seed_count=len(seed_ids),
                    )
            except Exception as fb_exc:
                logger.warning(
                    "multi_hop_reason_hybrid_fallback_failed",
                    corpus_id=str(corpus_id),
                    error=str(fb_exc),
                )

        if not seed_ids:
            return MultiHopReasonResponse(
                query=payload.query,
                seeds=seeds,
                answer_entities=[],
                evidence_chain=[],
                latency_ms=(time.time() - start) * 1000,
            )

        ppr_scores = await compute_personalized_pagerank(db, corpus_id, seed_ids)
        if not ppr_scores:
            return MultiHopReasonResponse(
                query=payload.query,
                seeds=seeds,
                answer_entities=[],
                evidence_chain=[],
                latency_ms=(time.time() - start) * 1000,
            )

        seed_set_lc = {sid.lower() for sid in seed_ids}
        non_seed_ranked = sorted(
            ((eid, score) for eid, score in ppr_scores.items() if eid.lower() not in seed_set_lc),
            key=lambda kv: kv[1],
            reverse=True,
        )[: payload.top_k]

        builder = ProvenanceBuilder(max_chain_depth=payload.max_hops)
        chains = await builder.build(db, corpus_id, non_seed_ranked, seed_ids)

        answer_entities = [c.target_entity_id for c in chains]
        evidence_payload = [evidence_chain_to_dict(c) for c in chains]
        latency_ms = (time.time() - start) * 1000

        try:
            from uuid import uuid4

            top_entities_payload = [{"entity_id": eid, "score": float(score)} for eid, score in non_seed_ranked]
            await db.execute(
                sa_text(f"""
                    INSERT INTO {NEGENTROPY_SCHEMA}.kg_query_provenance
                        (id, corpus_id, query_text, seeds, top_entities,
                         evidence_chain, latency_ms)
                    VALUES (:id, :cid, :q, CAST(:seeds AS jsonb),
                            CAST(:tops AS jsonb), CAST(:chain AS jsonb), :lat)
                """),
                {
                    "id": str(uuid4()),
                    "cid": str(corpus_id),
                    "q": payload.query,
                    "seeds": json.dumps(seeds),
                    "tops": json.dumps(top_entities_payload),
                    "chain": json.dumps(evidence_payload),
                    "lat": latency_ms,
                },
            )
            await db.commit()
        except Exception as audit_exc:
            logger.warning(
                "multi_hop_reason_audit_persist_failed",
                corpus_id=str(corpus_id),
                error=str(audit_exc),
            )

    logger.info(
        "api_multi_hop_reason_completed",
        corpus_id=str(corpus_id),
        seed_count=len(seed_ids),
        top_k=len(chains),
    )

    return MultiHopReasonResponse(
        query=payload.query,
        seeds=seeds,
        answer_entities=answer_entities,
        evidence_chain=[
            MultiHopEvidenceChainItem(
                target_entity_id=e["target_entity_id"],
                target_label=e["target_label"],
                score=e["score"],
                seed_entity_id=e["seed_entity_id"],
                path=e["path"],
                edges=[MultiHopEvidenceEdgeItem(**ed) for ed in e["edges"]],
            )
            for e in evidence_payload
        ],
        latency_ms=latency_ms,
    )


@router.post(
    "/base/{corpus_id}/graph/global_search",
    response_model=GlobalSearchResponse,
)
async def global_search_knowledge_graph(
    corpus_id: UUID,
    payload: GlobalSearchRequest,
) -> GlobalSearchResponse:
    """GraphRAG Global Search Map-Reduce 全局问答（G1）

    用社区摘要回答"汇总性问题"（如"该语料库的核心主题是什么？"）。
    流水线：嵌入查询 → 余弦排序选 top_k 社区 → 并发 Map → Reduce 聚合。
    """
    from ..graph.global_search import GlobalSearchService

    logger.info(
        "api_global_search_started",
        corpus_id=str(corpus_id),
        query=payload.query[:80],
        max_communities=payload.max_communities,
    )

    async with AsyncSessionLocal() as db:
        embedding_config_id, llm_config_id = await _resolve_corpus_model_ids(db, corpus_id)

        embedding_fn = build_embedding_fn(embedding_config_id)
        query_embedding: list[float] | None = None
        try:
            query_embedding = await embedding_fn(payload.query)
        except Exception as exc:
            logger.warning("api_global_search_embedding_failed", error=str(exc))

        service = GlobalSearchService(
            max_communities=payload.max_communities,
            llm_config_id=llm_config_id,
        )

        result = await service.search(
            db,
            corpus_id=corpus_id,
            query=payload.query,
            query_embedding=query_embedding,
            max_communities=payload.max_communities,
        )

    logger.info(
        "api_global_search_completed",
        corpus_id=str(corpus_id),
        evidence=len(result.evidence),
        latency_ms=result.latency_ms,
        summaries_dirty=result.summaries_dirty,
    )

    return GlobalSearchResponse(
        query=result.query,
        answer=result.answer,
        evidence=[
            GlobalSearchEvidenceItem(
                community_id=e.community_id,
                partial_answer=e.partial_answer,
                similarity=e.similarity,
                top_entities=e.top_entities,
            )
            for e in result.evidence
        ],
        candidates_total=result.candidates_total,
        latency_ms=result.latency_ms,
        summaries_dirty=result.summaries_dirty,
    )


@router.get("/base/{corpus_id}/graph/subgraph", response_model=dict[str, Any])
async def get_corpus_subgraph(
    corpus_id: UUID,
    center_id: str = Query(..., description="BFS 起点实体 ID（含/不含 entity: 前缀）"),
    radius: int = Query(default=1, ge=1, le=3, description="BFS 半径（1-3 跳）"),
    limit: int = Query(default=200, ge=1, le=1000, description="节点数上限"),
    app_name: str | None = Query(default=None),
    as_of: datetime | None = Query(default=None, description="可选时态快照时刻"),
) -> dict[str, Any]:
    """获取以指定实体为锚点的子图（G2 Cytoscape 增量加载）"""
    resolved_app = _resolve_app_name(app_name)

    logger.debug(
        "api_get_subgraph",
        corpus_id=str(corpus_id),
        center_id=center_id,
        radius=radius,
        limit=limit,
        as_of=as_of.isoformat() if as_of else None,
    )

    graph_service = _get_graph_service()
    try:
        sub = await graph_service.get_subgraph(
            corpus_id=corpus_id,
            app_name=resolved_app,
            center_id=center_id,
            radius=radius,
            limit=limit,
            as_of=as_of,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"code": "INVALID_PARAM", "message": str(exc)}) from exc

    return {
        "center_id": center_id,
        "radius": radius,
        "nodes": [
            {
                "id": node.id,
                "label": node.label,
                "type": node.node_type,
                "importance": node.metadata.get("importance_score"),
                "community_id": node.metadata.get("community_id"),
                "metadata": node.metadata,
            }
            for node in sub.nodes
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
            for edge in sub.edges
        ],
    }


@router.get("/base/{corpus_id}/graph/timeline", response_model=GraphTimelineResponse)
async def get_graph_timeline(
    corpus_id: UUID,
    bucket: str = Query(
        default="day",
        pattern="^(day|week|month)$",
        description="时间桶粒度：day | week | month",
    ),
) -> GraphTimelineResponse:
    """获取关系时间轴密度直方图（G3 时间穿梭检索）"""
    logger.debug(
        "api_graph_timeline",
        corpus_id=str(corpus_id),
        bucket=bucket,
    )

    graph_service = _get_graph_service()
    points = await graph_service.get_relation_timeline(
        corpus_id=corpus_id,
        bucket=bucket,
    )

    return GraphTimelineResponse(
        corpus_id=corpus_id,
        bucket=bucket,
        points=[GraphTimelineBucket(**p) for p in points],
    )
