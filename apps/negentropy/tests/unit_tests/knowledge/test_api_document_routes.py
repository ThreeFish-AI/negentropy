from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import BackgroundTasks, HTTPException

from negentropy.knowledge import api as knowledge_api
from negentropy.knowledge.types import ChunkingStrategy, KnowledgeMatch, KnowledgeRecord


class FakeStorageService:
    def __init__(self, doc: SimpleNamespace | None = None, markdown: str | None = None):
        self.doc = doc
        self.markdown = markdown
        self.saved_markdown: str | None = None
        self.saved_markdown_gcs_uri: str | None = None
        self.uploaded_markdown: str | None = None

    async def get_document(self, *, document_id, corpus_id=None, app_name=None):
        _ = (document_id, corpus_id, app_name)
        return self.doc

    async def upload_markdown_derivative(self, *, document_id, markdown_content: str):
        _ = document_id
        self.uploaded_markdown = markdown_content
        return "gs://derived/markdown.md"

    async def save_markdown_content(self, *, document_id, markdown_content: str, markdown_gcs_uri=None):
        _ = document_id
        self.saved_markdown = markdown_content
        self.saved_markdown_gcs_uri = markdown_gcs_uri
        return True

    async def get_document_markdown(self, document_id):
        _ = document_id
        return self.markdown


class FakeKnowledgeService:
    def __init__(self):
        self.list_knowledge_calls = []
        self.pipeline_calls = []
        self.search_calls = []

    async def list_knowledge(self, **kwargs):
        self.list_knowledge_calls.append(kwargs)
        item = KnowledgeRecord(
            id=uuid4(),
            corpus_id=kwargs["corpus_id"],
            app_name=kwargs["app_name"],
            content="chunk content",
            source_uri=kwargs.get("source_uri"),
            chunk_index=0,
            metadata={"k": "v"},
            created_at=None,
            updated_at=None,
            embedding=None,
        )
        return [item], 1, {}, []

    async def get_corpus_by_id(self, corpus_id):
        _ = corpus_id
        return SimpleNamespace(config={})

    async def create_pipeline(self, **kwargs):
        self.pipeline_calls.append(kwargs)
        return "run-test-001"

    async def execute_replace_source_pipeline(self, **kwargs):
        _ = kwargs

    async def execute_rebuild_source_pipeline(self, **kwargs):
        _ = kwargs

    async def search(self, **kwargs):
        self.search_calls.append(kwargs)
        return [
            KnowledgeMatch(
                id=uuid4(),
                content="search chunk content",
                source_uri="https://example.com/search",
                metadata={
                    "chunk_index": "47",
                    "returned_parent_chunk": True,
                    "parent_chunk_index": "6",
                    "matched_child_chunks": [
                        {
                            "id": "child-13",
                            "child_chunk_index": "13",
                            "content": "child chunk content",
                            "combined_score": 0.42,
                        }
                    ],
                },
                semantic_score=0.0,
                keyword_score=0.42,
                combined_score=0.42,
            )
        ]


@pytest.mark.asyncio
async def test_list_document_chunks_success(monkeypatch):
    corpus_id = uuid4()
    document_id = uuid4()
    doc = SimpleNamespace(
        id=document_id,
        metadata_={"source_type": "url", "origin_url": "https://example.com/a"},
        gcs_uri=None,
    )
    fake_storage = FakeStorageService(doc=doc)
    fake_service = FakeKnowledgeService()

    monkeypatch.setattr("negentropy.storage.service.DocumentStorageService", lambda: fake_storage)
    monkeypatch.setattr(knowledge_api, "_get_service", lambda: fake_service)

    result = await knowledge_api.list_document_chunks(
        corpus_id=corpus_id,
        document_id=document_id,
        app_name="negentropy",
        include_archived=False,
        limit=20,
        offset=0,
    )

    assert result.count == 1
    assert len(result.items) == 1
    assert result.items[0]["source_uri"] == "https://example.com/a"
    assert fake_service.list_knowledge_calls[0]["source_uri"] == "https://example.com/a"


@pytest.mark.asyncio
async def test_list_document_chunks_document_not_found(monkeypatch):
    corpus_id = uuid4()
    document_id = uuid4()
    fake_storage = FakeStorageService(doc=None)

    monkeypatch.setattr("negentropy.storage.service.DocumentStorageService", lambda: fake_storage)

    with pytest.raises(HTTPException) as exc_info:
        await knowledge_api.list_document_chunks(corpus_id=corpus_id, document_id=document_id)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail["code"] == "DOCUMENT_NOT_FOUND"


@pytest.mark.asyncio
async def test_list_document_chunks_invalid_source(monkeypatch):
    corpus_id = uuid4()
    document_id = uuid4()
    doc = SimpleNamespace(
        id=document_id,
        metadata_={"source_type": "file"},
        gcs_uri=None,
    )
    fake_storage = FakeStorageService(doc=doc)

    monkeypatch.setattr("negentropy.storage.service.DocumentStorageService", lambda: fake_storage)

    with pytest.raises(HTTPException) as exc_info:
        await knowledge_api.list_document_chunks(corpus_id=corpus_id, document_id=document_id)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail["code"] == "INVALID_DOCUMENT_SOURCE"


@pytest.mark.asyncio
async def test_sync_document_success(monkeypatch):
    corpus_id = uuid4()
    document_id = uuid4()
    source_url = "https://example.com/doc"
    doc = SimpleNamespace(
        id=document_id,
        metadata_={"source_type": "url", "origin_url": source_url},
        gcs_uri=None,
    )
    fake_storage = FakeStorageService(doc=doc)
    fake_service = FakeKnowledgeService()

    async def fake_fetch_content(url: str) -> str:
        assert url == source_url
        return "# title\n\ncontent"

    monkeypatch.setattr("negentropy.storage.service.DocumentStorageService", lambda: fake_storage)
    monkeypatch.setattr(knowledge_api, "_get_service", lambda: fake_service)
    monkeypatch.setattr("negentropy.knowledge.content.fetch_content", fake_fetch_content)
    monkeypatch.setattr("negentropy.knowledge.extraction.fetch_content", fake_fetch_content)

    result = await knowledge_api.sync_document(
        corpus_id=corpus_id,
        document_id=document_id,
        payload=knowledge_api.DocumentActionRequest(app_name="negentropy"),
        background_tasks=BackgroundTasks(),
    )

    assert result.status == "running"
    assert result.run_id == "run-test-001"
    assert fake_storage.saved_markdown is not None
    assert fake_service.pipeline_calls[-1]["input_data"]["sync_document"] is True


@pytest.mark.asyncio
async def test_sync_document_rejects_non_url(monkeypatch):
    corpus_id = uuid4()
    document_id = uuid4()
    doc = SimpleNamespace(
        id=document_id,
        metadata_={"source_type": "file"},
        gcs_uri="gs://bucket/file.pdf",
    )
    fake_storage = FakeStorageService(doc=doc)

    monkeypatch.setattr("negentropy.storage.service.DocumentStorageService", lambda: fake_storage)

    with pytest.raises(HTTPException) as exc_info:
        await knowledge_api.sync_document(
            corpus_id=corpus_id,
            document_id=document_id,
            payload=knowledge_api.DocumentActionRequest(app_name="negentropy"),
            background_tasks=BackgroundTasks(),
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail["code"] == "INVALID_DOCUMENT_TYPE"


@pytest.mark.asyncio
async def test_rebuild_document_url_requires_markdown(monkeypatch):
    corpus_id = uuid4()
    document_id = uuid4()
    doc = SimpleNamespace(
        id=document_id,
        metadata_={"source_type": "url", "origin_url": "https://example.com/doc"},
        gcs_uri=None,
    )
    fake_storage = FakeStorageService(doc=doc, markdown=None)
    fake_service = FakeKnowledgeService()

    monkeypatch.setattr("negentropy.storage.service.DocumentStorageService", lambda: fake_storage)
    monkeypatch.setattr(knowledge_api, "_get_service", lambda: fake_service)

    with pytest.raises(HTTPException) as exc_info:
        await knowledge_api.rebuild_document(
            corpus_id=corpus_id,
            document_id=document_id,
            payload=knowledge_api.DocumentActionRequest(app_name="negentropy"),
            background_tasks=BackgroundTasks(),
        )


def test_resolve_chunking_config_from_doc_request_prefers_payload_over_corpus():
    payload = knowledge_api.DocumentActionRequest(
        app_name="negentropy",
        strategy="hierarchical",
        chunk_size=900,
        semantic_threshold=0.9,
        hierarchical_parent_chunk_size=1200,
        hierarchical_child_chunk_size=300,
        hierarchical_child_overlap=60,
    )

    config = knowledge_api._resolve_chunking_config_from_doc_request(
        payload=payload,
        corpus_config={
            "strategy": "recursive",
            "chunk_size": 800,
            "overlap": 100,
            "hierarchical_child_overlap": 40,
        },
    )

    assert config is not None
    assert config.strategy == ChunkingStrategy.HIERARCHICAL
    assert config.hierarchical_parent_chunk_size == 1200
    assert config.hierarchical_child_chunk_size == 300
    assert config.hierarchical_child_overlap == 60


@pytest.mark.asyncio
async def test_rebuild_document_url_success(monkeypatch):
    corpus_id = uuid4()
    document_id = uuid4()
    source_url = "https://example.com/doc"
    doc = SimpleNamespace(
        id=document_id,
        metadata_={"source_type": "url", "origin_url": source_url},
        gcs_uri=None,
    )
    fake_storage = FakeStorageService(doc=doc, markdown="# m")
    fake_service = FakeKnowledgeService()

    monkeypatch.setattr("negentropy.storage.service.DocumentStorageService", lambda: fake_storage)
    monkeypatch.setattr(knowledge_api, "_get_service", lambda: fake_service)

    result = await knowledge_api.rebuild_document(
        corpus_id=corpus_id,
        document_id=document_id,
        payload=knowledge_api.DocumentActionRequest(app_name="negentropy"),
        background_tasks=BackgroundTasks(),
    )

    assert result.status == "running"
    assert fake_service.pipeline_calls[-1]["operation"] == "replace_source"
    assert fake_service.pipeline_calls[-1]["input_data"]["rebuild_document"] is True


@pytest.mark.asyncio
async def test_rebuild_document_file_requires_gcs(monkeypatch):
    corpus_id = uuid4()
    document_id = uuid4()
    doc = SimpleNamespace(
        id=document_id,
        metadata_={"source_type": "file"},
        gcs_uri=None,
    )
    fake_storage = FakeStorageService(doc=doc)
    fake_service = FakeKnowledgeService()

    monkeypatch.setattr("negentropy.storage.service.DocumentStorageService", lambda: fake_storage)
    monkeypatch.setattr(knowledge_api, "_get_service", lambda: fake_service)

    with pytest.raises(HTTPException) as exc_info:
        await knowledge_api.rebuild_document(
            corpus_id=corpus_id,
            document_id=document_id,
            payload=knowledge_api.DocumentActionRequest(app_name="negentropy"),
            background_tasks=BackgroundTasks(),
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail["code"] == "INVALID_DOCUMENT_SOURCE"


@pytest.mark.asyncio
async def test_rebuild_document_file_success(monkeypatch):
    corpus_id = uuid4()
    document_id = uuid4()
    gcs_uri = "gs://bucket/file.md"
    doc = SimpleNamespace(
        id=document_id,
        metadata_={"source_type": "file"},
        gcs_uri=gcs_uri,
    )
    fake_storage = FakeStorageService(doc=doc)
    fake_service = FakeKnowledgeService()

    monkeypatch.setattr("negentropy.storage.service.DocumentStorageService", lambda: fake_storage)
    monkeypatch.setattr(knowledge_api, "_get_service", lambda: fake_service)

    result = await knowledge_api.rebuild_document(
        corpus_id=corpus_id,
        document_id=document_id,
        payload=knowledge_api.DocumentActionRequest(app_name="negentropy"),
        background_tasks=BackgroundTasks(),
    )

    assert result.status == "running"
    assert fake_service.pipeline_calls[-1]["operation"] == "rebuild_source"
    assert fake_service.pipeline_calls[-1]["input_data"]["source_uri"] == gcs_uri


@pytest.mark.asyncio
async def test_search_route_preserves_chunk_indices_in_metadata(monkeypatch):
    corpus_id = uuid4()
    fake_service = FakeKnowledgeService()

    monkeypatch.setattr(knowledge_api, "_get_service", lambda: fake_service)

    result = await knowledge_api.search(
        corpus_id=corpus_id,
        payload=knowledge_api.SearchRequest(
            app_name="negentropy",
            query="context engineering",
            mode="hybrid",
            limit=10,
        ),
    )

    assert result["count"] == 1
    assert fake_service.search_calls[0]["query"] == "context engineering"
    assert result["items"][0]["metadata"]["chunk_index"] == "47"
    assert result["items"][0]["metadata"]["parent_chunk_index"] == "6"
    assert result["items"][0]["metadata"]["matched_child_chunks"][0]["child_chunk_index"] == "13"
