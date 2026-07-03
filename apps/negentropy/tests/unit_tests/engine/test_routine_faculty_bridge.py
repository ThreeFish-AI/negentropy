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


@pytest.mark.asyncio
async def test_drive_injects_approval_policy_never(monkeypatch):
    """_drive 预创建 session 时注入 approval_policy=never（自治 faculty 免审批门，ISSUE-156 续）。

    断言 create_session 收到 state={"approval_policy":{"mode":"never"}}，且 user_id/session_id
    透传正确；预创建失败不阻断主流程（runner 仍被调用）。
    """
    captured: dict = {}

    class _FakeService:
        async def create_session(self, *, app_name, user_id, session_id, state=None):
            captured.update(app_name=app_name, user_id=user_id, session_id=session_id, state=state)
            return object()

    import negentropy.engine.factories.runner as runner_factory
    import negentropy.engine.factories.session as session_factory

    monkeypatch.setattr(session_factory, "get_session_service", lambda: _FakeService())

    runner_called: list = []

    class _FakeRunner:
        app_name = "negentropy"

        async def run_async(self, *, user_id, session_id, new_message):
            runner_called.append((user_id, session_id))
            return
            yield  # 令本函数成为 async generator（不 yield 任何事件）

    monkeypatch.setattr(runner_factory, "get_runner", lambda **kw: _FakeRunner())

    result = await faculty_bridge._drive(object(), "task-prompt", user_id="u-fac")
    assert result is None  # 空 generator → 无 final response
    # approval_policy=never 注入到预创建 session 的 initial state
    assert captured.get("state") == {"approval_policy": {"mode": "never"}}
    assert captured.get("user_id") == "u-fac"
    # runner 仍被调用（主流程不因预创建阻断）
    assert runner_called and runner_called[0][0] == "u-fac"


@pytest.mark.asyncio
async def test_drive_precreate_failure_does_not_block(monkeypatch):
    """预创建 session 抛错时降级（runner 自行建会话），不阻断 faculty 主流程。"""
    import negentropy.engine.factories.runner as runner_factory
    import negentropy.engine.factories.session as session_factory

    class _BoomService:
        async def create_session(self, **kw):
            raise RuntimeError("backend down")

    monkeypatch.setattr(session_factory, "get_session_service", lambda: _BoomService())

    runner_called: list = []

    class _FakeRunner:
        app_name = "negentropy"

        async def run_async(self, *, user_id, session_id, new_message):
            runner_called.append(session_id)
            return
            yield

    monkeypatch.setattr(runner_factory, "get_runner", lambda **kw: _FakeRunner())

    result = await faculty_bridge._drive(object(), "task", user_id="u")
    assert result is None
    assert runner_called, "预创建失败后 runner 仍应被调用"
