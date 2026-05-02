from __future__ import annotations

from uuid import uuid4

import pytest

from negentropy.knowledge.ingestion.extraction import ExtractedDocumentResult
from negentropy.knowledge.service import KnowledgeService, PipelineTracker

from .conftest import (
    FakeLogger,
    FakePipelineDao,
    FakePipelineRun,
    FakeRepository,
    FakeStorageService,
)


@pytest.mark.asyncio
async def test_pipeline_tracker_normalizes_empty_output_payloads() -> None:
    dao = FakePipelineDao()
    tracker = PipelineTracker(
        dao=dao,
        app_name="negentropy",
        operation="ingest_text",
        run_id="run-normalized",
    )

    await tracker.start({"source_uri": "memory://doc"})
    await tracker.start_stage("extract")
    await tracker.complete_stage("extract")
    await tracker.complete()

    record = dao.records[("negentropy", "run-normalized")]
    assert record.payload["input"] == {"source_uri": "memory://doc"}
    assert record.payload["output"] == {}
    assert record.payload["stages"]["extract"]["output"] == {}


@pytest.mark.asyncio
async def test_pipeline_tracker_resume_normalizes_legacy_null_output_payloads() -> None:
    dao = FakePipelineDao()
    dao.records[("negentropy", "run-legacy")] = FakePipelineRun(
        app_name="negentropy",
        run_id="run-legacy",
        status="running",
        payload={
            "input": None,
            "output": None,
            "stages": {
                "extract": {
                    "status": "completed",
                    "output": None,
                }
            },
        },
    )
    tracker = PipelineTracker(
        dao=dao,
        app_name="negentropy",
        operation="ingest_text",
        run_id="run-legacy",
    )

    await tracker.resume()
    await tracker.complete()

    record = dao.records[("negentropy", "run-legacy")]
    assert record.payload["input"] == {}
    assert record.payload["output"] == {}
    assert record.payload["stages"]["extract"]["output"] == {}


@pytest.mark.asyncio
async def test_pipeline_tracker_emits_run_and_stage_logs(monkeypatch) -> None:
    dao = FakePipelineDao()
    tracker = PipelineTracker(
        dao=dao,
        app_name="negentropy",
        operation="ingest_text",
        run_id="run-logs",
    )
    fake_logger = FakeLogger()
    monkeypatch.setattr("negentropy.knowledge.service.logger", fake_logger)

    await tracker.start({"corpus_id": "corpus-1", "source_uri": "memory://doc"})
    await tracker.start_stage("chunk")
    await tracker.complete_stage("chunk", {"chunk_count": 2})
    await tracker.complete({"chunk_count": 2})

    event_names = [event for event, _ in fake_logger.events]
    assert "pipeline_run_started" in event_names
    assert "pipeline_stage_started" in event_names
    assert "pipeline_stage_completed" in event_names
    assert "pipeline_run_completed" in event_names


@pytest.mark.asyncio
async def test_async_rebuild_pipeline_failure_persists_input_and_terminal_timestamps(monkeypatch):
    dao = FakePipelineDao()
    service = KnowledgeService(repository=FakeRepository(), pipeline_dao=dao)
    corpus_id = uuid4()
    app_name = "negentropy"
    source_uri = "gs://bucket/doc.md"

    monkeypatch.setattr("negentropy.storage.service.DocumentStorageService", lambda: FakeStorageService())

    async def fake_extract_file_document(**kwargs):
        _ = kwargs
        return ExtractedDocumentResult(plain_text="plain text", markdown_content="plain text")

    monkeypatch.setattr(service, "_extract_file_document", fake_extract_file_document)

    run_id = await service.create_pipeline(
        app_name=app_name,
        operation="rebuild_source",
        input_data={
            "corpus_id": str(corpus_id),
            "source_uri": source_uri,
        },
    )

    result = await service.execute_rebuild_source_pipeline(
        run_id=run_id,
        corpus_id=corpus_id,
        app_name=app_name,
        source_uri=source_uri,
    )

    assert result == []

    record = dao.records[(app_name, run_id)]
    payload = record.payload

    assert record.status == "failed"
    assert payload["operation"] == "rebuild_source"
    assert payload["input"]["source_uri"] == source_uri
    assert payload["started_at"] is not None
    assert payload["completed_at"] is not None
    assert isinstance(payload["duration_ms"], int)
    assert payload["duration_ms"] >= 0
    assert payload["error"]["type"] == "RuntimeError"
    assert payload["error"]["message"] == "delete failed"
    assert payload["stages"]["download"]["status"] == "completed"
    assert payload["stages"]["delete"]["status"] == "failed"
    assert payload["stages"]["delete"]["completed_at"] is not None


@pytest.mark.asyncio
async def test_async_rebuild_pipeline_accepts_mcp_extracted_markdown_payload(monkeypatch):
    class SuccessfulRepository:
        async def delete_knowledge_by_source(self, *, corpus_id, app_name, source_uri):
            _ = (corpus_id, app_name, source_uri)
            return 1

        async def add_knowledge(self, *, corpus_id, app_name, chunks):
            _ = (corpus_id, app_name)
            return list(chunks)

    dao = FakePipelineDao()
    service = KnowledgeService(repository=SuccessfulRepository(), pipeline_dao=dao)
    corpus_id = uuid4()
    app_name = "negentropy"
    source_uri = "gs://bucket/doc.md"

    monkeypatch.setattr("negentropy.storage.service.DocumentStorageService", lambda: FakeStorageService())

    async def fake_extract_file_document(**kwargs):
        _ = kwargs
        return ExtractedDocumentResult(plain_text="# Extracted Markdown", markdown_content="# Extracted Markdown")

    async def fake_ingest_text_with_tracker(**kwargs):
        _ = kwargs
        return []

    monkeypatch.setattr(service, "_extract_file_document", fake_extract_file_document)
    monkeypatch.setattr(service, "_ingest_text_with_tracker", fake_ingest_text_with_tracker)

    run_id = await service.create_pipeline(
        app_name=app_name,
        operation="rebuild_source",
        input_data={
            "corpus_id": str(corpus_id),
            "source_uri": source_uri,
        },
    )

    await service.execute_rebuild_source_pipeline(
        run_id=run_id,
        corpus_id=corpus_id,
        app_name=app_name,
        source_uri=source_uri,
    )

    record = dao.records[(app_name, run_id)]
    assert record.status == "completed"
    assert record.payload["stages"]["download"]["status"] == "completed"
    assert record.payload["stages"]["extract_gate"]["status"] == "completed"


@pytest.mark.asyncio
async def test_async_rebuild_pipeline_does_not_delete_existing_source_when_extracted_document_is_empty(monkeypatch):
    class GuardRepository:
        def __init__(self) -> None:
            self.delete_called = False

        async def delete_knowledge_by_source(self, *, corpus_id, app_name, source_uri):
            _ = (corpus_id, app_name, source_uri)
            self.delete_called = True
            return 1

    repository = GuardRepository()
    dao = FakePipelineDao()
    service = KnowledgeService(repository=repository, pipeline_dao=dao)
    corpus_id = uuid4()
    app_name = "negentropy"
    source_uri = "gs://bucket/doc.pdf"

    monkeypatch.setattr("negentropy.storage.service.DocumentStorageService", lambda: FakeStorageService())

    async def fake_extract_file_document(**kwargs):
        _ = kwargs
        return ExtractedDocumentResult(
            plain_text="",
            markdown_content="",
            trace={
                "provider": "mcp",
                "attempts": [{"tool_name": "parse_pdf_to_markdown", "failure_category": "empty_payload"}],
            },
        )

    monkeypatch.setattr(service, "_extract_file_document", fake_extract_file_document)

    run_id = await service.create_pipeline(
        app_name=app_name,
        operation="rebuild_source",
        input_data={
            "corpus_id": str(corpus_id),
            "source_uri": source_uri,
        },
    )

    result = await service.execute_rebuild_source_pipeline(
        run_id=run_id,
        corpus_id=corpus_id,
        app_name=app_name,
        source_uri=source_uri,
    )

    assert result == []

    record = dao.records[(app_name, run_id)]
    assert repository.delete_called is False
    assert record.status == "failed"
    assert record.payload["stages"]["extract_gate"]["status"] == "failed"


@pytest.mark.asyncio
async def test_async_ingest_file_pipeline_marks_run_failed_when_extracted_document_is_empty(monkeypatch):
    class GuardRepository:
        async def add_knowledge(self, *, corpus_id, app_name, chunks):
            _ = (corpus_id, app_name, chunks)
            raise AssertionError("add_knowledge should not be called")

    dao = FakePipelineDao()
    service = KnowledgeService(repository=GuardRepository(), pipeline_dao=dao)
    corpus_id = uuid4()
    app_name = "negentropy"
    source_uri = "gs://bucket/context-engineering.pdf"
    document_id = uuid4()

    monkeypatch.setattr("negentropy.storage.service.DocumentStorageService", lambda: FakeStorageService())

    async def fake_extract_file_document(**kwargs):
        _ = kwargs
        return ExtractedDocumentResult(
            plain_text="",
            markdown_content="",
            trace={
                "provider": "mcp",
                "attempts": [{"tool_name": "parse_pdf_to_markdown", "failure_category": "tool_execution_failed"}],
            },
        )

    monkeypatch.setattr(service, "_extract_file_document", fake_extract_file_document)

    run_id = await service.create_pipeline(
        app_name=app_name,
        operation="ingest_file",
        input_data={
            "corpus_id": str(corpus_id),
            "source_uri": source_uri,
            "document_id": str(document_id),
        },
    )

    # execute_ingest_file_pipeline 现在吞没异常并返回 []（后台任务不再 re-raise）
    result = await service.execute_ingest_file_pipeline(
        run_id=run_id,
        corpus_id=corpus_id,
        app_name=app_name,
        content=b"%PDF-1.4",
        filename="Context Engineering.pdf",
        content_type="application/pdf",
        source_uri=source_uri,
        metadata={"document_id": str(document_id)},
        document_id=document_id,
    )

    assert result == []
    record = dao.records[(app_name, run_id)]
    assert record.status == "failed"
    assert record.payload["stages"]["extract_gate"]["status"] == "failed"


@pytest.mark.asyncio
async def test_ensure_finalized_noop_when_completed():
    """ensure_finalized 应在 tracker 已处于 completed 状态时为 noop。"""
    dao = FakePipelineDao()
    tracker = PipelineTracker(dao=dao, app_name="negentropy", operation="ingest_text")
    await tracker.start({"source_uri": "memory://doc"})
    await tracker.complete({"record_count": 0})

    await tracker.ensure_finalized()
    record = dao.records[("negentropy", tracker.run_id)]
    assert record.status == "completed"


@pytest.mark.asyncio
async def test_ensure_finalized_marks_running_as_failed():
    """ensure_finalized 应将 running 状态的 tracker 标记为 failed。"""
    dao = FakePipelineDao()
    tracker = PipelineTracker(dao=dao, app_name="negentropy", operation="ingest_text")
    await tracker.start({"source_uri": "memory://doc"})

    await tracker.ensure_finalized()
    record = dao.records[("negentropy", tracker.run_id)]
    assert record.status == "failed"
    assert record.payload["error"]["type"] == "PipelineFinalizationSafetyNet"


@pytest.mark.asyncio
async def test_ensure_finalized_handles_db_failure_gracefully():
    """ensure_finalized 在 DB 持久化失败时不应抛出异常。"""
    dao = FakePipelineDao()
    tracker = PipelineTracker(dao=dao, app_name="negentropy", operation="ingest_text")
    await tracker.start({"source_uri": "memory://doc"})

    async def failing_upsert(**kwargs):
        raise RuntimeError("DB connection lost")

    dao.upsert_pipeline_run = failing_upsert

    # 不应抛出异常
    await tracker.ensure_finalized()
