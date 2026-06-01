from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable, Iterable
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from negentropy.logging import get_logger

from .cancellation import (
    get_cancel_event,
    unregister_cancellable_run,
)
from .exceptions import PipelineCancelled
from .ingestion.chunking import chunk_text, semantic_chunk_async

if TYPE_CHECKING:
    from .dao import KnowledgeRunDao
from .constants import TEXT_PREVIEW_MAX_LENGTH
from .ingestion.extraction import ROUTE_FILE_MD, ROUTE_URL, ExtractedDocumentResult, extract_source, resolve_source_kind
from .ingestion.source_tracking import SourceTrackingService, TrackingContext
from .pipeline_tracker import (
    CHUNK_ROLE_CHILD,
    CHUNK_ROLE_PARENT,
    BatchEmbeddingFn,
    EmbeddingFn,
    PipelineOperation,
    PipelineTracker,
    _extract_source_label,
)
from .retrieval.postprocess import hydrate_match_metadata, lift_hierarchical_matches, record_match_retrievals
from .retrieval.repository import KnowledgeRepository
from .retrieval.reranking import NoopReranker, Reranker
from .types import (
    ChunkingConfig,
    ChunkingStrategy,
    CorpusRecord,
    CorpusSpec,
    HierarchicalChunkingConfig,
    KnowledgeChunk,
    KnowledgeMatch,
    KnowledgeRecord,
    RecursiveChunkingConfig,
    SearchConfig,
    SourceSummary,
    chunking_config_summary,
    default_chunking_config,
    merge_search_results,
    normalize_source_metadata,
)

logger = get_logger("negentropy.knowledge.service")


class KnowledgeService:
    def __init__(
        self,
        repository: KnowledgeRepository | None = None,
        embedding_fn: EmbeddingFn | None = None,
        batch_embedding_fn: BatchEmbeddingFn | None = None,
        chunking_config: ChunkingConfig | None = None,
        reranker: Reranker | None = None,
        pipeline_dao: KnowledgeRunDao | None = None,
    ) -> None:
        self._repository = repository or KnowledgeRepository()
        self._embedding_fn = embedding_fn
        self._batch_embedding_fn = batch_embedding_fn
        self._chunking_config = chunking_config or default_chunking_config()
        self._reranker = reranker or NoopReranker()
        self._pipeline_dao = pipeline_dao
        # Phase 2: 来源追踪服务（懒初始化）
        self._source_tracker: SourceTrackingService | None = None

    @property
    def source_tracker(self) -> SourceTrackingService:
        """懒初始化来源追踪服务"""
        if self._source_tracker is None:
            self._source_tracker = SourceTrackingService()
        return self._source_tracker

    async def _resume_async_pipeline_tracker(self, tracker: PipelineTracker) -> PipelineTracker:
        await tracker.resume()
        tracker._status = "running"
        tracker._completed_at = None
        tracker._duration_ms = None
        tracker._error = None
        return tracker

    @staticmethod
    async def _fail_pipeline_execution(tracker: PipelineTracker | None, exc: Exception) -> None:
        # 取消不是失败：让 PipelineCancelled 穿透到顶层 except，由 tracker.cancel() 落库；
        # 否则中间层 helper 的 `except Exception: fail; raise` 会把取消错误写成 failed 终态。
        if isinstance(exc, PipelineCancelled):
            return
        if not tracker:
            return
        error_payload: dict[str, Any] = {
            "type": type(exc).__name__,
            "message": str(exc),
        }
        if isinstance(getattr(exc, "details", None), dict):
            error_payload.update(exc.details)
        await tracker.fail(error_payload)

    async def _get_corpus_config(self, corpus_id: UUID) -> dict[str, Any]:
        corpus = await self.get_corpus_by_id(corpus_id)
        return corpus.config if corpus and corpus.config else {}

    async def _extract_url_content(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        url: str,
        tracker: PipelineTracker | None = None,
    ) -> tuple[str, ExtractedDocumentResult]:
        """提取 URL 内容，返回 (plain_text, 完整结果)"""
        cancel_event = get_cancel_event(tracker.run_id) if tracker else None
        try:
            result = await extract_source(
                app_name=app_name,
                corpus_id=corpus_id,
                corpus_config=await self._get_corpus_config(corpus_id),
                source_kind=ROUTE_URL,
                url=url,
                tracker=tracker,
                cancel_event=cancel_event,
            )
        except Exception as exc:
            self._raise_if_mcp_cancelled(exc, tracker)
            raise
        return result.plain_text, result

    async def _extract_file_document(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        content: bytes,
        filename: str,
        content_type: str | None,
        tracker: PipelineTracker | None = None,
    ) -> ExtractedDocumentResult:
        source_kind = resolve_source_kind(filename=filename, content_type=content_type)

        # Markdown 文件：跳过 MCP 提取，直接读取文件内容
        if source_kind == ROUTE_FILE_MD:
            from .ingestion.content import optimize_markdown_content

            raw_text = content.decode("utf-8", errors="replace")
            markdown = optimize_markdown_content(raw_text)
            return ExtractedDocumentResult(
                plain_text=raw_text,
                markdown_content=markdown,
                metadata={"source_kind": source_kind, "extraction_method": "passthrough"},
                assets=[],
                trace={"provider": "passthrough", "source_kind": source_kind},
            )

        # 非 Markdown 文件：通过 MCP 提取
        cancel_event = get_cancel_event(tracker.run_id) if tracker else None
        try:
            result = await extract_source(
                app_name=app_name,
                corpus_id=corpus_id,
                corpus_config=await self._get_corpus_config(corpus_id),
                source_kind=source_kind,
                content=content,
                filename=filename,
                content_type=content_type,
                tracker=tracker,
                cancel_event=cancel_event,
            )
        except Exception as exc:
            self._raise_if_mcp_cancelled(exc, tracker)
            raise
        return result

    @staticmethod
    def _validate_extracted_document(
        result: ExtractedDocumentResult,
        *,
        source_uri: str,
    ) -> str:
        plain_text = (result.plain_text or "").strip()
        markdown = (result.markdown_content or "").strip()
        if not plain_text:
            diagnostics = {
                "source_uri": source_uri,
                "trace": result.trace,
                "metadata": result.metadata,
            }
            raise ValueError(f"Extractor produced empty document after normalization: {diagnostics}")
        return plain_text or markdown

    @staticmethod
    def _raise_if_mcp_cancelled(exc: Exception, tracker: PipelineTracker | None) -> None:
        """若异常为 McpCancelledError，转换为 PipelineCancelled 向上传播。

        集中在 _extract_file_document / _extract_url_content 层做转换，
        让顶层 execute_*_pipeline 的现有 ``except PipelineCancelled`` 处理逻辑无需变更。
        """
        from negentropy.interface.mcp_client import McpCancelledError

        if isinstance(exc, McpCancelledError) and tracker:
            raise PipelineCancelled(tracker.run_id, last_stage=tracker.current_stage) from None

    # =========================================================================
    # Pipeline 创建与执行（支持异步后台任务）
    # =========================================================================

    async def create_pipeline(
        self,
        *,
        app_name: str,
        operation: PipelineOperation,
        input_data: dict[str, Any],
    ) -> str:
        """创建 Pipeline 记录并返回 run_id

        用于异步操作：先创建 running 状态的 Pipeline 记录，
        然后在后台任务中执行实际操作。

        Args:
            app_name: 应用名称
            operation: 操作类型（ingest_text, ingest_url, replace_source 等）
            input_data: 输入数据

        Returns:
            str: run_id，用于后续追踪和执行
        """
        if not self._pipeline_dao:
            raise ValueError("pipeline_dao is required for async pipeline operations")

        label = _extract_source_label(input_data)
        run_id = f"{operation}-{label}-{uuid.uuid4().hex[:4]}" if label else f"{operation}-{uuid.uuid4().hex[:8]}"

        tracker = PipelineTracker(
            dao=self._pipeline_dao,
            app_name=app_name,
            operation=operation,
            run_id=run_id,
        )
        await tracker.start(input_data)

        logger.info(
            "pipeline_created",
            app_name=app_name,
            operation=operation,
            run_id=tracker.run_id,
        )

        return tracker.run_id

    async def _execute_pipeline_body(
        self,
        tracker: PipelineTracker,
        run_id: str,
        body: Callable[[], Awaitable[list[KnowledgeRecord]]],
    ) -> list[KnowledgeRecord]:
        """Pipeline 执行生命周期模板：异常处理 + 终态确保 + 取消注册。

        统一包装 ``execute_*_pipeline`` 系列方法中完全相同的
        except/finally 样板，消除跨方法的重复代码。

        Args:
            tracker: Pipeline 追踪器
            run_id: Pipeline 运行 ID
            body: 异步 callable，执行 pipeline 的核心业务逻辑并返回结果记录。

        Returns:
            成功时返回 body 的结果；取消或异常时返回 ``[]``。
        """
        try:
            return await body()
        except PipelineCancelled as cancel_exc:
            await tracker.cancel(last_stage=cancel_exc.last_stage)
            return []
        except Exception as exc:
            await self._fail_pipeline_execution(tracker, exc)
            return []
        finally:
            try:
                await tracker.ensure_finalized()
            except Exception:
                pass
            unregister_cancellable_run(run_id)

    async def execute_ingest_text_pipeline(
        self,
        *,
        run_id: str,
        corpus_id: UUID,
        app_name: str,
        text: str,
        source_uri: str | None = None,
        metadata: dict[str, Any] | None = None,
        chunking_config: ChunkingConfig | None = None,
    ) -> list[KnowledgeRecord]:
        """执行 ingest_text Pipeline（后台任务）

        由 BackgroundTasks 调用，使用已有的 run_id 追踪执行状态。

        Args:
            run_id: 已创建的 Pipeline run_id
            corpus_id: 知识库 ID
            app_name: 应用名称
            text: 要摄入的文本
            source_uri: 来源 URI
            metadata: 元数据
            chunking_config: 分块配置

        Returns:
            list[KnowledgeRecord]: 创建的知识记录
        """
        if not self._pipeline_dao:
            raise ValueError("pipeline_dao is required for async pipeline operations")

        tracker = PipelineTracker(
            dao=self._pipeline_dao,
            app_name=app_name,
            operation="ingest_text",
            run_id=run_id,
        )
        await self._resume_async_pipeline_tracker(tracker)

        logger.info(
            "pipeline_execution_started",
            run_id=run_id,
            corpus_id=str(corpus_id),
            operation="ingest_text",
        )

        async def _body() -> list[KnowledgeRecord]:
            normalized_metadata = normalize_source_metadata(source_uri=source_uri, metadata=metadata)
            records = await self._ingest_text_with_tracker(
                corpus_id=corpus_id,
                app_name=app_name,
                text=text,
                source_uri=source_uri,
                metadata=normalized_metadata,
                chunking_config=chunking_config or self._chunking_config,
                tracker=tracker,
            )
            await tracker.complete({"record_count": len(records)})

            logger.info(
                "pipeline_execution_completed",
                run_id=run_id,
                corpus_id=str(corpus_id),
                record_count=len(records),
            )

            return records

        return await self._execute_pipeline_body(tracker, run_id, _body)

    async def execute_ingest_url_pipeline(
        self,
        *,
        run_id: str,
        corpus_id: UUID,
        app_name: str,
        url: str,
        metadata: dict[str, Any] | None = None,
        chunking_config: ChunkingConfig | None = None,
    ) -> list[KnowledgeRecord]:
        """执行 ingest_url Pipeline（后台任务）"""
        if not self._pipeline_dao:
            raise ValueError("pipeline_dao is required for async pipeline operations")

        tracker = PipelineTracker(
            dao=self._pipeline_dao,
            app_name=app_name,
            operation="ingest_url",
            run_id=run_id,
        )
        await self._resume_async_pipeline_tracker(tracker)

        logger.info(
            "pipeline_execution_started",
            run_id=run_id,
            corpus_id=str(corpus_id),
            operation="ingest_url",
            url=url,
        )

        async def _body() -> list[KnowledgeRecord]:
            try:
                text = await self._extract_url_content(
                    corpus_id=corpus_id,
                    app_name=app_name,
                    url=url,
                    tracker=tracker,
                )
            except ValueError as exc:
                from .exceptions import KnowledgeError
                from .ingestion.extraction import ExtractorExecutionError

                url_details: dict[str, Any] = {}
                if isinstance(exc, ExtractorExecutionError) and not exc.attempts:
                    url_details["failure_category"] = "no_extractor_configured"
                    url_details["diagnostic_summary"] = (
                        "请配置 Negentropy Perceives MCP 服务，并确保 Corpus 的 extractor_routes 配置正确。"
                    )
                raise KnowledgeError(
                    code="CONTENT_FETCH_FAILED",
                    message=f"Failed to fetch content from URL: {exc}",
                    details=url_details or None,
                ) from exc

            if not text:
                raise ValueError("No content extracted from URL")

            # Merge metadata
            meta = normalize_source_metadata(source_uri=url, metadata=metadata)
            meta["source_url"] = url

            # 后续阶段复用 _ingest_text_with_tracker
            records = await self._ingest_text_with_tracker(
                corpus_id=corpus_id,
                app_name=app_name,
                text=text,
                source_uri=url,
                metadata=meta,
                chunking_config=chunking_config or self._chunking_config,
                tracker=tracker,
            )
            await tracker.complete({"chunk_count": len(records)})

            logger.info(
                "pipeline_execution_completed",
                run_id=run_id,
                corpus_id=str(corpus_id),
                record_count=len(records),
            )

            return records

        return await self._execute_pipeline_body(tracker, run_id, _body)

    async def execute_ingest_url_document_pipeline(
        self,
        *,
        run_id: str,
        corpus_id: UUID,
        app_name: str,
        url: str,
        chunking_config: ChunkingConfig | None = None,
        user_id: str | None = None,
    ) -> list[KnowledgeRecord]:
        """执行 ingest_url (as_document=True) Pipeline（后台任务）

        将 URL 提取、文档存储、分块和向量化全部在后台完成。
        Pipeline 记录在 API 层已提前创建，此处 resume 后继续执行。
        """
        if not self._pipeline_dao:
            raise ValueError("pipeline_dao is required for async pipeline operations")

        tracker = PipelineTracker(
            dao=self._pipeline_dao,
            app_name=app_name,
            operation="ingest_url",
            run_id=run_id,
        )
        await self._resume_async_pipeline_tracker(tracker)

        logger.info(
            "pipeline_execution_started",
            run_id=run_id,
            corpus_id=str(corpus_id),
            operation="ingest_url",
            url=url,
            as_document=True,
        )

        async def _body() -> list[KnowledgeRecord]:
            # Stage 1: 提取 URL 内容
            try:
                text, extraction_result = await self._extract_url_content(
                    corpus_id=corpus_id,
                    app_name=app_name,
                    url=url,
                    tracker=tracker,
                )
            except ValueError as exc:
                from .exceptions import KnowledgeError
                from .ingestion.extraction import ExtractorExecutionError

                url_details: dict[str, Any] = {}
                if isinstance(exc, ExtractorExecutionError) and not exc.attempts:
                    url_details["failure_category"] = "no_extractor_configured"
                    url_details["diagnostic_summary"] = (
                        "请配置 Negentropy Perceives MCP 服务，并确保 Corpus 的 extractor_routes 配置正确。"
                    )
                raise KnowledgeError(
                    code="CONTENT_FETCH_FAILED",
                    message=f"Failed to fetch content from URL: {exc}",
                    details=url_details or None,
                ) from exc

            if not text:
                raise ValueError("No content extracted from URL")

            # Stage 2: 文档存储
            await tracker.start_stage("document_store")
            from negentropy.storage.service import DocumentStorageService

            from .ingestion.extraction import build_url_document_filename, persist_extracted_assets

            storage_service = DocumentStorageService()
            raw_name = build_url_document_filename(url)
            markdown_bytes = extraction_result.markdown_content.encode("utf-8")
            doc_record, is_new_doc = await storage_service.upload_and_store(
                corpus_id=corpus_id,
                app_name=app_name,
                content=markdown_bytes,
                filename=raw_name,
                content_type="text/markdown",
                metadata={
                    "source_type": "url",
                    "origin_url": url,
                    "title": extraction_result.metadata.get("title"),
                },
                created_by=user_id,
            )
            await storage_service.save_markdown_content(
                document_id=doc_record.id,
                markdown_content=extraction_result.markdown_content,
                markdown_gcs_uri=doc_record.gcs_uri,
            )
            stored_assets = await persist_extracted_assets(
                document_id=doc_record.id,
                assets=extraction_result.assets,
                tracker=tracker,
            )
            await tracker.complete_stage(
                "document_store",
                {
                    "document_id": str(doc_record.id),
                    "duplicate_document": not is_new_doc,
                    "stored_assets": len(stored_assets) if stored_assets else 0,
                },
            )

            # Stage 3: 分块 + 向量化
            meta = normalize_source_metadata(source_uri=url, metadata=None)
            meta["source_type"] = "url"
            meta["origin_url"] = url
            meta["document_id"] = str(doc_record.id)
            meta["extractor_trace"] = extraction_result.trace
            if stored_assets:
                meta["extracted_assets"] = stored_assets

            records = await self._ingest_text_with_tracker(
                corpus_id=corpus_id,
                app_name=app_name,
                text=text,
                source_uri=url,
                metadata=meta,
                chunking_config=chunking_config or self._chunking_config,
                tracker=tracker,
            )
            await tracker.complete({"chunk_count": len(records), "document_id": str(doc_record.id)})

            logger.info(
                "pipeline_execution_completed",
                run_id=run_id,
                corpus_id=str(corpus_id),
                record_count=len(records),
                document_id=str(doc_record.id),
                operation="ingest_url",
                as_document=True,
            )
            return records

        return await self._execute_pipeline_body(tracker, run_id, _body)

    async def execute_ingest_file_pipeline(
        self,
        *,
        run_id: str,
        corpus_id: UUID,
        app_name: str,
        content: bytes,
        filename: str,
        content_type: str | None,
        source_uri: str | None,
        metadata: dict[str, Any] | None = None,
        chunking_config: ChunkingConfig | None = None,
        document_id: UUID | None = None,
    ) -> list[KnowledgeRecord]:
        """执行 ingest_file Pipeline（后台任务）"""
        if not self._pipeline_dao:
            raise ValueError("pipeline_dao is required for async pipeline operations")

        tracker = PipelineTracker(
            dao=self._pipeline_dao,
            app_name=app_name,
            operation="ingest_file",
            run_id=run_id,
        )
        await self._resume_async_pipeline_tracker(tracker)
        config = chunking_config or self._chunking_config

        logger.info(
            "pipeline_execution_started",
            run_id=run_id,
            corpus_id=str(corpus_id),
            operation="ingest_file",
            source_uri=source_uri,
            filename=filename,
            document_id=str(document_id) if document_id else None,
        )

        async def _body() -> list[KnowledgeRecord]:
            try:
                extracted = await self._extract_file_document(
                    corpus_id=corpus_id,
                    app_name=app_name,
                    content=content,
                    filename=filename,
                    content_type=content_type,
                    tracker=tracker,
                )
                await tracker.start_stage("extract_gate")
                text = self._validate_extracted_document(extracted, source_uri=source_uri or filename)
                await tracker.complete_stage(
                    "extract_gate",
                    {
                        "plain_text_length": len(extracted.plain_text),
                        "markdown_length": len(extracted.markdown_content),
                        "trace": extracted.trace,
                    },
                )

            except ValueError as exc:
                from .exceptions import KnowledgeError
                from .ingestion.extraction import ExtractorExecutionError

                details: dict[str, Any] = {}
                if isinstance(exc, ExtractorExecutionError) and not exc.attempts:
                    details["failure_category"] = "no_extractor_configured"
                    details["diagnostic_summary"] = (
                        "请配置 Negentropy Perceives MCP 服务，并确保 Corpus 的 extractor_routes 配置正确。"
                    )
                raise KnowledgeError(
                    code="CONTENT_EXTRACTION_FAILED",
                    message=f"Failed to extract content: {exc}",
                    details=details or None,
                ) from exc

            # Phase 2: 来源追踪（文件类型自动判断）
            if document_id:
                await tracker.start_stage("source_tracking")
                try:
                    source_kind = resolve_source_kind(
                        source_uri=source_uri or filename,
                        filename=filename,
                        content_type=content_type,
                    )
                    tracking_ctx = TrackingContext(
                        tracker_run_id=tracker.run_id if tracker else None,
                        corpus_id=corpus_id,
                        app_name=app_name,
                    )
                    async with self._repository.session() as db:
                        await self.source_tracker.track(
                            db,
                            document_id=document_id,
                            result=extracted,
                            source_kind=source_kind,
                            context=tracking_ctx,
                        )
                except Exception as track_exc:
                    logger.warning("source_tracking_failed", error=str(track_exc), exc_info=True)
                await tracker.complete_stage("source_tracking")

            if document_id:
                from .ingestion.extraction import store_extracted_document_artifacts

                await tracker.start_stage("markdown_store")
                markdown_gcs_uri, _ = await store_extracted_document_artifacts(
                    document_id=document_id,
                    extracted=extracted,
                    tracker=tracker,
                )
                await tracker.complete_stage(
                    "markdown_store",
                    {
                        "document_id": str(document_id),
                        "markdown_gcs_uri": markdown_gcs_uri,
                        "markdown_length": len(extracted.markdown_content),
                    },
                )
            records = await self._ingest_text_with_tracker(
                corpus_id=corpus_id,
                app_name=app_name,
                text=text,
                source_uri=source_uri,
                metadata=normalize_source_metadata(source_uri=source_uri, metadata=metadata),
                chunking_config=config,
                tracker=tracker,
            )
            await tracker.complete(
                {
                    "chunk_count": len(records),
                    "document_id": str(document_id) if document_id else None,
                }
            )

            logger.info(
                "pipeline_execution_completed",
                run_id=run_id,
                corpus_id=str(corpus_id),
                record_count=len(records),
                operation="ingest_file",
            )

            return records

        return await self._execute_pipeline_body(tracker, run_id, _body)

    async def execute_replace_source_pipeline(
        self,
        *,
        run_id: str,
        corpus_id: UUID,
        app_name: str,
        text: str,
        source_uri: str,
        metadata: dict[str, Any] | None = None,
        chunking_config: ChunkingConfig | None = None,
    ) -> list[KnowledgeRecord]:
        """执行 replace_source Pipeline（后台任务）"""
        if not self._pipeline_dao:
            raise ValueError("pipeline_dao is required for async pipeline operations")

        tracker = PipelineTracker(
            dao=self._pipeline_dao,
            app_name=app_name,
            operation="replace_source",
            run_id=run_id,
        )
        await self._resume_async_pipeline_tracker(tracker)
        config = chunking_config or self._chunking_config

        logger.info(
            "pipeline_execution_started",
            run_id=run_id,
            corpus_id=str(corpus_id),
            operation="replace_source",
            source_uri=source_uri,
        )

        async def _body() -> list[KnowledgeRecord]:
            # 原子 DELETE+INSERT：由 _ingest_text_with_tracker(persist_mode="replace") 内部完成
            # 同事务保护，并合成 "delete" stage 事件供前端 Pipeline 时间轴展示
            records = await self._ingest_text_with_tracker(
                corpus_id=corpus_id,
                app_name=app_name,
                text=text,
                source_uri=source_uri,
                metadata=normalize_source_metadata(source_uri=source_uri, metadata=metadata),
                chunking_config=config,
                tracker=tracker,
                persist_mode="replace",
            )
            deleted_count = int(tracker.get_stage_output("persist").get("replaced_count") or 0) if tracker else 0
            await tracker.complete({"deleted_count": deleted_count, "chunk_count": len(records)})

            logger.info(
                "pipeline_execution_completed",
                run_id=run_id,
                corpus_id=str(corpus_id),
                record_count=len(records),
            )

            return records

        return await self._execute_pipeline_body(tracker, run_id, _body)

    async def execute_sync_source_pipeline(
        self,
        *,
        run_id: str,
        corpus_id: UUID,
        app_name: str,
        source_uri: str,
        chunking_config: ChunkingConfig | None = None,
    ) -> list[KnowledgeRecord]:
        """执行 sync_source Pipeline（后台任务）"""
        if not self._pipeline_dao:
            raise ValueError("pipeline_dao is required for async pipeline operations")

        tracker = PipelineTracker(
            dao=self._pipeline_dao,
            app_name=app_name,
            operation="sync_source",
            run_id=run_id,
        )
        await self._resume_async_pipeline_tracker(tracker)
        config = chunking_config or self._chunking_config

        logger.info(
            "pipeline_execution_started",
            run_id=run_id,
            corpus_id=str(corpus_id),
            operation="sync_source",
            source_uri=source_uri,
        )

        async def _body() -> list[KnowledgeRecord]:
            try:
                text = await self._extract_url_content(
                    corpus_id=corpus_id,
                    app_name=app_name,
                    url=source_uri,
                    tracker=tracker,
                )
            except ValueError as exc:
                from .exceptions import KnowledgeError

                raise KnowledgeError(
                    code="CONTENT_FETCH_FAILED", message=f"Failed to fetch content from URL: {exc}"
                ) from exc

            if not text:
                raise ValueError("No content extracted from URL")

            metadata = normalize_source_metadata(
                source_uri=source_uri,
                metadata={"source_url": source_uri},
            )

            # 原子 DELETE+INSERT：由 _ingest_text_with_tracker(persist_mode="replace") 内部完成
            records = await self._ingest_text_with_tracker(
                corpus_id=corpus_id,
                app_name=app_name,
                text=text,
                source_uri=source_uri,
                metadata=normalize_source_metadata(source_uri=source_uri, metadata=metadata),
                chunking_config=config,
                tracker=tracker,
                persist_mode="replace",
            )
            deleted_count = int(tracker.get_stage_output("persist").get("replaced_count") or 0) if tracker else 0
            await tracker.complete({"deleted_count": deleted_count, "chunk_count": len(records)})

            logger.info(
                "pipeline_execution_completed",
                run_id=run_id,
                corpus_id=str(corpus_id),
                record_count=len(records),
            )

            return records

        return await self._execute_pipeline_body(tracker, run_id, _body)

    async def execute_sync_document_pipeline(
        self,
        *,
        run_id: str,
        corpus_id: UUID,
        app_name: str,
        document_id: UUID,
        source_uri: str,
        chunking_config: ChunkingConfig | None = None,
    ) -> list[KnowledgeRecord]:
        """执行 sync_document Pipeline（后台任务）

        在后台完成 URL 重新提取、Markdown 存储和索引替换。
        Pipeline 记录在 API 层已提前创建，此处 resume 后继续执行。
        """
        if not self._pipeline_dao:
            raise ValueError("pipeline_dao is required for async pipeline operations")

        tracker = PipelineTracker(
            dao=self._pipeline_dao,
            app_name=app_name,
            operation="replace_source",
            run_id=run_id,
        )
        await self._resume_async_pipeline_tracker(tracker)

        logger.info(
            "pipeline_execution_started",
            run_id=run_id,
            corpus_id=str(corpus_id),
            operation="sync_document",
            source_uri=source_uri,
            document_id=str(document_id),
        )

        async def _body() -> list[KnowledgeRecord]:
            # Stage 1: 从 URL 重新提取内容
            try:
                text, extraction_result = await self._extract_url_content(
                    corpus_id=corpus_id,
                    app_name=app_name,
                    url=source_uri,
                    tracker=tracker,
                )
            except ValueError as exc:
                from .exceptions import KnowledgeError
                from .ingestion.extraction import ExtractorExecutionError

                url_details: dict[str, Any] = {}
                if isinstance(exc, ExtractorExecutionError) and not exc.attempts:
                    url_details["failure_category"] = "no_extractor_configured"
                    url_details["diagnostic_summary"] = (
                        "请配置 Negentropy Perceives MCP 服务，并确保 Corpus 的 extractor_routes 配置正确。"
                    )
                raise KnowledgeError(
                    code="CONTENT_FETCH_FAILED",
                    message=f"Failed to fetch content from URL: {exc}",
                    details=url_details or None,
                ) from exc

            if not text:
                raise ValueError("No content extracted from URL during sync")

            # Stage 2: 保存 Markdown 和资产
            await tracker.start_stage("markdown_store")
            from .ingestion.extraction import store_extracted_document_artifacts

            _, stored_assets = await store_extracted_document_artifacts(
                document_id=document_id,
                extracted=extraction_result,
                tracker=tracker,
            )

            # 回填页面标题到文档 metadata（首次同步或历史数据补齐）
            extraction_title = extraction_result.metadata.get("title")
            if extraction_title:
                try:
                    from negentropy.storage.service import DocumentStorageService

                    await DocumentStorageService().update_document_metadata(
                        document_id=document_id,
                        metadata_patch={"title": extraction_title},
                    )
                except Exception:
                    logger.warning("Failed to backfill title for document %s", document_id, exc_info=True)

            await tracker.complete_stage(
                "markdown_store",
                {
                    "document_id": str(document_id),
                    "markdown_length": len(extraction_result.markdown_content),
                    "stored_assets": len(stored_assets) if stored_assets else 0,
                },
            )

            # Stage 3+: 原子 DELETE+INSERT：由 _ingest_text_with_tracker(persist_mode="replace") 内部完成
            meta = normalize_source_metadata(
                source_uri=source_uri,
                metadata={"source_type": "url", "origin_url": source_uri, "document_id": str(document_id)},
            )
            meta["extractor_trace"] = extraction_result.trace
            if stored_assets:
                meta["extracted_assets"] = stored_assets

            records = await self._ingest_text_with_tracker(
                corpus_id=corpus_id,
                app_name=app_name,
                text=text,
                source_uri=source_uri,
                metadata=meta,
                chunking_config=chunking_config or self._chunking_config,
                tracker=tracker,
                persist_mode="replace",
            )
            deleted_count = int(tracker.get_stage_output("persist").get("replaced_count") or 0) if tracker else 0
            await tracker.complete({"deleted_count": deleted_count, "chunk_count": len(records)})

            logger.info(
                "pipeline_execution_completed",
                run_id=run_id,
                corpus_id=str(corpus_id),
                record_count=len(records),
                operation="sync_document",
            )
            return records

        return await self._execute_pipeline_body(tracker, run_id, _body)

    async def execute_rebuild_source_pipeline(
        self,
        *,
        run_id: str,
        corpus_id: UUID,
        app_name: str,
        source_uri: str,
        chunking_config: ChunkingConfig | None = None,
        document_id: UUID | None = None,
    ) -> list[KnowledgeRecord]:
        """执行 rebuild_source Pipeline（后台任务）"""
        if not self._pipeline_dao:
            raise ValueError("pipeline_dao is required for async pipeline operations")

        tracker = PipelineTracker(
            dao=self._pipeline_dao,
            app_name=app_name,
            operation="rebuild_source",
            run_id=run_id,
        )
        await self._resume_async_pipeline_tracker(tracker)
        config = chunking_config or self._chunking_config

        logger.info(
            "pipeline_execution_started",
            run_id=run_id,
            corpus_id=str(corpus_id),
            operation="rebuild_source",
            source_uri=source_uri,
        )

        async def _body() -> list[KnowledgeRecord]:
            # 阶段 1: Download
            await tracker.start_stage("download")
            try:
                from negentropy.storage.gcs_client import StorageError
                from negentropy.storage.service import DocumentStorageService

                storage_service = DocumentStorageService()
                content = await storage_service.get_document_content_by_uri(source_uri)

                if content is None:
                    raise ValueError(f"Document not found in GCS: {source_uri}")
            except StorageError as exc:
                from .exceptions import KnowledgeError

                raise KnowledgeError(
                    code="GCS_DOWNLOAD_FAILED",
                    message=f"Failed to download content from GCS: {exc}",
                ) from exc

            await tracker.complete_stage(
                "download", {"content_length": len(content) if content else 0, "source_uri": source_uri}
            )

            try:
                filename = source_uri.split("/")[-1]
                content_type = _guess_content_type(filename)

                extracted = await self._extract_file_document(
                    corpus_id=corpus_id,
                    app_name=app_name,
                    content=content,
                    filename=filename,
                    content_type=content_type,
                    tracker=tracker,
                )
                await tracker.start_stage("extract_gate")
                text = self._validate_extracted_document(extracted, source_uri=source_uri)
                await tracker.complete_stage(
                    "extract_gate",
                    {
                        "plain_text_length": len(extracted.plain_text),
                        "markdown_length": len(extracted.markdown_content),
                        "trace": extracted.trace,
                    },
                )
            except ValueError as exc:
                from .exceptions import KnowledgeError

                raise KnowledgeError(
                    code="CONTENT_EXTRACTION_FAILED",
                    message=f"Failed to extract content: {exc}",
                ) from exc

            # 阶段 2: Delete（原子化，由 _ingest_text_with_tracker 内部完成）

            if document_id:
                from .ingestion.extraction import store_extracted_document_artifacts

                await tracker.start_stage("markdown_store")
                markdown_gcs_uri, _ = await store_extracted_document_artifacts(
                    document_id=document_id,
                    extracted=extracted,
                    tracker=tracker,
                )
                await tracker.complete_stage(
                    "markdown_store",
                    {
                        "document_id": str(document_id),
                        "markdown_gcs_uri": markdown_gcs_uri,
                        "markdown_length": len(extracted.markdown_content),
                    },
                )
            metadata = normalize_source_metadata(
                source_uri=source_uri,
                metadata={"gcs_uri": source_uri, "rebuild": True},
            )

            # 原子 DELETE+INSERT：由 _ingest_text_with_tracker(persist_mode="replace") 内部完成
            records = await self._ingest_text_with_tracker(
                corpus_id=corpus_id,
                app_name=app_name,
                text=text,
                source_uri=source_uri,
                metadata=metadata,
                chunking_config=config,
                tracker=tracker,
                persist_mode="replace",
            )
            deleted_count = int(tracker.get_stage_output("persist").get("replaced_count") or 0) if tracker else 0
            await tracker.complete(
                {
                    "deleted_count": deleted_count,
                    "chunk_count": len(records),
                    "document_id": str(document_id) if document_id else None,
                }
            )

            logger.info(
                "pipeline_execution_completed",
                run_id=run_id,
                corpus_id=str(corpus_id),
                record_count=len(records),
            )

            return records

        return await self._execute_pipeline_body(tracker, run_id, _body)

    async def ensure_corpus(self, spec: CorpusSpec) -> CorpusRecord:
        return await self._repository.get_or_create_corpus(spec)

    async def get_corpus_by_id(self, corpus_id: UUID) -> CorpusRecord | None:
        """获取指定 ID 的 Corpus"""
        return await self._repository.get_corpus_by_id(corpus_id)

    async def update_corpus(self, corpus_id: UUID, spec: dict[str, Any]) -> CorpusRecord:
        corpus = await self._repository.update_corpus(corpus_id, spec)
        if not corpus:
            from .exceptions import CorpusNotFound

            raise CorpusNotFound(details={"corpus_id": str(corpus_id)})
        return corpus

    async def list_corpora_with_counts(self, *, app_name: str) -> list[tuple[CorpusRecord, int, int]]:
        """语料库列表 + 双口径 chunks 计数（委托 repository）。"""
        return await self._repository.list_corpora_with_counts(app_name=app_name)

    async def get_corpus_with_counts(self, *, corpus_id: UUID, app_name: str) -> tuple[CorpusRecord, int, int] | None:
        """单 corpus + 双口径 chunks 计数（委托 repository）。"""
        return await self._repository.get_corpus_with_counts(corpus_id=corpus_id, app_name=app_name)

    async def ingest_text(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        text: str,
        source_uri: str | None = None,
        metadata: dict[str, Any] | None = None,
        chunking_config: ChunkingConfig | None = None,
    ) -> list[KnowledgeRecord]:
        """索引文本到知识库

        流程: 文本分块 → 向量化 → 批量写入
        """
        tracker = None
        config = chunking_config or self._chunking_config

        # 初始化 Pipeline 追踪器
        if self._pipeline_dao:
            tracker = PipelineTracker(
                dao=self._pipeline_dao,
                app_name=app_name,
                operation="ingest_text",
            )
            await tracker.start(
                {
                    "corpus_id": str(corpus_id),
                    "source_uri": source_uri,
                    "text_length": len(text),
                    "chunking_config": chunking_config_summary(config),
                }
            )

        logger.info(
            "ingestion_started",
            corpus_id=str(corpus_id),
            app_name=app_name,
            text_length=len(text),
            source_uri=source_uri,
            chunking_config=chunking_config_summary(config),
            run_id=tracker.run_id if tracker else None,
        )

        try:
            normalized_metadata = normalize_source_metadata(source_uri=source_uri, metadata=metadata)
            records = await self._ingest_text_with_tracker(
                corpus_id=corpus_id,
                app_name=app_name,
                text=text,
                source_uri=source_uri,
                metadata=normalized_metadata,
                chunking_config=config,
                tracker=tracker,
            )

            # 完成 Pipeline
            if tracker:
                await tracker.complete(
                    {
                        "chunk_count": len(records),
                    }
                )

            return records
        except Exception as exc:
            await self._fail_pipeline_execution(tracker, exc)
            raise

    async def _ingest_text_with_tracker(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        text: str,
        source_uri: str | None = None,
        metadata: dict[str, Any] | None = None,
        chunking_config: ChunkingConfig | None = None,
        tracker: PipelineTracker | None = None,
        persist_mode: str | None = None,
    ) -> list[KnowledgeRecord]:
        """内部方法：执行文本摄入，支持可选的 Pipeline 追踪。

        ``persist_mode`` 控制持久化语义（机制与策略正交分解）：
          - ``"replace"``：原子 DELETE→INSERT，按 ``source_uri`` 维度幂等替换。
            ⚠️ 要求 ``source_uri`` 非空；同时会发出合成的 ``delete`` stage 事件，
            使前端 Pipeline 时间轴展示的"删除旧记录"语义保持一致。
          - ``"append"``：纯追加（不去重）。用于 source_uri=None 等不可幂等场景。
          - ``None``（默认）：按 ``source_uri`` 自动决定 — 非空 → replace，空 → append。
        """
        config = chunking_config or self._chunking_config
        # Corpus 级 Embedding 模型解析：存在则按需构建 fn，否则回退 service 默认。
        corpus_record = await self._repository.get_corpus_by_id(corpus_id)
        corpus_config_dict: dict[str, Any] | None = dict(corpus_record.config or {}) if corpus_record else None

        # 解析有效持久化模式（单一事实源：source_uri 是 idempotent 的唯一锚点）
        effective_mode = persist_mode or ("replace" if source_uri else "append")
        if effective_mode == "replace" and not source_uri:
            # 防御式：persist_mode=replace 要求必有 source_uri，否则降级 append 并告警
            logger.warning(
                "persist_mode_replace_without_source_uri_fallback_append",
                corpus_id=str(corpus_id),
                run_id=tracker.run_id if tracker else None,
            )
            effective_mode = "append"

        # 阶段 1: Chunking
        if tracker:
            await tracker.start_stage("chunk")

        chunks = await self._build_chunks(
            text,
            source_uri=source_uri,
            metadata=metadata,
            chunking_config=config,
        )

        if tracker:
            await tracker.complete_stage(
                "chunk",
                {
                    "chunk_count": len(chunks),
                    "strategy": config.strategy.value if hasattr(config.strategy, "value") else str(config.strategy),
                },
            )

        logger.debug(
            "chunks_created",
            corpus_id=str(corpus_id),
            chunk_count=len(chunks),
        )

        # 阶段 2: Embedding
        if self._embedding_fn or self._extract_embedding_config_id(corpus_config_dict):
            if tracker:
                await tracker.start_stage("embed")

            chunks = await self._attach_embeddings(chunks, corpus_config=corpus_config_dict)

            if tracker:
                await tracker.complete_stage(
                    "embed",
                    {
                        "chunk_count": len(chunks),
                    },
                )

            logger.debug(
                "embeddings_attached",
                corpus_id=str(corpus_id),
                chunk_count=len(chunks),
            )
        elif tracker:
            await tracker.skip_stage("embed", reason="no_embedding_fn")

        # 阶段 3: Persist（按 effective_mode 选择 replace/append）
        if tracker:
            await tracker.start_stage("persist")

        deleted_count = 0
        if effective_mode == "replace" and source_uri:
            # 原子 DELETE→INSERT；任一步失败 → 整事务回滚，旧数据保留原状
            deleted_count, records = await self._repository.replace_knowledge_by_source(
                corpus_id=corpus_id,
                app_name=app_name,
                source_uri=source_uri,
                chunks=chunks,
            )
        else:
            records = await self._repository.add_knowledge(
                corpus_id=corpus_id,
                app_name=app_name,
                chunks=chunks,
            )

        if tracker:
            persist_output: dict[str, Any] = {"record_count": len(records)}
            if effective_mode == "replace":
                persist_output["replaced_count"] = deleted_count
                persist_output["mode"] = "replace"
            else:
                persist_output["mode"] = "append"
            await tracker.complete_stage("persist", persist_output)

            # 合成 delete stage：前端 STAGE_ORDER 仍按"delete → chunk → embed → persist"展示，
            # 但底层删除已与 INSERT 原子化。仅在 replace 模式下发出。
            # 单次 _persist() 写入 completed 终态，避免 start/complete 之间 crash 遗留 running 态。
            if effective_mode == "replace" and source_uri:
                now = datetime.now(UTC).isoformat()
                tracker._stages["delete"] = {
                    "status": "completed",
                    "started_at": now,
                    "completed_at": now,
                    "duration_ms": 0,
                    "output": {
                        "deleted_count": deleted_count,
                        "atomic_with_persist": True,
                    },
                }
                await tracker._persist()

        logger.info(
            "ingestion_completed",
            corpus_id=str(corpus_id),
            record_count=len(records),
            replaced_count=deleted_count if effective_mode == "replace" else None,
            persist_mode=effective_mode,
            run_id=tracker.run_id if tracker else None,
        )

        await self._sync_document_chunk_stats(
            corpus_id=corpus_id,
            app_name=app_name,
            source_uri=source_uri,
            records=records,
            chunking_config=config,
        )

        return records

    async def replace_source(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        text: str,
        source_uri: str,
        metadata: dict[str, Any] | None = None,
        chunking_config: ChunkingConfig | None = None,
    ) -> list[KnowledgeRecord]:
        """替换源文本（删除旧记录 + 索引新记录）"""
        tracker = None
        config = chunking_config or self._chunking_config

        # 初始化 Pipeline 追踪器
        if self._pipeline_dao:
            tracker = PipelineTracker(
                dao=self._pipeline_dao,
                app_name=app_name,
                operation="replace_source",
            )
            await tracker.start(
                {
                    "corpus_id": str(corpus_id),
                    "source_uri": source_uri,
                    "text_length": len(text),
                    "chunking_config": chunking_config_summary(config),
                }
            )

        logger.info(
            "replace_source_started",
            corpus_id=str(corpus_id),
            app_name=app_name,
            source_uri=source_uri,
            run_id=tracker.run_id if tracker else None,
        )

        try:
            # 原子 DELETE+INSERT：由 _ingest_text_with_tracker(persist_mode="replace") 内部完成
            records = await self._ingest_text_with_tracker(
                corpus_id=corpus_id,
                app_name=app_name,
                text=text,
                source_uri=source_uri,
                metadata=metadata,
                chunking_config=config,
                tracker=tracker,
                persist_mode="replace",
            )
            deleted_count = int(tracker.get_stage_output("persist").get("replaced_count") or 0) if tracker else 0

            # 完成 Pipeline
            if tracker:
                await tracker.complete(
                    {
                        "deleted_count": deleted_count,
                        "chunk_count": len(records),
                    }
                )

            return records

        except Exception as exc:
            await self._fail_pipeline_execution(tracker, exc)
            raise

    async def delete_source(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        source_uri: str,
    ) -> dict[str, Any]:
        """删除指定 source_uri 的所有知识块及其关联资产

        Args:
            corpus_id: 知识库 ID
            app_name: 应用名称
            source_uri: 来源 URI

        Returns:
            删除结果摘要
        """
        logger.info(
            "delete_source_started",
            corpus_id=str(corpus_id),
            app_name=app_name,
            source_uri=source_uri,
        )

        warnings: list[str] = []
        deleted_documents = 0
        deleted_gcs_objects = 0

        if source_uri.startswith("gs://"):
            from negentropy.storage.gcs_client import StorageError
            from negentropy.storage.service import DocumentStorageService

            storage_service = DocumentStorageService()
            doc = await storage_service.get_document_by_gcs_uri(
                gcs_uri=source_uri,
                corpus_id=corpus_id,
                app_name=app_name,
            )
            if doc:
                try:
                    deleted = await storage_service.delete_document(
                        document_id=doc.id,
                        corpus_id=corpus_id,
                        app_name=app_name,
                        soft_delete=False,
                    )
                    if deleted:
                        deleted_documents = 1
                        deleted_gcs_objects = 1 + (1 if doc.markdown_gcs_uri else 0)
                except StorageError as exc:
                    warnings.append(f"GCS_DELETE_FAILED: {exc}")

        deleted_count = await self._repository.delete_knowledge_by_source(
            corpus_id=corpus_id,
            app_name=app_name,
            source_uri=source_uri,
        )

        logger.info(
            "delete_source_completed",
            corpus_id=str(corpus_id),
            app_name=app_name,
            source_uri=source_uri,
            deleted_count=deleted_count,
            deleted_documents=deleted_documents,
            deleted_gcs_objects=deleted_gcs_objects,
            warning_count=len(warnings),
        )

        return {
            "deleted_count": deleted_count,
            "deleted_documents": deleted_documents,
            "deleted_gcs_objects": deleted_gcs_objects,
            "warnings": warnings,
        }

    async def archive_source(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        source_uri: str,
        archived: bool = True,
    ) -> int:
        """归档或解档指定 source_uri

        通过更新 Knowledge 记录的 metadata 中的 archived 字段实现。
        归档后的 Source 在默认查询中会被排除。

        Args:
            corpus_id: 知识库 ID
            app_name: 应用名称
            source_uri: 来源 URI
            archived: True 表示归档，False 表示解档

        Returns:
            更新的记录数量
        """
        logger.info(
            "archive_source_started",
            corpus_id=str(corpus_id),
            app_name=app_name,
            source_uri=source_uri,
            archived=archived,
        )

        updated_count = await self._repository.archive_knowledge_by_source(
            corpus_id=corpus_id,
            app_name=app_name,
            source_uri=source_uri,
            archived=archived,
        )

        logger.info(
            "archive_source_completed",
            corpus_id=str(corpus_id),
            app_name=app_name,
            source_uri=source_uri,
            archived=archived,
            updated_count=updated_count,
        )

        return updated_count

    async def get_archived_source_uris(
        self,
        *,
        pairs: list[tuple[UUID, str]],
        app_name: str,
    ) -> set[tuple[UUID, str]]:
        """批量返回所有 chunk 均已归档的 ``(corpus_id, source_uri)`` 组合。

        语义与 ``SourceSummary.archived`` 完全一致——仅当某 ``source_uri``
        对应的全部 chunk 的 ``metadata.archived`` 均为 ``true`` 时视为归档。
        服务层薄包装，主要供 ``DocumentResponse.archived`` 字段填充使用。
        """
        return await self._repository.get_archived_source_uris(
            pairs=pairs,
            app_name=app_name,
        )

    async def ingest_url(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        url: str,
        metadata: dict[str, Any] | None = None,
        chunking_config: ChunkingConfig | None = None,
    ) -> list[KnowledgeRecord]:
        """Fetch content from URL and ingest into knowledge base."""
        tracker = None
        config = chunking_config or self._chunking_config

        # 初始化 Pipeline 追踪器
        if self._pipeline_dao:
            tracker = PipelineTracker(
                dao=self._pipeline_dao,
                app_name=app_name,
                operation="ingest_url",
            )
            await tracker.start(
                {
                    "corpus_id": str(corpus_id),
                    "url": url,
                    "chunking_config": chunking_config_summary(config),
                }
            )

        logger.info(
            "ingest_url_started",
            corpus_id=str(corpus_id),
            url=url,
            run_id=tracker.run_id if tracker else None,
        )

        try:
            try:
                text, extract_result = await self._extract_url_content(
                    corpus_id=corpus_id,
                    app_name=app_name,
                    url=url,
                    tracker=tracker,
                )
            except ValueError as exc:
                from .exceptions import KnowledgeError

                raise KnowledgeError(
                    code="CONTENT_FETCH_FAILED", message=f"Failed to fetch content from URL: {exc}"
                ) from exc

            if not text:
                raise ValueError("No content extracted from URL")

            # Merge metadata
            meta = normalize_source_metadata(source_uri=url, metadata=metadata)
            meta["source_url"] = url

            # Phase 2: 来源追踪（在 chunking 之前执行，不阻塞主流程）
            if tracker:
                await tracker.start_stage("source_tracking")
            try:
                # 从 records 中获取 document_id（在 _ingest_text_with_tracker 中创建）
                async with self._repository.session() as db:
                    # 查找刚创建的文档（通过 URL 在 metadata 中匹配）
                    from sqlalchemy import select

                    from negentropy.models.perception import KnowledgeDocument

                    result = await db.execute(
                        select(KnowledgeDocument)
                        .where(KnowledgeDocument.corpus_id == corpus_id)
                        .where(
                            KnowledgeDocument.gcs_uri.like(  # noqa: S608
                                f"%{url.replace('%', '\\%').replace('_', '\\_')}%",
                                escape="\\",
                            )
                        )
                        .order_by(KnowledgeDocument.created_at.desc())
                        .limit(1)
                    )
                    doc = result.scalar_one_or_none()
                    if doc and extract_result:
                        tracking_ctx = TrackingContext(
                            tracker_run_id=tracker.run_id if tracker else None,
                            corpus_id=corpus_id,
                            app_name=app_name,
                        )
                        await self.source_tracker.track(
                            db,
                            document_id=doc.id,
                            result=extract_result,
                            source_kind="url",
                            context=tracking_ctx,
                        )
            except Exception as track_exc:
                logger.warning("source_tracking_failed", error=str(track_exc), exc_info=True)
            if tracker:
                await tracker.complete_stage("source_tracking")

            # 后续阶段复用 _ingest_text_with_tracker
            records = await self._ingest_text_with_tracker(
                corpus_id=corpus_id,
                app_name=app_name,
                text=text,
                source_uri=url,
                metadata=meta,
                chunking_config=config,
                tracker=tracker,
            )

            # 完成 Pipeline
            if tracker:
                await tracker.complete(
                    {
                        "chunk_count": len(records),
                    }
                )

            return records

        except Exception as exc:
            await self._fail_pipeline_execution(tracker, exc)
            raise

    async def list_knowledge(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        source_uri: str | None = None,
        limit: int = 20,
        offset: int = 0,
        include_archived: bool = False,
    ) -> tuple[list[KnowledgeRecord], int, dict[str, int], list[SourceSummary]]:
        """List knowledge items in a corpus.

        Args:
            corpus_id: 知识库 ID
            app_name: 应用名称
            source_uri: 可选的来源 URI 过滤
            limit: 分页大小
            offset: 偏移量

        Returns:
            tuple: (items, total_count, source_stats)
        """
        return await self._repository.list_knowledge(
            corpus_id=corpus_id,
            app_name=app_name,
            source_uri=source_uri,
            limit=limit,
            offset=offset,
            include_archived=include_archived,
        )

    async def get_knowledge_chunk(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        knowledge_id: UUID,
    ) -> KnowledgeRecord | None:
        return await self._repository.get_knowledge_by_id(
            corpus_id=corpus_id,
            app_name=app_name,
            knowledge_id=knowledge_id,
        )

    async def update_knowledge_chunk(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        knowledge_id: UUID,
        content: str | None = None,
        is_enabled: bool | None = None,
    ) -> KnowledgeRecord | None:
        current = await self.get_knowledge_chunk(
            corpus_id=corpus_id,
            app_name=app_name,
            knowledge_id=knowledge_id,
        )
        if not current:
            return None

        family_id = current.metadata.get("chunk_family_id")
        if is_enabled is not None and isinstance(family_id, str) and family_id:
            await self._repository.update_family_enabled_state(
                corpus_id=corpus_id,
                app_name=app_name,
                family_id=family_id,
                source_uri=current.source_uri,
                is_enabled=is_enabled,
            )

        updated = await self._repository.update_knowledge_chunk(
            corpus_id=corpus_id,
            app_name=app_name,
            knowledge_id=knowledge_id,
            content=content,
            is_enabled=is_enabled,
        )
        return updated

    async def regenerate_knowledge_family(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        knowledge_id: UUID,
        content: str,
        is_enabled: bool | None = None,
    ) -> list[KnowledgeRecord]:
        current = await self.get_knowledge_chunk(
            corpus_id=corpus_id,
            app_name=app_name,
            knowledge_id=knowledge_id,
        )
        if not current:
            return []

        family_id = current.metadata.get("chunk_family_id")
        if not isinstance(family_id, str) or not family_id:
            updated = await self.update_knowledge_chunk(
                corpus_id=corpus_id,
                app_name=app_name,
                knowledge_id=knowledge_id,
                content=content,
                is_enabled=is_enabled,
            )
            return [updated] if updated else []

        family_records = await self._repository.list_knowledge_by_family(
            corpus_id=corpus_id,
            app_name=app_name,
            family_id=family_id,
            source_uri=current.source_uri,
        )
        family_enabled = is_enabled if is_enabled is not None else all(item.is_enabled for item in family_records)
        base_text = content

        corpus = await self._repository.get_corpus_by_id(corpus_id)
        config = default_chunking_config()
        if corpus:
            try:
                from .types import normalize_chunking_config

                config = normalize_chunking_config(corpus.config or {})
            except Exception:
                config = default_chunking_config()

        metadata = {
            **current.metadata,
            "chunk_family_id": family_id,
        }
        await self._repository.delete_knowledge_by_family(
            corpus_id=corpus_id,
            app_name=app_name,
            source_uri=current.source_uri,
            family_id=family_id,
        )
        chunks = await self._build_chunks(
            base_text,
            source_uri=current.source_uri,
            metadata=metadata,
            chunking_config=config,
        )
        chunks = [
            KnowledgeChunk(
                content=item.content,
                source_uri=item.source_uri,
                chunk_index=item.chunk_index,
                metadata={
                    **item.metadata,
                    "chunk_family_id": family_id,
                },
                embedding=item.embedding,
            )
            for item in await self._attach_embeddings(
                chunks,
                corpus_config=dict(corpus.config or {}) if corpus else None,
            )
        ]
        records = await self._repository.add_knowledge(
            corpus_id=corpus_id,
            app_name=app_name,
            chunks=chunks,
        )
        if not family_enabled:
            await self._repository.update_family_enabled_state(
                corpus_id=corpus_id,
                app_name=app_name,
                family_id=family_id,
                source_uri=current.source_uri,
                is_enabled=False,
            )
            records = await self._repository.list_knowledge_by_family(
                corpus_id=corpus_id,
                app_name=app_name,
                family_id=family_id,
                source_uri=current.source_uri,
            )
        await self._sync_document_chunk_stats(
            corpus_id=corpus_id,
            app_name=app_name,
            source_uri=current.source_uri,
            records=records,
            chunking_config=config,
        )
        return records

    async def search(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        query: str,
        config: SearchConfig | None = None,
    ) -> list[KnowledgeMatch]:
        """搜索知识库

        支持四种检索模式:
        - "semantic": 基于向量相似度的语义检索
        - "keyword": 基于 BM25 的关键词检索
        - "hybrid": 加权融合检索 (semantic_weight * semantic_score + keyword_weight * keyword_score)
        - "rrf": RRF 融合检索 (Reciprocal Rank Fusion，对分数尺度不敏感)

        RRF 模式参考文献:
        [1] Y. Wang et al., "Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods,"
            SIGIR'18, 2018.
        """
        config = config or SearchConfig()
        query_preview = query[:TEXT_PREVIEW_MAX_LENGTH] if query else ""

        if not query.strip():
            logger.debug("search_skipped_empty_query", corpus_id=str(corpus_id))
            return []

        logger.info(
            "search_started",
            corpus_id=str(corpus_id),
            app_name=app_name,
            mode=config.mode,
            limit=config.limit,
            query_preview=query_preview,
        )

        # 与 _attach_embeddings 索引侧对称：优先使用 corpus 自配的 embedding 模型，
        # 落空再退回 service 默认 fn。修复 query/index embedding 模型不一致 (ISSUE-028)。
        corpus_config = await self._get_corpus_config(corpus_id)
        embedding_fn = self._resolve_embedding_fn(corpus_config)

        # RRF 模式: 使用专门的 RRF 检索方法
        if config.mode == "rrf":
            from .exceptions import EmbeddingFailed

            query_embedding = None
            if embedding_fn:
                try:
                    query_embedding = await embedding_fn(query)
                except EmbeddingFailed as exc:
                    logger.warning(
                        "rrf_embedding_failed_falling_back_to_keyword",
                        corpus_id=str(corpus_id),
                        reason=exc.details.get("reason", str(exc)),
                    )

            if query_embedding is None:
                if not embedding_fn:
                    logger.warning(
                        "rrf_search_failed_no_embedding",
                        corpus_id=str(corpus_id),
                    )
                # 回退到关键词检索（embedding 不可用 / embedding 失败）
                keyword_matches = await self._repository.keyword_search(
                    corpus_id=corpus_id,
                    app_name=app_name,
                    query=query,
                    limit=config.limit,
                    metadata_filter=config.metadata_filter,
                )
                keyword_matches = await hydrate_match_metadata(
                    corpus_id=corpus_id,
                    app_name=app_name,
                    matches=keyword_matches,
                )
                logger.info(
                    "search_completed",
                    corpus_id=str(corpus_id),
                    mode="keyword_fallback",
                    result_count=len(keyword_matches),
                )
                keyword_matches = await lift_hierarchical_matches(
                    corpus_id=corpus_id,
                    app_name=app_name,
                    matches=keyword_matches,
                    limit=config.limit,
                )
                return await record_match_retrievals(
                    corpus_id=corpus_id,
                    app_name=app_name,
                    matches=keyword_matches,
                )

            results = await self._repository.rrf_search(
                corpus_id=corpus_id,
                app_name=app_name,
                query=query,
                query_embedding=query_embedding,
                limit=config.limit,
                k=config.rrf_k,
            )
            results = await hydrate_match_metadata(
                self._repository,
                corpus_id=corpus_id,
                app_name=app_name,
                matches=results,
            )

            # L1 精排
            results = await self._reranker.rerank(query, results)
            results = await lift_hierarchical_matches(
                self._repository,
                corpus_id=corpus_id,
                app_name=app_name,
                matches=results,
                limit=config.limit,
            )

            logger.info(
                "search_completed",
                corpus_id=str(corpus_id),
                mode="rrf",
                rrf_k=config.rrf_k,
                result_count=len(results),
            )
            return await record_match_retrievals(
                self._repository,
                corpus_id=corpus_id,
                app_name=app_name,
                matches=results,
            )

        # 其他模式: semantic, keyword, hybrid
        query_embedding = None
        if config.mode in ("semantic", "hybrid") and embedding_fn:
            from .exceptions import EmbeddingFailed

            try:
                query_embedding = await embedding_fn(query)
            except EmbeddingFailed as exc:
                # hybrid 优雅降级：失败时仅以 keyword 检索回退；
                # semantic 显式失败传播：纯语义模式无意义降级。
                if config.mode == "hybrid":
                    logger.warning(
                        "hybrid_embedding_failed_falling_back_to_keyword",
                        corpus_id=str(corpus_id),
                        reason=exc.details.get("reason", str(exc)),
                    )
                    query_embedding = None
                else:
                    raise

        semantic_matches: list[KnowledgeMatch] = []
        keyword_matches: list[KnowledgeMatch] = []

        if config.mode in ("semantic", "hybrid") and query_embedding:
            semantic_matches = await self._repository.semantic_search(
                corpus_id=corpus_id,
                app_name=app_name,
                query_embedding=query_embedding,
                limit=config.limit,
                metadata_filter=config.metadata_filter,
            )
            semantic_matches = await hydrate_match_metadata(
                self._repository,
                corpus_id=corpus_id,
                app_name=app_name,
                matches=semantic_matches,
            )
            logger.debug(
                "semantic_search_completed",
                corpus_id=str(corpus_id),
                result_count=len(semantic_matches),
            )

        if config.mode in ("keyword", "hybrid"):
            keyword_matches = await self._repository.keyword_search(
                corpus_id=corpus_id,
                app_name=app_name,
                query=query,
                limit=config.limit,
                metadata_filter=config.metadata_filter,
            )
            keyword_matches = await hydrate_match_metadata(
                self._repository,
                corpus_id=corpus_id,
                app_name=app_name,
                matches=keyword_matches,
            )
            logger.debug(
                "keyword_search_completed",
                corpus_id=str(corpus_id),
                result_count=len(keyword_matches),
            )

        if config.mode == "semantic":
            # L1 精排
            semantic_matches = await self._reranker.rerank(query, semantic_matches)
            semantic_matches = await lift_hierarchical_matches(
                self._repository,
                corpus_id=corpus_id,
                app_name=app_name,
                matches=semantic_matches,
                limit=config.limit,
            )
            logger.info(
                "search_completed",
                corpus_id=str(corpus_id),
                mode="semantic",
                result_count=len(semantic_matches),
            )
            return await record_match_retrievals(
                self._repository,
                corpus_id=corpus_id,
                app_name=app_name,
                matches=semantic_matches,
            )

        if config.mode == "keyword":
            # L1 精排
            keyword_matches = await self._reranker.rerank(query, keyword_matches)
            keyword_matches = await lift_hierarchical_matches(
                self._repository,
                corpus_id=corpus_id,
                app_name=app_name,
                matches=keyword_matches,
                limit=config.limit,
            )
            logger.info(
                "search_completed",
                corpus_id=str(corpus_id),
                mode="keyword",
                result_count=len(keyword_matches),
            )
            return await record_match_retrievals(
                self._repository,
                corpus_id=corpus_id,
                app_name=app_name,
                matches=keyword_matches,
            )

        # Hybrid 模式
        results = merge_search_results(
            semantic_matches,
            keyword_matches,
            semantic_weight=config.semantic_weight,
            keyword_weight=config.keyword_weight,
            limit=config.limit,
        )

        # L1 精排
        results = await self._reranker.rerank(query, results)
        results = await lift_hierarchical_matches(
            self._repository,
            corpus_id=corpus_id,
            app_name=app_name,
            matches=results,
            limit=config.limit,
        )

        logger.info(
            "search_completed",
            corpus_id=str(corpus_id),
            mode="hybrid",
            semantic_count=len(semantic_matches),
            keyword_count=len(keyword_matches),
            merged_count=len(results),
        )

        return await record_match_retrievals(
            self._repository,
            corpus_id=corpus_id,
            app_name=app_name,
            matches=results,
        )

    async def _build_chunks(
        self,
        text: str,
        *,
        source_uri: str | None,
        metadata: dict[str, Any] | None,
        chunking_config: ChunkingConfig,
    ) -> Iterable[KnowledgeChunk]:
        metadata = metadata or {}

        if chunking_config.strategy == ChunkingStrategy.HIERARCHICAL:
            return await self._build_hierarchical_chunks(
                text=text,
                source_uri=source_uri,
                metadata=metadata,
                chunking_config=chunking_config,
            )

        if chunking_config.strategy == ChunkingStrategy.SEMANTIC:
            if not self._embedding_fn:
                # Fallback to recursive if no embedding function
                logger.warning("semantic_chunking_no_embedding_fn_fallback")
                raw_chunks = chunk_text(text, chunking_config)
            else:
                raw_chunks = await semantic_chunk_async(text, chunking_config, self._embedding_fn)
        else:
            raw_chunks = chunk_text(text, chunking_config)

        chunks: list[KnowledgeChunk] = []
        for index, content in enumerate(raw_chunks):
            chunks.append(
                KnowledgeChunk(
                    content=content,
                    source_uri=source_uri,
                    chunk_index=index,
                    metadata=metadata,
                    embedding=None,
                )
            )
        return chunks

    async def _build_hierarchical_chunks(
        self,
        *,
        text: str,
        source_uri: str | None,
        metadata: dict[str, Any],
        chunking_config: ChunkingConfig,
    ) -> list[KnowledgeChunk]:
        if not isinstance(chunking_config, HierarchicalChunkingConfig):
            raise TypeError("hierarchical chunk builder requires HierarchicalChunkingConfig")

        parent_config = RecursiveChunkingConfig(
            chunk_size=chunking_config.hierarchical_parent_chunk_size,
            overlap=0,
            preserve_newlines=chunking_config.preserve_newlines,
            separators=chunking_config.separators,
        )
        child_config = RecursiveChunkingConfig(
            chunk_size=chunking_config.hierarchical_child_chunk_size,
            overlap=chunking_config.hierarchical_child_overlap,
            preserve_newlines=chunking_config.preserve_newlines,
            separators=chunking_config.separators,
        )

        parent_texts = chunk_text(text, parent_config)
        chunks: list[KnowledgeChunk] = []
        chunk_index = 0

        for parent_index, parent_text in enumerate(parent_texts):
            family_id = uuid.uuid4().hex
            parent_metadata = {
                **metadata,
                "chunking_strategy": ChunkingStrategy.HIERARCHICAL.value,
                "chunk_role": CHUNK_ROLE_PARENT,
                "hierarchy_level": 0,
                "chunk_family_id": family_id,
                "parent_chunk_index": parent_index,
                "searchable": False,
            }
            chunks.append(
                KnowledgeChunk(
                    content=parent_text,
                    source_uri=source_uri,
                    chunk_index=chunk_index,
                    metadata=parent_metadata,
                    embedding=None,
                )
            )
            chunk_index += 1

            child_texts = chunk_text(parent_text, child_config)
            if not child_texts:
                child_texts = [parent_text]

            for child_index, child_text in enumerate(child_texts):
                child_metadata = {
                    **metadata,
                    "chunking_strategy": ChunkingStrategy.HIERARCHICAL.value,
                    "chunk_role": CHUNK_ROLE_CHILD,
                    "hierarchy_level": 1,
                    "chunk_family_id": family_id,
                    "hierarchical_parent_id": family_id,
                    "parent_chunk_index": parent_index,
                    "child_chunk_index": child_index,
                    "searchable": True,
                }
                chunks.append(
                    KnowledgeChunk(
                        content=child_text,
                        source_uri=source_uri,
                        chunk_index=chunk_index,
                        metadata=child_metadata,
                        embedding=None,
                    )
                )
                chunk_index += 1

        return chunks

    @staticmethod
    def _extract_embedding_config_id(corpus_config: dict[str, Any] | None) -> str | None:
        """从 corpus.config['models'] 提取 embedding_config_id；无则返回 None。"""
        if not corpus_config:
            return None
        models = corpus_config.get("models") if isinstance(corpus_config, dict) else None
        if not isinstance(models, dict):
            return None
        value = models.get("embedding_config_id")
        if value is None:
            return None
        return str(value)

    def _resolve_embedding_fn(self, corpus_config: dict[str, Any] | None) -> EmbeddingFn | None:
        """根据 corpus.config['models']['embedding_config_id'] 选择 embedding fn。

        与 ``_attach_embeddings`` 索引侧路径对称：corpus 显式 pin → 一次性构建 corpus 专属
        闭包（``build_embedding_fn`` 内部走 ``model_resolver._cache`` 的 60s TTL ``embedding:<uuid>``
        键，重复 search 命中即免 DB 查询）；未 pin → 退回 ``self._embedding_fn``（service 启动时
        锁定的全局默认 fn），保留既有"未配置 corpus 走默认"语义。
        """
        embedding_config_id = self._extract_embedding_config_id(corpus_config)
        if embedding_config_id is not None:
            from .ingestion.embedding import build_embedding_fn

            return build_embedding_fn(embedding_config_id)
        return self._embedding_fn

    async def _attach_embeddings(
        self,
        chunks: Iterable[KnowledgeChunk],
        *,
        corpus_config: dict[str, Any] | None = None,
    ) -> list[KnowledgeChunk]:
        chunk_list = list(chunks)

        if not chunk_list:
            return []

        embedding_config_id = self._extract_embedding_config_id(corpus_config)

        # Corpus 指定了 embedding 模型 → 按需构建一次性 fn；否则使用 service 级默认 fn。
        if embedding_config_id is not None:
            from .ingestion.embedding import build_batch_embedding_fn, build_embedding_fn

            batch_fn = build_batch_embedding_fn(embedding_config_id)
            single_fn = build_embedding_fn(embedding_config_id)
        else:
            batch_fn = self._batch_embedding_fn
            single_fn = self._embedding_fn

        # 优先使用批量向量化（一次 API 调用完成所有 chunk）
        if batch_fn:
            searchable_chunks = [c for c in chunk_list if self._is_searchable_chunk(c)]
            if not searchable_chunks:
                return chunk_list
            embeddings = await batch_fn([c.content for c in searchable_chunks])
            embedding_by_key = {
                (chunk.source_uri, chunk.chunk_index): emb
                for chunk, emb in zip(searchable_chunks, embeddings, strict=True)
            }
            return [
                KnowledgeChunk(
                    content=c.content,
                    source_uri=c.source_uri,
                    chunk_index=c.chunk_index,
                    metadata=c.metadata,
                    embedding=embedding_by_key.get((c.source_uri, c.chunk_index)),
                )
                for c in chunk_list
            ]

        # 回退到逐条向量化
        if not single_fn:
            return chunk_list

        enriched: list[KnowledgeChunk] = []
        for chunk in chunk_list:
            embedding = None
            if self._is_searchable_chunk(chunk):
                embedding = await single_fn(chunk.content)
            enriched.append(
                KnowledgeChunk(
                    content=chunk.content,
                    source_uri=chunk.source_uri,
                    chunk_index=chunk.chunk_index,
                    metadata=chunk.metadata,
                    embedding=embedding,
                )
            )
        return enriched

    @staticmethod
    def _is_searchable_chunk(chunk: KnowledgeChunk) -> bool:
        return chunk.metadata.get("searchable") is not False

    async def _sync_document_chunk_stats(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        source_uri: str | None,
        records: Iterable[KnowledgeRecord],
        chunking_config: ChunkingConfig,
    ) -> None:
        if not source_uri:
            return

        from negentropy.storage.service import DocumentStorageService

        record_list = list(records)
        if not record_list:
            return

        storage_service = DocumentStorageService()
        document = await storage_service.get_document_by_source_uri(
            source_uri=source_uri,
            corpus_id=corpus_id,
            app_name=app_name,
        )
        if not document:
            return

        total_characters = sum(item.character_count for item in record_list)
        avg_length = int(total_characters / len(record_list)) if record_list else 0
        metadata_patch = {
            "chunk_stats": {
                "chunk_specification": getattr(chunking_config.strategy, "value", str(chunking_config.strategy)),
                "chunk_length": avg_length,
                "avg_paragraph_length": avg_length,
                "paragraph_count": len(record_list),
                "embedding_time_ms": None,
                "embedded_tokens": int(total_characters / 4),
                "last_chunked_at": datetime.now(UTC).isoformat(),
            }
        }
        await storage_service.update_document_metadata(
            document_id=document.id,
            metadata_patch=metadata_patch,
        )


def _guess_content_type(filename: str) -> str | None:
    """根据文件扩展名猜测内容类型

    Args:
        filename: 文件名

    Returns:
        MIME 类型字符串，如果无法猜测则返回 None
    """
    ext = filename.lower().split(".")[-1] if "." in filename else ""
    content_types = {
        "pdf": "application/pdf",
        "txt": "text/plain",
        "md": "text/markdown",
        "markdown": "text/markdown",
    }
    return content_types.get(ext)
