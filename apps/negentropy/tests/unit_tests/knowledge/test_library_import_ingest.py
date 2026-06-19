"""文档库（Library）Import Document 与 Ingest Document 单元测试。

覆盖：
- ``POST /documents/import_url`` / ``POST /documents/import_file`` API 契约
  （operation / source_type / 后台任务参数 / 大小校验 / 存储失败致命）；
- ``POST /base/{corpus_id}/ingest_document`` API 契约
  （404 / 409 / 400 守卫与成功路径 input_data）；
- ``retry_pipeline_run`` 的 operation guard
  （import_document 不可重试；ingest_document 正确重放）；
- 存储层库文档路径与查重边界（``_corpus_segment`` / 衍生路径 / app_name 必填）；
- ``execute_import_file_pipeline`` 短路与失败状态回写；
- ``execute_ingest_document_pipeline`` fail-loud 守卫与 replace 幂等语义。
"""

from __future__ import annotations

from io import BytesIO
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from fastapi import BackgroundTasks, HTTPException, UploadFile

from negentropy.knowledge.routes import ingest as ingest_routes
from negentropy.knowledge.routes import library as library_routes
from negentropy.knowledge.routes import pipelines as pipeline_routes
from negentropy.knowledge.schemas import ImportUrlRequest, IngestDocumentRequest, PipelineRetryRequest
from negentropy.knowledge.service import KnowledgeService
from negentropy.knowledge.types import KnowledgeRecord
from negentropy.storage.service import DocumentStorageService

from .conftest import FakeKnowledgeService, FakePipelineDao, FakePipelineRun

APP = "negentropy"


def _async_return(value):
    """返回一个 async 函数，调用时直接返回 *value*。"""

    async def _fn(*_a, **_kw):
        return value

    return _fn


def _make_doc(
    *,
    corpus_id: UUID | None = None,
    markdown_extract_status: str = "completed",
    status: str = "active",
    metadata: dict | None = None,
    content_uri: str = "gs://bucket/knowledge/negentropy/library/doc.md",
) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid4(),
        corpus_id=corpus_id,
        app_name=APP,
        status=status,
        markdown_extract_status=markdown_extract_status,
        original_filename="doc.md",
        content_type="text/markdown",
        content_uri=content_uri,
        metadata_=metadata or {},
    )


class _RecordingStorage:
    """import/ingest 路由所需的最小存储替身。"""

    def __init__(self, *, doc=None, upload_result=None, upload_error: Exception | None = None):
        self.doc = doc
        self.upload_result = upload_result
        self.upload_error = upload_error
        self.upload_calls: list[dict] = []

    async def upload_and_store(self, **kwargs):
        self.upload_calls.append(kwargs)
        if self.upload_error:
            raise self.upload_error
        return self.upload_result

    async def get_document(self, **kwargs):
        _ = kwargs
        return self.doc


def _upload_file(filename: str, content: bytes, content_type: str) -> UploadFile:
    return UploadFile(filename=filename, file=BytesIO(content), headers=None, size=len(content))


# ---------------------------------------------------------------------------
# Import URL API
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_import_document_url_creates_run_and_queues_pipeline(monkeypatch):
    fake_service = FakeKnowledgeService()
    monkeypatch.setattr(library_routes, "_get_service", lambda: fake_service)

    background_tasks = BackgroundTasks()
    resp = await library_routes.import_document_url(
        payload=ImportUrlRequest(url="https://example.com/article", app_name=APP),
        background_tasks=background_tasks,
        user=None,
    )

    assert resp.run_id == "run-test-001"
    assert resp.status == "running"

    assert len(fake_service.pipeline_calls) == 1
    call = fake_service.pipeline_calls[0]
    assert call["operation"] == "import_document"
    assert call["input_data"]["source_type"] == "url"
    assert call["input_data"]["url"] == "https://example.com/article"
    assert call["input_data"]["corpus_id"] is None

    assert len(background_tasks.tasks) == 1
    task_kwargs = background_tasks.tasks[0].kwargs
    assert task_kwargs["url"] == "https://example.com/article"
    assert task_kwargs["app_name"] == APP


# ---------------------------------------------------------------------------
# Import File API
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("filename", "content_type", "expected_source_type"),
    [
        ("notes.md", "text/markdown", "file_md"),
        ("paper.pdf", "application/pdf", "file_pdf"),
    ],
)
async def test_import_document_file_creates_library_doc_and_run(
    monkeypatch, filename, content_type, expected_source_type
):
    fake_service = FakeKnowledgeService()
    doc = _make_doc(markdown_extract_status="pending")
    storage = _RecordingStorage(upload_result=(doc, True))

    monkeypatch.setattr(library_routes, "_get_service", lambda: fake_service)
    monkeypatch.setattr("negentropy.storage.service.DocumentStorageService", lambda: storage)

    background_tasks = BackgroundTasks()
    resp = await library_routes.import_document_file(
        background_tasks=background_tasks,
        file=_upload_file(filename, b"# hello", content_type),
        app_name=APP,
        user=None,
    )

    assert resp.status == "running"

    # 路由层同步上传：corpus_id=None（文档库）
    assert storage.upload_calls[0]["corpus_id"] is None
    assert storage.upload_calls[0]["app_name"] == APP

    call = fake_service.pipeline_calls[0]
    assert call["operation"] == "import_document"
    assert call["input_data"]["source_type"] == expected_source_type
    assert call["input_data"]["document_id"] == str(doc.id)
    assert call["input_data"]["corpus_id"] is None

    assert len(background_tasks.tasks) == 1
    assert background_tasks.tasks[0].kwargs["document_id"] == doc.id


@pytest.mark.asyncio
async def test_import_document_file_rejects_oversized_file(monkeypatch):
    # settings 为 frozen pydantic model，按模块引用替换为轻量替身
    monkeypatch.setattr(
        library_routes,
        "settings",
        SimpleNamespace(knowledge=SimpleNamespace(max_file_size_mb=1)),
    )

    with pytest.raises(HTTPException) as exc_info:
        await library_routes.import_document_file(
            background_tasks=BackgroundTasks(),
            file=_upload_file("big.pdf", b"x" * (1024 * 1024 + 1), "application/pdf"),
            app_name=APP,
            user=None,
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail["code"] == "FILE_TOO_LARGE"


@pytest.mark.asyncio
async def test_import_document_file_storage_failure_is_fatal(monkeypatch):
    from negentropy.storage.gcs_client import StorageError

    storage = _RecordingStorage(upload_error=StorageError("bucket unavailable"))
    monkeypatch.setattr("negentropy.storage.service.DocumentStorageService", lambda: storage)

    with pytest.raises(HTTPException) as exc_info:
        await library_routes.import_document_file(
            background_tasks=BackgroundTasks(),
            file=_upload_file("doc.md", b"# hi", "text/markdown"),
            app_name=APP,
            user=None,
        )

    # 与 ingest_file 的"降级继续"不同：无存储的导入无意义，必须 fail-loud
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail["code"] == "STORAGE_FAILED"


# ---------------------------------------------------------------------------
# Ingest Document API
# ---------------------------------------------------------------------------


class _IngestFakeService(FakeKnowledgeService):
    def __init__(self, *, corpus=None):
        super().__init__()
        self._corpus = corpus

    async def get_corpus_by_id(self, corpus_id):
        _ = corpus_id
        return self._corpus


@pytest.mark.asyncio
async def test_ingest_document_corpus_not_found(monkeypatch):
    monkeypatch.setattr(ingest_routes, "_get_service", lambda: _IngestFakeService(corpus=None))

    with pytest.raises(HTTPException) as exc_info:
        await ingest_routes.ingest_document(
            corpus_id=uuid4(),
            payload=IngestDocumentRequest(document_id=uuid4(), app_name=APP),
            background_tasks=BackgroundTasks(),
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail["code"] == "CORPUS_NOT_FOUND"


@pytest.mark.asyncio
async def test_ingest_document_document_not_found(monkeypatch):
    monkeypatch.setattr(ingest_routes, "_get_service", lambda: _IngestFakeService(corpus=SimpleNamespace(config={})))
    monkeypatch.setattr("negentropy.storage.service.DocumentStorageService", lambda: _RecordingStorage(doc=None))

    with pytest.raises(HTTPException) as exc_info:
        await ingest_routes.ingest_document(
            corpus_id=uuid4(),
            payload=IngestDocumentRequest(document_id=uuid4(), app_name=APP),
            background_tasks=BackgroundTasks(),
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail["code"] == "DOCUMENT_NOT_FOUND"


@pytest.mark.asyncio
async def test_ingest_document_markdown_not_ready_conflicts(monkeypatch):
    doc = _make_doc(markdown_extract_status="processing")
    monkeypatch.setattr(ingest_routes, "_get_service", lambda: _IngestFakeService(corpus=SimpleNamespace(config={})))
    monkeypatch.setattr("negentropy.storage.service.DocumentStorageService", lambda: _RecordingStorage(doc=doc))

    with pytest.raises(HTTPException) as exc_info:
        await ingest_routes.ingest_document(
            corpus_id=uuid4(),
            payload=IngestDocumentRequest(document_id=doc.id, app_name=APP),
            background_tasks=BackgroundTasks(),
        )

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail["code"] == "DOCUMENT_MARKDOWN_NOT_READY"


@pytest.mark.asyncio
async def test_ingest_document_without_source_uri_rejected(monkeypatch):
    doc = _make_doc(content_uri="")  # 无 origin_url 且无 content_uri → source_uri 不可解析
    monkeypatch.setattr(ingest_routes, "_get_service", lambda: _IngestFakeService(corpus=SimpleNamespace(config={})))
    monkeypatch.setattr("negentropy.storage.service.DocumentStorageService", lambda: _RecordingStorage(doc=doc))

    with pytest.raises(HTTPException) as exc_info:
        await ingest_routes.ingest_document(
            corpus_id=uuid4(),
            payload=IngestDocumentRequest(document_id=doc.id, app_name=APP),
            background_tasks=BackgroundTasks(),
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail["code"] == "INVALID_DOCUMENT_SOURCE"


@pytest.mark.asyncio
async def test_ingest_document_success_cross_corpus(monkeypatch):
    source_corpus_id = uuid4()
    target_corpus_id = uuid4()
    doc = _make_doc(
        corpus_id=source_corpus_id,
        metadata={"source_type": "url", "origin_url": "https://example.com/a"},
    )
    fake_service = _IngestFakeService(corpus=SimpleNamespace(config={}))
    monkeypatch.setattr(ingest_routes, "_get_service", lambda: fake_service)
    monkeypatch.setattr("negentropy.storage.service.DocumentStorageService", lambda: _RecordingStorage(doc=doc))

    background_tasks = BackgroundTasks()
    resp = await ingest_routes.ingest_document(
        corpus_id=target_corpus_id,
        payload=IngestDocumentRequest(document_id=doc.id, app_name=APP),
        background_tasks=background_tasks,
    )

    assert resp.status == "running"
    call = fake_service.pipeline_calls[0]
    assert call["operation"] == "ingest_document"
    assert call["input_data"]["corpus_id"] == str(target_corpus_id)
    assert call["input_data"]["document_id"] == str(doc.id)
    # URL 文档 source_uri 取 origin_url（与 chunks 列表的关联键一致）
    assert call["input_data"]["source_uri"] == "https://example.com/a"
    assert call["input_data"]["source_document_corpus_id"] == str(source_corpus_id)

    task_kwargs = background_tasks.tasks[0].kwargs
    assert task_kwargs["corpus_id"] == target_corpus_id
    assert task_kwargs["document_id"] == doc.id


# ---------------------------------------------------------------------------
# Retry operation guard
# ---------------------------------------------------------------------------


def _make_retry_dao(operation: str, *, input_data: dict) -> FakePipelineDao:
    dao = FakePipelineDao()
    dao.records[(APP, "run-original")] = FakePipelineRun(
        app_name=APP,
        run_id="run-original",
        status="failed",
        payload={"operation": operation, "input": input_data},
    )
    return dao


@pytest.mark.asyncio
async def test_retry_rejects_import_document_runs(monkeypatch):
    dao = _make_retry_dao(
        "import_document",
        input_data={"document_id": str(uuid4()), "corpus_id": None, "source_type": "file_pdf"},
    )
    monkeypatch.setattr(pipeline_routes, "_get_dao", lambda: dao)
    monkeypatch.setattr(pipeline_routes, "_get_service", lambda: FakeKnowledgeService())

    with pytest.raises(HTTPException) as exc_info:
        await pipeline_routes.retry_pipeline_run(
            run_id="run-original",
            background_tasks=BackgroundTasks(),
            payload=PipelineRetryRequest(app_name=APP),
            user=None,
        )

    assert exc_info.value.status_code == 422
    assert "not retryable" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_retry_ingest_document_replays_ingest_document_pipeline(monkeypatch):
    corpus_id = uuid4()
    doc = _make_doc(corpus_id=None)
    dao = _make_retry_dao(
        "ingest_document",
        input_data={
            "document_id": str(doc.id),
            "corpus_id": str(corpus_id),
            "source_uri": doc.content_uri,
        },
    )
    fake_service = FakeKnowledgeService()
    monkeypatch.setattr(pipeline_routes, "_get_dao", lambda: dao)
    monkeypatch.setattr(pipeline_routes, "_get_service", lambda: fake_service)
    monkeypatch.setattr("negentropy.storage.service.DocumentStorageService", lambda: _RecordingStorage(doc=doc))

    background_tasks = BackgroundTasks()
    resp = await pipeline_routes.retry_pipeline_run(
        run_id="run-original",
        background_tasks=background_tasks,
        payload=PipelineRetryRequest(app_name=APP),
        user=None,
    )

    assert resp.status == "running"
    call = fake_service.pipeline_calls[0]
    # guard 生效：按 ingest_document 重放，而非误判为 ingest_file 重提取
    assert call["operation"] == "ingest_document"
    assert call["input_data"]["retried_from"]["run_id"] == "run-original"

    task = background_tasks.tasks[0]
    assert task.func == fake_service.execute_ingest_document_pipeline
    assert task.kwargs["document_id"] == doc.id


# ---------------------------------------------------------------------------
# 存储层：库文档路径与查重边界
# ---------------------------------------------------------------------------


def test_corpus_segment_library_fallback():
    corpus_id = uuid4()
    assert DocumentStorageService._corpus_segment(corpus_id) == str(corpus_id)
    assert DocumentStorageService._corpus_segment(None) == "library"


def test_derived_paths_use_library_segment_for_corpusless_docs():
    document_id = uuid4()
    md_path = DocumentStorageService._build_markdown_path(
        app_name=APP, corpus_id=None, document_id=document_id, filename="paper.pdf"
    )
    asset_path = DocumentStorageService._build_asset_path(
        app_name=APP, corpus_id=None, document_id=document_id, filename="img.png"
    )
    assert md_path == f"knowledge/{APP}/library/derived/{document_id}/paper.md"
    assert asset_path == f"knowledge/{APP}/library/derived/{document_id}/assets/img.png"


@pytest.mark.asyncio
async def test_check_duplicate_library_requires_app_name():
    service = DocumentStorageService()
    with pytest.raises(ValueError, match="app_name is required"):
        await service.check_duplicate(None, "deadbeef")


# ---------------------------------------------------------------------------
# Pipeline：execute_import_file_pipeline
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_import_file_pipeline_short_circuits_on_completed_duplicate(monkeypatch):
    dao = FakePipelineDao()
    service = KnowledgeService(repository=SimpleNamespace(), pipeline_dao=dao)
    doc = _make_doc(markdown_extract_status="completed")
    monkeypatch.setattr("negentropy.storage.service.DocumentStorageService", lambda: _RecordingStorage(doc=doc))

    run_id = await service.create_pipeline(
        app_name=APP,
        operation="import_document",
        input_data={"source_type": "file_md", "document_id": str(doc.id), "filename": "doc.md"},
    )
    result = await service.execute_import_file_pipeline(
        run_id=run_id,
        app_name=APP,
        document_id=doc.id,
        content=b"# hi",
        filename="doc.md",
        content_type="text/markdown",
    )

    assert result == doc.id
    record = dao.records[(APP, run_id)]
    assert record.status == "completed"
    assert record.payload["output"]["duplicate_document"] is True
    assert record.payload["output"]["skipped"] == "markdown_already_extracted"


@pytest.mark.asyncio
async def test_import_file_pipeline_failure_marks_doc_failed(monkeypatch):
    dao = FakePipelineDao()
    service = KnowledgeService(repository=SimpleNamespace(), pipeline_dao=dao)
    doc = _make_doc(markdown_extract_status="pending")

    status_updates: list[dict] = []

    class _FailureStorage(_RecordingStorage):
        async def update_markdown_extraction_status(self, **kwargs):
            status_updates.append(kwargs)
            return True

    monkeypatch.setattr("negentropy.storage.service.DocumentStorageService", lambda: _FailureStorage(doc=doc))

    async def fake_extract(**kwargs):
        _ = kwargs
        raise ValueError("extract exploded")

    monkeypatch.setattr(
        "negentropy.knowledge._shared._resolve_library_extractor_config",
        _async_return({"extractor_routes": {}}),
    )
    monkeypatch.setattr(service, "_extract_file_document", fake_extract)

    run_id = await service.create_pipeline(
        app_name=APP,
        operation="import_document",
        input_data={"source_type": "file_pdf", "document_id": str(doc.id), "filename": "p.pdf"},
    )
    result = await service.execute_import_file_pipeline(
        run_id=run_id,
        app_name=APP,
        document_id=doc.id,
        content=b"%PDF",
        filename="p.pdf",
        content_type="application/pdf",
    )

    assert result is None
    record = dao.records[(APP, run_id)]
    assert record.status == "failed"
    # 文档不应停留在 processing：失败路径回写 failed 状态
    assert status_updates[0]["status"] == "processing"
    assert status_updates[-1]["status"] == "failed"
    assert "extract exploded" in status_updates[-1]["error"]


# ---------------------------------------------------------------------------
# Pipeline：execute_ingest_document_pipeline
# ---------------------------------------------------------------------------


class _ReplaceRecordingRepository:
    """记录 replace 持久化调用的最小 repository 替身（按真实契约返回 KnowledgeRecord）。"""

    def __init__(self):
        self.replace_calls: list[dict] = []

    async def get_corpus_by_id(self, corpus_id):
        _ = corpus_id
        return SimpleNamespace(config={})

    async def replace_knowledge_by_source(self, *, corpus_id, app_name, source_uri, chunks):
        chunk_list = list(chunks)
        self.replace_calls.append(
            {
                "corpus_id": corpus_id,
                "app_name": app_name,
                "source_uri": source_uri,
                "chunks": chunk_list,
            }
        )
        records = [
            KnowledgeRecord(
                id=uuid4(),
                corpus_id=corpus_id,
                app_name=app_name,
                content=chunk.content,
                source_uri=source_uri,
                chunk_index=index,
                character_count=len(chunk.content),
                metadata=dict(chunk.metadata or {}),
            )
            for index, chunk in enumerate(chunk_list)
        ]
        return 2, records


class _MarkdownStorage(_RecordingStorage):
    def __init__(self, *, doc, markdown: str | None):
        super().__init__(doc=doc)
        self.markdown = markdown

    async def get_document_markdown(self, document_id):
        _ = document_id
        return self.markdown

    async def get_document_by_source_uri(self, **kwargs):
        _ = kwargs
        return self.doc

    async def update_document_metadata(self, **kwargs):
        _ = kwargs
        return True


@pytest.mark.asyncio
async def test_ingest_document_pipeline_replaces_into_target_corpus(monkeypatch):
    dao = FakePipelineDao()
    repository = _ReplaceRecordingRepository()
    service = KnowledgeService(repository=repository, pipeline_dao=dao)

    source_corpus_id = uuid4()
    target_corpus_id = uuid4()
    doc = _make_doc(
        corpus_id=source_corpus_id,
        metadata={"source_type": "url", "origin_url": "https://example.com/a"},
    )
    monkeypatch.setattr(
        "negentropy.storage.service.DocumentStorageService",
        lambda: _MarkdownStorage(doc=doc, markdown="# Title\n\nbody text"),
    )

    run_id = await service.create_pipeline(
        app_name=APP,
        operation="ingest_document",
        input_data={"corpus_id": str(target_corpus_id), "document_id": str(doc.id)},
    )
    records = await service.execute_ingest_document_pipeline(
        run_id=run_id,
        corpus_id=target_corpus_id,
        app_name=APP,
        document_id=doc.id,
    )

    assert records
    record = dao.records[(APP, run_id)]
    assert record.status == "completed"
    assert record.payload["output"]["chunk_count"] == len(records)
    assert record.payload["output"]["deleted_count"] == 2
    assert record.payload["stages"]["download"]["status"] == "completed"
    assert record.payload["stages"]["persist"]["output"]["mode"] == "replace"

    # chunks 建在目标 corpus；source_uri 与 metadata.document_id 维持关联键
    replace_call = repository.replace_calls[0]
    assert replace_call["corpus_id"] == target_corpus_id
    assert replace_call["source_uri"] == "https://example.com/a"
    chunk_meta = replace_call["chunks"][0].metadata
    assert chunk_meta["document_id"] == str(doc.id)
    assert chunk_meta["ingested_from_corpus_id"] == str(source_corpus_id)
    assert chunk_meta["ingest_operation"] == "ingest_document"


@pytest.mark.asyncio
async def test_ingest_document_pipeline_fails_loud_when_markdown_not_ready(monkeypatch):
    dao = FakePipelineDao()
    service = KnowledgeService(repository=_ReplaceRecordingRepository(), pipeline_dao=dao)
    doc = _make_doc(markdown_extract_status="processing")
    monkeypatch.setattr(
        "negentropy.storage.service.DocumentStorageService",
        lambda: _MarkdownStorage(doc=doc, markdown=None),
    )

    run_id = await service.create_pipeline(
        app_name=APP,
        operation="ingest_document",
        input_data={"corpus_id": str(uuid4()), "document_id": str(doc.id)},
    )
    records = await service.execute_ingest_document_pipeline(
        run_id=run_id,
        corpus_id=uuid4(),
        app_name=APP,
        document_id=doc.id,
    )

    assert records == []
    record = dao.records[(APP, run_id)]
    assert record.status == "failed"
    assert record.payload["error"]["type"] == "KnowledgeError"
    assert "markdown is not ready" in record.payload["error"]["message"]


@pytest.mark.asyncio
async def test_ingest_document_pipeline_fails_loud_when_markdown_empty(monkeypatch):
    dao = FakePipelineDao()
    service = KnowledgeService(repository=_ReplaceRecordingRepository(), pipeline_dao=dao)
    doc = _make_doc()
    monkeypatch.setattr(
        "negentropy.storage.service.DocumentStorageService",
        lambda: _MarkdownStorage(doc=doc, markdown="   "),
    )

    run_id = await service.create_pipeline(
        app_name=APP,
        operation="ingest_document",
        input_data={"corpus_id": str(uuid4()), "document_id": str(doc.id)},
    )
    records = await service.execute_ingest_document_pipeline(
        run_id=run_id,
        corpus_id=uuid4(),
        app_name=APP,
        document_id=doc.id,
    )

    assert records == []
    record = dao.records[(APP, run_id)]
    assert record.status == "failed"
    assert record.payload["error"]["type"] == "KnowledgeError"
    assert "markdown content is empty" in record.payload["error"]["message"]
