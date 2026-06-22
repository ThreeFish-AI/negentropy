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
    _get_service,
    _reparse_document_markdown,
    _resolve_document_source_uri,
    _resolve_documents_archived_set,
    _resolve_user_display_names,
    effective_download_filename,
)
from negentropy.knowledge.api_helpers import _resolve_app_name
from negentropy.knowledge.schemas import (
    DocumentDetailResponse,
    DocumentListResponse,
    DocumentMarkdownRefreshRequest,
    DocumentMarkdownRefreshResponse,
    DocumentResponse,
    DocumentTranslateRequest,
    DocumentTranslateResponse,
    DocumentTranslateSkipped,
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


# ---------------------------------------------------------------------------
# 共享实现：corpus_id 为 None 时按 app_name 限界（库文档 / 跨 corpus 直达），
# 否则附加 corpus 归属校验。corpus 路由与平行无 corpus 路由（library.py）共用。
# ---------------------------------------------------------------------------


async def _get_document_detail_impl(
    *,
    document_id: UUID,
    corpus_id: UUID | None,
    app_name: str | None,
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
    if source_uri and doc.corpus_id is not None:
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
        content_uri=doc.content_uri,
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
        markdown_uri=doc.markdown_uri,
    )


@router.get("/base/{corpus_id}/documents/{document_id}", response_model=DocumentDetailResponse)
async def get_document_detail(
    corpus_id: UUID,
    document_id: UUID,
    app_name: str | None = Query(default=None),
) -> DocumentDetailResponse:
    """获取单个文档详情（含 Markdown 正文）。"""
    return await _get_document_detail_impl(document_id=document_id, corpus_id=corpus_id, app_name=app_name)


async def _update_document_impl(
    *,
    document_id: UUID,
    corpus_id: UUID | None,
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
    if source_uri and doc.corpus_id is not None:
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


@router.patch("/base/{corpus_id}/documents/{document_id}", response_model=DocumentResponse)
async def update_document(
    corpus_id: UUID,
    document_id: UUID,
    payload: DocumentUpdateRequest,
) -> DocumentResponse:
    """更新文档元信息（display_name + Wiki 文章元数据）。"""
    return await _update_document_impl(document_id=document_id, corpus_id=corpus_id, payload=payload)


async def _refresh_document_markdown_impl(
    *,
    document_id: UUID,
    corpus_id: UUID | None,
    payload: DocumentMarkdownRefreshRequest,
    background_tasks: BackgroundTasks,
) -> DocumentMarkdownRefreshResponse:
    """从已存储的源文档（PostgreSQL）重新解析 Markdown 并刷新存储。"""
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
        _reparse_document_markdown,
        document_id=document_id,
    )

    return DocumentMarkdownRefreshResponse(
        document_id=document_id,
        status="running",
        message="Markdown re-parse task started",
    )


# 翻译任务"陈旧 processing"豁免窗口：超过该时长的 processing 视为僵尸（进程重启等），允许重入。
#
# ⚠ 运维注意：路由端点先写 processing 状态再派发 BackgroundTasks。若进程在 add_task 后、
# 后台任务开始前崩溃（如 OOM kill），该文档将停留在 processing 直到此窗口过期（默认 1 小时）。
# 如需更快恢复，可手动清除 metadata_.translation 或调低此值。
_TRANSLATION_STALE_SECONDS = 3600


def _translation_eligibility(doc, *, force: bool) -> str | None:
    """逐文档翻译资格检查（仅做廉价判定，正文级守卫由翻译服务兜底）。

    Returns:
        None 表示可翻译；否则返回 skip reason 标识。
    """
    from datetime import UTC, datetime

    if doc is None:
        return "not_found"
    if getattr(doc, "corpus_id", None) is None:
        # Library 文档（corpus_id=NULL）：译文需落库到同 corpus，暂不支持
        return "library_document"
    metadata = dict(doc.metadata_ or {})
    if metadata.get("translated_from_document_id"):
        return "already_translation"
    if (doc.markdown_extract_status or "").lower() != "completed":
        return "markdown_not_ready"

    translation = metadata.get("translation") or {}
    state = str(translation.get("status") or "").lower()
    if state == "processing":
        started_raw = translation.get("started_at")
        try:
            started = datetime.fromisoformat(started_raw) if started_raw else None
        except (TypeError, ValueError):
            started = None
        if started is not None and (datetime.now(UTC) - started).total_seconds() < _TRANSLATION_STALE_SECONDS:
            return "translating"
    if state == "completed" and not force:
        return "already_translated"
    return None


@router.post("/documents/translate", response_model=DocumentTranslateResponse)
async def translate_documents(
    payload: DocumentTranslateRequest,
    background_tasks: BackgroundTasks,
) -> DocumentTranslateResponse:
    """批量翻译文档（Documents 页 Translate 按钮）。

    执行链：本端点逐文档资格检查并同步置 ``metadata_.translation.status=processing``
    （列表轮询立刻可见）→ 创建 PipelineRun 记录 → BackgroundTasks 派发
    ``KnowledgeService.execute_translate_pipeline`` → InfluenceFaculty
    （装配 document-translate 技能 + invoke_claude_code）驱动 Claude Code
    分块翻译 → 译文作为新文档分录落库（metadata 标记译自来源）。
    """
    from datetime import UTC, datetime

    from negentropy.storage.service import DocumentStorageService

    resolved_app = _resolve_app_name(payload.app_name)
    storage_service = DocumentStorageService()
    service = _get_service()

    accepted: list[UUID] = []
    skipped: list[DocumentTranslateSkipped] = []
    for document_id in payload.document_ids:
        doc = await storage_service.get_document(document_id=document_id, app_name=resolved_app)
        reason = _translation_eligibility(doc, force=payload.force)
        if reason:
            skipped.append(DocumentTranslateSkipped(document_id=document_id, reason=reason))
            continue

        # 创建 PipelineRun 记录（Pipelines 页面可见）
        run_id = await service.create_pipeline(
            app_name=resolved_app,
            operation="translate",
            input_data={
                "document_id": str(document_id),
                "target_language": payload.target_language,
                "filename": doc.original_filename,
            },
        )

        await storage_service.update_document_metadata(
            document_id=document_id,
            metadata_patch={
                "translation": {
                    "status": "processing",
                    "target_language": payload.target_language,
                    "target_document_id": None,
                    "error": None,
                    "started_at": datetime.now(UTC).isoformat(),
                }
            },
        )
        background_tasks.add_task(
            service.execute_translate_pipeline,
            run_id=run_id,
            document_id=document_id,
            target_language=payload.target_language,
            app_name=resolved_app,
        )
        accepted.append(document_id)

    logger.info(
        "api_translate_documents",
        accepted=len(accepted),
        skipped=len(skipped),
        target_language=payload.target_language,
    )
    return DocumentTranslateResponse(accepted=accepted, skipped=skipped)


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
    """从已存储的源文档（PostgreSQL）重新解析 Markdown 并刷新存储。"""
    return await _refresh_document_markdown_impl(
        document_id=document_id,
        corpus_id=corpus_id,
        payload=payload,
        background_tasks=background_tasks,
    )


async def _delete_document_impl(
    *,
    document_id: UUID,
    corpus_id: UUID | None,
    app_name: str | None,
    hard_delete: bool,
) -> None:
    """删除文档（corpus_id=None 时按 app_name 限界）。"""
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
        hard_delete: 是否同时删除存储后端（PostgreSQL blob）中的原始文件（默认软删除）
    """
    await _delete_document_impl(
        document_id=document_id,
        corpus_id=corpus_id,
        app_name=app_name,
        hard_delete=hard_delete,
    )


async def _download_document_impl(
    *,
    document_id: UUID,
    corpus_id: UUID | None,
    app_name: str | None,
):
    """下载文档原始文件，返回 StreamingResponse（带 Content-Disposition 头）。"""
    resolved_app = _resolve_app_name(app_name)

    from negentropy.storage import StorageError
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

    # 文件名跟随用户重命名：display_name 覆盖 → original_filename，
    # 并保留 original_filename 的扩展名，确保下载内容与扩展名一致可正确打开。
    filename = effective_download_filename(doc.original_filename, doc.display_name)
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
    return await _download_document_impl(document_id=document_id, corpus_id=corpus_id, app_name=app_name)


async def _get_document_asset_impl(
    *,
    document_id: UUID,
    corpus_id: UUID | None,
    asset_name: str,
    app_name: str | None,
):
    """获取文档的衍生资产文件（图片等）。

    从存储后端（PostgreSQL blob）的 ``derived/{document_id}/assets/`` 路径下载指定资产并流式返回。
    资产内容不可变，设置长期缓存。
    """
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

    # 取 filename 最后一段，防止路径穿越
    safe_filename = asset_name.split("/")[-1] if "/" in asset_name else asset_name
    if not safe_filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_ASSET_NAME", "message": "Asset name is empty"},
        )

    # 经 Service 层下载衍生资产（路径构造与 blob 解析收口在 DocumentStorageService）
    content = await storage_service.download_extraction_asset(
        document_id=document_id,
        filename=safe_filename,
    )
    if content is None:
        logger.warning(
            "asset_download_failed",
            doc_id=str(document_id),
            asset_name=safe_filename,
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ASSET_NOT_FOUND", "message": "Requested asset not found"},
        )

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


@router.get("/base/{corpus_id}/documents/{document_id}/assets/{asset_name:path}")
async def get_document_asset(
    corpus_id: UUID,
    document_id: UUID,
    asset_name: str,
    app_name: str | None = Query(default=None),
):
    """获取文档的衍生资产文件（图片等）。"""
    return await _get_document_asset_impl(
        document_id=document_id,
        corpus_id=corpus_id,
        asset_name=asset_name,
        app_name=app_name,
    )
