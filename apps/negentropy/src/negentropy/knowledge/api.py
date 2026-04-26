from __future__ import annotations

import json
import mimetypes
import urllib.parse
from io import BytesIO
from typing import TYPE_CHECKING, Any
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import ValidationError  # noqa: F401
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from negentropy.auth.deps import get_optional_user
from negentropy.auth.service import AuthUser
from negentropy.config import settings
from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.perception import Corpus, Knowledge, KnowledgeDocument
from negentropy.models.plugin import McpServer, McpTool
from negentropy.models.pulse import UserState

from .constants import (
    DEFAULT_KEYWORD_WEIGHT,
    DEFAULT_SEARCH_LIMIT,
    DEFAULT_SEMANTIC_WEIGHT,
)
from .dao import KnowledgeRunDao
from .embedding import build_batch_embedding_fn, build_embedding_fn
from .exceptions import (
    CorpusNotFound,
    DatabaseError,
    EmbeddingFailed,
    InvalidChunkSize,
    InvalidSearchConfig,
    KnowledgeError,
    SearchError,
    VersionConflict,
)
from .extraction import (
    extract_source,
    get_chunking_config_only,
    merge_corpus_config,
    resolve_source_kind,
    store_extracted_document_artifacts,
)
from .graph_service import GraphService, get_graph_service

# Phase 2-4: 生命周期管理 Schemas
from .lifecycle_schemas import (  # noqa: F401
    AssignDocumentRequest,
    CatalogTreeResponse,
    CategorySuggestionResponse,
    DocumentProvenanceResponse,
    WikiEntryContentResponse,
    WikiNavTreeResponse,
    WikiPublishActionResponse,
)
from .lifecycle_schemas import (
    CatalogCreateRequest as _CatalogCreateReq,
)
from .lifecycle_schemas import (
    CatalogNodeCreateRequest as _CatalogNodeCreateReq,
)
from .lifecycle_schemas import (
    CatalogNodeResponse as _CatalogNodeResp,
)
from .lifecycle_schemas import (
    CatalogNodeUpdateRequest as _CatalogNodeUpdateReq,
)
from .lifecycle_schemas import (
    CatalogResponse as _CatalogResp,
)
from .lifecycle_schemas import (
    CatalogUpdateRequest as _CatalogUpdateReq,
)
from .lifecycle_schemas import (
    CorpusQualityResponse as _CorpusQualityResp,
)
from .lifecycle_schemas import (
    CorpusVersionResponse as _CorpusVersionResp,
)
from .lifecycle_schemas import (
    DocSourceListResponse as _DocSourceListResp,
)
from .lifecycle_schemas import (
    DocSourceResponse as _DocSourceResp,
)
from .lifecycle_schemas import (
    SyncFromCatalogRequest as _SyncFromCatalogReq,
)
from .lifecycle_schemas import (
    SyncFromCatalogResponse as _SyncFromCatalogResp,
)
from .lifecycle_schemas import (
    # Phase 5: 统一检索与语料质量 Schemas
    UnifiedSearchRequest as _UnifiedSearchReq,
)
from .lifecycle_schemas import (
    UnifiedSearchResponse as _UnifiedSearchResp,
)
from .lifecycle_schemas import (
    WikiPublicationCreateRequest as _WikiPubCreateReq,
)
from .lifecycle_schemas import (
    WikiPublicationListResponse as _WikiPubListResp,
)
from .lifecycle_schemas import (
    WikiPublicationResponse as _WikiPubResp,
)
from .schemas import (  # noqa: F401
    ApiStatsResponse,
    ArchiveSourceRequest,
    ArchiveSourceResponse,
    AsyncPipelineResponse,
    CorpusCreateRequest,
    CorpusResponse,
    CorpusUpdateRequest,
    DashboardResponse,
    DeleteSourceRequest,
    DeleteSourceResponse,
    DocumentActionRequest,
    DocumentChunkDetailResponse,
    DocumentChunksResponse,
    DocumentChunkUpdateRequest,
    DocumentDetailResponse,
    DocumentListResponse,
    DocumentMarkdownRefreshRequest,
    DocumentMarkdownRefreshResponse,
    DocumentReplaceRequest,
    DocumentResponse,
    GraphBuildRequest,
    GraphBuildResponse,
    GraphNeighborsRequest,
    GraphPathRequest,
    GraphPayload,
    GraphSearchRequest,
    GraphSearchResponse,
    GraphUpsertRequest,
    IngestRequest,
    IngestUrlRequest,
    KnowledgePipelinesResponse,
    PipelineRunRecordResponse,
    PipelineStageResultResponse,
    PipelinesUpsertRequest,
    PipelineUpsertRecordResponse,
    PipelineUpsertResponse,
    RebuildSourceRequest,
    ReplaceSourceRequest,
    SearchRequest,
    SyncSourceRequest,
    _LegacyChunkingRequest,
)
from .service import KnowledgeService
from .types import (
    ChunkingConfig,
    CorpusSpec,
    GraphBuildConfig,
    GraphQueryConfig,
    SearchConfig,
    chunking_config_summary,
    normalize_chunking_config,
    normalize_source_metadata,
    serialize_chunking_config,
)

if TYPE_CHECKING:
    from .catalog_service import CatalogService
    from .corpus_engine import CorpusEngine
    from .retrieval import UnifiedRetrievalService
    from .types import KnowledgeRecord
    from .wiki_service import WikiPublishingService

logger = get_logger("negentropy.knowledge.api")
router = APIRouter(prefix="/knowledge", tags=["knowledge"])


def _normalize_pipeline_stage_payloads(
    stages: dict[str, Any] | None,
) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    for stage_name, stage_payload in (stages or {}).items():
        stage_data = dict(stage_payload or {})
        if "output" in stage_data and stage_data.get("output") is None:
            stage_data["output"] = {}
        normalized[stage_name] = stage_data
    return normalized


def _normalize_pipeline_run_payload(
    payload: dict[str, Any] | None,
) -> dict[str, Any]:
    normalized = dict(payload or {})
    if normalized.get("input") is None:
        normalized["input"] = {}
    if normalized.get("output") is None:
        normalized["output"] = {}
    if "stages" in normalized or payload:
        normalized["stages"] = _normalize_pipeline_stage_payloads(normalized.get("stages"))
    return normalized


_service: KnowledgeService | None = None
_dao: KnowledgeRunDao | None = None
_graph_service: GraphService | None = None


def _get_service() -> KnowledgeService:
    global _service
    if _service is None:
        _service = KnowledgeService(
            embedding_fn=build_embedding_fn(),
            batch_embedding_fn=build_batch_embedding_fn(),
            pipeline_dao=_get_dao(),
        )
    return _service


def _get_graph_service() -> GraphService:
    global _graph_service
    if _graph_service is None:
        _graph_service = get_graph_service()
    return _graph_service


def _get_dao() -> KnowledgeRunDao:
    global _dao
    if _dao is None:
        _dao = KnowledgeRunDao()
    return _dao


def _resolve_app_name(app_name: str | None) -> str:
    return app_name or settings.app_name


def _map_exception_to_http(exc: KnowledgeError) -> HTTPException:
    """将 Knowledge 异常映射到 HTTP 异常

    遵循 RESTful API 设计原则：
    - 400: 请求参数错误
    - 404: 资源不存在
    - 409: 版本冲突
    - 500: 服务器内部错误
    """
    if isinstance(exc, CorpusNotFound):
        logger.warning("corpus_not_found", details=exc.details)
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": exc.code, "message": str(exc), "details": exc.details},
        )

    if isinstance(exc, VersionConflict):
        logger.warning("version_conflict", details=exc.details)
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": exc.code, "message": str(exc), "details": exc.details},
        )

    if isinstance(exc, (InvalidChunkSize, InvalidSearchConfig)):
        logger.warning("validation_error", details=exc.details)
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": exc.code, "message": str(exc), "details": exc.details},
        )

    if isinstance(exc, (EmbeddingFailed, SearchError)):
        logger.error("infrastructure_error", details=exc.details)
        return HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": exc.code, "message": str(exc), "details": exc.details},
        )

    if isinstance(exc, DatabaseError):
        logger.error("database_error", details=exc.details)
        return HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": exc.code, "message": "Database operation failed", "details": exc.details},
        )

    # 默认 500 错误
    logger.error("unknown_knowledge_error", error=str(exc))
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail={"code": "INTERNAL_ERROR", "message": "An unexpected error occurred"},
    )


def _build_chunking_config(
    payload: dict[str, Any] | None,
) -> ChunkingConfig | None:
    if not payload:
        return None
    return normalize_chunking_config(payload)


def _resolve_chunking_option(
    request_value: Any,
    corpus_config: dict[str, Any],
    key: str,
) -> Any:
    if request_value is not None:
        return request_value
    return corpus_config.get(key)


def _extract_legacy_chunking_payload(payload: _LegacyChunkingRequest) -> dict[str, Any]:
    candidate = {
        "strategy": payload.strategy,
        "chunk_size": payload.chunk_size,
        "overlap": payload.overlap,
        "preserve_newlines": payload.preserve_newlines,
        "separators": payload.separators,
        "semantic_threshold": payload.semantic_threshold,
        "semantic_buffer_size": payload.semantic_buffer_size,
        "min_chunk_size": payload.min_chunk_size,
        "max_chunk_size": payload.max_chunk_size,
        "hierarchical_parent_chunk_size": payload.hierarchical_parent_chunk_size,
        "hierarchical_child_chunk_size": payload.hierarchical_child_chunk_size,
        "hierarchical_child_overlap": payload.hierarchical_child_overlap,
    }
    return {key: value for key, value in candidate.items() if value is not None}


def _resolve_chunking_config(
    *,
    chunking_config: dict[str, Any] | None,
    legacy_payload: dict[str, Any] | None,
    corpus_config: dict[str, Any],
) -> ChunkingConfig | None:
    if chunking_config:
        return normalize_chunking_config(chunking_config)
    if legacy_payload:
        strategy = legacy_payload.get("strategy") or corpus_config.get("strategy") or "recursive"
        merged = dict(corpus_config)
        merged.update(legacy_payload)
        merged["strategy"] = strategy
        return normalize_chunking_config(merged)
    if corpus_config:
        return normalize_chunking_config(get_chunking_config_only(corpus_config))
    return None


_MODELS_WHITELIST: frozenset[str] = frozenset({"llm_config_id", "embedding_config_id"})


def _serialize_corpus_config(config: dict[str, Any] | None) -> dict[str, Any]:
    serialized = merge_corpus_config(
        config, serialize_chunking_config(normalize_chunking_config(get_chunking_config_only(config)))
    )
    # 白名单过滤 models 子键；非 UUID 字符串提前 400。
    if isinstance(config, dict) and "models" in config:
        raw_models = config.get("models") or {}
        if raw_models is None:
            serialized.pop("models", None)
        elif not isinstance(raw_models, dict):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_CORPUS_CONFIG", "message": "config.models must be an object"},
            )
        else:
            clean: dict[str, Any] = {}
            for key, value in raw_models.items():
                if key not in _MODELS_WHITELIST:
                    continue
                if value is None or value == "":
                    continue
                try:
                    UUID(str(value))
                except (TypeError, ValueError) as exc:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail={
                            "code": "INVALID_CORPUS_CONFIG",
                            "message": f"config.models.{key} must be a UUID string",
                        },
                    ) from exc
                clean[key] = str(value)
            if clean:
                serialized["models"] = clean
            else:
                serialized.pop("models", None)
    return serialized


async def _validate_models_references(models: dict[str, Any] | None) -> dict[str, dict[str, Any]]:
    """校验 config.models 引用的 model_configs 行存在且类型匹配；返回 {key: row_dict}。

    返回结构供调用方（例如 update_corpus）用于比较维度变更。
    """
    if not models:
        return {}

    from negentropy.models.model_config import ModelConfig, ModelType

    key_to_type = {"llm_config_id": ModelType.LLM, "embedding_config_id": ModelType.EMBEDDING}
    resolved: dict[str, dict[str, Any]] = {}
    async with AsyncSessionLocal() as db:
        for key, expected_type in key_to_type.items():
            raw = models.get(key)
            if not raw:
                continue
            try:
                mc_id = UUID(str(raw))
            except (TypeError, ValueError) as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"code": "INVALID_CORPUS_CONFIG", "message": f"config.models.{key} invalid UUID"},
                ) from exc
            row = (await db.execute(select(ModelConfig).where(ModelConfig.id == mc_id))).scalar_one_or_none()
            if row is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "code": "MODEL_CONFIG_NOT_FOUND",
                        "message": f"config.models.{key} 引用的 model_config 不存在",
                    },
                )
            row_type = row.model_type.value if hasattr(row.model_type, "value") else str(row.model_type)
            if row_type != expected_type.value:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "code": "MODEL_TYPE_MISMATCH",
                        "message": f"config.models.{key} 引用 model_type={row_type}，应为 {expected_type.value}",
                    },
                )
            if not row.enabled:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "code": "MODEL_CONFIG_DISABLED",
                        "message": f"config.models.{key} 引用的 model_config 已禁用",
                    },
                )
            resolved[key] = {
                "id": str(row.id),
                "model_type": row_type,
                "vendor": row.vendor,
                "model_name": row.model_name,
                "config": dict(row.config or {}),
            }
    return resolved


def _extract_dimension_from_row_config(row_config: dict[str, Any] | None) -> int | None:
    """从 model_configs.config JSONB 中取 `dimensions`；非正整数视为未登记。"""
    if not isinstance(row_config, dict):
        return None
    raw = row_config.get("dimensions")
    if raw is None:
        return None
    try:
        val = int(raw)
    except (TypeError, ValueError):
        return None
    return val if val > 0 else None


async def _resolve_embedding_dimension(config_id: str | None) -> int | None:
    """按 model_configs.id 查询 embedding 模型的 dimensions；不存在则 None。"""
    if not config_id:
        return None
    try:
        mc_id = UUID(str(config_id))
    except (TypeError, ValueError):
        return None
    from negentropy.models.model_config import ModelConfig

    async with AsyncSessionLocal() as db:
        row = (await db.execute(select(ModelConfig).where(ModelConfig.id == mc_id))).scalar_one_or_none()
        if row is None:
            return None
        return _extract_dimension_from_row_config(dict(row.config or {}))


async def _enqueue_embedding_rebuild(
    *,
    background_tasks: BackgroundTasks,
    service: Any,
    corpus_id: UUID,
    app_name: str,
    corpus_config: dict[str, Any],
) -> dict[str, Any]:
    """对 Corpus 下所有 distinct source_uri 触发 rebuild_source 流水线。

    返回 `{count, run_ids}` 作为 `CorpusResponse.rebuild_triggered`。
    """
    async with AsyncSessionLocal() as db:
        rows = (
            await db.execute(
                select(Knowledge.source_uri)
                .where(Knowledge.corpus_id == corpus_id, Knowledge.source_uri.is_not(None))
                .distinct()
            )
        ).all()
    source_uris = [r[0] for r in rows if r[0]]

    chunking_config = _resolve_chunking_config(
        chunking_config=None,
        legacy_payload=None,
        corpus_config=corpus_config,
    )

    run_ids: list[str] = []
    for source_uri in source_uris:
        run_id = await service.create_pipeline(
            app_name=app_name,
            operation="rebuild_source",
            input_data={
                "corpus_id": str(corpus_id),
                "source_uri": source_uri,
                "chunking_config": chunking_config_summary(chunking_config),
                "trigger": "embedding_model_changed",
            },
        )
        background_tasks.add_task(
            service.execute_rebuild_source_pipeline,
            run_id=run_id,
            corpus_id=corpus_id,
            app_name=app_name,
            source_uri=source_uri,
            chunking_config=chunking_config,
        )
        run_ids.append(run_id)

    logger.info(
        "corpus_embedding_rebuild_enqueued",
        corpus_id=str(corpus_id),
        app_name=app_name,
        count=len(run_ids),
    )
    return {"count": len(run_ids), "run_ids": run_ids}


def _has_explicit_extractor_routes(config: dict[str, Any] | None) -> bool:
    return isinstance(config, dict) and "extractor_routes" in config


async def _resolve_default_extractor_routes() -> dict[str, Any]:
    default_routes = settings.knowledge.default_extractor_routes.model_dump(mode="python")
    resolved_routes: dict[str, Any] = {
        "url": {"targets": []},
        "file_pdf": {"targets": []},
    }
    candidates: list[tuple[str, int, dict[str, Any]]] = []
    server_names: set[str] = set()

    for route_key in ("url", "file_pdf"):
        route_config = default_routes.get(route_key) or {}
        for priority, slot_key in enumerate(("primary", "secondary")):
            target = route_config.get(slot_key)
            if not isinstance(target, dict) or target.get("enabled") is False:
                continue
            server_name = str(target.get("server_name") or "").strip()
            tool_name = str(target.get("tool_name") or "").strip()
            if not server_name or not tool_name:
                continue
            server_names.add(server_name)
            candidates.append((route_key, priority, target))

    if not candidates:
        return resolved_routes

    async with AsyncSessionLocal() as db:
        server_rows = (
            await db.execute(
                select(McpServer.id, McpServer.name).where(
                    McpServer.name.in_(server_names), McpServer.is_enabled.is_(True)
                )
            )
        ).all()
        servers_by_name = {name: server_id for server_id, name in server_rows}

        server_ids = [server_id for server_id, _ in server_rows]
        enabled_tools_by_server: dict[tuple[str, str], bool] = {}
        if server_ids:
            tool_rows = (
                await db.execute(
                    select(McpTool.server_id, McpTool.name).where(
                        McpTool.server_id.in_(server_ids), McpTool.is_enabled.is_(True)
                    )
                )
            ).all()
            enabled_tools_by_server = {(str(server_id), tool_name): True for server_id, tool_name in tool_rows}

    for route_key, priority, target in candidates:
        server_name = str(target["server_name"]).strip()
        tool_name = str(target["tool_name"]).strip()
        server_id = servers_by_name.get(server_name)
        if not server_id:
            logger.warning(
                "knowledge_default_extractor_server_not_found",
                route_key=route_key,
                server_name=server_name,
                tool_name=tool_name,
            )
            continue

        if not enabled_tools_by_server.get((str(server_id), tool_name)):
            logger.warning(
                "knowledge_default_extractor_tool_not_found",
                route_key=route_key,
                server_name=server_name,
                tool_name=tool_name,
            )
            continue

        resolved_routes[route_key]["targets"].append(
            {
                "server_id": str(server_id),
                "tool_name": tool_name,
                "priority": priority,
                "enabled": True,
                **({"timeout_ms": int(target["timeout_ms"])} if target.get("timeout_ms") is not None else {}),
                **(
                    {"tool_options": target["tool_options"]}
                    if isinstance(target.get("tool_options"), dict) and target["tool_options"]
                    else {}
                ),
            }
        )

    return resolved_routes


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(app_name: str | None = Query(default=None)) -> DashboardResponse:
    resolved_app = _resolve_app_name(app_name)
    dao = _get_dao()
    pipeline_runs = [
        (run.payload or {}) | {"run_id": run.run_id, "status": run.status, "version": run.version}
        for run in await dao.list_pipeline_runs(resolved_app, limit=10)
    ]
    alerts = []
    async with AsyncSessionLocal() as db:
        corpus_count = await db.scalar(select(func.count()).select_from(Corpus).where(Corpus.app_name == resolved_app))
        knowledge_count = await db.scalar(
            select(func.count()).select_from(Knowledge).where(Knowledge.app_name == resolved_app)
        )
        last_build_at = await db.scalar(
            select(func.max(Knowledge.updated_at)).where(Knowledge.app_name == resolved_app)
        )

    return DashboardResponse(
        corpus_count=corpus_count or 0,
        knowledge_count=knowledge_count or 0,
        last_build_at=last_build_at.isoformat() if last_build_at else None,
        pipeline_runs=pipeline_runs or [],
        alerts=alerts or [],
    )


@router.get("/base", response_model=list[CorpusResponse])
async def list_corpora(app_name: str | None = Query(default=None)) -> list[CorpusResponse]:
    resolved_app = _resolve_app_name(app_name)
    async with AsyncSessionLocal() as db:
        stmt = (
            select(Corpus, func.count(Knowledge.id))
            .outerjoin(Knowledge, Knowledge.corpus_id == Corpus.id)
            .where(Corpus.app_name == resolved_app)
            .group_by(Corpus.id)
            .order_by(Corpus.created_at.desc())
        )
        result = await db.execute(stmt)
        rows = result.all()

    return [
        CorpusResponse(
            id=corpus.id,
            app_name=corpus.app_name,
            name=corpus.name,
            description=corpus.description,
            config=_serialize_corpus_config(corpus.config or None),
            knowledge_count=count or 0,
        )
        for corpus, count in rows
    ]


@router.post("/base", response_model=CorpusResponse)
async def create_corpus(payload: CorpusCreateRequest) -> CorpusResponse:
    service = _get_service()
    request_config = dict(payload.config or {})
    if not _has_explicit_extractor_routes(request_config):
        request_config["extractor_routes"] = await _resolve_default_extractor_routes()
    normalized_config = _serialize_corpus_config(request_config)
    spec = CorpusSpec(
        app_name=_resolve_app_name(payload.app_name),
        name=payload.name,
        description=payload.description,
        config=normalized_config,
    )
    corpus = await service.ensure_corpus(spec=spec)
    return CorpusResponse(
        id=corpus.id,
        app_name=corpus.app_name,
        name=corpus.name,
        description=corpus.description,
        config=_serialize_corpus_config(corpus.config or None),
        knowledge_count=0,
    )


@router.get("/base/{corpus_id}", response_model=CorpusResponse)
async def get_corpus(corpus_id: UUID, app_name: str | None = Query(default=None)) -> CorpusResponse:
    resolved_app = _resolve_app_name(app_name)
    async with AsyncSessionLocal() as db:
        stmt = (
            select(Corpus, func.count(Knowledge.id))
            .outerjoin(Knowledge, Knowledge.corpus_id == Corpus.id)
            .where(Corpus.id == corpus_id, Corpus.app_name == resolved_app)
            .group_by(Corpus.id)
        )
        result = await db.execute(stmt)
        row = result.first()

    if not row:
        raise HTTPException(status_code=404, detail="Corpus not found")

    corpus, count = row
    return CorpusResponse(
        id=corpus.id,
        app_name=corpus.app_name,
        name=corpus.name,
        description=corpus.description,
        config=_serialize_corpus_config(corpus.config or None),
        knowledge_count=count or 0,
    )


@router.patch("/base/{corpus_id}", response_model=CorpusResponse)
async def update_corpus(
    corpus_id: UUID,
    payload: CorpusUpdateRequest,
    background_tasks: BackgroundTasks,
) -> CorpusResponse:
    service = _get_service()
    update_data = payload.model_dump(exclude_unset=True)
    if "config" in update_data:
        update_data["config"] = _serialize_corpus_config(update_data["config"] or None)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # 捕获旧配置并校验新 models 引用；用于判定 Embedding 维度是否变化。
    old_corpus = await service.get_corpus_by_id(corpus_id)
    old_config = dict(old_corpus.config or {}) if old_corpus else {}
    old_models = old_config.get("models") if isinstance(old_config, dict) else None
    old_embedding_id = (
        str(old_models.get("embedding_config_id"))
        if isinstance(old_models, dict) and old_models.get("embedding_config_id")
        else None
    )

    new_config = update_data.get("config") if "config" in update_data else None
    new_models = (new_config or {}).get("models") if isinstance(new_config, dict) else None
    new_resolved = await _validate_models_references(new_models)
    new_embedding_id = (
        str(new_models.get("embedding_config_id"))
        if isinstance(new_models, dict) and new_models.get("embedding_config_id")
        else None
    )

    try:
        corpus = await service.update_corpus(corpus_id=corpus_id, spec=update_data)

        async with AsyncSessionLocal() as db:
            knowledge_count = await db.scalar(
                select(func.count()).select_from(Knowledge).where(Knowledge.corpus_id == corpus.id)
            )

        rebuild_triggered: dict[str, Any] | None = None
        # 仅当 config.models 显式参与更新时评估维度变化；否则跳过以免无谓查询。
        if "config" in update_data and old_embedding_id != new_embedding_id and (knowledge_count or 0) > 0:
            old_dim = await _resolve_embedding_dimension(old_embedding_id) if old_embedding_id else None
            new_dim: int | None = None
            if new_embedding_id:
                new_row = new_resolved.get("embedding_config_id") or {}
                new_dim = _extract_dimension_from_row_config(new_row.get("config") or {})
            # 维度差异或单边切换视为维度变化；若两端维度均未显式登记则按保守策略不触发。
            dim_changed = old_dim is not None and new_dim is not None and old_dim != new_dim
            if dim_changed:
                rebuild_triggered = await _enqueue_embedding_rebuild(
                    background_tasks=background_tasks,
                    service=service,
                    corpus_id=corpus.id,
                    app_name=corpus.app_name,
                    corpus_config=dict(corpus.config or {}),
                )

        return CorpusResponse(
            id=corpus.id,
            app_name=corpus.app_name,
            name=corpus.name,
            description=corpus.description,
            config=_serialize_corpus_config(corpus.config or None),
            knowledge_count=knowledge_count or 0,
            rebuild_triggered=rebuild_triggered,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "CONTENT_FETCH_FAILED", "message": str(exc)},
        ) from exc
    except KnowledgeError as exc:
        raise _map_exception_to_http(exc) from exc


@router.delete("/base/{corpus_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_corpus(corpus_id: UUID, app_name: str | None = Query(default=None)) -> None:
    """删除语料库及其所有知识块

    级联删除: 删除 Corpus 时同时删除所有关联的 Knowledge 记录。
    """
    resolved_app = _resolve_app_name(app_name)

    async with AsyncSessionLocal() as db:
        stmt = select(Corpus).where(Corpus.id == corpus_id, Corpus.app_name == resolved_app)
        result = await db.execute(stmt)
        corpus = result.scalar_one_or_none()

        if not corpus:
            raise HTTPException(status_code=404, detail="Corpus not found")

        # 记录将被级联删除的 Knowledge 数量（审计可追溯性）
        knowledge_count = await db.scalar(
            select(func.count()).select_from(Knowledge).where(Knowledge.corpus_id == corpus_id)
        )

        await db.delete(corpus)
        await db.commit()

    logger.info(
        "corpus_deleted",
        corpus_id=str(corpus_id),
        app_name=resolved_app,
        knowledge_count=knowledge_count or 0,
    )


@router.post("/base/{corpus_id}/ingest", response_model=AsyncPipelineResponse)
async def ingest_text(
    corpus_id: UUID,
    payload: IngestRequest,
    background_tasks: BackgroundTasks,
) -> AsyncPipelineResponse:
    """异步索引文本到知识库

    立即返回 run_id，实际处理在后台执行。
    可在 Pipeline 页面查看进度。
    """
    resolved_app = _resolve_app_name(payload.app_name)

    logger.info(
        "api_ingest_started",
        corpus_id=str(corpus_id),
        app_name=resolved_app,
        text_length=len(payload.text),
        source_uri=payload.source_uri,
    )

    try:
        service = _get_service()

        # 获取 corpus 配置作为基础（Single Source of Truth）
        corpus = await service.get_corpus_by_id(corpus_id)
        corpus_config = corpus.config if corpus else {}

        chunking_config = _resolve_chunking_config(
            chunking_config=payload.chunking_config,
            legacy_payload=_extract_legacy_chunking_payload(payload),
            corpus_config=corpus_config,
        )

        # 创建 Pipeline 记录
        run_id = await service.create_pipeline(
            app_name=resolved_app,
            operation="ingest_text",
            input_data={
                "corpus_id": str(corpus_id),
                "source_uri": payload.source_uri,
                "text_length": len(payload.text),
                "chunking_config": chunking_config_summary(chunking_config),
            },
        )

        # 添加后台任务
        background_tasks.add_task(
            service.execute_ingest_text_pipeline,
            run_id=run_id,
            corpus_id=corpus_id,
            app_name=resolved_app,
            text=payload.text,
            source_uri=payload.source_uri,
            metadata=payload.metadata,
            chunking_config=chunking_config,
        )

        logger.info(
            "api_ingest_queued",
            corpus_id=str(corpus_id),
            run_id=run_id,
        )

        return AsyncPipelineResponse(
            run_id=run_id,
            status="running",
            message="Ingest task started. Check Pipeline page for progress.",
        )

    except KnowledgeError as exc:
        raise _map_exception_to_http(exc) from exc
    except ValidationError as exc:
        logger.warning("pydantic_validation_error", errors=exc.errors())
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": "Invalid request parameters", "errors": exc.errors()},
        ) from exc


@router.get("/base/{corpus_id}/knowledge")
async def list_knowledge(
    corpus_id: UUID,
    app_name: str | None = Query(default=None),
    source_uri: str | None = Query(default=None),
    include_archived: bool = Query(default=False),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    """列出知识库中的知识条目

    Args:
        corpus_id: 知识库 ID
        app_name: 应用名称
        source_uri: 可选的来源 URI 过滤，传入 "__null__" 表示筛选无来源的条目
        limit: 分页大小（1-100）
        offset: 偏移量

    Returns:
        Dict: {
            "count": 符合条件的总数,
            "items": 当前页的知识条目,
            "source_stats": {"source_uri": count, ...} 全局统计
        }
    """
    resolved_app = _resolve_app_name(app_name)
    service = _get_service()

    knowledge_items, total_count, source_stats, source_summaries = await service.list_knowledge(
        corpus_id=corpus_id,
        app_name=resolved_app,
        source_uri=source_uri,
        include_archived=include_archived,
        limit=limit,
        offset=offset,
    )

    return {
        "count": total_count,
        "items": [
            {
                "id": str(item.id),
                "content": item.content,  # Content preview handled by frontend if needed
                "source_uri": item.source_uri,
                "created_at": item.created_at,
                "chunk_index": item.chunk_index,
                "metadata": item.metadata,
            }
            for item in knowledge_items
        ],
        "source_stats": source_stats,
        "source_summaries": [
            {
                "source_uri": summary.source_uri,
                "display_name": summary.display_name,
                "count": summary.count,
                "archived": summary.archived,
                "source_type": summary.source_type,
            }
            for summary in source_summaries
        ],
    }


@router.post("/base/{corpus_id}/ingest_url", response_model=AsyncPipelineResponse)
async def ingest_url(
    corpus_id: UUID,
    payload: IngestUrlRequest,
    background_tasks: BackgroundTasks,
    user: AuthUser | None = Depends(get_optional_user),
) -> AsyncPipelineResponse:
    """异步从 URL 获取内容并摄入知识库

    立即返回 run_id，实际处理在后台执行。
    可在 Pipeline 页面查看进度。
    """
    resolved_app = _resolve_app_name(payload.app_name)

    logger.info(
        "api_ingest_url_started",
        corpus_id=str(corpus_id),
        app_name=resolved_app,
        url=payload.url,
    )

    try:
        service = _get_service()

        # 获取 corpus 配置作为基础（Single Source of Truth）
        corpus = await service.get_corpus_by_id(corpus_id)
        corpus_config = corpus.config if corpus else {}

        chunking_config = _resolve_chunking_config(
            chunking_config=payload.chunking_config,
            legacy_payload=_extract_legacy_chunking_payload(payload),
            corpus_config=corpus_config,
        )

        # URL 文档模式: 先创建 Pipeline 记录，提取和存储全部在后台完成
        if payload.as_document:
            run_id = await service.create_pipeline(
                app_name=resolved_app,
                operation="ingest_url",
                input_data={
                    "corpus_id": str(corpus_id),
                    "url": payload.url,
                    "as_document": True,
                    "chunking_config": chunking_config_summary(chunking_config),
                },
            )

            background_tasks.add_task(
                service.execute_ingest_url_document_pipeline,
                run_id=run_id,
                corpus_id=corpus_id,
                app_name=resolved_app,
                url=payload.url,
                chunking_config=chunking_config,
                user_id=user.user_id if user else None,
            )

            logger.info(
                "api_ingest_url_document_queued",
                corpus_id=str(corpus_id),
                run_id=run_id,
            )

            return AsyncPipelineResponse(
                run_id=run_id,
                status="running",
                message="URL ingest task started. Check Pipeline page for progress.",
            )

        # 默认 URL 摄取模式: 与旧逻辑一致
        # 创建 Pipeline 记录
        run_id = await service.create_pipeline(
            app_name=resolved_app,
            operation="ingest_url",
            input_data={
                "corpus_id": str(corpus_id),
                "url": payload.url,
                "chunking_config": chunking_config_summary(chunking_config),
            },
        )

        # 添加后台任务
        background_tasks.add_task(
            service.execute_ingest_url_pipeline,
            run_id=run_id,
            corpus_id=corpus_id,
            app_name=resolved_app,
            url=payload.url,
            metadata=payload.metadata,
            chunking_config=chunking_config,
        )

        logger.info(
            "api_ingest_url_queued",
            corpus_id=str(corpus_id),
            run_id=run_id,
        )

        return AsyncPipelineResponse(
            run_id=run_id,
            status="running",
            message="URL ingest task started. Check Pipeline page for progress.",
        )

    except KnowledgeError as exc:
        raise _map_exception_to_http(exc) from exc
    except ValidationError as exc:
        logger.warning("pydantic_validation_error", errors=exc.errors())
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": "Invalid request parameters", "errors": exc.errors()},
        ) from exc


# 文件大小限制 (50MB)
MAX_FILE_SIZE = 50 * 1024 * 1024


async def _extract_and_store_document_markdown_from_gcs(
    *,
    document_id: UUID,
) -> None:
    """从 GCS 重新加载原始文档，通过 MCP Tool 提取 Markdown 并刷新存储。

    与 ingest pipeline 共用同一条 MCP Tool 提取路径（extract_source），
    确保 Document View 的 Markdown 内容与 Chunk 内容质量一致。
    """
    from negentropy.storage.service import DocumentStorageService

    storage_service = DocumentStorageService()
    doc = await storage_service.get_document(document_id=document_id)
    if not doc:
        logger.warning(
            "document_markdown_refresh_skipped_document_not_found",
            document_id=str(document_id),
        )
        return

    content = await storage_service.get_document_content(document_id=document_id)
    if not content:
        await storage_service.update_markdown_extraction_status(
            document_id=document_id,
            status="failed",
            error="Source document content not found in GCS",
        )
        return

    await storage_service.update_markdown_extraction_status(
        document_id=document_id,
        status="processing",
        error=None,
    )

    try:
        service = _get_service()
        corpus_config = await service._get_corpus_config(doc.corpus_id)
        source_kind = resolve_source_kind(
            filename=doc.original_filename,
            content_type=doc.content_type,
        )
        result = await extract_source(
            app_name=doc.app_name,
            corpus_id=doc.corpus_id,
            corpus_config=corpus_config,
            source_kind=source_kind,
            content=content,
            filename=doc.original_filename,
            content_type=doc.content_type,
        )

        markdown_content = (result.markdown_content or "").strip()
        if not markdown_content:
            raise ValueError("Extractor returned empty markdown content")

        markdown_gcs_uri, _ = await store_extracted_document_artifacts(
            document_id=document_id,
            extracted=result,
        )
        logger.info(
            "document_markdown_extraction_completed",
            document_id=str(document_id),
            markdown_size=len(markdown_content),
            markdown_gcs_uri=markdown_gcs_uri,
        )
    except Exception as exc:  # noqa: BLE001 - 后台任务需兜底并可观测
        logger.error(
            "document_markdown_extraction_failed",
            document_id=str(document_id),
            error=str(exc),
        )
        await storage_service.update_markdown_extraction_status(
            document_id=document_id,
            status="failed",
            error=str(exc),
        )


@router.post("/base/{corpus_id}/ingest_file", response_model=AsyncPipelineResponse)
async def ingest_file(
    corpus_id: UUID,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    app_name: str | None = Form(default=None),
    source_uri: str | None = Form(default=None),
    metadata: str | None = Form(default=None),
    strategy: str | None = Form(default=None),
    chunk_size: int | None = Form(default=None),
    overlap: int | None = Form(default=None),
    preserve_newlines: bool | None = Form(default=None),
    separators: str | None = Form(default=None),
    semantic_threshold: float | None = Form(default=None),
    semantic_buffer_size: int | None = Form(default=None),
    min_chunk_size: int | None = Form(default=None),
    max_chunk_size: int | None = Form(default=None),
    hierarchical_parent_chunk_size: int | None = Form(default=None),
    hierarchical_child_chunk_size: int | None = Form(default=None),
    hierarchical_child_overlap: int | None = Form(default=None),
    store_to_gcs: bool = Form(default=True),
    user: AuthUser | None = Depends(get_optional_user),
) -> AsyncPipelineResponse:
    """从上传文件导入内容到知识库

    支持格式: .txt, .md, .markdown, .pdf

    流程:
    1. 验证文件类型和大小
    2. 检查重复（通过内容 Hash）
    3. 存储原始文件到 GCS（如果启用）
    4. 提取文本内容
    5. 调用 ingest_text 完成分块和向量化

    Args:
        corpus_id: 知识库 ID
        file: 上传的文件
        app_name: 应用名称（可选）
        source_uri: 来源 URI（可选，默认使用 GCS URI 或文件名）
        metadata: 元数据 JSON 字符串（可选）
        chunk_size: 分块大小（可选）
        overlap: 分块重叠（可选）
        preserve_newlines: 是否保留换行（可选）
        store_to_gcs: 是否存储原始文件到 GCS（默认 True）

    Returns:
        Dict: {"count": 分块数量, "items": [分块 ID 列表], "document_id": 文档 ID, "duplicate": 是否重复}

    Raises:
        400: 文件过大、类型不支持、解析失败等
        404: corpus 不存在
    """
    resolved_app = _resolve_app_name(app_name)

    logger.info(
        "api_ingest_file_started",
        corpus_id=str(corpus_id),
        app_name=resolved_app,
        filename=file.filename,
        content_type=file.content_type,
        store_to_gcs=store_to_gcs,
    )

    try:
        # 读取文件内容
        content = await file.read()

        # 文件大小验证
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "FILE_TOO_LARGE",
                    "message": f"File size exceeds limit ({MAX_FILE_SIZE / 1024 / 1024:.0f}MB)",
                    "size": len(content),
                    "max_size": MAX_FILE_SIZE,
                },
            )

        # 解析 metadata JSON
        meta: dict[str, Any] = {}
        if metadata:
            try:
                meta = json.loads(metadata)
            except json.JSONDecodeError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"code": "INVALID_METADATA", "message": "metadata must be valid JSON"},
                ) from exc

        parsed_separators: list[str] | None = None
        if separators:
            try:
                raw = json.loads(separators)
                if isinstance(raw, list):
                    parsed_separators = [str(item) for item in raw if str(item) != ""]
            except json.JSONDecodeError:
                parsed_separators = [item.strip() for item in separators.split(",") if item.strip()]

        from .content import sanitize_filename

        # 保留用于展示的原始文件名（仅去除路径前缀并限制长度）
        raw_filename = (file.filename or "unknown").split("/")[-1].split("\\")[-1][:255] or "unknown"
        # 清理文件名（用于安全相关场景）
        safe_filename = sanitize_filename(file.filename)

        # GCS 存储逻辑
        doc_record = None
        is_new_doc = True
        gcs_uri = None
        storage_service = None

        if store_to_gcs:
            from negentropy.storage.gcs_client import StorageError
            from negentropy.storage.service import DocumentStorageService

            try:
                storage_service = DocumentStorageService()
                doc_record, is_new_doc = await storage_service.upload_and_store(
                    corpus_id=corpus_id,
                    app_name=resolved_app,
                    content=content,
                    filename=raw_filename,
                    content_type=file.content_type,
                    metadata={"source": "ingest_file", "source_type": "file"},
                    created_by=getattr(user, "user_id", None),
                )
                gcs_uri = doc_record.gcs_uri

                logger.info(
                    "document_storage_completed",
                    corpus_id=str(corpus_id),
                    doc_id=str(doc_record.id),
                    is_new=is_new_doc,
                    gcs_uri=gcs_uri,
                )
            except StorageError as exc:
                logger.warning("gcs_storage_failed_proceeding_without_storage", error=str(exc))
                # 继续处理，但不存储到 GCS

        service = _get_service()
        corpus = await service.get_corpus_by_id(corpus_id)
        corpus_config = corpus.config if corpus else {}

        # GCS 存储的文件强制使用 gcs_uri 作为 source_uri（支持 Rebuild 功能）
        # 只有非 GCS 存储时才使用用户提供的 source_uri 或文件名
        if store_to_gcs and gcs_uri:
            final_source_uri = gcs_uri
        else:
            final_source_uri = source_uri or safe_filename

        chunking_config = _resolve_chunking_config(
            chunking_config=None,
            legacy_payload={
                key: value
                for key, value in {
                    "strategy": strategy,
                    "chunk_size": chunk_size,
                    "overlap": overlap,
                    "preserve_newlines": preserve_newlines,
                    "separators": parsed_separators,
                    "semantic_threshold": semantic_threshold,
                    "semantic_buffer_size": semantic_buffer_size,
                    "min_chunk_size": min_chunk_size,
                    "max_chunk_size": max_chunk_size,
                    "hierarchical_parent_chunk_size": hierarchical_parent_chunk_size,
                    "hierarchical_child_chunk_size": hierarchical_child_chunk_size,
                    "hierarchical_child_overlap": hierarchical_child_overlap,
                }.items()
                if value is not None
            },
            corpus_config=corpus_config,
        )

        # 添加文件元数据
        meta["original_filename"] = raw_filename
        meta["content_type"] = file.content_type
        meta["file_size"] = len(content)
        meta["source_type"] = "file"
        if gcs_uri:
            meta["gcs_uri"] = gcs_uri
        if doc_record:
            meta["document_id"] = str(doc_record.id)

        run_id = await service.create_pipeline(
            app_name=resolved_app,
            operation="ingest_file",
            input_data={
                "corpus_id": str(corpus_id),
                "source_uri": final_source_uri,
                "filename": raw_filename,
                "content_type": file.content_type,
                "file_size": len(content),
                "document_id": str(doc_record.id) if doc_record else None,
                "duplicate_document": (not is_new_doc) if doc_record else False,
                "chunking_config": chunking_config_summary(chunking_config),
            },
        )

        background_tasks.add_task(
            service.execute_ingest_file_pipeline,
            run_id=run_id,
            corpus_id=corpus_id,
            app_name=resolved_app,
            content=content,
            filename=raw_filename,
            content_type=file.content_type,
            source_uri=final_source_uri,
            metadata=meta,
            chunking_config=chunking_config,
            document_id=doc_record.id if doc_record else None,
        )

        logger.info(
            "api_ingest_file_queued",
            corpus_id=str(corpus_id),
            filename=file.filename,
            run_id=run_id,
            document_id=str(doc_record.id) if doc_record else None,
            duplicate_document=(not is_new_doc) if doc_record else False,
        )

        return AsyncPipelineResponse(
            run_id=run_id,
            status="running",
            message=(
                f"File ingest task started (document_id={doc_record.id}). Check Pipeline page for progress."
                if doc_record
                else "File ingest task started. Check Pipeline page for progress."
            ),
        )

    except ValueError as exc:
        logger.warning("file_parse_error", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "FILE_PARSE_ERROR", "message": str(exc)},
        ) from exc
    except KnowledgeError as exc:
        raise _map_exception_to_http(exc) from exc
    except ValidationError as exc:
        logger.warning("pydantic_validation_error", errors=exc.errors())
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": "Invalid request parameters", "errors": exc.errors()},
        ) from exc


# ============================================================================
# Document Management API
# ============================================================================


def _serialize_document_chunk_item(item: KnowledgeRecord, siblings: list[KnowledgeRecord]) -> dict[str, Any]:
    metadata = item.metadata or {}
    family_id = metadata.get("chunk_family_id")
    child_chunks = []
    if metadata.get("chunk_role") == "parent" and isinstance(family_id, str) and family_id:
        child_chunks = [
            {
                "id": str(candidate.id),
                "chunk_index": candidate.chunk_index,
                "character_count": candidate.character_count,
                "retrieval_count": candidate.retrieval_count,
                "display_retrieval_count": candidate.retrieval_count,
                "is_enabled": candidate.is_enabled,
                "content": candidate.content,
                "chunk_role": candidate.metadata.get("chunk_role", "leaf"),
                "parent_chunk_index": candidate.metadata.get("parent_chunk_index"),
                "child_chunk_index": candidate.metadata.get("child_chunk_index"),
                "chunk_family_id": candidate.metadata.get("chunk_family_id"),
                "metadata": candidate.metadata,
            }
            for candidate in siblings
            if candidate.metadata.get("chunk_role") == "child"
            and candidate.metadata.get("chunk_family_id") == family_id
        ]

    display_retrieval_count = item.retrieval_count
    if metadata.get("chunk_role") == "parent":
        display_retrieval_count = sum(child["retrieval_count"] for child in child_chunks)

    return {
        "id": str(item.id),
        "content": item.content,
        "source_uri": item.source_uri,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        "chunk_index": item.chunk_index,
        "character_count": item.character_count,
        "retrieval_count": item.retrieval_count,
        "display_retrieval_count": display_retrieval_count,
        "is_enabled": item.is_enabled,
        "chunk_role": metadata.get("chunk_role", "leaf"),
        "parent_chunk_index": metadata.get("parent_chunk_index"),
        "child_chunk_index": metadata.get("child_chunk_index"),
        "chunk_family_id": metadata.get("chunk_family_id"),
        "metadata": metadata,
        "child_chunks": child_chunks,
    }


def _build_document_chunk_metadata(doc: Any, items: list[KnowledgeRecord]) -> dict[str, Any]:
    chunk_stats = ((doc.metadata_ or {}).get("chunk_stats") or {}) if doc else {}
    total_retrieval_count = sum(item.retrieval_count for item in items)
    return {
        "original_filename": getattr(doc, "original_filename", None),
        "file_size": getattr(doc, "file_size", None),
        "upload_date": doc.created_at.isoformat() if getattr(doc, "created_at", None) else None,
        "last_update_date": doc.updated_at.isoformat() if getattr(doc, "updated_at", None) else None,
        "source": (doc.metadata_ or {}).get("source_type", "file") if doc else "file",
        "chunk_specification": chunk_stats.get("chunk_specification"),
        "chunk_length": chunk_stats.get("chunk_length"),
        "avg_paragraph_length": chunk_stats.get("avg_paragraph_length"),
        "paragraph_count": chunk_stats.get("paragraph_count", len(items)),
        "retrieval_count": total_retrieval_count,
        "embedding_time_ms": chunk_stats.get("embedding_time_ms"),
        "embedded_tokens": chunk_stats.get("embedded_tokens"),
    }


async def _resolve_user_display_names(user_ids: list[str]) -> dict[str, str]:
    """批量解析用户 ID 到显示名称（查询 UserState.state.profile.name）。"""
    if not user_ids:
        return {}
    name_map: dict[str, str] = {}
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(UserState).where(
                UserState.app_name == settings.app_name,
                UserState.user_id.in_(user_ids),
            )
        )
        for us in result.scalars().all():
            state = us.state or {}
            name = state.get("profile", {}).get("name")
            if name:
                name_map[us.user_id] = name
    return name_map


def _build_document_response(doc, name_map: dict[str, str]) -> DocumentResponse:
    """从 ORM 文档对象构建 DocumentResponse，注入用户显示名。"""
    return DocumentResponse(
        id=doc.id,
        corpus_id=doc.corpus_id,
        app_name=doc.app_name,
        file_hash=doc.file_hash,
        original_filename=doc.original_filename,
        gcs_uri=doc.gcs_uri,
        content_type=doc.content_type,
        file_size=doc.file_size,
        status=doc.status,
        created_at=doc.created_at.isoformat() if doc.created_at else None,
        created_by=doc.created_by,
        created_by_name=name_map.get(doc.created_by) if doc.created_by else None,
        markdown_extract_status=doc.markdown_extract_status,
        markdown_extracted_at=(doc.markdown_extracted_at.isoformat() if doc.markdown_extracted_at else None),
        markdown_extract_error=doc.markdown_extract_error,
        metadata=doc.metadata_ or {},
    )


@router.get("/base/{corpus_id}/documents", response_model=DocumentListResponse)
async def list_documents(
    corpus_id: UUID,
    app_name: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> DocumentListResponse:
    """列出语料库中的已上传文档

    Args:
        corpus_id: 知识库 ID
        app_name: 应用名称
        limit: 分页大小
        offset: 偏移量

    Returns:
        DocumentListResponse: 文档列表
    """
    resolved_app = _resolve_app_name(app_name)

    from negentropy.storage.service import DocumentStorageService

    storage_service = DocumentStorageService()
    docs, total = await storage_service.list_documents(
        corpus_id=corpus_id,
        app_name=resolved_app,
        limit=limit,
        offset=offset,
    )

    unique_user_ids = list({doc.created_by for doc in docs if doc.created_by})
    name_map = await _resolve_user_display_names(unique_user_ids)

    return DocumentListResponse(
        count=total,
        items=[_build_document_response(doc, name_map) for doc in docs],
    )


@router.get("/documents", response_model=DocumentListResponse)
async def list_all_documents(
    app_name: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> DocumentListResponse:
    """列出所有已上传文档（跨语料库）

    Args:
        app_name: 应用名称
        limit: 分页大小
        offset: 偏移量

    Returns:
        DocumentListResponse: 文档列表
    """
    resolved_app = _resolve_app_name(app_name)

    from negentropy.storage.service import DocumentStorageService

    storage_service = DocumentStorageService()
    docs, total = await storage_service.list_documents(
        corpus_id=None,
        app_name=resolved_app,
        limit=limit,
        offset=offset,
    )

    unique_user_ids = list({doc.created_by for doc in docs if doc.created_by})
    name_map = await _resolve_user_display_names(unique_user_ids)

    return DocumentListResponse(
        count=total,
        items=[_build_document_response(doc, name_map) for doc in docs],
    )


@router.get("/base/{corpus_id}/documents/{document_id}", response_model=DocumentDetailResponse)
async def get_document_detail(
    corpus_id: UUID,
    document_id: UUID,
    app_name: str | None = Query(default=None),
) -> DocumentDetailResponse:
    """获取单个文档详情（含 Markdown 正文）。"""
    resolved_app = _resolve_app_name(app_name)

    from negentropy.storage.service import DocumentStorageService

    storage_service = DocumentStorageService()
    doc = await storage_service.get_document(
        document_id=document_id,
        corpus_id=corpus_id,
        app_name=resolved_app,
    )

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )

    markdown_content = await storage_service.get_document_markdown(document_id)

    name_map = await _resolve_user_display_names([doc.created_by]) if doc.created_by else {}

    return DocumentDetailResponse(
        id=doc.id,
        corpus_id=doc.corpus_id,
        app_name=doc.app_name,
        file_hash=doc.file_hash,
        original_filename=doc.original_filename,
        gcs_uri=doc.gcs_uri,
        content_type=doc.content_type,
        file_size=doc.file_size,
        status=doc.status,
        created_at=doc.created_at.isoformat() if doc.created_at else None,
        created_by=doc.created_by,
        created_by_name=name_map.get(doc.created_by) if doc.created_by else None,
        markdown_extract_status=doc.markdown_extract_status,
        markdown_extracted_at=doc.markdown_extracted_at.isoformat() if doc.markdown_extracted_at else None,
        markdown_extract_error=doc.markdown_extract_error,
        metadata=doc.metadata_ or {},
        markdown_content=markdown_content,
        markdown_gcs_uri=doc.markdown_gcs_uri,
    )


@router.post(
    "/base/{corpus_id}/documents/{document_id}/refresh-markdown",
    response_model=DocumentMarkdownRefreshResponse,
    include_in_schema=False,
)
@router.post(
    "/base/{corpus_id}/documents/{document_id}/refresh_markdown",
    response_model=DocumentMarkdownRefreshResponse,
)
async def refresh_document_markdown(
    corpus_id: UUID,
    document_id: UUID,
    payload: DocumentMarkdownRefreshRequest,
    background_tasks: BackgroundTasks,
) -> DocumentMarkdownRefreshResponse:
    """从 GCS 源文档重新解析 Markdown 并刷新存储。"""
    resolved_app = _resolve_app_name(payload.app_name)

    from negentropy.storage.service import DocumentStorageService

    storage_service = DocumentStorageService()
    doc = await storage_service.get_document(
        document_id=document_id,
        corpus_id=corpus_id,
        app_name=resolved_app,
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )

    await storage_service.update_markdown_extraction_status(
        document_id=document_id,
        status="processing",
        error=None,
    )
    background_tasks.add_task(
        _extract_and_store_document_markdown_from_gcs,
        document_id=document_id,
    )

    return DocumentMarkdownRefreshResponse(
        document_id=document_id,
        status="running",
        message="Markdown re-parse task started",
    )


@router.delete("/base/{corpus_id}/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    corpus_id: UUID,
    document_id: UUID,
    app_name: str | None = Query(default=None),
    hard_delete: bool = Query(default=False),
) -> None:
    """删除文档

    Args:
        corpus_id: 知识库 ID
        document_id: 文档 ID
        app_name: 应用名称
        hard_delete: 是否同时删除 GCS 中的原始文件（默认软删除）
    """
    resolved_app = _resolve_app_name(app_name)

    from negentropy.storage.service import DocumentStorageService

    storage_service = DocumentStorageService()
    deleted = await storage_service.delete_document(
        document_id=document_id,
        corpus_id=corpus_id,
        app_name=resolved_app,
        soft_delete=not hard_delete,
    )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )


@router.get("/base/{corpus_id}/documents/{document_id}/download")
async def download_document(
    corpus_id: UUID,
    document_id: UUID,
    app_name: str | None = Query(default=None),
):
    """下载文档原始文件

    Args:
        corpus_id: 知识库 ID
        document_id: 文档 ID
        app_name: 应用名称

    Returns:
        StreamingResponse: 文件流（带 Content-Disposition 头）
    """
    resolved_app = _resolve_app_name(app_name)

    from negentropy.storage.gcs_client import StorageError
    from negentropy.storage.service import DocumentStorageService

    storage_service = DocumentStorageService()

    # 获取文档记录
    doc = await storage_service.get_document(
        document_id=document_id,
        corpus_id=corpus_id,
        app_name=resolved_app,
    )

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )

    metadata = doc.metadata_ or {}
    is_url_doc = metadata.get("source_type") == "url"

    # 下载文件内容
    try:
        if is_url_doc:
            markdown_text = await storage_service.get_document_markdown(document_id)
            if not markdown_text:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document markdown content not found"},
                )
            content = markdown_text.encode("utf-8")
        else:
            content = await storage_service.get_document_content(document_id)
            if content is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document content not found"},
                )
    except StorageError as exc:
        logger.error("document_download_failed", doc_id=str(document_id), error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "DOWNLOAD_FAILED", "message": "Failed to download document"},
        ) from exc

    # 编码文件名以支持中文
    filename = doc.original_filename
    if is_url_doc and not filename.lower().endswith(".md"):
        filename = f"{filename}.md"
    encoded_filename = urllib.parse.quote(filename)

    return StreamingResponse(
        BytesIO(content),
        media_type="text/markdown; charset=utf-8" if is_url_doc else (doc.content_type or "application/octet-stream"),
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
        },
    )


@router.get("/base/{corpus_id}/documents/{document_id}/assets/{asset_name:path}")
async def get_document_asset(
    corpus_id: UUID,
    document_id: UUID,
    asset_name: str,
    app_name: str | None = Query(default=None),
):
    """获取文档的衍生资产文件（图片等）。

    从 GCS 的 ``derived/{document_id}/assets/`` 路径下载指定资产并流式返回。
    资产内容不可变，设置长期缓存。
    """
    resolved_app = _resolve_app_name(app_name)

    from negentropy.storage.gcs_client import StorageError
    from negentropy.storage.service import DocumentStorageService

    storage_service = DocumentStorageService()

    doc = await storage_service.get_document(
        document_id=document_id,
        corpus_id=corpus_id,
        app_name=resolved_app,
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )

    # 取 filename 最后一段，防止路径穿越
    safe_filename = asset_name.split("/")[-1] if "/" in asset_name else asset_name
    if not safe_filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_ASSET_NAME", "message": "Asset name is empty"},
        )

    # 直接构造 GCS 路径并下载（避免第二次文档查询）
    gcs_path = DocumentStorageService._build_asset_gcs_path(
        app_name=doc.app_name,
        corpus_id=doc.corpus_id,
        document_id=doc.id,
        filename=safe_filename,
    )

    try:
        gcs_client = storage_service._get_gcs_client()
        gcs_uri = f"gs://{gcs_client._bucket_name}/{gcs_path}"
        content = gcs_client.download(gcs_uri)
    except (StorageError, ValueError) as exc:
        logger.warning(
            "asset_download_failed",
            doc_id=str(document_id),
            asset_name=safe_filename,
            error=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ASSET_NOT_FOUND", "message": "Requested asset not found"},
        ) from exc

    content_type = mimetypes.guess_type(safe_filename)[0] or "application/octet-stream"
    # 清洗 header 用文件名，防止注入
    header_filename = "".join(ch if ch.isalnum() or ch in ("-", "_", ".") else "_" for ch in safe_filename)

    return StreamingResponse(
        BytesIO(content),
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "Content-Disposition": f'inline; filename="{header_filename}"',
            "Content-Length": str(len(content)),
        },
    )


def _is_url_document(doc: Any) -> bool:
    metadata = doc.metadata_ or {}
    return metadata.get("source_type") == "url"


def _resolve_document_source_uri(doc: Any) -> str | None:
    metadata = doc.metadata_ or {}
    if metadata.get("source_type") == "url":
        origin_url = metadata.get("origin_url")
        if isinstance(origin_url, str) and origin_url:
            return origin_url
    if doc.gcs_uri:
        return doc.gcs_uri
    return None


def _resolve_chunking_config_from_doc_request(
    *,
    payload: DocumentActionRequest,
    corpus_config: dict[str, Any],
) -> ChunkingConfig | None:
    return _resolve_chunking_config(
        chunking_config=payload.chunking_config,
        legacy_payload=_extract_legacy_chunking_payload(payload),
        corpus_config=corpus_config,
    )


@router.get("/base/{corpus_id}/documents/{document_id}/chunks", response_model=DocumentChunksResponse)
async def list_document_chunks(
    corpus_id: UUID,
    document_id: UUID,
    app_name: str | None = Query(default=None),
    include_archived: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> DocumentChunksResponse:
    resolved_app = _resolve_app_name(app_name)
    from negentropy.storage.service import DocumentStorageService

    storage_service = DocumentStorageService()
    doc = await storage_service.get_document(
        document_id=document_id,
        corpus_id=corpus_id,
        app_name=resolved_app,
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )

    source_uri = _resolve_document_source_uri(doc)
    if not source_uri:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_DOCUMENT_SOURCE", "message": "Document source_uri not available"},
        )

    service = _get_service()
    # 获取该文档下全量 chunks（含 parent + child + leaf），用于 sibling 匹配
    all_items, _, _, _ = await service.list_knowledge(
        corpus_id=corpus_id,
        app_name=resolved_app,
        source_uri=source_uri,
        include_archived=include_archived,
        limit=10000,
        offset=0,
    )

    # 过滤顶层项：排除 child chunks（它们仅作为 parent 的嵌套子项显示）
    top_level_items = [item for item in all_items if (item.metadata or {}).get("chunk_role") != "child"]

    # Python 层分页
    total_top = len(top_level_items)
    paginated = top_level_items[offset : offset + limit]

    # 序列化：传入 all_items 作为 siblings，确保 parent 能匹配到 child
    serialized = [_serialize_document_chunk_item(item, all_items) for item in paginated]
    return DocumentChunksResponse(
        count=total_top,
        page=(offset // limit) + 1,
        page_size=limit,
        document_metadata=_build_document_chunk_metadata(doc, all_items),
        items=serialized,
    )


@router.get(
    "/base/{corpus_id}/documents/{document_id}/chunks/{chunk_id}",
    response_model=DocumentChunkDetailResponse,
)
async def get_document_chunk_detail(
    corpus_id: UUID,
    document_id: UUID,
    chunk_id: UUID,
    app_name: str | None = Query(default=None),
) -> DocumentChunkDetailResponse:
    resolved_app = _resolve_app_name(app_name)
    from negentropy.storage.service import DocumentStorageService

    storage_service = DocumentStorageService()
    doc = await storage_service.get_document(
        document_id=document_id,
        corpus_id=corpus_id,
        app_name=resolved_app,
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )

    service = _get_service()
    item = await service.get_knowledge_chunk(
        corpus_id=corpus_id,
        app_name=resolved_app,
        knowledge_id=chunk_id,
    )
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "CHUNK_NOT_FOUND", "message": "Chunk not found"},
        )

    siblings = [item]
    family_id = item.metadata.get("chunk_family_id")
    if isinstance(family_id, str) and family_id:
        siblings = await service._repository.list_knowledge_by_family(
            corpus_id=corpus_id,
            app_name=resolved_app,
            family_id=family_id,
            source_uri=item.source_uri,
        )

    return DocumentChunkDetailResponse(
        item=_serialize_document_chunk_item(item, siblings),
        document_metadata=_build_document_chunk_metadata(doc, siblings),
    )


@router.patch(
    "/base/{corpus_id}/documents/{document_id}/chunks/{chunk_id}",
    response_model=DocumentChunkDetailResponse,
)
async def update_document_chunk(
    corpus_id: UUID,
    document_id: UUID,
    chunk_id: UUID,
    payload: DocumentChunkUpdateRequest,
) -> DocumentChunkDetailResponse:
    resolved_app = _resolve_app_name(payload.app_name)
    from negentropy.storage.service import DocumentStorageService

    storage_service = DocumentStorageService()
    doc = await storage_service.get_document(
        document_id=document_id,
        corpus_id=corpus_id,
        app_name=resolved_app,
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )

    service = _get_service()
    item = await service.update_knowledge_chunk(
        corpus_id=corpus_id,
        app_name=resolved_app,
        knowledge_id=chunk_id,
        content=payload.content,
        is_enabled=payload.is_enabled,
    )
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "CHUNK_NOT_FOUND", "message": "Chunk not found"},
        )
    siblings = [item]
    family_id = item.metadata.get("chunk_family_id")
    if isinstance(family_id, str) and family_id:
        siblings = await service._repository.list_knowledge_by_family(
            corpus_id=corpus_id,
            app_name=resolved_app,
            family_id=family_id,
            source_uri=item.source_uri,
        )
    return DocumentChunkDetailResponse(
        item=_serialize_document_chunk_item(item, siblings),
        document_metadata=_build_document_chunk_metadata(doc, siblings),
    )


@router.post(
    "/base/{corpus_id}/documents/{document_id}/chunks/{chunk_id}/regenerate-family",
    response_model=DocumentChunkDetailResponse,
)
async def regenerate_document_chunk_family(
    corpus_id: UUID,
    document_id: UUID,
    chunk_id: UUID,
    payload: DocumentChunkUpdateRequest,
) -> DocumentChunkDetailResponse:
    resolved_app = _resolve_app_name(payload.app_name)
    from negentropy.storage.service import DocumentStorageService

    storage_service = DocumentStorageService()
    doc = await storage_service.get_document(
        document_id=document_id,
        corpus_id=corpus_id,
        app_name=resolved_app,
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )
    service = _get_service()
    records = await service.regenerate_knowledge_family(
        corpus_id=corpus_id,
        app_name=resolved_app,
        knowledge_id=chunk_id,
        content=payload.content or "",
        is_enabled=payload.is_enabled,
    )
    if not records:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "CHUNK_NOT_FOUND", "message": "Chunk not found"},
        )
    selected = next((item for item in records if str(item.id) == str(chunk_id)), records[0])
    return DocumentChunkDetailResponse(
        item=_serialize_document_chunk_item(selected, records),
        document_metadata=_build_document_chunk_metadata(doc, records),
    )


@router.post("/base/{corpus_id}/documents/{document_id}/sync", response_model=AsyncPipelineResponse)
async def sync_document(
    corpus_id: UUID,
    document_id: UUID,
    payload: DocumentActionRequest,
    background_tasks: BackgroundTasks,
) -> AsyncPipelineResponse:
    resolved_app = _resolve_app_name(payload.app_name)
    from negentropy.storage.service import DocumentStorageService

    storage_service = DocumentStorageService()
    doc = await storage_service.get_document(
        document_id=document_id,
        corpus_id=corpus_id,
        app_name=resolved_app,
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )
    if not _is_url_document(doc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_DOCUMENT_TYPE", "message": "sync is only supported for URL documents"},
        )

    source_uri = _resolve_document_source_uri(doc)
    if not source_uri:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_DOCUMENT_SOURCE", "message": "Document source_uri not available"},
        )

    service = _get_service()
    corpus = await service.get_corpus_by_id(corpus_id)
    chunking_config = _resolve_chunking_config_from_doc_request(
        payload=payload,
        corpus_config=corpus.config if corpus else {},
    )
    run_id = await service.create_pipeline(
        app_name=resolved_app,
        operation="replace_source",
        input_data={
            "corpus_id": str(corpus_id),
            "source_uri": source_uri,
            "document_id": str(document_id),
            "sync_document": True,
            "chunking_config": chunking_config_summary(chunking_config),
        },
    )
    background_tasks.add_task(
        service.execute_sync_document_pipeline,
        run_id=run_id,
        corpus_id=corpus_id,
        app_name=resolved_app,
        document_id=document_id,
        source_uri=source_uri,
        chunking_config=chunking_config,
    )
    return AsyncPipelineResponse(
        run_id=run_id,
        status="running",
        message="Document sync task started. Check Pipeline page for progress.",
    )


@router.post("/base/{corpus_id}/documents/{document_id}/rebuild", response_model=AsyncPipelineResponse)
async def rebuild_document(
    corpus_id: UUID,
    document_id: UUID,
    payload: DocumentActionRequest,
    background_tasks: BackgroundTasks,
) -> AsyncPipelineResponse:
    resolved_app = _resolve_app_name(payload.app_name)
    from negentropy.storage.service import DocumentStorageService

    storage_service = DocumentStorageService()
    doc = await storage_service.get_document(
        document_id=document_id,
        corpus_id=corpus_id,
        app_name=resolved_app,
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )

    service = _get_service()
    corpus = await service.get_corpus_by_id(corpus_id)
    chunking_config = _resolve_chunking_config_from_doc_request(
        payload=payload,
        corpus_config=corpus.config if corpus else {},
    )

    if _is_url_document(doc):
        source_uri = _resolve_document_source_uri(doc)
        markdown_text = await storage_service.get_document_markdown(document_id)
        if not source_uri or not markdown_text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_DOCUMENT_SOURCE", "message": "URL document markdown not available"},
            )
        metadata = normalize_source_metadata(
            source_uri=source_uri,
            metadata={"source_type": "url", "origin_url": source_uri, "document_id": str(document_id)},
        )
        run_id = await service.create_pipeline(
            app_name=resolved_app,
            operation="replace_source",
            input_data={
                "corpus_id": str(corpus_id),
                "source_uri": source_uri,
                "document_id": str(document_id),
                "rebuild_document": True,
            },
        )
        background_tasks.add_task(
            service.execute_replace_source_pipeline,
            run_id=run_id,
            corpus_id=corpus_id,
            app_name=resolved_app,
            text=markdown_text,
            source_uri=source_uri,
            metadata=metadata,
            chunking_config=chunking_config,
        )
        return AsyncPipelineResponse(
            run_id=run_id,
            status="running",
            message="Document rebuild task started. Check Pipeline page for progress.",
        )

    if not doc.gcs_uri:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_DOCUMENT_SOURCE", "message": "File document gcs_uri not available"},
        )
    run_id = await service.create_pipeline(
        app_name=resolved_app,
        operation="rebuild_source",
        input_data={
            "corpus_id": str(corpus_id),
            "source_uri": doc.gcs_uri,
            "document_id": str(document_id),
        },
    )
    background_tasks.add_task(
        service.execute_rebuild_source_pipeline,
        run_id=run_id,
        corpus_id=corpus_id,
        app_name=resolved_app,
        source_uri=doc.gcs_uri,
        chunking_config=chunking_config,
        document_id=document_id,
    )
    return AsyncPipelineResponse(
        run_id=run_id,
        status="running",
        message="Document rebuild task started. Check Pipeline page for progress.",
    )


@router.post("/base/{corpus_id}/documents/{document_id}/replace", response_model=AsyncPipelineResponse)
async def replace_document(
    corpus_id: UUID,
    document_id: UUID,
    payload: DocumentReplaceRequest,
    background_tasks: BackgroundTasks,
) -> AsyncPipelineResponse:
    resolved_app = _resolve_app_name(payload.app_name)
    from negentropy.storage.service import DocumentStorageService

    storage_service = DocumentStorageService()
    doc = await storage_service.get_document(
        document_id=document_id,
        corpus_id=corpus_id,
        app_name=resolved_app,
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )

    source_uri = _resolve_document_source_uri(doc)
    if not source_uri:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_DOCUMENT_SOURCE", "message": "Document source_uri not available"},
        )

    service = _get_service()
    corpus = await service.get_corpus_by_id(corpus_id)
    chunking_config = _resolve_chunking_config_from_doc_request(
        payload=payload,
        corpus_config=corpus.config if corpus else {},
    )
    metadata = normalize_source_metadata(
        source_uri=source_uri,
        metadata={
            "source_type": "url" if _is_url_document(doc) else "file",
            "origin_url": (doc.metadata_ or {}).get("origin_url"),
            "document_id": str(document_id),
        },
    )
    run_id = await service.create_pipeline(
        app_name=resolved_app,
        operation="replace_source",
        input_data={"corpus_id": str(corpus_id), "source_uri": source_uri, "document_id": str(document_id)},
    )
    background_tasks.add_task(
        service.execute_replace_source_pipeline,
        run_id=run_id,
        corpus_id=corpus_id,
        app_name=resolved_app,
        text=payload.text,
        source_uri=source_uri,
        metadata=metadata,
        chunking_config=chunking_config,
    )
    return AsyncPipelineResponse(
        run_id=run_id,
        status="running",
        message="Document replace task started. Check Pipeline page for progress.",
    )


@router.post("/base/{corpus_id}/documents/{document_id}/archive")
async def archive_document(
    corpus_id: UUID,
    document_id: UUID,
    payload: DocumentActionRequest,
) -> ArchiveSourceResponse:
    resolved_app = _resolve_app_name(payload.app_name)
    from negentropy.storage.service import DocumentStorageService

    storage_service = DocumentStorageService()
    doc = await storage_service.get_document(
        document_id=document_id,
        corpus_id=corpus_id,
        app_name=resolved_app,
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )
    source_uri = _resolve_document_source_uri(doc)
    if not source_uri:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_DOCUMENT_SOURCE", "message": "Document source_uri not available"},
        )

    service = _get_service()
    updated = await service.archive_source(
        corpus_id=corpus_id,
        app_name=resolved_app,
        source_uri=source_uri,
        archived=True,
    )
    return ArchiveSourceResponse(updated_count=updated, archived=True)


@router.post("/base/{corpus_id}/documents/{document_id}/unarchive")
async def unarchive_document(
    corpus_id: UUID,
    document_id: UUID,
    payload: DocumentActionRequest,
) -> ArchiveSourceResponse:
    resolved_app = _resolve_app_name(payload.app_name)
    from negentropy.storage.service import DocumentStorageService

    storage_service = DocumentStorageService()
    doc = await storage_service.get_document(
        document_id=document_id,
        corpus_id=corpus_id,
        app_name=resolved_app,
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )
    source_uri = _resolve_document_source_uri(doc)
    if not source_uri:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_DOCUMENT_SOURCE", "message": "Document source_uri not available"},
        )
    service = _get_service()
    updated = await service.archive_source(
        corpus_id=corpus_id,
        app_name=resolved_app,
        source_uri=source_uri,
        archived=False,
    )
    return ArchiveSourceResponse(updated_count=updated, archived=False)


@router.post("/base/{corpus_id}/replace_source", response_model=AsyncPipelineResponse)
async def replace_source(
    corpus_id: UUID,
    payload: ReplaceSourceRequest,
    background_tasks: BackgroundTasks,
) -> AsyncPipelineResponse:
    """异步替换源文本（删除旧记录 + 索引新记录）

    立即返回 run_id，实际处理在后台执行。
    可在 Pipeline 页面查看进度。
    """
    resolved_app = _resolve_app_name(payload.app_name)

    logger.info(
        "api_replace_source_started",
        corpus_id=str(corpus_id),
        app_name=resolved_app,
        source_uri=payload.source_uri,
    )

    try:
        service = _get_service()
        corpus = await service.get_corpus_by_id(corpus_id)
        chunking_config = _resolve_chunking_config(
            chunking_config=payload.chunking_config,
            legacy_payload=_extract_legacy_chunking_payload(payload),
            corpus_config=corpus.config if corpus else {},
        )

        # 创建 Pipeline 记录
        run_id = await service.create_pipeline(
            app_name=resolved_app,
            operation="replace_source",
            input_data={
                "corpus_id": str(corpus_id),
                "source_uri": payload.source_uri,
                "text_length": len(payload.text),
                "chunking_config": chunking_config_summary(chunking_config),
            },
        )

        # 添加后台任务
        background_tasks.add_task(
            service.execute_replace_source_pipeline,
            run_id=run_id,
            corpus_id=corpus_id,
            app_name=resolved_app,
            text=payload.text,
            source_uri=payload.source_uri,
            metadata=payload.metadata,
            chunking_config=chunking_config,
        )

        logger.info(
            "api_replace_source_queued",
            corpus_id=str(corpus_id),
            run_id=run_id,
        )

        return AsyncPipelineResponse(
            run_id=run_id,
            status="running",
            message="Replace source task started. Check Pipeline page for progress.",
        )

    except KnowledgeError as exc:
        raise _map_exception_to_http(exc) from exc


@router.post("/base/{corpus_id}/sync_source", response_model=AsyncPipelineResponse)
async def sync_source(
    corpus_id: UUID,
    payload: SyncSourceRequest,
    background_tasks: BackgroundTasks,
) -> AsyncPipelineResponse:
    """异步同步 URL 源（重新拉取并摄入）

    立即返回 run_id，实际处理在后台执行。
    可在 Pipeline 页面查看进度。
    """
    resolved_app = _resolve_app_name(payload.app_name)
    source_uri = payload.source_uri

    # 验证 source_uri 是有效的 URL
    if not source_uri or not (source_uri.startswith("http://") or source_uri.startswith("https://")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_SOURCE_URI",
                "message": "source_uri must be a valid HTTP/HTTPS URL for sync operation",
            },
        )

    logger.info(
        "api_sync_source_started",
        corpus_id=str(corpus_id),
        app_name=resolved_app,
        source_uri=source_uri,
    )

    try:
        service = _get_service()

        # 获取 corpus 配置作为基础（Single Source of Truth）
        corpus = await service.get_corpus_by_id(corpus_id)
        corpus_config = corpus.config if corpus else {}

        chunking_config = _resolve_chunking_config(
            chunking_config=payload.chunking_config,
            legacy_payload=_extract_legacy_chunking_payload(payload),
            corpus_config=corpus_config,
        )

        # 创建 Pipeline 记录
        run_id = await service.create_pipeline(
            app_name=resolved_app,
            operation="sync_source",
            input_data={
                "corpus_id": str(corpus_id),
                "source_uri": source_uri,
                "chunking_config": chunking_config_summary(chunking_config),
            },
        )

        # 添加后台任务
        background_tasks.add_task(
            service.execute_sync_source_pipeline,
            run_id=run_id,
            corpus_id=corpus_id,
            app_name=resolved_app,
            source_uri=source_uri,
            chunking_config=chunking_config,
        )

        logger.info(
            "api_sync_source_queued",
            corpus_id=str(corpus_id),
            run_id=run_id,
        )

        return AsyncPipelineResponse(
            run_id=run_id,
            status="running",
            message="Sync source task started. Check Pipeline page for progress.",
        )

    except KnowledgeError as exc:
        raise _map_exception_to_http(exc) from exc
    except ValidationError as exc:
        logger.warning("pydantic_validation_error", errors=exc.errors())
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": "Invalid request parameters", "errors": exc.errors()},
        ) from exc


@router.post("/base/{corpus_id}/rebuild_source", response_model=AsyncPipelineResponse)
async def rebuild_source(
    corpus_id: UUID,
    payload: RebuildSourceRequest,
    background_tasks: BackgroundTasks,
) -> AsyncPipelineResponse:
    """异步重建 GCS 源（重新下载并摄入）

    立即返回 run_id，实际处理在后台执行。
    可在 Pipeline 页面查看进度。
    """
    resolved_app = _resolve_app_name(payload.app_name)
    source_uri = payload.source_uri

    # 验证 source_uri 是有效的 GCS URI
    if not source_uri or not source_uri.startswith("gs://"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_SOURCE_URI",
                "message": "source_uri must be a valid GCS URI (gs://...) for rebuild operation",
            },
        )

    logger.info(
        "api_rebuild_source_started",
        corpus_id=str(corpus_id),
        app_name=resolved_app,
        source_uri=source_uri,
    )

    try:
        service = _get_service()

        # 获取 corpus 配置作为基础
        corpus = await service.get_corpus_by_id(corpus_id)
        corpus_config = corpus.config if corpus else {}

        chunking_config = _resolve_chunking_config(
            chunking_config=payload.chunking_config,
            legacy_payload=_extract_legacy_chunking_payload(payload),
            corpus_config=corpus_config,
        )

        # 创建 Pipeline 记录
        run_id = await service.create_pipeline(
            app_name=resolved_app,
            operation="rebuild_source",
            input_data={
                "corpus_id": str(corpus_id),
                "source_uri": source_uri,
                "chunking_config": chunking_config_summary(chunking_config),
            },
        )

        # 添加后台任务
        background_tasks.add_task(
            service.execute_rebuild_source_pipeline,
            run_id=run_id,
            corpus_id=corpus_id,
            app_name=resolved_app,
            source_uri=source_uri,
            chunking_config=chunking_config,
        )

        logger.info(
            "api_rebuild_source_queued",
            corpus_id=str(corpus_id),
            run_id=run_id,
        )

        return AsyncPipelineResponse(
            run_id=run_id,
            status="running",
            message="Rebuild source task started. Check Pipeline page for progress.",
        )

    except KnowledgeError as exc:
        raise _map_exception_to_http(exc) from exc
    except ValidationError as exc:
        logger.warning("pydantic_validation_error", errors=exc.errors())
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": "Invalid request parameters", "errors": exc.errors()},
        ) from exc


@router.post("/base/{corpus_id}/delete_source", response_model=DeleteSourceResponse)
async def delete_source(
    corpus_id: UUID,
    payload: DeleteSourceRequest,
) -> DeleteSourceResponse:
    """删除指定 source_uri 的所有知识块

    Args:
        corpus_id: 知识库 ID
        payload: 删除请求，包含 source_uri

    Returns:
        DeleteSourceResponse: 删除的记录数量
    """
    resolved_app = _resolve_app_name(payload.app_name)
    source_uri = payload.source_uri

    if not source_uri:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_SOURCE_URI", "message": "source_uri is required"},
        )

    logger.info(
        "api_delete_source_started",
        corpus_id=str(corpus_id),
        app_name=resolved_app,
        source_uri=source_uri,
    )

    try:
        service = _get_service()
        result = await service.delete_source(
            corpus_id=corpus_id,
            app_name=resolved_app,
            source_uri=source_uri,
        )

        logger.info(
            "api_delete_source_completed",
            corpus_id=str(corpus_id),
            app_name=resolved_app,
            source_uri=source_uri,
            deleted_count=result["deleted_count"],
            deleted_documents=result["deleted_documents"],
            deleted_gcs_objects=result["deleted_gcs_objects"],
            warning_count=len(result["warnings"]),
        )

        return DeleteSourceResponse(
            deleted_count=result["deleted_count"],
            deleted_documents=result["deleted_documents"],
            deleted_gcs_objects=result["deleted_gcs_objects"],
            warnings=result["warnings"],
        )

    except KnowledgeError as exc:
        raise _map_exception_to_http(exc) from exc


@router.post("/base/{corpus_id}/archive_source", response_model=ArchiveSourceResponse)
async def archive_source(
    corpus_id: UUID,
    payload: ArchiveSourceRequest,
) -> ArchiveSourceResponse:
    """归档或解档指定 source_uri

    通过更新 Knowledge 记录的 metadata 中的 archived 字段实现归档/解档。
    归档后的 Source 仍然存在，但在默认查询中会被排除。

    Args:
        corpus_id: 知识库 ID
        payload: 归档请求，包含 source_uri 和 archived 状态

    Returns:
        ArchiveSourceResponse: 更新的记录数量
    """
    resolved_app = _resolve_app_name(payload.app_name)
    source_uri = payload.source_uri

    if not source_uri:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_SOURCE_URI", "message": "source_uri is required"},
        )

    logger.info(
        "api_archive_source_started",
        corpus_id=str(corpus_id),
        app_name=resolved_app,
        source_uri=source_uri,
        archived=payload.archived,
    )

    try:
        service = _get_service()
        updated_count = await service.archive_source(
            corpus_id=corpus_id,
            app_name=resolved_app,
            source_uri=source_uri,
            archived=payload.archived,
        )

        logger.info(
            "api_archive_source_completed",
            corpus_id=str(corpus_id),
            app_name=resolved_app,
            source_uri=source_uri,
            archived=payload.archived,
            updated_count=updated_count,
        )

        return ArchiveSourceResponse(updated_count=updated_count, archived=payload.archived)

    except KnowledgeError as exc:
        raise _map_exception_to_http(exc) from exc


@router.post("/base/{corpus_id}/search")
async def search(corpus_id: UUID, payload: SearchRequest) -> dict[str, Any]:
    """搜索知识库

    集成统一异常处理、结构化日志和配置验证。
    """
    resolved_app = _resolve_app_name(payload.app_name)
    search_mode = payload.mode or "hybrid"

    logger.info(
        "api_search_started",
        corpus_id=str(corpus_id),
        app_name=resolved_app,
        mode=search_mode,
        limit=payload.limit or DEFAULT_SEARCH_LIMIT,
    )

    try:
        service = _get_service()
        config = SearchConfig(
            mode=search_mode,
            limit=payload.limit or DEFAULT_SEARCH_LIMIT,
            semantic_weight=payload.semantic_weight or DEFAULT_SEMANTIC_WEIGHT,
            keyword_weight=payload.keyword_weight or DEFAULT_KEYWORD_WEIGHT,
            metadata_filter=payload.metadata_filter,
        )
        matches = await service.search(
            corpus_id=corpus_id,
            app_name=resolved_app,
            query=payload.query,
            config=config,
        )

        logger.info(
            "api_search_completed",
            corpus_id=str(corpus_id),
            mode=search_mode,
            result_count=len(matches),
        )

        return {
            "count": len(matches),
            "items": [
                {
                    "id": str(item.id),
                    "content": item.content,
                    "source_uri": item.source_uri,
                    "metadata": item.metadata,
                    "semantic_score": item.semantic_score,
                    "keyword_score": item.keyword_score,
                    "combined_score": item.combined_score,
                }
                for item in matches
            ],
        }

    except KnowledgeError as exc:
        raise _map_exception_to_http(exc) from exc
    except ValidationError as exc:
        logger.warning("search_config_validation_error", errors=exc.errors())
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_SEARCH_CONFIG", "message": "Invalid search configuration", "errors": exc.errors()},
        ) from exc


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

        # 准备知识块数据
        chunks = [
            {
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
        )

        # 执行图谱构建
        graph_service = _get_graph_service()
        result = await graph_service.build_graph(
            corpus_id=corpus_id,
            app_name=resolved_app,
            chunks=chunks,
            config=config,
        )

        logger.info(
            "api_graph_build_completed",
            corpus_id=str(corpus_id),
            run_id=result.run_id,
            entity_count=result.entity_count,
            relation_count=result.relation_count,
        )

        return GraphBuildResponse(
            run_id=result.run_id,
            corpus_id=result.corpus_id,
            status=result.status,
            entity_count=result.entity_count,
            relation_count=result.relation_count,
            chunks_processed=result.chunks_processed,
            elapsed_seconds=result.elapsed_seconds,
            error_message=result.error_message,
        )

    except KnowledgeError as exc:
        raise _map_exception_to_http(exc) from exc


@router.get("/base/{corpus_id}/graph", response_model=dict[str, Any])
async def get_corpus_graph(
    corpus_id: UUID,
    app_name: str | None = Query(default=None),
    include_runs: bool = Query(default=False),
) -> dict[str, Any]:
    """获取语料库的知识图谱

    Args:
        corpus_id: 语料库 ID
        app_name: 应用名称
        include_runs: 是否包含构建历史

    Returns:
        图谱数据（节点和边）
    """
    resolved_app = _resolve_app_name(app_name)

    logger.debug(
        "api_get_corpus_graph",
        corpus_id=str(corpus_id),
        app_name=resolved_app,
        include_runs=include_runs,
    )

    graph_service = _get_graph_service()
    graph = await graph_service.get_graph(
        corpus_id=corpus_id,
        app_name=resolved_app,
        include_runs=include_runs,
    )

    return {
        "nodes": [
            {
                "id": node.id,
                "label": node.label,
                "type": node.node_type,
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
        # 生成查询向量
        embedding_fn = build_embedding_fn()
        query_embedding = await embedding_fn(payload.query)

        # 查询配置
        config = GraphQueryConfig(
            max_depth=payload.max_depth,
            limit=payload.limit,
            semantic_weight=payload.semantic_weight,
            graph_weight=payload.graph_weight,
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
            }
            for run in runs
        ],
    }


# ============================================================================
# API 调用统计
# ============================================================================

# Endpoint ID 到 PostgreSQL 正则表达式的映射
# 使用 ~ 操作符进行精确匹配，避免 LIKE 模式的模糊匹配问题
# 正则表达式要点：
# - ^ 锚定字符串开头
# - $ 锚定字符串结尾
# - [^/]+ 匹配非斜杠字符（如 UUID）
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
    from datetime import datetime, timedelta

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


# =============================================================================
# Phase 2: 文档来源追踪 API
# =============================================================================


def _to_source_resp(doc_source) -> _DocSourceResp:
    """将 DocSource ORM 对象转换为 API 响应 Schema（消除三处重复构建）"""
    return _DocSourceResp(
        id=doc_source.id,
        document_id=doc_source.document_id,
        source_type=doc_source.source_type,
        source_url=doc_source.source_url,
        original_url=doc_source.original_url,
        title=doc_source.title,
        author=doc_source.author,
        extracted_summary=doc_source.extracted_summary,
        extraction_duration_ms=doc_source.extraction_duration_ms,
        extracted_at=doc_source.extracted_at,
        extractor_tool_name=doc_source.extractor_tool_name,
        extractor_server_id=doc_source.extractor_server_id,
        raw_metadata=doc_source.raw_metadata or {},
        created_at=doc_source.created_at,
        updated_at=doc_source.updated_at,
    )


@router.get("/sources")
async def list_doc_sources(
    corpus_id: UUID | None = Query(default=None),
    source_type: str | None = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
) -> _DocSourceListResp:
    """列出文档来源记录

    支持按语料库 ID 和来源类型过滤，返回分页结果。

    Args:
        corpus_id: 语料库 ID（可选，不传则返回空列表）
        source_type: 来源类型过滤（url/file_pdf/file_generic/text_input）
        offset: 分页偏移量
        limit: 每页数量上限

    Returns:
        来源记录列表及总数
    """
    service = _get_service()

    # corpus_id 为必传参数（DAO 层依赖其进行关联查询）
    if corpus_id is None:
        logger.info("api_list_sources", corpus_id=None, total=0)
        return _DocSourceListResp(items=[], total=0, offset=offset, limit=limit)

    async with AsyncSessionLocal() as db:
        sources, total = await service.source_tracker.list_sources(
            db=db,
            corpus_id=corpus_id,
            source_type=source_type,
            offset=offset,
            limit=limit,
        )

    logger.info(
        "api_list_sources",
        corpus_id=str(corpus_id),
        source_type=source_type,
        total=total,
    )

    items = [_to_source_resp(s) for s in sources]

    return _DocSourceListResp(items=items, total=total, offset=offset, limit=limit)


@router.get("/sources/{source_id}")
async def get_doc_source(
    source_id: UUID,
) -> _DocSourceResp:
    """获取单个来源记录详情

    Args:
        source_id: 来源记录 UUID

    Returns:
        来源详情

    Raises:
        404: 来源记录不存在
    """
    service = _get_service()

    async with AsyncSessionLocal() as db:
        doc_source = await service.source_tracker.get_by_id(db, source_id)

    if doc_source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source record not found")

    logger.info("api_get_source", source_id=str(source_id))

    return _to_source_resp(doc_source)


@router.get("/documents/{document_id}/source")
async def get_document_provenance(
    document_id: UUID,
) -> DocumentProvenanceResponse:
    """查询文档的溯源信息（来源追踪）

    返回该 KnowledgeDocument 的基本信息及其关联的 DocSource 记录，
    用于追溯文档的原始来源（URL/PDF/文件/文本输入）。

    Args:
        document_id: KnowledgeDocument 的 UUID

    Returns:
        文档基本信息 + 嵌套的来源追踪信息

    Raises:
        404: 文档不存在或无关联的来源记录
    """
    from sqlalchemy import select as sql_select

    service = _get_service()

    async with AsyncSessionLocal() as db:
        # 1. 查询文档基本信息
        doc_stmt = sql_select(KnowledgeDocument).where(KnowledgeDocument.id == document_id)
        doc_result = await db.execute(doc_stmt)
        doc = doc_result.scalar_one_or_none()

        if doc is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document {document_id} not found",
            )

        # 2. 查询来源追踪记录
        doc_source = await service.source_tracker.get_provenance(db, document_id)

    if doc_source is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No source tracking record for document {document_id}",
        )

    logger.info(
        "api_document_provenance",
        document_id=str(document_id),
        source_id=str(doc_source.id),
        source_type=doc_source.source_type,
    )

    # 构建嵌套的来源信息
    source_resp = _to_source_resp(doc_source)

    return DocumentProvenanceResponse(
        document_id=document_id,
        filename=doc.original_filename or "",
        file_hash=doc.file_hash or "",
        content_type=doc.content_type,
        status=doc.status or "unknown",
        markdown_extract_status=doc.markdown_extract_status or "unknown",
        source=source_resp,
    )


# =============================================================================
# Phase 3: 文档目录编目 API
# =============================================================================

_catalog_service: CatalogService | None = None


def _get_catalog_service() -> CatalogService:
    global _catalog_service
    if _catalog_service is None:
        from .catalog_service import CatalogService

        _catalog_service = CatalogService()
    return _catalog_service


def _to_catalog_node_resp(row: dict, *, children_count: int = 0, document_count: int = 0) -> _CatalogNodeResp:
    """将 DAO 树查询行（dict）转换为 API 响应 Schema"""
    return _CatalogNodeResp(
        id=row["id"],
        catalog_id=row["catalog_id"],
        parent_id=row.get("parent_id"),
        name=row["name"],
        slug=row["slug"],
        node_type=row["node_type"],
        description=row.get("description"),
        sort_order=row["sort_order"],
        config=row.get("config") or {},
        depth=row.get("depth", 0),
        children_count=children_count,
        document_count=document_count,
    )


def _entry_orm_to_resp(
    entry: Any, *, depth: int = 0, children_count: int = 0, document_count: int = 0
) -> _CatalogNodeResp:
    """将 DocCatalogEntry ORM 对象转换为 API 响应 Schema"""
    from negentropy.knowledge.catalog_dao import _ENUM_TO_NODE_TYPE, _compute_slug

    return _CatalogNodeResp(
        id=entry.id,
        catalog_id=entry.catalog_id,
        parent_id=entry.parent_entry_id,
        name=entry.name,
        slug=_compute_slug(entry.name, entry.slug_override),
        node_type=_ENUM_TO_NODE_TYPE.get(entry.node_type, entry.node_type) if entry.node_type else "folder",
        description=entry.description,
        sort_order=entry.position or 0,
        config=entry.config or {},
        depth=depth,
        children_count=children_count,
        document_count=document_count,
    )


def _catalog_orm_to_resp(catalog: Any) -> _CatalogResp:
    vis = catalog.visibility or "INTERNAL"
    return _CatalogResp(
        id=catalog.id,
        name=catalog.name,
        slug=catalog.slug,
        app_name=catalog.app_name,
        description=catalog.description,
        visibility=vis.lower() if isinstance(vis, str) else "INTERNAL",
        is_archived=catalog.is_archived or False,
        version=catalog.version or 1,
        owner_id=catalog.owner_id,
        config=catalog.config or {},
        created_at=catalog.created_at,
        updated_at=catalog.updated_at,
    )


# =============================================================================
# Phase 3 补全: /catalogs RESTful 路由（对标 BFF 代理约定）
# =============================================================================


def _build_tree_response(tree_data: list[dict]) -> CatalogTreeResponse:
    """复用：将 CTE 扁平列表转为 CatalogTreeResponse（含 children_count）"""
    id_to_children_count: dict[UUID, int] = {}
    for node in tree_data:
        pid = node.get("parent_id")
        if pid is not None:
            id_to_children_count[pid] = id_to_children_count.get(pid, 0) + 1
    items = [_to_catalog_node_resp(node, children_count=id_to_children_count.get(node["id"], 0)) for node in tree_data]
    max_depth = max((n.get("depth", 0) for n in tree_data), default=0) if tree_data else 0
    return CatalogTreeResponse(tree=items, total_nodes=len(items), max_depth=max_depth)


# --- Catalog CRUD ---


@router.get("/catalogs")
async def list_catalogs(
    app_name: str | None = Query(default=None),
    include_archived: bool = Query(default=False),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
):
    """列出 Catalog（支持 app_name 过滤）"""
    catalog_svc = _get_catalog_service()
    async with AsyncSessionLocal() as db:
        catalogs, total = await catalog_svc.list_catalogs(
            db,
            app_name=app_name,
            include_archived=include_archived,
            offset=offset,
            limit=limit,
        )
    items = [_catalog_orm_to_resp(c) for c in catalogs]
    logger.info("api_list_catalogs", total=total)
    return {"items": items, "total": total, "offset": offset, "limit": limit}


@router.post("/catalogs")
async def create_catalog(body: _CatalogCreateReq) -> _CatalogResp:
    """创建 Catalog"""
    catalog_svc = _get_catalog_service()
    async with AsyncSessionLocal() as db:
        try:
            catalog = await catalog_svc.create_catalog(
                db,
                app_name=body.app_name,
                name=body.name,
                slug=body.slug,
                owner_id=body.owner_id,
                description=body.description,
                visibility=body.visibility.upper(),
                config=body.config if body.config else None,
            )
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        await db.commit()
    logger.info("api_create_catalog", catalog_id=str(catalog.id))
    return _catalog_orm_to_resp(catalog)


@router.get("/catalogs/{catalog_id}")
async def get_catalog(catalog_id: UUID) -> _CatalogResp:
    """获取单个 Catalog 详情"""
    catalog_svc = _get_catalog_service()
    async with AsyncSessionLocal() as db:
        catalog = await catalog_svc.get_catalog(db, catalog_id)
    if catalog is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Catalog not found")
    logger.info("api_get_catalog", catalog_id=str(catalog_id))
    return _catalog_orm_to_resp(catalog)


@router.patch("/catalogs/{catalog_id}")
async def update_catalog(
    catalog_id: UUID,
    body: _CatalogUpdateReq,
) -> _CatalogResp:
    """更新 Catalog 属性"""
    catalog_svc = _get_catalog_service()
    update_kwargs = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not update_kwargs:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    if "visibility" in update_kwargs:
        update_kwargs["visibility"] = update_kwargs["visibility"].upper()
    async with AsyncSessionLocal() as db:
        try:
            catalog = await catalog_svc.update_catalog(db, catalog_id, **update_kwargs)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        if catalog is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Catalog not found")
        await db.commit()
    logger.info("api_update_catalog", catalog_id=str(catalog_id))
    return _catalog_orm_to_resp(catalog)


@router.delete("/catalogs/{catalog_id}")
async def delete_catalog(catalog_id: UUID):
    """删除 Catalog（级联删除所有条目）"""
    catalog_svc = _get_catalog_service()
    async with AsyncSessionLocal() as db:
        deleted = await catalog_svc.delete_catalog(db, catalog_id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Catalog not found")
        await db.commit()
    logger.info("api_delete_catalog", catalog_id=str(catalog_id))
    return {"detail": "Catalog deleted", "catalog_id": str(catalog_id)}


# --- Catalog Tree ---


@router.get("/catalogs/{catalog_id}/tree")
async def get_catalog_tree_v2(catalog_id: UUID) -> CatalogTreeResponse:
    """获取 Catalog 完整目录树"""
    catalog_svc = _get_catalog_service()
    async with AsyncSessionLocal() as db:
        tree_data = await catalog_svc.get_tree(db, catalog_id)
    resp = _build_tree_response(tree_data)
    logger.info("api_get_catalog_tree_v2", catalog_id=str(catalog_id), total_nodes=resp.total_nodes)
    return resp


# --- Catalog Entry CRUD ---


@router.get("/catalogs/{catalog_id}/entries")
async def list_catalog_entries(catalog_id: UUID) -> CatalogTreeResponse:
    """列出 Catalog 下所有条目"""
    catalog_svc = _get_catalog_service()
    async with AsyncSessionLocal() as db:
        tree_data = await catalog_svc.get_tree(db, catalog_id)
    resp = _build_tree_response(tree_data)
    logger.info("api_list_catalog_entries", catalog_id=str(catalog_id), total=len(resp.tree))
    return resp


@router.post("/catalogs/{catalog_id}/entries")
async def create_catalog_entry(
    catalog_id: UUID,
    body: _CatalogNodeCreateReq,
) -> _CatalogNodeResp:
    """创建目录条目（catalog_id 从路径获取）"""
    catalog_svc = _get_catalog_service()
    async with AsyncSessionLocal() as db:
        try:
            node = await catalog_svc.create_node(
                db,
                catalog_id=catalog_id,
                name=body.name,
                slug=body.slug,
                parent_id=body.parent_id,
                node_type=body.node_type,
                description=body.description,
                sort_order=body.sort_order,
                config=body.config if body.config else None,
            )
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        await db.commit()
    logger.info("api_create_catalog_entry", node_id=str(node.id), catalog_id=str(catalog_id))
    return _entry_orm_to_resp(node)


@router.get("/catalogs/{catalog_id}/entries/{entry_id}")
async def get_catalog_entry(
    catalog_id: UUID,
    entry_id: UUID,
) -> _CatalogNodeResp:
    """获取单个目录条目详情"""
    catalog_svc = _get_catalog_service()
    async with AsyncSessionLocal() as db:
        node = await catalog_svc.get_node(db, entry_id)
    if node is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Catalog entry not found")
    logger.info("api_get_catalog_entry", entry_id=str(entry_id))
    return _entry_orm_to_resp(node)


@router.patch("/catalogs/{catalog_id}/entries/{entry_id}")
async def update_catalog_entry(
    catalog_id: UUID,
    entry_id: UUID,
    body: _CatalogNodeUpdateReq,
) -> _CatalogNodeResp:
    """更新目录条目属性"""
    catalog_svc = _get_catalog_service()
    async with AsyncSessionLocal() as db:
        update_kwargs = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
        if not update_kwargs:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
        try:
            node = await catalog_svc.update_node(db, entry_id, **update_kwargs)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        if node is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Catalog entry not found")
        await db.commit()
    logger.info("api_update_catalog_entry", entry_id=str(entry_id))
    return _entry_orm_to_resp(node)


@router.delete("/catalogs/{catalog_id}/entries/{entry_id}")
async def delete_catalog_entry(
    catalog_id: UUID,
    entry_id: UUID,
):
    """删除目录条目（级联删除子节点和文档关联）"""
    catalog_svc = _get_catalog_service()
    async with AsyncSessionLocal() as db:
        deleted = await catalog_svc.delete_node(db, entry_id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Catalog entry not found")
        await db.commit()
    logger.info("api_delete_catalog_entry", entry_id=str(entry_id))
    return {"detail": "Catalog entry deleted", "entry_id": str(entry_id)}


# --- Catalog Documents ---


@router.get("/catalogs/{catalog_id}/documents")
async def get_catalog_documents(
    catalog_id: UUID,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=200),
):
    """获取 Catalog 作用域下可分配的候选文档列表

    语义：返回与 catalog 同 app_name 下 status='active' 的全部 KnowledgeDocument，
    供 UI 「添加文档到节点」对话框作为候选集。已归属文档由 UI 侧基于 existingDocIds
    灰出（见 AddDocumentsDialog.tsx / DocumentAssignmentSection.tsx）。

    跨 app 不可见：与 catalog_service.assign_document 的 app_name 同源断言对齐
    （ISSUE-011 Phase 3 不变量）。
    """
    from negentropy.models.perception import DocCatalog
    from negentropy.storage.service import DocumentStorageService

    async with AsyncSessionLocal() as db:
        catalog = await db.get(DocCatalog, catalog_id)
        if catalog is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "CATALOG_NOT_FOUND", "message": "Catalog not found"},
            )
        catalog_app = catalog.app_name  # app_name 创建后不可变（perception.py DocCatalog 约束）

    storage_service = DocumentStorageService()
    docs, total = await storage_service.list_documents(
        corpus_id=None,
        app_name=catalog_app,
        limit=limit,
        offset=offset,
    )
    unique_user_ids = list({doc.created_by for doc in docs if doc.created_by})
    name_map = await _resolve_user_display_names(unique_user_ids)
    items = [_build_document_response(doc, name_map) for doc in docs]

    logger.info(
        "api_get_catalog_documents",
        catalog_id=str(catalog_id),
        total=total,
        app_name=catalog_app,
    )
    return {"items": items, "total": total, "offset": offset, "limit": limit}


# --- Entry Documents ---


@router.get("/catalogs/{catalog_id}/entries/{entry_id}/documents")
async def get_entry_documents(
    catalog_id: UUID,
    entry_id: UUID,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
):
    """获取目录条目下已归属的文档列表（分页）"""
    catalog_svc = _get_catalog_service()
    async with AsyncSessionLocal() as db:
        documents, total = await catalog_svc.get_node_documents(db, entry_id, offset=offset, limit=limit)
    unique_user_ids = list({doc.created_by for doc in documents if doc.created_by})
    name_map = await _resolve_user_display_names(unique_user_ids)
    items = [_build_document_response(doc, name_map) for doc in documents]
    logger.info("api_get_entry_documents", entry_id=str(entry_id), total=total)
    return {"documents": items, "total": total, "offset": offset, "limit": limit}


@router.post("/catalogs/{catalog_id}/entries/{entry_id}/documents")
async def assign_documents_to_entry(
    catalog_id: UUID,
    entry_id: UUID,
    body: AssignDocumentRequest,
):
    """将一批文档归入目录条目（幂等操作）"""
    catalog_svc = _get_catalog_service()
    async with AsyncSessionLocal() as db:
        assigned_count = 0
        errors: list[str] = []
        for doc_id in body.document_ids:
            try:
                await catalog_svc.assign_document(db, entry_id, doc_id)
                assigned_count += 1
            except (ValueError, PermissionError) as exc:
                errors.append(f"{doc_id}: {exc}")
        await db.commit()
    logger.info("api_assign_documents_to_entry", entry_id=str(entry_id), assigned=assigned_count, errors=len(errors))
    result: dict[str, Any] = {"assigned_count": assigned_count, "total_requested": len(body.document_ids)}
    if errors:
        result["errors"] = errors
    return result


@router.delete("/catalogs/{catalog_id}/entries/{entry_id}/documents/{document_id}")
async def unassign_document_from_entry(
    catalog_id: UUID,
    entry_id: UUID,
    document_id: UUID,
):
    """从目录条目移除文档归属"""
    catalog_svc = _get_catalog_service()
    async with AsyncSessionLocal() as db:
        removed = await catalog_svc.unassign_document(db, entry_id, document_id)
        await db.commit()
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {document_id} not found in catalog entry {entry_id}",
        )
    logger.info("api_unassign_document_from_entry", entry_id=str(entry_id), document_id=str(document_id))
    return {"detail": "Document unassigned from catalog entry"}


# =============================================================================
# Phase 4: Wiki 发布 API
# =============================================================================

_wiki_service: WikiPublishingService | None = None


def _get_wiki_service() -> WikiPublishingService:
    global _wiki_service
    if _wiki_service is None:
        from .wiki_service import WikiPublishingService

        _wiki_service = WikiPublishingService()
    return _wiki_service


# --- Publication CRUD ---


@router.post("/wiki/publications")
async def create_wiki_publication(
    body: _WikiPubCreateReq,
) -> _WikiPubResp:
    """创建新的 Wiki 发布记录

    初始状态为 draft，需调用 publish 端点后 SSG 应用才能拉取数据。

    错误码：
      - 404 ``CATALOG_NOT_FOUND``：catalog_id 不存在；
      - 400 ``WIKI_PUB_INVALID_PARAM``：theme/slug 等参数不合法；
      - 409 ``WIKI_PUB_CATALOG_LIVE_CONFLICT``：该 catalog 已存在 1 个 LIVE 发布
        （`uq_wiki_pub_catalog_active` 部分唯一索引：每 catalog 仅允许 1 个 LIVE）；
      - 409 ``WIKI_PUB_SLUG_CONFLICT``：该 catalog 下 slug 重复
        （`uq_wiki_pub_catalog_slug` 唯一约束）。
    """
    from negentropy.knowledge.slug import slugify
    from negentropy.models.perception import DocCatalog, WikiPublication

    wiki_svc = _get_wiki_service()

    async with AsyncSessionLocal() as db:
        catalog = await db.get(DocCatalog, body.catalog_id)
        if catalog is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "CATALOG_NOT_FOUND", "message": "Catalog not found"},
            )

        # ------------------------------------------------------------------
        # 业务前置检查（消解 99% 冲突场景，错误信息最清晰）
        # ------------------------------------------------------------------
        live_existing = (
            await db.execute(
                select(WikiPublication.id, WikiPublication.name, WikiPublication.slug)
                .where(
                    WikiPublication.catalog_id == body.catalog_id,
                    WikiPublication.publish_mode == "LIVE",
                )
                .limit(1)
            )
        ).first()
        if live_existing is not None:
            existing_id, existing_name, existing_slug = live_existing
            logger.warning(
                "wiki_pub_conflict_live",
                catalog_id=str(body.catalog_id),
                existing_publication_id=str(existing_id),
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "WIKI_PUB_CATALOG_LIVE_CONFLICT",
                    "message": "该 Catalog 已有一个生效中的 Wiki 发布，请先归档旧发布或在已有发布上编辑。",
                    "details": {
                        "catalog_id": str(body.catalog_id),
                        "existing_publication_id": str(existing_id),
                        "existing_publication_name": existing_name,
                        "existing_publication_slug": existing_slug,
                    },
                },
            )

        # 与 service 内部 slug 归一化逻辑保持一致（避免双重 slugify）
        normalized_slug = body.slug or slugify(body.name)
        slug_existing_id = await db.scalar(
            select(WikiPublication.id)
            .where(
                WikiPublication.catalog_id == body.catalog_id,
                WikiPublication.slug == normalized_slug,
            )
            .limit(1)
        )
        if slug_existing_id is not None:
            logger.warning(
                "wiki_pub_conflict_slug",
                catalog_id=str(body.catalog_id),
                slug=normalized_slug,
                existing_publication_id=str(slug_existing_id),
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "WIKI_PUB_SLUG_CONFLICT",
                    "message": f"该 Catalog 下已存在 slug 为 '{normalized_slug}' 的 Wiki 发布，请更换 slug 后重试。",
                    "details": {
                        "catalog_id": str(body.catalog_id),
                        "slug": normalized_slug,
                        "existing_publication_id": str(slug_existing_id),
                    },
                },
            )

        # ------------------------------------------------------------------
        # 创建 + commit；用 IntegrityError 兜底竞态 / 未来新约束
        # ------------------------------------------------------------------
        try:
            pub = await wiki_svc.create_publication(
                db,
                catalog_id=body.catalog_id,
                app_name=catalog.app_name,
                name=body.name,
                slug=body.slug,
                description=body.description,
                theme=body.theme,
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "WIKI_PUB_INVALID_PARAM", "message": str(exc)},
            ) from exc

        try:
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            err_text = str(exc.orig) if exc.orig is not None else str(exc)
            if "uq_wiki_pub_catalog_active" in err_text:
                code = "WIKI_PUB_CATALOG_LIVE_CONFLICT"
                message = "该 Catalog 已有一个生效中的 Wiki 发布，请先归档旧发布或在已有发布上编辑。"
            elif "uq_wiki_pub_catalog_slug" in err_text:
                code = "WIKI_PUB_SLUG_CONFLICT"
                message = f"该 Catalog 下已存在 slug 为 '{normalized_slug}' 的 Wiki 发布，请更换 slug 后重试。"
            else:
                code = "WIKI_PUB_CONFLICT"
                message = "Wiki 发布创建冲突，请刷新后重试。"
            logger.warning(
                "wiki_pub_conflict_integrity",
                catalog_id=str(body.catalog_id),
                slug=normalized_slug,
                code=code,
                error=err_text,
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": code,
                    "message": message,
                    "details": {
                        "catalog_id": str(body.catalog_id),
                        "slug": normalized_slug,
                    },
                },
            ) from exc

    logger.info("api_create_wiki_pub", pub_id=str(pub.id), catalog_id=str(body.catalog_id))
    resp = _WikiPubResp.model_validate(pub)
    resp.entries_count = 0
    return resp


@router.get("/wiki/publications")
async def list_wiki_publications(
    catalog_id: UUID | None = Query(default=None),
    status: str | None = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
) -> _WikiPubListResp:
    """列出 Wiki 发布记录"""
    wiki_svc = _get_wiki_service()

    async with AsyncSessionLocal() as db:
        pubs, total = await wiki_svc.list_publications(
            db, catalog_id=catalog_id, status=status, offset=offset, limit=limit
        )

        items = []
        for pub in pubs:
            resp = _WikiPubResp.model_validate(pub)
            resp.entries_count = len(pub.entries) if pub.entries else 0
            items.append(resp)

    return _WikiPubListResp(items=items, total=total)


@router.get("/wiki/publications/{pub_id}")
async def get_wiki_publication(pub_id: UUID) -> _WikiPubResp:
    """获取单个 Wiki 发布详情"""
    wiki_svc = _get_wiki_service()

    async with AsyncSessionLocal() as db:
        pub = await wiki_svc.get_publication(db, pub_id)

        if pub is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wiki publication not found")

        resp = _WikiPubResp.model_validate(pub)
        resp.entries_count = len(pub.entries) if pub.entries else 0

    return resp


@router.patch("/wiki/publications/{pub_id}")
async def update_wiki_publication(
    pub_id: UUID,
    body: dict,  # 使用 dict 接受灵活更新字段
):
    """更新 Wiki 发布属性（部分更新）"""
    wiki_svc = _get_wiki_service()

    async with AsyncSessionLocal() as db:
        try:
            pub = await wiki_svc.update_publication(db, pub_id, **body)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

        if pub is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wiki publication not found")
        await db.commit()

    logger.info("api_update_wiki_pub", pub_id=str(pub_id))
    return {"detail": "Publication updated"}


@router.delete("/wiki/publications/{pub_id}")
async def delete_wiki_publication(pub_id: UUID):
    """删除 Wiki 发布（级联删除所有条目）"""
    wiki_svc = _get_wiki_service()

    async with AsyncSessionLocal() as db:
        deleted = await wiki_svc.delete_publication(db, pub_id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wiki publication not found")
        await db.commit()

    logger.info("api_delete_wiki_pub", pub_id=str(pub_id))
    return {"detail": "Publication deleted"}


# --- 发布操作 ---


@router.post("/wiki/publications/{pub_id}/publish")
async def publish_wiki(pub_id: UUID) -> WikiPublishActionResponse:
    """触发发布：将 draft/published 状态转为 published，递增版本号

    SSG 应用 (apps/negentropy-wiki) 在 ISR 再验证窗口内会自动拉取最新数据。
    响应中的 revalidation 字段反映 ISR 主动通知的状态。
    """
    wiki_svc = _get_wiki_service()

    async with AsyncSessionLocal() as db:
        try:
            pub, revalidation_status = await wiki_svc.publish(db, pub_id)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

        if pub is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wiki publication not found")

        entries = await wiki_svc.get_entries(db, pub_id)
        await db.commit()

    logger.info("api_publish_wiki", pub_id=str(pub_id), version=pub.version)

    return WikiPublishActionResponse(
        publication_id=pub.id,
        status=pub.status,
        version=pub.version,
        published_at=pub.published_at,
        entries_count=len(entries),
        message=f"Published successfully (v{pub.version})",
        revalidation=revalidation_status,
    )


@router.post("/wiki/publications/{pub_id}/unpublish")
async def unpublish_wiki(pub_id: UUID) -> WikiPublishActionResponse:
    """取消发布：published → draft"""
    wiki_svc = _get_wiki_service()

    async with AsyncSessionLocal() as db:
        pub, revalidation_status = await wiki_svc.unpublish(db, pub_id)
        if pub is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wiki publication not found")
        entries = await wiki_svc.get_entries(db, pub_id)
        await db.commit()

    return WikiPublishActionResponse(
        publication_id=pub.id,
        status=pub.status,
        version=pub.version,
        published_at=pub.published_at,
        entries_count=len(entries),
        message="Unpublished successfully",
        revalidation=revalidation_status,
    )


# --- 条目管理 ---


@router.get("/wiki/publications/{pub_id}/entries")
async def get_wiki_entries(pub_id: UUID):
    """获取发布的所有条目列表"""
    wiki_svc = _get_wiki_service()

    async with AsyncSessionLocal() as db:
        entries = await wiki_svc.get_entries(db, pub_id)

    items = [
        {
            "id": str(e.id),
            "document_id": str(e.document_id),
            "entry_slug": e.entry_slug,
            "entry_title": e.entry_title,
            "is_index_page": e.is_index_page,
        }
        for e in entries
    ]

    return {"items": items, "total": len(items)}


@router.post(
    "/wiki/publications/{pub_id}/sync-from-catalog",
    response_model=_SyncFromCatalogResp,
)
async def sync_wiki_from_catalog(
    pub_id: UUID,
    body: _SyncFromCatalogReq,
) -> _SyncFromCatalogResp:
    """从 Catalog 节点全量同步文档到 Wiki Publication（幂等）

    递归遍历指定目录节点子树，对状态为 completed 的文档建立 Wiki 条目映射，
    并以 Materialized Path 形式写入 ``entry_path`` 以支撑层级导航。

    **全量同步语义**：不属于本次 ``catalog_node_ids`` 子树的既有条目会被删除。
    同步完成后 SSG 依赖 ISR 窗口自动拉取，非即时可见。
    """
    wiki_svc = _get_wiki_service()

    async with AsyncSessionLocal() as db:
        pub = await wiki_svc.get_publication(db, pub_id)
        if pub is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Wiki publication not found",
            )
        result = await wiki_svc.sync_entries_from_catalog(
            db,
            publication_id=pub_id,
            catalog_node_ids=body.catalog_node_ids,
        )
        await db.commit()

    logger.info(
        "api_wiki_sync_from_catalog",
        pub_id=str(pub_id),
        synced_count=result["synced_count"],
        removed_count=result["removed_count"],
        errors_count=len(result["errors"]),
    )

    return _SyncFromCatalogResp(**result)


@router.get("/wiki/publications/{pub_id}/nav-tree")
async def get_wiki_nav_tree(pub_id: UUID) -> WikiNavTreeResponse:
    """获取 Wiki 导航树结构

    供 SSG 构建时生成侧边栏导航。后端基于 ``entry_path``（Materialized Path）合成
    嵌套树并以 ``{items: [...]}`` 信封返回（详见 ISSUE-017 四阶契约对齐）。
    """
    wiki_svc = _get_wiki_service()

    async with AsyncSessionLocal() as db:
        nav_tree = await wiki_svc.get_nav_tree(db, pub_id)

    return WikiNavTreeResponse(publication_id=pub_id, nav_tree={"items": nav_tree})


@router.get("/wiki/entries/{entry_id}/content")
async def get_wiki_entry_content(entry_id: UUID) -> WikiEntryContentResponse:
    """获取单条 Wiki 条目的 Markdown 内容

    供 SSG 构建时拉取文档内容进行静态渲染。
    """
    wiki_svc = _get_wiki_service()

    async with AsyncSessionLocal() as db:
        content_data = await wiki_svc.get_entry_content(db, entry_id)

    if content_data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wiki entry not found")

    logger.info("api_wiki_entry_content", entry_id=str(entry_id))

    return WikiEntryContentResponse(
        entry_id=entry_id,
        document_id=content_data["document_id"],
        entry_slug="",  # 需要额外查询 entry 表获取
        entry_title=content_data["title"],
        markdown_content=content_data["markdown_content"],
        document_filename=content_data["filename"] or "",
    )


# =============================================================================
# Phase 5: 统一检索 & 语料质量 API
# =============================================================================

_corpus_engine: CorpusEngine | None = None
_retrieval_service: UnifiedRetrievalService | None = None


def _get_corpus_engine() -> CorpusEngine:
    global _corpus_engine
    if _corpus_engine is None:
        from .corpus_engine import CorpusEngine

        _corpus_engine = CorpusEngine()
    return _corpus_engine


def _get_retrieval_service() -> UnifiedRetrievalService:
    global _retrieval_service
    if _retrieval_service is None:
        from .retrieval import UnifiedRetrievalService

        _retrieval_service = UnifiedRetrievalService()
    return _retrieval_service


# --- 语料质量评估 ---


@router.get("/base/{corpus_id}/quality")
async def assess_corpus_quality(corpus_id: UUID) -> _CorpusQualityResp:
    """多维质量评分

    对语料库进行 6 维度质量评估：覆盖度、新鲜度、多样性、信息密度、
    嵌入覆盖率、实体密度。返回综合分数和评级 (excellent/good/fair/poor)。
    """
    engine = _get_corpus_engine()

    async with AsyncSessionLocal() as db:
        result = await engine.assess_quality(db, corpus_id)

    logger.info("api_corpus_quality", corpus_id=str(corpus_id), score=result.get("total_score"))
    return result


@router.post("/base/{corpus_id}/versions")
async def create_corpus_version(
    corpus_id: UUID,
    notes: str | None = Query(default=None),
) -> _CorpusVersionResp:
    """创建语料库版本快照

    记录当前文档数量和质量分数，用于后续对比分析。
    """
    engine = _get_corpus_engine()

    async with AsyncSessionLocal() as db:
        snapshot = await engine.create_version_snapshot(
            db,
            corpus_id=corpus_id,
            notes=notes or "Manual snapshot via API",
            triggered_by="api",
        )
        await db.commit()

    return {
        "id": str(snapshot.id),
        "corpus_id": str(corpus_id),
        "version_number": snapshot.version_number,
        "quality_score": snapshot.quality_score,
        "document_count": snapshot.document_count,
        "diff_summary": snapshot.diff_summary,
        "created_at": snapshot.created_at.isoformat() if snapshot.created_at else None,
    }


@router.get("/base/{corpus_id}/versions")
async def get_corpus_versions(
    corpus_id: UUID,
    limit: int = Query(default=20, ge=1, le=50),
):
    """获取版本历史"""
    engine = _get_corpus_engine()

    async with AsyncSessionLocal() as db:
        versions = await engine.get_version_history(db, corpus_id, limit=limit)

    return {"items": versions}


@router.get("/base/{corpus_id}/suggestions")
async def suggest_cross_references(
    corpus_id: UUID,
    limit: int = Query(default=10, ge=1, le=20),
):
    """跨语料引用推荐

    基于项目内其他语料库的文档信息推荐可能相关的内容。
    """
    engine = _get_corpus_engine()

    async with AsyncSessionLocal() as db:
        suggestions = await engine.suggest_cross_references(db, corpus_id, limit=limit)

    return {"items": suggestions}


# --- 统一检索 ---


@router.post("/unified/search")
async def unified_search(body: _UnifiedSearchReq) -> _UnifiedSearchResp:
    """统一检索入口

    核心特性：
    - 自动意图分类（事实型/探索型/对比型/导航型/图查询型）
    - 分面过滤（corpus_ids / source_types / entity_types / date_range）
    - 排名可解释性（semantic_score / keyword_score / combined_score）
    - 可选引用生成与图谱丰富
    """
    svc = _get_retrieval_service()

    async with AsyncSessionLocal() as db:
        result = await svc.search(
            db,
            query=body.query,
            corpus_ids=body.corpus_ids,
            source_types=body.source_types,
            entity_types=body.entity_types,
            date_from=body.date_from,
            date_to=body.date_to,
            limit=body.limit or 20,
            offset=body.offset or 0,
            include_citations=body.include_citations or False,
            include_entities=body.include_entities or False,
            mode=body.mode,
        )

    logger.info(
        "api_unified_search",
        query=body.query[:80],
        intent=result.get("query_intent"),
        count=len(result.get("items", [])),
    )

    return result


@router.post("/unified/feedback")
async def record_search_feedback(
    feedback_type: str = Query(..., description="click | useful | not_useful"),
    query_text: str | None = Query(default=None),
    document_id: UUID | None = Query(default=None),
):
    """记录检索反馈（用于优化检索质量）"""
    svc = _get_retrieval_service()

    async with AsyncSessionLocal() as db:
        await svc.record_feedback(
            db,
            feedback_type=feedback_type,
            query_text=query_text,
            document_id=document_id,
        )
        await db.commit()

    return {"detail": "Feedback recorded", "feedback_type": feedback_type}
