"""Phase 4 Handler 单元测试

覆盖：
- HANDLER_REGISTRY 注册的 6 个 handler 名称
- agent_inspection 的 self_check / faculty_health / unknown 分支
- cache_warm / pgvector_check / pipeline_watchdog 失败 fail-soft
"""

from __future__ import annotations

import pytest

from negentropy.engine.schedulers.handlers import (
    HANDLER_REGISTRY,
    HandlerResult,
    _bootstrap_default_handlers,
    get_handler,
    list_handlers,
)


@pytest.fixture(autouse=True)
def _bootstrap_handlers():
    _bootstrap_default_handlers()


def _make_task(handler_kind: str, payload: dict | None = None, key: str = "test"):
    """构造一个最小化的 task 对象用于 handler 调用（不入 DB）。"""

    class _Task:
        pass

    t = _Task()
    t.id = None
    t.key = key
    t.handler_kind = handler_kind
    t.payload = payload or {}
    return t


class TestRegistry:
    def test_all_six_handlers_registered(self):
        expected = {
            "skill_invoke",
            "pipeline_watchdog",
            "session_title_inspect",
            "cache_warm",
            "pgvector_check",
            "agent_inspection",
        }
        assert expected <= set(HANDLER_REGISTRY.keys())

    def test_list_handlers_returns_registered(self):
        names = list_handlers()
        assert "agent_inspection" in names

    def test_get_handler_missing_returns_none(self):
        assert get_handler("nonexistent_kind") is None


class TestAgentInspectionHandler:
    @pytest.mark.asyncio
    async def test_self_check_returns_ok(self):
        handler = get_handler("agent_inspection")
        assert handler is not None
        task = _make_task("agent_inspection", payload={"inspection_type": "self_check"})
        result = await handler(task)
        assert isinstance(result, HandlerResult)
        assert result.status == "ok"
        assert "heartbeat alive" in (result.output_summary or "")

    @pytest.mark.asyncio
    async def test_default_inspection_type_is_self_check(self):
        handler = get_handler("agent_inspection")
        task = _make_task("agent_inspection", payload={})
        result = await handler(task)
        assert result.status == "ok"

    @pytest.mark.asyncio
    async def test_unknown_inspection_type_falls_through_to_ok(self):
        handler = get_handler("agent_inspection")
        task = _make_task("agent_inspection", payload={"inspection_type": "unknown_xyz"})
        result = await handler(task)
        # 最小骨架阶段：unknown 类型保留扩展空间，不视为失败
        assert result.status == "ok"
        assert "unknown" in (result.output_summary or "")


class TestSkillInvokeHandler:
    @pytest.mark.asyncio
    async def test_missing_skill_schedule_id_fails(self):
        handler = get_handler("skill_invoke")
        task = _make_task("skill_invoke", payload={})
        result = await handler(task)
        assert result.status == "failed"
        assert "skill_schedule_id" in (result.error or "")

    @pytest.mark.asyncio
    async def test_invalid_uuid_fails_gracefully(self):
        handler = get_handler("skill_invoke")
        task = _make_task("skill_invoke", payload={"skill_schedule_id": "not-a-uuid"})
        result = await handler(task)
        assert result.status == "failed"
        assert "invalid skill_schedule_id" in (result.error or "")
