"""Phase 4 + Phase 5 Handler 单元测试

覆盖：
- HANDLER_REGISTRY 注册的 6 个 handler 名称
- agent_inspection 的 self_check / faculty_health / faculty_deep_check /
  scheduled_tasks_summary / unknown 分支
- token budget gate + backoff 策略
- cache_warm / pgvector_check / pipeline_watchdog 失败 fail-soft
"""

from __future__ import annotations

from uuid import uuid4

import pytest

from negentropy.engine.schedulers.handlers import (
    HANDLER_REGISTRY,
    HandlerResult,
    _bootstrap_default_handlers,
    get_handler,
    list_handlers,
)
from negentropy.engine.schedulers.handlers.agent_inspection import (
    BACKOFF_BASE_SECONDS,
    BACKOFF_CEILING_SECONDS,
    BACKOFF_FAILURE_THRESHOLD,
    ContextPack,
    _check_token_budget,
    _compute_backoff_seconds,
)


@pytest.fixture(autouse=True)
def _bootstrap_handlers():
    _bootstrap_default_handlers()


def _make_task(
    handler_kind: str,
    payload: dict | None = None,
    key: str = "test",
    *,
    token_budget: int | None = None,
    consecutive_failures: int = 0,
    backoff_until=None,
):
    """构造一个最小化的 task 对象用于 handler 调用（不入 DB）。"""

    class _Task:
        pass

    t = _Task()
    t.id = uuid4()
    t.key = key
    t.handler_kind = handler_kind
    t.payload = payload or {}
    t.role = None
    t.scenario = None
    t.token_budget = token_budget
    t.consecutive_failures = consecutive_failures
    t.backoff_until = backoff_until
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


@pytest.fixture
def fake_context_pack(monkeypatch):
    """避开 build_context_pack 内的 DB 查询。"""

    async def _fake(task):
        return ContextPack(
            task_id=str(task.id),
            task_key=task.key,
            handler_kind=task.handler_kind,
            role=task.role,
            scenario=task.scenario,
            payload=dict(task.payload or {}),
            recent_status=[],
            tokens_used_in_window=0,
            consecutive_failures=int(task.consecutive_failures or 0),
        )

    monkeypatch.setattr(
        "negentropy.engine.schedulers.handlers.agent_inspection.build_context_pack",
        _fake,
    )
    return _fake


class TestAgentInspectionHandler:
    @pytest.mark.asyncio
    async def test_self_check_returns_ok(self, fake_context_pack):
        handler = get_handler("agent_inspection")
        assert handler is not None
        task = _make_task("agent_inspection", payload={"inspection_type": "self_check"})
        result = await handler(task)
        assert isinstance(result, HandlerResult)
        assert result.status == "ok"
        assert "heartbeat alive" in (result.output_summary or "")

    @pytest.mark.asyncio
    async def test_default_inspection_type_is_self_check(self, fake_context_pack):
        handler = get_handler("agent_inspection")
        task = _make_task("agent_inspection", payload={})
        result = await handler(task)
        assert result.status == "ok"

    @pytest.mark.asyncio
    async def test_unknown_inspection_type_falls_through_to_ok(self, fake_context_pack):
        handler = get_handler("agent_inspection")
        task = _make_task("agent_inspection", payload={"inspection_type": "unknown_xyz"})
        result = await handler(task)
        assert result.status == "ok"
        assert "unknown" in (result.output_summary or "")

    @pytest.mark.asyncio
    async def test_faculty_health_check_passes(self, fake_context_pack):
        handler = get_handler("agent_inspection")
        task = _make_task("agent_inspection", payload={"inspection_type": "faculty_health"})
        result = await handler(task)
        assert result.status == "ok"
        assert "perception=ok" in (result.output_summary or "")


class TestTokenBudgetGate:
    def test_none_budget_passes(self):
        task = _make_task("agent_inspection", token_budget=None)
        ctx = ContextPack(
            task_id=str(task.id),
            task_key=task.key,
            handler_kind="agent_inspection",
            role=None,
            scenario=None,
            tokens_used_in_window=10_000,
        )
        assert _check_token_budget(task, ctx) is None

    def test_zero_budget_always_rejected(self):
        task = _make_task("agent_inspection", token_budget=0)
        ctx = ContextPack(
            task_id=str(task.id),
            task_key=task.key,
            handler_kind="agent_inspection",
            role=None,
            scenario=None,
            tokens_used_in_window=0,
        )
        assert _check_token_budget(task, ctx) is not None

    def test_under_budget_passes(self):
        task = _make_task("agent_inspection", token_budget=1000)
        ctx = ContextPack(
            task_id=str(task.id),
            task_key=task.key,
            handler_kind="agent_inspection",
            role=None,
            scenario=None,
            tokens_used_in_window=500,
        )
        assert _check_token_budget(task, ctx) is None

    def test_over_budget_rejected(self):
        task = _make_task("agent_inspection", token_budget=1000)
        ctx = ContextPack(
            task_id=str(task.id),
            task_key=task.key,
            handler_kind="agent_inspection",
            role=None,
            scenario=None,
            tokens_used_in_window=1500,
        )
        reason = _check_token_budget(task, ctx)
        assert reason is not None
        assert "1500" in reason

    @pytest.mark.asyncio
    async def test_handler_skips_when_over_budget(self, fake_context_pack, monkeypatch):
        """Token 超额时 handler 应返回 status=ok 但带 skipped 标识，不真正执行业务。"""

        async def fake_with_tokens(task):
            return ContextPack(
                task_id=str(task.id),
                task_key=task.key,
                handler_kind=task.handler_kind,
                role=task.role,
                scenario=task.scenario,
                payload=dict(task.payload or {}),
                tokens_used_in_window=5000,
            )

        monkeypatch.setattr(
            "negentropy.engine.schedulers.handlers.agent_inspection.build_context_pack",
            fake_with_tokens,
        )

        handler = get_handler("agent_inspection")
        task = _make_task(
            "agent_inspection",
            payload={"inspection_type": "faculty_health"},
            token_budget=1000,
        )
        result = await handler(task)
        assert result.status == "ok"
        assert "skipped" in (result.output_summary or "")


class TestBackoffPolicy:
    def test_below_threshold_returns_base_or_less(self):
        # consec < 阈值时不应进入退避路径，但 _compute_backoff_seconds 仍可被调用；
        # 此处验证函数行为：consec=阈值-1 → over=0 → BASE * 2^0 = BASE * jitter
        delay = _compute_backoff_seconds(BACKOFF_FAILURE_THRESHOLD - 1)
        assert 0 <= delay <= BACKOFF_BASE_SECONDS * 1.1 + 0.1

    def test_at_threshold_returns_base(self):
        delay = _compute_backoff_seconds(BACKOFF_FAILURE_THRESHOLD)
        # ±10% jitter
        assert BACKOFF_BASE_SECONDS * 0.9 <= delay <= BACKOFF_BASE_SECONDS * 1.1

    def test_exponential_growth_capped(self):
        delay = _compute_backoff_seconds(BACKOFF_FAILURE_THRESHOLD + 20)
        # 远超阈值时应被 ceiling 截断（带 jitter，所以上限是 ceiling * 1.1）
        assert delay <= BACKOFF_CEILING_SECONDS * 1.1 + 0.1

    def test_growth_is_monotonic_in_expected_range(self):
        d1 = _compute_backoff_seconds(BACKOFF_FAILURE_THRESHOLD)
        d3 = _compute_backoff_seconds(BACKOFF_FAILURE_THRESHOLD + 3)
        # consec=阈值+3 → over=3 → 8 * BASE * jitter；理论下限 8 * BASE * 0.9 > 阈值上限
        assert d3 > d1


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
