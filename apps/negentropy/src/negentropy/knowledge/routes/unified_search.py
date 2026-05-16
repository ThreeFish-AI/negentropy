"""Auto-extracted route module: Unified search + feedback."""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from fastapi import APIRouter, Query
from pydantic import ValidationError  # noqa: F401

from negentropy.db.session import AsyncSessionLocal
from negentropy.knowledge._shared import (
    _get_retrieval_service,
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
from negentropy.knowledge.lifecycle_schemas import UnifiedSearchRequest as _UnifiedSearchReq
from negentropy.knowledge.lifecycle_schemas import UnifiedSearchResponse as _UnifiedSearchResp

logger = get_logger("negentropy.knowledge.api")
router = APIRouter()


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
