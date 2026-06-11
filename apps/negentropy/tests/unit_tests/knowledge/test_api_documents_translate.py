"""POST /documents/translate 路由单测 — 资格检查 / processing 同步写 / 任务派发。

覆盖：
1. 合格文档 → 同步置 metadata.translation.status=processing + BackgroundTasks 派发；
2. skip reasons：not_found / already_translation / markdown_not_ready / translating /
   already_translated（force 豁免）；
3. 陈旧 processing（>1h）允许重入。
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import BackgroundTasks

from negentropy.knowledge.routes import documents as documents_routes
from negentropy.knowledge.schemas import DocumentTranslateRequest


class _FakeStorage:
    def __init__(self, docs: dict):
        self.docs = docs
        self.metadata_patches: list[tuple[object, dict]] = []

    async def get_document(self, *, document_id, corpus_id=None, app_name=None):
        _ = (corpus_id, app_name)
        return self.docs.get(document_id)

    async def update_document_metadata(self, *, document_id, metadata_patch):
        self.metadata_patches.append((document_id, metadata_patch))
        return True


class _FakeTranslationService:
    def __init__(self):
        self.calls: list[dict] = []

    async def translate_document(self, *, document_id, target_language="zh"):
        self.calls.append({"document_id": document_id, "target_language": target_language})


def _doc(metadata: dict | None = None, extract_status: str = "completed") -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid4(),
        corpus_id=uuid4(),
        app_name="negentropy",
        original_filename="guide.md",
        markdown_extract_status=extract_status,
        metadata_=metadata or {},
    )


def _patch(monkeypatch, storage: _FakeStorage, translation: _FakeTranslationService) -> None:
    monkeypatch.setattr("negentropy.storage.service.DocumentStorageService", lambda: storage)
    monkeypatch.setattr("negentropy.knowledge.translation.DocumentTranslationService", lambda: translation)


@pytest.mark.asyncio
async def test_translate_accepts_eligible_document(monkeypatch):
    doc = _doc()
    storage = _FakeStorage({doc.id: doc})
    translation = _FakeTranslationService()
    _patch(monkeypatch, storage, translation)

    tasks = BackgroundTasks()
    result = await documents_routes.translate_documents(DocumentTranslateRequest(document_ids=[doc.id]), tasks)

    assert result.accepted == [doc.id]
    assert result.skipped == []
    assert result.status == "running"
    # 同步置 processing（轮询立刻可见）
    assert len(storage.metadata_patches) == 1
    _, patch = storage.metadata_patches[0]
    assert patch["translation"]["status"] == "processing"
    assert patch["translation"]["target_language"] == "zh"
    assert patch["translation"]["started_at"]
    # BackgroundTasks 派发一个任务
    assert len(tasks.tasks) == 1


@pytest.mark.asyncio
async def test_translate_skip_reasons(monkeypatch):
    eligible = _doc()
    translation_doc = _doc(metadata={"translated_from_document_id": str(uuid4())})
    pending_doc = _doc(extract_status="pending")
    recent = (datetime.now(UTC) - timedelta(minutes=5)).isoformat()
    translating_doc = _doc(metadata={"translation": {"status": "processing", "started_at": recent}})
    done_doc = _doc(metadata={"translation": {"status": "completed"}})
    missing_id = uuid4()

    storage = _FakeStorage({d.id: d for d in (eligible, translation_doc, pending_doc, translating_doc, done_doc)})
    translation = _FakeTranslationService()
    _patch(monkeypatch, storage, translation)

    tasks = BackgroundTasks()
    result = await documents_routes.translate_documents(
        DocumentTranslateRequest(
            document_ids=[
                eligible.id,
                translation_doc.id,
                pending_doc.id,
                translating_doc.id,
                done_doc.id,
                missing_id,
            ]
        ),
        tasks,
    )

    assert result.accepted == [eligible.id]
    reasons = {item.document_id: item.reason for item in result.skipped}
    assert reasons[translation_doc.id] == "already_translation"
    assert reasons[pending_doc.id] == "markdown_not_ready"
    assert reasons[translating_doc.id] == "translating"
    assert reasons[done_doc.id] == "already_translated"
    assert reasons[missing_id] == "not_found"
    assert len(tasks.tasks) == 1


@pytest.mark.asyncio
async def test_translate_force_allows_retranslation(monkeypatch):
    done_doc = _doc(metadata={"translation": {"status": "completed"}})
    storage = _FakeStorage({done_doc.id: done_doc})
    translation = _FakeTranslationService()
    _patch(monkeypatch, storage, translation)

    tasks = BackgroundTasks()
    result = await documents_routes.translate_documents(
        DocumentTranslateRequest(document_ids=[done_doc.id], force=True), tasks
    )

    assert result.accepted == [done_doc.id]
    assert len(tasks.tasks) == 1


@pytest.mark.asyncio
async def test_translate_stale_processing_is_reentrant(monkeypatch):
    stale = (datetime.now(UTC) - timedelta(hours=2)).isoformat()
    stale_doc = _doc(metadata={"translation": {"status": "processing", "started_at": stale}})
    storage = _FakeStorage({stale_doc.id: stale_doc})
    translation = _FakeTranslationService()
    _patch(monkeypatch, storage, translation)

    tasks = BackgroundTasks()
    result = await documents_routes.translate_documents(DocumentTranslateRequest(document_ids=[stale_doc.id]), tasks)

    assert result.accepted == [stale_doc.id]
    assert len(tasks.tasks) == 1


@pytest.mark.asyncio
async def test_translate_passes_target_language(monkeypatch):
    doc = _doc()
    storage = _FakeStorage({doc.id: doc})
    translation = _FakeTranslationService()
    _patch(monkeypatch, storage, translation)

    tasks = BackgroundTasks()
    await documents_routes.translate_documents(
        DocumentTranslateRequest(document_ids=[doc.id], target_language="zh"), tasks
    )
    # 执行已注册的后台任务，验证参数透传
    await tasks.tasks[0]()
    assert translation.calls == [{"document_id": doc.id, "target_language": "zh"}]
