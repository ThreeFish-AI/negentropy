"""Phase 4 + Phase 5 Handler 单元测试

覆盖：
- HANDLER_REGISTRY 注册的 6 个 handler 名称
- agent_inspection 的 self_check / faculty_health / faculty_deep_check /
  scheduled_tasks_summary / unknown 分支
- token budget gate + backoff 策略
- cache_warm / pgvector_check / pipeline_watchdog 失败 fail-soft
"""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

import pytest

from negentropy.engine.schedulers.handlers import (
    HANDLER_REGISTRY,
    HandlerResult,
    _bootstrap_default_handlers,
    get_descriptor,
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
    _scheduled_tasks_summary,
)
from negentropy.engine.schedulers.handlers.memory_automation import _parse_interval


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
    def test_all_eight_handlers_registered(self):
        expected = {
            "skill_invoke",
            "pipeline_watchdog",
            "session_title_inspect",
            "cache_warm",
            "pgvector_check",
            "agent_inspection",
            "memory_automation",
            "claude_code",
        }
        assert expected <= set(HANDLER_REGISTRY.keys())

    def test_list_handlers_returns_registered(self):
        names = list_handlers()
        assert "agent_inspection" in names

    def test_get_handler_missing_returns_none(self):
        assert get_handler("nonexistent_kind") is None


class TestDescriptorRegistry:
    """验证每个 handler 都有对应的 descriptor，且判别式 handler 结构正确。"""

    def test_every_handler_has_descriptor(self):
        for kind in HANDLER_REGISTRY:
            desc = get_descriptor(kind)
            assert desc is not None, f"handler '{kind}' has no descriptor"
            assert desc.handler_kind == kind
            assert desc.label  # label 非空
            assert desc.supported_trigger_types  # 至少支持一种触发类型

    def test_agent_inspection_descriptor(self):
        desc = get_descriptor("agent_inspection")
        assert desc is not None
        assert desc.discriminator_field == "inspection_type"
        assert desc.supports_token_budget is True
        # 枚举字段存在
        enum_fields = [f for f in desc.payload_fields if f.type == "enum"]
        assert len(enum_fields) == 1
        assert enum_fields[0].name == "inspection_type"
        assert "faculty_health" in (enum_fields[0].enum_options or ())

    def test_memory_automation_descriptor(self):
        desc = get_descriptor("memory_automation")
        assert desc is not None
        assert desc.discriminator_field == "job_type"
        # 从属字段带 applies_when
        threshold = next(f for f in desc.payload_fields if f.name == "threshold")
        assert threshold.applies_when == ("cleanup_memories",)
        lookback = next(f for f in desc.payload_fields if f.name == "lookback_interval")
        assert lookback.applies_when == ("trigger_consolidation",)

    def test_oneshot_handlers_only_support_oneshot(self):
        for kind in ("cache_warm", "pgvector_check"):
            desc = get_descriptor(kind)
            assert desc.supported_trigger_types == ("oneshot",)


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


class _FakeRow:
    def __init__(self, status: str | None, count: int):
        self.status = status
        self.count = count


class _FakeResult:
    def __init__(self, rows: list[_FakeRow]):
        self._rows = rows

    def all(self) -> list[_FakeRow]:
        return self._rows


class _FakeAsyncSession:
    def __init__(self, rows: list[_FakeRow]):
        self._rows = rows
        self.executed_stmt = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return None

    async def execute(self, stmt):
        self.executed_stmt = stmt
        return _FakeResult(self._rows)


def _fake_session_factory(rows: list[_FakeRow]):
    """模仿 ``AsyncSessionLocal`` 的工厂行为（每次调用返回一个 async 上下文管理器）。"""

    def _factory():
        return _FakeAsyncSession(rows)

    return _factory


class TestScheduledTasksSummary:
    """覆盖 ``_scheduled_tasks_summary`` 的归一化与告警阈值逻辑。

    重点防回归：SQLAlchemy 重复 ``func.coalesce(col, literal)`` 在 PG GROUP BY
    校验下抛 ``GroupingError``。修复后由 Python 端归一化 NULL → "none"。
    """

    @pytest.fixture
    def _ctx(self):
        return ContextPack(
            task_id="00000000-0000-0000-0000-000000000000",
            task_key="agent_inspection.scheduled_tasks_summary",
            handler_kind="agent_inspection",
            role="self_inspector",
            scenario="general",
        )

    @pytest.mark.asyncio
    async def test_all_ok_returns_ok_status(self, monkeypatch, _ctx):
        rows = [_FakeRow(status="ok", count=5)]
        monkeypatch.setattr(
            "negentropy.engine.schedulers.handlers.agent_inspection.AsyncSessionLocal",
            _fake_session_factory(rows),
        )
        result = await _scheduled_tasks_summary(_ctx)
        assert result.status == "ok"
        assert result.metrics["distribution"] == {"ok": 5}
        assert result.metrics["failed_ratio"] == 0.0

    @pytest.mark.asyncio
    async def test_null_status_normalized_to_none(self, monkeypatch, _ctx):
        """NULL 行应被归一化为键 ``"none"``（替代原 SQL 层 coalesce 行为）。"""
        rows = [_FakeRow(status="ok", count=2), _FakeRow(status=None, count=3)]
        monkeypatch.setattr(
            "negentropy.engine.schedulers.handlers.agent_inspection.AsyncSessionLocal",
            _fake_session_factory(rows),
        )
        result = await _scheduled_tasks_summary(_ctx)
        assert result.status == "ok"
        assert result.metrics["distribution"] == {"ok": 2, "none": 3}

    @pytest.mark.asyncio
    async def test_failed_majority_triggers_system_alert(self, monkeypatch, _ctx):
        """failed/total > 50% 且 total ≥ 2 → 返回 ``status='failed'`` 系统级告警。"""
        rows = [_FakeRow(status="failed", count=6), _FakeRow(status="ok", count=2)]
        monkeypatch.setattr(
            "negentropy.engine.schedulers.handlers.agent_inspection.AsyncSessionLocal",
            _fake_session_factory(rows),
        )
        result = await _scheduled_tasks_summary(_ctx)
        assert result.status == "failed"
        assert "system-level alert" in (result.error or "")
        assert result.metrics["failed_ratio"] == pytest.approx(6 / 8)

    @pytest.mark.asyncio
    async def test_empty_table_does_not_crash(self, monkeypatch, _ctx):
        """无 enabled 任务时不应崩溃，distribution 为空、status=ok。"""
        monkeypatch.setattr(
            "negentropy.engine.schedulers.handlers.agent_inspection.AsyncSessionLocal",
            _fake_session_factory([]),
        )
        result = await _scheduled_tasks_summary(_ctx)
        assert result.status == "ok"
        assert result.metrics["distribution"] == {}
        assert result.metrics["failed_ratio"] == 0.0

    @pytest.mark.asyncio
    async def test_single_failed_below_total_floor_stays_ok(self, monkeypatch, _ctx):
        """total < 2 时即便 failed 占比 100% 也不应触发系统级告警（防误报）。"""
        rows = [_FakeRow(status="failed", count=1)]
        monkeypatch.setattr(
            "negentropy.engine.schedulers.handlers.agent_inspection.AsyncSessionLocal",
            _fake_session_factory(rows),
        )
        result = await _scheduled_tasks_summary(_ctx)
        assert result.status == "ok"
        assert result.metrics["distribution"] == {"failed": 1}

    @pytest.mark.asyncio
    async def test_sql_does_not_reuse_coalesce_literal(self, monkeypatch, _ctx):
        """回归守门：SELECT/GROUP BY 不应同时出现 ``coalesce(...)`` —— 该模式在
        PG 下会因重复字面量 BindParameter 触发 GroupingError。"""
        captured: dict = {}

        class _SpySession(_FakeAsyncSession):
            async def execute(self, stmt):
                captured["sql"] = str(stmt.compile(compile_kwargs={"literal_binds": True})).lower()
                return _FakeResult([])

        def _factory():
            return _SpySession([])

        monkeypatch.setattr(
            "negentropy.engine.schedulers.handlers.agent_inspection.AsyncSessionLocal",
            _factory,
        )
        await _scheduled_tasks_summary(_ctx)
        # 同一查询里不应出现两处 coalesce —— 防止再次踩坑
        assert captured["sql"].count("coalesce") == 0


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


class TestParseInterval:
    def test_single_hour(self):
        assert _parse_interval("1 hour") == timedelta(hours=1)

    def test_plural_hours(self):
        assert _parse_interval("5 hours") == timedelta(hours=5)

    def test_minutes(self):
        assert _parse_interval("30 minutes") == timedelta(minutes=30)

    def test_seconds(self):
        assert _parse_interval("1 second") == timedelta(seconds=1)

    def test_days(self):
        assert _parse_interval("7 days") == timedelta(days=7)

    def test_whitespace_tolerant(self):
        assert _parse_interval("  2  hours  ") == timedelta(hours=2)

    def test_unsupported_format_raises(self):
        with pytest.raises(ValueError, match="Unsupported interval format"):
            _parse_interval("1hour")

    def test_unsupported_unit_raises(self):
        with pytest.raises(ValueError, match="Unsupported interval unit"):
            _parse_interval("1 week")

    def test_non_numeric_value_raises(self):
        with pytest.raises(ValueError):
            _parse_interval("abc hours")


class TestConsolidationHandler:
    """覆盖 _run_consolidation：验证 timedelta 被正确传递给 SQL 执行。"""

    @pytest.mark.asyncio
    async def test_consolidation_passes_timedelta(self, monkeypatch):
        """_run_consolidation 应将 payload 中的 interval 字符串转为 timedelta 后传给 SQL。"""
        from negentropy.engine.schedulers.handlers.memory_automation import _run_consolidation

        captured_params: dict = {}

        class _Row:
            def __getitem__(self, idx):
                return 0

        class _Result:
            def first(self):
                return _Row()

        class _SpySession:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                pass

            async def execute(self, stmt, params=None):
                captured_params.update(params or {})
                return _Result()

            async def commit(self):
                pass

        monkeypatch.setattr(
            "negentropy.engine.schedulers.handlers.memory_automation.AsyncSessionLocal",
            lambda: _SpySession(),
        )

        task = _make_task(
            "memory_automation", payload={"job_type": "trigger_consolidation", "lookback_interval": "1 hour"}
        )
        result = await _run_consolidation(task)

        assert result.status == "ok"
        assert isinstance(captured_params["lookback"], timedelta)
        assert captured_params["lookback"] == timedelta(hours=1)


class TestCleanupHandler:
    """覆盖 _run_cleanup：验证 decay_override 进 SQL、阈值/年龄透传、DELETE rowcount 返回。"""

    @pytest.mark.asyncio
    async def test_cleanup_honors_decay_override_and_returns_rowcount(self, monkeypatch):
        """_run_cleanup 应使用内联 SQL（含 COALESCE decay_override）并返回 DELETE rowcount。

        回归 SQL 存储函数原先平坦 λ=0.1 致 decay_override 沦为死配置的断点。
        """
        from negentropy.engine.schedulers.handlers.memory_automation import _run_cleanup

        captured: dict = {}

        class _Result:
            rowcount = 7

            def first(self):
                return None

        class _SpySession:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                pass

            async def execute(self, stmt, params=None):
                # 两次执行：UPDATE（含 decay_lambda）→ DELETE（含 threshold/min_age_days）
                captured.setdefault("calls", []).append((str(stmt), dict(params or {})))
                return _Result()

            async def commit(self):
                pass

        monkeypatch.setattr(
            "negentropy.engine.schedulers.handlers.memory_automation.AsyncSessionLocal",
            lambda: _SpySession(),
        )

        task = _make_task(
            "memory_automation",
            payload={"job_type": "cleanup_memories", "threshold": 0.1, "min_age_days": 7, "decay_lambda": 0.1},
        )
        result = await _run_cleanup(task)

        assert result.status == "ok"
        assert result.metrics["deleted"] == 7
        # UPDATE 语句含 COALESCE decay_override（修复核心）
        update_sql = captured["calls"][0][0]
        assert "decay_override" in update_sql
        assert captured["calls"][0][1]["decay_lambda"] == 0.1
        # DELETE 语句透传阈值/年龄
        delete_sql = captured["calls"][1][0]
        assert "retention_score" in delete_sql
        assert captured["calls"][1][1] == {"threshold": 0.1, "min_age_days": 7}
