"""Routine 记忆注入行格式单测 — Memory id 短码 + 日期 + routine 溯源（引用规范）。

mock MemoryService 边界，不连数据库。
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from negentropy.engine.routine.orchestrator import RoutineOrchestrator


def _entry(
    *,
    mem_id: str = "a1b2c3d4-5678-90ab-cdef-1234567890ab",
    text: str = "修复鉴权时优先检查 token 过期",
    timestamp: str = "2026-05-12T08:00:00Z",
    metadata: dict | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        id=mem_id,
        content={"parts": [{"text": text}]},
        timestamp=timestamp,
        custom_metadata=metadata or {},
    )


def _routine() -> SimpleNamespace:
    return SimpleNamespace(
        id="routine-uuid",
        goal="修复登录",
        acceptance_criteria="测试通过",
        owner_id="user-1",
    )


def _orchestrator() -> RoutineOrchestrator:
    return RoutineOrchestrator.__new__(RoutineOrchestrator)  # 跳过 __init__（仅测纯方法）


@pytest.mark.asyncio
async def test_memory_context_line_carries_id_date_and_routine_provenance():
    entry = _entry(
        metadata={
            "memory_type": "procedural",
            "source": "routine_extraction",
            "routine_key": "fix-auth",
            "iteration_seq": 3,
        }
    )
    mem_service = MagicMock()
    mem_service.search_memory = AsyncMock(return_value=SimpleNamespace(memories=[entry]))

    with patch("negentropy.engine.factories.memory.get_memory_service", return_value=mem_service):
        ctx = await _orchestrator()._retrieve_memory_context(_routine())

    assert ctx is not None
    assert "[procedural] Memory a1b2c3d4 (2026-05-12)" in ctx
    assert "（来自 routine fix-auth 第3轮）" in ctx
    assert "修复鉴权时优先检查 token 过期" in ctx


@pytest.mark.asyncio
async def test_memory_context_without_routine_metadata():
    """非 routine 来源的记忆：仍带 id 短码与日期，不带 routine 溯源后缀。"""
    entry = _entry(metadata={"memory_type": "episodic"})
    mem_service = MagicMock()
    mem_service.search_memory = AsyncMock(return_value=SimpleNamespace(memories=[entry]))

    with patch("negentropy.engine.factories.memory.get_memory_service", return_value=mem_service):
        ctx = await _orchestrator()._retrieve_memory_context(_routine())

    assert ctx is not None
    assert "[episodic] Memory a1b2c3d4 (2026-05-12):" in ctx
    assert "来自 routine" not in ctx


@pytest.mark.asyncio
async def test_memory_context_fail_soft_returns_none():
    """检索异常 → 返回 None，不向上抛（不阻塞派发）。"""
    mem_service = MagicMock()
    mem_service.search_memory = AsyncMock(side_effect=RuntimeError("memory backend down"))

    with patch("negentropy.engine.factories.memory.get_memory_service", return_value=mem_service):
        ctx = await _orchestrator()._retrieve_memory_context(_routine())

    assert ctx is None


@pytest.mark.asyncio
async def test_memory_context_empty_results_returns_none():
    mem_service = MagicMock()
    mem_service.search_memory = AsyncMock(return_value=SimpleNamespace(memories=[]))

    with patch("negentropy.engine.factories.memory.get_memory_service", return_value=mem_service):
        ctx = await _orchestrator()._retrieve_memory_context(_routine())

    assert ctx is None


def test_memory_entry_text_handles_three_shapes():
    """Content 对象 / dict / 纯字符串三种形态均能提取文本。"""
    extract = RoutineOrchestrator._memory_entry_text

    # dict 形态（ADK MemoryEntry 构造入参形态）
    assert extract(SimpleNamespace(content={"parts": [{"text": "hello"}]})) == "hello"
    # 纯字符串
    assert extract(SimpleNamespace(content="raw string")) == "raw string"

    # genai Content 风格对象（.parts[].text）
    part = SimpleNamespace(text="from object")
    assert extract(SimpleNamespace(content=SimpleNamespace(parts=[part]))) == "from object"
    # 空内容降级空串
    assert extract(SimpleNamespace(content=None)) == ""
