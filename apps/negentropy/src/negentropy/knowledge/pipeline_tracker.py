"""Pipeline 执行追踪器——从 KnowledgeService 正交提取的独立模块。

参考 Airflow TaskInstance 和 Prefect TaskRun 的设计模式，
用于追踪 Ingest/Replace 操作的各个阶段执行状态。

本模块与 KnowledgeService 无直接依赖，可独立测试与复用。
"""

from __future__ import annotations

import re
import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any
from urllib.parse import unquote, urlparse

from negentropy.logging import get_logger

from .cancellation import (
    is_cancelled,
    register_cancellable_run,
)
from .exceptions import PipelineCancelled

if TYPE_CHECKING:
    from .dao import KnowledgeRunDao

logger = get_logger("negentropy.knowledge.pipeline_tracker")

# ---------------------------------------------------------------------------
# Chunk 角色常量（供 hierarchical chunking 与 search post-processing 共享）
# ---------------------------------------------------------------------------

CHUNK_ROLE_PARENT = "parent"
CHUNK_ROLE_CHILD = "child"

# ---------------------------------------------------------------------------
# 类型别名
# ---------------------------------------------------------------------------

EmbeddingFn = Callable[[str], Awaitable[list[float]]]
BatchEmbeddingFn = Callable[[list[str]], Awaitable[list[list[float]]]]

# Pipeline 操作类型
PipelineOperation = str  # "ingest_text" | "ingest_url" | "replace_source" | "sync_source" | "rebuild_source"

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


# ---------------------------------------------------------------------------
# PipelineTracker
# ---------------------------------------------------------------------------


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
