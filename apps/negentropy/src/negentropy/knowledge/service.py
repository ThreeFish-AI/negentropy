from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Awaitable, Callable, Dict, Iterable, List, Optional
from uuid import UUID

from negentropy.logging import get_logger

from .chunking import chunk_text, semantic_chunk_async

if TYPE_CHECKING:
    from .dao import KnowledgeRunDao
from .constants import (
    DEFAULT_CHUNK_SIZE,
    DEFAULT_KEYWORD_WEIGHT,
    DEFAULT_OVERLAP,
    DEFAULT_SEMANTIC_WEIGHT,
    TEXT_PREVIEW_MAX_LENGTH,
)
from .exceptions import SearchError
from .content import fetch_content
from .reranking import NoopReranker, Reranker
from .repository import KnowledgeRepository
from .types import (
    ChunkingConfig,
    CorpusRecord,
    CorpusSpec,
    KnowledgeChunk,
    KnowledgeMatch,
    KnowledgeRecord,
    SearchConfig,
    merge_search_results,
)

logger = get_logger("negentropy.knowledge.service")

EmbeddingFn = Callable[[str], Awaitable[list[float]]]
BatchEmbeddingFn = Callable[[list[str]], Awaitable[list[list[float]]]]

# Pipeline 操作类型
PipelineOperation = str  # "ingest_text" | "ingest_url" | "replace_source"

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

    @property
    def run_id(self) -> str:
        return self._run_id

    @property
    def current_stage(self) -> Optional[str]:
        return self._current_stage

    async def start(self, input_data: Dict[str, Any]) -> None:
        """开始 Pipeline 执行"""
        self._started_at = datetime.now(timezone.utc).isoformat()
        self._input = input_data
        self._status = "running"
        await self._persist()

    async def start_stage(self, stage: str) -> None:
        """开始阶段执行"""
        self._current_stage = stage
        self._stages[stage] = {
            "status": "running",
            "started_at": datetime.now(timezone.utc).isoformat(),
        }
        await self._persist()

    async def complete_stage(
        self,
        stage: str,
        output: Optional[Dict[str, Any]] = None,
    ) -> None:
        """完成阶段执行"""
        now = datetime.now(timezone.utc).isoformat()
        stage_data = self._stages.get(stage, {})
        started_at = stage_data.get("started_at")

        duration_ms = None
        if started_at:
            try:
                start_dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
                end_dt = datetime.fromisoformat(now.replace("Z", "+00:00"))
                duration_ms = int((end_dt - start_dt).total_seconds() * 1000)
            except (ValueError, TypeError):
                pass

        self._stages[stage] = {
            "status": "completed",
            "started_at": started_at,
            "completed_at": now,
            "duration_ms": duration_ms,
            "output": output,
        }
        self._current_stage = None
        await self._persist()

    async def fail_stage(
        self,
        stage: str,
        error: Dict[str, Any],
    ) -> None:
        """阶段执行失败"""
        now = datetime.now(timezone.utc).isoformat()
        stage_data = self._stages.get(stage, {})

        self._stages[stage] = {
            "status": "failed",
            "started_at": stage_data.get("started_at"),
            "completed_at": now,
            "error": error,
        }
        self._status = "failed"
        self._error = error
        self._current_stage = None
        await self._persist()

    async def skip_stage(self, stage: str, reason: Optional[str] = None) -> None:
        """跳过阶段执行"""
        self._stages[stage] = {
            "status": "skipped",
            "reason": reason,
        }
        await self._persist()

    async def complete(self, output: Optional[Dict[str, Any]] = None) -> None:
        """完成 Pipeline 执行"""
        now = datetime.now(timezone.utc).isoformat()
        self._status = "completed"
        self._output = output

        if self._started_at:
            try:
                start_dt = datetime.fromisoformat(self._started_at.replace("Z", "+00:00"))
                end_dt = datetime.fromisoformat(now.replace("Z", "+00:00"))
                self._duration_ms = int((end_dt - start_dt).total_seconds() * 1000)
            except (ValueError, TypeError):
                pass

        self._completed_at = now
        await self._persist()

    async def _persist(self) -> None:
        """持久化 Pipeline 状态"""
        payload = {
            "operation": self._operation,
            "trigger": "api",
            "input": self._input,
            "started_at": self._started_at,
            "completed_at": self._completed_at,
            "duration_ms": self._duration_ms,
            "stages": self._stages,
            "output": self._output,
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
        self._chunking_config = chunking_config or ChunkingConfig()
        self._reranker = reranker or NoopReranker()
        self._pipeline_dao = pipeline_dao

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
                    "chunk_size": config.chunk_size,
                    "overlap": config.overlap,
                }
            )

        logger.info(
            "ingestion_started",
            corpus_id=str(corpus_id),
            app_name=app_name,
            text_length=len(text),
            source_uri=source_uri,
            chunk_size=config.chunk_size,
            overlap=config.overlap,
            run_id=tracker.run_id if tracker else None,
        )

        try:
            return await self._ingest_text_with_tracker(
                corpus_id=corpus_id,
                app_name=app_name,
                text=text,
                source_uri=source_uri,
                metadata=metadata,
                chunking_config=config,
                tracker=tracker,
            )
        except Exception as exc:
            if tracker and tracker.current_stage:
                await tracker.fail_stage(
                    tracker.current_stage,
                    {
                        "type": type(exc).__name__,
                        "message": str(exc),
                    },
                )
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
                    "chunk_size": config.chunk_size,
                    "overlap": config.overlap,
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
            if tracker and tracker.current_stage:
                await tracker.fail_stage(
                    tracker.current_stage,
                    {
                        "type": type(exc).__name__,
                        "message": str(exc),
                    },
                )
            raise

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
                    "chunk_size": config.chunk_size,
                    "overlap": config.overlap,
                }
            )

        logger.info(
            "ingest_url_started",
            corpus_id=str(corpus_id),
            url=url,
            run_id=tracker.run_id if tracker else None,
        )

        try:
            # 阶段 1: Fetch
            if tracker:
                await tracker.start_stage("fetch")

            try:
                text = await fetch_content(url)
            except ValueError as exc:
                from .exceptions import KnowledgeError

                if tracker:
                    await tracker.fail_stage(
                        "fetch",
                        {
                            "type": "CONTENT_FETCH_FAILED",
                            "message": str(exc),
                        },
                    )
                raise KnowledgeError(
                    code="CONTENT_FETCH_FAILED", message=f"Failed to fetch content from URL: {exc}"
                ) from exc

            if tracker:
                await tracker.complete_stage(
                    "fetch",
                    {
                        "content_length": len(text) if text else 0,
                        "url": url,
                    },
                )

            if not text:
                if tracker:
                    await tracker.fail_stage(
                        "fetch",
                        {
                            "type": "NO_CONTENT",
                            "message": "No content extracted from URL",
                        },
                    )
                raise ValueError("No content extracted from URL")

            # Merge metadata
            meta = metadata or {}
            meta["source_url"] = url

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
            if tracker and tracker.current_stage:
                await tracker.fail_stage(
                    tracker.current_stage,
                    {
                        "type": type(exc).__name__,
                        "message": str(exc),
                    },
                )
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
                    "chunk_size": config.chunk_size,
                    "overlap": config.overlap,
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
            # 阶段 1: Fetch - 从原始 URL 获取最新内容
            if tracker:
                await tracker.start_stage("fetch")

            try:
                text = await fetch_content(source_uri)
            except ValueError as exc:
                from .exceptions import KnowledgeError

                if tracker:
                    await tracker.fail_stage(
                        "fetch",
                        {
                            "type": "CONTENT_FETCH_FAILED",
                            "message": str(exc),
                        },
                    )
                raise KnowledgeError(
                    code="CONTENT_FETCH_FAILED", message=f"Failed to fetch content from URL: {exc}"
                ) from exc

            if tracker:
                await tracker.complete_stage(
                    "fetch",
                    {
                        "content_length": len(text) if text else 0,
                        "source_uri": source_uri,
                    },
                )

            if not text:
                if tracker:
                    await tracker.fail_stage(
                        "fetch",
                        {
                            "type": "NO_CONTENT",
                            "message": "No content extracted from URL",
                        },
                    )
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
            metadata = {"source_url": source_uri}

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
            if tracker and tracker.current_stage:
                await tracker.fail_stage(
                    tracker.current_stage,
                    {
                        "type": type(exc).__name__,
                        "message": str(exc),
                    },
                )
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
                    "chunk_size": config.chunk_size,
                    "overlap": config.overlap,
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

                if tracker:
                    await tracker.fail_stage(
                        "download",
                        {
                            "type": "GCS_DOWNLOAD_FAILED",
                            "message": str(exc),
                        },
                    )
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

            # 阶段 1.5: Extract - 提取文本内容
            if tracker:
                await tracker.start_stage("extract")

            try:
                from .content import extract_file_content

                # 从 GCS URI 提取文件名
                filename = source_uri.split("/")[-1]
                content_type = _guess_content_type(filename)

                text = await extract_file_content(
                    content=content,
                    filename=filename,
                    content_type=content_type,
                )
            except ValueError as exc:
                from .exceptions import KnowledgeError

                if tracker:
                    await tracker.fail_stage(
                        "extract",
                        {
                            "type": "CONTENT_EXTRACTION_FAILED",
                            "message": str(exc),
                        },
                    )
                raise KnowledgeError(
                    code="CONTENT_EXTRACTION_FAILED",
                    message=f"Failed to extract content: {exc}",
                ) from exc

            if tracker:
                await tracker.complete_stage(
                    "extract",
                    {
                        "text_length": len(text) if text else 0,
                        "source_uri": source_uri,
                    },
                )

            if not text:
                if tracker:
                    await tracker.fail_stage(
                        "extract",
                        {
                            "type": "NO_CONTENT",
                            "message": "No text content extracted from file",
                        },
                    )
                raise ValueError("No text content extracted from file")

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
            metadata = {"gcs_uri": source_uri, "rebuild": True}

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
            if tracker and tracker.current_stage:
                await tracker.fail_stage(
                    tracker.current_stage,
                    {
                        "type": type(exc).__name__,
                        "message": str(exc),
                    },
                )
            raise

    async def list_knowledge(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        source_uri: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[KnowledgeRecord], int, Dict[str, int]]:
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
        )

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
                logger.info(
                    "search_completed",
                    corpus_id=str(corpus_id),
                    mode="keyword_fallback",
                    result_count=len(keyword_matches),
                )
                return keyword_matches

            query_embedding = await self._embedding_fn(query)
            results = await self._repository.rrf_search(
                corpus_id=corpus_id,
                app_name=app_name,
                query=query,
                query_embedding=query_embedding,
                limit=config.limit,
                k=config.rrf_k,
            )

            # L1 精排
            results = await self._reranker.rerank(query, results)

            logger.info(
                "search_completed",
                corpus_id=str(corpus_id),
                mode="rrf",
                rrf_k=config.rrf_k,
                result_count=len(results),
            )
            return results

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
            logger.debug(
                "keyword_search_completed",
                corpus_id=str(corpus_id),
                result_count=len(keyword_matches),
            )

        if config.mode == "semantic":
            # L1 精排
            semantic_matches = await self._reranker.rerank(query, semantic_matches)
            logger.info(
                "search_completed",
                corpus_id=str(corpus_id),
                mode="semantic",
                result_count=len(semantic_matches),
            )
            return semantic_matches

        if config.mode == "keyword":
            # L1 精排
            keyword_matches = await self._reranker.rerank(query, keyword_matches)
            logger.info(
                "search_completed",
                corpus_id=str(corpus_id),
                mode="keyword",
                result_count=len(keyword_matches),
            )
            return keyword_matches

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

        logger.info(
            "search_completed",
            corpus_id=str(corpus_id),
            mode="hybrid",
            semantic_count=len(semantic_matches),
            keyword_count=len(keyword_matches),
            merged_count=len(results),
        )

        return results

    async def _build_chunks(
        self,
        text: str,
        *,
        source_uri: Optional[str],
        metadata: Optional[Dict[str, Any]],
        chunking_config: ChunkingConfig,
    ) -> Iterable[KnowledgeChunk]:
        metadata = metadata or {}

        # Determine strategy and call appropriate chunking function
        from .types import ChunkingStrategy

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

    async def _attach_embeddings(self, chunks: Iterable[KnowledgeChunk]) -> list[KnowledgeChunk]:
        chunk_list = list(chunks)

        if not chunk_list:
            return []

        # 优先使用批量向量化（一次 API 调用完成所有 chunk）
        if self._batch_embedding_fn:
            texts = [c.content for c in chunk_list]
            embeddings = await self._batch_embedding_fn(texts)
            return [
                KnowledgeChunk(
                    content=c.content,
                    source_uri=c.source_uri,
                    chunk_index=c.chunk_index,
                    metadata=c.metadata,
                    embedding=emb,
                )
                for c, emb in zip(chunk_list, embeddings)
            ]

        # 回退到逐条向量化
        if not self._embedding_fn:
            return chunk_list

        enriched: list[KnowledgeChunk] = []
        for chunk in chunk_list:
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
