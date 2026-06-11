"""Auto-extracted route module: Chunk operations."""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import ValidationError  # noqa: F401

from negentropy.knowledge._shared import (
    _build_document_chunk_metadata,
    _get_service,
    _resolve_document_source_uri,
    _serialize_document_chunk_item,
)
from negentropy.knowledge.api_helpers import _resolve_app_name
from negentropy.knowledge.schemas import (
    DocumentChunkDetailResponse,
    DocumentChunksResponse,
    DocumentChunkUpdateRequest,
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
    # 不带 corpus 过滤：允许查看库文档 / 跨 Corpus 摄入文档在本 corpus 的 chunks
    # （chunks 本身仍按路径 corpus_id 限定；app 为租户边界）
    doc = await storage_service.get_document(
        document_id=document_id,
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
    # 不带 corpus 过滤：允许查看库文档 / 跨 Corpus 摄入文档在本 corpus 的 chunks
    # （chunks 本身仍按路径 corpus_id 限定；app 为租户边界）
    doc = await storage_service.get_document(
        document_id=document_id,
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
    # 不带 corpus 过滤：允许查看库文档 / 跨 Corpus 摄入文档在本 corpus 的 chunks
    # （chunks 本身仍按路径 corpus_id 限定；app 为租户边界）
    doc = await storage_service.get_document(
        document_id=document_id,
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
    # 不带 corpus 过滤：允许查看库文档 / 跨 Corpus 摄入文档在本 corpus 的 chunks
    # （chunks 本身仍按路径 corpus_id 限定；app 为租户边界）
    doc = await storage_service.get_document(
        document_id=document_id,
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
