"""
PostgresMemoryService: ADK MemoryService 的 PostgreSQL 实现

继承 Google ADK BaseMemoryService，复用 Phase 2 Hippocampus 的记忆巩固能力，实现：
- Session 到 Memory 的转化 (add_session_to_memory) — 三阶段管线：分段 → 去重 → 存储
- 混合检索 (search_memory) - 支持语义 + BM25 Hybrid Search，支持分页与过滤
- 访问行为记录 (record_access) - 更新 access_count/last_accessed_at，驱动遗忘曲线

巩固管线借鉴 Claude Code AutoDream 四阶段范式：
    Orient（扫描现有）→ Consolidate（分段去重存储）→ Prune（retention_score 驱动清理）

参考文献:
[1] A. Ebbinghaus, "Memory: A Contribution to Experimental Psychology," 1885.
[2] P. Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks,"
    *Adv. Neural Inf. Process. Syst.*, vol. 33, pp. 9459-9474, 2020.
"""

from __future__ import annotations

import asyncio
import re
import uuid
from datetime import UTC, datetime
from typing import Any

from google.adk.memory.base_memory_service import (
    BaseMemoryService,
    MemoryEntry,
    SearchMemoryResponse,
)

# ADK 官方类型
from google.adk.sessions import Session as ADKSession
from sqlalchemy import func, select, text, update

# ORM 模型与会话工厂
import negentropy.db.session as db_session
from negentropy.engine.consolidation.llm_fact_extractor import LLMFactExtractor
from negentropy.engine.governance.memory import (
    _MEMORY_TYPE_MULTIPLIER,
    VALID_MEMORY_TYPES,
    MemoryGovernanceService,
)
from negentropy.engine.governance.pii_detector import detect as detect_pii
from negentropy.engine.governance.pii_detector import summarize_flags as summarize_pii_flags
from negentropy.engine.utils.query_intent import classify as classify_intent
from negentropy.logging import get_logger
from negentropy.models.base import NEGENTROPY_SCHEMA
from negentropy.models.internalization import Memory

logger = get_logger("negentropy.engine.adapters.postgres.memory_service")

# 默认检索配置
_DEFAULT_SEARCH_LIMIT = 10
_DEFAULT_SEMANTIC_WEIGHT = 0.7
_DEFAULT_KEYWORD_WEIGHT = 0.3

# 巩固管线配置
_MAX_TURN_PAIRS_PER_SEGMENT = 5  # 每段最多包含的 user+model 对话轮次数
_DEDUP_SIMILARITY_THRESHOLD = 0.85  # cosine similarity 去重阈值（对齐 Henzinger<sup>[[40]](#ref40)</sup>）
_DEDUP_JACCARD_THRESHOLD = 0.7  # Jaccard 词重叠二次校验阈值（对齐 Broder MinHash<sup>[[37]](#ref37)</sup>）
_INITIAL_RETENTION_BASE = 0.8  # 新记忆初始保留分数基准
_EMBEDDING_MAX_RETRIES = 3  # Embedding 指数退避最大重试次数<sup>[[44]](#ref44)</sup>


class PostgresMemoryService(BaseMemoryService):
    """
    PostgreSQL 实现的 MemoryService

    继承 ADK BaseMemoryService，可直接与 ADK Runner 集成。

    核心职责：
    1. 将 Session 对话转化为可搜索的记忆 (复用 Phase 2 consolidate)
    2. 基于 Hybrid Search 检索相关记忆 (语义 + BM25 融合)
    """

    def __init__(self, embedding_fn: callable | None = None, consolidation_worker=None):
        self._embedding_fn = embedding_fn  # 向量化函数
        self._consolidation_worker = consolidation_worker  # Phase 2 Worker
        self._fact_extractor = LLMFactExtractor()

    async def add_session_to_memory(
        self,
        session: ADKSession,
    ) -> None:
        """将 Session 中的对话转化为可搜索的记忆"""
        if self._consolidation_worker:
            # 使用 Phase 2 的 consolidate 函数
            await self._consolidation_worker.consolidate(
                thread_id=session.id, user_id=session.user_id, app_name=session.app_name
            )
        else:
            # 简化实现：直接将 Events 向量化存储
            await self._simple_consolidate(session)

    async def _simple_consolidate(self, session: ADKSession) -> None:
        """四阶段记忆巩固管线（事务级联 + 并发控制）

        阶段 1 — 分段（Segment）: 按 speaker turn 将对话拆分为多段
        阶段 2 — 去重（Orient）: 对每段生成 embedding，与现有记忆比对跳过重复
        阶段 3 — 存储（Consolidate）: 写入新记忆，附带初始 retention_score
        阶段 4 — 事实提取（Extract）: 从对话中提取结构化事实并存储

        事务安全<sup>[[44]](#ref44)</sup>：阶段 2（embedding 生成）在事务外预计算，
        阶段 3（写入）在单次事务内执行，使用 SAVEPOINT 隔离每段写入，
        advisory lock 防止同 thread 并发巩固。
        阶段 4（事实提取）由 FactService 独立事务管理，不影响主事务。

        借鉴 Claude Code AutoDream 的 Orient→Consolidate 范式。
        """
        # 阶段 1：按 speaker turn 提取并分段
        turns = self._extract_speaker_turns(session.events)
        if not turns:
            return

        segments = self._group_turns_into_segments(turns)
        thread_id = self._parse_thread_id(session.id)

        # 阶段 2（预计算）：事务外生成 embedding，避免重试休眠期间持有锁
        seg_data: list[tuple[int, str, list[float] | None]] = []
        for seg_idx, segment in enumerate(segments):
            content = self._format_segment_content(segment)
            embedding = await self._retry_embedding(content, seg_idx)
            if embedding is None and self._embedding_fn:
                logger.warning("consolidate_embedding_skipped", segment=seg_idx)
                continue
            seg_data.append((seg_idx, content, embedding))

        if not seg_data:
            logger.info("consolidate_no_segments_after_embedding", user_id=session.user_id)
            return

        # 阶段 3（写入）：单事务执行去重 + 存储
        stored_count = 0
        new_memory_ids: list[uuid.UUID] = []
        async with db_session.AsyncSessionLocal() as db:
            # Advisory lock: 防止同 thread 并发巩固
            if not await self._try_acquire_advisory_lock(db, thread_id):
                logger.info("consolidate_skipped_concurrent", thread_id=str(thread_id))
                return

            for seg_idx, content, embedding in seg_data:
                if embedding is not None and await self._is_duplicate(
                    db=db,
                    user_id=session.user_id,
                    app_name=session.app_name,
                    embedding=embedding,
                    content=content,
                ):
                    logger.debug("consolidate_duplicate_skipped", segment=seg_idx)
                    continue

                initial_score = self._calculate_initial_retention(content)
                importance = self._calculate_initial_importance(
                    memory_type="episodic",
                )
                # Phase 4: PII 检测占位（regex 级，命中后 metadata.pii_flags 标记）
                pii_matches = detect_pii(content)
                pii_flags = summarize_pii_flags(pii_matches) if pii_matches else {}
                async with db.begin_nested():
                    memory = Memory(
                        thread_id=thread_id,
                        user_id=session.user_id,
                        app_name=session.app_name,
                        memory_type="episodic",
                        content=content,
                        embedding=embedding,
                        retention_score=initial_score,
                        importance_score=importance,
                        metadata_={
                            "source": "session",
                            "event_count": len(session.events),
                            "segment_index": seg_idx,
                            "total_segments": len(segments),
                            "turn_count": len(segments[seg_idx] if seg_idx < len(segments) else []),
                            **({"pii_flags": pii_flags} if pii_flags else {}),
                        },
                    )
                    db.add(memory)
                    await db.flush()
                    new_memory_ids.append(memory.id)
                stored_count += 1

            # 统一 commit
            await db.commit()

        # 阶段 4 + 5：Phase 5 F3 Memify 后处理管线（默认与 Phase 4 行为一致）。
        # ``settings.memory.consolidation.legacy=true`` 一键回退到旧的硬编码两步。
        try:
            await self._run_consolidation_pipeline(
                turns=turns,
                user_id=session.user_id,
                app_name=session.app_name,
                thread_id=thread_id,
                new_memory_ids=new_memory_ids,
            )
        except Exception as exc:
            logger.warning("consolidation_pipeline_stage_failed", error=str(exc))

        logger.info(
            "consolidate_completed",
            user_id=session.user_id,
            segments_total=len(segments),
            segments_stored=stored_count,
            segments_skipped=len(segments) - stored_count,
        )

    # ------------------------------------------------------------------
    # 巩固管线辅助方法
    # ------------------------------------------------------------------

    @staticmethod
    async def _try_acquire_advisory_lock(db: Any, thread_id: uuid.UUID | None) -> bool:
        """获取事务级 Advisory Lock 防止并发巩固

        使用 pg_try_advisory_xact_lock(int4, int4) 双参数形式，
        将 UUID 高 64 位拆为两个 32 位整数，避免超出 int64 范围。
        锁随事务结束自动释放。
        """
        if thread_id is None:
            return True
        high64 = thread_id.int >> 64
        key1 = (high64 >> 32) & 0xFFFFFFFF
        key2 = high64 & 0xFFFFFFFF
        # int4 是有符号 32 位，需将无符号值转换为 [-2^31, 2^31-1]
        if key1 >= 0x80000000:
            key1 -= 0x100000000
        if key2 >= 0x80000000:
            key2 -= 0x100000000
        result = await db.execute(
            text("SELECT pg_try_advisory_xact_lock(:key1, :key2)"),
            {"key1": key1, "key2": key2},
        )
        return bool(result.scalar())

    async def _retry_embedding(self, content: str, segment_idx: int) -> list[float] | None:
        """Embedding 指数退避重试（Circuit Breaker 模式<sup>[[44]](#ref44)</sup>）

        最多重试 _EMBEDDING_MAX_RETRIES 次，指数等待（1s → 2s → 4s）。
        最终失败返回 None，由调用方决定是否跳过该段。
        """
        if not self._embedding_fn:
            return None
        for attempt in range(_EMBEDDING_MAX_RETRIES):
            try:
                return await self._embedding_fn(content)
            except Exception as exc:
                if attempt < _EMBEDDING_MAX_RETRIES - 1:
                    wait = 2**attempt
                    logger.warning(
                        "consolidate_embedding_retry",
                        segment=segment_idx,
                        attempt=attempt + 1,
                        wait=wait,
                        error=str(exc),
                    )
                    await asyncio.sleep(wait)
        logger.error("consolidate_embedding_exhausted", segment=segment_idx)
        return None

    async def _run_consolidation_pipeline(
        self,
        *,
        turns: list[dict[str, str]],
        user_id: str,
        app_name: str,
        thread_id: uuid.UUID | None,
        new_memory_ids: list[uuid.UUID],
    ) -> None:
        """Phase 5 F3 — 调度 ConsolidationPipeline；默认 steps 与 Phase 4 等价。

        按 ``settings.memory.consolidation.legacy=true`` 回退到旧路径
        （硬编码 ``_extract_and_store_facts`` + ``_auto_link_stored_memories``），
        以便在异常排障期一键关闭新管线。
        """
        try:
            from negentropy.config import settings as global_settings

            legacy = global_settings.memory.consolidation.legacy
            policy = global_settings.memory.consolidation.policy
            timeout_ms = global_settings.memory.consolidation.timeout_per_step_ms
            step_names = list(global_settings.memory.consolidation.steps)
        except Exception as exc:
            logger.debug("consolidation_settings_missing_fallback_legacy", error=str(exc))
            legacy = True
            policy = "serial"
            timeout_ms = 30000
            step_names = []

        if legacy:
            await self._legacy_post_consolidate(
                turns=turns,
                user_id=user_id,
                app_name=app_name,
                thread_id=thread_id,
                new_memory_ids=new_memory_ids,
            )
            return

        from negentropy.engine.consolidation.pipeline import (
            PipelineContext,
            build_pipeline,
        )
        from negentropy.engine.consolidation.pipeline import steps as _builtin_steps  # noqa: F401  -- 触发注册

        try:
            pipeline = build_pipeline(
                step_names,
                policy=policy,
                timeout_per_step_ms=timeout_ms,
                strict=False,
            )
        except Exception as exc:
            logger.warning("consolidation_pipeline_build_failed_legacy", error=str(exc))
            await self._legacy_post_consolidate(
                turns=turns,
                user_id=user_id,
                app_name=app_name,
                thread_id=thread_id,
                new_memory_ids=new_memory_ids,
            )
            return

        ctx = PipelineContext(
            user_id=user_id,
            app_name=app_name,
            thread_id=thread_id,
            turns=list(turns),
            new_memory_ids=list(new_memory_ids),
            embedding_fn=self._embedding_fn,
        )
        results = await pipeline.run(ctx)
        logger.info(
            "consolidation_pipeline_completed",
            user_id=user_id,
            steps=[r.step_name for r in results],
            statuses=[r.status for r in results],
            durations_ms=[r.duration_ms for r in results],
            outputs=[r.output_count for r in results],
        )

    async def _legacy_post_consolidate(
        self,
        *,
        turns: list[dict[str, str]],
        user_id: str,
        app_name: str,
        thread_id: uuid.UUID | None,
        new_memory_ids: list[uuid.UUID],
    ) -> None:
        """Phase 4 兼容路径：硬编码 fact_extract + auto_link。"""
        try:
            await self._extract_and_store_facts(
                turns=turns,
                user_id=user_id,
                app_name=app_name,
                thread_id=thread_id,
            )
        except Exception as exc:
            logger.warning("fact_extraction_stage_failed", error=str(exc))

        try:
            await self._auto_link_stored_memories(
                user_id=user_id,
                app_name=app_name,
                thread_id=thread_id,
                memory_ids=new_memory_ids,
            )
        except Exception as exc:
            logger.debug("auto_link_stage_failed", error=str(exc))

    async def _extract_and_store_facts(
        self,
        *,
        turns: list[dict[str, str]],
        user_id: str,
        app_name: str,
        thread_id: uuid.UUID | None,
    ) -> None:
        """从对话轮次中提取结构化事实并存储

        使用 PatternFactExtractor 做模式匹配提取，
        通过 FactService.upsert_fact 存储（利用唯一约束做 upsert）。

        注意：FactService 内部管理独立 session，事实写入不参与主事务。
        """
        from negentropy.engine.factories.memory import get_fact_service

        extracted = self._fact_extractor.extract(turns)
        if not extracted:
            return

        fact_service = get_fact_service(embedding_fn=self._embedding_fn)
        for fact in extracted:
            try:
                await fact_service.upsert_fact(
                    user_id=user_id,
                    app_name=app_name,
                    fact_type=fact.fact_type,
                    key=fact.key[:255],
                    value={"text": fact.value},
                    confidence=fact.confidence,
                    thread_id=thread_id,
                )
            except Exception as exc:
                logger.warning(
                    "fact_upsert_failed",
                    key=fact.key[:50],
                    error=str(exc),
                )

        logger.info(
            "facts_extracted_and_stored",
            user_id=user_id,
            facts_count=len(extracted),
        )

    async def _auto_link_stored_memories(
        self,
        *,
        user_id: str,
        app_name: str,
        thread_id: uuid.UUID | None,
        memory_ids: list[uuid.UUID],
    ) -> None:
        """巩固后自动为本次新建的记忆建立关联"""
        if not memory_ids:
            return

        from negentropy.engine.factories.memory import get_association_service

        association_service = get_association_service()

        async with db_session.AsyncSessionLocal() as db:
            stmt = select(Memory).where(Memory.id.in_(memory_ids))
            result = await db.execute(stmt)
            new_memories = result.scalars().all()

        for m in new_memories:
            try:
                await association_service.auto_link_memory(
                    memory_id=m.id,
                    user_id=user_id,
                    app_name=app_name,
                    thread_id=m.thread_id,
                    embedding=m.embedding,
                    created_at=m.created_at,
                )
            except Exception:
                pass

    @staticmethod
    def _extract_speaker_turns(events: list[Any]) -> list[dict[str, str]]:
        """从 ADK Event 列表中提取 speaker turn 对

        Returns:
            [{"author": "user", "text": "..."}, ...]
        """
        turns: list[dict[str, str]] = []
        for event in events:
            if not hasattr(event, "author") or event.author not in ("user", "model", "assistant"):
                continue
            if not hasattr(event, "content") or not event.content:
                continue

            text_parts: list[str] = []
            if hasattr(event.content, "parts"):
                for part in event.content.parts:
                    if hasattr(part, "text") and part.text:
                        text_parts.append(part.text)
            elif isinstance(event.content, dict) and "parts" in event.content:
                for part in event.content["parts"]:
                    if isinstance(part, dict) and "text" in part:
                        text_parts.append(part["text"])
            elif isinstance(event.content, str):
                text_parts.append(event.content)

            for t in text_parts:
                if t.strip():
                    turns.append({"author": event.author, "text": t.strip()})
        return turns

    @staticmethod
    def _group_turns_into_segments(turns: list[dict[str, str]]) -> list[list[dict[str, str]]]:
        """将 turns 按 _MAX_TURN_PAIRS_PER_SEGMENT 分组

        每个 segment 包含连续的 user+model 对话轮次，
        保留对话上下文连贯性。
        """
        if not turns:
            return []
        segments: list[list[dict[str, str]]] = []
        for i in range(0, len(turns), _MAX_TURN_PAIRS_PER_SEGMENT):
            segments.append(turns[i : i + _MAX_TURN_PAIRS_PER_SEGMENT])
        return segments

    @staticmethod
    def _format_segment_content(segment: list[dict[str, str]]) -> str:
        """将一个 segment 的 turns 格式化为可搜索的文本"""
        lines: list[str] = []
        for turn in segment:
            author = "User" if turn["author"] == "user" else "Assistant"
            lines.append(f"[{author}] {turn['text']}")
        return "\n".join(lines)

    @staticmethod
    def _parse_thread_id(session_id: str | None) -> uuid.UUID | None:
        """安全解析 session ID 为 UUID"""
        if not session_id:
            return None
        try:
            return uuid.UUID(session_id)
        except ValueError:
            return None

    async def _is_duplicate(
        self,
        *,
        db: Any | None = None,
        user_id: str,
        app_name: str,
        embedding: list[float],
        content: str = "",
    ) -> bool:
        """检测是否与用户现有记忆重复（Orient 阶段）

        两阶段去重策略<sup>[[40]](#ref40)</sup>：
        1. Cosine similarity ≥ 0.85 → 直接判定为重复
        2. Cosine similarity ∈ [0.80, 0.85) → Jaccard 词重叠二次校验<sup>[[37]](#ref37)</sup>

        Args:
            db: 外部 session（复用事务），None 时自行创建。
        """
        if db is not None:
            return await self._check_duplicate(db, user_id, app_name, embedding, content)

        async with db_session.AsyncSessionLocal() as db:
            return await self._check_duplicate(db, user_id, app_name, embedding, content)

    async def _check_duplicate(
        self,
        db: Any,
        user_id: str,
        app_name: str,
        embedding: list[float],
        content: str,
    ) -> bool:
        distance = Memory.embedding.op("<=>")(embedding)
        stmt = (
            select(Memory.id, Memory.content, distance.label("dist"))
            .where(
                Memory.user_id == user_id,
                Memory.app_name == app_name,
                Memory.embedding.is_not(None),
            )
            .order_by(distance.asc())
            .limit(1)
        )
        result = await db.execute(stmt)
        row = result.first()
        if row is None:
            return False
        similarity = 1.0 - float(row.dist)
        if similarity >= _DEDUP_SIMILARITY_THRESHOLD:
            return True
        if similarity >= 0.80 and content and row.content:
            words_new = set(content.lower().split())
            words_old = set(row.content.lower().split())
            if words_new and words_old:
                jaccard = len(words_new & words_old) / len(words_new | words_old)
                if jaccard >= _DEDUP_JACCARD_THRESHOLD:
                    return True
        return False

    @staticmethod
    def _calculate_initial_retention(
        content: str,
        memory_type: str = "episodic",
        has_facts: bool = False,
    ) -> float:
        """多因子初始保留分数

        因子：
        1. 信息密度（unique word ratio）
        2. 内容长度（50 词基准）
        3. 记忆类型乘子（偏好 > 流程 > 事实 > 情景）
        4. 事实支撑加成（有提取事实的记忆更重要）

        参考 ACT-R<sup>[[45]](#ref45)</sup> 基础激活水平与
        FadeMem<sup>[[46]](#ref46)</sup> 多因子衰减。
        """
        words = content.split()
        if not words:
            return 0.5
        unique_ratio = len(set(w.lower() for w in words)) / len(words)
        length_factor = min(1.0, len(words) / 50.0)
        density_factor = 0.5 + 0.5 * unique_ratio
        type_factor = _MEMORY_TYPE_MULTIPLIER.get(memory_type, 1.0)
        fact_boost = 0.1 if has_facts else 0.0
        raw_score = _INITIAL_RETENTION_BASE * density_factor + length_factor * 0.2
        raw_score *= type_factor
        raw_score += fact_boost
        return min(1.0, raw_score)

    @staticmethod
    def _calculate_initial_importance(
        memory_type: str = "episodic",
    ) -> float:
        """初始重要性评分

        新建记忆时基于类型计算初始 importance_score。
        后续由 _record_access 和自动化任务动态更新。
        """
        governance = MemoryGovernanceService()
        return governance.calculate_importance_score(
            access_count=0,
            memory_type=memory_type,
            related_fact_count=0,
            days_since_creation=0.0,
            days_since_last_access=0.0,
        )

    async def search_memory(
        self,
        *,
        app_name: str,
        user_id: str,
        query: str,
        limit: int = _DEFAULT_SEARCH_LIMIT,
        offset: int = 0,
        memory_type: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> SearchMemoryResponse:
        """基于 Query 检索相关记忆

        检索策略（按优先级）:
        1. Hybrid Search: 语义 + BM25 融合检索（需要 embedding_fn）
        2. BM25 全文检索: 利用 search_vector GIN 索引
        3. ilike 回退: 当 search_vector 不可用时的最终回退

        检索完成后异步更新被召回记忆的 access_count 和 last_accessed_at，
        驱动艾宾浩斯遗忘曲线动态生效。<sup>[1]</sup>

        Args:
            app_name: 应用名称
            user_id: 用户 ID
            query: 搜索查询
            limit: 返回数量限制
            offset: 分页偏移量
            memory_type: 记忆类型过滤（如 "episodic"）
            date_from: 起始日期过滤
            date_to: 截止日期过滤
        """
        # 生成查询向量
        query_embedding = None
        if self._embedding_fn:
            try:
                query_embedding = await self._embedding_fn(query)
            except Exception as exc:
                logger.warning(
                    "memory_search_embedding_failed",
                    query=query[:100],
                    error=str(exc),
                )

        memories_data: list[dict[str, Any]] = []

        if query_embedding is not None:
            # 策略 1: 尝试 DB 原生 hybrid_search()
            try:
                result = await self._hybrid_search_native(
                    app_name=app_name,
                    user_id=user_id,
                    query=query,
                    query_embedding=query_embedding,
                    limit=limit,
                    offset=offset,
                )
                if result is not None:
                    memories_data = self._tag_search_level(result, "hybrid", "combined")
                    for m in memories_data:
                        m["relevance_score"] = min(1.0, max(0.0, m.get("relevance_score", 0.0)))
                    # Phase 5 F1：可选 HippoRAG PPR 通道与 Hybrid 结果用 RRF 融合
                    memories_data = await self._maybe_fuse_ppr(
                        hybrid_results=memories_data,
                        query=query,
                        query_embedding=query_embedding,
                        user_id=user_id,
                        app_name=app_name,
                        limit=limit,
                    )
                    # Phase 4 Review fix：主路径同样应用 query intent 类型加权重排
                    memories_data = self._apply_intent_rerank(memories_data, query)
                    await self._record_access(memories_data, query=query, user_id=user_id, app_name=app_name)
                    self._log_search_event("hybrid", len(memories_data), user_id, app_name, query)
                    return self._build_search_response(memories_data)
            except Exception as exc:
                self._log_fallback_event("hybrid", "vector", str(exc), user_id, app_name, query)

            # 策略 2: 回退到纯向量检索
            memories_data = await self._vector_search(
                app_name=app_name,
                user_id=user_id,
                query_embedding=query_embedding,
                limit=limit,
                offset=offset,
                memory_type=memory_type,
                date_from=date_from,
                date_to=date_to,
            )
            # 先标记 raw_score（保留原始分数），再 clamp 到 [0, 1]
            memories_data = self._tag_search_level(memories_data, "vector", "cosine_distance")
            for m in memories_data:
                m["relevance_score"] = min(1.0, max(0.0, m.get("relevance_score", 0.0)))
            # Phase 4：query intent 类型加权重排
            memories_data = self._apply_intent_rerank(memories_data, query)
            await self._record_access(memories_data, query=query, user_id=user_id, app_name=app_name)
            self._log_search_event("vector", len(memories_data), user_id, app_name, query)
            return self._build_search_response(memories_data)

        # 策略 3: BM25 全文检索
        try:
            memories_data = await self._keyword_search(
                app_name=app_name,
                user_id=user_id,
                query=query,
                limit=limit,
                offset=offset,
            )
            if memories_data:
                # 先标记 raw_score（保留原始 ts_rank），再 clamp 到 [0, 1]
                memories_data = self._tag_search_level(memories_data, "keyword", "ts_rank")
                for m in memories_data:
                    m["relevance_score"] = min(1.0, max(0.0, m.get("relevance_score", 0.0)))
                # Phase 4 Review fix：主路径同样应用 query intent 类型加权重排
                memories_data = self._apply_intent_rerank(memories_data, query)
                await self._record_access(memories_data, query=query, user_id=user_id, app_name=app_name)
                self._log_search_event("keyword", len(memories_data), user_id, app_name, query)
                return self._build_search_response(memories_data)
        except Exception as exc:
            self._log_fallback_event("keyword", "ilike", str(exc), user_id, app_name, query)

        # 策略 4: ilike 回退
        memories_data = await self._ilike_search(
            app_name=app_name,
            user_id=user_id,
            query=query,
            limit=limit,
            offset=offset,
            memory_type=memory_type,
            date_from=date_from,
            date_to=date_to,
        )
        memories_data = self._tag_search_level(memories_data, "ilike", "retention_proxy")
        # Phase 4：query intent 类型加权重排
        memories_data = self._apply_intent_rerank(memories_data, query)
        await self._record_access(memories_data, query=query, user_id=user_id, app_name=app_name)
        self._log_search_event("ilike", len(memories_data), user_id, app_name, query)
        return self._build_search_response(memories_data)

    # ------------------------------------------------------------------
    # Phase 5 F1 — HippoRAG PPR-Boosted Hybrid 检索
    # ------------------------------------------------------------------

    async def _maybe_fuse_ppr(
        self,
        *,
        hybrid_results: list[dict[str, Any]],
        query: str,
        query_embedding: list[float] | None,
        user_id: str,
        app_name: str,
        limit: int,
    ) -> list[dict[str, Any]]:
        """启用 PPR 通道时与 Hybrid 结果做 RRF 融合，否则原样返回。"""
        try:
            from negentropy.config import settings as global_settings

            cfg = global_settings.memory.hipporag
            if not cfg.enabled:
                return hybrid_results
            if cfg.gray_users and user_id not in cfg.gray_users:
                return hybrid_results
        except Exception:
            return hybrid_results

        # 启动期门控：KG 关联数过低直接 short-circuit
        try:
            from negentropy.engine.factories.memory import get_association_service

            assoc = get_association_service()
            assoc_count = await assoc.count_kg_associations(user_id=user_id, app_name=app_name)
            if assoc_count < cfg.min_kg_associations:
                return hybrid_results
        except Exception as exc:
            logger.debug("ppr_kg_count_failed", error=str(exc))
            return hybrid_results

        try:
            ppr_results = await asyncio.wait_for(
                self._ppr_search(
                    query=query,
                    query_embedding=query_embedding,
                    user_id=user_id,
                    app_name=app_name,
                    cfg=cfg,
                    limit=limit,
                ),
                timeout=max(0.05, cfg.timeout_ms / 1000.0),
            )
        except TimeoutError:
            self._log_fallback_event("ppr", "hybrid", "timeout", user_id, app_name, query)
            return hybrid_results
        except Exception as exc:
            self._log_fallback_event("ppr", "hybrid", str(exc), user_id, app_name, query)
            return hybrid_results

        if not ppr_results:
            return hybrid_results

        return self._rrf_fuse(
            channels={"hybrid": hybrid_results, "ppr": ppr_results},
            k=cfg.rrf_k,
            limit=limit,
        )

    async def _ppr_search(
        self,
        *,
        query: str,
        query_embedding: list[float] | None,
        user_id: str,
        app_name: str,
        cfg: Any,
        limit: int,
    ) -> list[dict[str, Any]]:
        """执行 PPR 通道：种子链接 → 加权扩散 → 反查 memory_ids。"""
        if query_embedding is None:
            return []
        seeds = await self._link_seed_entities(
            query_embedding=query_embedding,
            app_name=app_name,
            top_k=cfg.seed_top_k,
            threshold=cfg.seed_threshold,
        )
        if not seeds:
            return []

        from negentropy.engine.factories.memory import get_association_service

        assoc = get_association_service()
        entity_scores = await assoc.expand_via_ppr(
            seeds=seeds,
            depth=cfg.depth,
            alpha=cfg.alpha,
            top_k=max(50, limit * 5),
        )
        if not entity_scores:
            return []

        memory_rows = await assoc.memories_for_entity_scores(
            entity_scores=entity_scores,
            user_id=user_id,
            app_name=app_name,
            limit=max(50, limit * 5),
        )
        if not memory_rows:
            return []

        # 用 memory_ids 拉取 content + metadata + memory_type 以便后续 intent_rerank
        ids = [uuid.UUID(m["memory_id"]) for m in memory_rows if m.get("memory_id")]
        if not ids:
            return []
        async with db_session.AsyncSessionLocal() as db:
            stmt = select(Memory.id, Memory.content, Memory.metadata_, Memory.memory_type).where(Memory.id.in_(ids))
            result = await db.execute(stmt)
            rows = {str(r.id): r for r in result.fetchall()}

        merged: list[dict[str, Any]] = []
        for r in memory_rows:
            mid = r["memory_id"]
            row = rows.get(mid)
            if row is None:
                continue
            score = float(r.get("ppr_score", 0.0))
            merged.append(
                {
                    "id": mid,
                    "content": row.content,
                    "metadata": row.metadata_ or {},
                    "memory_type": row.memory_type,
                    "relevance_score": min(1.0, max(0.0, score)),
                    "search_level": "ppr",
                    "score_type": "ppr_score",
                    "raw_score": score,
                }
            )
        return merged[: limit * 5]

    async def _link_seed_entities(
        self,
        *,
        query_embedding: list[float],
        app_name: str,
        top_k: int,
        threshold: float,
    ) -> list[uuid.UUID]:
        """通过 KG entity embedding cosine top-K 拿种子节点。"""
        embedding_str = "[" + ",".join(f"{x:.7g}" for x in query_embedding) + "]"
        max_distance = max(0.0, 1.0 - threshold)
        sql = text(
            f"""
            SELECT id, (embedding <=> CAST(:embedding AS vector)) AS distance
            FROM {NEGENTROPY_SCHEMA}.kg_entities
            WHERE is_active IS TRUE
              AND app_name = :app_name
              AND embedding IS NOT NULL
            ORDER BY embedding <=> CAST(:embedding AS vector) ASC
            LIMIT :top_k
            """
        )
        try:
            async with db_session.AsyncSessionLocal() as db:
                result = await db.execute(
                    sql,
                    {
                        "embedding": embedding_str,
                        "app_name": app_name,
                        "top_k": top_k,
                    },
                )
                rows = result.fetchall()
        except Exception as exc:
            logger.debug("ppr_seed_link_failed", error=str(exc))
            return []
        seeds: list[uuid.UUID] = []
        for row in rows:
            if float(row.distance or 1.0) <= max_distance:
                seeds.append(row.id)
        return seeds

    @staticmethod
    def _rrf_fuse(
        *,
        channels: dict[str, list[dict[str, Any]]],
        k: int,
        limit: int,
    ) -> list[dict[str, Any]]:
        """Reciprocal Rank Fusion<sup>[Cormack 2009]</sup>。

        score(d) = Σ 1 / (k + rank_in_channel_i)；保留首次见到的 metadata，新增
        ``metadata.fusion`` 字段记录每个通道的 rank 与最终 RRF 分数。
        """
        order: list[str] = []
        seen: dict[str, dict[str, Any]] = {}
        rrf_scores: dict[str, float] = {}
        per_channel_rank: dict[str, dict[str, int]] = {}

        for ch_name, items in channels.items():
            channel_rank: dict[str, int] = {}
            for rank, item in enumerate(items, 1):
                doc_id = str(item.get("id"))
                if not doc_id:
                    continue
                channel_rank[doc_id] = rank
                rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + 1.0 / (k + rank)
                if doc_id not in seen:
                    seen[doc_id] = dict(item)
                    order.append(doc_id)
            per_channel_rank[ch_name] = channel_rank

        merged: list[dict[str, Any]] = []
        for doc_id in order:
            entry = seen[doc_id]
            entry["search_level"] = (
                "ppr+hybrid"
                if all(doc_id in per_channel_rank.get(ch, {}) for ch in channels)
                else entry.get("search_level", "hybrid")
            )
            entry["relevance_score"] = min(1.0, rrf_scores[doc_id])
            metadata = dict(entry.get("metadata") or {})
            metadata["fusion"] = {
                "channels": {ch: per_channel_rank[ch].get(doc_id) for ch in channels},
                "rrf_score": rrf_scores[doc_id],
                "rrf_k": k,
            }
            entry["metadata"] = metadata
            merged.append(entry)

        merged.sort(key=lambda e: rrf_scores.get(str(e.get("id")), 0.0), reverse=True)
        return merged[:limit]

    async def _hybrid_search_native(
        self,
        *,
        app_name: str,
        user_id: str,
        query: str,
        query_embedding: list[float],
        limit: int = _DEFAULT_SEARCH_LIMIT,
        offset: int = 0,
    ) -> list[dict[str, Any]] | None:
        """调用 DB 原生 hybrid_search() 函数

        利用 perception_schema.sql 中定义的 hybrid_search() 函数，
        在一次 SQL 调用中完成语义 + BM25 融合检索。

        注意：使用 schema 前缀 `{NEGENTROPY_SCHEMA}` 确保与 ORM 一致，
        embedding 参数通过参数化绑定避免注入风险。

        Returns:
            检索结果列表，失败返回 None
        """
        # Review fix #3：JOIN memories 表把 memory_type 透出，主路径才能命中 intent 重排。
        # Review fix #4：内部 LIMIT 加 buffer 抵消 WHERE 软删除过滤导致的丢条；
        # Python 端按非删除计数二次截断。
        oversample_limit = (limit + offset) * 2 + 10
        sql = text(f"""
            SELECT h.id, h.content, h.semantic_score, h.keyword_score, h.combined_score,
                   h.metadata, m.memory_type
            FROM {NEGENTROPY_SCHEMA}.hybrid_search(
                :user_id, :app_name, :query, :embedding::vector(1536),
                :limit, :semantic_weight, :keyword_weight
            ) AS h
            JOIN {NEGENTROPY_SCHEMA}.memories AS m ON m.id = h.id
            WHERE COALESCE(h.metadata->>'deleted', 'false') <> 'true'
        """)

        async with db_session.AsyncSessionLocal() as db:
            result = await db.execute(
                sql,
                {
                    "user_id": user_id,
                    "app_name": app_name,
                    "query": query,
                    "embedding": query_embedding,
                    "limit": oversample_limit,
                    "semantic_weight": _DEFAULT_SEMANTIC_WEIGHT,
                    "keyword_weight": _DEFAULT_KEYWORD_WEIGHT,
                },
            )
            rows = result.fetchall()

        if not rows:
            return []

        # Review fix #4：先做 offset，再截到 limit，避免 over-fetch 导致单页过大。
        rows = rows[offset : offset + limit]

        logger.info(
            "hybrid_search_completed",
            user_id=user_id,
            query=query[:100],
            result_count=len(rows),
        )

        return [
            {
                "id": str(row.id),
                "content": row.content,
                "metadata": row.metadata or {},
                "relevance_score": float(row.combined_score),
                "memory_type": row.memory_type,
            }
            for row in rows
        ]

    async def _vector_search(
        self,
        *,
        app_name: str,
        user_id: str,
        query_embedding: list[float],
        limit: int = _DEFAULT_SEARCH_LIMIT,
        offset: int = 0,
        memory_type: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> list[dict[str, Any]]:
        """纯向量相似度检索"""
        async with db_session.AsyncSessionLocal() as db:
            distance = Memory.embedding.op("<=>")(query_embedding)
            conditions = [
                Memory.app_name == app_name,
                Memory.user_id == user_id,
                Memory.embedding.is_not(None),
                self._not_deleted_condition(),
            ]
            if memory_type:
                conditions.append(Memory.memory_type == memory_type)
            if date_from:
                conditions.append(Memory.created_at >= date_from)
            if date_to:
                conditions.append(Memory.created_at <= date_to)

            stmt = select(Memory).where(*conditions).order_by(distance.asc()).offset(offset).limit(limit)
            result = await db.execute(stmt)
            memories_orms = result.scalars().all()

        return [
            {
                "id": str(m.id),
                "content": m.content,
                "metadata": m.metadata_ or {},
                "relevance_score": m.retention_score,
                "created_at": m.created_at,
                "memory_type": m.memory_type,
            }
            for m in memories_orms
        ]

    async def _keyword_search(
        self,
        *,
        app_name: str,
        user_id: str,
        query: str,
        limit: int = _DEFAULT_SEARCH_LIMIT,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """BM25 全文检索

        利用 memories.search_vector GIN 索引进行高效全文搜索。
        """
        # Review fix #3：透出 memory_type 让 _apply_intent_rerank 可命中。
        sql = text(f"""
            SELECT id, content, metadata, retention_score, created_at, memory_type,
                   ts_rank_cd(search_vector, plainto_tsquery('english', :query)) AS rank_score
            FROM {NEGENTROPY_SCHEMA}.memories
            WHERE user_id = :user_id
              AND app_name = :app_name
              AND COALESCE(metadata->>'deleted', 'false') <> 'true'
              AND search_vector @@ plainto_tsquery('english', :query)
            ORDER BY rank_score DESC
            LIMIT :limit OFFSET :offset
        """)

        async with db_session.AsyncSessionLocal() as db:
            result = await db.execute(
                sql,
                {
                    "user_id": user_id,
                    "app_name": app_name,
                    "query": query,
                    "limit": limit,
                    "offset": offset,
                },
            )
            rows = result.fetchall()

        return [
            {
                "id": str(row.id),
                "content": row.content,
                "metadata": row.metadata or {},
                "relevance_score": float(row.rank_score) if row.rank_score else 0.0,
                "created_at": row.created_at,
                "memory_type": row.memory_type,
            }
            for row in rows
        ]

    async def _ilike_search(
        self,
        *,
        app_name: str,
        user_id: str,
        query: str,
        limit: int = _DEFAULT_SEARCH_LIMIT,
        offset: int = 0,
        memory_type: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> list[dict[str, Any]]:
        """ilike 模糊搜索回退

        当 search_vector 不可用时的最终回退方案。
        注意: 转义 LIKE 通配符 (% _) 防止用户操纵匹配模式。
        """
        # 转义 LIKE 特殊字符，防止通配符注入
        escaped_query = re.sub(r"([%_])", r"\\\1", query)
        async with db_session.AsyncSessionLocal() as db:
            conditions = [
                Memory.app_name == app_name,
                Memory.user_id == user_id,
                Memory.content.ilike(f"%{escaped_query}%"),
                self._not_deleted_condition(),
            ]
            if memory_type:
                conditions.append(Memory.memory_type == memory_type)
            if date_from:
                conditions.append(Memory.created_at >= date_from)
            if date_to:
                conditions.append(Memory.created_at <= date_to)

            stmt = select(Memory).where(*conditions).order_by(Memory.created_at.desc()).offset(offset).limit(limit)
            result = await db.execute(stmt)
            memories_orms = result.scalars().all()

        return [
            {
                "id": str(m.id),
                "content": m.content,
                "metadata": m.metadata_ or {},
                "relevance_score": m.retention_score,
                "created_at": m.created_at,
                "memory_type": m.memory_type,
            }
            for m in memories_orms
        ]

    # ------------------------------------------------------------------
    # 搜索可观测性辅助方法
    # ------------------------------------------------------------------

    @staticmethod
    def _not_deleted_condition():
        """SQLAlchemy 条件：软删除记忆不参与任何检索路径。"""
        return Memory.metadata_["deleted"].astext.is_distinct_from("true")

    @staticmethod
    def _apply_intent_rerank(
        results: list[dict[str, Any]],
        query: str,
    ) -> list[dict[str, Any]]:
        """Phase 4 — 基于 query intent 的轻量类型加权（仅作用于已排序结果）

        当 result['memory_type'] == intent.primary 时 +10% 分；
        命中 intent.boost_types 中的类型时 +3% 分。
        分数 clamp 到 [0, 1]，并在 metadata 中记录 intent。
        """
        if not query or not results:
            return results
        intent = classify_intent(query)
        if intent.confidence < 0.3:
            return results
        for r in results:
            mt = r.get("memory_type")
            base = float(r.get("relevance_score", 0.0))
            if mt == intent.primary:
                boost = 0.15
            elif mt in intent.boost_types:
                boost = 0.03
            else:
                boost = 0.0
            r["relevance_score"] = min(1.0, max(0.0, base * (1.0 + boost)))
            r.setdefault("metadata", {})
            r["metadata"]["intent_primary"] = intent.primary
            r["metadata"]["intent_boost_applied"] = boost
        # 重新按分数排序
        results.sort(key=lambda x: float(x.get("relevance_score", 0.0)), reverse=True)
        return results

    @staticmethod
    def _tag_search_level(
        results: list[dict[str, Any]],
        level: str,
        score_type: str,
    ) -> list[dict[str, Any]]:
        """为搜索结果标记 search_level 和 score_type 元数据

        search_level: hybrid | vector | keyword | ilike
        score_type: combined | cosine_distance | ts_rank | retention_proxy
        raw_score: 保留原始分数用于下游比较
        """
        for r in results:
            r["search_level"] = level
            r["score_type"] = score_type
            r["raw_score"] = r.get("relevance_score", 0.0)
        return results

    @staticmethod
    def _log_search_event(
        level: str,
        result_count: int,
        user_id: str,
        app_name: str,
        query: str,
    ) -> None:
        """搜索完成事件日志（用于检索质量可观测性）"""
        logger.info(
            "search_completed",
            search_level=level,
            result_count=result_count,
            user_id=user_id,
            app_name=app_name,
            query_length=len(query),
        )

    @staticmethod
    def _log_fallback_event(
        from_level: str,
        to_level: str,
        error: str,
        user_id: str,
        app_name: str,
        query: str,
    ) -> None:
        """搜索回退事件日志（用于监控回退频率）"""
        logger.warning(
            "search_fallback",
            from_level=from_level,
            to_level=to_level,
            error=error[:200],
            user_id=user_id,
            app_name=app_name,
            query_length=len(query),
        )

    async def _record_access(
        self,
        memories_data: list[dict[str, Any]],
        *,
        query: str = "",
        user_id: str = "",
        app_name: str = "",
    ) -> uuid.UUID | None:
        """记录记忆访问行为

        批量更新被召回记忆的 access_count 和 last_accessed_at，
        驱动艾宾浩斯遗忘曲线动态生效。<sup>[1]</sup>

        Args:
            memories_data: 被召回的记忆数据列表
            query: 原始检索查询文本（用于检索效果追踪）
            user_id: 用户 ID（用于检索效果追踪）
            app_name: 应用名称（用于检索效果追踪）

        Returns:
            检索日志 ID（用于显式传递给上下文组装器的反馈闭环）

        使用批量 UPDATE 避免 N+1 问题。
        """
        if not memories_data:
            return None

        memory_ids = [uuid.UUID(m["id"]) for m in memories_data if m.get("id")]
        if not memory_ids:
            return None

        try:
            async with db_session.AsyncSessionLocal() as db:
                now = datetime.now(UTC)
                # 批量更新 access_count、last_accessed_at 和 importance_score
                stmt = (
                    update(Memory)
                    .where(Memory.id.in_(memory_ids))
                    .values(
                        access_count=Memory.access_count + 1,
                        last_accessed_at=now,
                        importance_score=func.least(1.0, Memory.importance_score + 0.02),
                    )
                )
                await db.execute(stmt)
                await db.commit()

            logger.debug(
                "memory_access_recorded",
                memory_count=len(memory_ids),
            )

            # 异步记录检索事件（fire-and-forget，不影响主路径）
            try:
                from negentropy.engine.adapters.postgres.retrieval_tracker import RetrievalTracker

                tracker = RetrievalTracker()
                log_id = await tracker.log_retrieval(
                    user_id=user_id,
                    app_name=app_name,
                    query=query,
                    memory_ids=memory_ids,
                )
                return log_id
            except Exception as exc:
                logger.debug("retrieval_tracking_failed", error=str(exc))
        except Exception as exc:
            # 访问记录失败不应影响检索结果返回
            logger.warning(
                "memory_access_record_failed",
                memory_count=len(memory_ids),
                error=str(exc),
            )

    def _build_search_response(self, memories_data: list[dict[str, Any]]) -> SearchMemoryResponse:
        """构建 ADK SearchMemoryResponse（携带 search_level 元数据）"""
        memories = []
        for m in memories_data:
            content_val = {"parts": [{"text": m["content"]}]}
            created_at = m.get("created_at")
            timestamp = created_at.isoformat() if created_at else datetime.now(UTC).isoformat()

            # 传播搜索质量元数据
            metadata = dict(m.get("metadata") or {})
            metadata["search_level"] = m.get("search_level", "unknown")
            metadata["score_type"] = m.get("score_type", "unknown")
            metadata["raw_score"] = m.get("raw_score", 0.0)
            metadata["relevance_score"] = float(m.get("relevance_score", 0.0) or 0.0)
            if m.get("memory_type") is not None:
                metadata["memory_type"] = m.get("memory_type")

            memories.append(
                MemoryEntry(
                    id=m["id"],
                    content=content_val,
                    author="system",
                    timestamp=timestamp,
                    custom_metadata=metadata,
                )
            )

        return SearchMemoryResponse(memories=memories)

    async def add_memory_typed(
        self,
        *,
        user_id: str,
        app_name: str,
        thread_id: str | uuid.UUID | None,
        content: str,
        memory_type: str = "episodic",
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Phase 4 — 类型显式写入（用于 Self-editing Tools）。

        与 ``add_session_to_memory`` 的差异：
        - 不走巩固管线，直接落库（适合 Agent 主动 write_memory 工具调用）
        - 必须显式指定 ``memory_type``，受 VALID_MEMORY_TYPES 约束
        - 仍然计算 embedding + 初始 retention/importance，保持一致性

        Returns:
            {"id", "memory_type", "retention_score", "importance_score"}
        """
        if memory_type not in VALID_MEMORY_TYPES:
            raise ValueError(f"Invalid memory_type '{memory_type}'. Must be one of {sorted(VALID_MEMORY_TYPES)}")
        if not content or not content.strip():
            raise ValueError("content must not be empty")
        content = content.strip()

        embedding: list[float] | None = None
        if self._embedding_fn:
            try:
                embedding = await self._embedding_fn(content)
            except Exception as exc:
                logger.warning("add_memory_typed_embedding_failed", error=str(exc))

        thread_uuid = thread_id if isinstance(thread_id, uuid.UUID) else self._parse_thread_id(thread_id)

        retention = self._calculate_initial_retention(content, memory_type=memory_type)
        importance = self._calculate_initial_importance(memory_type=memory_type)
        # Phase 4: PII 占位
        pii_matches = detect_pii(content)
        pii_flags = summarize_pii_flags(pii_matches) if pii_matches else {}
        merged_metadata = dict(metadata or {"source": "self_edit"})
        if pii_flags:
            merged_metadata["pii_flags"] = pii_flags

        async with db_session.AsyncSessionLocal() as db:
            memory = Memory(
                thread_id=thread_uuid,
                user_id=user_id,
                app_name=app_name,
                memory_type=memory_type,
                content=content,
                embedding=embedding,
                retention_score=retention,
                importance_score=importance,
                metadata_=merged_metadata,
            )
            db.add(memory)
            await db.flush()
            mem_id = memory.id
            await db.commit()

        logger.info(
            "memory_typed_added",
            user_id=user_id,
            memory_type=memory_type,
            memory_id=str(mem_id),
        )
        return {
            "id": str(mem_id),
            "memory_type": memory_type,
            "retention_score": retention,
            "importance_score": importance,
        }

    async def update_memory_content(
        self,
        *,
        memory_id: str | uuid.UUID,
        user_id: str,
        app_name: str,
        new_content: str,
        reason: str | None = None,
    ) -> dict[str, Any]:
        """Phase 4 — 修订记忆内容（Self-editing Tools 支持）。

        - 必须传 user_id + app_name（多租隔离）
        - 修订时同步更新 embedding 与 metadata.update_history
        - 不更新 retention_score（避免误升）
        """
        if not new_content or not new_content.strip():
            raise ValueError("new_content must not be empty")
        new_content = new_content.strip()

        memory_uuid = memory_id if isinstance(memory_id, uuid.UUID) else uuid.UUID(str(memory_id))

        new_embedding: list[float] | None = None
        if self._embedding_fn:
            try:
                new_embedding = await self._embedding_fn(new_content)
            except Exception as exc:
                logger.warning("update_memory_embedding_failed", error=str(exc))

        async with db_session.AsyncSessionLocal() as db:
            stmt = select(Memory).where(
                Memory.id == memory_uuid,
                Memory.user_id == user_id,
                Memory.app_name == app_name,
            )
            result = await db.execute(stmt)
            memory = result.scalar_one_or_none()
            if memory is None:
                raise ValueError(f"Memory '{memory_id}' not found for user")
            old_content = memory.content
            memory.content = new_content
            if new_embedding is not None:
                memory.embedding = new_embedding
            history = list((memory.metadata_ or {}).get("update_history", []))
            history.append(
                {
                    "at": datetime.now(UTC).isoformat(),
                    "reason": reason or "self_edit",
                    "old_length": len(old_content or ""),
                }
            )
            new_meta = dict(memory.metadata_ or {})
            new_meta["update_history"] = history[-10:]  # 保留最近 10 次
            memory.metadata_ = new_meta
            await db.commit()

        logger.info(
            "memory_content_updated",
            memory_id=str(memory_uuid),
            user_id=user_id,
            reason=reason,
        )
        return {"id": str(memory_uuid), "updated_at": datetime.now(UTC).isoformat()}

    async def soft_delete_memory(
        self,
        *,
        memory_id: str | uuid.UUID,
        user_id: str,
        app_name: str,
        reason: str | None = None,
    ) -> dict[str, Any]:
        """Phase 4 — 软删除记忆（Self-editing Tools）。

        不物理删除，将 metadata.deleted=True，retention_score 强制归零，
        embedding 清空（释放向量空间），但保留行用于审计。
        """
        memory_uuid = memory_id if isinstance(memory_id, uuid.UUID) else uuid.UUID(str(memory_id))
        async with db_session.AsyncSessionLocal() as db:
            stmt = select(Memory).where(
                Memory.id == memory_uuid,
                Memory.user_id == user_id,
                Memory.app_name == app_name,
            )
            result = await db.execute(stmt)
            memory = result.scalar_one_or_none()
            if memory is None:
                raise ValueError(f"Memory '{memory_id}' not found for user")
            new_meta = dict(memory.metadata_ or {})
            new_meta["deleted"] = True
            new_meta["deleted_reason"] = reason or "self_edit"
            new_meta["deleted_at"] = datetime.now(UTC).isoformat()
            memory.metadata_ = new_meta
            memory.retention_score = 0.0
            memory.embedding = None
            await db.commit()
        logger.info("memory_soft_deleted", memory_id=str(memory_uuid), user_id=user_id, reason=reason)
        return {"id": str(memory_uuid), "deleted": True}

    async def list_memories(self, *, app_name: str, user_id: str, limit: int = 100) -> list[MemoryEntry]:
        """列出用户所有记忆"""
        async with db_session.AsyncSessionLocal() as db:
            stmt = (
                select(Memory)
                .where(Memory.app_name == app_name, Memory.user_id == user_id)
                .order_by(Memory.created_at.desc())
                .limit(limit)
            )
            result = await db.execute(stmt)
            memories_orms = result.scalars().all()

        memories = []
        for m in memories_orms:
            content_val = {"parts": [{"text": m.content}]}
            memories.append(
                MemoryEntry(
                    id=str(m.id),
                    content=content_val,
                    author="system",
                    timestamp=m.created_at.isoformat() if m.created_at else datetime.now(UTC).isoformat(),
                    relevance_score=m.retention_score,
                    custom_metadata=m.metadata_ or {},
                )
            )
        return memories
