from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid4

import pytest

from negentropy.knowledge.dao import UpsertResult
from negentropy.knowledge.service import KnowledgeService


@dataclass
class FakePipelineRun:
    app_name: str
    run_id: str
    status: str
    payload: dict


class FakePipelineDao:
    def __init__(self) -> None:
        self.records: dict[tuple[str, str], FakePipelineRun] = {}

    async def get_pipeline_run(self, app_name: str, run_id: str):
        return self.records.get((app_name, run_id))

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
        _ = (idempotency_key, expected_version)
        record = FakePipelineRun(app_name=app_name, run_id=run_id, status=status, payload=payload)
        self.records[(app_name, run_id)] = record
        return UpsertResult(
            status="updated",
            record={
                "run_id": run_id,
                "status": status,
                "payload": payload,
            },
        )


class FakeRepository:
    async def delete_knowledge_by_source(self, *, corpus_id, app_name, source_uri):
        _ = (corpus_id, app_name, source_uri)
        raise RuntimeError("delete failed")


class FakeStorageService:
    async def get_document_content_by_uri(self, source_uri: str):
        _ = source_uri
        return b"hello world"


@pytest.mark.asyncio
async def test_async_rebuild_pipeline_failure_persists_input_and_terminal_timestamps(monkeypatch):
    dao = FakePipelineDao()
    service = KnowledgeService(repository=FakeRepository(), pipeline_dao=dao)
    corpus_id = uuid4()
    app_name = "negentropy"
    source_uri = "gs://bucket/doc.md"

    monkeypatch.setattr("negentropy.storage.service.DocumentStorageService", lambda: FakeStorageService())

    async def fake_extract_file_content(**kwargs):
        _ = kwargs
        return "plain text"

    monkeypatch.setattr(service, "_extract_file_content", fake_extract_file_content)

    run_id = await service.create_pipeline(
        app_name=app_name,
        operation="rebuild_source",
        input_data={
            "corpus_id": str(corpus_id),
            "source_uri": source_uri,
        },
    )

    with pytest.raises(RuntimeError, match="delete failed"):
        await service.execute_rebuild_source_pipeline(
            run_id=run_id,
            corpus_id=corpus_id,
            app_name=app_name,
            source_uri=source_uri,
        )

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
