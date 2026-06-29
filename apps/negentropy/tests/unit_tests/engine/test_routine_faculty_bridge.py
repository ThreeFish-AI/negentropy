"""FacultyBridge 单测（ADR 040）—— 角色映射、降级、超时（纯逻辑，monkeypatch ADK，无真实 LLM/DB）。

覆盖：
- ``run_faculty`` 在未知角色 / 构造失败 / 超时 / 异常时返回 None（调用方据此降级）；
- ``run_with_fallback`` 在 Faculty 成功时返回 (text, True)、失败时回退 fallback 返回 (text, False)；
- 角色→工厂映射表覆盖一核五翼全部 5 翼。
"""

from __future__ import annotations

import asyncio

import pytest

from negentropy.engine.routine import faculty_bridge


def test_role_to_faculty_factory_covers_five_faculties():
    mapping = faculty_bridge._ROLE_TO_FACULTY_FACTORY
    assert set(mapping) == {"perception", "action", "internalization", "contemplation", "influence"}
    # engine / claude_code 不经 FacultyBridge（编排方 / 机器）
    assert "engine" not in mapping
    assert "claude_code" not in mapping


@pytest.mark.asyncio
async def test_run_faculty_unknown_role_returns_none():
    assert await faculty_bridge.run_faculty("nonexistent_role", "task") is None


@pytest.mark.asyncio
async def test_run_faculty_build_failure_returns_none(monkeypatch):
    """Faculty 构造异常（如 ADK 不可用）→ None（调用方降级）。"""
    monkeypatch.setattr(faculty_bridge, "_build_faculty_agent", lambda role: None)
    assert await faculty_bridge.run_faculty("contemplation", "task") is None


@pytest.mark.asyncio
async def test_run_faculty_timeout_returns_none(monkeypatch):
    """_drive 超时 → None。"""
    monkeypatch.setattr(faculty_bridge, "_build_faculty_agent", lambda role: object())

    async def _slow(*args, **kwargs):
        await asyncio.sleep(10)
        return "late"

    monkeypatch.setattr(faculty_bridge, "_drive", _slow)
    assert await faculty_bridge.run_faculty("contemplation", "task", timeout_seconds=0.05) is None


@pytest.mark.asyncio
async def test_run_faculty_drive_exception_returns_none(monkeypatch):
    monkeypatch.setattr(faculty_bridge, "_build_faculty_agent", lambda role: object())

    async def _boom(*args, **kwargs):
        raise RuntimeError("adk down")

    monkeypatch.setattr(faculty_bridge, "_drive", _boom)
    assert await faculty_bridge.run_faculty("contemplation", "task") is None


@pytest.mark.asyncio
async def test_run_faculty_success_returns_text(monkeypatch):
    monkeypatch.setattr(faculty_bridge, "_build_faculty_agent", lambda role: object())

    async def _ok(*args, **kwargs):
        return '{"verdict": "approve"}'

    monkeypatch.setattr(faculty_bridge, "_drive", _ok)
    out = await faculty_bridge.run_faculty("contemplation", "task")
    assert out == '{"verdict": "approve"}'


@pytest.mark.asyncio
async def test_run_with_fallback_uses_faculty_when_available(monkeypatch):
    async def _ok(*args, **kwargs):
        return "from-faculty"

    monkeypatch.setattr(faculty_bridge, "run_faculty", _ok)

    async def _fallback():
        return "from-litellm"

    text, used = await faculty_bridge.run_with_fallback("contemplation", "task", _fallback)
    assert text == "from-faculty"
    assert used is True


@pytest.mark.asyncio
async def test_run_with_fallback_degrades_when_faculty_none(monkeypatch):
    async def _none(*args, **kwargs):
        return None

    monkeypatch.setattr(faculty_bridge, "run_faculty", _none)

    async def _fallback():
        return "from-litellm"

    text, used = await faculty_bridge.run_with_fallback("contemplation", "task", _fallback)
    assert text == "from-litellm"
    assert used is False
