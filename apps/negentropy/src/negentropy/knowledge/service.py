from __future__ import annotations

from typing import Any, Awaitable, Callable, Dict, Iterable, Optional
from uuid import UUID

from .chunking import chunk_text
from .repository import KnowledgeRepository
from .types import (
    ChunkingConfig,
    CorpusRecord,
    CorpusSpec,
    KnowledgeChunk,
    KnowledgeMatch,
    KnowledgeRecord,
    SearchConfig,
)

EmbeddingFn = Callable[[str], Awaitable[list[float]]]


class KnowledgeService:
    def __init__(
        self,
        repository: Optional[KnowledgeRepository] = None,
        embedding_fn: Optional[EmbeddingFn] = None,
        chunking_config: Optional[ChunkingConfig] = None,
    ) -> None:
        self._repository = repository or KnowledgeRepository()
        self._embedding_fn = embedding_fn
        self._chunking_config = chunking_config or ChunkingConfig()

    async def ensure_corpus(self, spec: CorpusSpec) -> CorpusRecord:
        return await self._repository.get_or_create_corpus(spec)

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
        config = chunking_config or self._chunking_config
        chunks = self._build_chunks(
            text,
            source_uri=source_uri,
            metadata=metadata,
            chunking_config=config,
        )
        if self._embedding_fn:
            chunks = await self._attach_embeddings(chunks)
        return await self._repository.add_knowledge(
            corpus_id=corpus_id,
            app_name=app_name,
            chunks=chunks,
        )

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
        await self._repository.delete_knowledge_by_source(
            corpus_id=corpus_id,
            app_name=app_name,
            source_uri=source_uri,
        )
        return await self.ingest_text(
            corpus_id=corpus_id,
            app_name=app_name,
            text=text,
            source_uri=source_uri,
            metadata=metadata,
            chunking_config=chunking_config,
        )

    async def search(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        query: str,
        config: Optional[SearchConfig] = None,
    ) -> list[KnowledgeMatch]:
        config = config or SearchConfig()
        if not query.strip():
            return []

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

        if config.mode in ("keyword", "hybrid"):
            keyword_matches = await self._repository.keyword_search(
                corpus_id=corpus_id,
                app_name=app_name,
                query=query,
                limit=config.limit,
                metadata_filter=config.metadata_filter,
            )

        if config.mode == "semantic":
            return semantic_matches

        if config.mode == "keyword":
            return keyword_matches

        return self._merge_matches(
            semantic_matches,
            keyword_matches,
            semantic_weight=config.semantic_weight,
            keyword_weight=config.keyword_weight,
            limit=config.limit,
        )

    def _build_chunks(
        self,
        text: str,
        *,
        source_uri: Optional[str],
        metadata: Optional[Dict[str, Any]],
        chunking_config: ChunkingConfig,
    ) -> Iterable[KnowledgeChunk]:
        metadata = metadata or {}
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
        if not self._embedding_fn:
            return list(chunks)

        enriched: list[KnowledgeChunk] = []
        for chunk in chunks:
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

        recomputed: list[KnowledgeMatch] = []
        for match in merged.values():
            combined_score = match.semantic_score * semantic_weight + match.keyword_score * keyword_weight
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
