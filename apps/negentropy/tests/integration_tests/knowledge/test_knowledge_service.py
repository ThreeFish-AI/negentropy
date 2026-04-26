from __future__ import annotations

from collections.abc import Iterable
from types import SimpleNamespace
from typing import Any
from uuid import UUID, uuid4

from negentropy.knowledge.service import KnowledgeService
from negentropy.knowledge.types import (
    ChunkingConfig,
    ChunkingStrategy,
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
        self.deleted_sources: list[dict[str, Any]] = []
        self.semantic_results: list[KnowledgeMatch] = []
        self.keyword_results: list[KnowledgeMatch] = []
        self.parent_results: list[KnowledgeMatch] = []
        self.chunk_indices: dict[UUID, int] = {}

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
        metadata_filter: dict[str, Any] | None = None,
    ) -> list[KnowledgeMatch]:
        return self.semantic_results[:limit]

    async def keyword_search(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        query: str,
        limit: int,
        metadata_filter: dict[str, Any] | None = None,
    ) -> list[KnowledgeMatch]:
        return self.keyword_results[:limit]

    async def get_search_match_metadata(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        match_ids: Iterable[UUID],
    ) -> dict[UUID, dict[str, Any]]:
        return {item: {"chunk_index": self.chunk_indices[item]} for item in match_ids if item in self.chunk_indices}

    async def get_hierarchical_parent_matches(
        self,
        *,
        corpus_id: UUID,
        app_name: str,
        source_uri: str | None,
        family_ids: Iterable[str],
    ) -> list[KnowledgeMatch]:
        return list(self.parent_results)

    async def get_corpus_by_id(self, corpus_id: UUID):
        _ = corpus_id
        return SimpleNamespace(config={})


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
    repo.chunk_indices = {
        first_id: 7,
        second_id: 11,
    }

    matches = await service.search(
        corpus_id=corpus_id,
        app_name=app_name,
        query="hello",
        config=SearchConfig(mode="hybrid", limit=10, semantic_weight=0.6, keyword_weight=0.4),
    )

    assert {m.id for m in matches} == {first_id, second_id}
    combined = {m.id: m.combined_score for m in matches}
    assert combined[first_id] > combined[second_id]
    metadata = {m.id: m.metadata for m in matches}
    assert metadata[first_id]["chunk_index"] == 7
    assert metadata[second_id]["chunk_index"] == 11

    replaced = await service.replace_source(
        corpus_id=corpus_id,
        app_name=app_name,
        text="new content",
        source_uri="doc://alpha",
    )

    assert replaced
    assert repo.deleted_sources
    assert repo.deleted_sources[-1]["source_uri"] == "doc://alpha"


async def test_search_lifts_hierarchical_matches_with_child_details():
    repo = FakeRepository()
    service = KnowledgeService(repository=repo, embedding_fn=_embedding_fn)

    corpus_id = uuid4()
    app_name = "negentropy"
    parent_id = uuid4()
    first_child_id = uuid4()
    second_child_id = uuid4()

    repo.parent_results = [
        KnowledgeMatch(
            id=parent_id,
            content="parent chunk content",
            source_uri="doc://hierarchical",
            metadata={
                "chunk_role": "parent",
                "chunk_family_id": "family-1",
                "parent_chunk_index": 6,
            },
            semantic_score=0.0,
            keyword_score=0.0,
            combined_score=0.0,
        )
    ]
    repo.chunk_indices = {
        first_child_id: 13,
        second_child_id: 8,
    }
    repo.keyword_results = [
        KnowledgeMatch(
            id=first_child_id,
            content="first child snippet",
            source_uri="doc://hierarchical",
            metadata={
                "chunk_role": "child",
                "chunk_family_id": "family-1",
                "child_chunk_index": 13,
            },
            semantic_score=0.0,
            keyword_score=0.43,
            combined_score=0.43,
        ),
        KnowledgeMatch(
            id=second_child_id,
            content="second child snippet",
            source_uri="doc://hierarchical",
            metadata={
                "chunk_role": "child",
                "chunk_family_id": "family-1",
                "child_chunk_index": 8,
            },
            semantic_score=0.0,
            keyword_score=0.40,
            combined_score=0.40,
        ),
    ]

    matches = await service.search(
        corpus_id=corpus_id,
        app_name=app_name,
        query="context",
        config=SearchConfig(mode="keyword", limit=10),
    )

    assert len(matches) == 1
    parent_match = matches[0]
    assert parent_match.id == parent_id
    assert parent_match.metadata["returned_parent_chunk"] is True
    assert parent_match.metadata["matched_child_chunk_indices"] == [13, 8]
    assert parent_match.metadata["matched_child_chunks"] == [
        {
            "id": str(first_child_id),
            "child_chunk_index": 13,
            "content": "first child snippet",
            "semantic_score": 0.0,
            "keyword_score": 0.43,
            "combined_score": 0.43,
        },
        {
            "id": str(second_child_id),
            "child_chunk_index": 8,
            "content": "second child snippet",
            "semantic_score": 0.0,
            "keyword_score": 0.4,
            "combined_score": 0.4,
        },
    ]


async def test_ingest_text_with_hierarchical_chunking_preserves_parent_child_metadata(monkeypatch):
    repo = FakeRepository()
    service = KnowledgeService(repository=repo, embedding_fn=_embedding_fn)

    class FakeDocumentStorageService:
        async def get_document_by_source_uri(self, *, source_uri, corpus_id, app_name):
            _ = (source_uri, corpus_id, app_name)
            return None

    monkeypatch.setattr(
        "negentropy.storage.service.DocumentStorageService",
        lambda: FakeDocumentStorageService(),
    )

    corpus_id = uuid4()
    app_name = "negentropy"
    text = (
        "第一章介绍上下文工程的基础概念，并说明为什么需要稳定的知识索引。\n\n"
        "第二章描述摄入链路、父子分块以及检索时返回父块的行为。"
    )

    records = await service.ingest_text(
        corpus_id=corpus_id,
        app_name=app_name,
        text=text,
        source_uri="gs://knowledge/context-engineering.pdf",
        metadata={"source_type": "file", "original_filename": "context-engineering.pdf"},
        chunking_config=ChunkingConfig(
            strategy=ChunkingStrategy.HIERARCHICAL,
            hierarchical_parent_chunk_size=36,
            hierarchical_child_chunk_size=18,
            hierarchical_child_overlap=4,
        ),
    )

    assert records
    assert repo.added

    parent_chunks = [chunk for chunk in repo.added if chunk.metadata.get("chunk_role") == "parent"]
    child_chunks = [chunk for chunk in repo.added if chunk.metadata.get("chunk_role") == "child"]

    assert parent_chunks
    assert child_chunks
    assert all(chunk.metadata["chunking_strategy"] == "hierarchical" for chunk in repo.added)
    assert all(chunk.metadata["hierarchy_level"] == 0 for chunk in parent_chunks)
    assert all(chunk.metadata["hierarchy_level"] == 1 for chunk in child_chunks)
    assert all(chunk.metadata["searchable"] is False for chunk in parent_chunks)
    assert all(chunk.metadata["searchable"] is True for chunk in child_chunks)

    parent_family_ids = {chunk.metadata["chunk_family_id"] for chunk in parent_chunks}
    child_family_ids = {chunk.metadata["chunk_family_id"] for chunk in child_chunks}
    assert child_family_ids.issubset(parent_family_ids)
    assert all(chunk.metadata["hierarchical_parent_id"] == chunk.metadata["chunk_family_id"] for chunk in child_chunks)
