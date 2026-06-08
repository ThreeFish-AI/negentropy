from __future__ import annotations

import re
import uuid
from collections.abc import Awaitable, Callable, Iterable
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any
from urllib.parse import unquote, urlparse
from uuid import UUID

from negentropy.logging import get_logger
from negentropy.serialization import strip_nul_chars

from .cancellation import (
    get_cancel_event,
    is_cancelled,
    register_cancellable_run,
    unregister_cancellable_run,
)
from .exceptions import PipelineCancelled
from .ingestion.chunking import chunk_text, semantic_chunk_async

if TYPE_CHECKING:
    from .dao import KnowledgeRunDao
from .constants import TEXT_PREVIEW_MAX_LENGTH
from .ingestion.extraction import ROUTE_FILE_MD, ROUTE_URL, ExtractedDocumentResult, extract_source, resolve_source_kind
from .ingestion.source_tracking import SourceTrackingService, TrackingContext
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

CHUNK_ROLE_PARENT = "parent"
CHUNK_ROLE_CHILD = "child"
CHUNK_ROLE_LEAF = "leaf"

EmbeddingFn = Callable[[str], Awaitable[list[float]]]
BatchEmbeddingFn = Callable[[list[str]], Awaitable[list[list[float]]]]

# ---------------------------------------------------------------------------
# Run ID 语义化：从 input_data 提取人类可读的源标签
# ---------------------------------------------------------------------------

_LABEL_MAX_LENGTH = 50


def _sanitize_label(name: str, *, max_length: int = _LABEL_MAX_LENGTH) -> str:
    """清理标签：非字母数字替换为 `_`，合并连续下划线，截断过长名称。"""
    sanitized = re.sub(r"[^\w\-.]", "_", name)
    sanitized = re.sub(r"_+", "_", sanitized).strip("_")
    return sanitized[:max_length]


def _extract_source_label(input_data: dict[str, Any]) -> str:
    """从 input_data 中提取人类可读的源标识。

    优先级：filename > url > source_uri。
    """
    # 1. filename → 去掉扩展名
    if filename := input_data.get("filename"):
        name = Path(filename).stem
        if label := _sanitize_label(name):
            return label

    # 2. url → 取最后路径段
    if url := input_data.get("url"):
        parsed = urlparse(url)
        path = unquote(parsed.path).rstrip("/")
        if path:
            segment = path.split("/")[-1]
            if label := _sanitize_label(segment):
                return label
        # URL 无路径时使用 domain
        if label := _sanitize_label(parsed.netloc):
            return label

    # 3. source_uri → 区分 GCS / HTTP / 通用
    if source_uri := input_data.get("source_uri"):
        if source_uri.startswith("gs://"):
            name = source_uri.split("/")[-1]
            if "." in name:
                name = Path(name).stem
            if label := _sanitize_label(name):
                return label
        if source_uri.startswith(("http://", "https://")):
            parsed = urlparse(source_uri)
            path = unquote(parsed.path).rstrip("/")
            if path:
                segment = path.split("/")[-1]
                if label := _sanitize_label(segment):
                    return label
            if label := _sanitize_label(parsed.netloc):
                return label
        # 通用回退：取最后路径段
        name = source_uri.split("/")[-1]
        if label := _sanitize_label(name):
            return label

    return ""


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
        dao: KnowledgeRunDao,
        app_name: str,
        operation: PipelineOperation,
        run_id: str | None = None,
    ) -> None:
        self._dao = dao
        self._app_name = app_name
        self._operation = operation
        self._run_id = run_id or f"{operation}-{uuid.uuid4().hex[:8]}"
        self._started_at: str | None = None
        self._completed_at: str | None = None
        self._duration_ms: int | None = None
        self._stages: dict[str, dict[str, Any]] = {}
        self._input: dict[str, Any] = {}
        self._output: dict[str, Any] | None = None
        self._error: dict[str, Any] | None = None
        self._status = "pending"
        self._current_stage: str | None = None
        # 取消终态附加元数据：requested_at / requested_by / reason / chunks_persisted ...
        # 由 cancel API 在请求时写入 payload.cancellation；tracker.cancel() 时在此聚合。
        self._cancellation_summary: dict[str, Any] | None = None

    def _log_context(self) -> dict[str, Any]:
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
        stage: str | None = None,
        status: str | None = None,
        payload: dict[str, Any] | None = None,
    ) -> None:
        log_payload: dict[str, Any] = {
            **self._log_context(),
            "stage": stage,
            "status": status,
        }
        if payload:
            log_payload.update(payload)
        getattr(logger, level)(event, **log_payload)

    @staticmethod
    def _normalize_dict_payload(payload: dict[str, Any] | None) -> dict[str, Any]:
        return dict(payload or {})

    @classmethod
    def _normalize_stages_payload(cls, stages: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
        normalized: dict[str, dict[str, Any]] = {}
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
    def current_stage(self) -> str | None:
        return self._current_stage

    @staticmethod
    def _calculate_duration_ms(started_at: str | None, completed_at: str) -> int | None:
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
        # 恢复 cancellation 元数据（cancel API 已写入 payload.cancellation 时）
        self._cancellation_summary = payload.get("cancellation")
        self._status = record.status

    async def start(self, input_data: dict[str, Any]) -> None:
        """开始 Pipeline 执行。

        R-6 race A 修补：先 `resume()` 读 DB 当前状态——若 cancel API 已抢先把
        status 写为 cancelling/cancelled（在 BackgroundTasks 启动 task 之前用户
        已点取消），立即 raise PipelineCancelled，**不写 running 覆盖**取消信号。
        否则 task 启动后会盲写 running，永远跑到自然结束，cancel 信号被静默吞掉。
        """
        await self.resume()
        if self._status in ("cancelling", "cancelled"):
            raise PipelineCancelled(self._run_id, last_stage=None)

        # 注册进程内 fast-path Event；幂等，重复 start 不覆盖已 set 的 Event
        register_cancellable_run(self._run_id)

        self._started_at = datetime.now(UTC).isoformat()
        self._input = input_data
        self._status = "running"
        await self._persist()
        self._log_stage_event(
            "pipeline_run_started",
            status=self._status,
            payload={"input": self._normalize_dict_payload(input_data)},
        )

    async def _check_cancel(self) -> None:
        """协作式取消检查点：先 in-memory event（O(1)），再 DB（跨 worker 兜底）。

        DB SELECT 仅在 stage 边界触发（每个 stage <30 次/run），开销可承受。
        若发现取消信号，raise PipelineCancelled 由 execute_*_pipeline 顶层捕获。
        """
        if is_cancelled(self._run_id):
            raise PipelineCancelled(self._run_id, last_stage=self._current_stage)

        # DB-poll 兜底：cancel API 落到其他 worker 时，本 worker 通过 DB 感知
        record = await self._dao.get_pipeline_run(self._app_name, self._run_id)
        if record is not None and record.status in ("cancelling", "cancelled"):
            raise PipelineCancelled(self._run_id, last_stage=self._current_stage)

    async def start_stage(self, stage: str) -> None:
        """开始阶段执行"""
        # 取消检查点：在 stage 边界感知用户取消请求
        await self._check_cancel()

        self._current_stage = stage
        self._stages[stage] = {
            "status": "running",
            "started_at": datetime.now(UTC).isoformat(),
        }
        await self._persist()
        self._log_stage_event("pipeline_stage_started", stage=stage, status="running")

    async def complete_stage(
        self,
        stage: str,
        output: dict[str, Any] | None = None,
    ) -> None:
        """完成阶段执行"""
        now = datetime.now(UTC).isoformat()
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
        error: dict[str, Any],
    ) -> None:
        """阶段执行失败"""
        await self.fail(error, stage=stage)

    async def fail(
        self,
        error: dict[str, Any],
        *,
        stage: str | None = None,
    ) -> None:
        """统一写入失败终态，确保 run 与 stage 的结束信息同时落盘。"""
        now = datetime.now(UTC).isoformat()
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

    def buffer_stage_event(self, stage: str, event: dict[str, Any]) -> None:
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
                "timestamp": datetime.now(UTC).isoformat(),
            }
        )

    def create_stage_event_sink(self, stage: str) -> Callable[[dict[str, Any]], None]:
        """工厂方法：创建同步事件回调，对关键事件触发非阻塞 persist。"""
        import asyncio

        def sink(event: dict[str, Any]) -> None:
            self.buffer_stage_event(stage, event)
            if event.get("stage") in self._PERSIST_WORTHY_STAGES:
                try:
                    loop = asyncio.get_running_loop()
                    loop.create_task(self._persist())
                except RuntimeError:
                    pass

        return sink

    async def skip_stage(self, stage: str, reason: str | None = None) -> None:
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

    def get_stage_output(self, stage: str) -> dict[str, Any]:
        """读取已完成 stage 的 output 字段；不存在或未完成时返回空 dict。

        供上游 pipeline 在 ``complete()`` 写顶层 summary 时复用 stage 元数据，
        避免相同字段在多处重复维护（单一事实源）。
        """
        stage_data = self._stages.get(stage)
        if not stage_data:
            return {}
        output = stage_data.get("output")
        return dict(output) if isinstance(output, dict) else {}

    async def complete(self, output: dict[str, Any] | None = None) -> None:
        """完成 Pipeline 执行"""
        now = datetime.now(UTC).isoformat()
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

    async def cancel(
        self,
        *,
        last_stage: str | None = None,
        summary: dict[str, Any] | None = None,
    ) -> None:
        """协作式取消终态写入（区别于 fail 与 complete）。

        - 幂等：已是 cancelled/completed/failed 时直接 return，避免重复写入；
        - 把当前 stage（若有）标记为 cancelled，便于前端 stages bar 直观显示
          取消位置；
        - 写入 cancellation summary 到 payload 供前端展示「取消时进度」（已写入
          chunks 数、最后完成 stage 等，配合 best-effort 不回滚语义）；
        - 触发 `pipeline_run_cancelled` 审计日志事件，与既有 `pipeline_run_*`
          命名风格对齐（R-11 修补）。
        """
        if self._status in ("cancelled", "completed", "failed"):
            return
        now = datetime.now(UTC).isoformat()
        target_stage = last_stage or self._current_stage

        # 当前正在执行的 stage 标记为 cancelled（不污染 failed 计数）
        if target_stage and target_stage in self._stages:
            stage_data = self._stages[target_stage]
            stage_started_at = stage_data.get("started_at")
            existing_mcp_events = stage_data.get("mcp_events")
            self._stages[target_stage] = {
                "status": "cancelled",
                "started_at": stage_started_at,
                "completed_at": now,
                "duration_ms": self._calculate_duration_ms(stage_started_at, now),
            }
            if existing_mcp_events:
                self._stages[target_stage]["mcp_events"] = existing_mcp_events

        self._status = "cancelled"
        self._completed_at = now
        self._duration_ms = self._calculate_duration_ms(self._started_at, now)
        self._current_stage = None
        # cancellation summary 用 payload._cancellation_summary 字段，与 _persist 协作落库
        self._cancellation_summary = dict(summary or {}) | {
            "cancelled_at": now,
            "last_stage": target_stage,
        }
        await self._persist()
        self._log_stage_event(
            "pipeline_run_cancelled",
            status=self._status,
            payload={
                "duration_ms": self._duration_ms,
                "last_stage": target_stage,
                "summary": self._cancellation_summary,
            },
        )

    async def ensure_finalized(self, error: dict[str, Any] | None = None) -> None:
        """安全网：若 tracker 尚未处于终态（completed/failed/cancelled），强制写入 failed。

        在 finally 块中调用，确保无论原始异常是否被成功处理，
        tracker 状态都不会永远停留在 running 或 cancelling。

        注意：cancelling 不被视为终态——若 task 已感知 cancel 信号但因异常未完成
        `cancel()` 调用，应交由看门狗（`finalize_stale_pipeline_runs`）超时收敛。
        本方法不主动把 cancelling 转 cancelled，避免吞掉真实异常上下文。
        """
        if self._status in ("completed", "failed", "cancelled"):
            return
        try:
            error_payload = error or {
                "type": "PipelineFinalizationSafetyNet",
                "message": "Pipeline did not reach a terminal state; forcibly finalized.",
            }
            await self.fail(error_payload)
        except Exception:
            self._log_stage_event(
                "pipeline_finalization_safety_net_failed",
                level="warning",
                status=self._status,
            )

    async def _persist(self) -> None:
        """持久化 Pipeline 状态。

        R-7 race B 修补：写入前先读 DB——若 cancel API 已把 status 写为
        cancelling/cancelled，本次 running 写入会**覆盖**取消信号，导致 tracker
        在下一个检查点之前继续盲跑。修补策略：
        - 若 DB 已 cancelling/cancelled 且本次写入态非终态（running/pending），
          跳过写入并接管 status（self._status = DB.status），让最近的检查点
          立即 raise PipelineCancelled。
        - 若本次写入态是终态（cancelled/completed/failed），照常写入 — 终态
          覆盖中间态是合法的（cancel() / complete() / fail() 路径必须能落库）。

        锁策略说明：本方法不使用 ``SELECT ... FOR UPDATE``，而是采用
        "读-判-写 + 乐观并发控制" 模式。
        - 第一道防线（pre-check）：先读 DB，若已 cancelling/cancelled 且本次非终态，
          跳过写入并接管 status。
        - 第二道防线（OCC）：pre-check 到 upsert 之间 cancel API 可能提交（多 worker
          部署），upsert 携带 ``expected_version`` 做版本校验；cancel API 写入后
          version 已递增，upsert 检测到冲突后接管 DB 权威状态，不盲目覆盖取消信号。
        """
        latest = await self._dao.get_pipeline_run(self._app_name, self._run_id)
        if (
            latest is not None
            and latest.status in ("cancelling", "cancelled")
            and self._status not in ("cancelled", "completed", "failed")
        ):
            self._status = latest.status  # 接管 DB 权威状态
            return

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
        # 取消终态 payload 增加 cancellation 字段（best-effort 不回滚语义下的可观测性）
        cancellation_summary = getattr(self, "_cancellation_summary", None)
        if cancellation_summary:
            payload["cancellation"] = cancellation_summary

        result = await self._dao.upsert_pipeline_run(
            app_name=self._app_name,
            run_id=self._run_id,
            status=self._status,
            payload=payload,
            idempotency_key=None,
            expected_version=getattr(latest, "version", None) if latest is not None else None,
        )
        # 乐观并发冲突：cancel API 在 pre-check 与 upsert 之间写入了 cancelling/cancelled
        if result.status == "conflict" and self._status not in ("cancelled", "completed", "failed"):
            conflict_record = result.record
            conflict_status = conflict_record.get("status", "") if isinstance(conflict_record, dict) else ""
            if conflict_status in ("cancelling", "cancelled"):
                self._status = conflict_status


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

    async def _extract_file_content(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        content: bytes,
        filename: str,
        content_type: str | None,
        tracker: PipelineTracker | None = None,
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
        tracker: PipelineTracker | None = None,
        resume: bool | None = None,
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
                resume=resume,
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

        except PipelineCancelled as cancel_exc:
            # 协作式取消：写入 cancelled 终态，区别于 fail；幂等（cancel() 内部保护）。
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

        except PipelineCancelled as cancel_exc:
            # 协作式取消：写入 cancelled 终态，区别于 fail；幂等（cancel() 内部保护）。
            await tracker.cancel(last_stage=cancel_exc.last_stage)
            return []
        except Exception as exc:
            await self._fail_pipeline_execution(tracker, exc)
            # Pipeline 失败已由 tracker 持久化，不再重新抛出。
            # 后台任务中的 re-raise 会导致 uvicorn 打印完整异常堆栈。
            return []
        finally:
            try:
                await tracker.ensure_finalized()
            except Exception:
                pass
            unregister_cancellable_run(run_id)

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

        try:
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

        except PipelineCancelled as cancel_exc:
            # 协作式取消：写入 cancelled 终态，区别于 fail；幂等（cancel() 内部保护）。
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
        resume: bool | None = None,
    ) -> list[KnowledgeRecord]:
        """执行 ingest_file Pipeline（后台任务）

        resume: 仅重试场景透传至 perceives——True 断点续传 / False 重新开始 /
        None 普通 ingest（沿用 perceives 默认）。
        """
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
                    resume=resume,
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
        except PipelineCancelled as cancel_exc:
            # 协作式取消：写入 cancelled 终态，区别于 fail；幂等（cancel() 内部保护）。
            await tracker.cancel(last_stage=cancel_exc.last_stage)
            return []
        except Exception as exc:
            await self._fail_pipeline_execution(tracker, exc)
            # Pipeline 失败已由 tracker 持久化，不再重新抛出。
            # 后台任务中的 re-raise 会导致 uvicorn 打印完整异常堆栈。
            return []
        finally:
            try:
                await tracker.ensure_finalized()
            except Exception:
                pass
            unregister_cancellable_run(run_id)

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

        try:
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

        except PipelineCancelled as cancel_exc:
            # 协作式取消：写入 cancelled 终态，区别于 fail；幂等（cancel() 内部保护）。
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

        except PipelineCancelled as cancel_exc:
            # 协作式取消：写入 cancelled 终态，区别于 fail；幂等（cancel() 内部保护）。
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

        try:
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

        except PipelineCancelled as cancel_exc:
            # 协作式取消：写入 cancelled 终态，区别于 fail；幂等（cancel() 内部保护）。
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

        try:
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

        except PipelineCancelled as cancel_exc:
            # 协作式取消：写入 cancelled 终态，区别于 fail；幂等（cancel() 内部保护）。
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

    async def list_corpora(self, *, app_name: str) -> list[CorpusRecord]:
        return await self._repository.list_corpora(app_name=app_name)

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
        # 剥离 NUL（\x00）——chunk content 落 Knowledge.content（PostgreSQL text 列不接受 NUL，
        # asyncpg 写入会抛 UntranslatableCharacterError）；某些 PDF 解析产物会夹带 NUL 字节。
        # 此为全部摄入路径（file/url/refresh/rebuild）chunk 持久化的单一咽喉点。
        text = strip_nul_chars(text)
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

    async def sync_source(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        source_uri: str,
        chunking_config: ChunkingConfig | None = None,
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

            # 准备 metadata（保留原始 URL 信息）
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
        chunking_config: ChunkingConfig | None = None,
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

            # 原子 DELETE+INSERT：由 _ingest_text_with_tracker(persist_mode="replace") 内部完成

            # 准备 metadata
            metadata = normalize_source_metadata(
                source_uri=source_uri,
                metadata={"gcs_uri": source_uri, "rebuild": True},
            )

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

    async def _lift_hierarchical_matches(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        matches: Iterable[KnowledgeMatch],
        limit: int,
    ) -> list[KnowledgeMatch]:
        match_list = list(matches)
        grouped: dict[tuple[str | None, str], list[KnowledgeMatch]] = {}
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
