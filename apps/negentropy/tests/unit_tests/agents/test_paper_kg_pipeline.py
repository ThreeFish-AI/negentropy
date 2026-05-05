"""P2-2 · G1b 单测：paper_kg_pipeline 异步闭环 + fail-open 兜底。

不连数据库，不实际启动 GraphService —— mock 边界即可。验证：
- enqueue_kg_build 在正常路径调用 asyncio.create_task 并返回 kg_enqueued；
- 空 records 短路返回 kg_skipped(no_chunks)；
- _records_to_chunks 正确序列化 KnowledgeRecord；
- 任意异常路径降级为 kg_skipped(<ErrorName>)，不向上抛。
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest


def _make_record(content: str, *, rid: UUID | None = None, metadata: dict | None = None):
    rec = MagicMock()
    rec.id = rid or uuid4()
    rec.content = content
    rec.metadata = metadata or {}
    rec.source_uri = "https://arxiv.org/pdf/2501.99999.pdf"
    rec.chunk_index = 0
    return rec


def test_records_to_chunks_serializes_minimum_required_fields():
    """转换出的 chunks dict 至少包含 id + content（GraphService.build_graph 必需字段）。"""
    from negentropy.agents.tools.paper_kg_pipeline import _records_to_chunks

    rec = _make_record("Memory in LLM Agents: a survey ...", metadata={"arxiv_id": "2501.99999"})
    chunks = _records_to_chunks([rec])

    assert len(chunks) == 1
    chunk = chunks[0]
    assert chunk["id"] == str(rec.id)
    assert chunk["content"].startswith("Memory in LLM")
    assert chunk["metadata"] == {"arxiv_id": "2501.99999"}
    assert chunk["source_uri"].endswith(".pdf")


def test_records_to_chunks_skips_records_with_no_id():
    """没 id 的 record 应跳过（incremental KG 依赖 chunk id 去重）。"""
    from negentropy.agents.tools.paper_kg_pipeline import _records_to_chunks

    bad = MagicMock()
    bad.id = None
    bad.content = "x"
    good = _make_record("hello")

    chunks = _records_to_chunks([bad, good])
    assert len(chunks) == 1
    assert chunks[0]["id"] == str(good.id)


@pytest.mark.asyncio
async def test_enqueue_kg_build_short_circuits_on_empty_records():
    """空 records 不应启动异步任务，立即返回 kg_skipped(no_chunks)。"""
    from negentropy.agents.tools.paper_kg_pipeline import enqueue_kg_build

    result = await enqueue_kg_build(uuid4(), records=[])
    assert result == {"kg_status": "kg_skipped", "kg_error_code": "no_chunks"}


@pytest.mark.asyncio
async def test_enqueue_kg_build_returns_enqueued_and_starts_background_task():
    """正常路径：调用 asyncio.create_task；返回 kg_enqueued 与 chunk 数。"""
    from negentropy.agents.tools import paper_kg_pipeline

    rec = _make_record("LLM agent memory survey")
    captured_coros: list = []

    def fake_create_task(coro):
        captured_coros.append(coro)
        # 立即关闭协程，避免未 await 的 RuntimeWarning
        coro.close()
        fake_task = MagicMock()
        return fake_task

    with patch.object(paper_kg_pipeline.asyncio, "create_task", side_effect=fake_create_task):
        result = await paper_kg_pipeline.enqueue_kg_build(uuid4(), records=[rec])

    assert result["kg_status"] == "kg_enqueued"
    assert result["kg_chunk_count"] == 1
    assert len(captured_coros) == 1


@pytest.mark.asyncio
async def test_enqueue_kg_build_fail_open_when_create_task_raises():
    """create_task 抛异常 → 降级为 kg_skipped(<ErrorName>)，不向上抛。

    这是 P2-2 fail-open 契约的核心：ingest_paper 主路径必须永不被 KG 子任务污染。
    """
    from negentropy.agents.tools import paper_kg_pipeline

    rec = _make_record("hello")

    class _BoomError(RuntimeError):
        pass

    with patch.object(paper_kg_pipeline.asyncio, "create_task", side_effect=_BoomError("boom")):
        result = await paper_kg_pipeline.enqueue_kg_build(uuid4(), records=[rec])

    assert result["kg_status"] == "kg_skipped"
    assert result["kg_error_code"] == "_BoomError"


@pytest.mark.asyncio
async def test_run_kg_build_background_swallows_graph_service_errors():
    """后台任务中 GraphService.build_graph 抛错应仅 log warning，不向上抛。"""
    from negentropy.agents.tools import paper_kg_pipeline

    chunks = [{"id": "abc", "content": "x", "metadata": {}, "source_uri": "u", "chunk_index": 0}]

    class _FakeGraphService:
        def __init__(self) -> None:
            pass

        async def build_graph(self, **kwargs):
            raise RuntimeError("simulated KG build failure")

    fake_module = MagicMock()
    fake_module.GraphService = _FakeGraphService

    with (
        patch.dict("sys.modules", {"negentropy.knowledge.graph.service": fake_module}),
    ):
        # 不应抛
        await paper_kg_pipeline._run_kg_build_background(uuid4(), chunks)


@pytest.mark.asyncio
async def test_ingest_paper_success_returns_kg_status(monkeypatch):
    """ingest_paper success 分支必须把 kg_status 字段合并进返回值。"""
    from negentropy.agents.tools import paper as paper_module
    from negentropy.agents.tools import paper_kg_pipeline

    fake_corpus_id = UUID("00000000-0000-0000-0000-000000001234")
    fake_record_1 = _make_record("chunk1")
    fake_record_2 = _make_record("chunk2")

    fake_service = MagicMock()
    fake_service.ensure_corpus = AsyncMock(return_value=MagicMock(id=fake_corpus_id))
    fake_service.ingest_url = AsyncMock(return_value=[fake_record_1, fake_record_2])

    async def fake_enqueue(corpus_id, records):
        return {"kg_status": "kg_enqueued", "kg_chunk_count": len(records)}

    class _Ctx:
        def __init__(self):
            self.state = {"tool_progress": {}}
            self.function_call_id = "tcid"

    with (
        patch.object(paper_module, "_get_knowledge_service", return_value=fake_service),
        patch.object(paper_module, "_check_existing_arxiv", AsyncMock(return_value=None)),
        patch.object(paper_kg_pipeline, "enqueue_kg_build", side_effect=fake_enqueue),
    ):
        result = await paper_module.ingest_paper(
            arxiv_id="2501.99999",
            pdf_url="https://arxiv.org/pdf/2501.99999.pdf",
            title="Test",
            tool_context=_Ctx(),
        )

    assert result["status"] == "success"
    assert result["kg_status"] == "kg_enqueued"
    assert result["kg_chunk_count"] == 2
