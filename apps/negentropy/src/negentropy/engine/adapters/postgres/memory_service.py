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
from sqlalchemy import select, text, update

# ORM 模型与会话工厂
import negentropy.db.session as db_session
from negentropy.engine.consolidation.fact_extractor import PatternFactExtractor
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
_DEDUP_SIMILARITY_THRESHOLD = 0.9  # cosine similarity 去重阈值
_INITIAL_RETENTION_BASE = 0.8  # 新记忆初始保留分数基准


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
        self._fact_extractor = PatternFactExtractor()

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
        """四阶段记忆巩固管线

        阶段 1 — 分段（Segment）: 按 speaker turn 将对话拆分为多段
        阶段 2 — 去重（Orient）: 对每段生成 embedding，与现有记忆比对跳过重复
        阶段 3 — 存储（Consolidate）: 写入新记忆，附带初始 retention_score
        阶段 4 — 事实提取（Extract）: 从对话中提取结构化事实并存储

        借鉴 Claude Code AutoDream 的 Orient→Consolidate 范式。
        """
        # 阶段 1：按 speaker turn 提取并分段
        turns = self._extract_speaker_turns(session.events)
        if not turns:
            return

        segments = self._group_turns_into_segments(turns)

        thread_id = self._parse_thread_id(session.id)

        # 阶段 2+3：逐段去重后存储
        stored_count = 0
        for seg_idx, segment in enumerate(segments):
            content = self._format_segment_content(segment)

            # Orient: 生成 embedding 并检测重复
            embedding = None
            if self._embedding_fn:
                try:
                    embedding = await self._embedding_fn(content)
                except Exception as exc:
                    logger.warning("consolidate_embedding_failed", segment=seg_idx, error=str(exc))

                if embedding is not None and await self._is_duplicate(
                    user_id=session.user_id,
                    app_name=session.app_name,
                    embedding=embedding,
                ):
                    logger.debug("consolidate_duplicate_skipped", segment=seg_idx)
                    continue

            # Consolidate: 存储新记忆
            initial_score = self._calculate_initial_retention(content)
            async with db_session.AsyncSessionLocal() as db:
                memory = Memory(
                    thread_id=thread_id,
                    user_id=session.user_id,
                    app_name=session.app_name,
                    memory_type="episodic",
                    content=content,
                    embedding=embedding,
                    retention_score=initial_score,
                    metadata_={
                        "source": "session",
                        "event_count": len(session.events),
                        "segment_index": seg_idx,
                        "total_segments": len(segments),
                        "turn_count": len(segment),
                    },
                )
                db.add(memory)
                await db.commit()
                stored_count += 1

        # 阶段 4：事实提取 — 从对话中提取结构化事实
        try:
            await self._extract_and_store_facts(
                turns=turns,
                user_id=session.user_id,
                app_name=session.app_name,
                thread_id=thread_id,
            )
        except Exception as exc:
            logger.warning("fact_extraction_stage_failed", error=str(exc))

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
                    key=fact.key[:255],  # 遵守 VARCHAR(255) 约束
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
        user_id: str,
        app_name: str,
        embedding: list[float],
    ) -> bool:
        """检测是否与用户现有记忆重复（Orient 阶段）

        使用 cosine similarity 比对最近的记忆。
        """
        async with db_session.AsyncSessionLocal() as db:
            distance = Memory.embedding.op("<=>")(embedding)
            stmt = (
                select(Memory.id, distance.label("dist"))
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
            # cosine distance: 0 = identical, 2 = opposite
            # similarity = 1 - distance
            similarity = 1.0 - float(row.dist)
            return similarity >= _DEDUP_SIMILARITY_THRESHOLD

    @staticmethod
    def _calculate_initial_retention(content: str) -> float:
        """启发式计算新记忆的初始保留分数

        信息密度因子：内容越长且含更多不同词，信息密度越高。
        """
        words = content.split()
        if not words:
            return 0.5
        unique_ratio = len(set(words)) / len(words) if words else 0
        length_factor = min(1.0, len(words) / 50.0)  # 50 词为基准
        density_factor = 0.5 + 0.5 * unique_ratio
        return min(1.0, _INITIAL_RETENTION_BASE * density_factor + length_factor * 0.2)

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
                    memories_data = result
                    await self._record_access(memories_data)
                    return self._build_search_response(memories_data)
            except Exception as exc:
                logger.warning(
                    "hybrid_search_native_failed",
                    error=str(exc),
                    fallback="vector_search",
                )

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
            await self._record_access(memories_data)
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
                await self._record_access(memories_data)
                return self._build_search_response(memories_data)
        except Exception as exc:
            logger.warning(
                "keyword_search_failed",
                error=str(exc),
                fallback="ilike",
            )

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
        await self._record_access(memories_data)
        return self._build_search_response(memories_data)

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
        sql = text(f"""
            SELECT id, content, semantic_score, keyword_score, combined_score, metadata
            FROM {NEGENTROPY_SCHEMA}.hybrid_search(
                :user_id, :app_name, :query, :embedding::vector(1536),
                :limit, :semantic_weight, :keyword_weight
            )
        """)

        async with db_session.AsyncSessionLocal() as db:
            result = await db.execute(
                sql,
                {
                    "user_id": user_id,
                    "app_name": app_name,
                    "query": query,
                    "embedding": query_embedding,
                    "limit": limit + offset,
                    "semantic_weight": _DEFAULT_SEMANTIC_WEIGHT,
                    "keyword_weight": _DEFAULT_KEYWORD_WEIGHT,
                },
            )
            rows = result.fetchall()

        if not rows:
            return []

        logger.info(
            "hybrid_search_completed",
            user_id=user_id,
            query=query[:100],
            result_count=len(rows),
        )

        rows = rows[offset:]
        return [
            {
                "id": str(row.id),
                "content": row.content,
                "metadata": row.metadata or {},
                "relevance_score": float(row.combined_score),
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
        sql = text(f"""
            SELECT id, content, metadata, retention_score, created_at,
                   ts_rank_cd(search_vector, plainto_tsquery('english', :query)) AS rank_score
            FROM {NEGENTROPY_SCHEMA}.memories
            WHERE user_id = :user_id
              AND app_name = :app_name
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
            }
            for m in memories_orms
        ]

    async def _record_access(self, memories_data: list[dict[str, Any]]) -> None:
        """记录记忆访问行为

        批量更新被召回记忆的 access_count 和 last_accessed_at，
        驱动艾宾浩斯遗忘曲线动态生效。<sup>[1]</sup>

        使用批量 UPDATE 避免 N+1 问题。
        """
        if not memories_data:
            return

        memory_ids = [uuid.UUID(m["id"]) for m in memories_data if m.get("id")]
        if not memory_ids:
            return

        try:
            async with db_session.AsyncSessionLocal() as db:
                now = datetime.now(UTC)
                # 批量更新 access_count 和 last_accessed_at
                stmt = (
                    update(Memory)
                    .where(Memory.id.in_(memory_ids))
                    .values(
                        access_count=Memory.access_count + 1,
                        last_accessed_at=now,
                    )
                )
                await db.execute(stmt)
                await db.commit()

            logger.debug(
                "memory_access_recorded",
                memory_count=len(memory_ids),
            )
        except Exception as exc:
            # 访问记录失败不应影响检索结果返回
            logger.warning(
                "memory_access_record_failed",
                memory_count=len(memory_ids),
                error=str(exc),
            )

    def _build_search_response(self, memories_data: list[dict[str, Any]]) -> SearchMemoryResponse:
        """构建 ADK SearchMemoryResponse"""
        memories = []
        for m in memories_data:
            content_val = {"parts": [{"text": m["content"]}]}
            created_at = m.get("created_at")
            timestamp = created_at.isoformat() if created_at else datetime.now(UTC).isoformat()

            memories.append(
                MemoryEntry(
                    id=m["id"],
                    content=content_val,
                    author="system",
                    timestamp=timestamp,
                    relevance_score=m.get("relevance_score", 0.0),
                    custom_metadata=m.get("metadata", {}),
                )
            )

        return SearchMemoryResponse(memories=memories)

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
