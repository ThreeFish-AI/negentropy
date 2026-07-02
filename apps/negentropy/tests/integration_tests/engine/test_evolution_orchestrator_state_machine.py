"""EvolutionOrchestrator 状态机 golden 集成测试（真实 Postgres）—— PR2 TargetHandler 抽象的回归网。

当前 ``test_evolution_full_loop`` 直接调 ``decide_canary`` 验证 MemoryConfigVersion 翻转，但**不经过
``inspect_once``**。本文件首次覆盖 orchestrator 的 ADVANCE 路径（shadow→canary→promote/rollback），
作为 TargetHandler 重构的 byte-equivalence golden：重构前后须逐用例通过、可观测输出（status /
active version / canary_config / shadow_eval_result）不变。

monkeypatch ``eval_runner`` 窗口聚合 + ``weights_mod`` 配置解析，避免依赖真实检索流量；proposer 关闭
（ADVANCE 测试不触发 spawn）。LLM 不参与（decide_* 是纯函数）。
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy import delete, select

import negentropy.db.session as db_session
from negentropy.engine.evolution import eval_runner
from negentropy.engine.evolution import orchestrator as o
from negentropy.engine.evolution import weights as weights_mod
from negentropy.engine.evolution.eval_runner import WindowMetrics
from negentropy.models.evolution import CONFIG_SCOPE_RETRIEVAL, EvolutionProposal, MemoryConfigVersion

pytestmark = pytest.mark.asyncio


def _metrics(sample_n=100, zero_hit_rate=0.3, helpful_ratio=0.5, referenced_rate=0.6, diversity_ratio=0.8, version="x"):
    return WindowMetrics(
        config_version=version,
        sample_n=sample_n,
        zero_hit_rate=zero_hit_rate,
        helpful_ratio=helpful_ratio,
        referenced_rate=referenced_rate,
        diversity_ratio=diversity_ratio,
    )


# ---- async monkeypatch wrappers（orchestrator 会 await 这些函数） ----


def _async_run_shadow(value):
    async def _fn(**kw):
        return value

    return _fn


def _async_run_canary(baseline, candidate):
    async def _fn(**kw):
        return baseline, candidate

    return _fn


def _async_resolve(snapshot, version):
    async def _fn():
        return snapshot, version

    return _fn


@pytest.fixture
async def orch(monkeypatch):
    """开启 evolution + auto_mode，关 proposer（ADVANCE 测试不 spawn），缓存失效 no-op。

    handler 读各自模块的 ``settings`` 绑定（retrieval.py / _shared.py），非 orchestrator.settings，
    故三处 binding 须一并 patch 到同一 SimpleNamespace。
    """
    settings_ns = SimpleNamespace(
        app=SimpleNamespace(name="negentropy"),
        evolution=SimpleNamespace(
            enabled=True,
            auto_mode=True,
            proposer_enabled=False,
            min_samples=50,
            shadow_window_seconds=3600,
            canary_window_seconds=3600,
            max_canary_seconds=21600,
            canary_bucket_ratio_pct=10.0,
            zero_hit_regression_max=0.01,
            max_proposals_per_day=8,
            max_cost_usd_daily=None,
            proposer_model=None,
        ),
    )
    monkeypatch.setattr(o, "settings", settings_ns)
    monkeypatch.setattr("negentropy.engine.evolution.handlers.retrieval.settings", settings_ns)
    monkeypatch.setattr("negentropy.engine.evolution.handlers._shared.settings", settings_ns)
    monkeypatch.setattr(weights_mod, "invalidate", lambda *a, **k: None, raising=False)
    monkeypatch.setattr(o, "invalidate_canary_cache", lambda *a, **k: None, raising=False)
    yield o.EvolutionOrchestrator()


async def _reset_and_seed_active(version="0.1.0", snapshot=None) -> str:
    """清空 retrieval 配置表（含迁移 seed 与前次残留）→ 植入唯一 active 基线。返回 version。"""
    async with db_session.AsyncSessionLocal() as db:
        # setup 也清：前次失败 run 可能残留非终态 retrieval 提案（单在途唯一索引）
        await db.execute(delete(EvolutionProposal).where(EvolutionProposal.target_ref == CONFIG_SCOPE_RETRIEVAL))
        await db.execute(delete(MemoryConfigVersion).where(MemoryConfigVersion.config_scope == CONFIG_SCOPE_RETRIEVAL))
        db.add(
            MemoryConfigVersion(
                config_scope=CONFIG_SCOPE_RETRIEVAL,
                version=version,
                snapshot=snapshot or {"semantic_weight": 0.7, "keyword_weight": 0.3},
                origin="code_sync",
                is_active=True,
            )
        )
        await db.commit()
    return version


async def _wipe_retrieval_configs() -> None:
    """teardown：清掉本测试种的 retrieval 提案 + 配置行（单在途唯一索引要求 target_ref 无残留非终态）。"""
    async with db_session.AsyncSessionLocal() as db:
        await db.execute(delete(EvolutionProposal).where(EvolutionProposal.target_ref == CONFIG_SCOPE_RETRIEVAL))
        await db.execute(delete(MemoryConfigVersion).where(MemoryConfigVersion.config_scope == CONFIG_SCOPE_RETRIEVAL))
        await db.commit()


async def _insert_proposal(**overrides) -> uuid.UUID:
    pid = uuid.uuid4()
    defaults = dict(
        target_kind="retrieval_config",
        target_ref=CONFIG_SCOPE_RETRIEVAL,
        base_version="0.1.0",
        proposed_version="0.1.1",
        payload={"semantic_weight": 0.75, "keyword_weight": 0.25},
        origin="reflection",
        risk_level="low",
    )
    defaults.update(overrides)
    async with db_session.AsyncSessionLocal() as db:
        db.add(EvolutionProposal(id=pid, **defaults))
        await db.commit()
    return pid


async def _load_proposal(pid):
    async with db_session.AsyncSessionLocal() as db:
        return (await db.execute(select(EvolutionProposal).where(EvolutionProposal.id == pid))).scalar_one()


async def _active_version_row():
    async with db_session.AsyncSessionLocal() as db:
        return (
            await db.execute(
                select(MemoryConfigVersion).where(
                    MemoryConfigVersion.config_scope == CONFIG_SCOPE_RETRIEVAL,
                    MemoryConfigVersion.is_active.is_(True),
                )
            )
        ).scalar_one()


# ===========================================================================
# shadow_eval → canary（auto_mode + low risk）
# ===========================================================================


async def test_shadow_advances_to_canary_when_baseline_sufficient(orch, monkeypatch):
    base = await _reset_and_seed_active("0.1.0")
    pid = await _insert_proposal(status="shadow_eval", base_version=base)
    try:
        monkeypatch.setattr(
            weights_mod, "resolve_active_retrieval_config", _async_resolve({"semantic_weight": 0.7}, base)
        )
        monkeypatch.setattr(eval_runner, "run_shadow_eval", _async_run_shadow(_metrics(sample_n=100, version=base)))

        result = await orch.inspect_once()
        assert result["advanced"] >= 1

        p = await _load_proposal(pid)
        assert p.status == "canary"
        assert p.canary_config["bucket_ratio"] == 10.0
        assert "started_at" in p.canary_config
        assert p.shadow_eval_result["proposed_semantic_weight"] == 0.75
    finally:
        await _wipe_retrieval_configs()


# ===========================================================================
# canary → promote → MemoryConfigVersion active 翻转
# ===========================================================================


async def test_canary_promotes_and_flips_active_version(orch, monkeypatch):
    base = await _reset_and_seed_active("0.1.0")
    started = (datetime.now(UTC) - timedelta(seconds=7200)).isoformat()
    pid = await _insert_proposal(
        status="canary",
        base_version=base,
        canary_config={"bucket_ratio": 10.0, "window_seconds": 3600, "started_at": started, "min_samples": 50},
    )
    try:
        monkeypatch.setattr(
            weights_mod, "resolve_active_retrieval_config", _async_resolve({"semantic_weight": 0.7}, base)
        )
        monkeypatch.setattr(
            eval_runner,
            "run_canary_eval",
            _async_run_canary(
                _metrics(sample_n=100, zero_hit_rate=0.3, helpful_ratio=0.5, version=base),
                _metrics(sample_n=100, zero_hit_rate=0.2, helpful_ratio=0.6, version="0.1.1"),
            ),
        )

        await orch.inspect_once()

        p = await _load_proposal(pid)
        assert p.status == "promoted"
        active = await _active_version_row()
        assert active.version == "0.1.1"
        assert active.origin == "evolution"
        assert active.snapshot == {"semantic_weight": 0.75, "keyword_weight": 0.25}
    finally:
        await _wipe_retrieval_configs()


# ===========================================================================
# canary → rollback → active 回基线
# ===========================================================================


async def test_canary_rolls_back_on_regression(orch, monkeypatch):
    base = await _reset_and_seed_active("0.1.0")
    started = (datetime.now(UTC) - timedelta(seconds=7200)).isoformat()
    pid = await _insert_proposal(
        status="canary",
        base_version=base,
        canary_config={"bucket_ratio": 10.0, "window_seconds": 3600, "started_at": started, "min_samples": 50},
    )
    try:
        monkeypatch.setattr(
            weights_mod, "resolve_active_retrieval_config", _async_resolve({"semantic_weight": 0.7}, base)
        )
        monkeypatch.setattr(
            eval_runner,
            "run_canary_eval",
            _async_run_canary(
                _metrics(sample_n=100, zero_hit_rate=0.3, helpful_ratio=0.5, version=base),
                _metrics(sample_n=100, zero_hit_rate=0.5, helpful_ratio=0.3, version="0.1.1"),
            ),
        )

        await orch.inspect_once()

        p = await _load_proposal(pid)
        assert p.status == "rolled_back"
        active = await _active_version_row()
        assert active.origin == "manual"  # 回滚新写一行 origin=manual
        assert active.snapshot == {"semantic_weight": 0.7, "keyword_weight": 0.3}  # 回到基线快照
    finally:
        await _wipe_retrieval_configs()
