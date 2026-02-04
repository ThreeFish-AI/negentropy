from __future__ import annotations

from typing import Any, Dict, Iterable, Optional
from uuid import UUID, uuid4

from negentropy.knowledge.service import KnowledgeService
from negentropy.knowledge.types import (
    ChunkingConfig,
    KnowledgeChunk,
    KnowledgeMatch,
    KnowledgeRecord,
    SearchConfig,
)


def _make_record(corpus_id: UUID, app_name: str, chunk: KnowledgeChunk) -> KnowledgeRecord:
    return KnowledgeRecord(
        id=uuid4(),
        corpus_id=corpus_id,
        app_name=app_name,
        content=chunk.content,
        source_uri=chunk.source_uri,
        chunk_index=chunk.chunk_index,
        metadata=chunk.metadata,
        created_at=None,
        updated_at=None,
        embedding=chunk.embedding,
    )


class FakeRepository:
    def __init__(self) -> None:
        self.added: list[KnowledgeChunk] = []
        self.deleted_sources: list[Dict[str, Any]] = []
        self.semantic_results: list[KnowledgeMatch] = []
        self.keyword_results: list[KnowledgeMatch] = []

    async def add_knowledge(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        chunks: Iterable[KnowledgeChunk],
    ) -> list[KnowledgeRecord]:
        items = list(chunks)
        self.added.extend(items)
        return [_make_record(corpus_id, app_name, item) for item in items]

    async def delete_knowledge_by_source(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        source_uri: str,
    ) -> int:
        self.deleted_sources.append(
            {
                "corpus_id": corpus_id,
                "app_name": app_name,
                "source_uri": source_uri,
            }
        )
        return 1

    async def semantic_search(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        query_embedding: list[float],
        limit: int,
        metadata_filter: Optional[Dict[str, Any]] = None,
    ) -> list[KnowledgeMatch]:
        return self.semantic_results[:limit]

    async def keyword_search(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        query: str,
        limit: int,
        metadata_filter: Optional[Dict[str, Any]] = None,
    ) -> list[KnowledgeMatch]:
        return self.keyword_results[:limit]


async def _embedding_fn(text: str) -> list[float]:
    return [float(len(text))]


async def test_ingest_search_replace_source_flow():
    repo = FakeRepository()
    service = KnowledgeService(
        repository=repo,
        embedding_fn=_embedding_fn,
        chunking_config=ChunkingConfig(chunk_size=5, overlap=0, preserve_newlines=True),
    )

    corpus_id = uuid4()
    app_name = "negentropy"

    records = await service.ingest_text(
        corpus_id=corpus_id,
        app_name=app_name,
        text="hello world",
        source_uri="doc://alpha",
        metadata={"source": "unit"},
    )

    assert records
    assert repo.added
    assert all(chunk.embedding is not None for chunk in repo.added)

    first_id = uuid4()
    second_id = uuid4()
    repo.semantic_results = [
        KnowledgeMatch(
            id=first_id,
            content="semantic",
            source_uri="doc://alpha",
            metadata={},
            semantic_score=0.9,
            keyword_score=0.0,
            combined_score=0.0,
        )
    ]
    repo.keyword_results = [
        KnowledgeMatch(
            id=first_id,
            content="semantic",
            source_uri="doc://alpha",
            metadata={},
            semantic_score=0.0,
            keyword_score=0.2,
            combined_score=0.0,
        ),
        KnowledgeMatch(
            id=second_id,
            content="keyword",
            source_uri="doc://beta",
            metadata={},
            semantic_score=0.0,
            keyword_score=0.8,
            combined_score=0.0,
        ),
    ]

    matches = await service.search(
        corpus_id=corpus_id,
        app_name=app_name,
        query="hello",
        config=SearchConfig(mode="hybrid", limit=10, semantic_weight=0.6, keyword_weight=0.4),
    )

    assert {m.id for m in matches} == {first_id, second_id}
    combined = {m.id: m.combined_score for m in matches}
    assert combined[first_id] > combined[second_id]

    replaced = await service.replace_source(
        corpus_id=corpus_id,
        app_name=app_name,
        text="new content",
        source_uri="doc://alpha",
    )

    assert replaced
    assert repo.deleted_sources
    assert repo.deleted_sources[-1]["source_uri"] == "doc://alpha"
