from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from negentropy.config import settings
from negentropy.db.session import AsyncSessionLocal
from negentropy.models.perception import Corpus, Knowledge
from negentropy.models.pulse import AppState, UserState

from .embedding import build_embedding_fn
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
    graph: GraphPayload


class PipelinesUpsertRequest(BaseModel):
    app_name: Optional[str] = None
    runs: list[Dict[str, Any]] = Field(default_factory=list)
    last_updated_at: Optional[str] = None


class MemoryUpsertRequest(BaseModel):
    app_name: Optional[str] = None
    users: list[Dict[str, Any]] = Field(default_factory=list)
    timeline: list[Dict[str, Any]] = Field(default_factory=list)
    policies: Dict[str, Any] = Field(default_factory=dict)


class MemoryAuditRequest(BaseModel):
    app_name: Optional[str] = None
    user_id: str
    decisions: Dict[str, str] = Field(default_factory=dict)
    note: Optional[str] = None


_service: Optional[KnowledgeService] = None


def _get_service() -> KnowledgeService:
    global _service
    if _service is None:
        _service = KnowledgeService(embedding_fn=build_embedding_fn())
    return _service


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


async def _load_app_state(app_name: str) -> AppState:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(AppState).where(AppState.app_name == app_name))
        state = result.scalar_one_or_none()
        if state is None:
            state = AppState(app_name=app_name, state={})
            db.add(state)
            await db.commit()
            await db.refresh(state)
        return state


async def _update_app_state(app_name: str, updater: callable) -> Dict[str, Any]:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(AppState).where(AppState.app_name == app_name))
        state = result.scalar_one_or_none()
        if state is None:
            state = AppState(app_name=app_name, state={})
            db.add(state)
        state_dict = state.state or {}
        state.state = updater(state_dict)
        await db.commit()
        await db.refresh(state)
        return state.state or {}


async def _load_user_state(app_name: str, user_id: str) -> UserState:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(UserState).where(UserState.app_name == app_name, UserState.user_id == user_id)
        )
        state = result.scalar_one_or_none()
        if state is None:
            state = UserState(app_name=app_name, user_id=user_id, state={})
            db.add(state)
            await db.commit()
            await db.refresh(state)
        return state


async def _update_user_state(app_name: str, user_id: str, updater: callable) -> Dict[str, Any]:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(UserState).where(UserState.app_name == app_name, UserState.user_id == user_id)
        )
        state = result.scalar_one_or_none()
        if state is None:
            state = UserState(app_name=app_name, user_id=user_id, state={})
            db.add(state)
        state_dict = state.state or {}
        state.state = updater(state_dict)
        await db.commit()
        await db.refresh(state)
        return state.state or {}


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(app_name: Optional[str] = Query(default=None)) -> DashboardResponse:
    resolved_app = _resolve_app_name(app_name)
    app_state = await _load_app_state(resolved_app)
    knowledge_state = (app_state.state or {}).get("knowledge", {})
    pipeline_runs = knowledge_state.get("pipelines", {}).get("runs", [])
    alerts = knowledge_state.get("alerts", [])
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
    state = await _load_app_state(resolved_app)
    knowledge_state = (state.state or {}).get("knowledge", {})
    graph = knowledge_state.get("graph", {})
    return {
        "nodes": graph.get("nodes", []),
        "edges": graph.get("edges", []),
        "runs": graph.get("runs", []),
    }


@router.post("/graph")
async def upsert_graph(payload: GraphUpsertRequest) -> Dict[str, Any]:
    resolved_app = _resolve_app_name(payload.app_name)

    def updater(state: Dict[str, Any]) -> Dict[str, Any]:
        knowledge_state = state.get("knowledge", {})
        knowledge_state["graph"] = payload.graph.model_dump()
        knowledge_state["last_updated_at"] = datetime.now(timezone.utc).isoformat()
        state["knowledge"] = knowledge_state
        return state

    new_state = await _update_app_state(resolved_app, updater)
    return {"status": "ok", "graph": new_state.get("knowledge", {}).get("graph", {})}


@router.get("/memory")
async def get_memory(app_name: Optional[str] = Query(default=None)) -> Dict[str, Any]:
    resolved_app = _resolve_app_name(app_name)
    state = await _load_app_state(resolved_app)
    knowledge_state = (state.state or {}).get("knowledge", {})
    memory_state = knowledge_state.get("memory", {})
    return {
        "users": memory_state.get("users", []),
        "timeline": memory_state.get("timeline", []),
        "policies": memory_state.get("policies", {}),
    }


@router.post("/memory")
async def upsert_memory(payload: MemoryUpsertRequest) -> Dict[str, Any]:
    resolved_app = _resolve_app_name(payload.app_name)

    def updater(state: Dict[str, Any]) -> Dict[str, Any]:
        knowledge_state = state.get("knowledge", {})
        knowledge_state["memory"] = {
            "users": payload.users,
            "timeline": payload.timeline,
            "policies": payload.policies,
        }
        knowledge_state["last_updated_at"] = datetime.now(timezone.utc).isoformat()
        state["knowledge"] = knowledge_state
        return state

    new_state = await _update_app_state(resolved_app, updater)
    return {"status": "ok", "memory": new_state.get("knowledge", {}).get("memory", {})}


@router.post("/memory/audit")
async def audit_memory(payload: MemoryAuditRequest) -> Dict[str, Any]:
    resolved_app = _resolve_app_name(payload.app_name)
    user_id = payload.user_id

    def updater(state: Dict[str, Any]) -> Dict[str, Any]:
        knowledge_state = state.get("knowledge", {})
        audits = knowledge_state.get("memory_audits", {})
        audits.update(payload.decisions)
        knowledge_state["memory_audits"] = audits
        knowledge_state["audit_note"] = payload.note
        knowledge_state["audit_updated_at"] = datetime.now(timezone.utc).isoformat()
        state["knowledge"] = knowledge_state
        return state

    new_state = await _update_user_state(resolved_app, user_id, updater)
    return {"status": "ok", "audits": new_state.get("knowledge", {}).get("memory_audits", {})}


@router.get("/pipelines")
async def get_pipelines(app_name: Optional[str] = Query(default=None)) -> Dict[str, Any]:
    resolved_app = _resolve_app_name(app_name)
    state = await _load_app_state(resolved_app)
    knowledge_state = (state.state or {}).get("knowledge", {})
    pipelines = knowledge_state.get("pipelines", {})
    return {
        "runs": pipelines.get("runs", []),
        "last_updated_at": pipelines.get("last_updated_at"),
    }


@router.post("/pipelines")
async def upsert_pipelines(payload: PipelinesUpsertRequest) -> Dict[str, Any]:
    resolved_app = _resolve_app_name(payload.app_name)

    def updater(state: Dict[str, Any]) -> Dict[str, Any]:
        knowledge_state = state.get("knowledge", {})
        knowledge_state["pipelines"] = {
            "runs": payload.runs,
            "last_updated_at": payload.last_updated_at or datetime.now(timezone.utc).isoformat(),
        }
        knowledge_state["last_updated_at"] = datetime.now(timezone.utc).isoformat()
        state["knowledge"] = knowledge_state
        return state

    new_state = await _update_app_state(resolved_app, updater)
    return {"status": "ok", "pipelines": new_state.get("knowledge", {}).get("pipelines", {})}
