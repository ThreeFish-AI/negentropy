"""/scheduler/* API 端点级单测

聚焦工具函数（_window_to_delta、_serialize_task）与路由 metadata，
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


def test_router_exposes_eight_endpoints():
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
    }
    assert expected <= paths


def test_serialize_task_minimal():
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

    data = _serialize_task(t, recent=["ok", "ok"])
    assert data["key"] == "demo"
    assert data["handler_kind"] == "agent_inspection"
    assert data["recent"] == ["ok", "ok"]
    assert data["payload"]["inspection_type"] == "self_check"


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
