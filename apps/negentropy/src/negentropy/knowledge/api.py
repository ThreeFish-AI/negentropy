from __future__ import annotations

import json
from typing import Any, Dict, Optional
from uuid import UUID

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import func, select

from negentropy.config import settings
from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.perception import Corpus, Knowledge

from .constants import (
    DEFAULT_CHUNK_SIZE,
    DEFAULT_KEYWORD_WEIGHT,
    DEFAULT_OVERLAP,
    DEFAULT_SEARCH_LIMIT,
    DEFAULT_SEMANTIC_WEIGHT,
)
from .embedding import build_batch_embedding_fn, build_embedding_fn
from .dao import KnowledgeRunDao
from .exceptions import (
    CorpusNotFound,
    DatabaseError,
    EmbeddingFailed,
    InvalidChunkSize,
    InvalidSearchConfig,
    KnowledgeError,
    SearchError,
    ValidationError as KnowledgeValidationError,
    VersionConflict,
)
from .graph_service import GraphService, GraphBuildConfig, GraphQueryConfig, get_graph_service
from .service import KnowledgeService
from .types import ChunkingConfig, CorpusSpec, SearchConfig, GraphSearchConfig


logger = get_logger("negentropy.knowledge.api")
router = APIRouter(prefix="/knowledge", tags=["knowledge"])


class CorpusCreateRequest(BaseModel):
    app_name: Optional[str] = None
    name: str
    description: Optional[str] = None
    config: Dict[str, Any] = Field(default_factory=dict)


class CorpusUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None


class CorpusResponse(BaseModel):
    id: UUID
    app_name: str
    name: str
    description: Optional[str] = None
    config: Dict[str, Any] = Field(default_factory=dict)
    knowledge_count: int = 0


class IngestRequest(BaseModel):
    app_name: Optional[str] = None
    text: str
    source_uri: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    chunk_size: Optional[int] = None
    overlap: Optional[int] = None
    preserve_newlines: Optional[bool] = None


class IngestUrlRequest(BaseModel):
    app_name: Optional[str] = None
    url: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    chunk_size: Optional[int] = None
    overlap: Optional[int] = None
    preserve_newlines: Optional[bool] = None


class ReplaceSourceRequest(BaseModel):
    app_name: Optional[str] = None
    text: str
    source_uri: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    chunk_size: Optional[int] = None
    overlap: Optional[int] = None
    preserve_newlines: Optional[bool] = None


class SyncSourceRequest(BaseModel):
    app_name: Optional[str] = None
    source_uri: str
    chunk_size: Optional[int] = None
    overlap: Optional[int] = None
    preserve_newlines: Optional[bool] = None


class SearchRequest(BaseModel):
    app_name: Optional[str] = None
    query: str
    mode: Optional[str] = None
    limit: Optional[int] = None
    semantic_weight: Optional[float] = None
    keyword_weight: Optional[float] = None
    metadata_filter: Optional[Dict[str, Any]] = None


class DashboardResponse(BaseModel):
    corpus_count: int
    knowledge_count: int
    last_build_at: Optional[str] = None
    pipeline_runs: list[Dict[str, Any]] = Field(default_factory=list)
    alerts: list[Dict[str, Any]] = Field(default_factory=list)


class GraphPayload(BaseModel):
    nodes: list[Dict[str, Any]] = Field(default_factory=list)
    edges: list[Dict[str, Any]] = Field(default_factory=list)
    runs: list[Dict[str, Any]] = Field(default_factory=list)


class GraphUpsertRequest(BaseModel):
    app_name: Optional[str] = None
    run_id: str
    status: str = "pending"
    graph: GraphPayload
    idempotency_key: Optional[str] = None
    expected_version: Optional[int] = None


class PipelinesUpsertRequest(BaseModel):
    app_name: Optional[str] = None
    run_id: str
    status: str = "pending"
    payload: Dict[str, Any] = Field(default_factory=dict)
    idempotency_key: Optional[str] = None
    expected_version: Optional[int] = None


# Graph API Request/Response Models
class GraphBuildRequest(BaseModel):
    """图谱构建请求"""

    app_name: Optional[str] = None
    enable_llm_extraction: bool = True
    llm_model: Optional[str] = None
    min_entity_confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    min_relation_confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    batch_size: int = Field(default=10, ge=1, le=100)


class GraphBuildResponse(BaseModel):
    """图谱构建响应"""

    run_id: str
    corpus_id: UUID
    status: str
    entity_count: int
    relation_count: int
    chunks_processed: int
    elapsed_seconds: float
    error_message: Optional[str] = None


class GraphSearchRequest(BaseModel):
    """图谱检索请求"""

    app_name: Optional[str] = None
    query: str
    mode: str = "hybrid"  # semantic, graph, hybrid
    limit: int = Field(default=20, ge=1, le=100)
    max_depth: int = Field(default=2, ge=1, le=5)
    semantic_weight: float = Field(default=0.6, ge=0.0, le=1.0)
    graph_weight: float = Field(default=0.4, ge=0.0, le=1.0)
    include_neighbors: bool = True
    neighbor_limit: int = Field(default=10, ge=1, le=50)


class GraphSearchResponse(BaseModel):
    """图谱检索响应"""

    count: int
    query_time_ms: float
    items: list[Dict[str, Any]] = Field(default_factory=list)


class GraphNeighborsRequest(BaseModel):
    """邻居查询请求"""

    app_name: Optional[str] = None
    entity_id: str
    max_depth: int = Field(default=2, ge=1, le=5)
    limit: int = Field(default=100, ge=1, le=500)


class GraphPathRequest(BaseModel):
    """路径查询请求"""

    app_name: Optional[str] = None
    source_id: str
    target_id: str
    max_depth: int = Field(default=5, ge=1, le=10)


_service: Optional[KnowledgeService] = None
_dao: Optional[KnowledgeRunDao] = None
_graph_service: Optional[GraphService] = None


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


def _resolve_app_name(app_name: Optional[str]) -> str:
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
    *,
    chunk_size: Optional[int],
    overlap: Optional[int],
    preserve_newlines: Optional[bool],
) -> Optional[ChunkingConfig]:
    """构建分块配置

    使用常量而非魔法数字，遵循 Single Source of Truth 原则。
    """
    if chunk_size is None and overlap is None and preserve_newlines is None:
        return None
    return ChunkingConfig(
        chunk_size=chunk_size or DEFAULT_CHUNK_SIZE,
        overlap=overlap or DEFAULT_OVERLAP,
        preserve_newlines=True if preserve_newlines is None else preserve_newlines,
    )


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(app_name: Optional[str] = Query(default=None)) -> DashboardResponse:
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
async def list_corpora(app_name: Optional[str] = Query(default=None)) -> list[CorpusResponse]:
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
            config=corpus.config or {},
            knowledge_count=count or 0,
        )
        for corpus, count in rows
    ]


@router.post("/base", response_model=CorpusResponse)
async def create_corpus(payload: CorpusCreateRequest) -> CorpusResponse:
    service = _get_service()
    spec = CorpusSpec(
        app_name=_resolve_app_name(payload.app_name),
        name=payload.name,
        description=payload.description,
        config=payload.config,
    )
    corpus = await service.ensure_corpus(spec=spec)
    return CorpusResponse(
        id=corpus.id,
        app_name=corpus.app_name,
        name=corpus.name,
        description=corpus.description,
        config=corpus.config,
        knowledge_count=0,
    )


@router.get("/base/{corpus_id}", response_model=CorpusResponse)
async def get_corpus(corpus_id: UUID, app_name: Optional[str] = Query(default=None)) -> CorpusResponse:
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
        config=corpus.config or {},
        knowledge_count=count or 0,
    )


@router.patch("/base/{corpus_id}", response_model=CorpusResponse)
async def update_corpus(corpus_id: UUID, payload: CorpusUpdateRequest) -> CorpusResponse:
    service = _get_service()
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    try:
        corpus = await service.update_corpus(corpus_id=corpus_id, spec=update_data)
        # Fetch knowledge count separately since update doesn't return it
        dao = _get_dao()
        # Optimization: Reuse existing count logic or separate query
        # For simplicity, returning 0 or fetching count if critical.
        # API expects knowledge_count.

        # We need to fetch count to adhere to response model
        async with AsyncSessionLocal() as db:
            knowledge_count = await db.scalar(
                select(func.count()).select_from(Knowledge).where(Knowledge.corpus_id == corpus.id)
            )

        return CorpusResponse(
            id=corpus.id,
            app_name=corpus.app_name,
            name=corpus.name,
            description=corpus.description,
            config=corpus.config or {},
            knowledge_count=knowledge_count or 0,
        )
    except KnowledgeError as exc:
        raise _map_exception_to_http(exc) from exc


@router.delete("/base/{corpus_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_corpus(corpus_id: UUID, app_name: Optional[str] = Query(default=None)) -> None:
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


@router.post("/base/{corpus_id}/ingest")
async def ingest_text(corpus_id: UUID, payload: IngestRequest) -> Dict[str, Any]:
    """索引文本到知识库

    集成统一异常处理和结构化日志。
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

        # 构建配置：请求参数 > corpus 配置 > 默认值
        chunk_size = payload.chunk_size or corpus_config.get("chunk_size")
        overlap = payload.overlap or corpus_config.get("overlap")
        preserve_newlines = payload.preserve_newlines
        if preserve_newlines is None:
            preserve_newlines = corpus_config.get("preserve_newlines")

        chunking_config = _build_chunking_config(
            chunk_size=chunk_size,
            overlap=overlap,
            preserve_newlines=preserve_newlines,
        )
        records = await service.ingest_text(
            corpus_id=corpus_id,
            app_name=resolved_app,
            text=payload.text,
            source_uri=payload.source_uri,
            metadata=payload.metadata,
            chunking_config=chunking_config,
        )

        logger.info(
            "api_ingest_completed",
            corpus_id=str(corpus_id),
            record_count=len(records),
        )

        return {"count": len(records), "items": [r.id for r in records]}

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
    app_name: Optional[str] = Query(default=None),
    source_uri: Optional[str] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> Dict[str, Any]:
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

    knowledge_items, total_count, source_stats = await service.list_knowledge(
        corpus_id=corpus_id,
        app_name=resolved_app,
        source_uri=source_uri,
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
    }


@router.post("/base/{corpus_id}/ingest_url")
async def ingest_url(corpus_id: UUID, payload: IngestUrlRequest) -> Dict[str, Any]:
    """Fetch content from URL and ingest into knowledge base."""
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

        # 构建配置：请求参数 > corpus 配置 > 默认值
        chunk_size = payload.chunk_size or corpus_config.get("chunk_size")
        overlap = payload.overlap or corpus_config.get("overlap")
        preserve_newlines = payload.preserve_newlines
        if preserve_newlines is None:
            preserve_newlines = corpus_config.get("preserve_newlines")

        chunking_config = _build_chunking_config(
            chunk_size=chunk_size,
            overlap=overlap,
            preserve_newlines=preserve_newlines,
        )
        records = await service.ingest_url(
            corpus_id=corpus_id,
            app_name=resolved_app,
            url=payload.url,
            metadata=payload.metadata,
            chunking_config=chunking_config,
        )

        logger.info(
            "api_ingest_url_completed",
            corpus_id=str(corpus_id),
            record_count=len(records),
        )

        return {"count": len(records), "items": [r.id for r in records]}

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


@router.post("/base/{corpus_id}/ingest_file")
async def ingest_file(
    corpus_id: UUID,
    file: UploadFile = File(...),
    app_name: Optional[str] = Form(default=None),
    source_uri: Optional[str] = Form(default=None),
    metadata: Optional[str] = Form(default=None),
    chunk_size: Optional[int] = Form(default=None),
    overlap: Optional[int] = Form(default=None),
    preserve_newlines: Optional[bool] = Form(default=None),
) -> Dict[str, Any]:
    """从上传文件导入内容到知识库

    支持格式: .txt, .md, .markdown, .pdf

    流程:
    1. 验证文件类型和大小
    2. 提取文本内容
    3. 调用 ingest_text 完成分块和向量化

    Args:
        corpus_id: 知识库 ID
        file: 上传的文件
        app_name: 应用名称（可选）
        source_uri: 来源 URI（可选，默认使用文件名）
        metadata: 元数据 JSON 字符串（可选）
        chunk_size: 分块大小（可选）
        overlap: 分块重叠（可选）
        preserve_newlines: 是否保留换行（可选）

    Returns:
        Dict: {"count": 分块数量, "items": [分块 ID 列表]}

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
        meta: Dict[str, Any] = {}
        if metadata:
            try:
                meta = json.loads(metadata)
            except json.JSONDecodeError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"code": "INVALID_METADATA", "message": "metadata must be valid JSON"},
                ) from exc

        # 提取文本
        from .content import extract_file_content, sanitize_filename

        # 清理文件名（防止路径遍历）
        safe_filename = sanitize_filename(file.filename)

        text = await extract_file_content(
            content=content,
            filename=safe_filename,
            content_type=file.content_type,
        )

        if not text.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "EMPTY_CONTENT", "message": "No text content extracted from file"},
            )

        # 使用 source_uri 参数或清理后的文件名
        final_source_uri = source_uri or safe_filename

        # 获取服务并执行摄入
        service = _get_service()
        corpus = await service.get_corpus_by_id(corpus_id)
        corpus_config = corpus.config if corpus else {}

        # 构建分块配置
        final_chunk_size = chunk_size or corpus_config.get("chunk_size")
        final_overlap = overlap or corpus_config.get("overlap")
        final_preserve_newlines = preserve_newlines
        if final_preserve_newlines is None:
            final_preserve_newlines = corpus_config.get("preserve_newlines")

        chunking_config = _build_chunking_config(
            chunk_size=final_chunk_size,
            overlap=final_overlap,
            preserve_newlines=final_preserve_newlines,
        )

        # 添加文件元数据
        meta["original_filename"] = safe_filename
        meta["content_type"] = file.content_type
        meta["file_size"] = len(content)

        # 调用现有的 ingest_text
        records = await service.ingest_text(
            corpus_id=corpus_id,
            app_name=resolved_app,
            text=text,
            source_uri=final_source_uri,
            metadata=meta,
            chunking_config=chunking_config,
        )

        logger.info(
            "api_ingest_file_completed",
            corpus_id=str(corpus_id),
            filename=file.filename,
            record_count=len(records),
        )

        return {"count": len(records), "items": [r.id for r in records]}

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


@router.post("/base/{corpus_id}/replace_source")
async def replace_source(corpus_id: UUID, payload: ReplaceSourceRequest) -> Dict[str, Any]:
    service = _get_service()
    chunking_config = _build_chunking_config(
        chunk_size=payload.chunk_size,
        overlap=payload.overlap,
        preserve_newlines=payload.preserve_newlines,
    )
    records = await service.replace_source(
        corpus_id=corpus_id,
        app_name=_resolve_app_name(payload.app_name),
        text=payload.text,
        source_uri=payload.source_uri,
        metadata=payload.metadata,
        chunking_config=chunking_config,
    )
    return {"count": len(records), "items": [r.id for r in records]}


@router.post("/base/{corpus_id}/sync_source")
async def sync_source(corpus_id: UUID, payload: SyncSourceRequest) -> Dict[str, Any]:
    """Re-ingest a URL source with latest content.

    重新从原始 URL 拉取内容并执行完整的 Ingest 流程：
    Fetch → Delete old chunks → Chunking → Embedding → Persist

    Args:
        corpus_id: 知识库 ID
        payload: 包含 source_uri（必须是有效的 URL）

    Returns:
        Dict: {"count": 新 chunks 数量, "items": [chunk_ids]}

    Raises:
        400: source_uri 不是有效的 URL
        500: 内容获取或处理失败
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

        # 构建配置：请求参数 > corpus 配置 > 默认值
        chunk_size = payload.chunk_size or corpus_config.get("chunk_size")
        overlap = payload.overlap or corpus_config.get("overlap")
        preserve_newlines = payload.preserve_newlines
        if preserve_newlines is None:
            preserve_newlines = corpus_config.get("preserve_newlines")

        chunking_config = _build_chunking_config(
            chunk_size=chunk_size,
            overlap=overlap,
            preserve_newlines=preserve_newlines,
        )
        records = await service.sync_source(
            corpus_id=corpus_id,
            app_name=resolved_app,
            source_uri=source_uri,
            chunking_config=chunking_config,
        )

        logger.info(
            "api_sync_source_completed",
            corpus_id=str(corpus_id),
            source_uri=source_uri,
            record_count=len(records),
        )

        return {"count": len(records), "items": [r.id for r in records]}

    except KnowledgeError as exc:
        raise _map_exception_to_http(exc) from exc
    except ValidationError as exc:
        logger.warning("pydantic_validation_error", errors=exc.errors())
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": "Invalid request parameters", "errors": exc.errors()},
        ) from exc


@router.post("/base/{corpus_id}/search")
async def search(corpus_id: UUID, payload: SearchRequest) -> Dict[str, Any]:
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
async def get_graph(app_name: Optional[str] = Query(default=None)) -> Dict[str, Any]:
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
async def upsert_graph(payload: GraphUpsertRequest) -> Dict[str, Any]:
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


@router.get("/pipelines")
async def get_pipelines(app_name: Optional[str] = Query(default=None)) -> Dict[str, Any]:
    resolved_app = _resolve_app_name(app_name)
    dao = _get_dao()
    runs = await dao.list_pipeline_runs(resolved_app, limit=50)
    return {
        "runs": [
            {
                "id": str(run.id),
                "run_id": run.run_id,
                "status": run.status,
                "version": run.version,
                **(run.payload or {}),
            }
            for run in runs
        ],
        "last_updated_at": runs[0].updated_at.isoformat() if runs else None,
    }


@router.post("/pipelines")
async def upsert_pipelines(payload: PipelinesUpsertRequest) -> Dict[str, Any]:
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
    return {"status": result.status, "pipeline": result.record}


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
        knowledge_items, total_count, _ = await service.list_knowledge(
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


@router.get("/base/{corpus_id}/graph", response_model=Dict[str, Any])
async def get_corpus_graph(
    corpus_id: UUID,
    app_name: Optional[str] = Query(default=None),
    include_runs: bool = Query(default=False),
) -> Dict[str, Any]:
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
) -> Dict[str, Any]:
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
) -> Dict[str, Any]:
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
    app_name: Optional[str] = Query(default=None),
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
    app_name: Optional[str] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
) -> Dict[str, Any]:
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


class ApiStatsResponse(BaseModel):
    """API 统计响应模型"""

    total_calls: int = Field(description="总调用次数")
    success_count: int = Field(description="成功调用次数")
    failed_count: int = Field(description="失败调用次数")
    avg_latency_ms: float = Field(description="平均延迟（毫秒）")


@router.get("/stats", response_model=ApiStatsResponse)
async def get_api_stats(
    app_name: Optional[str] = Query(default=None),
    period_hours: int = Query(default=24, ge=1, le=720, description="统计周期（小时）"),
    endpoint: Optional[str] = Query(default=None, description="API endpoint ID (如 search, ingest)"),
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

    from sqlalchemy import and_, func as sql_func, or_, select

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

        stmt = (
            select(
                sql_func.count().label("total_calls"),
                sql_func.count().filter(Trace.status_code == "OK").label("success_count"),
                sql_func.count().filter(Trace.status_code != "OK").label("failed_count"),
                sql_func.avg(Trace.duration_ns).label("avg_duration_ns"),
            )
            .where(and_(*conditions))
        )

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
