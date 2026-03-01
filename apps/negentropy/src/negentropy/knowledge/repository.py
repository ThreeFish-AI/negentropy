from __future__ import annotations

import json
from typing import Any, Dict, Iterable, Optional
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker

from negentropy.logging import get_logger
from negentropy.models.base import NEGENTROPY_SCHEMA
from negentropy.models.perception import Corpus, Knowledge

from .constants import BATCH_INSERT_SIZE, RECALL_MULTIPLIER
from .exceptions import DatabaseError, SearchError
from .types import CorpusRecord, CorpusSpec, KnowledgeChunk, KnowledgeMatch, KnowledgeRecord, merge_search_results


logger = get_logger("negentropy.knowledge.repository")


class KnowledgeRepository:
    def __init__(self, session_factory: Optional[async_sessionmaker] = None):
        """
        初始化 KnowledgeRepository。

        Args:
            session_factory: 可选的 async_sessionmaker 实例。
                           如果为 None，将在首次使用时从 db.session 获取。
        """
        self._session_factory = session_factory

    def _get_session_factory(self) -> async_sessionmaker:
        """获取当前的 session factory，支持运行时 patch"""
        if self._session_factory is not None:
            return self._session_factory
        # 延迟导入，确保获取到被 patch 后的值
        from negentropy.db.session import AsyncSessionLocal

        return AsyncSessionLocal

    async def get_corpus(self, *, app_name: str, name: str) -> Optional[CorpusRecord]:
        async with self._get_session_factory()() as db:
            stmt = select(Corpus).where(Corpus.app_name == app_name, Corpus.name == name)
            result = await db.execute(stmt)
            corpus = result.scalar_one_or_none()
            if not corpus:
                return None
            return self._to_corpus_record(corpus)

    async def get_corpus_by_id(self, corpus_id: UUID) -> Optional[CorpusRecord]:
        async with self._get_session_factory()() as db:
            stmt = select(Corpus).where(Corpus.id == corpus_id)
            result = await db.execute(stmt)
            corpus = result.scalar_one_or_none()
            if not corpus:
                return None
            return self._to_corpus_record(corpus)

    async def list_corpora(self, *, app_name: str) -> list[CorpusRecord]:
        async with self._get_session_factory()() as db:
            stmt = select(Corpus).where(Corpus.app_name == app_name).order_by(Corpus.created_at.desc())
            result = await db.execute(stmt)
            corpora = result.scalars().all()
            return [self._to_corpus_record(corpus) for corpus in corpora]

    async def create_corpus(self, spec: CorpusSpec) -> CorpusRecord:
        async with self._get_session_factory()() as db:
            corpus = Corpus(
                app_name=spec.app_name,
                name=spec.name,
                description=spec.description,
                config=spec.config,
            )
            db.add(corpus)
            await db.commit()
            await db.refresh(corpus)
            return self._to_corpus_record(corpus)

    async def update_corpus(self, corpus_id: UUID, spec: Dict[str, Any]) -> Optional[CorpusRecord]:
        async with self._get_session_factory()() as db:
            stmt = select(Corpus).where(Corpus.id == corpus_id)
            result = await db.execute(stmt)
            corpus = result.scalar_one_or_none()
            if not corpus:
                return None

            for key, value in spec.items():
                if hasattr(corpus, key):
                    setattr(corpus, key, value)

            # Ensure updated_at is refreshed
            # SQLAlchemy handles updated_at automatically via onupdate=func.now() if configured,
            # but our model uses TimestampMixin with server_default.
            # We might need to manually set it or rely on DB trigger if exists.
            # Assuming standard SQLAlchemy behavior for now.

            await db.commit()
            await db.refresh(corpus)
            return self._to_corpus_record(corpus)

    async def get_or_create_corpus(self, spec: CorpusSpec) -> CorpusRecord:
        existing = await self.get_corpus(app_name=spec.app_name, name=spec.name)
        if existing:
            return existing

        try:
            return await self.create_corpus(spec)
        except IntegrityError:
            return await self.get_corpus(app_name=spec.app_name, name=spec.name)

    async def delete_corpus(self, corpus_id: UUID) -> None:
        async with self._get_session_factory()() as db:
            stmt = select(Corpus).where(Corpus.id == corpus_id)
            result = await db.execute(stmt)
            corpus = result.scalar_one_or_none()
            if not corpus:
                return
            await db.delete(corpus)
            await db.commit()

    async def add_knowledge(
        self, *, corpus_id: UUID, app_name: str, chunks: Iterable[KnowledgeChunk]
    ) -> list[KnowledgeRecord]:
        """批量添加知识块

        使用 PostgreSQL 的 INSERT ... RETURNING 子句一次性完成插入并获取生成的 ID。
        """
        chunk_list = list(chunks)

        if not chunk_list:
            return []

        # 准备批量插入数据
        values = [
            {
                "corpus_id": corpus_id,
                "app_name": app_name,
                "content": chunk.content,
                "embedding": chunk.embedding,
                "source_uri": chunk.source_uri,
                "chunk_index": chunk.chunk_index,
                "metadata_": chunk.metadata or {},
            }
            for chunk in chunk_list
        ]

        try:
            async with self._get_session_factory()() as db:
                # 使用 PostgreSQL INSERT ... RETURNING 子句直接获取插入结果
                # 避免二次查询丢失 source_uri=None 的记录
                stmt = (
                    pg_insert(Knowledge)
                    .values(values)
                    .returning(
                        Knowledge.id,
                        Knowledge.corpus_id,
                        Knowledge.app_name,
                        Knowledge.content,
                        Knowledge.source_uri,
                        Knowledge.chunk_index,
                        Knowledge.metadata_,
                        Knowledge.embedding,
                        Knowledge.created_at,
                        Knowledge.updated_at,
                    )
                )
                result = await db.execute(stmt)
                await db.commit()

                rows = result.fetchall()
                return [
                    KnowledgeRecord(
                        id=row.id,
                        corpus_id=row.corpus_id,
                        app_name=row.app_name,
                        content=row.content,
                        source_uri=row.source_uri,
                        chunk_index=row.chunk_index,
                        metadata=row.metadata_ or {},
                        embedding=row.embedding,
                        created_at=row.created_at,
                        updated_at=row.updated_at,
                    )
                    for row in rows
                ]

        except IntegrityError as exc:
            raise DatabaseError(
                operation="batch_insert",
                table="knowledge",
                reason=str(exc),
            ) from exc

    async def delete_knowledge_by_source(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        source_uri: str,
    ) -> int:
        async with self._get_session_factory()() as db:
            stmt = select(Knowledge).where(
                Knowledge.corpus_id == corpus_id,
                Knowledge.app_name == app_name,
                Knowledge.source_uri == source_uri,
            )
            result = await db.execute(stmt)
            items = result.scalars().all()
            if not items:
                return 0
            for item in items:
                await db.delete(item)
            await db.commit()
            return len(items)

    async def archive_knowledge_by_source(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        source_uri: str,
        archived: bool = True,
    ) -> int:
        """归档或解档指定 source_uri 的所有知识块

        通过更新 metadata_ JSONB 字段中的 archived 标记实现。

        Args:
            corpus_id: 知识库 ID
            app_name: 应用名称
            source_uri: 来源 URI
            archived: True 表示归档，False 表示解档

        Returns:
            更新的记录数量
        """
        async with self._session_factory() as db:
            # 使用 PostgreSQL 的 jsonb_set 函数更新 metadata
            # 如果 archived=True，设置 metadata.archived = true
            # 如果 archived=False，设置 metadata.archived = false
            archive_value = "true" if archived else "false"
            update_stmt = text("""
                UPDATE {schema}.knowledge
                SET metadata_ = jsonb_set(
                    COALESCE(metadata_, '{{}}'::jsonb),
                    '{{archived}}',
                    '{value}'::jsonb
                )
                WHERE corpus_id = :corpus_id
                  AND app_name = :app_name
                  AND source_uri = :source_uri
            """.format(schema=NEGENTROPY_SCHEMA, value=archive_value))

            result = await db.execute(
                update_stmt,
                {
                    "corpus_id": corpus_id,
                    "app_name": app_name,
                    "source_uri": source_uri,
                },
            )
            await db.commit()
            return result.rowcount

    async def list_knowledge(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        source_uri: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[KnowledgeRecord], int, Dict[str, int]]:
        """列出知识库中的知识条目

        Args:
            corpus_id: 知识库 ID
            app_name: 应用名称
            source_uri: 可选的来源 URI 过滤，传入 "__null__" 表示筛选无来源的条目
            limit: 分页大小
            offset: 偏移量

        Returns:
            tuple: (items, total_count, source_stats)
            - items: 当前页的知识条目列表
            - total_count: 符合条件的总数量（考虑 source_uri 过滤）
            - source_stats: 全局的 source_uri 统计 {uri: count}，null 来源用 "__null__" 表示
        """
        async with self._get_session_factory()() as db:
            # 基础查询条件
            base_conditions = [
                Knowledge.corpus_id == corpus_id,
                Knowledge.app_name == app_name,
            ]

            # 如果指定了 source_uri 过滤
            source_filter = None
            if source_uri is not None:
                if source_uri == "__null__":
                    source_filter = Knowledge.source_uri.is_(None)
                else:
                    source_filter = Knowledge.source_uri == source_uri

            # 查询当前页数据：按 source_uri 分组，组内按 chunk_index 排序
            stmt = (
                select(Knowledge)
                .where(*base_conditions)
                .order_by(
                    Knowledge.source_uri.asc().nulls_last(),
                    Knowledge.chunk_index.asc(),
                )
                .limit(limit)
                .offset(offset)
            )
            if source_filter is not None:
                stmt = stmt.where(source_filter)

            result = await db.execute(stmt)
            items = result.scalars().all()

            # 查询符合条件的总数
            count_stmt = select(func.count(Knowledge.id)).where(*base_conditions)
            if source_filter is not None:
                count_stmt = count_stmt.where(source_filter)
            count_result = await db.execute(count_stmt)
            total_count = count_result.scalar() or 0

            # 查询全局 source_stats（不受 source_uri 过滤影响）
            stats_stmt = (
                select(Knowledge.source_uri, func.count(Knowledge.id))
                .where(*base_conditions)
                .group_by(Knowledge.source_uri)
            )
            stats_result = await db.execute(stats_stmt)
            source_stats: Dict[str, int] = {}
            for row in stats_result:
                uri, count = row
                source_stats[uri or "__null__"] = count

            return [self._to_knowledge_record(item) for item in items], total_count, source_stats

    async def semantic_search(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        query_embedding: list[float],
        limit: int,
        metadata_filter: Optional[Dict[str, Any]] = None,
    ) -> list[KnowledgeMatch]:
        """语义检索

        使用 pgvector 的 cosine 距离进行向量相似度搜索。
        """
        try:
            async with self._get_session_factory()() as db:
                distance = Knowledge.embedding.op("<=>")(query_embedding)
                stmt = (
                    select(Knowledge, (1 - distance).label("semantic_score"))
                    .where(
                        Knowledge.corpus_id == corpus_id,
                        Knowledge.app_name == app_name,
                        Knowledge.embedding.is_not(None),
                    )
                    .order_by(distance.asc())
                    .limit(limit)
                )

                if metadata_filter:
                    stmt = stmt.where(Knowledge.metadata_.op("@>")(metadata_filter))

                result = await db.execute(stmt)
                rows = result.all()

            matches: list[KnowledgeMatch] = []
            for knowledge, score in rows:
                matches.append(
                    KnowledgeMatch(
                        id=knowledge.id,
                        content=knowledge.content,
                        source_uri=knowledge.source_uri,
                        metadata=knowledge.metadata_ or {},
                        semantic_score=float(score or 0.0),
                        keyword_score=0.0,
                        combined_score=float(score or 0.0),
                    )
                )
            return matches

        except Exception as exc:
            raise SearchError(
                corpus_id=str(corpus_id),
                search_mode="semantic",
                reason=str(exc),
            ) from exc

    async def keyword_search(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        query: str,
        limit: int,
        metadata_filter: Optional[Dict[str, Any]] = None,
    ) -> list[KnowledgeMatch]:
        """关键词检索

        使用 PostgreSQL 的全文搜索（BM25）进行关键词匹配。
        """
        filters = ""
        params: Dict[str, Any] = {
            "corpus_id": str(corpus_id),
            "app_name": app_name,
            "query": query,
            "limit": limit,
        }

        if metadata_filter:
            filters = " AND metadata @> :metadata_filter::jsonb"
            params["metadata_filter"] = json.dumps(metadata_filter)

        stmt = text(
            f"""
            SELECT id, content, source_uri, metadata,
                   ts_rank_cd(search_vector, plainto_tsquery('english', :query))::REAL AS keyword_score
            FROM {NEGENTROPY_SCHEMA}.knowledge
            WHERE corpus_id = :corpus_id
              AND app_name = :app_name
              AND search_vector @@ plainto_tsquery('english', :query)
            """
            + filters
            + " ORDER BY keyword_score DESC LIMIT :limit"
        )

        try:
            async with self._get_session_factory()() as db:
                result = await db.execute(stmt, params)
                rows = result.mappings().all()

            matches: list[KnowledgeMatch] = []
            for row in rows:
                matches.append(
                    KnowledgeMatch(
                        id=row["id"],
                        content=row["content"],
                        source_uri=row.get("source_uri"),
                        metadata=row.get("metadata") or {},
                        semantic_score=0.0,
                        keyword_score=float(row.get("keyword_score") or 0.0),
                        combined_score=float(row.get("keyword_score") or 0.0),
                    )
                )
            return matches

        except Exception as exc:
            raise SearchError(
                corpus_id=str(corpus_id),
                search_mode="keyword",
                reason=str(exc),
            ) from exc

    async def hybrid_search(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        query: str,
        query_embedding: list[float],
        limit: int,
        semantic_weight: float = 0.7,
        keyword_weight: float = 0.3,
        metadata_filter: Optional[Dict[str, Any]] = None,
    ) -> list[KnowledgeMatch]:
        """混合检索

        使用数据库原生的 kb_hybrid_search() 函数进行混合检索，
        相比 Python 端合并，性能更优且减少数据传输。

        参考: docs/schema/perception_schema.sql Part 6
        """
        params: Dict[str, Any] = {
            "p_corpus_id": str(corpus_id),
            "p_app_name": app_name,
            "p_query": query,
            "p_query_embedding": query_embedding,
            "p_limit": limit,
            "p_semantic_weight": semantic_weight,
            "p_keyword_weight": keyword_weight,
        }

        # 添加元数据过滤（如果需要）
        metadata_clause = ""
        if metadata_filter:
            # 注意：kb_hybrid_search 函数可能不支持 metadata_filter
            # 此处作为可选扩展点，实际使用时需要确保函数已更新
            pass

        stmt = text(
            f"""
            SELECT
                id,
                content,
                source_uri,
                metadata,
                semantic_score::REAL,
                keyword_score::REAL,
                combined_score::REAL
            FROM {NEGENTROPY_SCHEMA}.kb_hybrid_search(
                :p_corpus_id::UUID,
                :p_app_name::VARCHAR,
                :p_query::TEXT,
                :p_query_embedding::vector(1536),
                :p_limit::INTEGER,
                :p_semantic_weight::FLOAT,
                :p_keyword_weight::FLOAT
            )
            """
        )

        try:
            async with self._get_session_factory()() as db:
                result = await db.execute(stmt, params)
                rows = result.mappings().all()

            matches: list[KnowledgeMatch] = []
            for row in rows:
                matches.append(
                    KnowledgeMatch(
                        id=row["id"],
                        content=row["content"],
                        source_uri=row.get("source_uri"),
                        metadata=row.get("metadata") or {},
                        semantic_score=float(row.get("semantic_score") or 0.0),
                        keyword_score=float(row.get("keyword_score") or 0.0),
                        combined_score=float(row.get("combined_score") or 0.0),
                    )
                )
            return matches

        except Exception as exc:
            # 回退到 Python 端混合检索
            # 如果数据库函数不可用，自动降级
            return await self._fallback_hybrid_search(
                corpus_id=corpus_id,
                app_name=app_name,
                query=query,
                query_embedding=query_embedding,
                limit=limit,
                semantic_weight=semantic_weight,
                keyword_weight=keyword_weight,
                metadata_filter=metadata_filter,
            )

    async def _fallback_hybrid_search(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        query: str,
        query_embedding: list[float],
        limit: int,
        semantic_weight: float,
        keyword_weight: float,
        metadata_filter: Optional[Dict[str, Any]] = None,
    ) -> list[KnowledgeMatch]:
        """Python 端混合检索（回退方案）

        当数据库函数不可用时使用。
        """
        # 扩大召回范围
        recall_limit = limit * RECALL_MULTIPLIER

        semantic_matches = await self.semantic_search(
            corpus_id=corpus_id,
            app_name=app_name,
            query_embedding=query_embedding,
            limit=recall_limit,
            metadata_filter=metadata_filter,
        )

        keyword_matches = await self.keyword_search(
            corpus_id=corpus_id,
            app_name=app_name,
            query=query,
            limit=recall_limit,
            metadata_filter=metadata_filter,
        )

        # 委托给共享的融合逻辑（消除与 KnowledgeService._merge_matches 的重复）
        return merge_search_results(
            semantic_matches,
            keyword_matches,
            semantic_weight=semantic_weight,
            keyword_weight=keyword_weight,
            limit=limit,
        )

    async def rrf_search(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        query: str,
        query_embedding: list[float],
        limit: int = 50,
        k: int = 60,
    ) -> list[KnowledgeMatch]:
        """RRF 融合检索 (Reciprocal Rank Fusion)

        使用 Reciprocal Rank Fusion 算法合并语义和关键词检索结果。
        相比加权融合，RRF 对分数尺度不敏感，更稳定。

        Args:
            corpus_id: 语料库 ID
            app_name: 应用名称
            query: 查询文本
            query_embedding: 查询向量
            limit: 返回结果数量
            k: RRF 平滑常数 (默认 60)

        Returns:
            融合后的匹配结果列表

        参考文献:
        [1] Y. Wang et al., "Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods,"
            SIGIR'18, 2018.
        """
        params: Dict[str, Any] = {
            "p_corpus_id": str(corpus_id),
            "p_app_name": app_name,
            "p_query": query,
            "p_query_embedding": query_embedding,
            "p_limit": limit,
            "p_k": k,
        }

        stmt = text(
            f"""
            SELECT
                id,
                content,
                source_uri,
                metadata,
                rrf_score::REAL,
                semantic_rank::INTEGER,
                keyword_rank::INTEGER
            FROM {NEGENTROPY_SCHEMA}.kb_rrf_search(
                :p_corpus_id::UUID,
                :p_app_name::VARCHAR,
                :p_query::TEXT,
                :p_query_embedding::vector(1536),
                :p_limit::INTEGER,
                :p_k::INTEGER
            )
            ORDER BY rrf_score DESC
            """
        )

        try:
            async with self._get_session_factory()() as db:
                result = await db.execute(stmt, params)
                rows = result.mappings().all()

            matches: list[KnowledgeMatch] = []
            for row in rows:
                matches.append(
                    KnowledgeMatch(
                        id=row["id"],
                        content=row["content"],
                        source_uri=row.get("source_uri"),
                        metadata=row.get("metadata") or {},
                        semantic_score=0.0,  # RRF 不使用原始分数
                        keyword_score=0.0,
                        combined_score=float(row.get("rrf_score") or 0.0),
                    )
                )
            return matches

        except Exception as exc:
            # 回退到 Python 端 RRF 实现
            logger.warning(
                "kb_rrf_search_function_failed",
                corpus_id=str(corpus_id),
                error=str(exc),
                fallback="python_rrf",
            )
            return await self._python_fallback_rrf_search(
                corpus_id=corpus_id,
                app_name=app_name,
                query=query,
                query_embedding=query_embedding,
                limit=limit,
                k=k,
            )

    async def _python_fallback_rrf_search(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        query: str,
        query_embedding: list[float],
        limit: int,
        k: int,
    ) -> list[KnowledgeMatch]:
        """Python 端 RRF 实现 (回退方案)

        当数据库函数不可用时使用。
        """
        # 扩大召回范围
        recall_limit = limit * 3

        # 获取语义和关键词检索结果
        semantic_matches = await self.semantic_search(
            corpus_id=corpus_id,
            app_name=app_name,
            query_embedding=query_embedding,
            limit=recall_limit,
            metadata_filter=None,
        )

        keyword_matches = await self.keyword_search(
            corpus_id=corpus_id,
            app_name=app_name,
            query=query,
            limit=recall_limit,
            metadata_filter=None,
        )

        # 构建 RRF 分数字典
        rrf_scores: Dict[UUID, float] = {}
        semantic_ranks: Dict[UUID, int] = {}
        keyword_ranks: Dict[UUID, int] = {}

        # 语义排名
        for rank, match in enumerate(semantic_matches, start=1):
            semantic_ranks[match.id] = rank
            rrf_scores[match.id] = rrf_scores.get(match.id, 0.0) + 1.0 / (k + rank)

        # 关键词排名
        for rank, match in enumerate(keyword_matches, start=1):
            keyword_ranks[match.id] = rank
            rrf_scores[match.id] = rrf_scores.get(match.id, 0.0) + 1.0 / (k + rank)

        # 合并结果并按 RRF 分数排序
        merged: list[KnowledgeMatch] = []
        for match_id, rrf_score in rrf_scores.items():
            # 从语义或关键词结果中获取详细信息
            detail = next(
                (m for m in semantic_matches if m.id == match_id),
                next((m for m in keyword_matches if m.id == match_id), None),
            )
            if detail:
                merged.append(
                    KnowledgeMatch(
                        id=detail.id,
                        content=detail.content,
                        source_uri=detail.source_uri,
                        metadata=detail.metadata,
                        semantic_score=0.0,
                        keyword_score=0.0,
                        combined_score=rrf_score,
                    )
                )

        ordered = sorted(merged, key=lambda item: item.combined_score, reverse=True)
        return ordered[:limit]

    @staticmethod
    def _to_corpus_record(corpus: Corpus) -> CorpusRecord:
        return CorpusRecord(
            id=corpus.id,
            app_name=corpus.app_name,
            name=corpus.name,
            description=corpus.description,
            config=corpus.config or {},
            created_at=corpus.created_at,
            updated_at=corpus.updated_at,
        )

    @staticmethod
    def _to_knowledge_record(knowledge: Knowledge) -> KnowledgeRecord:
        return KnowledgeRecord(
            id=knowledge.id,
            corpus_id=knowledge.corpus_id,
            app_name=knowledge.app_name,
            content=knowledge.content,
            source_uri=knowledge.source_uri,
            chunk_index=knowledge.chunk_index,
            metadata=knowledge.metadata_ or {},
            created_at=knowledge.created_at,
            updated_at=knowledge.updated_at,
            embedding=knowledge.embedding,
        )
