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
    monkeypatch.setattr(faculty_bridge, "_build_faculty_agent", lambda role, *, read_only=False: None)
    assert await faculty_bridge.run_faculty("contemplation", "task") is None


@pytest.mark.asyncio
async def test_run_faculty_timeout_returns_none(monkeypatch):
    """_drive 超时 → None。"""
    monkeypatch.setattr(faculty_bridge, "_build_faculty_agent", lambda role, *, read_only=False: object())

    async def _slow(*args, **kwargs):
        await asyncio.sleep(10)
        return "late"

    monkeypatch.setattr(faculty_bridge, "_drive", _slow)
    assert await faculty_bridge.run_faculty("contemplation", "task", timeout_seconds=0.05) is None


@pytest.mark.asyncio
async def test_run_faculty_drive_exception_returns_none(monkeypatch):
    monkeypatch.setattr(faculty_bridge, "_build_faculty_agent", lambda role, *, read_only=False: object())

    async def _boom(*args, **kwargs):
        raise RuntimeError("adk down")

    monkeypatch.setattr(faculty_bridge, "_drive", _boom)
    assert await faculty_bridge.run_faculty("contemplation", "task") is None


@pytest.mark.asyncio
async def test_run_faculty_success_returns_text(monkeypatch):
    monkeypatch.setattr(faculty_bridge, "_build_faculty_agent", lambda role, *, read_only=False: object())

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


# ---------------------------------------------------------------------------
# WS2: run_faculty_json（Faculty 优先 + litellm 兜底）+ read_only 护栏 + budget
# ---------------------------------------------------------------------------


async def test_run_faculty_json_disabled_goes_fallback(monkeypatch):
    """enabled=False → 直接 fallback，run_faculty 不被调用。"""
    called: list = []

    async def _fac(*a, **kw):
        called.append(1)
        return "should-not-reach"

    monkeypatch.setattr(faculty_bridge, "run_faculty", _fac)

    async def _fallback():
        return {"v": "litellm"}

    res, used = await faculty_bridge.run_faculty_json(
        "contemplation", "p", parse=lambda s: {"v": s}, fallback=_fallback, enabled=False
    )
    assert res == {"v": "litellm"}
    assert used is False
    assert not called  # faculty 未触发


async def test_run_faculty_json_hit_returns_parsed(monkeypatch):
    """faculty 返回有效文本 + parse 非 None → 用之，fallback 不调用。"""
    fb_called: list = []

    async def _fac(*a, **kw):
        return '{"score": 88}'

    monkeypatch.setattr(faculty_bridge, "run_faculty", _fac)

    async def _fallback():
        fb_called.append(1)
        return {"score": 0}

    def _parse(text):
        import json

        d = json.loads(text)
        return {"score": d["score"]} if isinstance(d, dict) and "score" in d else None

    res, used = await faculty_bridge.run_faculty_json(
        "contemplation", "p", parse=_parse, fallback=_fallback, enabled=True
    )
    assert res == {"score": 88}
    assert used is True
    assert not fb_called


async def test_run_faculty_json_none_text_falls_back(monkeypatch):
    """faculty 返回 None → 降级 fallback。"""

    async def _fac(*a, **kw):
        return None

    monkeypatch.setattr(faculty_bridge, "run_faculty", _fac)

    async def _fallback():
        return "litellm"

    res, used = await faculty_bridge.run_faculty_json(
        "contemplation", "p", parse=lambda s: s, fallback=_fallback, enabled=True
    )
    assert res == "litellm"
    assert used is False


async def test_run_faculty_json_parse_none_falls_back(monkeypatch):
    """parse 返回 None（脏文本 / 非预期）→ 降级 fallback（硬闸）。"""

    async def _fac(*a, **kw):
        return "garbage not json"

    monkeypatch.setattr(faculty_bridge, "run_faculty", _fac)

    async def _fallback():
        return "litellm-clean"

    res, used = await faculty_bridge.run_faculty_json(
        "contemplation", "p", parse=lambda s: None, fallback=_fallback, enabled=True
    )
    assert res == "litellm-clean"
    assert used is False


async def test_run_faculty_json_budget_exhausted_skips_faculty(monkeypatch):
    """budget=0 + enabled=True → 跳过 faculty 直接 fallback（成本护栏）。"""
    fac_called: list = []

    async def _fac(*a, **kw):
        fac_called.append(1)
        return '{"score": 1}'

    monkeypatch.setattr(faculty_bridge, "run_faculty", _fac)

    async def _fallback():
        return "litellm"

    async with faculty_bridge.faculty_bridge_budget(0):
        res, used = await faculty_bridge.run_faculty_json(
            "contemplation", "p", parse=lambda s: "x", fallback=_fallback, enabled=True
        )
    assert res == "litellm"
    assert used is False
    assert not fac_called


async def test_read_only_strips_side_effect_tools():
    """read_only=True：Internalization 剥离副作用工具 + 整体剔除 BaseToolset。

    核心安全测试（破解「副作用工具陷阱」）：桥接层注入 approval=never，若不剥离，
    save_to_memory / update_knowledge_graph / ingest_* 会在无人在环下静默真写。
    """
    from google.adk.tools.base_toolset import BaseToolset

    from negentropy.agents.tools.registry import tool_name

    agent = faculty_bridge._build_faculty_agent("internalization", read_only=True)
    tool_names = {tool_name(t) for t in agent.tools}
    # 恒常只读工具保留
    assert "log_activity" in tool_names
    assert "load_memory" in tool_names
    # 副作用工具全部剥离
    for side_effect in ("save_to_memory", "update_knowledge_graph", "ingest_paper", "ingest_to_corpus"):
        assert side_effect not in tool_names, f"read_only 未剥离副作用工具 {side_effect!r}"
    # BaseToolset 整体剔除（副作用工具藏于其内）
    assert not any(isinstance(t, BaseToolset) for t in agent.tools)


async def test_read_only_false_keeps_toolset():
    """read_only=False（默认）：保留 BaseToolset（完整可摘工具集）。"""
    from google.adk.tools.base_toolset import BaseToolset

    agent = faculty_bridge._build_faculty_agent("internalization", read_only=False)
    assert any(isinstance(t, BaseToolset) for t in agent.tools)


async def test_faculty_bridge_budget_decrements_on_hit(monkeypatch):
    """budget 命中后自减；第二次调用仍可命中（budget>0），第三次耗尽则降级。"""

    async def _fac(*a, **kw):
        return "ok"

    monkeypatch.setattr(faculty_bridge, "run_faculty", _fac)

    async def _fallback():
        return "litellm"

    async with faculty_bridge.faculty_bridge_budget(2):
        _, u1 = await faculty_bridge.run_faculty_json(
            "contemplation", "p", parse=lambda s: s, fallback=_fallback, enabled=True
        )
        _, u2 = await faculty_bridge.run_faculty_json(
            "contemplation", "p", parse=lambda s: s, fallback=_fallback, enabled=True
        )
        _, u3 = await faculty_bridge.run_faculty_json(
            "contemplation", "p", parse=lambda s: s, fallback=_fallback, enabled=True
        )
    assert (u1, u2, u3) == (True, True, False)  # 第三次耗尽 → 降级
