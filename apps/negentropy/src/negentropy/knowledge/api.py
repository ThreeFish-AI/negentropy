from __future__ import annotations

from typing import Any, Dict, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from negentropy.config import settings
from negentropy.db.session import AsyncSessionLocal
from negentropy.models.perception import Corpus, Knowledge

from .embedding import build_embedding_fn
from .dao import KnowledgeRunDao
from .service import KnowledgeService
from .types import ChunkingConfig, CorpusSpec, SearchConfig

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


class MemoryAuditRequest(BaseModel):
    app_name: Optional[str] = None
    user_id: str
    decisions: Dict[str, str] = Field(default_factory=dict)
    expected_versions: Optional[Dict[str, int]] = None
    note: Optional[str] = None
    idempotency_key: Optional[str] = None


_service: Optional[KnowledgeService] = None
_dao: Optional[KnowledgeRunDao] = None


def _get_service() -> KnowledgeService:
    global _service
    if _service is None:
        _service = KnowledgeService(embedding_fn=build_embedding_fn())
    return _service


def _get_dao() -> KnowledgeRunDao:
    global _dao
    if _dao is None:
        _dao = KnowledgeRunDao()
    return _dao


def _resolve_app_name(app_name: Optional[str]) -> str:
    return app_name or settings.app_name


def _build_chunking_config(
    *,
    chunk_size: Optional[int],
    overlap: Optional[int],
    preserve_newlines: Optional[bool],
) -> Optional[ChunkingConfig]:
    if chunk_size is None and overlap is None and preserve_newlines is None:
        return None
    return ChunkingConfig(
        chunk_size=chunk_size or 800,
        overlap=overlap or 100,
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
    service = _get_service()
    chunking_config = _build_chunking_config(
        chunk_size=payload.chunk_size,
        overlap=payload.overlap,
        preserve_newlines=payload.preserve_newlines,
    )
    records = await service.ingest_text(
        corpus_id=corpus_id,
        app_name=_resolve_app_name(payload.app_name),
        text=payload.text,
        source_uri=payload.source_uri,
        metadata=payload.metadata,
        chunking_config=chunking_config,
    )
    return {"count": len(records), "items": [r.id for r in records]}


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
    service = _get_service()
    config = SearchConfig(
        mode=payload.mode or "hybrid",
        limit=payload.limit or 20,
        semantic_weight=payload.semantic_weight or 0.7,
        keyword_weight=payload.keyword_weight or 0.3,
        metadata_filter=payload.metadata_filter,
    )
    matches = await service.search(
        corpus_id=corpus_id,
        app_name=_resolve_app_name(payload.app_name),
        query=payload.query,
        config=config,
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


@router.get("/memory")
async def get_memory(app_name: Optional[str] = Query(default=None)) -> Dict[str, Any]:
    resolved_app = _resolve_app_name(app_name)
    dao = _get_dao()
    audits = await dao.list_memory_audits(resolved_app, limit=100)
    return {
        "users": [],
        "timeline": [],
        "policies": {},
        "audits": [
            {
                "memory_id": audit.memory_id,
                "decision": audit.decision,
                "note": audit.note,
                "version": audit.version,
                "created_at": audit.created_at.isoformat() if audit.created_at else None,
            }
            for audit in audits
        ],
    }


@router.post("/memory/audit")
async def audit_memory(payload: MemoryAuditRequest) -> Dict[str, Any]:
    resolved_app = _resolve_app_name(payload.app_name)
    dao = _get_dao()
    try:
        audits = await dao.record_memory_audits(
            app_name=resolved_app,
            user_id=payload.user_id,
            decisions=payload.decisions,
            idempotency_key=payload.idempotency_key,
            expected_versions=payload.expected_versions,
            note=payload.note,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {
        "status": "ok",
        "audits": [
            {
                "memory_id": audit.memory_id,
                "decision": audit.decision,
                "version": audit.version,
                "created_at": audit.created_at.isoformat() if audit.created_at else None,
            }
            for audit in audits
        ],
    }


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
