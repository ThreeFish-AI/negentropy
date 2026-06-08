"""Auto-extracted route module: Corpus CRUD + Quality/Versions/Suggestions."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status
from pydantic import ValidationError  # noqa: F401
from sqlalchemy import func, select

from negentropy.db.session import AsyncSessionLocal
from negentropy.knowledge._shared import (
    _enqueue_embedding_rebuild,
    _extract_dimension_from_row_config,
    _get_corpus_engine,
    _get_service,
    _has_explicit_extractor_routes,
    _pin_default_embedding_config,
    _resolve_default_extractor_routes,
    _resolve_embedding_dimension,
    _serialize_corpus_config,
    _validate_models_references,
)
from negentropy.knowledge.api_helpers import _map_exception_to_http, _resolve_app_name
from negentropy.knowledge.exceptions import KnowledgeError
from negentropy.knowledge.schemas import (
    CorpusCreateRequest,
    CorpusResponse,
    CorpusUpdateRequest,
)
from negentropy.knowledge.types import (
    CorpusSpec,
)
from negentropy.logging import get_logger
from negentropy.models.perception import Corpus, Knowledge

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
from negentropy.knowledge.lifecycle_schemas import CorpusQualityResponse as _CorpusQualityResp
from negentropy.knowledge.lifecycle_schemas import CorpusVersionResponse as _CorpusVersionResp

logger = get_logger("negentropy.knowledge.api")
router = APIRouter()


@router.get("/base", response_model=list[CorpusResponse])
async def list_corpora(app_name: str | None = Query(default=None)) -> list[CorpusResponse]:
    resolved_app = _resolve_app_name(app_name)
    service = _get_service()
    rows = await service.list_corpora_with_counts(app_name=resolved_app)

    return [
        CorpusResponse(
            id=corpus.id,
            app_name=corpus.app_name,
            name=corpus.name,
            description=corpus.description,
            config=_serialize_corpus_config(corpus.config or None),
            knowledge_count=top_level,
            chunk_count_total=total if total != top_level else None,
        )
        for corpus, top_level, total in rows
    ]


@router.post("/base", response_model=CorpusResponse)
async def create_corpus(payload: CorpusCreateRequest) -> CorpusResponse:
    service = _get_service()
    request_config = dict(payload.config or {})
    if not _has_explicit_extractor_routes(request_config):
        request_config["extractor_routes"] = await _resolve_default_extractor_routes()
    # 未显式指定 Embedding 模型 → 固化当前全局默认的 config_id，使语料创建即绑定具体模型。
    await _pin_default_embedding_config(request_config)
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
    service = _get_service()
    result = await service.get_corpus_with_counts(corpus_id=corpus_id, app_name=resolved_app)

    if not result:
        raise HTTPException(status_code=404, detail="Corpus not found")

    corpus, top_level, total = result
    return CorpusResponse(
        id=corpus.id,
        app_name=corpus.app_name,
        name=corpus.name,
        description=corpus.description,
        config=_serialize_corpus_config(corpus.config or None),
        knowledge_count=top_level,
        chunk_count_total=total if total != top_level else None,
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


@router.get("/base/{corpus_id}/knowledge")
async def list_knowledge(
    corpus_id: UUID,
    app_name: str | None = Query(default=None),
    source_uri: str | None = Query(default=None),
    include_archived: bool = Query(default=False),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    """列出知识库中的知识条目"""
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
                "content": item.content,
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
