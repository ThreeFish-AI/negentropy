from __future__ import annotations

from typing import Any, Dict, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
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
from .service import KnowledgeService
from .types import ChunkingConfig, CorpusSpec, SearchConfig


logger = get_logger("negentropy.knowledge.api")
router = APIRouter(prefix="/knowledge", tags=["knowledge"])


class CorpusCreateRequest(BaseModel):
    app_name: Optional[str] = None
    name: str
    description: Optional[str] = None
    config: Dict[str, Any] = Field(default_factory=dict)


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


class ReplaceSourceRequest(BaseModel):
    app_name: Optional[str] = None
    text: str
    source_uri: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
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


_service: Optional[KnowledgeService] = None
_dao: Optional[KnowledgeRunDao] = None


def _get_service() -> KnowledgeService:
    global _service
    if _service is None:
        _service = KnowledgeService(
            embedding_fn=build_embedding_fn(),
            batch_embedding_fn=build_batch_embedding_fn(),
        )
    return _service


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
        chunking_config = _build_chunking_config(
            chunk_size=payload.chunk_size,
            overlap=payload.overlap,
            preserve_newlines=payload.preserve_newlines,
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
