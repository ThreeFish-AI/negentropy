"""Auto-extracted route module: Corpus search."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import ValidationError  # noqa: F401

from negentropy.knowledge._shared import (
    _get_service,
)
from negentropy.knowledge.api_helpers import _map_exception_to_http, _resolve_app_name
from negentropy.knowledge.constants import DEFAULT_KEYWORD_WEIGHT, DEFAULT_SEARCH_LIMIT, DEFAULT_SEMANTIC_WEIGHT
from negentropy.knowledge.exceptions import KnowledgeError
from negentropy.knowledge.schemas import (
    SearchRequest,
)
from negentropy.knowledge.types import (
    SearchConfig,
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
