"""Auto-extracted route module: Ingest text/URL/file."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import ValidationError  # noqa: F401

from negentropy.auth.deps import get_optional_user
from negentropy.auth.service import AuthUser
from negentropy.knowledge._shared import (
    _extract_legacy_chunking_payload,
    _get_service,
    _resolve_chunking_config,
)
from negentropy.knowledge.api_helpers import _map_exception_to_http, _resolve_app_name
from negentropy.knowledge.exceptions import KnowledgeError
from negentropy.knowledge.ingestion.extraction import (
    extract_source,
    resolve_source_kind,
    store_extracted_document_artifacts,
)
from negentropy.knowledge.schemas import (
    AsyncPipelineResponse,
    IngestRequest,
    IngestUrlRequest,
)
from negentropy.knowledge.types import (
    chunking_config_summary,
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


@router.post("/base/{corpus_id}/ingest", response_model=AsyncPipelineResponse)
async def ingest_text(
    corpus_id: UUID,
    payload: IngestRequest,
    background_tasks: BackgroundTasks,
) -> AsyncPipelineResponse:
    """异步索引文本到知识库

    立即返回 run_id，实际处理在后台执行。
    可在 Pipeline 页面查看进度。
    """
    resolved_app = _resolve_app_name(payload.app_name)

    logger.info(
        "api_ingest_started",
        corpus_id=str(corpus_id),
        app_name=resolved_app,
        text_length=len(payload.text),
        source_uri=payload.source_uri,
    )

    try:
        service = _get_service()

        # 获取 corpus 配置作为基础（Single Source of Truth）
        corpus = await service.get_corpus_by_id(corpus_id)
        corpus_config = corpus.config if corpus else {}

        chunking_config = _resolve_chunking_config(
            chunking_config=payload.chunking_config,
            legacy_payload=_extract_legacy_chunking_payload(payload),
            corpus_config=corpus_config,
        )

        # 创建 Pipeline 记录
        run_id = await service.create_pipeline(
            app_name=resolved_app,
            operation="ingest_text",
            input_data={
                "corpus_id": str(corpus_id),
                "source_uri": payload.source_uri,
                "text_length": len(payload.text),
                "chunking_config": chunking_config_summary(chunking_config),
            },
        )

        # 添加后台任务
        background_tasks.add_task(
            service.execute_ingest_text_pipeline,
            run_id=run_id,
            corpus_id=corpus_id,
            app_name=resolved_app,
            text=payload.text,
            source_uri=payload.source_uri,
            metadata=payload.metadata,
            chunking_config=chunking_config,
        )

        logger.info(
            "api_ingest_queued",
            corpus_id=str(corpus_id),
            run_id=run_id,
        )

        return AsyncPipelineResponse(
            run_id=run_id,
            status="running",
            message="Ingest task started. Check Pipeline page for progress.",
        )

    except KnowledgeError as exc:
        raise _map_exception_to_http(exc) from exc
    except ValidationError as exc:
        logger.warning("pydantic_validation_error", errors=exc.errors())
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": "Invalid request parameters", "errors": exc.errors()},
        ) from exc


@router.post("/base/{corpus_id}/ingest_url", response_model=AsyncPipelineResponse)
async def ingest_url(
    corpus_id: UUID,
    payload: IngestUrlRequest,
    background_tasks: BackgroundTasks,
    user: AuthUser | None = Depends(get_optional_user),
) -> AsyncPipelineResponse:
    """异步从 URL 获取内容并摄入知识库

    立即返回 run_id，实际处理在后台执行。
    可在 Pipeline 页面查看进度。
    """
    resolved_app = _resolve_app_name(payload.app_name)

    logger.info(
        "api_ingest_url_started",
        corpus_id=str(corpus_id),
        app_name=resolved_app,
        url=payload.url,
    )

    try:
        service = _get_service()

        # 获取 corpus 配置作为基础（Single Source of Truth）
        corpus = await service.get_corpus_by_id(corpus_id)
        corpus_config = corpus.config if corpus else {}

        chunking_config = _resolve_chunking_config(
            chunking_config=payload.chunking_config,
            legacy_payload=_extract_legacy_chunking_payload(payload),
            corpus_config=corpus_config,
        )

        # URL 文档模式: 先创建 Pipeline 记录，提取和存储全部在后台完成
        if payload.as_document:
            run_id = await service.create_pipeline(
                app_name=resolved_app,
                operation="ingest_url",
                input_data={
                    "corpus_id": str(corpus_id),
                    "url": payload.url,
                    "as_document": True,
                    "chunking_config": chunking_config_summary(chunking_config),
                },
            )

            background_tasks.add_task(
                service.execute_ingest_url_document_pipeline,
                run_id=run_id,
                corpus_id=corpus_id,
                app_name=resolved_app,
                url=payload.url,
                chunking_config=chunking_config,
                user_id=user.user_id if user else None,
            )

            logger.info(
                "api_ingest_url_document_queued",
                corpus_id=str(corpus_id),
                run_id=run_id,
            )

            return AsyncPipelineResponse(
                run_id=run_id,
                status="running",
                message="URL ingest task started. Check Pipeline page for progress.",
            )

        # 默认 URL 摄取模式: 与旧逻辑一致
        # 创建 Pipeline 记录
        run_id = await service.create_pipeline(
            app_name=resolved_app,
            operation="ingest_url",
            input_data={
                "corpus_id": str(corpus_id),
                "url": payload.url,
                "chunking_config": chunking_config_summary(chunking_config),
            },
        )

        # 添加后台任务
        background_tasks.add_task(
            service.execute_ingest_url_pipeline,
            run_id=run_id,
            corpus_id=corpus_id,
            app_name=resolved_app,
            url=payload.url,
            metadata=payload.metadata,
            chunking_config=chunking_config,
        )

        logger.info(
            "api_ingest_url_queued",
            corpus_id=str(corpus_id),
            run_id=run_id,
        )

        return AsyncPipelineResponse(
            run_id=run_id,
            status="running",
            message="URL ingest task started. Check Pipeline page for progress.",
        )

    except KnowledgeError as exc:
        raise _map_exception_to_http(exc) from exc
    except ValidationError as exc:
        logger.warning("pydantic_validation_error", errors=exc.errors())
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": "Invalid request parameters", "errors": exc.errors()},
        ) from exc


# 文件大小限制 (50MB)
MAX_FILE_SIZE = 50 * 1024 * 1024


async def _extract_and_store_document_markdown_from_gcs(
    *,
    document_id: UUID,
) -> None:
    """从 GCS 重新加载原始文档，通过 MCP Tool 提取 Markdown 并刷新存储。

    与 ingest pipeline 共用同一条 MCP Tool 提取路径（extract_source），
    确保 Document View 的 Markdown 内容与 Chunk 内容质量一致。
    """
    from negentropy.storage.service import DocumentStorageService

    storage_service = DocumentStorageService()
    doc = await storage_service.get_document(document_id=document_id)
    if not doc:
        logger.warning(
            "document_markdown_refresh_skipped_document_not_found",
            document_id=str(document_id),
        )
        return

    content = await storage_service.get_document_content(document_id=document_id)
    if not content:
        await storage_service.update_markdown_extraction_status(
            document_id=document_id,
            status="failed",
            error="Source document content not found in GCS",
        )
        return

    await storage_service.update_markdown_extraction_status(
        document_id=document_id,
        status="processing",
        error=None,
    )

    try:
        service = _get_service()
        corpus_config = await service._get_corpus_config(doc.corpus_id)
        source_kind = resolve_source_kind(
            filename=doc.original_filename,
            content_type=doc.content_type,
        )
        result = await extract_source(
            app_name=doc.app_name,
            corpus_id=doc.corpus_id,
            corpus_config=corpus_config,
            source_kind=source_kind,
            content=content,
            filename=doc.original_filename,
            content_type=doc.content_type,
        )

        markdown_content = (result.markdown_content or "").strip()
        if not markdown_content:
            raise ValueError("Extractor returned empty markdown content")

        markdown_gcs_uri, _ = await store_extracted_document_artifacts(
            document_id=document_id,
            extracted=result,
        )
        logger.info(
            "document_markdown_extraction_completed",
            document_id=str(document_id),
            markdown_size=len(markdown_content),
            markdown_gcs_uri=markdown_gcs_uri,
        )
    except Exception as exc:  # noqa: BLE001 - 后台任务需兜底并可观测
        logger.error(
            "document_markdown_extraction_failed",
            document_id=str(document_id),
            error=str(exc),
        )
        await storage_service.update_markdown_extraction_status(
            document_id=document_id,
            status="failed",
            error=str(exc),
        )


@router.post("/base/{corpus_id}/ingest_file", response_model=AsyncPipelineResponse)
async def ingest_file(
    corpus_id: UUID,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    app_name: str | None = Form(default=None),
    source_uri: str | None = Form(default=None),
    metadata: str | None = Form(default=None),
    strategy: str | None = Form(default=None),
    chunk_size: int | None = Form(default=None),
    overlap: int | None = Form(default=None),
    preserve_newlines: bool | None = Form(default=None),
    separators: str | None = Form(default=None),
    semantic_threshold: float | None = Form(default=None),
    semantic_buffer_size: int | None = Form(default=None),
    min_chunk_size: int | None = Form(default=None),
    max_chunk_size: int | None = Form(default=None),
    hierarchical_parent_chunk_size: int | None = Form(default=None),
    hierarchical_child_chunk_size: int | None = Form(default=None),
    hierarchical_child_overlap: int | None = Form(default=None),
    store_to_gcs: bool = Form(default=True),
    user: AuthUser | None = Depends(get_optional_user),
) -> AsyncPipelineResponse:
    """从上传文件导入内容到知识库

    支持格式: .txt, .md, .markdown, .pdf

    流程:
    1. 验证文件类型和大小
    2. 检查重复（通过内容 Hash）
    3. 存储原始文件到 GCS（如果启用）
    4. 提取文本内容
    5. 调用 ingest_text 完成分块和向量化

    Args:
        corpus_id: 知识库 ID
        file: 上传的文件
        app_name: 应用名称（可选）
        source_uri: 来源 URI（可选，默认使用 GCS URI 或文件名）
        metadata: 元数据 JSON 字符串（可选）
        chunk_size: 分块大小（可选）
        overlap: 分块重叠（可选）
        preserve_newlines: 是否保留换行（可选）
        store_to_gcs: 是否存储原始文件到 GCS（默认 True）

    Returns:
        Dict: {"count": 分块数量, "items": [分块 ID 列表], "document_id": 文档 ID, "duplicate": 是否重复}

    Raises:
        400: 文件过大、类型不支持、解析失败等
        404: corpus 不存在
    """
    resolved_app = _resolve_app_name(app_name)

    logger.info(
        "api_ingest_file_started",
        corpus_id=str(corpus_id),
        app_name=resolved_app,
        filename=file.filename,
        content_type=file.content_type,
        store_to_gcs=store_to_gcs,
    )

    try:
        # 读取文件内容
        content = await file.read()

        # 文件大小验证
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "FILE_TOO_LARGE",
                    "message": f"File size exceeds limit ({MAX_FILE_SIZE / 1024 / 1024:.0f}MB)",
                    "size": len(content),
                    "max_size": MAX_FILE_SIZE,
                },
            )

        # 解析 metadata JSON
        meta: dict[str, Any] = {}
        if metadata:
            try:
                meta = json.loads(metadata)
            except json.JSONDecodeError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"code": "INVALID_METADATA", "message": "metadata must be valid JSON"},
                ) from exc

        parsed_separators: list[str] | None = None
        if separators:
            try:
                raw = json.loads(separators)
                if isinstance(raw, list):
                    parsed_separators = [str(item) for item in raw if str(item) != ""]
            except json.JSONDecodeError:
                parsed_separators = [item.strip() for item in separators.split(",") if item.strip()]

        from ..ingestion.content import sanitize_filename

        # 保留用于展示的原始文件名（仅去除路径前缀并限制长度）
        raw_filename = (file.filename or "unknown").split("/")[-1].split("\\")[-1][:255] or "unknown"
        # 清理文件名（用于安全相关场景）
        safe_filename = sanitize_filename(file.filename)

        # GCS 存储逻辑
        doc_record = None
        is_new_doc = True
        gcs_uri = None
        storage_service = None

        if store_to_gcs:
            from negentropy.storage.gcs_client import StorageError
            from negentropy.storage.service import DocumentStorageService

            try:
                storage_service = DocumentStorageService()
                doc_record, is_new_doc = await storage_service.upload_and_store(
                    corpus_id=corpus_id,
                    app_name=resolved_app,
                    content=content,
                    filename=raw_filename,
                    content_type=file.content_type,
                    metadata={"source": "ingest_file", "source_type": "file"},
                    created_by=getattr(user, "user_id", None),
                )
                gcs_uri = doc_record.gcs_uri

                logger.info(
                    "document_storage_completed",
                    corpus_id=str(corpus_id),
                    doc_id=str(doc_record.id),
                    is_new=is_new_doc,
                    gcs_uri=gcs_uri,
                )
            except StorageError as exc:
                logger.warning("gcs_storage_failed_proceeding_without_storage", error=str(exc))
                # 继续处理，但不存储到 GCS

        service = _get_service()
        corpus = await service.get_corpus_by_id(corpus_id)
        corpus_config = corpus.config if corpus else {}

        # GCS 存储的文件强制使用 gcs_uri 作为 source_uri（支持 Rebuild 功能）
        # 只有非 GCS 存储时才使用用户提供的 source_uri 或文件名
        if store_to_gcs and gcs_uri:
            final_source_uri = gcs_uri
        else:
            final_source_uri = source_uri or safe_filename

        chunking_config = _resolve_chunking_config(
            chunking_config=None,
            legacy_payload={
                key: value
                for key, value in {
                    "strategy": strategy,
                    "chunk_size": chunk_size,
                    "overlap": overlap,
                    "preserve_newlines": preserve_newlines,
                    "separators": parsed_separators,
                    "semantic_threshold": semantic_threshold,
                    "semantic_buffer_size": semantic_buffer_size,
                    "min_chunk_size": min_chunk_size,
                    "max_chunk_size": max_chunk_size,
                    "hierarchical_parent_chunk_size": hierarchical_parent_chunk_size,
                    "hierarchical_child_chunk_size": hierarchical_child_chunk_size,
                    "hierarchical_child_overlap": hierarchical_child_overlap,
                }.items()
                if value is not None
            },
            corpus_config=corpus_config,
        )

        # 添加文件元数据
        meta["original_filename"] = raw_filename
        meta["content_type"] = file.content_type
        meta["file_size"] = len(content)
        meta["source_type"] = "file"
        if gcs_uri:
            meta["gcs_uri"] = gcs_uri
        if doc_record:
            meta["document_id"] = str(doc_record.id)

        run_id = await service.create_pipeline(
            app_name=resolved_app,
            operation="ingest_file",
            input_data={
                "corpus_id": str(corpus_id),
                "source_uri": final_source_uri,
                "filename": raw_filename,
                "content_type": file.content_type,
                "file_size": len(content),
                "document_id": str(doc_record.id) if doc_record else None,
                "duplicate_document": (not is_new_doc) if doc_record else False,
                "chunking_config": chunking_config_summary(chunking_config),
            },
        )

        background_tasks.add_task(
            service.execute_ingest_file_pipeline,
            run_id=run_id,
            corpus_id=corpus_id,
            app_name=resolved_app,
            content=content,
            filename=raw_filename,
            content_type=file.content_type,
            source_uri=final_source_uri,
            metadata=meta,
            chunking_config=chunking_config,
            document_id=doc_record.id if doc_record else None,
        )

        logger.info(
            "api_ingest_file_queued",
            corpus_id=str(corpus_id),
            filename=file.filename,
            run_id=run_id,
            document_id=str(doc_record.id) if doc_record else None,
            duplicate_document=(not is_new_doc) if doc_record else False,
        )

        return AsyncPipelineResponse(
            run_id=run_id,
            status="running",
            message=(
                f"File ingest task started (document_id={doc_record.id}). Check Pipeline page for progress."
                if doc_record
                else "File ingest task started. Check Pipeline page for progress."
            ),
        )

    except ValueError as exc:
        logger.warning("file_parse_error", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "FILE_PARSE_ERROR", "message": str(exc)},
        ) from exc
    except KnowledgeError as exc:
        raise _map_exception_to_http(exc) from exc
    except ValidationError as exc:
        logger.warning("pydantic_validation_error", errors=exc.errors())
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": "Invalid request parameters", "errors": exc.errors()},
        ) from exc
