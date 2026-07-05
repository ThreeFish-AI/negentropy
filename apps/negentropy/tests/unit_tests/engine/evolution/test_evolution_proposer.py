"""evolution proposer 单测 — monkeypatch litellm + resolve_model_config_async。"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from negentropy.engine.evolution import proposer as p


def _metrics(n: int = 100) -> dict:
    return {
        "sample_n": n,
        "zero_hit_rate": 0.42,
        "helpful_ratio": 0.55,
        "referenced_rate": 0.30,
    }


def _active() -> dict:
    return {"semantic_weight": 0.7, "keyword_weight": 0.3}


def _patch_model(monkeypatch):
    """桩 resolve_model_config_async 返回固定模型 + 空 kwargs。"""
    monkeypatch.setattr(
        "negentropy.engine.evolution.proposer.resolve_model_config_async",
        AsyncMock(return_value=("test-model", {})),
    )


def _litellm_resp(content: str):
    """构造一个最小 litellm 响应对象。"""
    msg = type("M", (), {"content": content})()
    choice = type("C", (), {"message": msg})()
    return type("R", (), {"choices": [choice]})()


@pytest.mark.asyncio
async def test_propose_normal_json_returns_draft(monkeypatch):
    _patch_model(monkeypatch)
    monkeypatch.setattr(
        p.litellm,
        "acompletion",
        AsyncMock(
            return_value=_litellm_resp('{"semantic_weight":0.6,"rationale":"降语义权重以减零命中","no_change":false}')
        ),
    )
    pro = p.RetrievalWeightProposer()
    draft = await pro.propose(active_snapshot=_active(), window_metrics=_metrics())
    assert draft is not None
    assert draft.semantic_weight == 0.6
    assert draft.keyword_weight == 0.4  # 强制归一
    assert "降语义权重" in draft.rationale


@pytest.mark.asyncio
async def test_propose_no_change_returns_none(monkeypatch):
    _patch_model(monkeypatch)
    monkeypatch.setattr(p.litellm, "acompletion", AsyncMock(return_value=_litellm_resp('{"no_change":true}')))
    pro = p.RetrievalWeightProposer()
    assert await pro.propose(active_snapshot=_active(), window_metrics=_metrics()) is None


@pytest.mark.asyncio
async def test_propose_out_of_bounds_too_far_drops(monkeypatch):
    """模型输出 wild 值（5.0），clamp 后偏差 > 2*MAX_STEP(=0.2) → 视失控丢弃。"""
    _patch_model(monkeypatch)
    monkeypatch.setattr(p.litellm, "acompletion", AsyncMock(return_value=_litellm_resp('{"semantic_weight":5.0}')))
    pro = p.RetrievalWeightProposer()
    assert await pro.propose(active_snapshot=_active(), window_metrics=_metrics()) is None


@pytest.mark.asyncio
async def test_propose_slightly_over_bound_is_clamped_not_dropped(monkeypatch):
    """模型输出 0.95（略超上界 0.9），clamp 距离 0.05 < 失控容差 0.2 → clamp 到 0.9 接受。"""
    _patch_model(monkeypatch)
    monkeypatch.setattr(
        p.litellm, "acompletion", AsyncMock(return_value=_litellm_resp('{"semantic_weight":0.95,"rationale":"r"}'))
    )
    pro = p.RetrievalWeightProposer()
    draft = await pro.propose(active_snapshot=_active(), window_metrics=_metrics())
    assert draft is not None and draft.semantic_weight == 0.9


@pytest.mark.asyncio
async def test_propose_within_bounds_high_value_accepted(monkeypatch):
    """0.88 在界内（≤0.9）→ 接受。"""
    _patch_model(monkeypatch)
    monkeypatch.setattr(
        p.litellm, "acompletion", AsyncMock(return_value=_litellm_resp('{"semantic_weight":0.88,"rationale":"r"}'))
    )
    pro = p.RetrievalWeightProposer()
    draft = await pro.propose(active_snapshot=_active(), window_metrics=_metrics())
    assert draft is not None and draft.semantic_weight == 0.88


@pytest.mark.asyncio
async def test_propose_invalid_json_returns_none(monkeypatch):
    _patch_model(monkeypatch)
    monkeypatch.setattr(p.litellm, "acompletion", AsyncMock(return_value=_litellm_resp("not json")))
    pro = p.RetrievalWeightProposer()
    assert await pro.propose(active_snapshot=_active(), window_metrics=_metrics()) is None


@pytest.mark.asyncio
async def test_propose_cold_start_low_samples_skips_llm(monkeypatch):
    """sample_n < MIN_SAMPLE_N → 不调 LLM 直接 None。"""
    _patch_model(monkeypatch)
    called = AsyncMock()
    monkeypatch.setattr(p.litellm, "acompletion", called)
    pro = p.RetrievalWeightProposer()
    assert await pro.propose(active_snapshot=_active(), window_metrics=_metrics(n=5)) is None
    called.assert_not_awaited()


@pytest.mark.asyncio
async def test_propose_llm_all_fail_returns_none_no_fallback(monkeypatch):
    """LLM 重试耗尽 → None（无 pattern fallback，对齐设计）。"""
    _patch_model(monkeypatch)
    monkeypatch.setattr(p.litellm, "acompletion", AsyncMock(side_effect=RuntimeError("boom")))
    pro = p.RetrievalWeightProposer(max_retries=2)
    # 加速重试退避（patch asyncio.sleep）
    with patch("negentropy.engine.evolution.proposer.asyncio.sleep", AsyncMock()):
        assert await pro.propose(active_snapshot=_active(), window_metrics=_metrics()) is None
