"""Auto-extracted route module: Document provenance."""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import ValidationError  # noqa: F401

from negentropy.db.session import AsyncSessionLocal
from negentropy.knowledge._shared import (
    _get_service,
)
from negentropy.logging import get_logger
from negentropy.models.perception import KnowledgeDocument

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
from negentropy.knowledge.lifecycle_schemas import DocSourceListResponse as _DocSourceListResp
from negentropy.knowledge.lifecycle_schemas import DocSourceResponse as _DocSourceResp

logger = get_logger("negentropy.knowledge.api")
router = APIRouter()

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
