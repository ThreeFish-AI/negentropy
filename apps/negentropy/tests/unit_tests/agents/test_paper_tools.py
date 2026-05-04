"""
Stage 4 单测：验证 search_papers / ingest_paper 工具的核心契约。

覆盖点：
- _emit_tool_progress / _clear_tool_progress 写入 ADK state_delta（C3 旁路）
- search_papers 入参校验、结果序列化、since_days 过滤
- ingest_paper URL 校验

不依赖网络（mock arxiv 模块），不依赖数据库（mock KnowledgeService）。
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


class _FakeState:
    def __init__(self) -> None:
        self.data: dict[str, Any] = {}

    def get(self, key: str, default: Any = None) -> Any:
        return self.data.get(key, default)

    def __setitem__(self, key: str, value: Any) -> None:
        self.data[key] = value

    def __getitem__(self, key: str) -> Any:
        return self.data[key]

    def __contains__(self, key: str) -> bool:
        return key in self.data


class _FakeToolContext:
    """最小 ToolContext mock — 仅模拟 paper.py 实际依赖的 state 字段。"""

    def __init__(self, function_call_id: str | None = "test-call-id"):
        self.state = _FakeState()
        if function_call_id:
            self.function_call_id = function_call_id


def test_emit_tool_progress_writes_state_delta():
    """_emit_tool_progress 必须把进度信息落到 state['tool_progress'][tool_call_id]。"""
    from negentropy.agents.tools.paper import _emit_tool_progress

    ctx = _FakeToolContext()
    _emit_tool_progress(ctx, tool_call_id="t1", percent=50.0, stage="抓取中", eta=12.5)

    assert "tool_progress" in ctx.state
    bucket = ctx.state["tool_progress"]
    assert "t1" in bucket
    assert bucket["t1"]["percent"] == 50.0
    assert bucket["t1"]["stage"] == "抓取中"
    assert bucket["t1"]["eta"] == 12.5


def test_emit_tool_progress_clamps_percent():
    """percent 应被限制在 [0, 100]，防止后端发非法值导致前端进度条溢出。"""
    from negentropy.agents.tools.paper import _emit_tool_progress

    ctx = _FakeToolContext()
    _emit_tool_progress(ctx, tool_call_id="t1", percent=150)
    assert ctx.state["tool_progress"]["t1"]["percent"] == 100.0
    _emit_tool_progress(ctx, tool_call_id="t2", percent=-10)
    assert ctx.state["tool_progress"]["t2"]["percent"] == 0.0


def test_clear_tool_progress_removes_entry():
    """_clear_tool_progress 应删除指定 tool_call_id，但保留其他条目。"""
    from negentropy.agents.tools.paper import _clear_tool_progress, _emit_tool_progress

    ctx = _FakeToolContext()
    _emit_tool_progress(ctx, tool_call_id="t1", percent=80)
    _emit_tool_progress(ctx, tool_call_id="t2", percent=30)
    _clear_tool_progress(ctx, tool_call_id="t1")
    assert "t1" not in ctx.state["tool_progress"]
    assert "t2" in ctx.state["tool_progress"]


def test_emit_tool_progress_no_state_safe():
    """ctx.state 不存在时不应抛异常（容错）。"""
    from negentropy.agents.tools.paper import _emit_tool_progress

    class _NoState:
        pass

    # 不会抛异常
    _emit_tool_progress(_NoState(), tool_call_id="t1", percent=50)  # type: ignore[arg-type]
    _emit_tool_progress(None, tool_call_id="t1", percent=50)


@pytest.mark.asyncio
async def test_search_papers_rejects_empty_query():
    """空 query 必须立即返回 failed 而不发起 arxiv 调用。"""
    from negentropy.agents.tools.paper import search_papers

    ctx = _FakeToolContext()
    result = await search_papers(query="", top_k=5, since_days=30, tool_context=ctx)
    assert result["status"] == "failed"
    assert "query" in result["error"]


@pytest.mark.asyncio
async def test_search_papers_serializes_arxiv_results_and_filters_by_since_days():
    """search_papers 应：
    1. 按 since_days 过滤超出窗口的论文；
    2. 把 arxiv.Result 序列化为 plain dict；
    3. 推送 0%→100% 进度，并最终清理 tool_progress。
    """
    from negentropy.agents.tools.paper import search_papers

    now = datetime.now(UTC)
    fresh = MagicMock()
    fresh.entry_id = "http://arxiv.org/abs/2501.99999v1"
    fresh.title = "Memory in LLM Agents: A Survey"
    fresh.summary = "A comprehensive survey on memory mechanisms in LLM agents."
    fresh.authors = ["Alice Smith", "Bob Liu"]
    fresh.pdf_url = "https://arxiv.org/pdf/2501.99999.pdf"
    fresh.categories = ["cs.AI", "cs.CL"]
    fresh.published = now - timedelta(days=2)
    fresh.updated = now - timedelta(days=1)

    stale = MagicMock()
    stale.entry_id = "http://arxiv.org/abs/2310.11111v1"
    stale.title = "Old Paper"
    stale.summary = "Outside since_days window."
    stale.authors = ["Charlie Wu"]
    stale.pdf_url = "https://arxiv.org/pdf/2310.11111.pdf"
    stale.categories = ["cs.AI"]
    stale.published = now - timedelta(days=400)
    stale.updated = now - timedelta(days=400)

    fake_arxiv_module = MagicMock()
    fake_arxiv_module.Client.return_value.results.return_value = [fresh, stale]
    fake_arxiv_module.Search = MagicMock()
    fake_arxiv_module.SortCriterion = MagicMock(Relevance="rel")
    fake_arxiv_module.SortOrder = MagicMock(Descending="desc")

    ctx = _FakeToolContext()
    with patch.dict("sys.modules", {"arxiv": fake_arxiv_module}):
        result = await search_papers(query="LLM agent memory", top_k=5, since_days=30, tool_context=ctx)

    assert result["status"] == "success", result
    assert result["count"] == 1
    paper = result["papers"][0]
    assert paper["arxiv_id"] == "2501.99999v1"
    assert paper["title"] == "Memory in LLM Agents: A Survey"
    assert paper["pdf_url"].endswith(".pdf")
    assert "cs.AI" in paper["categories"]
    assert paper["authors"] == ["Alice Smith", "Bob Liu"]
    # 终态应清理 tool_progress（避免 stale 进度残留）
    assert ctx.state.get("tool_progress", {}) == {}


@pytest.mark.asyncio
async def test_ingest_paper_rejects_invalid_url():
    """非 http(s) URL 必须立即返回 failed。"""
    from negentropy.agents.tools.paper import ingest_paper

    ctx = _FakeToolContext()
    result = await ingest_paper(
        arxiv_id="2501.99999",
        pdf_url="ftp://example.com/file.pdf",
        title="bad",
        tool_context=ctx,
    )
    assert result["status"] == "failed"
    assert result["arxiv_id"] == "2501.99999"


@pytest.mark.asyncio
async def test_ingest_paper_invokes_knowledge_service_with_metadata():
    """ingest_paper 应：
    1. 确保 agent-papers Corpus 存在；
    2. 调 KnowledgeService.ingest_url 透传 url + metadata；
    3. 推送 0%→100% 进度并清理终态。
    """
    from negentropy.agents.tools import paper as paper_module

    fake_corpus_id = "00000000-0000-0000-0000-000000001234"
    fake_record_1 = MagicMock(id="rec-1")
    fake_record_2 = MagicMock(id="rec-2")

    fake_service = MagicMock()
    fake_service.ensure_corpus = AsyncMock(return_value=MagicMock(id=fake_corpus_id))
    fake_service.ingest_url = AsyncMock(return_value=[fake_record_1, fake_record_2])

    with patch.object(paper_module, "_get_knowledge_service", return_value=fake_service):
        ctx = _FakeToolContext()
        result = await paper_module.ingest_paper(
            arxiv_id="2501.99999",
            pdf_url="https://arxiv.org/pdf/2501.99999.pdf",
            title="Memory in LLM Agents",
            tool_context=ctx,
        )

    assert result["status"] == "success", result
    assert result["arxiv_id"] == "2501.99999"
    assert result["record_count"] == 2
    assert result["corpus"] == "agent-papers"
    fake_service.ensure_corpus.assert_awaited_once()
    fake_service.ingest_url.assert_awaited_once()
    call_kwargs = fake_service.ingest_url.await_args.kwargs
    assert call_kwargs["url"] == "https://arxiv.org/pdf/2501.99999.pdf"
    assert call_kwargs["metadata"]["arxiv_id"] == "2501.99999"
    assert call_kwargs["metadata"]["title"] == "Memory in LLM Agents"
    # 终态清理
    assert ctx.state.get("tool_progress", {}) == {}
