"""Auto-extracted route module: Source operations."""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from pydantic import ValidationError  # noqa: F401

from negentropy.knowledge._shared import (
    _extract_legacy_chunking_payload,
    _get_service,
    _is_url_document,
    _resolve_chunking_config,
    _resolve_chunking_config_from_doc_request,
    _resolve_document_source_uri,
)
from negentropy.knowledge.api_helpers import _map_exception_to_http, _resolve_app_name
from negentropy.knowledge.exceptions import KnowledgeError
from negentropy.knowledge.schemas import (
    ArchiveSourceRequest,
    ArchiveSourceResponse,
    AsyncPipelineResponse,
    DeleteSourceRequest,
    DeleteSourceResponse,
    DocumentActionRequest,
    DocumentReplaceRequest,
    RebuildSourceRequest,
    ReplaceSourceRequest,
    SyncSourceRequest,
)
from negentropy.knowledge.types import (
    chunking_config_summary,
    normalize_source_metadata,
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


@router.post("/base/{corpus_id}/documents/{document_id}/sync", response_model=AsyncPipelineResponse)
async def sync_document(
    corpus_id: UUID,
    document_id: UUID,
    payload: DocumentActionRequest,
    background_tasks: BackgroundTasks,
) -> AsyncPipelineResponse:
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
    if not _is_url_document(doc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_DOCUMENT_TYPE", "message": "sync is only supported for URL documents"},
        )

    source_uri = _resolve_document_source_uri(doc)
    if not source_uri:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_DOCUMENT_SOURCE", "message": "Document source_uri not available"},
        )

    service = _get_service()
    corpus = await service.get_corpus_by_id(corpus_id)
    chunking_config = _resolve_chunking_config_from_doc_request(
        payload=payload,
        corpus_config=corpus.config if corpus else {},
    )
    run_id = await service.create_pipeline(
        app_name=resolved_app,
        operation="replace_source",
        input_data={
            "corpus_id": str(corpus_id),
            "source_uri": source_uri,
            "document_id": str(document_id),
            "sync_document": True,
            "chunking_config": chunking_config_summary(chunking_config),
        },
    )
    background_tasks.add_task(
        service.execute_sync_document_pipeline,
        run_id=run_id,
        corpus_id=corpus_id,
        app_name=resolved_app,
        document_id=document_id,
        source_uri=source_uri,
        chunking_config=chunking_config,
    )
    return AsyncPipelineResponse(
        run_id=run_id,
        status="running",
        message="Document sync task started. Check Pipeline page for progress.",
    )


@router.post("/base/{corpus_id}/documents/{document_id}/rebuild", response_model=AsyncPipelineResponse)
async def rebuild_document(
    corpus_id: UUID,
    document_id: UUID,
    payload: DocumentActionRequest,
    background_tasks: BackgroundTasks,
) -> AsyncPipelineResponse:
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

    service = _get_service()
    corpus = await service.get_corpus_by_id(corpus_id)
    chunking_config = _resolve_chunking_config_from_doc_request(
        payload=payload,
        corpus_config=corpus.config if corpus else {},
    )

    if _is_url_document(doc):
        source_uri = _resolve_document_source_uri(doc)
        markdown_text = await storage_service.get_document_markdown(document_id)
        if not source_uri or not markdown_text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_DOCUMENT_SOURCE", "message": "URL document markdown not available"},
            )
        metadata = normalize_source_metadata(
            source_uri=source_uri,
            metadata={"source_type": "url", "origin_url": source_uri, "document_id": str(document_id)},
        )
        run_id = await service.create_pipeline(
            app_name=resolved_app,
            operation="replace_source",
            input_data={
                "corpus_id": str(corpus_id),
                "source_uri": source_uri,
                "document_id": str(document_id),
                "rebuild_document": True,
            },
        )
        background_tasks.add_task(
            service.execute_replace_source_pipeline,
            run_id=run_id,
            corpus_id=corpus_id,
            app_name=resolved_app,
            text=markdown_text,
            source_uri=source_uri,
            metadata=metadata,
            chunking_config=chunking_config,
        )
        return AsyncPipelineResponse(
            run_id=run_id,
            status="running",
            message="Document rebuild task started. Check Pipeline page for progress.",
        )

    if not doc.gcs_uri:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_DOCUMENT_SOURCE", "message": "File document gcs_uri not available"},
        )
    run_id = await service.create_pipeline(
        app_name=resolved_app,
        operation="rebuild_source",
        input_data={
            "corpus_id": str(corpus_id),
            "source_uri": doc.gcs_uri,
            "document_id": str(document_id),
        },
    )
    background_tasks.add_task(
        service.execute_rebuild_source_pipeline,
        run_id=run_id,
        corpus_id=corpus_id,
        app_name=resolved_app,
        source_uri=doc.gcs_uri,
        chunking_config=chunking_config,
        document_id=document_id,
    )
    return AsyncPipelineResponse(
        run_id=run_id,
        status="running",
        message="Document rebuild task started. Check Pipeline page for progress.",
    )


@router.post("/base/{corpus_id}/documents/{document_id}/replace", response_model=AsyncPipelineResponse)
async def replace_document(
    corpus_id: UUID,
    document_id: UUID,
    payload: DocumentReplaceRequest,
    background_tasks: BackgroundTasks,
) -> AsyncPipelineResponse:
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

    source_uri = _resolve_document_source_uri(doc)
    if not source_uri:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_DOCUMENT_SOURCE", "message": "Document source_uri not available"},
        )

    service = _get_service()
    corpus = await service.get_corpus_by_id(corpus_id)
    chunking_config = _resolve_chunking_config_from_doc_request(
        payload=payload,
        corpus_config=corpus.config if corpus else {},
    )
    metadata = normalize_source_metadata(
        source_uri=source_uri,
        metadata={
            "source_type": "url" if _is_url_document(doc) else "file",
            "origin_url": (doc.metadata_ or {}).get("origin_url"),
            "document_id": str(document_id),
        },
    )
    run_id = await service.create_pipeline(
        app_name=resolved_app,
        operation="replace_source",
        input_data={"corpus_id": str(corpus_id), "source_uri": source_uri, "document_id": str(document_id)},
    )
    background_tasks.add_task(
        service.execute_replace_source_pipeline,
        run_id=run_id,
        corpus_id=corpus_id,
        app_name=resolved_app,
        text=payload.text,
        source_uri=source_uri,
        metadata=metadata,
        chunking_config=chunking_config,
    )
    return AsyncPipelineResponse(
        run_id=run_id,
        status="running",
        message="Document replace task started. Check Pipeline page for progress.",
    )


@router.post("/base/{corpus_id}/documents/{document_id}/archive")
async def archive_document(
    corpus_id: UUID,
    document_id: UUID,
    payload: DocumentActionRequest,
) -> ArchiveSourceResponse:
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
    source_uri = _resolve_document_source_uri(doc)
    if not source_uri:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_DOCUMENT_SOURCE", "message": "Document source_uri not available"},
        )

    service = _get_service()
    updated = await service.archive_source(
        corpus_id=corpus_id,
        app_name=resolved_app,
        source_uri=source_uri,
        archived=True,
    )
    return ArchiveSourceResponse(updated_count=updated, archived=True)


@router.post("/base/{corpus_id}/documents/{document_id}/unarchive")
async def unarchive_document(
    corpus_id: UUID,
    document_id: UUID,
    payload: DocumentActionRequest,
) -> ArchiveSourceResponse:
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
    source_uri = _resolve_document_source_uri(doc)
    if not source_uri:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_DOCUMENT_SOURCE", "message": "Document source_uri not available"},
        )
    service = _get_service()
    updated = await service.archive_source(
        corpus_id=corpus_id,
        app_name=resolved_app,
        source_uri=source_uri,
        archived=False,
    )
    return ArchiveSourceResponse(updated_count=updated, archived=False)


@router.post("/base/{corpus_id}/replace_source", response_model=AsyncPipelineResponse)
async def replace_source(
    corpus_id: UUID,
    payload: ReplaceSourceRequest,
    background_tasks: BackgroundTasks,
) -> AsyncPipelineResponse:
    """异步替换源文本（删除旧记录 + 索引新记录）

    立即返回 run_id，实际处理在后台执行。
    可在 Pipeline 页面查看进度。
    """
    resolved_app = _resolve_app_name(payload.app_name)

    logger.info(
        "api_replace_source_started",
        corpus_id=str(corpus_id),
        app_name=resolved_app,
        source_uri=payload.source_uri,
    )

    try:
        service = _get_service()
        corpus = await service.get_corpus_by_id(corpus_id)
        chunking_config = _resolve_chunking_config(
            chunking_config=payload.chunking_config,
            legacy_payload=_extract_legacy_chunking_payload(payload),
            corpus_config=corpus.config if corpus else {},
        )

        # 创建 Pipeline 记录
        run_id = await service.create_pipeline(
            app_name=resolved_app,
            operation="replace_source",
            input_data={
                "corpus_id": str(corpus_id),
                "source_uri": payload.source_uri,
                "text_length": len(payload.text),
                "chunking_config": chunking_config_summary(chunking_config),
            },
        )

        # 添加后台任务
        background_tasks.add_task(
            service.execute_replace_source_pipeline,
            run_id=run_id,
            corpus_id=corpus_id,
            app_name=resolved_app,
            text=payload.text,
            source_uri=payload.source_uri,
            metadata=payload.metadata,
            chunking_config=chunking_config,
        )

        logger.info(
            "api_replace_source_queued",
            corpus_id=str(corpus_id),
            run_id=run_id,
        )

        return AsyncPipelineResponse(
            run_id=run_id,
            status="running",
            message="Replace source task started. Check Pipeline page for progress.",
        )

    except KnowledgeError as exc:
        raise _map_exception_to_http(exc) from exc


@router.post("/base/{corpus_id}/sync_source", response_model=AsyncPipelineResponse)
async def sync_source(
    corpus_id: UUID,
    payload: SyncSourceRequest,
    background_tasks: BackgroundTasks,
) -> AsyncPipelineResponse:
    """异步同步 URL 源（重新拉取并摄入）

    立即返回 run_id，实际处理在后台执行。
    可在 Pipeline 页面查看进度。
    """
    resolved_app = _resolve_app_name(payload.app_name)
    source_uri = payload.source_uri

    # 验证 source_uri 是有效的 URL
    if not source_uri or not (source_uri.startswith("http://") or source_uri.startswith("https://")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_SOURCE_URI",
                "message": "source_uri must be a valid HTTP/HTTPS URL for sync operation",
            },
        )

    logger.info(
        "api_sync_source_started",
        corpus_id=str(corpus_id),
        app_name=resolved_app,
        source_uri=source_uri,
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
            operation="sync_source",
            input_data={
                "corpus_id": str(corpus_id),
                "source_uri": source_uri,
                "chunking_config": chunking_config_summary(chunking_config),
            },
        )

        # 添加后台任务
        background_tasks.add_task(
            service.execute_sync_source_pipeline,
            run_id=run_id,
            corpus_id=corpus_id,
            app_name=resolved_app,
            source_uri=source_uri,
            chunking_config=chunking_config,
        )

        logger.info(
            "api_sync_source_queued",
            corpus_id=str(corpus_id),
            run_id=run_id,
        )

        return AsyncPipelineResponse(
            run_id=run_id,
            status="running",
            message="Sync source task started. Check Pipeline page for progress.",
        )

    except KnowledgeError as exc:
        raise _map_exception_to_http(exc) from exc
    except ValidationError as exc:
        logger.warning("pydantic_validation_error", errors=exc.errors())
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": "Invalid request parameters", "errors": exc.errors()},
        ) from exc


@router.post("/base/{corpus_id}/rebuild_source", response_model=AsyncPipelineResponse)
async def rebuild_source(
    corpus_id: UUID,
    payload: RebuildSourceRequest,
    background_tasks: BackgroundTasks,
) -> AsyncPipelineResponse:
    """异步重建 GCS 源（重新下载并摄入）

    立即返回 run_id，实际处理在后台执行。
    可在 Pipeline 页面查看进度。
    """
    resolved_app = _resolve_app_name(payload.app_name)
    source_uri = payload.source_uri

    # 验证 source_uri 是有效的 blob URI
    if not source_uri or not source_uri.startswith("pgblob://"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_SOURCE_URI",
                "message": "source_uri must be a valid blob URI (pgblob://...) for rebuild operation",
            },
        )

    logger.info(
        "api_rebuild_source_started",
        corpus_id=str(corpus_id),
        app_name=resolved_app,
        source_uri=source_uri,
    )

    try:
        service = _get_service()

        # 获取 corpus 配置作为基础
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
            operation="rebuild_source",
            input_data={
                "corpus_id": str(corpus_id),
                "source_uri": source_uri,
                "chunking_config": chunking_config_summary(chunking_config),
            },
        )

        # 添加后台任务
        background_tasks.add_task(
            service.execute_rebuild_source_pipeline,
            run_id=run_id,
            corpus_id=corpus_id,
            app_name=resolved_app,
            source_uri=source_uri,
            chunking_config=chunking_config,
        )

        logger.info(
            "api_rebuild_source_queued",
            corpus_id=str(corpus_id),
            run_id=run_id,
        )

        return AsyncPipelineResponse(
            run_id=run_id,
            status="running",
            message="Rebuild source task started. Check Pipeline page for progress.",
        )

    except KnowledgeError as exc:
        raise _map_exception_to_http(exc) from exc
    except ValidationError as exc:
        logger.warning("pydantic_validation_error", errors=exc.errors())
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": "Invalid request parameters", "errors": exc.errors()},
        ) from exc


@router.post("/base/{corpus_id}/delete_source", response_model=DeleteSourceResponse)
async def delete_source(
    corpus_id: UUID,
    payload: DeleteSourceRequest,
) -> DeleteSourceResponse:
    """删除指定 source_uri 的所有知识块

    Args:
        corpus_id: 知识库 ID
        payload: 删除请求，包含 source_uri

    Returns:
        DeleteSourceResponse: 删除的记录数量
    """
    resolved_app = _resolve_app_name(payload.app_name)
    source_uri = payload.source_uri

    if not source_uri:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_SOURCE_URI", "message": "source_uri is required"},
        )

    logger.info(
        "api_delete_source_started",
        corpus_id=str(corpus_id),
        app_name=resolved_app,
        source_uri=source_uri,
    )

    try:
        service = _get_service()
        result = await service.delete_source(
            corpus_id=corpus_id,
            app_name=resolved_app,
            source_uri=source_uri,
        )

        logger.info(
            "api_delete_source_completed",
            corpus_id=str(corpus_id),
            app_name=resolved_app,
            source_uri=source_uri,
            deleted_count=result["deleted_count"],
            deleted_documents=result["deleted_documents"],
            deleted_gcs_objects=result["deleted_gcs_objects"],
            warning_count=len(result["warnings"]),
        )

        return DeleteSourceResponse(
            deleted_count=result["deleted_count"],
            deleted_documents=result["deleted_documents"],
            deleted_gcs_objects=result["deleted_gcs_objects"],
            warnings=result["warnings"],
        )

    except KnowledgeError as exc:
        raise _map_exception_to_http(exc) from exc


@router.post("/base/{corpus_id}/archive_source", response_model=ArchiveSourceResponse)
async def archive_source(
    corpus_id: UUID,
    payload: ArchiveSourceRequest,
) -> ArchiveSourceResponse:
    """归档或解档指定 source_uri

    通过更新 Knowledge 记录的 metadata 中的 archived 字段实现归档/解档。
    归档后的 Source 仍然存在，但在默认查询中会被排除。

    Args:
        corpus_id: 知识库 ID
        payload: 归档请求，包含 source_uri 和 archived 状态

    Returns:
        ArchiveSourceResponse: 更新的记录数量
    """
    resolved_app = _resolve_app_name(payload.app_name)
    source_uri = payload.source_uri

    if not source_uri:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_SOURCE_URI", "message": "source_uri is required"},
        )

    logger.info(
        "api_archive_source_started",
        corpus_id=str(corpus_id),
        app_name=resolved_app,
        source_uri=source_uri,
        archived=payload.archived,
    )

    try:
        service = _get_service()
        updated_count = await service.archive_source(
            corpus_id=corpus_id,
            app_name=resolved_app,
            source_uri=source_uri,
            archived=payload.archived,
        )

        logger.info(
            "api_archive_source_completed",
            corpus_id=str(corpus_id),
            app_name=resolved_app,
            source_uri=source_uri,
            archived=payload.archived,
            updated_count=updated_count,
        )

        return ArchiveSourceResponse(updated_count=updated_count, archived=payload.archived)

    except KnowledgeError as exc:
        raise _map_exception_to_http(exc) from exc
