"""_fire_reference_feedback 单测：引用解析变体 + outcome 保守映射。

mock RetrievalTracker 边界，验证：
- 两种引用格式（依据 Memory <id8> / [Memory <id8>]）均解析；
- 伪引用（不在注入集）不计；
- cited+pass/progressing→helpful；零引用→irrelevant；cited+regressed→不写；
- log_id 缺失/格式非法 → no-op。
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from negentropy.engine.routine.orchestrator import RoutineOrchestrator

_LOG_ID = "11111111-2222-3333-4444-555555555555"


def _orch() -> RoutineOrchestrator:
    return RoutineOrchestrator.__new__(RoutineOrchestrator)


def _meta(memory_ids: list[str], log_id: str = _LOG_ID) -> dict:
    return {"retrieval_log_id": log_id, "memory_ids": memory_ids}


@pytest.mark.asyncio
async def test_cited_progressing_marks_referenced_and_helpful():
    tracker = SimpleNamespace(
        mark_referenced=AsyncMock(return_value=True),
        record_feedback=AsyncMock(return_value=True),
    )
    with patch("negentropy.engine.adapters.postgres.retrieval_tracker.RetrievalTracker", return_value=tracker):
        await _orch()._fire_reference_feedback(
            summary="依据 Memory a1b2c3d4 (2026-05-12) 修复了鉴权",
            verdict="progressing",
            injection_meta=_meta(["a1b2c3d4"]),
        )
    tracker.mark_referenced.assert_awaited_once()
    assert tracker.mark_referenced.call_args.kwargs["reference_count"] == 1
    tracker.record_feedback.assert_awaited_once()
    assert tracker.record_feedback.call_args.args[1] == "helpful"


@pytest.mark.asyncio
async def test_bracket_form_citation_also_parsed():
    tracker = SimpleNamespace(mark_referenced=AsyncMock(), record_feedback=AsyncMock())
    with patch("negentropy.engine.adapters.postgres.retrieval_tracker.RetrievalTracker", return_value=tracker):
        await _orch()._fire_reference_feedback(
            summary="结论 [Memory a1b2c3d4, procedural] 指导了实现",
            verdict="pass",
            injection_meta=_meta(["a1b2c3d4"]),
        )
    tracker.mark_referenced.assert_awaited_once()


@pytest.mark.asyncio
async def test_zero_citation_marks_irrelevant():
    tracker = SimpleNamespace(mark_referenced=AsyncMock(), record_feedback=AsyncMock())
    with patch("negentropy.engine.adapters.postgres.retrieval_tracker.RetrievalTracker", return_value=tracker):
        await _orch()._fire_reference_feedback(
            summary="本轮未引用任何记忆，纯新进展",
            verdict="progressing",
            injection_meta=_meta(["a1b2c3d4"]),
        )
    tracker.mark_referenced.assert_not_awaited()
    tracker.record_feedback.assert_awaited_once()
    assert tracker.record_feedback.call_args.args[1] == "irrelevant"


@pytest.mark.asyncio
async def test_cited_regressed_writes_nothing():
    """有引用但 regressed/stalled：仍记 mark_referenced（事实性：确被引用），但不写 outcome（归因歧义）。"""
    tracker = SimpleNamespace(mark_referenced=AsyncMock(), record_feedback=AsyncMock())
    with patch("negentropy.engine.adapters.postgres.retrieval_tracker.RetrievalTracker", return_value=tracker):
        await _orch()._fire_reference_feedback(
            summary="依据 Memory a1b2c3d4 改动后回归",
            verdict="regressed",
            injection_meta=_meta(["a1b2c3d4"]),
        )
    tracker.mark_referenced.assert_awaited_once()  # 事实性记录
    tracker.record_feedback.assert_not_awaited()  # outcome 不写


@pytest.mark.asyncio
async def test_foreign_citation_not_in_injection_ignored():
    """伪引用（不在注入集）不计。"""
    tracker = SimpleNamespace(mark_referenced=AsyncMock(), record_feedback=AsyncMock())
    with patch("negentropy.engine.adapters.postgres.retrieval_tracker.RetrievalTracker", return_value=tracker):
        await _orch()._fire_reference_feedback(
            summary="依据 Memory deadbeef 做的",
            verdict="progressing",
            injection_meta=_meta(["a1b2c3d4"]),  # 注入的是 a1b2c3d4，引用 deadbeef 不算
        )
    tracker.mark_referenced.assert_not_awaited()
    # 零有效引用 → irrelevant
    tracker.record_feedback.assert_awaited_once()
    assert tracker.record_feedback.call_args.args[1] == "irrelevant"


@pytest.mark.asyncio
async def test_invalid_log_id_noop():
    tracker = SimpleNamespace(mark_referenced=AsyncMock(), record_feedback=AsyncMock())
    with patch("negentropy.engine.adapters.postgres.retrieval_tracker.RetrievalTracker", return_value=tracker):
        await _orch()._fire_reference_feedback(
            summary="依据 Memory a1b2c3d4",
            verdict="pass",
            injection_meta=_meta(["a1b2c3d4"], log_id="not-a-uuid"),
        )
    tracker.mark_referenced.assert_not_awaited()
    tracker.record_feedback.assert_not_awaited()


@pytest.mark.asyncio
async def test_disabled_or_missing_meta_noop(monkeypatch):
    """memory_feedback_enabled 关闭或 injection_meta 缺失 → 完全 no-op。"""
    from negentropy.config import settings
    from negentropy.config.routine import RoutineSettings

    disabled = RoutineSettings(memory_feedback_enabled=False)
    monkeypatch.setattr(type(settings), "routine", property(lambda self: disabled))
    tracker = SimpleNamespace(mark_referenced=AsyncMock(), record_feedback=AsyncMock())
    with patch("negentropy.engine.adapters.postgres.retrieval_tracker.RetrievalTracker", return_value=tracker):
        await _orch()._fire_reference_feedback(
            summary="依据 Memory a1b2c3d4",
            verdict="pass",
            injection_meta=_meta(["a1b2c3d4"]),
        )
        # meta 缺失
        await _orch()._fire_reference_feedback(summary="x", verdict="pass", injection_meta=None)
    tracker.mark_referenced.assert_not_awaited()
    tracker.record_feedback.assert_not_awaited()
