"""
Knowledge Graph Service

提供知识图谱的高层服务接口，协调实体/关系提取、图谱持久化和查询。

设计原则 (AGENTS.md):
- Service Layer Pattern: 封装业务逻辑，协调多个组件
- Single Responsibility: 只处理图谱相关的业务逻辑
- 正交分解: 与 KnowledgeService 正交，可独立使用

参考文献:
[1] M. Fowler, "Patterns of Enterprise Application Architecture," 2002.
"""

from __future__ import annotations

import asyncio
import time
import uuid
from collections import OrderedDict
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.logging import get_logger
from negentropy.model_names import canonicalize_model_name

from ..cancellation import (
    is_cancelled,
    register_cancellable_run,
    unregister_cancellable_run,
)
from ..exceptions import PipelineCancelled
from ..types import (
    GraphBuildConfig,
    GraphEdge,
    GraphNode,
    GraphQueryConfig,
    KgEntityType,
    KgRelationType,
    KnowledgeGraphPayload,
)
from .extractors import (
    CompositeEntityExtractor,
    CompositeRelationExtractor,
)
from .repository import (
    BuildRunRecord,
    GraphRepository,
    GraphSearchResult,
    get_graph_repository,
)

logger = get_logger("negentropy.knowledge.graph_service")


# ============================================================================
# Service Result Types
# ============================================================================


@dataclass
class _LLMCircuitBreaker:
    """Simplified circuit breaker (Nygard, "Release It!", 2018) for KG build LLM calls.

    Two-state model: CLOSED (normal) → OPEN (skip LLM, use fallback directly).
    No HALF-OPEN state: KG builds are finite batches; the LLM either works or it
    doesn't within the build window.

    failure_threshold: consecutive LLM failures before opening the circuit.
    Once open, all remaining chunks use fallback extractors (regex/cooccurrence)
    which complete in <1s instead of 30-90s per LLM call.
    """

    consecutive_failures: int = 0
    failure_threshold: int = 3
    is_open: bool = False

    def record_failure(self) -> bool:
        """Record a failure. Returns True on CLOSED→OPEN transition."""
        self.consecutive_failures += 1
        if self.consecutive_failures >= self.failure_threshold and not self.is_open:
            self.is_open = True
            return True
        return False

    def record_success(self) -> None:
        self.consecutive_failures = 0
        # Once open, stay open — two-state model is CLOSED→OPEN only.

    def should_skip_llm(self) -> bool:
        return self.is_open


@dataclass
class BuildRunContext:
    """_init_build_run → _execute_build 的上下文传递物"""

    run_id: str
    run_uuid: UUID
    corpus_id: UUID
    app_name: str
    chunks: list[dict[str, Any]]
    config: GraphBuildConfig
    entity_extractor: CompositeEntityExtractor
    relation_extractor: CompositeRelationExtractor
    start_time: float
    normalized_llm_model: str


@dataclass(frozen=True)
class GraphBuildResult:
    """图谱构建结果

    包含构建统计和运行信息。
    """

    run_id: str
    corpus_id: UUID
    status: str
    entity_count: int
    relation_count: int
    chunks_processed: int
    elapsed_seconds: float
    error_message: str | None = None
    warnings: list[dict[str, Any]] = field(default_factory=list)
    failed_chunk_count: int = 0


@dataclass(frozen=True)
class GraphQueryResult:
    """图谱查询结果

    包含匹配的实体和可选的邻居信息。
    """

    entities: list[GraphSearchResult]
    total_count: int
    query_time_ms: float


# ============================================================================
# Graph Query Cache (Tanenbaum & Van Steen, 2017; Kleppmann, 2017 §3)
# ============================================================================


class _TTLCache:
    """进程内 TTL + LRU 缓存，用于图谱查询结果 (Tanenbaum & Van Steen, 2017)

    场景优势：图谱数据仅在构建完成时批量变更，失效时机确定性高。
    maxsize 限制防止 as_of 时间旅行产生无界条目。
    """

    def __init__(self, ttl_seconds: int = 300, maxsize: int = 256) -> None:
        self._store: OrderedDict[str, tuple[Any, float]] = OrderedDict()
        self._ttl = ttl_seconds
        self._maxsize = maxsize

    def get(self, key: str) -> Any | None:
        if key in self._store:
            value, ts = self._store[key]
            if time.time() - ts < self._ttl:
                self._store.move_to_end(key)
                return value
            del self._store[key]
        return None

    def set(self, key: str, value: Any) -> None:
        if key in self._store:
            del self._store[key]
        self._store[key] = (value, time.time())
        while len(self._store) > self._maxsize:
            self._store.popitem(last=False)

    def invalidate(self, prefix: str) -> None:
        keys_to_delete = [k for k in self._store if k.startswith(prefix)]
        for k in keys_to_delete:
            del self._store[k]


_graph_cache = _TTLCache(ttl_seconds=300, maxsize=256)


# ============================================================================
# Build Phase Constants
# ============================================================================
#
# 单次 build 内的语义里程碑顺序：
#   extracting → resolving → syncing → pagerank → communities → summaries → completed
# 与 progress_percent 协同（前端 SSE payload 透传 phase + percent）：
# - extracting：0.00 → 0.80（chunk 循环按比例线性递增）
# - resolving / persisting：0.80 → 0.85
# - syncing：0.85 → 0.90
# - pagerank：0.90 → 0.93
# - communities：0.93 → 0.96
# - summaries：0.96 → 1.00
# 失败也会落库为 failed 终态，前端 KgBuildProgressPill 解析 phase 字段渲染中文标签。
PHASE_EXTRACTING = "extracting"
PHASE_RESOLVING = "resolving"
PHASE_SYNCING = "syncing"
PHASE_PAGERANK = "pagerank"
PHASE_COMMUNITIES = "communities"
PHASE_SUMMARIES = "summaries"
PHASE_COMPLETED = "completed"


def _strip_phase_entries(warnings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """移除 warnings 列表中既有的 _phase 条目（保持单条最新阶段元数据）。

    SSE 端点 / 前端 ``KgBuildProgressPill`` 都会取最后一条 _phase；保留多条历史
    会污染前端渲染。``_metrics`` / 算法 warning 等其他条目原样保留。
    """
    return [w for w in warnings if "_phase" not in w]


# ============================================================================
# Graph Service
# ============================================================================


class GraphService:
    """知识图谱服务

    提供图谱的构建、查询和管理功能。

    核心职责:
    1. 协调实体/关系提取器
    2. 管理图谱持久化
    3. 提供混合检索能力
    4. 追踪构建历史

    使用示例:
    ```python
    service = GraphService()

    # 构建图谱
    result = await service.build_graph(
        corpus_id=corpus_id,
        app_name="my_app",
        chunks=knowledge_chunks,
    )

    # 查询图谱
    results = await service.search(
        corpus_id=corpus_id,
        app_name="my_app",
        query="机器学习",
        query_embedding=embedding,
    )
    ```
    """

    def __init__(
        self,
        repository: GraphRepository | None = None,
        session: AsyncSession | None = None,
        config: GraphBuildConfig | None = None,
    ) -> None:
        """初始化图谱服务

        Args:
            repository: 图谱存储实例（可选，用于依赖注入）
            session: 数据库会话（可选）
            config: 构建配置（可选）
        """
        self._repository = repository or get_graph_repository(session)
        self._config = config or GraphBuildConfig(
            entity_types=tuple(KgEntityType.all_values()),
            relation_types=tuple(KgRelationType.all_values()),
        )

        # 提取器按请求级 config 动态创建（见 build_graph），不在实例级持有

    @staticmethod
    def _resolve_schema(name: str | None) -> Any | None:
        """解析 extraction_schema_name 到 ExtractionSchema 实例"""
        if not name:
            return None
        from .extraction_schema import get_schema

        schema = get_schema(name)
        if schema is None:
            logger.warning("unknown_extraction_schema", schema_name=name)
        return schema

    async def _init_build_run(
        self,
        corpus_id: UUID,
        app_name: str,
        chunks: list[dict[str, Any]],
        config: GraphBuildConfig | None = None,
    ) -> BuildRunContext:
        """快速创建构建运行记录（<1s），返回上下文供 _execute_build 或 build_graph 使用。

        调用方可在 API 层同步 await 本方法获取 run_id 并立即返回给客户端，
        再通过 asyncio.create_task 将实际构建推迟到后台执行。
        """
        build_config = config or self._config
        normalized_llm_model = canonicalize_model_name(build_config.llm_model)

        request_schema = self._resolve_schema(build_config.extraction_schema_name)
        entity_extractor = CompositeEntityExtractor(
            llm_model=build_config.llm_model,
            enable_llm=build_config.enable_llm_extraction,
            schema=request_schema,
        )
        relation_extractor = CompositeRelationExtractor(
            llm_model=build_config.llm_model,
            enable_llm=build_config.enable_llm_extraction,
            schema=request_schema,
        )
        run_id = f"build-{uuid.uuid4().hex[:8]}-{int(time.time())}"
        start_time = time.time()

        logger.info(
            "graph_build_started",
            corpus_id=str(corpus_id),
            app_name=app_name,
            run_id=run_id,
            chunk_count=len(chunks),
        )

        run_uuid = await self._repository.create_build_run(
            app_name=app_name,
            corpus_id=corpus_id,
            run_id=run_id,
            extractor_config={
                "enable_llm": build_config.enable_llm_extraction,
                "llm_model": normalized_llm_model,
                "entity_types": build_config.entity_types,
                "relation_types": build_config.relation_types,
            },
            model_name=normalized_llm_model,
        )

        register_cancellable_run(run_id)

        return BuildRunContext(
            run_id=run_id,
            run_uuid=run_uuid,
            corpus_id=corpus_id,
            app_name=app_name,
            chunks=chunks,
            config=build_config,
            entity_extractor=entity_extractor,
            relation_extractor=relation_extractor,
            start_time=start_time,
            normalized_llm_model=normalized_llm_model,
        )

    async def build_graph(
        self,
        corpus_id: UUID,
        app_name: str,
        chunks: list[dict[str, Any]],
        config: GraphBuildConfig | None = None,
    ) -> GraphBuildResult:
        """构建知识图谱（向后兼容 wrapper：init + execute 顺序调用）。"""
        ctx = await self._init_build_run(corpus_id, app_name, chunks, config)
        return await self._execute_build(ctx)

    async def _execute_build(
        self,
        ctx: BuildRunContext,
    ) -> GraphBuildResult:
        """执行完整 KG 构建管线。

        接受 _init_build_run 创建的上下文，运行 chunk 抽取、实体消解、持久化、
        后处理等全部阶段。成功/失败/取消均在内部写入 DB 终态。
        """
        build_config = ctx.config
        entity_extractor = ctx.entity_extractor
        relation_extractor = ctx.relation_extractor
        run_id = ctx.run_id
        run_uuid = ctx.run_uuid
        corpus_id = ctx.corpus_id
        app_name = ctx.app_name
        chunks = ctx.chunks
        start_time = ctx.start_time
        normalized_llm_model = ctx.normalized_llm_model

        # 提升到 try 之外：失败分支需要剥离 _phase 后落库 warnings，避免 DB 行残留
        # 上一次 emit_phase 写入的运行期标记；同时让累积的 algorithm warning + 部分 _metrics
        # 在失败时仍然可观测。即便异常发生在 try 内的早期阶段（如 get_processed_chunk_ids）
        # 这两个变量也已绑定，except 不会触发 UnboundLocalError。
        build_warnings: list[dict[str, Any]] = []
        build_metrics: KgBuildMetrics | None = None
        shared_session: AsyncSession | None = None

        try:
            # 共享 Session：全构建生命周期复用单一 DB 连接，消除 ~2000 次 Session 创建/销毁抖动。
            # Repository 的 _session_scope 注入模式（yield self._session + return）不接管生命周期，
            # 每个 commit 仍正常提交事务，但底层 TCP 连接不被释放回连接池，直到 build_graph 结束。
            from negentropy.db.session import AsyncSessionLocal

            from .repository import AgeGraphRepository

            shared_session = AsyncSessionLocal()
            build_repo = AgeGraphRepository(session=shared_session)

            # 增量构建：跳过已处理的 chunk (Hogan et al., 2021 §6.3; Graphiti, 2025)
            prev_processed: set[str] = set()
            if build_config.incremental:
                prev_processed = await build_repo.get_processed_chunk_ids(corpus_id, app_name)
                original_count = len(chunks)
                chunks = [c for c in chunks if c.get("id") and str(c["id"]) not in prev_processed]
                logger.info(
                    "incremental_build_filter",
                    total_chunks=original_count,
                    new_chunks=len(chunks),
                    skipped=len(prev_processed),
                )
                if len(chunks) == 0:
                    logger.warning(
                        "incremental_build_no_new_chunks",
                        corpus_id=str(corpus_id),
                        total_in_corpus=original_count,
                    )
            else:
                # 全量构建：清除旧图谱数据
                await build_repo.clear_graph(corpus_id)

            # 分批处理
            all_entities: list[GraphNode] = []
            all_relations: list[GraphEdge] = []
            chunks_processed = 0
            failed_chunk_count = 0
            chunks_fallback = 0
            total_chunks = len(chunks)

            batch_size = build_config.batch_size
            semaphore = asyncio.Semaphore(build_config.max_concurrency)

            # 单 chunk LLM 提取超时（秒）：包裹 entity / relation extractor.extract。
            # 由全局配置推导：max_retries × timeout + backoff，确保外层预算覆盖内层重试。
            from .extractors import KG_LLM_MAX_RETRIES, KG_LLM_TIMEOUT_SECONDS

            chunk_extract_timeout = KG_LLM_MAX_RETRIES * KG_LLM_TIMEOUT_SECONDS + KG_LLM_MAX_RETRIES

            # 断路器 (Nygard, "Release It!", 2018, Ch.5)：连续 LLM 失败达到阈值后，
            # 跳过 LLM 直接使用 fallback 提取器（regex/cooccurrence），避免每个 chunk
            # 白等 LLM 超时。两态模型 CLOSED→OPEN，无 HALF-OPEN（构建是有限批次）。
            circuit_breaker = _LLMCircuitBreaker(failure_threshold=3)

            # 协同取消信号：断路器 OPEN 时 set，同批并发 chunk 立即跳过 LLM 走 fallback。
            llm_cancel = asyncio.Event()

            # 阶段化进度上报：把当前阶段元数据写入 warnings JSONB 的最后一条 _phase 条目，
            # SSE 端点透传后由前端 KgBuildProgressPill 解析渲染中文标签。
            # 设计决策（vs 新增 phase 列）：复用 warnings JSONB（已有 _metrics 同型条目模式）
            # 避免 alembic 迁移；warnings 字段 SSE 端点已读取，零额外 API 改造。
            # 阶段耗时跟踪：在 emit_phase 触发时计算上一阶段 elapsed_ms，便于排查
            # 各阶段性能瓶颈（如 extracting 80s vs syncing 0.5s）。
            phase_timing: dict[str, Any] = {
                "prev_name": None,
                "prev_started_at": None,
            }

            async def emit_phase(
                phase: str,
                progress: float,
                **extra: Any,
            ) -> None:
                """写阶段化日志 + 更新 progress_percent + 把 _phase 元数据塞入 warnings。

                取消检查点（R-8 + R-9）：阶段边界检查 in-memory event（O(1) 同 worker
                fast-path）+ DB 兜底（跨 worker / 进程重启场景）。每个大阶段 < 10 次，
                DB SELECT 开销可承受。
                """
                # in-memory fast-path
                if is_cancelled(run_id):
                    raise PipelineCancelled(run_id, last_stage=phase)

                # DB 兜底：跨 worker 场景，cancel API 落到 worker A 时本 worker 通过 DB 感知。
                # 用 hasattr/try 兜底兼容 mock repository（无该方法时降级为仅依赖 in-memory）。
                # 注意：此处通过 self._repository（而非 build_repo）查询，_repository 使用
                # _session_scope() 开启独立 session 做 SELECT，不与 build_repo 的
                # shared_session 事务冲突，不会触发连接池竞争。
                _get_run = getattr(self._repository, "get_build_run_by_run_id", None)
                if _get_run is not None:
                    try:
                        latest_record = await _get_run(run_id, app_name)
                    except Exception as poll_exc:
                        logger.debug(
                            "cancel_db_poll_failed",
                            run_id=run_id,
                            phase=phase,
                            error=str(poll_exc),
                        )
                    else:
                        if latest_record is not None and latest_record.status in ("cancelling", "cancelled"):
                            raise PipelineCancelled(run_id, last_stage=phase)

                nonlocal build_warnings
                now_ts = time.time()
                prev_phase_name = phase_timing["prev_name"]
                prev_phase_elapsed_ms: float | None = None
                if phase_timing["prev_started_at"] is not None:
                    prev_phase_elapsed_ms = round((now_ts - float(phase_timing["prev_started_at"])) * 1000, 1)
                phase_timing["prev_name"] = phase
                phase_timing["prev_started_at"] = now_ts

                phase_meta: dict[str, Any] = {
                    "name": phase,
                    "ts": datetime.now(UTC).isoformat(),
                }
                if extra:
                    phase_meta.update(extra)
                build_warnings = _strip_phase_entries(build_warnings)
                build_warnings.append({"_phase": phase_meta})
                log_extra: dict[str, Any] = dict(extra)
                if prev_phase_elapsed_ms is not None:
                    log_extra["prev_phase"] = prev_phase_name
                    log_extra["prev_phase_elapsed_ms"] = prev_phase_elapsed_ms
                logger.info(
                    "graph_phase_started",
                    run_id=run_id,
                    phase=phase,
                    progress_percent=round(progress, 4),
                    **log_extra,
                )
                try:
                    update_kwargs: dict[str, Any] = {
                        "run_id": run_uuid,
                        "status": "running",
                        "progress_percent": progress,
                        "warnings": list(build_warnings),
                    }
                    # 从 extra 中提取中间态计数（可选，仅 resolving 之后阶段有值）
                    if "entity_count" in extra:
                        update_kwargs["entity_count"] = extra["entity_count"]
                    if "relation_count" in extra:
                        update_kwargs["relation_count"] = extra["relation_count"]
                    await build_repo.update_build_run(**update_kwargs)
                except Exception as exc:
                    logger.warning(
                        "update_build_run_failed",
                        run_id=str(run_uuid),
                        phase=phase,
                        error=str(exc),
                    )

            # chunk 循环节流上报：单批 batch 内可能 30-60s（10 chunk × 3 并发 × 单 LLM 5-10s），
            # 仅在每批结束才上报会让 SSE 静默期 ≥ 30s，前端体感"卡死"。
            # 双触发条件：每完成 progress_report_chunk_threshold 个 chunk 或距上次上报 ≥
            # progress_report_min_interval_s 秒，取后到者。Lock 保护避免并发互相覆盖。
            progress_lock = asyncio.Lock()
            # 自适应节流：20 chunks → 每 1 个上报；2000 chunks → 每 10 个上报。
            # 时间兜底从 10s 降至 5s，避免 LLM 调用 60s 超时期间前端静默过长。
            progress_report_chunk_threshold = max(1, total_chunks // 200)
            # 小批次场景（≤ 50 chunks）每 chunk 耗时占比大，需要更密集的进度上报；
            # 大批次场景（> 50 chunks）保留 5s 兜底避免 DB 写入压力。
            progress_report_min_interval_s = 2.0 if total_chunks <= 50 else 5.0
            progress_state: dict[str, float | int] = {
                "last_reported_at": time.time(),
                "last_reported_chunks": 0,
            }

            async def maybe_report_chunk_progress() -> None:
                """chunk 处理过程中按节流条件上报 progress_percent（仅更新单字段，不改 warnings）。

                取消守卫（ISSUE-080）：in-memory ``is_cancelled`` 仅覆盖**同 worker**
                场景（cancel API 与 build task 在同一进程内通过 ``asyncio.Event`` 通信）；
                跨 worker 场景下此检查不生效，正确性由 SQL 层 ``update_build_run`` 的
                状态机 WHERE 守卫兜底（非终态写入不会回滚 cancelling）。
                此处 fast-path 仅是同 worker 内减少日志噪音 + 早出节流的优化。
                """
                if is_cancelled(run_id):
                    return
                async with progress_lock:
                    now = time.time()
                    delta_chunks = chunks_processed - int(progress_state["last_reported_chunks"])
                    delta_time = now - float(progress_state["last_reported_at"])
                    if delta_chunks < progress_report_chunk_threshold and delta_time < progress_report_min_interval_s:
                        return
                    progress_state["last_reported_at"] = now
                    progress_state["last_reported_chunks"] = chunks_processed
                    progress = min(chunks_processed / total_chunks, 1.0) * 0.80 if total_chunks > 0 else 0.80
                    # extracting 阶段累计计数同步落库（issue.md ISSUE-031）：
                    # 此为 resolver 前的原始累计（含跨 chunk 同义实体），UI/SSE 在 progress<0.82
                    # 阶段可见单调增长；resolving 阶段会回填去重后的最终值。
                    current_entity_count = len(all_entities)
                    current_relation_count = len(all_relations)
                    try:
                        await build_repo.update_build_run(
                            run_id=run_uuid,
                            status="running",
                            progress_percent=progress,
                            entity_count=current_entity_count,
                            relation_count=current_relation_count,
                        )
                    except Exception as exc:
                        logger.warning(
                            "update_build_run_failed",
                            run_id=str(run_uuid),
                            phase=PHASE_EXTRACTING,
                            error=str(exc),
                        )
                    logger.info(
                        "chunk_batch_progress",
                        run_id=run_id,
                        processed=chunks_processed,
                        total=total_chunks,
                        failed=failed_chunk_count,
                        progress_percent=round(progress, 4),
                        total_entities=current_entity_count,
                        total_relations=current_relation_count,
                    )

            async def process_chunk(
                chunk: dict[str, Any],
                chunk_index: int,
            ) -> tuple[list[GraphNode], list[GraphEdge]]:
                """处理单个知识块，LLM 提取失败时降级到 fallback 提取器。

                Args:
                    chunk_index: 调度时预分配的 1-based 序号（issue.md ISSUE-030 修复）；
                        替代 ``chunks_processed + 1`` 运行时读取，规避并发竞态导致多 chunk
                        同时日志 `chunk_index=1` / `=11` 的观测性问题。

                韧性机制（三层防御）：
                1. **断路器 fast-path**：连续 LLM 失败 ≥ threshold 后，跳过 LLM 直接
                   使用 fallback（regex/cooccurrence），避免剩余 chunk 白等 30-90s。
                2. **超时降级**：单个 extractor 超时后不重试整个 chunk（浪费 120s），
                   而是直接调用 fallback 提取器获取基本实体/关系。
                3. **部分结果保留**：实体提取成功 + 关系提取超时时，保留实体并使用
                   cooccurrence fallback 获取关系，而非丢弃两者。

                取消检查点（R-8）：协程入口仅查 in-memory event（O(1) dict lookup），
                **不查 DB**——chunk 数可能 1000+，DB SELECT 会成压力；DB 兜底由
                emit_phase 阶段边界承担（最长 1 个 phase 周期感知）。
                """
                nonlocal chunks_fallback

                if is_cancelled(run_id):
                    raise PipelineCancelled(run_id, last_stage="extracting")

                chunk_start_ts = time.time()
                chunk_id = str(chunk.get("id", "?"))

                def _log_chunk_done(entities: list[GraphNode], relations: list[GraphEdge], mode: str) -> None:
                    elapsed_ms = round((time.time() - chunk_start_ts) * 1000, 1)
                    logger.info(
                        "chunk_extraction_finished",
                        run_id=run_id,
                        chunk_id=chunk_id,
                        mode=mode,
                        entity_count=len(entities),
                        relation_count=len(relations),
                        elapsed_ms=elapsed_ms,
                    )

                async with semaphore:
                    text = chunk.get("content", "")
                    if not text:
                        _log_chunk_done([], [], mode="empty")
                        return [], []

                    logger.info(
                        "chunk_processing_started",
                        run_id=run_id,
                        chunk_id=chunk_id,
                        chunk_index=chunk_index,
                        total_chunks=total_chunks,
                        content_length=len(text),
                        circuit_open=circuit_breaker.is_open,
                    )

                    # ── 断路器 fast-path：跳过 LLM，直接 fallback ──
                    if circuit_breaker.should_skip_llm() or llm_cancel.is_set():
                        chunks_fallback += 1
                        fb_entities, fb_relations = await _fallback_extract_chunk(text, chunk_id)
                        _log_chunk_done(fb_entities, fb_relations, mode="fallback_fast_path")
                        return fb_entities, fb_relations

                    # ── 正常 LLM 提取路径 ──
                    # 实体提取与关系提取拆分为独立 try/except，实现部分结果保留：
                    # - 实体成功 + 关系超时 → 保留实体，关系走 fallback
                    # - 实体超时 → 整个 chunk 走 fallback
                    entities: list[GraphNode] = []
                    relations: list[GraphEdge] = []

                    try:
                        # 提取实体（带超时）
                        entities = await asyncio.wait_for(
                            entity_extractor.extract(text, corpus_id),
                            timeout=chunk_extract_timeout,
                        )
                        # 过滤低置信度实体
                        min_conf = build_config.min_entity_confidence
                        entities = [e for e in entities if e.metadata.get("confidence", 1.0) >= min_conf]
                    except (TimeoutError, Exception) as exc:
                        if isinstance(exc, PipelineCancelled):
                            raise
                        # 实体提取失败：记录失败 + 整个 chunk 走 fallback
                        just_opened = circuit_breaker.record_failure()
                        if just_opened:
                            llm_cancel.set()  # 通知同批并发 chunk 停止 LLM
                            logger.warning(
                                "llm_circuit_breaker_opened",
                                run_id=run_id,
                                consecutive_failures=circuit_breaker.consecutive_failures,
                            )
                        logger.warning(
                            "chunk_entity_extraction_timeout_using_fallback",
                            run_id=run_id,
                            chunk_id=chunk_id,
                            timeout_s=chunk_extract_timeout,
                        )
                        chunks_fallback += 1
                        fb_entities, fb_relations = await _fallback_extract_chunk(text, chunk_id)
                        _log_chunk_done(fb_entities, fb_relations, mode="fallback_entity_timeout")
                        return fb_entities, fb_relations

                    # 实体提取成功 → 检查断路器再尝试关系提取
                    if llm_cancel.is_set():
                        # 断路器在实体提取后打开了，关系直接走 fallback
                        chunks_fallback += 1
                        try:
                            from .strategy import CooccurrenceRelationExtractor

                            relations = await CooccurrenceRelationExtractor().extract(entities, text)
                            relations = [
                                r
                                for r in relations
                                if r.metadata.get("confidence", 1.0) >= build_config.min_relation_confidence
                            ]
                        except Exception as fallback_exc:
                            relations = []
                            logger.error(
                                "cooccurrence_fallback_also_failed",
                                run_id=run_id,
                                chunk_id=chunk_id,
                                error=str(fallback_exc),
                            )
                        _log_chunk_done(entities, relations, mode="entity_llm_relation_cooccurrence")
                        return entities, relations

                    try:
                        relations = await asyncio.wait_for(
                            relation_extractor.extract(entities, text),
                            timeout=chunk_extract_timeout,
                        )
                        # 过滤低置信度关系
                        relations = [
                            r
                            for r in relations
                            if r.metadata.get("confidence", 1.0) >= build_config.min_relation_confidence
                        ]
                        # LLM 全部成功 → 重置断路器
                        circuit_breaker.record_success()
                        _log_chunk_done(entities, relations, mode="llm_full")
                        return entities, relations
                    except (TimeoutError, Exception) as exc:
                        if isinstance(exc, PipelineCancelled):
                            raise
                        # 关系提取失败：保留已提取的实体，关系走 cooccurrence fallback
                        just_opened = circuit_breaker.record_failure()
                        if just_opened:
                            llm_cancel.set()  # 通知同批并发 chunk 停止 LLM
                            logger.warning(
                                "llm_circuit_breaker_opened",
                                run_id=run_id,
                                consecutive_failures=circuit_breaker.consecutive_failures,
                            )
                        logger.warning(
                            "chunk_relation_extraction_timeout_preserving_entities",
                            run_id=run_id,
                            chunk_id=chunk_id,
                            entity_count=len(entities),
                            timeout_s=chunk_extract_timeout,
                        )
                        chunks_fallback += 1
                        try:
                            from .strategy import CooccurrenceRelationExtractor

                            relations = await CooccurrenceRelationExtractor().extract(entities, text)
                            relations = [
                                r
                                for r in relations
                                if r.metadata.get("confidence", 1.0) >= build_config.min_relation_confidence
                            ]
                        except Exception as fallback_exc:
                            logger.error(
                                "cooccurrence_fallback_also_failed",
                                run_id=run_id,
                                chunk_id=chunk_id,
                                error=str(fallback_exc),
                            )
                        _log_chunk_done(entities, relations, mode="entity_llm_relation_fallback")
                        return entities, relations

            async def _fallback_extract_chunk(
                text: str,
                chunk_id: str,
            ) -> tuple[list[GraphNode], list[GraphEdge]]:
                """使用 fallback 提取器（regex + cooccurrence）处理 chunk。

                无 LLM 调用，纯本地计算，完成时间 <1s。质量低于 LLM 提取，
                但保证每个 chunk 至少产出基本实体/关系，避免空图。
                """
                from .strategy import CooccurrenceRelationExtractor, RegexEntityExtractor

                try:
                    entities = await RegexEntityExtractor().extract(text, corpus_id)
                    min_conf = build_config.min_entity_confidence
                    entities = [e for e in entities if e.metadata.get("confidence", 1.0) >= min_conf]
                    relations = await CooccurrenceRelationExtractor().extract(entities, text)
                    relations = [
                        r
                        for r in relations
                        if r.metadata.get("confidence", 1.0) >= build_config.min_relation_confidence
                    ]
                    return entities, relations
                except Exception as exc:
                    logger.error(
                        "fallback_extraction_failed",
                        run_id=run_id,
                        chunk_id=chunk_id,
                        error=str(exc),
                    )
                    raise

            # 阶段 1：实体/关系抽取（chunk 循环占整体进度 0.0 → 0.80）
            await emit_phase(PHASE_EXTRACTING, 0.0, processed=0, total=total_chunks)

            # 批量处理：as_completed 逐个完成逐个上报，避免 gather 全部完成后
            # tally 循环微秒级跑完导致进度从 0 跳到 batch_size。
            # semaphore 仍限制实际 LLM 并发为 max_concurrency，调用效率不变。
            for i in range(0, len(chunks), batch_size):
                # 批次入口取消检查点（ISSUE-080）
                if is_cancelled(run_id):
                    raise PipelineCancelled(run_id, last_stage=PHASE_EXTRACTING)

                batch = chunks[i : i + batch_size]
                # chunk_index 在调度时一次性预分配（issue.md ISSUE-030 修复）：
                # 同批并发 chunk 在协程内并发读 chunks_processed 导致竞态，
                # 这里改为 1-based 全局序号 (batch 起始 i + 批内 offset + 1)，互斥唯一。
                pending = [
                    asyncio.ensure_future(process_chunk(chunk, chunk_index=i + offset + 1))
                    for offset, chunk in enumerate(batch)
                ]

                for coro in asyncio.as_completed(pending):
                    try:
                        result = await coro
                    except PipelineCancelled:
                        # 取消同批剩余任务（ISSUE-080）：避免 cancel 信号
                        # 在 chunk loop 内丢失、批次继续处理直到下一个 phase
                        # 边界才被感知。
                        for t in pending:
                            if not t.done():
                                t.cancel()
                        raise
                    except Exception as exc:
                        logger.warning(
                            "chunk_processing_error",
                            run_id=run_id,
                            error=str(exc),
                            error_type=type(exc).__name__,
                        )
                        failed_chunk_count += 1
                        continue

                    entities, relations = result
                    all_entities.extend(entities)
                    all_relations.extend(relations)
                    chunks_processed += 1
                    logger.info(
                        "chunk_processing_completed",
                        run_id=run_id,
                        processed=chunks_processed,
                        total=total_chunks,
                        entity_count=len(entities),
                        relation_count=len(relations),
                    )
                    # 每个 chunk 完成后即上报（自适应节流仍在生效）
                    await maybe_report_chunk_progress()

            # 回收 litellm 内部 HTTP Session（aiohttp.ClientSession）
            # litellm.acompletion 每次调用可能创建内部 Session 对象，
            # 依赖 Python GC 延迟回收会产生 "Unclosed client session" 警告。
            # 显式 gc.collect() 在 chunk 循环结束后及时回收。
            import gc

            gc.collect()
            logger.info(
                "chunk_extraction_gc_completed",
                run_id=run_id,
            )

            # 阶段 2：实体消解（多策略，Fellegi & Sunter, 1969）
            await emit_phase(
                PHASE_RESOLVING,
                0.82,
                processed=chunks_processed,
                total=total_chunks,
                failed=failed_chunk_count,
                entity_count=len(all_entities),
                relation_count=len(all_relations),
            )

            # 多策略实体消解 (Fellegi & Sunter, 1969)
            # Blocking → Exact → Alias → ANN → LLM verification
            from .entity_resolver import EntityResolver

            resolver = EntityResolver(
                ann_threshold=build_config.semantic_dedup_threshold or 0.85,
            )
            entities_to_save = await resolver.resolve(
                new_entities=all_entities,
                find_similar=build_repo.find_similar_entities,
                corpus_id=corpus_id,
            )

            # 持久化实体
            await build_repo.create_entities(
                entities_to_save,
                corpus_id,
            )

            # 重新映射关系中的实体 ID
            label_to_id = {e.label: e.id for e in entities_to_save}
            # ID → Label 反向映射（用于双写时传递实体名称而非 UUID）
            id_to_label: dict[str, str] = {e.id.replace("entity:", ""): e.label for e in entities_to_save if e.label}

            valid_relations = []
            self_loops_removed = 0
            for relation in all_relations:
                # 查找源和目标实体
                source_id = relation.source
                target_id = relation.target

                # 如果 source/target 是 label，需要映射
                if source_id in label_to_id:
                    source_id = label_to_id[source_id]
                if target_id in label_to_id:
                    target_id = label_to_id[target_id]

                # 确保源和目标都存在且非自环
                if not source_id or not target_id:
                    continue
                if source_id == target_id:
                    self_loops_removed += 1
                    continue
                updated_relation = GraphEdge(
                    source=source_id,
                    target=target_id,
                    label=relation.label,
                    edge_type=relation.edge_type,
                    weight=relation.weight,
                    metadata=relation.metadata,
                )
                valid_relations.append(updated_relation)

            logger.info(
                "relation_filtering_completed",
                run_id=run_id,
                raw_count=len(all_relations),
                valid_count=len(valid_relations),
                self_loops_removed=self_loops_removed,
            )

            # B2: 时态事实冲突检测 (Snodgrass & Ahn, 1985)
            # 必须在 create_relations 之前运行：否则在「同 (s,t,type) 但 evidence 变更」的
            # 重建场景下，先 INSERT 会因唯一约束被静默丢弃，再 expire 旧行将导致关系彻底消失。
            # 当前流程：① 先用新关系与 DB 中既有关系比对；② 对 CONTRADICTION 互斥的旧行
            # 提前 expire；③ 再让 create_relations 走 ON CONFLICT DO UPDATE 在原行就地刷新。
            try:
                from .temporal_resolver import TemporalResolver

                temporal_resolver = TemporalResolver()
                relation_dicts_for_temporal = [
                    {
                        "source": r.source,
                        "target": r.target,
                        "edge_type": r.edge_type,
                        "evidence": r.metadata.get("evidence", ""),
                        "weight": r.weight,
                    }
                    for r in valid_relations
                ]
                temporal_results = await temporal_resolver.resolve_relations(
                    new_relations=relation_dicts_for_temporal,
                    existing_lookup=build_repo.find_existing_relations,
                    corpus_id=corpus_id,
                )
                # 对 UPDATE/CONTRADICTION 的旧关系标记失效（提前到持久化之前）
                now = datetime.now(UTC)
                all_expire_ids = list({eid for resolved in temporal_results for eid in resolved.get("expire_ids", [])})
                if all_expire_ids:
                    await build_repo.expire_relations(all_expire_ids, now)
                logger.info(
                    "temporal_resolution_completed",
                    relation_count=len(temporal_results),
                )
            except Exception as tr_exc:
                build_warnings.append({"algorithm": "temporal_resolution", "error": str(tr_exc)})
                logger.warning(
                    "temporal_resolution_failed",
                    error=str(tr_exc),
                )

            # 持久化关系（依赖 create_relation 的 ON CONFLICT DO UPDATE 语义在 UPDATE 路径
            # 上原地覆盖 evidence，避免唯一约束 + DO NOTHING 造成的数据丢失）
            await build_repo.create_relations(valid_relations)

            # 阶段 3：一等公民表双写同步（Kleppmann DDIA §11）
            # 进入 syncing 前清空残留事务状态，防止 resolving 阶段抛异常后
            # session 处于非活动事务态，导致下文 `shared_session.begin()` 重抛错。
            if shared_session.in_transaction():
                await shared_session.rollback()
            await emit_phase(
                PHASE_SYNCING,
                0.87,
                entity_count=len(entities_to_save),
                relation_count=len(valid_relations),
            )

            # 同步到一等公民表 (kg_entities / kg_relations)
            # 参见 Kleppmann DDIA §11: 事务内双写保证 SSoT 一致性
            # 双写同步使用独立事务 + 补偿重试：AGE 写入与 first-class 表写入
            # 在不同 session 中，失败时记录不一致以供后续修复
            try:
                from .entity_service import KgEntityService

                kg_service = KgEntityService()
                node_dicts = [
                    {
                        "id": e.id.replace("entity:", ""),
                        "label": e.label,
                        "node_type": e.node_type,
                        "confidence": e.metadata.get("confidence", 1.0),
                        "metadata": e.metadata,
                    }
                    for e in entities_to_save
                ]
                edge_dicts = [
                    {
                        "source": id_to_label.get(r.source.replace("entity:", ""), r.source.replace("entity:", "")),
                        "target": id_to_label.get(r.target.replace("entity:", ""), r.target.replace("entity:", "")),
                        "edge_type": r.edge_type,
                        "label": r.label,
                        "weight": r.weight,
                        "evidence_text": r.metadata.get("evidence"),
                    }
                    for r in valid_relations
                ]
                async with shared_session.begin():
                    sync_result = await kg_service.batch_sync_from_graph_build(
                        shared_session,
                        nodes=node_dicts,
                        edges=edge_dicts,
                        corpus_id=corpus_id,
                        app_name=app_name,
                    )
                    logger.info(
                        "kg_first_class_sync",
                        **sync_result,
                    )
            except Exception as sync_exc:
                # shared_session.begin() 失败会自动 rollback，
                # 但 session 可能处于非活动事务状态，显式清理确保后续阶段可用。
                if shared_session.in_transaction():
                    await shared_session.rollback()
                build_warnings.append(
                    {
                        "phase": "first_class_sync",
                        "error": str(sync_exc),
                        "entity_count": len(entities_to_save),
                        "relation_count": len(valid_relations),
                    }
                )
                logger.warning(
                    "kg_first_class_sync_failed",
                    error=str(sync_exc),
                )

            # 阶段 4：PageRank 实体重要性（Brin & Page, 1998）
            # 确保 session 干净：前序阶段失败可能导致 session 处于非活动事务状态
            if shared_session.in_transaction():
                await shared_session.rollback()
            await emit_phase(
                PHASE_PAGERANK,
                0.91,
                entity_count=len(entities_to_save),
                relation_count=len(valid_relations),
            )

            # 计算 PageRank 实体重要性 (Brin & Page, 1998)
            try:
                from .graph_algorithms import compute_pagerank

                pr_result = await compute_pagerank(shared_session, corpus_id)
                logger.info(
                    "pagerank_computed",
                    entity_count=len(pr_result),
                )
            except Exception as pr_exc:
                if shared_session.in_transaction():
                    await shared_session.rollback()
                build_warnings.append({"algorithm": "pagerank", "error": str(pr_exc)})
                logger.warning(
                    "pagerank_computation_failed",
                    error=str(pr_exc),
                )

            # 阶段 5：多层级社区检测（Traag et al., 2019）
            if shared_session.in_transaction():
                await shared_session.rollback()
            await emit_phase(
                PHASE_COMMUNITIES,
                0.94,
                entity_count=len(entities_to_save),
                relation_count=len(valid_relations),
            )

            # 多层级社区检测 (Traag et al., 2019; Edge et al., 2024)
            # 优先使用 Leiden（保证社区内部连通性），降级到 Louvain
            levels_data: dict[int, dict[str, int]] = {}
            try:
                from .graph_algorithms import compute_communities

                levels_data = await compute_communities(shared_session, corpus_id)
                total_entities = sum(len(p) for p in levels_data.values())
                total_communities = sum(len(set(p.values())) for p in levels_data.values())
                logger.info(
                    "communities_computed",
                    levels=len(levels_data),
                    entity_count=total_entities,
                    community_count=total_communities,
                )
            except Exception as cm_exc:
                if shared_session.in_transaction():
                    await shared_session.rollback()
                build_warnings.append({"algorithm": "community_detection", "error": str(cm_exc)})
                logger.warning(
                    "community_detection_failed",
                    error=str(cm_exc),
                )

            # 阶段 6：社区摘要生成（Edge et al., Microsoft GraphRAG, 2024）
            if shared_session.in_transaction():
                await shared_session.rollback()
            await emit_phase(
                PHASE_SUMMARIES,
                0.97,
                entity_count=len(entities_to_save),
                relation_count=len(valid_relations),
            )

            # B3: 社区摘要生成 (Edge et al., Microsoft GraphRAG, 2024)
            try:
                from ..ingestion.embedding import build_embedding_fn
                from .community_summarizer import CommunitySummarizer

                # 注入 embedding_fn — G1 GraphRAG Global Search 的 query-focused
                # 召回依赖 kg_community_summaries.embedding；若 embedding 配置不可用
                # （旧环境 / 单测），降级为不写 embedding，由 GlobalSearchService 的
                # _has_summary_embeddings 探测后自动回退到 entity_count 排序。
                try:
                    cs_embedding_fn = build_embedding_fn()
                except Exception as ef_exc:
                    cs_embedding_fn = None
                    logger.warning(
                        "community_summary_embedding_fn_unavailable",
                        error=str(ef_exc),
                    )

                summarizer = CommunitySummarizer(
                    model=normalized_llm_model,
                    embedding_fn=cs_embedding_fn,
                )
                async with shared_session.begin():
                    cs_result = await summarizer.summarize_communities(
                        shared_session,
                        corpus_id,
                        levels_data=levels_data if levels_data else None,
                    )
                    logger.info(
                        "community_summaries_generated",
                        **cs_result,
                    )
            except Exception as cs_exc:
                if shared_session.in_transaction():
                    await shared_session.rollback()
                build_warnings.append({"algorithm": "community_summary", "error": str(cs_exc)})
                logger.warning(
                    "community_summary_failed",
                    error=str(cs_exc),
                )

            elapsed = time.time() - start_time

            # 计算已处理 chunk ID 列表（增量模式需合并上次）
            current_chunk_ids = [str(c["id"]) for c in chunks if c.get("id")]
            if build_config.incremental and prev_processed:
                all_processed = list(prev_processed | set(current_chunk_ids))
            else:
                all_processed = current_chunk_ids

            # E4: 收集构建指标 (Majors et al., 2022)
            from .metrics import KgBuildMetrics

            custom_count = sum(1 for r in valid_relations if r.edge_type == "CUSTOM")
            avg_conf = (
                sum(e.metadata.get("confidence", 1.0) for e in entities_to_save) / len(entities_to_save)
                if entities_to_save
                else 0.0
            )
            build_metrics = KgBuildMetrics(
                entity_count=len(entities_to_save),
                relation_count=len(valid_relations),
                custom_type_count=custom_count,
                avg_confidence=round(avg_conf, 4),
                chunks_processed=chunks_processed,
                chunks_failed=failed_chunk_count,
                chunks_fallback=chunks_fallback,
                llm_circuit_opened=circuit_breaker.is_open,
                build_duration_ms=round(elapsed * 1000, 1),
                algorithm_warnings=sum(1 for w in _strip_phase_entries(build_warnings) if "algorithm" in w),
                community_levels=len(levels_data),
                community_count_by_level={lv: len(set(p.values())) for lv, p in levels_data.items()},
            )

            # 更新构建运行状态
            # metrics 无条件持久化到 warnings 尾部的 _metrics 条目，
            # 保持 warnings 本身语义：空列表 = 无异常，仅 _metrics = 正常完成
            # 终态前剥离运行期 _phase 条目：阶段元数据仅服务于前端实时进度渲染，
            # 落入终态 warnings 会污染历史检视（与 _metrics 同型 sentinel 区分）。
            persisted_warnings: list[dict[str, Any]] = _strip_phase_entries(build_warnings)
            persisted_warnings.append({"_metrics": build_metrics.to_dict()})
            if circuit_breaker.is_open:
                persisted_warnings.append({"_circuit_opened": True})
            await build_repo.update_build_run(
                run_id=run_uuid,
                status="completed",
                entity_count=len(entities_to_save),
                relation_count=len(valid_relations),
                warnings=persisted_warnings if persisted_warnings else None,
                processed_chunk_ids=all_processed if all_processed else None,
            )

            # 缓存失效：构建完成时清除该语料库的缓存
            _graph_cache.invalidate(f"graph:{corpus_id}")
            _graph_cache.invalidate(f"stats:{corpus_id}")

            logger.info(
                "graph_build_completed",
                corpus_id=str(corpus_id),
                run_id=run_id,
                **build_metrics.to_dict(),
            )

            return GraphBuildResult(
                run_id=run_id,
                corpus_id=corpus_id,
                status="completed",
                entity_count=len(entities_to_save),
                relation_count=len(valid_relations),
                chunks_processed=chunks_processed,
                elapsed_seconds=elapsed,
                warnings=build_warnings,
                failed_chunk_count=failed_chunk_count,
            )

        except PipelineCancelled as cancel_exc:
            # 协作式取消：写入 cancelled 终态，剥离运行期 _phase 标记，保留累积 warnings；
            # best-effort 不回滚——已写入的 entities/relations 保留，前端通过详情面板看
            # 「取消时进度」（chunks_processed / last_phase）。
            elapsed = time.time() - start_time
            cancellation_warnings: list[dict[str, Any]] = _strip_phase_entries(build_warnings)
            if build_metrics is not None:
                cancellation_warnings.append({"_metrics": build_metrics.to_dict()})
            cancellation_warnings.append(
                {
                    "_cancellation": {
                        "cancelled_at": datetime.now(UTC).isoformat(),
                        "last_stage": cancel_exc.last_stage,
                        "elapsed_seconds": elapsed,
                    }
                }
            )

            try:
                if shared_session is not None and not shared_session.is_active:
                    raise RuntimeError("shared session inactive")
                await build_repo.update_build_run(
                    run_id=run_uuid,
                    status="cancelled",
                    warnings=cancellation_warnings if cancellation_warnings else None,
                )
            except Exception:
                await self._repository.update_build_run(
                    run_id=run_uuid,
                    status="cancelled",
                    warnings=cancellation_warnings if cancellation_warnings else None,
                )

            logger.info(
                "kg_build_cancelled",
                corpus_id=str(corpus_id),
                run_id=run_id,
                last_stage=cancel_exc.last_stage,
                elapsed_seconds=elapsed,
            )

            return GraphBuildResult(
                run_id=run_id,
                corpus_id=corpus_id,
                status="cancelled",
                entity_count=0,
                relation_count=0,
                chunks_processed=0,
                elapsed_seconds=elapsed,
                error_message=None,
            )

        except Exception as exc:
            elapsed = time.time() - start_time
            error_message = str(exc)

            logger.error(
                "graph_build_failed",
                corpus_id=str(corpus_id),
                run_id=run_id,
                error=error_message,
                elapsed_seconds=elapsed,
            )

            # 失败终态同样剥离 _phase + 持久化已累积的 warnings：
            # 1) 与成功分支对称，确保 DB 行 warnings 列不残留运行期 _phase 标记；
            # 2) 保留 build_warnings 中已落地的 algorithm warning（temporal_resolution /
            #    pagerank / community_*）作为故障诊断线索；
            # 3) 若 build_metrics 已构造则附带 _metrics 条目（异常发生在指标统计前则跳过）。
            failure_warnings: list[dict[str, Any]] = _strip_phase_entries(build_warnings)
            if build_metrics is not None:
                failure_warnings.append({"_metrics": build_metrics.to_dict()})

            # 更新构建运行状态（回退到独立 Session，避免共享 Session 已损坏导致二次失败）
            try:
                if shared_session is not None and not shared_session.is_active:
                    raise RuntimeError("shared session inactive")
                await build_repo.update_build_run(
                    run_id=run_uuid,
                    status="failed",
                    error_message=error_message,
                    warnings=failure_warnings if failure_warnings else None,
                )
            except Exception:
                await self._repository.update_build_run(
                    run_id=run_uuid,
                    status="failed",
                    error_message=error_message,
                    warnings=failure_warnings if failure_warnings else None,
                )

            return GraphBuildResult(
                run_id=run_id,
                corpus_id=corpus_id,
                status="failed",
                entity_count=0,
                relation_count=0,
                chunks_processed=0,
                elapsed_seconds=elapsed,
                error_message=error_message,
            )

        finally:
            # 确保共享 Session 被关闭（归还连接到池）
            if shared_session is not None:
                await shared_session.close()
            # 清理 cancellation registry，防内存泄漏
            unregister_cancellable_run(run_id)

    async def search(
        self,
        corpus_id: UUID,
        app_name: str,
        query: str,
        query_embedding: list[float] | None,
        config: GraphQueryConfig | None = None,
        as_of: datetime | None = None,
    ) -> GraphQueryResult:
        """混合检索图谱

        结合向量相似度和图结构分数进行检索。

        Args:
            corpus_id: 语料库 ID
            app_name: 应用名称
            query: 查询文本
            query_embedding: 查询向量
            config: 查询配置（可选）
            as_of: 可选时态快照时刻；提供时仅纳入在该时刻仍有效的关系

        Returns:
            检索结果
        """
        query_config = config or GraphQueryConfig()
        start_time = time.time()

        logger.debug(
            "graph_search_started",
            corpus_id=str(corpus_id),
            query=query[:50],
            as_of=as_of.isoformat() if as_of else None,
        )

        # 执行混合检索
        results = await self._repository.hybrid_search(
            corpus_id=corpus_id,
            app_name=app_name,
            query_embedding=query_embedding,
            query_text=query,
            limit=query_config.limit,
            graph_depth=query_config.max_depth,
            semantic_weight=query_config.semantic_weight,
            graph_weight=query_config.graph_weight,
            rrf_k=query_config.rrf_k if query_config.use_rrf else None,
            as_of=as_of,
        )

        # 可选：加载邻居信息
        if query_config.include_neighbors and results:
            from dataclasses import replace

            enriched = []
            for result in results[:5]:  # 只为前 5 个结果加载邻居
                try:
                    neighbors = await self._repository.find_neighbors(
                        entity_id=result.entity.id,
                        max_depth=1,
                        limit=query_config.neighbor_limit,
                    )
                    enriched.append(replace(result, neighbors=neighbors))
                except Exception as exc:
                    logger.warning(
                        "neighbor_load_error",
                        entity_id=result.entity.id,
                        error=str(exc),
                    )
                    enriched.append(result)
            results = enriched + results[5:]

        elapsed_ms = (time.time() - start_time) * 1000

        logger.debug(
            "graph_search_completed",
            corpus_id=str(corpus_id),
            result_count=len(results),
            elapsed_ms=elapsed_ms,
        )

        return GraphQueryResult(
            entities=results,
            total_count=len(results),
            query_time_ms=elapsed_ms,
        )

    async def get_graph(
        self,
        corpus_id: UUID,
        app_name: str,
        include_runs: bool = False,
        as_of: datetime | None = None,
    ) -> KnowledgeGraphPayload:
        """获取完整图谱

        Args:
            corpus_id: 语料库 ID
            app_name: 应用名称
            include_runs: 是否包含构建运行历史
            as_of: 可选时态快照时刻；提供时仅返回在该时刻有效的关系

        Returns:
            完整图谱数据
        """
        logger.debug(
            "get_graph_started",
            corpus_id=str(corpus_id),
            app_name=app_name,
            as_of=as_of.isoformat() if as_of else None,
        )

        # 缓存检查（as_of 维度纳入 key 后缀，确保不同时态快照不会脏读）
        as_of_key = as_of.isoformat() if as_of else "now"
        cache_key = f"graph:{corpus_id}|as_of={as_of_key}"
        cached = _graph_cache.get(cache_key)
        if cached is not None:
            logger.debug("get_graph_cache_hit", corpus_id=str(corpus_id))
            return cached

        # 获取图谱数据
        graph = await self._repository.get_graph(corpus_id, app_name, as_of=as_of)

        # 可选：包含构建历史
        if include_runs:
            runs = await self._repository.get_build_runs(corpus_id, app_name)
            runs_data = [
                {
                    "run_id": r.run_id,
                    "status": r.status,
                    "entity_count": r.entity_count,
                    "relation_count": r.relation_count,
                    "started_at": r.started_at.isoformat() if r.started_at else None,
                    "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                    "model_name": r.model_name,
                }
                for r in runs
            ]
            # 创建新的 payload（因为 dataclass 是 frozen 的）
            graph = KnowledgeGraphPayload(
                nodes=graph.nodes,
                edges=graph.edges,
                runs=runs_data,
            )

        logger.info(
            "get_graph_completed",
            corpus_id=str(corpus_id),
            node_count=len(graph.nodes),
            edge_count=len(graph.edges),
        )

        _graph_cache.set(cache_key, graph)
        return graph

    async def find_neighbors(
        self,
        entity_id: str,
        max_depth: int = 2,
        limit: int = 100,
        as_of: datetime | None = None,
    ) -> list[GraphNode]:
        """查询实体邻居

        Args:
            entity_id: 起始实体 ID
            max_depth: 最大遍历深度
            limit: 结果数量限制
            as_of: 可选时态快照时刻；提供时仅遍历在该时刻有效的关系

        Returns:
            邻居节点列表
        """
        logger.debug(
            "find_neighbors_started",
            entity_id=entity_id,
            max_depth=max_depth,
            as_of=as_of.isoformat() if as_of else None,
        )

        neighbors = await self._repository.find_neighbors(
            entity_id=entity_id,
            max_depth=max_depth,
            limit=limit,
            as_of=as_of,
        )

        logger.debug(
            "find_neighbors_completed",
            entity_id=entity_id,
            neighbor_count=len(neighbors),
        )

        return neighbors

    async def find_path(
        self,
        source_id: str,
        target_id: str,
        max_depth: int = 5,
        as_of: datetime | None = None,
    ) -> list[str] | None:
        """查询两点间最短路径

        Args:
            source_id: 起始实体 ID
            target_id: 目标实体 ID
            max_depth: 最大路径深度
            as_of: 可选时态快照时刻；提供时仅遍历在该时刻有效的关系

        Returns:
            路径节点 ID 列表，或 None
        """
        logger.debug(
            "find_path_started",
            source_id=source_id,
            target_id=target_id,
            as_of=as_of.isoformat() if as_of else None,
        )

        path = await self._repository.find_path(
            source_id=source_id,
            target_id=target_id,
            max_depth=max_depth,
            as_of=as_of,
        )

        if path:
            logger.debug(
                "find_path_completed",
                source_id=source_id,
                target_id=target_id,
                path_length=len(path),
            )
        else:
            logger.debug(
                "find_path_no_path",
                source_id=source_id,
                target_id=target_id,
            )

        return path

    async def get_subgraph(
        self,
        corpus_id: UUID,
        app_name: str,
        center_id: str,
        radius: int = 1,
        limit: int = 200,
        as_of: datetime | None = None,
    ) -> KnowledgeGraphPayload:
        """以 center 实体为锚点的 BFS 子图（G2 Cytoscape 增量加载）。

        策略：复用 ``get_graph`` 的全图（命中缓存层）+ 内存 BFS，避免新增 SQL；
        节点按"距 center 的跳数 → importance"双键排序后取前 ``limit`` 个；
        边保留两端都在节点集合中的连接。

        Args:
            corpus_id: 语料库 ID
            app_name: 应用名称
            center_id: BFS 起点实体 ID（含/不含 ``entity:`` 前缀）
            radius: BFS 半径（跳数），1-3
            limit: 节点数上限（防止前端渲染过载）
            as_of: 可选时态快照时刻；与 G3 时间穿梭对齐

        Returns:
            KnowledgeGraphPayload：以 center 为锚点的连通子图
        """
        if radius < 1 or radius > 3:
            raise ValueError(f"radius must be in [1,3], got {radius}")
        if limit < 1:
            raise ValueError(f"limit must be positive, got {limit}")

        graph = await self.get_graph(corpus_id, app_name, as_of=as_of)

        # 归一化 center_id（与 GraphNode.id 保持 ``entity:`` 前缀一致）
        normalized_center = center_id if center_id.startswith("entity:") else f"entity:{center_id}"

        # 邻接表（无向，便于 BFS）
        adjacency: dict[str, set[str]] = {}
        for edge in graph.edges:
            adjacency.setdefault(edge.source, set()).add(edge.target)
            adjacency.setdefault(edge.target, set()).add(edge.source)

        # BFS：distance[node] = 距 center 的跳数
        distance: dict[str, int] = {normalized_center: 0}
        frontier = [normalized_center]
        for hop in range(1, radius + 1):
            next_frontier: list[str] = []
            for node_id in frontier:
                for nb in adjacency.get(node_id, ()):
                    if nb not in distance:
                        distance[nb] = hop
                        next_frontier.append(nb)
            frontier = next_frontier
            if not frontier:
                break

        # 排序：跳数升序 → importance 降序 → 限制 limit
        nodes_by_id = {n.id: n for n in graph.nodes}

        def _importance(node_id: str) -> float:
            node = nodes_by_id.get(node_id)
            if node is None:
                return 0.0
            score = node.metadata.get("importance_score") if node.metadata else None
            return float(score) if score is not None else 0.0

        sorted_ids = sorted(
            distance.keys(),
            key=lambda nid: (distance[nid], -_importance(nid)),
        )[:limit]
        keep_ids = set(sorted_ids)

        sub_nodes = [nodes_by_id[nid] for nid in sorted_ids if nid in nodes_by_id]
        sub_edges = [edge for edge in graph.edges if edge.source in keep_ids and edge.target in keep_ids]

        logger.debug(
            "subgraph_built",
            corpus_id=str(corpus_id),
            center_id=normalized_center,
            radius=radius,
            node_count=len(sub_nodes),
            edge_count=len(sub_edges),
        )

        return KnowledgeGraphPayload(nodes=sub_nodes, edges=sub_edges)

    async def get_relation_timeline(
        self,
        corpus_id: UUID,
        bucket: str = "day",
    ) -> list[dict[str, Any]]:
        """获取关系生效/失效事件时间轴密度直方图（G3 时间穿梭检索）。

        Args:
            corpus_id: 语料库 ID
            bucket: ``day`` / ``week`` / ``month``

        Returns:
            ``[{"date", "active_count", "expired_count"}]`` 列表（按时间升序）
        """
        return await self._repository.get_relation_timeline(
            corpus_id=corpus_id,
            bucket=bucket,
        )

    async def get_build_history(
        self,
        corpus_id: UUID,
        app_name: str,
        limit: int = 20,
    ) -> list[BuildRunRecord]:
        """获取构建历史

        Args:
            corpus_id: 语料库 ID
            app_name: 应用名称
            limit: 结果数量限制

        Returns:
            构建运行记录列表
        """
        return await self._repository.get_build_runs(
            corpus_id=corpus_id,
            app_name=app_name,
            limit=limit,
        )

    async def get_stats(
        self,
        db: AsyncSession,
        corpus_id: UUID,
    ) -> dict[str, Any]:
        """获取图谱统计信息

        Returns:
            统计字典（total_entities, by_type, avg_confidence, edge_count, health_metrics）
        """
        import math

        from sqlalchemy import func as sql_func
        from sqlalchemy import select as sql_select

        from negentropy.models.perception import KgEntity, KgRelation

        # Total entities
        total_result = await db.execute(
            sql_select(sql_func.count())
            .select_from(KgEntity)
            .where(KgEntity.corpus_id == corpus_id, KgEntity.is_active == True)  # noqa: E712
        )
        total_entities = total_result.scalar_one()

        # By type
        by_type_result = await db.execute(
            sql_select(KgEntity.entity_type, sql_func.count())
            .where(KgEntity.corpus_id == corpus_id, KgEntity.is_active == True)  # noqa: E712
            .group_by(KgEntity.entity_type)
        )
        by_type = {row[0]: row[1] for row in by_type_result.all()}

        # Avg confidence
        avg_result = await db.execute(
            sql_select(sql_func.avg(KgEntity.confidence)).where(
                KgEntity.corpus_id == corpus_id,
                KgEntity.is_active,  # noqa: E712
            )  # noqa: E712
        )
        avg_confidence = float(avg_result.scalar() or 0)

        # Edge count
        edge_result = await db.execute(
            sql_select(sql_func.count())
            .select_from(KgRelation)
            .where(KgRelation.corpus_id == corpus_id, KgRelation.is_active == True)  # noqa: E712
        )
        edge_count = edge_result.scalar_one()

        # Density: edges / (entities * (entities - 1))
        density = 0.0
        if total_entities > 1:
            max_edges = total_entities * (total_entities - 1)
            density = round(edge_count / max_edges, 4)

        # Top entities by importance (PageRank)
        top_entities_result = await db.execute(
            sql_select(KgEntity.id, KgEntity.name, KgEntity.entity_type, KgEntity.importance_score)
            .where(
                KgEntity.corpus_id == corpus_id,
                KgEntity.is_active == True,  # noqa: E712
                KgEntity.importance_score != None,  # noqa: E711
            )
            .order_by(KgEntity.importance_score.desc())
            .limit(5)
        )
        top_entities = [
            {
                "id": str(row.id),
                "name": row.name,
                "entity_type": row.entity_type,
                "importance_score": round(float(row.importance_score), 6),
            }
            for row in top_entities_result
        ]

        # Community distribution (Louvain)
        community_result = await db.execute(
            sql_select(KgEntity.community_id, sql_func.count())
            .where(
                KgEntity.corpus_id == corpus_id,
                KgEntity.is_active == True,  # noqa: E712
                KgEntity.community_id != None,  # noqa: E711
            )
            .group_by(KgEntity.community_id)
            .order_by(sql_func.count().desc())
            .limit(10)
        )
        community_distribution = {str(row[0]): row[1] for row in community_result.all()}

        community_count_result = await db.execute(
            sql_select(sql_func.count(sql_func.distinct(KgEntity.community_id))).where(
                KgEntity.corpus_id == corpus_id,
                KgEntity.is_active == True,  # noqa: E712
                KgEntity.community_id != None,  # noqa: E711
            )
        )
        community_count = community_count_result.scalar_one()

        # --- 健康指标（Farber et al., 2018; Hogan et al., 2021 §7） ---
        from negentropy.models.base import NEGENTROPY_SCHEMA

        # 1. 孤立实体比例：无任何关系的实体占比
        isolated_result = await db.execute(
            text(f"""
                SELECT COALESCE(
                    COUNT(*) FILTER (WHERE r_count = 0)::float / NULLIF(COUNT(*), 0),
                    0
                ) AS isolated_ratio
                FROM (
                    SELECT e.id, COUNT(r.id) AS r_count
                    FROM {NEGENTROPY_SCHEMA}.kg_entities e
                    LEFT JOIN {NEGENTROPY_SCHEMA}.kg_relations r ON (
                        (r.source_id = e.id OR r.target_id = e.id)
                        AND r.is_active = true
                    )
                    WHERE e.corpus_id = :cid AND e.is_active = true
                    GROUP BY e.id
                ) sub
            """),
            {"cid": corpus_id},
        )
        isolated_ratio = float(isolated_result.scalar() or 0)

        # 2. Shannon 熵：类型分布均衡度（> 1.5 健康, < 1.0 告警）
        shannon_entropy = 0.0
        if by_type:
            total_typed = sum(by_type.values())
            shannon_entropy = -sum((c / total_typed) * math.log2(c / total_typed) for c in by_type.values() if c > 0)

        # 3. 连通分量数：小图实时计算，大图标记 needs_refresh
        connected_components = None
        if 0 < total_entities <= 10000:
            try:
                from .graph_algorithms import export_graph_to_networkx

                nx_graph = await export_graph_to_networkx(db, corpus_id)
                import networkx as nx

                connected_components = nx.number_weakly_connected_components(nx_graph)
            except Exception:
                connected_components = None

        # 4. 构建管道健康：最近 30 天成功率和平均时长
        build_health = await self._get_build_health(db, corpus_id)

        # 5. 综合 health_score (0-100)
        health_score = self._compute_health_score(
            total_entities=total_entities,
            isolated_ratio=isolated_ratio,
            shannon_entropy=shannon_entropy,
            avg_confidence=avg_confidence,
            density=density,
            build_success_rate=build_health.get("success_rate", 1.0),
        )

        return {
            "total_entities": total_entities,
            "edge_count": edge_count,
            "by_type": by_type,
            "avg_confidence": round(avg_confidence, 3),
            "density": density,
            "avg_degree": round(2 * edge_count / total_entities, 1) if total_entities > 0 else 0,
            "top_entities": top_entities,
            "community_count": community_count,
            "community_distribution": community_distribution,
            # 健康指标
            "health": {
                "score": health_score,
                "level": "healthy" if health_score >= 70 else ("warning" if health_score >= 40 else "critical"),
                "isolated_ratio": round(isolated_ratio, 3),
                "shannon_entropy": round(shannon_entropy, 3),
                "connected_components": connected_components,
                "build": build_health,
            },
        }

    async def _get_build_health(
        self,
        db: AsyncSession,
        corpus_id: UUID,
    ) -> dict[str, Any]:
        """获取构建管道健康指标（最近 30 天）"""
        try:
            from negentropy.models.base import NEGENTROPY_SCHEMA

            result = await db.execute(
                text(f"""
                    SELECT
                        COUNT(*) AS total,
                        COUNT(*) FILTER (WHERE status = 'completed') AS succeeded,
                        COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - started_at))), 0) AS avg_duration_sec
                    FROM {NEGENTROPY_SCHEMA}.kg_build_runs
                    WHERE corpus_id = :cid
                      AND started_at >= NOW() - INTERVAL '30 days'
                """),
                {"cid": corpus_id},
            )
            row = result.one()
            total = row.total or 0
            return {
                "total_runs": total,
                "success_rate": round(row.succeeded / total, 3) if total > 0 else 1.0,
                "avg_duration_sec": round(float(row.avg_duration_sec or 0), 1),
            }
        except Exception:
            return {"total_runs": 0, "success_rate": 1.0, "avg_duration_sec": 0}

    @staticmethod
    def _compute_health_score(
        *,
        total_entities: int,
        isolated_ratio: float,
        shannon_entropy: float,
        avg_confidence: float,
        density: float,
        build_success_rate: float,
    ) -> int:
        """综合健康评分 (0-100)

        权重分配:
        - 实体覆盖度 (25%): total_entities > 100 满分
        - 孤立率 (20%): isolated_ratio < 0.2 满分
        - 密度 (10%): density > 0.005 满分
        - 类型均衡 (15%): shannon_entropy > 1.5 满分
        - 置信度 (15%): avg_confidence > 0.8 满分
        - 构建成功率 (15%): build_success_rate > 0.95 满分
        """
        coverage_score = min(total_entities / 100, 1.0) * 25
        isolation_score = max(0, 1 - isolated_ratio / 0.4) * 20
        density_score = min(density / 0.005, 1.0) * 10
        entropy_score = min(shannon_entropy / 1.5, 1.0) * 15
        confidence_score = min(avg_confidence / 0.8, 1.0) * 15
        build_score = min(build_success_rate / 0.95, 1.0) * 15
        return int(coverage_score + isolation_score + density_score + entropy_score + confidence_score + build_score)

    async def clear_graph(
        self,
        corpus_id: UUID,
    ) -> int:
        """清除图谱数据

        Args:
            corpus_id: 语料库 ID

        Returns:
            删除的节点数量
        """
        logger.info(
            "clear_graph_started",
            corpus_id=str(corpus_id),
        )

        count = await self._repository.clear_graph(corpus_id)

        # 缓存失效
        _graph_cache.invalidate(f"graph:{corpus_id}")
        _graph_cache.invalidate(f"stats:{corpus_id}")

        logger.info(
            "clear_graph_completed",
            corpus_id=str(corpus_id),
            nodes_cleared=count,
        )

        return count


# ============================================================================
# Factory Function
# ============================================================================


def get_graph_service(
    session: AsyncSession | None = None,
    config: GraphBuildConfig | None = None,
) -> GraphService:
    """获取图谱服务实例

    Args:
        session: 可选的数据库会话
        config: 可选的构建配置

    Returns:
        GraphService 实例
    """
    return GraphService(session=session, config=config)
