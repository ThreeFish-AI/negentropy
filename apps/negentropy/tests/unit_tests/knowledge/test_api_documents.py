"""Document 操作 API 路由单元测试。

覆盖文档分块列表查询、文档同步、文档重建、文件摄入以及搜索路由
在各种正常与异常场景下的行为验证。
"""

from __future__ import annotations

from io import BytesIO
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import BackgroundTasks, HTTPException, UploadFile

from negentropy.knowledge import api as knowledge_api
from negentropy.knowledge.types import ChunkingStrategy

from .conftest import FakeKnowledgeService, FakeStorageService


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

    from negentropy.knowledge.extraction import ExtractedDocumentResult

    async def fake_extract_source(**kwargs):
        return ExtractedDocumentResult(
            plain_text="content",
            markdown_content="# title\n\ncontent",
        )

    async def fake_persist_extracted_assets(**kwargs):
        return []

    monkeypatch.setattr("negentropy.storage.service.DocumentStorageService", lambda: fake_storage)
    monkeypatch.setattr(knowledge_api, "_get_service", lambda: fake_service)
    monkeypatch.setattr(knowledge_api, "extract_source", fake_extract_source)
    monkeypatch.setattr(knowledge_api, "persist_extracted_assets", fake_persist_extracted_assets)

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
async def test_ingest_file_passes_hierarchical_chunking_config_to_service(monkeypatch):
    corpus_id = uuid4()
    document_id = uuid4()
    fake_doc = SimpleNamespace(
        id=document_id,
        gcs_uri="gs://negentropy/knowledge/context-engineering.pdf",
        markdown_extract_status="pending",
    )
    fake_storage = FakeStorageService(doc=fake_doc)
    fake_service = FakeKnowledgeService()

    monkeypatch.setattr("negentropy.storage.service.DocumentStorageService", lambda: fake_storage)
    monkeypatch.setattr(knowledge_api, "_get_service", lambda: fake_service)

    result = await knowledge_api.ingest_file(
        corpus_id=corpus_id,
        background_tasks=BackgroundTasks(),
        file=UploadFile(
            file=BytesIO(b"%PDF-1.4 mock content"),
            filename="Context Engineering.pdf",
            headers=None,
        ),
        app_name="negentropy",
        source_uri=None,
        metadata=None,
        strategy="hierarchical",
        chunk_size=None,
        overlap=None,
        preserve_newlines=None,
        separators=None,
        semantic_threshold=None,
        semantic_buffer_size=None,
        min_chunk_size=None,
        max_chunk_size=None,
        hierarchical_parent_chunk_size=1200,
        hierarchical_child_chunk_size=300,
        hierarchical_child_overlap=60,
        store_to_gcs=True,
    )

    assert result.run_id == "run-test-001"
    assert result.status == "running"
    assert fake_storage.upload_and_store_calls
    assert fake_service.pipeline_calls

    pipeline_call = fake_service.pipeline_calls[0]
    assert pipeline_call["operation"] == "ingest_file"
    assert pipeline_call["input_data"]["document_id"] == str(document_id)
    chunking_config = pipeline_call["input_data"]["chunking_config"]
    assert chunking_config["strategy"] == "hierarchical"
    assert pipeline_call["input_data"]["duplicate_document"] is False

    assert not fake_service.ingest_text_calls

    background_call = fake_service.ingest_file_pipeline_calls[0] if fake_service.ingest_file_pipeline_calls else None
    assert background_call is None

    queued_chunking_config = knowledge_api._resolve_chunking_config(
        chunking_config=None,
        legacy_payload={
            "strategy": "hierarchical",
            "hierarchical_parent_chunk_size": 1200,
            "hierarchical_child_chunk_size": 300,
            "hierarchical_child_overlap": 60,
        },
        corpus_config={},
    )
    assert queued_chunking_config.strategy == ChunkingStrategy.HIERARCHICAL

    background_tasks = BackgroundTasks()
    background_tasks.add_task(
        fake_service.execute_ingest_file_pipeline,
        run_id=result.run_id,
        corpus_id=corpus_id,
        app_name="negentropy",
        content=b"%PDF-1.4 mock content",
        filename="Context Engineering.pdf",
        content_type=None,
        source_uri=fake_doc.gcs_uri,
        metadata={"document_id": str(document_id)},
        chunking_config=queued_chunking_config,
        document_id=document_id,
    )
    for task in background_tasks.tasks:
        await task()

    queued_call = fake_service.ingest_file_pipeline_calls[0]
    chunking_config = queued_call["chunking_config"]
    assert chunking_config.strategy == ChunkingStrategy.HIERARCHICAL
    assert chunking_config.hierarchical_parent_chunk_size == 1200
    assert chunking_config.hierarchical_child_chunk_size == 300
    assert chunking_config.hierarchical_child_overlap == 60
    assert queued_call["source_uri"] == fake_doc.gcs_uri
    assert queued_call["metadata"]["document_id"] == str(document_id)


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
