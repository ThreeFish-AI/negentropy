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
            "retrieval_log_id": "11111111-2222-3333-4444-555555555555",
        }
    )
    mem_service = MagicMock()
    mem_service.search_memory = AsyncMock(return_value=SimpleNamespace(memories=[entry]))

    with patch("negentropy.engine.factories.memory.get_memory_service", return_value=mem_service):
        ctx, meta = await _orchestrator()._retrieve_memory_context(_routine())

    assert ctx is not None
    assert "[procedural] Memory a1b2c3d4 (2026-05-12)" in ctx
    assert "（来自 routine fix-auth 第3轮）" in ctx
    assert "修复鉴权时优先检查 token 过期" in ctx
    # 反馈闭环元数据：retrieval_log_id + memory_ids 透传
    assert meta is not None
    assert meta["retrieval_log_id"] == "11111111-2222-3333-4444-555555555555"
    assert meta["memory_ids"] == ["a1b2c3d4"]


@pytest.mark.asyncio
async def test_memory_context_without_routine_metadata():
    """非 routine 来源的记忆：仍带 id 短码与日期，不带 routine 溯源后缀。"""
    entry = _entry(metadata={"memory_type": "episodic"})
    mem_service = MagicMock()
    mem_service.search_memory = AsyncMock(return_value=SimpleNamespace(memories=[entry]))

    with patch("negentropy.engine.factories.memory.get_memory_service", return_value=mem_service):
        ctx, meta = await _orchestrator()._retrieve_memory_context(_routine())

    assert ctx is not None
    assert "[episodic] Memory a1b2c3d4 (2026-05-12):" in ctx
    assert "来自 routine" not in ctx
    assert meta is not None and meta["memory_ids"] == ["a1b2c3d4"]


@pytest.mark.asyncio
async def test_memory_context_fail_soft_returns_none():
    """检索异常 → 返回 (None, None)，不向上抛（不阻塞派发）。"""
    mem_service = MagicMock()
    mem_service.search_memory = AsyncMock(side_effect=RuntimeError("memory backend down"))

    with patch("negentropy.engine.factories.memory.get_memory_service", return_value=mem_service):
        ctx, meta = await _orchestrator()._retrieve_memory_context(_routine())

    assert ctx is None and meta is None


@pytest.mark.asyncio
async def test_memory_context_empty_results_returns_none():
    mem_service = MagicMock()
    mem_service.search_memory = AsyncMock(return_value=SimpleNamespace(memories=[]))

    with patch("negentropy.engine.factories.memory.get_memory_service", return_value=mem_service):
        ctx, meta = await _orchestrator()._retrieve_memory_context(_routine())

    assert ctx is None and meta is None


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


@pytest.mark.asyncio
async def test_repo_failure_lessons_merged_and_deduped(monkeypatch):
    """同 repo 失败教训确定性注入：与语义命中按 id 去重、行前缀「⚠ 失败教训」。"""
    from negentropy.engine.routine.orchestrator import RoutineOrchestrator

    orch = RoutineOrchestrator.__new__(RoutineOrchestrator)
    # 语义命中 a1b2c3d4；repo 失败教训返回 a1b2c3d4（重复，应去重）+ deadbeef（新）
    entry = _entry(mem_id="a1b2c3d4-5678-90ab-cdef-1234567890ab", metadata={"memory_type": "procedural"})
    mem_service = MagicMock()
    mem_service.search_memory = AsyncMock(return_value=SimpleNamespace(memories=[entry]))

    async def _fake_fetch(*, user_id, repository_id, limit):
        return [
            {
                "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
                "content": "已命中应去重",
                "termination_reason": "no_progress",
            },
            {
                "id": "deadbeef-dead-beef-dead-beefdeadbeef",
                "content": "同 repo 新失败教训",
                "termination_reason": "oscillation",
            },
        ]

    routine = _routine()
    routine.repository_id = "repo-uuid"
    with (
        patch("negentropy.engine.factories.memory.get_memory_service", return_value=mem_service),
        patch.object(RoutineOrchestrator, "_fetch_repo_failure_lessons", side_effect=_fake_fetch),
    ):
        ctx, meta = await orch._retrieve_memory_context(routine)

    assert ctx is not None
    assert "⚠ 失败教训 Memory deadbeef" in ctx
    assert "oscillation" in ctx
    # 重复的 a1b2c3d4 不再以失败教训行二次出现（去重）
    assert ctx.count("a1b2c3d4") == 1
    assert meta["memory_ids"] == ["a1b2c3d4", "deadbeef"]


@pytest.mark.asyncio
async def test_repo_failure_lessons_skipped_without_repository(monkeypatch):
    """repository_id 缺失 → 不触发失败教训补充段。"""
    from negentropy.engine.routine.orchestrator import RoutineOrchestrator

    orch = RoutineOrchestrator.__new__(RoutineOrchestrator)
    entry = _entry(metadata={"memory_type": "procedural"})
    mem_service = MagicMock()
    mem_service.search_memory = AsyncMock(return_value=SimpleNamespace(memories=[entry]))

    fetch_called = False

    async def _fake_fetch(**kw):
        nonlocal fetch_called
        fetch_called = True
        return []

    routine = _routine()
    routine.repository_id = None  # 无 repo
    with (
        patch("negentropy.engine.factories.memory.get_memory_service", return_value=mem_service),
        patch.object(RoutineOrchestrator, "_fetch_repo_failure_lessons", side_effect=_fake_fetch),
    ):
        ctx, _ = await orch._retrieve_memory_context(routine)

    assert ctx is not None
    assert not fetch_called
    assert "失败教训" not in ctx
