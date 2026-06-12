"""NegentropyPreloadMemoryTool 单元测试

纯 mock，零外部依赖。覆盖：同 invocation 去重缓存、空结果缓存、
settings 门控、检索异常容错、top_k/max_chars 截断、跨 invocation 重检索。
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from google.genai import types

from negentropy.agents.tools.memory import (
    _STATE_CACHE_KEY,
    NegentropyPreloadMemoryTool,
    _RetrievalConfig,
)


def _entry(text: str, *, entry_id: str = "abcd1234-0000-0000-0000-000000000000") -> SimpleNamespace:
    return SimpleNamespace(
        id=entry_id,
        content=types.Content(parts=[types.Part(text=text)]),
        author="system",
        timestamp="2026-06-01T00:00:00+00:00",
        custom_metadata={"memory_type": "episodic"},
    )


def _make_tool_context(
    *,
    query: str = "我之前的偏好是什么",
    invocation_id: str = "inv-1",
    memories: list | None = None,
    search_side_effect=None,
):
    ctx = MagicMock()
    ctx.user_content = types.Content(parts=[types.Part(text=query)])
    ctx.invocation_id = invocation_id
    ctx.state = {}
    if search_side_effect is not None:
        ctx.search_memory = AsyncMock(side_effect=search_side_effect)
    else:
        ctx.search_memory = AsyncMock(return_value=SimpleNamespace(memories=memories or []))
    return ctx


@pytest.fixture
def tool():
    return NegentropyPreloadMemoryTool()


@pytest.fixture(autouse=True)
def _enabled_settings(monkeypatch):
    monkeypatch.setattr(
        "negentropy.agents.tools.memory._resolve_retrieval_settings",
        lambda: _RetrievalConfig(preload_enabled=True, preload_top_k=5, preload_max_chars=4000),
    )


async def test_injects_memories_into_llm_request(tool):
    ctx = _make_tool_context(memories=[_entry("用户偏好 async-first 架构")])
    llm_request = MagicMock()

    await tool.process_llm_request(tool_context=ctx, llm_request=llm_request)

    ctx.search_memory.assert_awaited_once()
    llm_request.append_instructions.assert_called_once()
    block = llm_request.append_instructions.call_args[0][0][0]
    assert "<RELEVANT_MEMORIES>" in block
    assert "[Memory abcd1234, episodic, 2026-06-01]" in block
    assert "用户偏好 async-first 架构" in block


async def test_same_invocation_same_query_searches_once(tool):
    """同 invocation 内多个 LLM step 只检索一次，但每个 step 都注入缓存块"""
    ctx = _make_tool_context(memories=[_entry("记忆内容")])
    req1, req2 = MagicMock(), MagicMock()

    await tool.process_llm_request(tool_context=ctx, llm_request=req1)
    await tool.process_llm_request(tool_context=ctx, llm_request=req2)

    assert ctx.search_memory.await_count == 1
    req1.append_instructions.assert_called_once()
    req2.append_instructions.assert_called_once()


async def test_empty_result_cached_and_not_injected(tool):
    """零命中：不注入、缓存命中后第二个 step 不再检索"""
    ctx = _make_tool_context(memories=[])
    req1, req2 = MagicMock(), MagicMock()

    await tool.process_llm_request(tool_context=ctx, llm_request=req1)
    await tool.process_llm_request(tool_context=ctx, llm_request=req2)

    assert ctx.search_memory.await_count == 1
    req1.append_instructions.assert_not_called()
    req2.append_instructions.assert_not_called()
    assert ctx.state[_STATE_CACHE_KEY]["block"] is None


async def test_different_invocation_id_researches(tool):
    """新 invocation（id 不同）强制重新检索——防御 temp state 残留"""
    ctx = _make_tool_context(invocation_id="inv-1", memories=[_entry("a")])

    await tool.process_llm_request(tool_context=ctx, llm_request=MagicMock())
    ctx.invocation_id = "inv-2"
    await tool.process_llm_request(tool_context=ctx, llm_request=MagicMock())

    assert ctx.search_memory.await_count == 2


async def test_disabled_skips_search(tool, monkeypatch):
    monkeypatch.setattr(
        "negentropy.agents.tools.memory._resolve_retrieval_settings",
        lambda: _RetrievalConfig(preload_enabled=False),
    )
    ctx = _make_tool_context(memories=[_entry("a")])
    llm_request = MagicMock()

    await tool.process_llm_request(tool_context=ctx, llm_request=llm_request)

    ctx.search_memory.assert_not_awaited()
    llm_request.append_instructions.assert_not_called()


async def test_search_exception_swallowed_and_not_cached(tool):
    """检索异常：不上抛、不写缓存（下一 step 可重试成功）"""
    results = [RuntimeError("boom"), SimpleNamespace(memories=[_entry("recovered")])]
    ctx = _make_tool_context(search_side_effect=results)
    req1, req2 = MagicMock(), MagicMock()

    await tool.process_llm_request(tool_context=ctx, llm_request=req1)
    req1.append_instructions.assert_not_called()
    assert _STATE_CACHE_KEY not in ctx.state

    await tool.process_llm_request(tool_context=ctx, llm_request=req2)
    assert ctx.search_memory.await_count == 2
    req2.append_instructions.assert_called_once()


async def test_no_user_content_skips(tool):
    ctx = _make_tool_context(memories=[_entry("a")])
    ctx.user_content = None
    llm_request = MagicMock()

    await tool.process_llm_request(tool_context=ctx, llm_request=llm_request)

    ctx.search_memory.assert_not_awaited()
    llm_request.append_instructions.assert_not_called()


async def test_top_k_truncation(tool, monkeypatch):
    monkeypatch.setattr(
        "negentropy.agents.tools.memory._resolve_retrieval_settings",
        lambda: _RetrievalConfig(preload_top_k=2, preload_max_chars=4000),
    )
    memories = [_entry(f"记忆条目 {i}", entry_id=f"{i:08d}-0000-0000-0000-000000000000") for i in range(5)]
    ctx = _make_tool_context(memories=memories)
    llm_request = MagicMock()

    await tool.process_llm_request(tool_context=ctx, llm_request=llm_request)

    block = llm_request.append_instructions.call_args[0][0][0]
    assert "记忆条目 0" in block
    assert "记忆条目 1" in block
    assert "记忆条目 2" not in block


async def test_max_chars_truncation(tool, monkeypatch):
    monkeypatch.setattr(
        "negentropy.agents.tools.memory._resolve_retrieval_settings",
        lambda: _RetrievalConfig(preload_top_k=5, preload_max_chars=200),
    )
    memories = [_entry("长内容" * 100, entry_id=f"{i:08d}-0000-0000-0000-000000000000") for i in range(3)]
    ctx = _make_tool_context(memories=memories)
    llm_request = MagicMock()

    await tool.process_llm_request(tool_context=ctx, llm_request=llm_request)

    block = llm_request.append_instructions.call_args[0][0][0]
    # 块体（不含 header/包裹标签）受 max_chars 约束：行内容累计 ≤ 200 字符
    body_lines = [line for line in block.splitlines() if line.startswith("- [Memory")]
    assert sum(len(line) for line in body_lines) <= 200
