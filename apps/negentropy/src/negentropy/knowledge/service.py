from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Awaitable, Callable, Dict, Iterable, List, Optional
from uuid import UUID

from negentropy.logging import get_logger

from .chunking import chunk_text, semantic_chunk_async

if TYPE_CHECKING:
    from .dao import KnowledgeRunDao
from .constants import DEFAULT_KEYWORD_WEIGHT, DEFAULT_SEMANTIC_WEIGHT, TEXT_PREVIEW_MAX_LENGTH
from .exceptions import SearchError
from .extraction import ExtractedDocumentResult, ROUTE_URL, extract_source, resolve_source_kind
from .source_tracking import SourceTrackingService, TrackingContext
from .reranking import NoopReranker, Reranker
from .repository import KnowledgeRepository
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
    chunking_config_summary,
    default_chunking_config,
    infer_source_type,
    normalize_source_metadata,
    SourceSummary,
    merge_search_results,
)

logger = get_logger("negentropy.knowledge.service")

CHUNK_ROLE_PARENT = "parent"
CHUNK_ROLE_CHILD = "child"
CHUNK_ROLE_LEAF = "leaf"

EmbeddingFn = Callable[[str], Awaitable[list[float]]]
BatchEmbeddingFn = Callable[[list[str]], Awaitable[list[list[float]]]]

# Pipeline 操作类型
PipelineOperation = str  # "ingest_text" | "ingest_url" | "replace_source" | "sync_source" | "rebuild_source"

# Pipeline 阶段状态
PipelineStageStatus = str  # "pending" | "running" | "completed" | "failed" | "skipped"


class PipelineTracker:
    """Pipeline 执行追踪器

    参考 Airflow TaskInstance 和 Prefect TaskRun 的设计模式，
    用于追踪 Ingest/Replace 操作的各个阶段执行状态。
    """

    def __init__(
        self,
        dao: "KnowledgeRunDao",
        app_name: str,
        operation: PipelineOperation,
        run_id: Optional[str] = None,
    ) -> None:
        self._dao = dao
        self._app_name = app_name
        self._operation = operation
        self._run_id = run_id or f"{operation}-{uuid.uuid4().hex[:8]}"
        self._started_at: Optional[str] = None
        self._completed_at: Optional[str] = None
        self._duration_ms: Optional[int] = None
        self._stages: Dict[str, Dict[str, Any]] = {}
        self._input: Dict[str, Any] = {}
        self._output: Optional[Dict[str, Any]] = None
        self._error: Optional[Dict[str, Any]] = None
        self._status = "pending"
        self._current_stage: Optional[str] = None

    def _log_context(self) -> Dict[str, Any]:
        return {
            "run_id": self._run_id,
            "operation": self._operation,
            "app_name": self._app_name,
            "corpus_id": self._input.get("corpus_id"),
        }

    def _log_stage_event(
        self,
        event: str,
        *,
        level: str = "info",
        stage: Optional[str] = None,
        status: Optional[str] = None,
        payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        log_payload: Dict[str, Any] = {
            **self._log_context(),
            "stage": stage,
            "status": status,
        }
        if payload:
            log_payload.update(payload)
        getattr(logger, level)(event, **log_payload)

    @staticmethod
    def _normalize_dict_payload(payload: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        return dict(payload or {})

    @classmethod
    def _normalize_stages_payload(cls, stages: Dict[str, Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        normalized: Dict[str, Dict[str, Any]] = {}
        for stage_name, stage_payload in stages.items():
            stage_data = dict(stage_payload or {})
            if "output" in stage_data:
                stage_data["output"] = cls._normalize_dict_payload(stage_data.get("output"))
            normalized[stage_name] = stage_data
        return normalized

    @property
    def run_id(self) -> str:
        return self._run_id

    @property
    def current_stage(self) -> Optional[str]:
        return self._current_stage

    @staticmethod
    def _calculate_duration_ms(started_at: Optional[str], completed_at: str) -> Optional[int]:
        if not started_at:
            return None
        try:
            start_dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
            end_dt = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
            return int((end_dt - start_dt).total_seconds() * 1000)
        except (ValueError, TypeError):
            return None

    async def resume(self) -> None:
        """从已有持久化记录恢复上下文，避免后台执行覆盖 create_pipeline 初始载荷。"""
        record = await self._dao.get_pipeline_run(self._app_name, self._run_id)
        if not record:
            return

        payload = record.payload or {}
        self._started_at = payload.get("started_at")
        self._completed_at = payload.get("completed_at")
        self._duration_ms = payload.get("duration_ms")
        self._stages = self._normalize_stages_payload(dict(payload.get("stages") or {}))
        self._input = self._normalize_dict_payload(payload.get("input"))
        self._output = self._normalize_dict_payload(payload.get("output"))
        self._error = payload.get("error")
        self._status = record.status

    async def start(self, input_data: Dict[str, Any]) -> None:
        """开始 Pipeline 执行"""
        self._started_at = datetime.now(timezone.utc).isoformat()
        self._input = input_data
        self._status = "running"
        await self._persist()
        self._log_stage_event(
            "pipeline_run_started",
            status=self._status,
            payload={"input": self._normalize_dict_payload(input_data)},
        )

    async def start_stage(self, stage: str) -> None:
        """开始阶段执行"""
        self._current_stage = stage
        self._stages[stage] = {
            "status": "running",
            "started_at": datetime.now(timezone.utc).isoformat(),
        }
        await self._persist()
        self._log_stage_event("pipeline_stage_started", stage=stage, status="running")

    async def complete_stage(
        self,
        stage: str,
        output: Optional[Dict[str, Any]] = None,
    ) -> None:
        """完成阶段执行"""
        now = datetime.now(timezone.utc).isoformat()
        stage_data = self._stages.get(stage, {})
        started_at = stage_data.get("started_at")
        existing_mcp_events = stage_data.get("mcp_events")

        self._stages[stage] = {
            "status": "completed",
            "started_at": started_at,
            "completed_at": now,
            "duration_ms": self._calculate_duration_ms(started_at, now),
            "output": self._normalize_dict_payload(output),
        }
        if existing_mcp_events:
            self._stages[stage]["mcp_events"] = existing_mcp_events
        self._current_stage = None
        await self._persist()
        self._log_stage_event(
            "pipeline_stage_completed",
            stage=stage,
            status="completed",
            payload={
                "duration_ms": self._stages[stage].get("duration_ms"),
                "output": self._stages[stage].get("output"),
            },
        )

    async def fail_stage(
        self,
        stage: str,
        error: Dict[str, Any],
    ) -> None:
        """阶段执行失败"""
        await self.fail(error, stage=stage)

    async def fail(
        self,
        error: Dict[str, Any],
        *,
        stage: Optional[str] = None,
    ) -> None:
        """统一写入失败终态，确保 run 与 stage 的结束信息同时落盘。"""
        now = datetime.now(timezone.utc).isoformat()
        target_stage = stage or self._current_stage

        if target_stage:
            stage_data = self._stages.get(target_stage, {})
            stage_started_at = stage_data.get("started_at")
            existing_mcp_events = stage_data.get("mcp_events")
            self._stages[target_stage] = {
                "status": "failed",
                "started_at": stage_started_at,
                "completed_at": now,
                "duration_ms": self._calculate_duration_ms(stage_started_at, now),
                "error": error,
            }
            if existing_mcp_events:
                self._stages[target_stage]["mcp_events"] = existing_mcp_events

        self._status = "failed"
        self._error = error
        self._completed_at = now
        self._duration_ms = self._calculate_duration_ms(self._started_at, now)
        self._current_stage = None
        await self._persist()
        self._log_stage_event(
            "pipeline_stage_failed",
            level="warning",
            stage=target_stage,
            status="failed",
            payload={
                "duration_ms": self._stages.get(target_stage, {}).get("duration_ms") if target_stage else None,
                "error": error,
            },
        )
        self._log_stage_event(
            "pipeline_run_failed",
            level="warning",
            status=self._status,
            payload={
                "duration_ms": self._duration_ms,
                "error": error,
            },
        )

    _MAX_STDERR_EVENTS = 5
    _PERSIST_WORTHY_STAGES = frozenset({"transport_connect", "session_initialized"})

    def buffer_stage_event(self, stage: str, event: Dict[str, Any]) -> None:
        """同步地将 MCP 子事件缓存到当前 stage 的内存数据中（不触发 DB 写入）。"""
        stage_data = self._stages.get(stage)
        if not stage_data:
            return
        if "mcp_events" not in stage_data:
            stage_data["mcp_events"] = []

        mcp_events = stage_data["mcp_events"]

        if event.get("stage") == "stderr":
            stderr_count = sum(1 for e in mcp_events if e.get("stage") == "stderr")
            if stderr_count >= self._MAX_STDERR_EVENTS:
                for i, e in enumerate(mcp_events):
                    if e.get("stage") == "stderr":
                        mcp_events.pop(i)
                        break

        mcp_events.append(
            {
                **event,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )

    def create_stage_event_sink(self, stage: str) -> Callable[[Dict[str, Any]], None]:
        """工厂方法：创建同步事件回调，对关键事件触发非阻塞 persist。"""
        import asyncio

        def sink(event: Dict[str, Any]) -> None:
            self.buffer_stage_event(stage, event)
            if event.get("stage") in self._PERSIST_WORTHY_STAGES:
                try:
                    loop = asyncio.get_running_loop()
                    loop.create_task(self._persist())
                except RuntimeError:
                    pass

        return sink

    async def skip_stage(self, stage: str, reason: Optional[str] = None) -> None:
        """跳过阶段执行"""
        self._stages[stage] = {
            "status": "skipped",
            "reason": reason,
        }
        await self._persist()
        self._log_stage_event(
            "pipeline_stage_skipped",
            stage=stage,
            status="skipped",
            payload={"reason": reason},
        )

    async def complete(self, output: Optional[Dict[str, Any]] = None) -> None:
        """完成 Pipeline 执行"""
        now = datetime.now(timezone.utc).isoformat()
        self._status = "completed"
        self._output = self._normalize_dict_payload(output)
        self._duration_ms = self._calculate_duration_ms(self._started_at, now)
        self._completed_at = now
        await self._persist()
        self._log_stage_event(
            "pipeline_run_completed",
            status=self._status,
            payload={
                "duration_ms": self._duration_ms,
                "output": self._output,
            },
        )

    async def _persist(self) -> None:
        """持久化 Pipeline 状态"""
        payload = {
            "operation": self._operation,
            "trigger": "api",
            "input": self._normalize_dict_payload(self._input),
            "started_at": self._started_at,
            "completed_at": self._completed_at,
            "duration_ms": self._duration_ms,
            "stages": self._normalize_stages_payload(self._stages),
            "output": self._normalize_dict_payload(self._output),
            "error": self._error,
        }

        await self._dao.upsert_pipeline_run(
            app_name=self._app_name,
            run_id=self._run_id,
            status=self._status,
            payload=payload,
            idempotency_key=None,
            expected_version=None,
        )


class KnowledgeService:
    def __init__(
        self,
        repository: Optional[KnowledgeRepository] = None,
        embedding_fn: Optional[EmbeddingFn] = None,
        batch_embedding_fn: Optional[BatchEmbeddingFn] = None,
        chunking_config: Optional[ChunkingConfig] = None,
        reranker: Optional[Reranker] = None,
        pipeline_dao: Optional["KnowledgeRunDao"] = None,
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
    async def _fail_pipeline_execution(tracker: Optional[PipelineTracker], exc: Exception) -> None:
        if not tracker:
            return
        error_payload: Dict[str, Any] = {
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
        tracker: Optional[PipelineTracker] = None,
    ) -> tuple[str, ExtractedDocumentResult]:
        """提取 URL 内容，返回 (plain_text, 完整结果)"""
        result = await extract_source(
            app_name=app_name,
            corpus_id=corpus_id,
            corpus_config=await self._get_corpus_config(corpus_id),
            source_kind=ROUTE_URL,
            url=url,
            tracker=tracker,
        )
        return result.plain_text, result

    async def _extract_file_content(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        content: bytes,
        filename: str,
        content_type: str | None,
        tracker: Optional[PipelineTracker] = None,
    ) -> str:
        result = await self._extract_file_document(
            corpus_id=corpus_id,
            app_name=app_name,
            content=content,
            filename=filename,
            content_type=content_type,
            tracker=tracker,
        )
        return result.plain_text

    async def _extract_file_document(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        content: bytes,
        filename: str,
        content_type: str | None,
        tracker: Optional[PipelineTracker] = None,
    ) -> ExtractedDocumentResult:
        result = await extract_source(
            app_name=app_name,
            corpus_id=corpus_id,
            corpus_config=await self._get_corpus_config(corpus_id),
            source_kind=resolve_source_kind(filename=filename, content_type=content_type),
            content=content,
            filename=filename,
            content_type=content_type,
            tracker=tracker,
        )
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

    # =========================================================================
    # Pipeline 创建与执行（支持异步后台任务）
    # =========================================================================

    async def create_pipeline(
        self,
        *,
        app_name: str,
        operation: PipelineOperation,
        input_data: Dict[str, Any],
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

        tracker = PipelineTracker(
            dao=self._pipeline_dao,
            app_name=app_name,
            operation=operation,
        )
        await tracker.start(input_data)

        logger.info(
            "pipeline_created",
            app_name=app_name,
            operation=operation,
            run_id=tracker.run_id,
        )

        return tracker.run_id

    async def execute_ingest_text_pipeline(
        self,
        *,
        run_id: str,
        corpus_id: UUID,
        app_name: str,
        text: str,
        source_uri: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        chunking_config: Optional[ChunkingConfig] = None,
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

        try:
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

        except Exception as exc:
            await self._fail_pipeline_execution(tracker, exc)
            raise

    async def execute_ingest_url_pipeline(
        self,
        *,
        run_id: str,
        corpus_id: UUID,
        app_name: str,
        url: str,
        metadata: Optional[Dict[str, Any]] = None,
        chunking_config: Optional[ChunkingConfig] = None,
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

        try:
            try:
                text = await self._extract_url_content(
                    corpus_id=corpus_id,
                    app_name=app_name,
                    url=url,
                    tracker=tracker,
                )
            except ValueError as exc:
                from .exceptions import KnowledgeError
                from .extraction import ExtractorExecutionError

                url_details: Dict[str, Any] = {}
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

        except Exception as exc:
            await self._fail_pipeline_execution(tracker, exc)
            # Pipeline 失败已由 tracker 持久化，不再重新抛出。
            # 后台任务中的 re-raise 会导致 uvicorn 打印完整异常堆栈。
            return []

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
        metadata: Optional[Dict[str, Any]] = None,
        chunking_config: Optional[ChunkingConfig] = None,
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

        try:
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
                from .extraction import ExtractorExecutionError

                details: Dict[str, Any] = {}
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
                from .extraction import store_extracted_document_artifacts

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
        except Exception as exc:
            await self._fail_pipeline_execution(tracker, exc)
            # Pipeline 失败已由 tracker 持久化，不再重新抛出。
            # 后台任务中的 re-raise 会导致 uvicorn 打印完整异常堆栈。
            return []

    async def execute_replace_source_pipeline(
        self,
        *,
        run_id: str,
        corpus_id: UUID,
        app_name: str,
        text: str,
        source_uri: str,
        metadata: Optional[Dict[str, Any]] = None,
        chunking_config: Optional[ChunkingConfig] = None,
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

        try:
            # 阶段 1: Delete
            await tracker.start_stage("delete")
            deleted_count = await self._repository.delete_knowledge_by_source(
                corpus_id=corpus_id,
                app_name=app_name,
                source_uri=source_uri,
            )
            await tracker.complete_stage("delete", {"deleted_count": deleted_count})

            # 后续阶段复用 _ingest_text_with_tracker
            records = await self._ingest_text_with_tracker(
                corpus_id=corpus_id,
                app_name=app_name,
                text=text,
                source_uri=source_uri,
                metadata=normalize_source_metadata(source_uri=source_uri, metadata=metadata),
                chunking_config=config,
                tracker=tracker,
            )
            await tracker.complete({"deleted_count": deleted_count, "chunk_count": len(records)})

            logger.info(
                "pipeline_execution_completed",
                run_id=run_id,
                corpus_id=str(corpus_id),
                record_count=len(records),
            )

            return records

        except Exception as exc:
            await self._fail_pipeline_execution(tracker, exc)
            raise

    async def execute_sync_source_pipeline(
        self,
        *,
        run_id: str,
        corpus_id: UUID,
        app_name: str,
        source_uri: str,
        chunking_config: Optional[ChunkingConfig] = None,
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

        try:
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

            # 阶段 2: Delete
            await tracker.start_stage("delete")
            deleted_count = await self._repository.delete_knowledge_by_source(
                corpus_id=corpus_id,
                app_name=app_name,
                source_uri=source_uri,
            )
            await tracker.complete_stage("delete", {"deleted_count": deleted_count})

            metadata = normalize_source_metadata(
                source_uri=source_uri,
                metadata={"source_url": source_uri},
            )

            # 后续阶段复用 _ingest_text_with_tracker
            records = await self._ingest_text_with_tracker(
                corpus_id=corpus_id,
                app_name=app_name,
                text=text,
                source_uri=source_uri,
                metadata=normalize_source_metadata(source_uri=source_uri, metadata=metadata),
                chunking_config=config,
                tracker=tracker,
            )
            await tracker.complete({"deleted_count": deleted_count, "chunk_count": len(records)})

            logger.info(
                "pipeline_execution_completed",
                run_id=run_id,
                corpus_id=str(corpus_id),
                record_count=len(records),
            )

            return records

        except Exception as exc:
            await self._fail_pipeline_execution(tracker, exc)
            raise

    async def execute_rebuild_source_pipeline(
        self,
        *,
        run_id: str,
        corpus_id: UUID,
        app_name: str,
        source_uri: str,
        chunking_config: Optional[ChunkingConfig] = None,
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

        try:
            # 阶段 1: Download
            await tracker.start_stage("download")
            try:
                from negentropy.storage.service import DocumentStorageService
                from negentropy.storage.gcs_client import StorageError

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

            # 阶段 2: Delete
            await tracker.start_stage("delete")
            deleted_count = await self._repository.delete_knowledge_by_source(
                corpus_id=corpus_id,
                app_name=app_name,
                source_uri=source_uri,
            )
            await tracker.complete_stage("delete", {"deleted_count": deleted_count})

            if document_id:
                from .extraction import store_extracted_document_artifacts

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

            # 后续阶段复用 _ingest_text_with_tracker
            records = await self._ingest_text_with_tracker(
                corpus_id=corpus_id,
                app_name=app_name,
                text=text,
                source_uri=source_uri,
                metadata=metadata,
                chunking_config=config,
                tracker=tracker,
            )
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

        except Exception as exc:
            await self._fail_pipeline_execution(tracker, exc)
            raise

    async def ensure_corpus(self, spec: CorpusSpec) -> CorpusRecord:
        return await self._repository.get_or_create_corpus(spec)

    async def get_corpus_by_id(self, corpus_id: UUID) -> Optional[CorpusRecord]:
        """获取指定 ID 的 Corpus"""
        return await self._repository.get_corpus_by_id(corpus_id)

    async def update_corpus(self, corpus_id: UUID, spec: Dict[str, Any]) -> CorpusRecord:
        corpus = await self._repository.update_corpus(corpus_id, spec)
        if not corpus:
            from .exceptions import CorpusNotFound

            raise CorpusNotFound(details={"corpus_id": str(corpus_id)})
        return corpus

    async def list_corpora(self, *, app_name: str) -> list[CorpusRecord]:
        return await self._repository.list_corpora(app_name=app_name)

    async def ingest_text(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        text: str,
        source_uri: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        chunking_config: Optional[ChunkingConfig] = None,
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
        source_uri: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        chunking_config: Optional[ChunkingConfig] = None,
        tracker: Optional[PipelineTracker] = None,
    ) -> list[KnowledgeRecord]:
        """内部方法：执行文本摄入，支持可选的 Pipeline 追踪"""
        config = chunking_config or self._chunking_config

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
        if self._embedding_fn:
            if tracker:
                await tracker.start_stage("embed")

            chunks = await self._attach_embeddings(chunks)

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

        # 阶段 3: Persist
        if tracker:
            await tracker.start_stage("persist")

        records = await self._repository.add_knowledge(
            corpus_id=corpus_id,
            app_name=app_name,
            chunks=chunks,
        )

        if tracker:
            await tracker.complete_stage(
                "persist",
                {
                    "record_count": len(records),
                },
            )

        logger.info(
            "ingestion_completed",
            corpus_id=str(corpus_id),
            record_count=len(records),
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
        metadata: Optional[Dict[str, Any]] = None,
        chunking_config: Optional[ChunkingConfig] = None,
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
            # 阶段 1: Delete
            if tracker:
                await tracker.start_stage("delete")

            deleted_count = await self._repository.delete_knowledge_by_source(
                corpus_id=corpus_id,
                app_name=app_name,
                source_uri=source_uri,
            )

            if tracker:
                await tracker.complete_stage(
                    "delete",
                    {
                        "deleted_count": deleted_count,
                    },
                )

            logger.info(
                "old_records_deleted",
                corpus_id=str(corpus_id),
                source_uri=source_uri,
                deleted_count=deleted_count,
            )

            # 后续阶段复用 _ingest_text_with_tracker
            records = await self._ingest_text_with_tracker(
                corpus_id=corpus_id,
                app_name=app_name,
                text=text,
                source_uri=source_uri,
                metadata=metadata,
                chunking_config=config,
                tracker=tracker,
            )

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
    ) -> Dict[str, Any]:
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

    async def ingest_url(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        url: str,
        metadata: Optional[Dict[str, Any]] = None,
        chunking_config: Optional[ChunkingConfig] = None,
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

    async def sync_source(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        source_uri: str,
        chunking_config: Optional[ChunkingConfig] = None,
    ) -> list[KnowledgeRecord]:
        """Sync a URL source by re-fetching and re-ingesting content.

        完整流程: Fetch → Delete old chunks → Chunking → Embedding → Persist

        Args:
            corpus_id: 知识库 ID
            app_name: 应用名称
            source_uri: 原始 URL（必须是 HTTP/HTTPS URL）
            chunking_config: 可选的分块配置，未提供时使用默认配置

        Returns:
            list[KnowledgeRecord]: 新创建的知识记录列表
        """
        tracker = None
        config = chunking_config or self._chunking_config

        # 初始化 Pipeline 追踪器
        if self._pipeline_dao:
            tracker = PipelineTracker(
                dao=self._pipeline_dao,
                app_name=app_name,
                operation="sync_source",
            )
            await tracker.start(
                {
                    "corpus_id": str(corpus_id),
                    "source_uri": source_uri,
                    "chunking_config": chunking_config_summary(config),
                }
            )

        logger.info(
            "sync_source_started",
            corpus_id=str(corpus_id),
            app_name=app_name,
            source_uri=source_uri,
            run_id=tracker.run_id if tracker else None,
        )

        try:
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

            # 阶段 2: Delete - 删除该 source_uri 下的旧记录
            if tracker:
                await tracker.start_stage("delete")

            deleted_count = await self._repository.delete_knowledge_by_source(
                corpus_id=corpus_id,
                app_name=app_name,
                source_uri=source_uri,
            )

            if tracker:
                await tracker.complete_stage(
                    "delete",
                    {
                        "deleted_count": deleted_count,
                    },
                )

            logger.info(
                "sync_source_old_records_deleted",
                corpus_id=str(corpus_id),
                source_uri=source_uri,
                deleted_count=deleted_count,
            )

            # 准备 metadata（保留原始 URL 信息）
            metadata = normalize_source_metadata(
                source_uri=source_uri,
                metadata={"source_url": source_uri},
            )

            # 后续阶段复用 _ingest_text_with_tracker
            records = await self._ingest_text_with_tracker(
                corpus_id=corpus_id,
                app_name=app_name,
                text=text,
                source_uri=source_uri,
                metadata=metadata,
                chunking_config=config,
                tracker=tracker,
            )

            # 完成 Pipeline
            if tracker:
                await tracker.complete(
                    {
                        "deleted_count": deleted_count,
                        "chunk_count": len(records),
                    }
                )

            logger.info(
                "sync_source_completed",
                corpus_id=str(corpus_id),
                source_uri=source_uri,
                deleted_count=deleted_count,
                new_chunk_count=len(records),
                run_id=tracker.run_id if tracker else None,
            )

            return records

        except Exception as exc:
            await self._fail_pipeline_execution(tracker, exc)
            raise

    async def rebuild_source(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        source_uri: str,
        chunking_config: Optional[ChunkingConfig] = None,
    ) -> list[KnowledgeRecord]:
        """Rebuild a GCS source by re-downloading and re-ingesting content.

        完整流程: Download from GCS -> Extract Text -> Delete old chunks -> Chunking -> Embedding -> Persist

        Args:
            corpus_id: 知识库 ID
            app_name: 应用名称
            source_uri: GCS URI（必须是 gs://... 格式）
            chunking_config: 可选的分块配置，未提供时使用默认配置

        Returns:
            list[KnowledgeRecord]: 新创建的知识记录列表

        Raises:
            ValueError: source_uri 不是有效的 GCS URI
            KnowledgeError: 处理失败
        """
        tracker = None
        config = chunking_config or self._chunking_config

        # 验证 GCS URI
        if not source_uri.startswith("gs://"):
            raise ValueError(f"Invalid GCS URI: {source_uri}. Must start with gs://")

        # 初始化 Pipeline 追踪器
        if self._pipeline_dao:
            tracker = PipelineTracker(
                dao=self._pipeline_dao,
                app_name=app_name,
                operation="rebuild_source",
            )
            await tracker.start(
                {
                    "corpus_id": str(corpus_id),
                    "source_uri": source_uri,
                    "chunking_config": chunking_config_summary(config),
                }
            )

        logger.info(
            "rebuild_source_started",
            corpus_id=str(corpus_id),
            app_name=app_name,
            source_uri=source_uri,
            run_id=tracker.run_id if tracker else None,
        )

        try:
            # 阶段 1: Download - 从 GCS 下载文件
            if tracker:
                await tracker.start_stage("download")

            try:
                from negentropy.storage.service import DocumentStorageService
                from negentropy.storage.gcs_client import StorageError

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

            if tracker:
                await tracker.complete_stage(
                    "download",
                    {
                        "content_length": len(content) if content else 0,
                        "source_uri": source_uri,
                    },
                )

            try:
                # 从 GCS URI 提取文件名
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
                if tracker:
                    await tracker.start_stage("extract_gate")
                text = self._validate_extracted_document(extracted, source_uri=source_uri)
                if tracker:
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

            # 阶段 2: Delete - 删除该 source_uri 下的旧记录
            if tracker:
                await tracker.start_stage("delete")

            deleted_count = await self._repository.delete_knowledge_by_source(
                corpus_id=corpus_id,
                app_name=app_name,
                source_uri=source_uri,
            )

            if tracker:
                await tracker.complete_stage(
                    "delete",
                    {
                        "deleted_count": deleted_count,
                    },
                )

            logger.info(
                "rebuild_source_old_records_deleted",
                corpus_id=str(corpus_id),
                source_uri=source_uri,
                deleted_count=deleted_count,
            )

            # 准备 metadata
            metadata = normalize_source_metadata(
                source_uri=source_uri,
                metadata={"gcs_uri": source_uri, "rebuild": True},
            )

            # 后续阶段复用 _ingest_text_with_tracker
            records = await self._ingest_text_with_tracker(
                corpus_id=corpus_id,
                app_name=app_name,
                text=text,
                source_uri=source_uri,
                metadata=metadata,
                chunking_config=config,
                tracker=tracker,
            )

            # 完成 Pipeline
            if tracker:
                await tracker.complete(
                    {
                        "deleted_count": deleted_count,
                        "chunk_count": len(records),
                    }
                )

            logger.info(
                "rebuild_source_completed",
                corpus_id=str(corpus_id),
                source_uri=source_uri,
                deleted_count=deleted_count,
                new_chunk_count=len(records),
                run_id=tracker.run_id if tracker else None,
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
        source_uri: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
        include_archived: bool = False,
    ) -> tuple[list[KnowledgeRecord], int, Dict[str, int], list[SourceSummary]]:
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
    ) -> Optional[KnowledgeRecord]:
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
        content: Optional[str] = None,
        is_enabled: Optional[bool] = None,
    ) -> Optional[KnowledgeRecord]:
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
        is_enabled: Optional[bool] = None,
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
        parent_record = next(
            (item for item in family_records if item.metadata.get("chunk_role") == CHUNK_ROLE_PARENT),
            None,
        )
        base_text = content if current.metadata.get("chunk_role") == CHUNK_ROLE_CHILD else content
        if current.metadata.get("chunk_role") != CHUNK_ROLE_CHILD and parent_record is not None:
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
            for item in await self._attach_embeddings(chunks)
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
        config: Optional[SearchConfig] = None,
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

        # RRF 模式: 使用专门的 RRF 检索方法
        if config.mode == "rrf":
            if not self._embedding_fn:
                logger.warning("rrf_search_failed_no_embedding", corpus_id=str(corpus_id))
                # 回退到关键词检索
                keyword_matches = await self._repository.keyword_search(
                    corpus_id=corpus_id,
                    app_name=app_name,
                    query=query,
                    limit=config.limit,
                    metadata_filter=config.metadata_filter,
                )
                keyword_matches = await self._hydrate_match_metadata(
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
                keyword_matches = await self._lift_hierarchical_matches(
                    corpus_id=corpus_id,
                    app_name=app_name,
                    matches=keyword_matches,
                    limit=config.limit,
                )
                return await self._record_match_retrievals(
                    corpus_id=corpus_id,
                    app_name=app_name,
                    matches=keyword_matches,
                )

            query_embedding = await self._embedding_fn(query)
            results = await self._repository.rrf_search(
                corpus_id=corpus_id,
                app_name=app_name,
                query=query,
                query_embedding=query_embedding,
                limit=config.limit,
                k=config.rrf_k,
            )
            results = await self._hydrate_match_metadata(
                corpus_id=corpus_id,
                app_name=app_name,
                matches=results,
            )

            # L1 精排
            results = await self._reranker.rerank(query, results)
            results = await self._lift_hierarchical_matches(
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
            return await self._record_match_retrievals(
                corpus_id=corpus_id,
                app_name=app_name,
                matches=results,
            )

        # 其他模式: semantic, keyword, hybrid
        query_embedding = None
        if config.mode in ("semantic", "hybrid") and self._embedding_fn:
            query_embedding = await self._embedding_fn(query)

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
            semantic_matches = await self._hydrate_match_metadata(
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
            keyword_matches = await self._hydrate_match_metadata(
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
            semantic_matches = await self._lift_hierarchical_matches(
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
            return await self._record_match_retrievals(
                corpus_id=corpus_id,
                app_name=app_name,
                matches=semantic_matches,
            )

        if config.mode == "keyword":
            # L1 精排
            keyword_matches = await self._reranker.rerank(query, keyword_matches)
            keyword_matches = await self._lift_hierarchical_matches(
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
            return await self._record_match_retrievals(
                corpus_id=corpus_id,
                app_name=app_name,
                matches=keyword_matches,
            )

        # Hybrid 模式
        results = self._merge_matches(
            semantic_matches,
            keyword_matches,
            semantic_weight=config.semantic_weight,
            keyword_weight=config.keyword_weight,
            limit=config.limit,
        )

        # L1 精排
        results = await self._reranker.rerank(query, results)
        results = await self._lift_hierarchical_matches(
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

        return await self._record_match_retrievals(
            corpus_id=corpus_id,
            app_name=app_name,
            matches=results,
        )

    async def _build_chunks(
        self,
        text: str,
        *,
        source_uri: Optional[str],
        metadata: Optional[Dict[str, Any]],
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
        source_uri: Optional[str],
        metadata: Dict[str, Any],
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

    async def _attach_embeddings(self, chunks: Iterable[KnowledgeChunk]) -> list[KnowledgeChunk]:
        chunk_list = list(chunks)

        if not chunk_list:
            return []

        # 优先使用批量向量化（一次 API 调用完成所有 chunk）
        if self._batch_embedding_fn:
            searchable_chunks = [c for c in chunk_list if self._is_searchable_chunk(c)]
            if not searchable_chunks:
                return chunk_list
            embeddings = await self._batch_embedding_fn([c.content for c in searchable_chunks])
            embedding_by_key = {
                (chunk.source_uri, chunk.chunk_index): emb for chunk, emb in zip(searchable_chunks, embeddings)
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
        if not self._embedding_fn:
            return chunk_list

        enriched: list[KnowledgeChunk] = []
        for chunk in chunk_list:
            embedding = None
            if self._is_searchable_chunk(chunk):
                embedding = await self._embedding_fn(chunk.content)
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

    async def _lift_hierarchical_matches(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        matches: Iterable[KnowledgeMatch],
        limit: int,
    ) -> list[KnowledgeMatch]:
        match_list = list(matches)
        grouped: dict[tuple[Optional[str], str], list[KnowledgeMatch]] = {}
        passthrough: list[KnowledgeMatch] = []

        for match in match_list:
            family_id = match.metadata.get("chunk_family_id")
            role = match.metadata.get("chunk_role")
            if role == CHUNK_ROLE_CHILD and isinstance(family_id, str) and family_id:
                grouped.setdefault((match.source_uri, family_id), []).append(match)
            else:
                passthrough.append(match)

        if not grouped:
            return match_list[:limit]

        lifted: list[KnowledgeMatch] = []
        for (source_uri, family_id), child_matches in grouped.items():
            parent_candidates = await self._repository.get_hierarchical_parent_matches(
                corpus_id=corpus_id,
                app_name=app_name,
                source_uri=source_uri,
                family_ids=[family_id],
            )
            if not parent_candidates:
                passthrough.extend(child_matches)
                continue

            parent = parent_candidates[0]
            best_child = max(child_matches, key=lambda item: item.combined_score)
            matched_child_indices = [
                item.metadata.get("child_chunk_index")
                for item in child_matches
                if item.metadata.get("child_chunk_index") is not None
            ]
            matched_child_chunks = [
                {
                    "id": str(item.id),
                    "child_chunk_index": item.metadata.get("child_chunk_index"),
                    "content": item.content,
                    "semantic_score": item.semantic_score,
                    "keyword_score": item.keyword_score,
                    "combined_score": item.combined_score,
                }
                for item in sorted(
                    child_matches,
                    key=lambda item: item.combined_score,
                    reverse=True,
                )
            ]
            lifted.append(
                KnowledgeMatch(
                    id=parent.id,
                    content=parent.content,
                    source_uri=parent.source_uri,
                    metadata={
                        **parent.metadata,
                        "matched_child_chunk_indices": matched_child_indices,
                        "matched_child_chunks": matched_child_chunks,
                        "returned_parent_chunk": True,
                    },
                    semantic_score=best_child.semantic_score,
                    keyword_score=best_child.keyword_score,
                    combined_score=best_child.combined_score,
                )
            )

        merged = passthrough + lifted
        merged.sort(key=lambda item: item.combined_score, reverse=True)
        deduped: list[KnowledgeMatch] = []
        seen_ids = set()
        for item in merged:
            if item.id in seen_ids:
                continue
            deduped.append(item)
            seen_ids.add(item.id)
            if len(deduped) >= limit:
                break
        return deduped

    async def _hydrate_match_metadata(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        matches: Iterable[KnowledgeMatch],
    ) -> list[KnowledgeMatch]:
        match_list = list(matches)
        if not match_list:
            return []

        metadata_by_id = await self._repository.get_search_match_metadata(
            corpus_id=corpus_id,
            app_name=app_name,
            match_ids=[item.id for item in match_list],
        )
        if not metadata_by_id:
            return match_list

        hydrated: list[KnowledgeMatch] = []
        for item in match_list:
            extra_metadata = metadata_by_id.get(item.id)
            if not extra_metadata:
                hydrated.append(item)
                continue

            hydrated.append(
                KnowledgeMatch(
                    id=item.id,
                    content=item.content,
                    source_uri=item.source_uri,
                    metadata={
                        **item.metadata,
                        **extra_metadata,
                    },
                    retrieval_count=int(extra_metadata.get("retrieval_count", item.retrieval_count)),
                    is_enabled=bool(extra_metadata.get("is_enabled", item.is_enabled)),
                    semantic_score=item.semantic_score,
                    keyword_score=item.keyword_score,
                    combined_score=item.combined_score,
                )
            )

        return hydrated

    async def _record_match_retrievals(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        matches: Iterable[KnowledgeMatch],
    ) -> list[KnowledgeMatch]:
        match_list = list(matches)
        child_ids = [item.id for item in match_list if item.metadata.get("chunk_role") == CHUNK_ROLE_CHILD]
        target_ids = child_ids or [item.id for item in match_list]
        increment_retrieval_counts = getattr(self._repository, "increment_retrieval_counts", None)
        if callable(increment_retrieval_counts):
            await increment_retrieval_counts(
                corpus_id=corpus_id,
                app_name=app_name,
                knowledge_ids=target_ids,
            )
        return [
            KnowledgeMatch(
                id=item.id,
                content=item.content,
                source_uri=item.source_uri,
                metadata=item.metadata,
                retrieval_count=item.retrieval_count + (0 if child_ids and item.id not in child_ids else 1),
                is_enabled=item.is_enabled,
                semantic_score=item.semantic_score,
                keyword_score=item.keyword_score,
                combined_score=item.combined_score,
            )
            for item in match_list
        ]

    async def _sync_document_chunk_stats(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        source_uri: Optional[str],
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
                "last_chunked_at": datetime.now(timezone.utc).isoformat(),
            }
        }
        await storage_service.update_document_metadata(
            document_id=document.id,
            metadata_patch=metadata_patch,
        )

    def _merge_matches(
        self,
        semantic_matches: Iterable[KnowledgeMatch],
        keyword_matches: Iterable[KnowledgeMatch],
        *,
        semantic_weight: float,
        keyword_weight: float,
        limit: int,
    ) -> list[KnowledgeMatch]:
        """融合语义和关键词检索结果

        委托给 types.merge_search_results() 共享实现，
        消除与 KnowledgeRepository._fallback_hybrid_search() 的重复逻辑。
        """
        return merge_search_results(
            semantic_matches,
            keyword_matches,
            semantic_weight=semantic_weight,
            keyword_weight=keyword_weight,
            limit=limit,
        )


def _guess_content_type(filename: str) -> Optional[str]:
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
