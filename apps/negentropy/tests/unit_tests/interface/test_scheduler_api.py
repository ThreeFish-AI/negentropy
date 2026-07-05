"""/scheduler/* API 端点级单测

聚焦工具函数（_window_to_delta、_serialize_task、_validate_task_spec）
与路由 metadata、handler descriptor 序列化，
DB 相关分支留给 integration_tests 在真实 Postgres 上覆盖。
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest


def test_window_to_delta_known_values():
    from negentropy.interface.scheduler_api import _window_to_delta

    assert _window_to_delta("1h") == timedelta(hours=1)
    assert _window_to_delta("24h") == timedelta(hours=24)
    assert _window_to_delta("7d") == timedelta(days=7)


def test_window_to_delta_unknown_falls_back_to_24h():
    from negentropy.interface.scheduler_api import _window_to_delta

    assert _window_to_delta("xyz") == timedelta(hours=24)


def test_router_exposes_all_endpoints():
    from negentropy.interface.scheduler_api import router

    paths = {r.path for r in router.routes}
    expected = {
        "/scheduler/kpis",
        "/scheduler/tasks",
        "/scheduler/tasks/{task_id}",
        "/scheduler/executions",
        "/scheduler/stats",
        "/scheduler/tasks/{task_id}/run",
        "/scheduler/tasks/{task_id}/toggle",
        "/scheduler/stream",
        "/scheduler/handlers",
        "/scheduler/handlers/{handler_kind}/source",
    }
    assert expected <= paths


def test_serialize_task_includes_is_system():
    from negentropy.interface.scheduler_api import _serialize_task

    class _Fake:
        pass

    t = _Fake()
    now = datetime.now(UTC)
    t.id = uuid4()
    t.key = "demo"
    t.handler_kind = "agent_inspection"
    t.trigger_type = "interval"
    t.interval_seconds = 300.0
    t.cron_expr = None
    t.enabled = True
    t.owner_id = None
    t.participant_id = None
    t.agent_id = None
    t.role = "supervisor"
    t.scenario = "agent_health"
    t.category = "cognitive"
    t.display_name = "Demo Task"
    t.description = None
    t.last_fire_at = None
    t.next_fire_at = None
    t.last_status = None
    t.last_error = None
    t.consecutive_failures = 0
    t.total_runs = 0
    t.max_concurrency = 1
    t.token_budget = None
    t.backoff_until = None
    t.created_at = now
    t.updated_at = now
    t.payload = {"inspection_type": "self_check"}
    t.is_system = False

    data = _serialize_task(t, recent=["ok", "ok"])
    assert data["key"] == "demo"
    assert data["handler_kind"] == "agent_inspection"
    assert data["recent"] == ["ok", "ok"]
    assert data["payload"]["inspection_type"] == "self_check"
    assert data["is_system"] is False


def test_serialize_descriptor():
    from negentropy.engine.schedulers.handlers import (
        _bootstrap_default_handlers,
        get_descriptor,
    )
    from negentropy.interface.scheduler_api import _serialize_descriptor

    _bootstrap_default_handlers()
    desc = get_descriptor("memory_automation")
    assert desc is not None

    data = _serialize_descriptor(desc)
    assert data["handler_kind"] == "memory_automation"
    assert data["discriminator_field"] == "job_type"
    assert len(data["payload_fields"]) == 5
    # 验证 applies_when 正确序列化
    threshold_field = next(f for f in data["payload_fields"] if f["name"] == "threshold")
    assert threshold_field["applies_when"] == ["cleanup_memories"]


def test_build_handler_source_known_handler():
    """命中已注册 handler → 返回整模块源码 + docstring + descriptor 元数据。"""
    from negentropy.interface.scheduler_api import _build_handler_source

    data = _build_handler_source("pgvector_check")
    assert data is not None
    assert data["handler_kind"] == "pgvector_check"
    assert data["language"] == "python"
    # 整模块源码：应含注册装饰器本身（证明拿到的是模块而非裸函数）
    assert data["module_source"] and 'register_handler("pgvector_check")' in data["module_source"]
    # 入口函数源码 + 行号
    assert data["function_name"].endswith("handler")
    assert data["function_source"] and "def " in data["function_source"]
    assert isinstance(data["function_lineno"], int) and data["function_lineno"] > 0
    # 解释：descriptor 描述 + 至少一处 docstring 非空
    assert data["description"]
    assert data["function_docstring"] or data["module_docstring"]
    # file_path 已裁剪为 src/ 之后的仓库相对路径
    assert data["file_path"] and data["file_path"].startswith("negentropy/")
    assert "/src/" not in data["file_path"]


def test_build_handler_source_unknown_returns_none():
    """未注册 handler_kind → None（端点据此转 404）。"""
    from negentropy.interface.scheduler_api import _build_handler_source

    assert _build_handler_source("__definitely_not_a_handler__") is None


class TestValidateTaskSpec:
    """覆盖 _validate_task_spec 的各分支。"""

    def _validate(self, **overrides):
        from negentropy.interface.scheduler_api import _validate_task_spec

        spec = {
            "handler_kind": "pipeline_watchdog",
            "trigger_type": "interval",
            "interval_seconds": 60.0,
            "cron_expr": None,
            "payload": {},
        }
        spec.update(overrides)
        _validate_task_spec(
            spec["handler_kind"],
            spec["trigger_type"],
            spec["interval_seconds"],
            spec["cron_expr"],
            spec["payload"],
        )

    def test_valid_interval_task(self):
        self._validate()  # 不抛异常即通过

    def test_unknown_handler_rejected(self):
        with pytest.raises(Exception, match="unknown handler_kind"):
            self._validate(handler_kind="nonexistent_handler")

    def test_interval_without_seconds_rejected(self):
        with pytest.raises(Exception, match="interval_seconds > 0"):
            self._validate(interval_seconds=None)

    def test_interval_with_cron_rejected(self):
        with pytest.raises(Exception, match="must not have cron_expr"):
            self._validate(cron_expr="0 * * * *")

    def test_cron_without_expr_rejected(self):
        with pytest.raises(Exception, match="cron trigger requires cron_expr"):
            self._validate(trigger_type="cron", interval_seconds=None, cron_expr=None)

    def test_invalid_cron_rejected(self):
        with pytest.raises(Exception, match="invalid cron"):
            self._validate(trigger_type="cron", interval_seconds=None, cron_expr="not-valid-cron")

    def test_oneshot_with_interval_rejected(self):
        with pytest.raises(Exception, match="must not have interval_seconds"):
            self._validate(trigger_type="oneshot", interval_seconds=60.0, cron_expr=None)

    def test_unsupported_trigger_type_for_handler(self):
        with pytest.raises(Exception, match="does not support trigger_type"):
            self._validate(handler_kind="cache_warm", trigger_type="interval", interval_seconds=60.0)

    def test_valid_cron_task(self):
        self._validate(
            handler_kind="memory_automation",
            trigger_type="cron",
            interval_seconds=None,
            cron_expr="0 * * * *",
            payload={"job_type": "cleanup_memories"},
        )


@pytest.mark.asyncio
async def test_ttl_cache_returns_cached_within_ttl():
    from negentropy.interface.scheduler_api import _TTLCache

    cache = _TTLCache(ttl_seconds=10.0)
    calls = {"n": 0}

    async def _compute():
        calls["n"] += 1
        return {"value": calls["n"]}

    a = await cache.get_or_compute("k1", _compute)
    b = await cache.get_or_compute("k1", _compute)
    assert a == b
    assert calls["n"] == 1


@pytest.mark.asyncio
async def test_ttl_cache_invalidate_forces_recompute():
    from negentropy.interface.scheduler_api import _TTLCache

    cache = _TTLCache(ttl_seconds=10.0)
    calls = {"n": 0}

    async def _compute():
        calls["n"] += 1
        return {"value": calls["n"]}

    await cache.get_or_compute("k1", _compute)
    cache.invalidate()
    await cache.get_or_compute("k1", _compute)
    assert calls["n"] == 2
