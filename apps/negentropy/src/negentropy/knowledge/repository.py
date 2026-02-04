from __future__ import annotations

import json
from typing import Any, Dict, Iterable, Optional
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from negentropy.db.session import AsyncSessionLocal
from negentropy.models.perception import Corpus, Knowledge

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

    async def add_knowledge(self, *, corpus_id: UUID, app_name: str, chunks: Iterable[KnowledgeChunk]) -> list[KnowledgeRecord]:
        items = [
            Knowledge(
                corpus_id=corpus_id,
                app_name=app_name,
                content=chunk.content,
                embedding=chunk.embedding,
                source_uri=chunk.source_uri,
                chunk_index=chunk.chunk_index,
                metadata_=chunk.metadata or {},
            )
            for chunk in chunks
        ]

        if not items:
            return []

        async with self._session_factory() as db:
            db.add_all(items)
            await db.flush()
            await db.commit()

        return [self._to_knowledge_record(item) for item in items]

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

    async def keyword_search(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        query: str,
        limit: int,
        metadata_filter: Optional[Dict[str, Any]] = None,
    ) -> list[KnowledgeMatch]:
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
