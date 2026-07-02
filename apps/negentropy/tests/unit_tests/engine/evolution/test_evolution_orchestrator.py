"""evolution orchestrator 单测 —— 纯辅助 + 禁用态 no-op。

DB 状态机推进（shadow→canary→promote 全闭环）由集成测试
``tests/integration_tests/engine/test_evolution_full_loop.py``（需 PG）覆盖；本文件覆盖
可纯单元化的部分：禁用态 no-op、版本号 bump、时间解析、_enter_canary 对 proposal 的副作用。
"""

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace

import pytest

from negentropy.engine.evolution import orchestrator as o

# ---------------------------------------------------------------------------
# 禁用态 no-op
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_inspect_once_noop_when_disabled(monkeypatch):
    # 构造在 patch 之前（__init__ 读 settings.evolution.proposer_model 等），仅 patch enabled 检查
    orch = o.EvolutionOrchestrator()
    monkeypatch.setattr(
        "negentropy.engine.evolution.orchestrator.settings",
        SimpleNamespace(evolution=SimpleNamespace(enabled=False)),
    )
    result = await orch.inspect_once()
    assert result == {"reaped": 0, "advanced": 0, "proposed": 0}


# ---------------------------------------------------------------------------
# _bump_patch（SemVer patch +1）
# ---------------------------------------------------------------------------


def test_bump_patch_increments():
    assert o._bump_patch("0.1.0") == "0.1.1"
    assert o._bump_patch("1.2.3") == "1.2.4"


def test_bump_patch_suffix():
    assert o._bump_patch("0.1.0", suffix="rollback") == "0.1.1-rollback"


def test_bump_patch_invalid_falls_back():
    out = o._bump_patch("not-a-version")
    assert out.startswith("0.1.")


# ---------------------------------------------------------------------------
# _parse_dt
# ---------------------------------------------------------------------------


def test_parse_dt_valid():
    assert o._parse_dt("2026-07-02T13:00:00+00:00") == datetime(2026, 7, 2, 13, 0, 0, tzinfo=UTC)


def test_parse_dt_none_and_invalid():
    assert o._parse_dt(None) is None
    assert o._parse_dt("") is None
    assert o._parse_dt("not-a-date") is None


# ---------------------------------------------------------------------------
# _enter_canary（proposal 副作用）
# ---------------------------------------------------------------------------


def test_enter_canary_sets_status_and_config(monkeypatch):
    monkeypatch.setattr(
        "negentropy.engine.evolution.orchestrator.settings",
        SimpleNamespace(
            evolution=SimpleNamespace(
                canary_bucket_ratio_pct=15.0,
                canary_window_seconds=3600,
                min_samples=40,
            )
        ),
    )
    proposal = SimpleNamespace(
        status="shadow_eval",
        canary_config=None,
        decided_at=None,
    )
    now = datetime(2026, 7, 2, 13, 0, 0, tzinfo=UTC)
    o._enter_canary(proposal, now)
    assert proposal.status == "canary"
    assert proposal.decided_at == now
    assert proposal.canary_config["bucket_ratio"] == 15.0
    assert proposal.canary_config["window_seconds"] == 3600
    assert proposal.canary_config["min_samples"] == 40
    assert proposal.canary_config["started_at"] == now.isoformat()


# ---------------------------------------------------------------------------
# P2-6：_emit_evolution_event（SSE 审计，复用 routine bus）
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_emit_evolution_event_publishes_to_bus():
    """promote/rollback/shadow→canary 翻转 → bus 收到 type=evolution_proposal 事件。"""
    from negentropy.engine.routine.bus import get_bus

    bus = get_bus()
    q = await bus.subscribe()
    try:
        proposal = SimpleNamespace(
            id="p1",
            target_kind="retrieval_config",
            target_ref="retrieval",
            proposed_version="0.1.1",
            base_version="0.1.0",
        )
        o._emit_evolution_event(proposal, action="promote", reason="promoted")
        evt = q.get_nowait()
        assert evt["type"] == "evolution_proposal"
        assert evt["action"] == "promote"
        assert evt["reason"] == "promoted"
        assert evt["proposal_id"] == "p1"
    finally:
        await bus.unsubscribe(q)


@pytest.mark.asyncio
async def test_emit_evolution_event_swallows_bus_error(monkeypatch):
    """bus.publish_nowait 抛异常 → 不影响主流程（吞异常）。"""

    class _BoomBus:
        def publish_nowait(self, event):
            raise RuntimeError("boom")

    monkeypatch.setattr(o, "_get_routine_bus", lambda: _BoomBus())
    proposal = SimpleNamespace(
        id="p2",
        target_kind="retrieval_config",
        target_ref="retrieval",
        proposed_version="0.1.1",
        base_version="0.1.0",
    )
    # 不抛即通过
    o._emit_evolution_event(proposal, action="rollback", reason="rolled_back")


def test_summarize_metrics_filters_keys():
    m = {"zero_hit_rate": 0.3, "helpful_ratio": 0.5, "noise": "x", "sample_n": 10}
    out = o._summarize_metrics(m)
    assert out == {"zero_hit_rate": 0.3, "helpful_ratio": 0.5, "sample_n": 10}
    assert o._summarize_metrics(None) is None
