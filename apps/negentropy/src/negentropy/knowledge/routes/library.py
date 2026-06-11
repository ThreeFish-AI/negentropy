"""Route module: Document Library（独立文档库）。

「Import Document」与库文档管理的无 corpus 平行路由：

- ``POST /documents/import_url`` / ``POST /documents/import_file``：
  导入 URL / PDF / Markdown 源，仅完成「转换为 Markdown + GCS 存储」，
  不做索引化（chunk/embed/persist）。文档落库为库文档（corpus_id=NULL）。
- ``/documents/{document_id}[...]``：库文档（及跨 corpus 直达）的
  详情 / 更新 / 删除 / 下载 / 重解析 / 资产路由，按 app_name 限界，
  与 ``/base/{corpus_id}/documents/...`` 共用同一实现（documents.py 的 ``_*_impl``）。

注意：``import_url`` / ``import_file`` 为静态段路由，**必须**先于
``/documents/{document_id}`` 注册，防止被 UUID 路径参数吞没（422）。
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile, status

from negentropy.auth.deps import get_optional_user
from negentropy.auth.service import AuthUser
from negentropy.config import settings
from negentropy.knowledge._shared import _get_service
from negentropy.knowledge.api_helpers import _map_exception_to_http, _resolve_app_name
from negentropy.knowledge.exceptions import KnowledgeError
from negentropy.knowledge.ingestion.extraction import resolve_source_kind
from negentropy.knowledge.routes.documents import (
    _delete_document_impl,
    _download_document_impl,
    _get_document_asset_impl,
    _get_document_detail_impl,
    _refresh_document_markdown_impl,
    _update_document_impl,
)
from negentropy.knowledge.schemas import (
    AsyncPipelineResponse,
    DocumentDetailResponse,
    DocumentMarkdownRefreshRequest,
    DocumentMarkdownRefreshResponse,
    DocumentResponse,
    DocumentUpdateRequest,
    ImportUrlRequest,
)
from negentropy.logging import get_logger

logger = get_logger("negentropy.knowledge.api")
router = APIRouter()


# ---------------------------------------------------------------------------
# Import Document（静态段路由，先于 /documents/{document_id} 注册）
# ---------------------------------------------------------------------------


@router.post("/documents/import_url", response_model=AsyncPipelineResponse)
async def import_document_url(
    payload: ImportUrlRequest,
    background_tasks: BackgroundTasks,
    user: AuthUser | None = Depends(get_optional_user),
) -> AsyncPipelineResponse:
    """异步导入 URL 至文档库（仅转换为 Markdown 并存储，不做索引）

    立即返回 run_id，实际处理在后台执行。
    可在 Pipeline 页面查看进度。
    """
    resolved_app = _resolve_app_name(payload.app_name)

    logger.info(
        "api_import_url_started",
        app_name=resolved_app,
        url=payload.url,
    )

    try:
        service = _get_service()

        run_id = await service.create_pipeline(
            app_name=resolved_app,
            operation="import_document",
            input_data={
                "source_type": "url",
                "url": payload.url,
                "corpus_id": None,
            },
        )

        background_tasks.add_task(
            service.execute_import_url_document_pipeline,
            run_id=run_id,
            app_name=resolved_app,
            url=payload.url,
            metadata=payload.metadata,
            user_id=user.user_id if user else None,
        )

        logger.info("api_import_url_queued", run_id=run_id, url=payload.url)

        return AsyncPipelineResponse(
            run_id=run_id,
            status="running",
            message="Document import task started. Check Pipeline page for progress.",
        )

    except KnowledgeError as exc:
        raise _map_exception_to_http(exc) from exc


@router.post("/documents/import_file", response_model=AsyncPipelineResponse)
async def import_document_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    app_name: str | None = Form(default=None),
    user: AuthUser | None = Depends(get_optional_user),
) -> AsyncPipelineResponse:
    """异步导入文件（PDF / Markdown）至文档库（仅转换为 Markdown 并存储，不做索引）

    - Markdown / 纯文本：passthrough，无需 MCP 提取；
    - PDF / 通用文件：经 Negentropy Perceives MCP 提取为 Markdown。

    原始文件在路由层同步上传 GCS（失败即 400 —— 无存储的导入无意义），
    Markdown 提取在后台执行；重复导入（同 app 同内容 Hash）短路完成。
    """
    resolved_app = _resolve_app_name(app_name)

    logger.info(
        "api_import_file_started",
        app_name=resolved_app,
        filename=file.filename,
        content_type=file.content_type,
    )

    try:
        content = await file.read()

        # 文件大小验证（与 ingest_file 同限）
        max_file_size = settings.knowledge.max_file_size_mb * 1024 * 1024
        if len(content) > max_file_size:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "FILE_TOO_LARGE",
                    "message": f"File size exceeds limit ({max_file_size / 1024 / 1024:.0f}MB)",
                    "size": len(content),
                    "max_size": max_file_size,
                },
            )

        # 保留用于展示的原始文件名（仅去除路径前缀并限制长度）
        raw_filename = (file.filename or "unknown").split("/")[-1].split("\\")[-1][:255] or "unknown"
        source_kind = resolve_source_kind(filename=raw_filename, content_type=file.content_type)

        # 路由层同步上传 GCS + 落库（corpus_id=None → 文档库）；失败为致命错误
        from negentropy.storage.gcs_client import StorageError
        from negentropy.storage.service import DocumentStorageService

        try:
            storage_service = DocumentStorageService()
            doc_record, is_new_doc = await storage_service.upload_and_store(
                corpus_id=None,
                app_name=resolved_app,
                content=content,
                filename=raw_filename,
                content_type=file.content_type,
                metadata={"source": "import_file", "source_type": "file"},
                created_by=getattr(user, "user_id", None),
            )
        except StorageError as exc:
            logger.error("import_file_storage_failed", filename=raw_filename, error=str(exc))
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "STORAGE_FAILED", "message": f"Failed to store document: {exc}"},
            ) from exc

        service = _get_service()
        run_id = await service.create_pipeline(
            app_name=resolved_app,
            operation="import_document",
            input_data={
                "source_type": source_kind,
                "filename": raw_filename,
                "content_type": file.content_type,
                "file_size": len(content),
                "document_id": str(doc_record.id),
                "duplicate_document": not is_new_doc,
                "corpus_id": None,
            },
        )

        background_tasks.add_task(
            service.execute_import_file_pipeline,
            run_id=run_id,
            app_name=resolved_app,
            document_id=doc_record.id,
            content=content,
            filename=raw_filename,
            content_type=file.content_type,
        )

        logger.info(
            "api_import_file_queued",
            run_id=run_id,
            filename=raw_filename,
            document_id=str(doc_record.id),
            duplicate_document=not is_new_doc,
        )

        return AsyncPipelineResponse(
            run_id=run_id,
            status="running",
            message=(f"Document import task started (document_id={doc_record.id}). Check Pipeline page for progress."),
        )

    except ValueError as exc:
        logger.warning("import_file_parse_error", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "FILE_PARSE_ERROR", "message": str(exc)},
        ) from exc
    except KnowledgeError as exc:
        raise _map_exception_to_http(exc) from exc


# ---------------------------------------------------------------------------
# 库文档管理（无 corpus 平行路由，复用 documents.py 的共享实现）
# ---------------------------------------------------------------------------


@router.get("/documents/{document_id}", response_model=DocumentDetailResponse)
async def get_library_document_detail(
    document_id: UUID,
    app_name: str | None = Query(default=None),
) -> DocumentDetailResponse:
    """获取文档详情（含 Markdown 正文；不限 corpus 归属，按 app_name 限界）。"""
    return await _get_document_detail_impl(document_id=document_id, corpus_id=None, app_name=app_name)


@router.patch("/documents/{document_id}", response_model=DocumentResponse)
async def update_library_document(
    document_id: UUID,
    payload: DocumentUpdateRequest,
) -> DocumentResponse:
    """更新文档元信息（display_name + Wiki 文章元数据）。"""
    return await _update_document_impl(document_id=document_id, corpus_id=None, payload=payload)


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_library_document(
    document_id: UUID,
    app_name: str | None = Query(default=None),
    hard_delete: bool = Query(default=False),
) -> None:
    """删除文档（默认软删除；hard_delete=true 时同步删除 GCS 原始文件）。"""
    await _delete_document_impl(
        document_id=document_id,
        corpus_id=None,
        app_name=app_name,
        hard_delete=hard_delete,
    )


@router.get("/documents/{document_id}/download")
async def download_library_document(
    document_id: UUID,
    app_name: str | None = Query(default=None),
):
    """下载文档原始文件。"""
    return await _download_document_impl(document_id=document_id, corpus_id=None, app_name=app_name)


@router.post(
    "/documents/{document_id}/refresh-markdown",
    response_model=DocumentMarkdownRefreshResponse,
    include_in_schema=False,
)
@router.post(
    "/documents/{document_id}/refresh_markdown",
    response_model=DocumentMarkdownRefreshResponse,
)
async def refresh_library_document_markdown(
    document_id: UUID,
    payload: DocumentMarkdownRefreshRequest,
    background_tasks: BackgroundTasks,
) -> DocumentMarkdownRefreshResponse:
    """从 GCS 源文档重新解析 Markdown 并刷新存储（库文档走默认 extractor_routes）。"""
    return await _refresh_document_markdown_impl(
        document_id=document_id,
        corpus_id=None,
        payload=payload,
        background_tasks=background_tasks,
    )


@router.get("/documents/{document_id}/assets/{asset_name:path}")
async def get_library_document_asset(
    document_id: UUID,
    asset_name: str,
    app_name: str | None = Query(default=None),
):
    """获取文档的衍生资产文件（图片等）。"""
    return await _get_document_asset_impl(
        document_id=document_id,
        corpus_id=None,
        asset_name=asset_name,
        app_name=app_name,
    )


__all__: list[str] = ["router"]
