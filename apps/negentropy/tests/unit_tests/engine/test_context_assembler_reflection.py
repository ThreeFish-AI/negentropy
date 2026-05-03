"""Phase 5 F2 — ContextAssembler.assemble Few-Shot 反思注入测试。

只覆盖 ``_collect_reflections`` 的门控与拼接逻辑（不依赖真实数据库）。
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from negentropy.engine.adapters.postgres.context_assembler import ContextAssembler


def _patch_settings(
    *,
    enabled: bool,
    min_intent_confidence: float = 0.55,
    fewshot_k: int = 2,
    budget_ratio: float = 0.10,
):
    settings = MagicMock()
    settings.memory.reflection.enabled = enabled
    settings.memory.reflection.min_intent_confidence = min_intent_confidence
    settings.memory.reflection.fewshot_k = fewshot_k
    settings.memory.reflection.budget_ratio = budget_ratio
    return settings


class TestCollectReflections:
    @pytest.fixture(autouse=True)
    def _stub_fetch(self, monkeypatch):
        async def fake_fetch(self, *, user_id, app_name, query_embedding, limit):
            # 返回固定 2 条反思（足够 fewshot_k=2）
            return [
                {"content": "避免在『部署』中召回 init.d 旧步骤", "created_at": None, "distance": 0.05},
                {"content": "避免给出 docker-compose 已废弃版本", "created_at": None, "distance": 0.10},
            ]

        monkeypatch.setattr(
            ContextAssembler,
            "_fetch_reflection_rows",
            fake_fetch,
        )

    async def test_disabled_returns_empty(self):
        ca = ContextAssembler(max_tokens=4000)
        with patch.dict("sys.modules", {"negentropy.config": MagicMock(settings=_patch_settings(enabled=False))}):
            text, tokens, count = await ca._collect_reflections(
                user_id="u",
                app_name="a",
                query="how to deploy?",
                query_embedding=None,
                memory_tokens_total=1200,
            )
        assert text == ""
        assert tokens == 0
        assert count == 0

    async def test_intent_not_match_returns_empty(self):
        ca = ContextAssembler(max_tokens=4000)
        with patch.dict("sys.modules", {"negentropy.config": MagicMock(settings=_patch_settings(enabled=True))}):
            # semantic intent ('what is') 不命中 procedural/episodic
            text, tokens, count = await ca._collect_reflections(
                user_id="u",
                app_name="a",
                query="what is autosharding?",
                query_embedding=None,
                memory_tokens_total=1200,
            )
        assert text == ""
        assert count == 0

    async def test_intent_below_confidence_returns_empty(self):
        ca = ContextAssembler(max_tokens=4000)
        # 设非常高的门槛
        with patch.dict(
            "sys.modules",
            {"negentropy.config": MagicMock(settings=_patch_settings(enabled=True, min_intent_confidence=0.95))},
        ):
            text, _, _ = await ca._collect_reflections(
                user_id="u",
                app_name="a",
                query="how to deploy",
                query_embedding=None,
                memory_tokens_total=1200,
            )
        assert text == ""

    async def test_procedural_intent_injects_reflection(self):
        ca = ContextAssembler(max_tokens=4000)
        with patch.dict("sys.modules", {"negentropy.config": MagicMock(settings=_patch_settings(enabled=True))}):
            text, tokens, count = await ca._collect_reflections(
                user_id="u",
                app_name="a",
                query="how to deploy production",
                query_embedding=None,
                memory_tokens_total=1200,
            )
        assert text.startswith("[Reflection]")
        assert count >= 1
        assert tokens > 0
        # 含两条反思之一
        assert "init.d" in text or "docker-compose" in text

    async def test_episodic_intent_with_embedding_uses_vector_path(self):
        ca = ContextAssembler(max_tokens=4000)
        with patch.dict("sys.modules", {"negentropy.config": MagicMock(settings=_patch_settings(enabled=True))}):
            text, _, count = await ca._collect_reflections(
                user_id="u",
                app_name="a",
                query="昨天我们讨论的 sprint 目标",  # episodic
                query_embedding=[0.1] * 8,
                memory_tokens_total=1200,
            )
        assert count >= 1
        assert text.count("[Reflection]") == count

    async def test_zero_budget_returns_empty(self):
        ca = ContextAssembler(max_tokens=4000)
        with patch.dict(
            "sys.modules",
            {"negentropy.config": MagicMock(settings=_patch_settings(enabled=True, budget_ratio=0.0))},
        ):
            text, tokens, count = await ca._collect_reflections(
                user_id="u",
                app_name="a",
                query="how to deploy",
                query_embedding=None,
                memory_tokens_total=1200,
            )
        assert text == ""
        assert tokens == 0
        assert count == 0
