from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, Any
from uuid import UUID

from fastapi import BackgroundTasks, HTTPException, status
from pydantic import ValidationError  # noqa: F401
from sqlalchemy import select

from negentropy.config import settings
from negentropy.db.session import AsyncSessionLocal
from negentropy.knowledge.types import KnowledgeRecord
from negentropy.logging import get_logger
from negentropy.models.perception import Knowledge
from negentropy.models.plugin import McpServer, McpTool
from negentropy.models.pulse import UserState

from .dao import KnowledgeRunDao
from .graph.entity_service import KgEntityService
from .graph.service import GraphService, get_graph_service
from .ingestion.embedding import build_batch_embedding_fn, build_embedding_fn
from .ingestion.extraction import (
    extract_source,
    get_chunking_config_only,
    merge_corpus_config,
    resolve_source_kind,
    store_extracted_document_artifacts,
)

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
from .schemas import (  # noqa: F401
    ApiStatsResponse,
    ArchiveSourceRequest,
    ArchiveSourceResponse,
    AsyncPipelineResponse,
    CorpusCreateRequest,
    CorpusResponse,
    CorpusUpdateRequest,
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
    GraphPayload,
    GraphQualityResponse,
    GraphSearchRequest,
    GraphSearchResponse,
    GraphStatsResponse,
    GraphTimelineBucket,
    GraphTimelineResponse,
    GraphUpsertRequest,
    IngestRequest,
    IngestUrlRequest,
    KnowledgePipelinesResponse,
    MultiHopEvidenceChainItem,
    MultiHopEvidenceEdgeItem,
    MultiHopReasonRequest,
    MultiHopReasonResponse,
    PipelineCancelRequest,
    PipelineCancelResponse,
    PipelineRunRecordResponse,
    PipelinesResponse,
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
    chunking_config_summary,
    normalize_chunking_config,
    serialize_chunking_config,
)

if TYPE_CHECKING:
    from .lifecycle.catalog_service import CatalogService
    from .lifecycle.corpus_engine import CorpusEngine
    from .lifecycle.wiki_service import WikiPublishingService
    from .retrieval.unified_search import UnifiedRetrievalService

logger = get_logger("negentropy.knowledge.api")
# Router is defined in each route module and aggregated in api.py

# Fire-and-forget 后台任务强引用持有器（与 paper_kg_pipeline._BACKGROUND_TASKS 同型）
_KG_BUILD_BG_TASKS: set[asyncio.Task[None]] = set()


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


# ── Additional singleton getters (originally scattered in route modules) ──

_kg_entity_service: KgEntityService | None = None
_catalog_service: CatalogService | None = None
_wiki_service: WikiPublishingService | None = None
_corpus_engine: CorpusEngine | None = None
_retrieval_service: UnifiedRetrievalService | None = None


def _get_kg_entity_service() -> KgEntityService:
    global _kg_entity_service
    if _kg_entity_service is None:
        _kg_entity_service = KgEntityService()
    return _kg_entity_service


def _get_catalog_service() -> CatalogService:
    global _catalog_service
    if _catalog_service is None:
        from .lifecycle.catalog_service import CatalogService

        _catalog_service = CatalogService()
    return _catalog_service


def _get_wiki_service() -> WikiPublishingService:
    global _wiki_service
    if _wiki_service is None:
        from .lifecycle.wiki_service import WikiPublishingService

        _wiki_service = WikiPublishingService()
    return _wiki_service


# --- Publication CRUD ---


def _get_corpus_engine() -> CorpusEngine:
    global _corpus_engine
    if _corpus_engine is None:
        from .lifecycle.corpus_engine import CorpusEngine

        _corpus_engine = CorpusEngine()
    return _corpus_engine


def _get_retrieval_service() -> UnifiedRetrievalService:
    global _retrieval_service
    if _retrieval_service is None:
        from .retrieval.unified_search import UnifiedRetrievalService

        _retrieval_service = UnifiedRetrievalService()
    return _retrieval_service


# --- 语料质量评估 ---


# ── Document helpers (shared with catalog, chunks, etc.) ─────


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


def _build_document_response(
    doc,
    name_map: dict[str, str],
    *,
    archived: bool = False,
) -> DocumentResponse:
    """从 ORM 文档对象构建 DocumentResponse，注入用户显示名与归档状态。"""
    return DocumentResponse(
        id=doc.id,
        corpus_id=doc.corpus_id,
        app_name=doc.app_name,
        file_hash=doc.file_hash,
        original_filename=doc.original_filename,
        display_name=getattr(doc, "display_name", None),
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
        archived=archived,
        metadata=doc.metadata_ or {},
    )


async def _resolve_documents_archived_set(
    docs: list,
    app_name: str,
) -> set[tuple[UUID, str]]:
    """批量解析一批文档的归档状态，返回已归档的 ``(corpus_id, source_uri)`` 集合。

    单一事实源——复用与 ``SourceSummary.archived`` 同款聚合逻辑，避免前端做映射。
    若 ``source_uri`` 无法解析（极端老数据），该文档默认按未归档处理。
    """
    pairs: list[tuple[UUID, str]] = []
    seen: set[tuple[UUID, str]] = set()
    for doc in docs:
        source_uri = _resolve_document_source_uri(doc)
        if not source_uri:
            continue
        key = (doc.corpus_id, source_uri)
        if key in seen:
            continue
        seen.add(key)
        pairs.append(key)

    if not pairs:
        return set()

    service = _get_service()
    return await service.get_archived_source_uris(pairs=pairs, app_name=app_name)


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
