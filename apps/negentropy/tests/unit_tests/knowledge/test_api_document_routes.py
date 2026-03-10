from __future__ import annotations

from io import BytesIO
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import BackgroundTasks, FastAPI, HTTPException, UploadFile
from fastapi.testclient import TestClient

from negentropy.knowledge import api as knowledge_api
from negentropy.knowledge.types import ChunkingStrategy, KnowledgeMatch, KnowledgeRecord


class FakeStorageService:
    def __init__(self, doc: SimpleNamespace | None = None, markdown: str | None = None):
        self.doc = doc
        self.markdown = markdown
        self.saved_markdown: str | None = None
        self.saved_markdown_gcs_uri: str | None = None
        self.uploaded_markdown: str | None = None
        self.upload_and_store_calls: list[dict[str, object]] = []

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

    async def upload_and_store(self, **kwargs):
        self.upload_and_store_calls.append(kwargs)
        if self.doc is None:
            self.doc = SimpleNamespace(
                id=uuid4(),
                gcs_uri="gs://negentropy/knowledge/test.pdf",
                markdown_extract_status="pending",
            )
        return self.doc, True


class FakeScalarSession:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def scalar(self, stmt):
        _ = stmt
        return 0


class FakeExecuteResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return list(self._rows)


class FakeDefaultRouteSession:
    def __init__(self, responses):
        self._responses = list(responses)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def execute(self, stmt):
        _ = stmt
        return FakeExecuteResult(self._responses.pop(0))


class FakeKnowledgeService:
    def __init__(self):
        self.list_knowledge_calls = []
        self.pipeline_calls = []
        self.search_calls = []
        self.ensure_corpus_calls = []
        self.update_corpus_calls = []
        self.ingest_text_calls = []
        self.ingest_file_pipeline_calls = []

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

    async def ensure_corpus(self, spec):
        self.ensure_corpus_calls.append(spec)
        return SimpleNamespace(
            id=uuid4(),
            app_name=spec.app_name,
            name=spec.name,
            description=spec.description,
            config=spec.config,
        )

    async def update_corpus(self, corpus_id, spec):
        self.update_corpus_calls.append({"corpus_id": corpus_id, "spec": spec})
        return SimpleNamespace(
            id=corpus_id,
            app_name="negentropy",
            name=spec.get("name", "updated-corpus"),
            description=spec.get("description"),
            config=spec.get("config", {}),
        )

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

    async def ingest_text(self, **kwargs):
        self.ingest_text_calls.append(kwargs)
        return [
            KnowledgeRecord(
                id=uuid4(),
                corpus_id=kwargs["corpus_id"],
                app_name=kwargs["app_name"],
                content="chunk content",
                source_uri=kwargs.get("source_uri"),
                chunk_index=0,
                metadata=kwargs.get("metadata", {}),
                created_at=None,
                updated_at=None,
                embedding=None,
            )
        ]

    async def execute_ingest_file_pipeline(self, **kwargs):
        self.ingest_file_pipeline_calls.append(kwargs)


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
async def test_create_corpus_serializes_chunking_strategy_to_string(monkeypatch):
    fake_service = FakeKnowledgeService()

    async def fake_default_routes():
        return {"url": {"targets": []}, "file_pdf": {"targets": []}}

    monkeypatch.setattr(knowledge_api, "_get_service", lambda: fake_service)
    monkeypatch.setattr(knowledge_api, "_resolve_default_extractor_routes", fake_default_routes)

    result = await knowledge_api.create_corpus(
        knowledge_api.CorpusCreateRequest(
            app_name="negentropy",
            name="docs",
            description="Knowledge base",
            config={
                "strategy": "hierarchical",
                "preserve_newlines": True,
                "separators": ["###"],
                "hierarchical_parent_chunk_size": 1500,
                "hierarchical_child_chunk_size": 500,
                "hierarchical_child_overlap": 150,
            },
        )
    )

    spec = fake_service.ensure_corpus_calls[0]
    assert spec.config["strategy"] == "hierarchical"
    assert isinstance(spec.config["strategy"], str)
    assert spec.config["separators"] == ["###"]


@pytest.mark.asyncio
async def test_get_pipelines_returns_diagnostic_summary_in_typed_response(monkeypatch):
    run_id = uuid4()

    class FakeDao:
        async def list_pipeline_runs(self, app_name: str, limit: int = 50):
            _ = (app_name, limit)
            return [
                SimpleNamespace(
                    id=run_id,
                    run_id="pipeline-1",
                    status="failed",
                    version=3,
                    payload={
                        "operation": "rebuild_source",
                        "stages": {
                            "extract_primary": {
                                "status": "failed",
                                "error": {
                                    "message": "Tool input schema could not be normalized for document extraction",
                                    "failure_category": "low_confidence_contract",
                                    "diagnostic_summary": "契约为 unknown，要求额外必填字段 opaque，当前提取源无法构造最小调用参数",
                                    "diagnostics": {"summary": "ignored because direct summary exists"},
                                },
                            }
                        },
                    },
                    updated_at=SimpleNamespace(isoformat=lambda: "2026-03-09T11:30:00+08:00"),
                )
            ]

    monkeypatch.setattr(knowledge_api, "_get_dao", lambda: FakeDao())

    result = await knowledge_api.get_pipelines(app_name="negentropy")

    assert result.last_updated_at == "2026-03-09T11:30:00+08:00"
    assert result.runs[0].stages["extract_primary"].error is not None
    assert result.runs[0].stages["extract_primary"].error.failure_category == "low_confidence_contract"
    assert (
        result.runs[0].stages["extract_primary"].error.diagnostic_summary
        == "契约为 unknown，要求额外必填字段 opaque，当前提取源无法构造最小调用参数"
    )


@pytest.mark.asyncio
async def test_get_pipelines_normalizes_null_output_payloads(monkeypatch):
    run_id = uuid4()

    class FakeDao:
        async def list_pipeline_runs(self, app_name: str, limit: int = 50):
            _ = (app_name, limit)
            return [
                SimpleNamespace(
                    id=run_id,
                    run_id="pipeline-null-output",
                    status="completed",
                    version=1,
                    payload={
                        "input": None,
                        "output": None,
                        "stages": {
                            "extract_primary": {
                                "status": "completed",
                                "output": None,
                            }
                        },
                    },
                    updated_at=SimpleNamespace(isoformat=lambda: "2026-03-09T16:30:00+08:00"),
                )
            ]

    monkeypatch.setattr(knowledge_api, "_get_dao", lambda: FakeDao())

    result = await knowledge_api.get_pipelines(app_name="negentropy")

    assert result.last_updated_at == "2026-03-09T16:30:00+08:00"
    assert result.runs[0].input == {}
    assert result.runs[0].output == {}
    assert result.runs[0].stages["extract_primary"].output == {}


def test_get_pipelines_openapi_includes_diagnostic_summary() -> None:
    app = FastAPI()
    app.include_router(knowledge_api.router)

    with TestClient(app) as client:
        schema = client.get("/openapi.json").json()

    pipeline_error_schema = schema["components"]["schemas"]["PipelineErrorPayloadResponse"]
    assert "diagnostic_summary" in pipeline_error_schema["properties"]
    assert (
        pipeline_error_schema["properties"]["diagnostic_summary"]["description"]
        == "一条可直接展示的摘要，默认用于契约类失败。"
    )


@pytest.mark.asyncio
async def test_upsert_pipelines_returns_typed_response(monkeypatch):
    class FakeDao:
        async def upsert_pipeline_run(
            self,
            *,
            app_name: str,
            run_id: str,
            status: str,
            payload: dict,
            idempotency_key,
            expected_version,
        ):
            _ = (app_name, run_id, status, payload, idempotency_key, expected_version)
            return SimpleNamespace(
                status="updated",
                record={
                    "id": str(uuid4()),
                    "run_id": "pipeline-2",
                    "status": "failed",
                    "payload": {
                        "stages": {
                            "extract_primary": {
                                "status": "failed",
                                "error": {
                                    "failure_category": "low_confidence_contract",
                                    "diagnostic_summary": "契约为 unknown，要求额外必填字段 opaque，当前提取源无法构造最小调用参数",
                                },
                            }
                        }
                    },
                    "version": 2,
                    "updated_at": "2026-03-09T11:40:00+08:00",
                },
            )

    monkeypatch.setattr(knowledge_api, "_get_dao", lambda: FakeDao())

    result = await knowledge_api.upsert_pipelines(
        knowledge_api.PipelinesUpsertRequest(
            app_name="negentropy",
            run_id="pipeline-2",
            status="failed",
            payload={},
        )
    )

    assert result.status == "updated"
    assert result.pipeline.run_id == "pipeline-2"
    assert result.pipeline.payload["stages"]["extract_primary"]["error"]["diagnostic_summary"].startswith("契约为 unknown")


def test_upsert_pipelines_openapi_uses_explicit_response_model() -> None:
    app = FastAPI()
    app.include_router(knowledge_api.router)

    with TestClient(app) as client:
        schema = client.get("/openapi.json").json()

    post_operation = schema["paths"]["/knowledge/pipelines"]["post"]
    response_schema = post_operation["responses"]["200"]["content"]["application/json"]["schema"]
    assert response_schema["$ref"] == "#/components/schemas/PipelineUpsertResponse"


@pytest.mark.asyncio
async def test_create_corpus_injects_backend_default_extractor_routes(monkeypatch):
    fake_service = FakeKnowledgeService()
    server_id = uuid4()

    class FakeDefaultExtractorRoutes:
        def model_dump(self, mode="python"):
            _ = mode
            return {
                "url": {
                    "primary": {
                        "server_name": "Data Extractor",
                        "tool_name": "convert_webpage_to_markdown",
                    },
                    "secondary": {
                        "server_name": "Data Extractor",
                        "tool_name": "batch_convert_webpages_to_markdown",
                    },
                },
                "file_pdf": {
                    "primary": {
                        "server_name": "Data Extractor",
                        "tool_name": "convert_pdfs_to_markdown",
                    },
                    "secondary": {
                        "server_name": "Data Extractor",
                        "tool_name": "batch_convert_pdfs_to_markdown",
                    },
                },
            }

    monkeypatch.setattr(knowledge_api, "_get_service", lambda: fake_service)
    monkeypatch.setattr(
        knowledge_api,
        "settings",
        SimpleNamespace(
            knowledge=SimpleNamespace(
                default_extractor_routes=FakeDefaultExtractorRoutes(),
            )
        ),
    )
    monkeypatch.setattr(
        knowledge_api,
        "AsyncSessionLocal",
        lambda: FakeDefaultRouteSession(
            responses=[
                [(server_id, "Data Extractor")],
                [
                    (server_id, "convert_webpage_to_markdown"),
                    (server_id, "batch_convert_webpages_to_markdown"),
                    (server_id, "convert_pdfs_to_markdown"),
                    (server_id, "batch_convert_pdfs_to_markdown"),
                ],
            ]
        ),
    )

    result = await knowledge_api.create_corpus(
        knowledge_api.CorpusCreateRequest(
            app_name="negentropy",
            name="docs",
            config={},
        )
    )

    spec = fake_service.ensure_corpus_calls[0]
    assert spec.config["extractor_routes"] == {
        "url": {
            "targets": [
                {
                    "server_id": str(server_id),
                    "tool_name": "convert_webpage_to_markdown",
                    "priority": 0,
                    "enabled": True,
                },
                {
                    "server_id": str(server_id),
                    "tool_name": "batch_convert_webpages_to_markdown",
                    "priority": 1,
                    "enabled": True,
                },
            ]
        },
        "file_pdf": {
            "targets": [
                {
                    "server_id": str(server_id),
                    "tool_name": "convert_pdfs_to_markdown",
                    "priority": 0,
                    "enabled": True,
                },
                {
                    "server_id": str(server_id),
                    "tool_name": "batch_convert_pdfs_to_markdown",
                    "priority": 1,
                    "enabled": True,
                },
            ]
        },
    }
    assert result.config["extractor_routes"]["url"]["targets"][0]["tool_name"] == "convert_webpage_to_markdown"


@pytest.mark.asyncio
async def test_create_corpus_keeps_explicit_extractor_routes_without_backend_override(monkeypatch):
    fake_service = FakeKnowledgeService()
    explicit_routes = {
        "url": {
            "targets": [
                {
                    "server_id": "server-explicit",
                    "tool_name": "explicit_web",
                    "priority": 0,
                    "enabled": True,
                }
            ]
        },
        "file_pdf": {"targets": []},
    }

    async def should_not_resolve_defaults():
        pytest.fail("should not resolve backend defaults when extractor_routes already provided")

    monkeypatch.setattr(knowledge_api, "_get_service", lambda: fake_service)
    monkeypatch.setattr(knowledge_api, "_resolve_default_extractor_routes", should_not_resolve_defaults)

    await knowledge_api.create_corpus(
        knowledge_api.CorpusCreateRequest(
            app_name="negentropy",
            name="docs",
            config={
                "strategy": "recursive",
                "extractor_routes": explicit_routes,
            },
        )
    )

    spec = fake_service.ensure_corpus_calls[0]
    assert spec.config["extractor_routes"] == explicit_routes


@pytest.mark.asyncio
async def test_update_corpus_serializes_chunking_strategy_to_string(monkeypatch):
    corpus_id = uuid4()
    fake_service = FakeKnowledgeService()

    monkeypatch.setattr(knowledge_api, "_get_service", lambda: fake_service)
    monkeypatch.setattr(knowledge_api, "AsyncSessionLocal", lambda: FakeScalarSession())

    result = await knowledge_api.update_corpus(
        corpus_id=corpus_id,
        payload=knowledge_api.CorpusUpdateRequest(
            config={
                "strategy": "hierarchical",
                "preserve_newlines": True,
                "separators": ["###"],
                "hierarchical_parent_chunk_size": 1500,
                "hierarchical_child_chunk_size": 500,
                "hierarchical_child_overlap": 150,
            }
        ),
    )

    update_call = fake_service.update_corpus_calls[0]
    assert update_call["corpus_id"] == corpus_id
    assert update_call["spec"]["config"]["strategy"] == "hierarchical"
    assert isinstance(update_call["spec"]["config"]["strategy"], str)
    assert update_call["spec"]["config"]["separators"] == ["###"]
    assert result.config["strategy"] == "hierarchical"


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
