"""Auto-extracted route module: Document management."""

from __future__ import annotations

import mimetypes
import urllib.parse
from io import BytesIO
from typing import TYPE_CHECKING
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import ValidationError  # noqa: F401

from negentropy.knowledge._shared import (
    _build_document_response,
    _extract_and_store_document_markdown_from_gcs,
    _get_service,
    _resolve_document_source_uri,
    _resolve_documents_archived_set,
    _resolve_user_display_names,
)
from negentropy.knowledge.api_helpers import _resolve_app_name
from negentropy.knowledge.schemas import (
    DocumentDetailResponse,
    DocumentListResponse,
    DocumentMarkdownRefreshRequest,
    DocumentMarkdownRefreshResponse,
    DocumentResponse,
    DocumentUpdateRequest,
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


@router.get("/base/{corpus_id}/documents", response_model=DocumentListResponse)
async def list_documents(
    corpus_id: UUID,
    app_name: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> DocumentListResponse:
    """列出语料库中的已上传文档

    Args:
        corpus_id: 知识库 ID
        app_name: 应用名称
        limit: 分页大小
        offset: 偏移量

    Returns:
        DocumentListResponse: 文档列表
    """
    resolved_app = _resolve_app_name(app_name)

    from negentropy.storage.service import DocumentStorageService

    storage_service = DocumentStorageService()
    docs, total = await storage_service.list_documents(
        corpus_id=corpus_id,
        app_name=resolved_app,
        limit=limit,
        offset=offset,
    )

    unique_user_ids = list({doc.created_by for doc in docs if doc.created_by})
    name_map = await _resolve_user_display_names(unique_user_ids)
    archived_set = await _resolve_documents_archived_set(docs, resolved_app)

    def _build(doc) -> DocumentResponse:
        source_uri = _resolve_document_source_uri(doc)
        archived = bool(source_uri and (doc.corpus_id, source_uri) in archived_set)
        return _build_document_response(doc, name_map, archived=archived)

    return DocumentListResponse(
        count=total,
        items=[_build(doc) for doc in docs],
    )


@router.get("/documents", response_model=DocumentListResponse)
async def list_all_documents(
    app_name: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> DocumentListResponse:
    """列出所有已上传文档（跨语料库）

    Args:
        app_name: 应用名称
        limit: 分页大小
        offset: 偏移量

    Returns:
        DocumentListResponse: 文档列表
    """
    resolved_app = _resolve_app_name(app_name)

    from negentropy.storage.service import DocumentStorageService

    storage_service = DocumentStorageService()
    docs, total = await storage_service.list_documents(
        corpus_id=None,
        app_name=resolved_app,
        limit=limit,
        offset=offset,
    )

    unique_user_ids = list({doc.created_by for doc in docs if doc.created_by})
    name_map = await _resolve_user_display_names(unique_user_ids)
    archived_set = await _resolve_documents_archived_set(docs, resolved_app)

    def _build(doc) -> DocumentResponse:
        source_uri = _resolve_document_source_uri(doc)
        archived = bool(source_uri and (doc.corpus_id, source_uri) in archived_set)
        return _build_document_response(doc, name_map, archived=archived)

    return DocumentListResponse(
        count=total,
        items=[_build(doc) for doc in docs],
    )


@router.get("/base/{corpus_id}/documents/{document_id}", response_model=DocumentDetailResponse)
async def get_document_detail(
    corpus_id: UUID,
    document_id: UUID,
    app_name: str | None = Query(default=None),
) -> DocumentDetailResponse:
    """获取单个文档详情（含 Markdown 正文）。"""
    resolved_app = _resolve_app_name(app_name)

    from negentropy.storage.service import DocumentStorageService

    storage_service = DocumentStorageService()
    doc = await storage_service.get_document(
        document_id=document_id,
        corpus_id=corpus_id,
        app_name=resolved_app,
    )

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )

    markdown_content = await storage_service.get_document_markdown(document_id)

    name_map = await _resolve_user_display_names([doc.created_by]) if doc.created_by else {}

    source_uri = _resolve_document_source_uri(doc)
    archived = False
    if source_uri:
        service = _get_service()
        archived_set = await service.get_archived_source_uris(
            pairs=[(doc.corpus_id, source_uri)],
            app_name=resolved_app,
        )
        archived = (doc.corpus_id, source_uri) in archived_set

    return DocumentDetailResponse(
        id=doc.id,
        corpus_id=doc.corpus_id,
        app_name=doc.app_name,
        file_hash=doc.file_hash,
        original_filename=doc.original_filename,
        display_name=doc.display_name,
        gcs_uri=doc.gcs_uri,
        content_type=doc.content_type,
        file_size=doc.file_size,
        status=doc.status,
        created_at=doc.created_at.isoformat() if doc.created_at else None,
        created_by=doc.created_by,
        created_by_name=name_map.get(doc.created_by) if doc.created_by else None,
        markdown_extract_status=doc.markdown_extract_status,
        markdown_extracted_at=doc.markdown_extracted_at.isoformat() if doc.markdown_extracted_at else None,
        markdown_extract_error=doc.markdown_extract_error,
        archived=archived,
        metadata=doc.metadata_ or {},
        markdown_content=markdown_content,
        markdown_gcs_uri=doc.markdown_gcs_uri,
    )


@router.patch("/base/{corpus_id}/documents/{document_id}", response_model=DocumentResponse)
async def update_document(
    corpus_id: UUID,
    document_id: UUID,
    payload: DocumentUpdateRequest,
) -> DocumentResponse:
    """更新文档元信息（display_name + Wiki 文章元数据）。

    - ``display_name`` 为 ``None`` / 空白时清除覆盖，展示侧回退到
      ``metadata_.title -> original_filename``；
    - ``author`` / ``author_url`` / ``source_url`` / ``published_at`` 合并写入
      ``metadata_`` JSONB；传空字符串清除对应键；
    - 与 :func:`get_document_detail` 一致的 ``corpus_id`` / ``app_name`` 权限校验。
    """
    resolved_app = _resolve_app_name(payload.app_name)

    from negentropy.storage.service import DocumentStorageService

    storage_service = DocumentStorageService()

    # 合并 metadata_ JSONB 中的 Wiki 文章元数据字段
    meta_keys = ("author", "author_url", "source_url", "published_at")
    metadata_patch: dict[str, str | None] = {}
    for key in meta_keys:
        val = getattr(payload, key, None)
        if val is not None:
            # 空字符串视为清除，否则设置值
            metadata_patch[key] = val.strip() or None

    if metadata_patch:
        await storage_service.update_document_metadata(
            document_id=document_id,
            metadata_patch=metadata_patch,
        )

    try:
        doc = await storage_service.update_document_display_name(
            document_id=document_id,
            display_name=payload.display_name,
            corpus_id=corpus_id,
            app_name=resolved_app,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "DOCUMENT_UPDATE_INVALID", "message": str(exc)},
        ) from exc

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )

    name_map = await _resolve_user_display_names([doc.created_by]) if doc.created_by else {}
    source_uri = _resolve_document_source_uri(doc)
    archived = False
    if source_uri:
        service = _get_service()
        archived_set = await service.get_archived_source_uris(
            pairs=[(doc.corpus_id, source_uri)],
            app_name=resolved_app,
        )
        archived = (doc.corpus_id, source_uri) in archived_set

    logger.info(
        "api_update_document",
        document_id=str(document_id),
        cleared=doc.display_name is None,
    )
    return _build_document_response(doc, name_map, archived=archived)


@router.post(
    "/base/{corpus_id}/documents/{document_id}/refresh-markdown",
    response_model=DocumentMarkdownRefreshResponse,
    include_in_schema=False,
)
@router.post(
    "/base/{corpus_id}/documents/{document_id}/refresh_markdown",
    response_model=DocumentMarkdownRefreshResponse,
)
async def refresh_document_markdown(
    corpus_id: UUID,
    document_id: UUID,
    payload: DocumentMarkdownRefreshRequest,
    background_tasks: BackgroundTasks,
) -> DocumentMarkdownRefreshResponse:
    """从 GCS 源文档重新解析 Markdown 并刷新存储。"""
    resolved_app = _resolve_app_name(payload.app_name)

    from negentropy.storage.service import DocumentStorageService

    storage_service = DocumentStorageService()
    doc = await storage_service.get_document(
        document_id=document_id,
        corpus_id=corpus_id,
        app_name=resolved_app,
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )

    await storage_service.update_markdown_extraction_status(
        document_id=document_id,
        status="processing",
        error=None,
    )
    background_tasks.add_task(
        _extract_and_store_document_markdown_from_gcs,
        document_id=document_id,
    )

    return DocumentMarkdownRefreshResponse(
        document_id=document_id,
        status="running",
        message="Markdown re-parse task started",
    )


@router.delete("/base/{corpus_id}/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    corpus_id: UUID,
    document_id: UUID,
    app_name: str | None = Query(default=None),
    hard_delete: bool = Query(default=False),
) -> None:
    """删除文档

    Args:
        corpus_id: 知识库 ID
        document_id: 文档 ID
        app_name: 应用名称
        hard_delete: 是否同时删除 GCS 中的原始文件（默认软删除）
    """
    resolved_app = _resolve_app_name(app_name)

    from negentropy.storage.service import DocumentStorageService

    storage_service = DocumentStorageService()
    deleted = await storage_service.delete_document(
        document_id=document_id,
        corpus_id=corpus_id,
        app_name=resolved_app,
        soft_delete=not hard_delete,
    )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )


@router.get("/base/{corpus_id}/documents/{document_id}/download")
async def download_document(
    corpus_id: UUID,
    document_id: UUID,
    app_name: str | None = Query(default=None),
):
    """下载文档原始文件

    Args:
        corpus_id: 知识库 ID
        document_id: 文档 ID
        app_name: 应用名称

    Returns:
        StreamingResponse: 文件流（带 Content-Disposition 头）
    """
    resolved_app = _resolve_app_name(app_name)

    from negentropy.storage.gcs_client import StorageError
    from negentropy.storage.service import DocumentStorageService

    storage_service = DocumentStorageService()

    # 获取文档记录
    doc = await storage_service.get_document(
        document_id=document_id,
        corpus_id=corpus_id,
        app_name=resolved_app,
    )

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )

    metadata = doc.metadata_ or {}
    is_url_doc = metadata.get("source_type") == "url"

    # 下载文件内容
    try:
        if is_url_doc:
            markdown_text = await storage_service.get_document_markdown(document_id)
            if not markdown_text:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document markdown content not found"},
                )
            content = markdown_text.encode("utf-8")
        else:
            content = await storage_service.get_document_content(document_id)
            if content is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document content not found"},
                )
    except StorageError as exc:
        logger.error("document_download_failed", doc_id=str(document_id), error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "DOWNLOAD_FAILED", "message": "Failed to download document"},
        ) from exc

    # 编码文件名以支持中文
    filename = doc.original_filename
    if is_url_doc and not filename.lower().endswith(".md"):
        filename = f"{filename}.md"
    encoded_filename = urllib.parse.quote(filename)

    return StreamingResponse(
        BytesIO(content),
        media_type="text/markdown; charset=utf-8" if is_url_doc else (doc.content_type or "application/octet-stream"),
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
        },
    )


@router.get("/base/{corpus_id}/documents/{document_id}/assets/{asset_name:path}")
async def get_document_asset(
    corpus_id: UUID,
    document_id: UUID,
    asset_name: str,
    app_name: str | None = Query(default=None),
):
    """获取文档的衍生资产文件（图片等）。

    从 GCS 的 ``derived/{document_id}/assets/`` 路径下载指定资产并流式返回。
    资产内容不可变，设置长期缓存。
    """
    resolved_app = _resolve_app_name(app_name)

    from negentropy.storage.gcs_client import StorageError
    from negentropy.storage.service import DocumentStorageService

    storage_service = DocumentStorageService()

    doc = await storage_service.get_document(
        document_id=document_id,
        corpus_id=corpus_id,
        app_name=resolved_app,
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
        )

    # 取 filename 最后一段，防止路径穿越
    safe_filename = asset_name.split("/")[-1] if "/" in asset_name else asset_name
    if not safe_filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_ASSET_NAME", "message": "Asset name is empty"},
        )

    # 直接构造 GCS 路径并下载（避免第二次文档查询）
    gcs_path = DocumentStorageService._build_asset_gcs_path(
        app_name=doc.app_name,
        corpus_id=doc.corpus_id,
        document_id=doc.id,
        filename=safe_filename,
    )

    try:
        gcs_client = storage_service._get_gcs_client()
        gcs_uri = f"gs://{gcs_client._bucket_name}/{gcs_path}"
        content = gcs_client.download(gcs_uri)
    except (StorageError, ValueError) as exc:
        logger.warning(
            "asset_download_failed",
            doc_id=str(document_id),
            asset_name=safe_filename,
            error=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ASSET_NOT_FOUND", "message": "Requested asset not found"},
        ) from exc

    content_type = mimetypes.guess_type(safe_filename)[0] or "application/octet-stream"
    # 清洗 header 用文件名，防止注入
    header_filename = "".join(ch if ch.isalnum() or ch in ("-", "_", ".") else "_" for ch in safe_filename)

    return StreamingResponse(
        BytesIO(content),
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "Content-Disposition": f'inline; filename="{header_filename}"',
            "Content-Length": str(len(content)),
        },
    )
