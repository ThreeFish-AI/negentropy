from __future__ import annotations

import json
from typing import Any, Dict, Iterable, Optional
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError

from negentropy.db.session import AsyncSessionLocal
from negentropy.models.perception import Corpus, Knowledge

from .constants import BATCH_INSERT_SIZE, RECALL_MULTIPLIER
from .exceptions import DatabaseError, SearchError
from .types import CorpusRecord, CorpusSpec, KnowledgeChunk, KnowledgeMatch, KnowledgeRecord


class KnowledgeRepository:
    def __init__(self, session_factory=AsyncSessionLocal):
        self._session_factory = session_factory

    async def get_corpus(self, *, app_name: str, name: str) -> Optional[CorpusRecord]:
        async with self._session_factory() as db:
            stmt = select(Corpus).where(Corpus.app_name == app_name, Corpus.name == name)
            result = await db.execute(stmt)
            corpus = result.scalar_one_or_none()
            if not corpus:
                return None
            return self._to_corpus_record(corpus)

    async def get_corpus_by_id(self, corpus_id: UUID) -> Optional[CorpusRecord]:
        async with self._session_factory() as db:
            stmt = select(Corpus).where(Corpus.id == corpus_id)
            result = await db.execute(stmt)
            corpus = result.scalar_one_or_none()
            if not corpus:
                return None
            return self._to_corpus_record(corpus)

    async def list_corpora(self, *, app_name: str) -> list[CorpusRecord]:
        async with self._session_factory() as db:
            stmt = select(Corpus).where(Corpus.app_name == app_name).order_by(Corpus.created_at.desc())
            result = await db.execute(stmt)
            corpora = result.scalars().all()
            return [self._to_corpus_record(corpus) for corpus in corpora]

    async def create_corpus(self, spec: CorpusSpec) -> CorpusRecord:
        async with self._session_factory() as db:
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

    async def get_or_create_corpus(self, spec: CorpusSpec) -> CorpusRecord:
        existing = await self.get_corpus(app_name=spec.app_name, name=spec.name)
        if existing:
            return existing

        try:
            return await self.create_corpus(spec)
        except IntegrityError:
            return await self.get_corpus(app_name=spec.app_name, name=spec.name)

    async def delete_corpus(self, corpus_id: UUID) -> None:
        async with self._session_factory() as db:
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

        使用 PostgreSQL 的批量插入优化性能，而非逐条 ORM 操作。
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
            async with self._session_factory() as db:
                # 使用 PostgreSQL 原生 INSERT 批量插入
                stmt = pg_insert(Knowledge).values(values)
                await db.execute(stmt)
                await db.commit()

                # 返回插入的记录（通过重新查询获取生成的 ID）
                # 注意：在生产环境中，可使用 RETURNING 子句优化
                stmt = select(Knowledge).where(
                    Knowledge.corpus_id == corpus_id,
                    Knowledge.app_name == app_name,
                    Knowledge.source_uri.in_(
                        {chunk.source_uri for chunk in chunk_list if chunk.source_uri}
                    ),
                )
                result = await db.execute(stmt)
                items = result.scalars().all()

                return [self._to_knowledge_record(item) for item in items]

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
        async with self._session_factory() as db:
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
            async with self._session_factory() as db:
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
            """
            SELECT id, content, source_uri, metadata,
                   ts_rank_cd(search_vector, plainto_tsquery('english', :query))::REAL AS keyword_score
            FROM negentropy.knowledge
            WHERE corpus_id = :corpus_id
              AND app_name = :app_name
              AND search_vector @@ plainto_tsquery('english', :query)
            """
            + filters
            + " ORDER BY keyword_score DESC LIMIT :limit"
        )

        try:
            async with self._session_factory() as db:
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
            """
            SELECT
                id,
                content,
                source_uri,
                metadata,
                semantic_score::REAL,
                keyword_score::REAL,
                combined_score::REAL
            FROM kb_hybrid_search(
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
            async with self._session_factory() as db:
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

        # 合并结果
        merged: Dict[UUID, KnowledgeMatch] = {}

        for match in semantic_matches:
            merged[match.id] = KnowledgeMatch(
                id=match.id,
                content=match.content,
                source_uri=match.source_uri,
                metadata=match.metadata,
                semantic_score=match.semantic_score,
                keyword_score=0.0,
                combined_score=0.0,
            )

        for match in keyword_matches:
            existing = merged.get(match.id)
            if existing:
                merged[match.id] = KnowledgeMatch(
                    id=existing.id,
                    content=existing.content,
                    source_uri=existing.source_uri,
                    metadata=existing.metadata,
                    semantic_score=existing.semantic_score,
                    keyword_score=match.keyword_score,
                    combined_score=0.0,
                )
            else:
                merged[match.id] = KnowledgeMatch(
                    id=match.id,
                    content=match.content,
                    source_uri=match.source_uri,
                    metadata=match.metadata,
                    semantic_score=0.0,
                    keyword_score=match.keyword_score,
                    combined_score=0.0,
                )

        # 重新计算融合分数并排序
        recomputed: list[KnowledgeMatch] = []
        for match in merged.values():
            combined_score = (
                match.semantic_score * semantic_weight + match.keyword_score * keyword_weight
            )
            recomputed.append(
                KnowledgeMatch(
                    id=match.id,
                    content=match.content,
                    source_uri=match.source_uri,
                    metadata=match.metadata,
                    semantic_score=match.semantic_score,
                    keyword_score=match.keyword_score,
                    combined_score=combined_score,
                )
            )

        ordered = sorted(recomputed, key=lambda item: item.combined_score, reverse=True)
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
