"""DocumentTranslationService 单测 — guard / 状态机 / 校验回写 / 落库元数据。

LLM/Agent 路径全部 mock（``_run_influence`` 以"读 source/ 写 translated/"的副作用桩
模拟 InfluenceFaculty → Claude Code 执行），验证服务端确定性兜底逻辑：
1. happy path：译文新文档 ``<stem>.zh.md`` + translated_from 元数据 + 源文档 completed；
2. 代码围栏漂移 → 按源确定性回写并记 warning；
3. guard：自身是译文 / 内容已是中文 → failed；
4. 缺块重跑一次仍缺 → failed 且 workdir 保留；
5. in-flight 去重；hash 去重命中既有译文时补写元数据。
"""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest

from negentropy.agents.skills_injector import ResolvedSkill
from negentropy.knowledge.translation import service as translation_service_module
from negentropy.knowledge.translation.service import (
    _INFLIGHT,
    DocumentTranslationService,
)

SOURCE_MD = (
    "# Title\n"
    "\n"
    "Hello world prose.\n"
    "\n"
    "```python\n"
    "value = 42\n"
    "```\n"
    "\n"
    "See ![img](./a.png) and [doc](https://example.com/page).\n"
)

_FAKE_SKILL = ResolvedSkill(
    id="tpl",
    name="document-translate",
    display_name="Translate",
    description="test skill",
    prompt_template=(
        "translate {{ workdir }} chunks={{ chunk_count }} lang={{ target_language }} timeout={{ tool_timeout }}"
    ),
    required_tools=("invoke_claude_code",),
    is_enabled=True,
)


class _FakeStorage:
    def __init__(self, doc, markdown: str | None):
        self.doc = doc
        self.markdown = markdown
        self.metadata_patches: list[tuple[object, dict]] = []
        self.upload_calls: list[dict] = []
        self.saved_markdown: dict[object, str] = {}
        self.target_doc = SimpleNamespace(
            id=uuid4(),
            corpus_id=getattr(doc, "corpus_id", None),
            metadata_={},
        )
        self.upload_is_new = True

    async def get_document(self, *, document_id, corpus_id=None, app_name=None):
        _ = (document_id, corpus_id, app_name)
        return self.doc

    async def get_document_markdown(self, document_id):
        _ = document_id
        return self.markdown

    async def update_document_metadata(self, *, document_id, metadata_patch):
        self.metadata_patches.append((document_id, metadata_patch))
        return True

    async def upload_and_store(self, **kwargs):
        self.upload_calls.append(kwargs)
        return self.target_doc, self.upload_is_new

    async def save_markdown_content(self, *, document_id, markdown_content, markdown_gcs_uri=None):
        _ = markdown_gcs_uri
        self.saved_markdown[document_id] = markdown_content
        return True


def _source_doc(metadata: dict | None = None) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid4(),
        corpus_id=uuid4(),
        app_name="negentropy",
        original_filename="guide.md",
        created_by="tester@example.com",
        markdown_extract_status="completed",
        metadata_=metadata or {},
    )


@pytest.fixture
def workdir_holder(tmp_path, monkeypatch):
    """固定 workdir 到 tmp_path 便于断言清理 / 保留行为。"""
    holder: dict[str, Path] = {}

    def _fake_mkdtemp(prefix: str = "") -> str:
        _ = prefix
        path = tmp_path / "workdir"
        path.mkdir()
        holder["path"] = path
        return str(path)

    monkeypatch.setattr(translation_service_module.tempfile, "mkdtemp", _fake_mkdtemp)
    return holder


def _setup(monkeypatch, storage: _FakeStorage, influence_fn) -> DocumentTranslationService:
    monkeypatch.setattr("negentropy.storage.service.DocumentStorageService", lambda: storage)

    async def _fake_resolve(self):
        _ = self
        return _FAKE_SKILL

    monkeypatch.setattr(DocumentTranslationService, "_resolve_skill", _fake_resolve)
    monkeypatch.setattr(DocumentTranslationService, "_run_influence", influence_fn)
    return DocumentTranslationService()


def _translate_chunks(workdir: Path, transform) -> None:
    for source_file in sorted((workdir / "source").glob("chunk_*.md")):
        (workdir / "translated" / source_file.name).write_text(
            transform(source_file.read_text(encoding="utf-8")), encoding="utf-8"
        )


def _final_translation_state(storage: _FakeStorage, document_id) -> dict:
    patches = [p for doc_id, p in storage.metadata_patches if doc_id == document_id and "translation" in p]
    assert patches, "expected translation metadata patch on source document"
    return patches[-1]["translation"]


@pytest.mark.asyncio
async def test_happy_path_creates_target_document(monkeypatch, workdir_holder):
    doc = _source_doc()
    storage = _FakeStorage(doc, SOURCE_MD)

    async def _influence(self, task_msg):
        _ = (self, task_msg)
        _translate_chunks(workdir_holder["path"], lambda t: t.replace("Hello world prose.", "你好世界散文。"))
        return "done"

    svc = _setup(monkeypatch, storage, _influence)
    await svc.translate_document(document_id=doc.id)

    # 译文新文档：<stem>.zh.md + translated_from 元数据
    assert len(storage.upload_calls) == 1
    upload = storage.upload_calls[0]
    assert upload["filename"] == "guide.zh.md"
    assert upload["corpus_id"] == doc.corpus_id
    assert upload["content_type"] == "text/markdown"
    assert upload["metadata"]["translated_from_document_id"] == str(doc.id)
    assert upload["metadata"]["translated_from_filename"] == "guide.md"
    assert upload["metadata"]["translation_language"] == "zh"

    # markdown 直存（save_markdown_content 内置 completed 语义）
    saved = storage.saved_markdown[storage.target_doc.id]
    assert "你好世界散文。" in saved
    assert "value = 42" in saved  # 代码围栏原样

    # 源文档状态机 completed + 双向链接
    state = _final_translation_state(storage, doc.id)
    assert state["status"] == "completed"
    assert state["target_document_id"] == str(storage.target_doc.id)

    # 成功路径清理 workdir
    assert not workdir_holder["path"].exists()


@pytest.mark.asyncio
async def test_fence_drift_restored_with_warning(monkeypatch, workdir_holder):
    doc = _source_doc()
    storage = _FakeStorage(doc, SOURCE_MD)

    async def _influence(self, task_msg):
        _ = (self, task_msg)
        _translate_chunks(
            workdir_holder["path"],
            lambda t: t.replace("Hello world prose.", "你好。").replace("value = 42", "值 = 42"),
        )
        return "done"

    svc = _setup(monkeypatch, storage, _influence)
    await svc.translate_document(document_id=doc.id)

    saved = storage.saved_markdown[storage.target_doc.id]
    assert "value = 42" in saved  # 源围栏确定性回写
    assert "值 = 42" not in saved

    state = _final_translation_state(storage, doc.id)
    assert state["status"] == "completed"
    assert any("code fences restored" in w for w in state.get("warnings", []))


@pytest.mark.asyncio
async def test_guard_rejects_translation_of_translation(monkeypatch, workdir_holder):
    _ = workdir_holder
    doc = _source_doc(metadata={"translated_from_document_id": str(uuid4())})
    storage = _FakeStorage(doc, SOURCE_MD)

    async def _influence(self, task_msg):  # pragma: no cover - 不应被调用
        raise AssertionError("influence should not run")

    svc = _setup(monkeypatch, storage, _influence)
    await svc.translate_document(document_id=doc.id)

    state = _final_translation_state(storage, doc.id)
    assert state["status"] == "failed"
    assert "already a translation" in state["error"]
    assert not storage.upload_calls


@pytest.mark.asyncio
async def test_guard_rejects_chinese_content(monkeypatch, workdir_holder):
    _ = workdir_holder
    doc = _source_doc()
    storage = _FakeStorage(doc, "# 标题\n\n这是一篇完全中文的文档内容，无需再翻译。\n")

    async def _influence(self, task_msg):  # pragma: no cover - 不应被调用
        raise AssertionError("influence should not run")

    svc = _setup(monkeypatch, storage, _influence)
    await svc.translate_document(document_id=doc.id)

    state = _final_translation_state(storage, doc.id)
    assert state["status"] == "failed"
    assert "Chinese" in state["error"]


@pytest.mark.asyncio
async def test_missing_chunks_after_retry_fails_and_keeps_workdir(monkeypatch, workdir_holder):
    doc = _source_doc()
    storage = _FakeStorage(doc, SOURCE_MD)
    calls: list[str] = []

    async def _influence(self, task_msg):
        _ = self
        calls.append(task_msg)  # 不产出任何 translated 文件
        return "noop"

    svc = _setup(monkeypatch, storage, _influence)
    await svc.translate_document(document_id=doc.id)

    assert len(calls) == 2  # 原跑 + 补漏重跑各一次
    assert "补漏重跑" in calls[1]
    state = _final_translation_state(storage, doc.id)
    assert state["status"] == "failed"
    assert "invalid" in state["error"]
    assert not storage.upload_calls
    assert workdir_holder["path"].exists()  # 失败保留 workdir 排障


@pytest.mark.asyncio
async def test_fence_count_drift_retried_then_succeeds(monkeypatch, workdir_holder):
    """围栏数量漂移（丢围栏）的块计入失败块：删除无效产物 → 单次重跑修复 → completed。"""
    doc = _source_doc()
    storage = _FakeStorage(doc, SOURCE_MD)
    calls: list[str] = []

    async def _influence(self, task_msg):
        _ = self
        calls.append(task_msg)
        if len(calls) == 1:
            # 首跑：丢失整个代码围栏（数量漂移，不可对位回写）
            _translate_chunks(
                workdir_holder["path"],
                lambda t: t.replace("```python\nvalue = 42\n```\n", ""),
            )
        else:
            # 重跑：忠实翻译
            _translate_chunks(workdir_holder["path"], lambda t: t.replace("Hello", "你好"))
        return "done"

    svc = _setup(monkeypatch, storage, _influence)
    await svc.translate_document(document_id=doc.id)

    assert len(calls) == 2
    state = _final_translation_state(storage, doc.id)
    assert state["status"] == "completed"
    saved = storage.saved_markdown[storage.target_doc.id]
    assert "value = 42" in saved


@pytest.mark.asyncio
async def test_inflight_dedupe_skips_duplicate_run(monkeypatch, workdir_holder):
    _ = workdir_holder
    doc = _source_doc()
    storage = _FakeStorage(doc, SOURCE_MD)

    async def _influence(self, task_msg):  # pragma: no cover - 不应被调用
        raise AssertionError("influence should not run")

    svc = _setup(monkeypatch, storage, _influence)
    _INFLIGHT.add(doc.id)
    try:
        await svc.translate_document(document_id=doc.id)
    finally:
        _INFLIGHT.discard(doc.id)

    assert not storage.metadata_patches
    assert not storage.upload_calls


@pytest.mark.asyncio
async def test_hash_dedupe_existing_target_still_gets_metadata(monkeypatch, workdir_holder):
    doc = _source_doc()
    storage = _FakeStorage(doc, SOURCE_MD)
    storage.upload_is_new = False  # 命中既有译文文档

    async def _influence(self, task_msg):
        _ = (self, task_msg)
        _translate_chunks(workdir_holder["path"], lambda t: t.replace("Hello", "你好"))
        return "done"

    svc = _setup(monkeypatch, storage, _influence)
    await svc.translate_document(document_id=doc.id)

    # 既有译文文档补写来源标记（双向链接不缺失）
    target_patches = [
        patch
        for doc_id, patch in storage.metadata_patches
        if doc_id == storage.target_doc.id and "translated_from_document_id" in patch
    ]
    assert target_patches
    assert target_patches[0]["translated_from_document_id"] == str(doc.id)
