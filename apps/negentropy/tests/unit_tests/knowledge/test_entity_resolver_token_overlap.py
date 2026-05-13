"""
EntityResolver Token Overlap 检测测试

验证 Stage 1.5 token 重叠消解的正确性与边界：
  - 缩写 vs 全称合并 (GAN / Generative Adversarial Networks)
  - 子串包含合并 (RetroForge / RetroForge - 2D Retro Game Maker)
  - 部分名称合并 (Sonnet 4.5 / Claude Sonnet 4.5)
  - 误合并防护（不同实体不应合并）
  - Jaccard 阈值边界
"""

from __future__ import annotations

from uuid import uuid4

import pytest

from negentropy.knowledge.graph.entity_resolver import (
    EntityResolver,
    _extract_tokens,
    _should_merge_by_tokens,
    normalize_label,
)
from negentropy.knowledge.types import GraphNode


def _make_entity(label: str, entity_type: str = "concept", confidence: float = 0.9) -> GraphNode:
    return GraphNode(
        id=f"entity:{uuid4().hex[:8]}",
        label=label,
        node_type=entity_type,
        metadata={"confidence": confidence},
    )


# ============================================================================
# _extract_tokens
# ============================================================================


class TestExtractTokens:
    def test_basic(self):
        tokens = _extract_tokens("claude sonnet 4.5")
        assert "claude" in tokens
        assert "sonnet" in tokens
        assert "4.5" in tokens

    def test_extracts_parenthetical_tokens(self):
        tokens = _extract_tokens("generative adversarial networks (gans)")
        assert "gans" in tokens
        assert "generative" in tokens
        assert "adversarial" in tokens
        assert "networks" in tokens

    def test_filters_stopwords(self):
        tokens = _extract_tokens("the art of programming")
        assert "the" not in tokens
        assert "of" not in tokens
        assert "art" in tokens
        assert "programming" in tokens

    def test_filters_short_tokens(self):
        tokens = _extract_tokens("a i model")
        assert "a" not in tokens
        assert "i" not in tokens
        assert "model" in tokens

    def test_empty_string(self):
        tokens = _extract_tokens("")
        assert tokens == set()


# ============================================================================
# _should_merge_by_tokens
# ============================================================================


class TestShouldMergeByTokens:
    def test_substring_match(self):
        assert _should_merge_by_tokens(
            "retroforge",
            {"retroforge"},
            "retroforge 2d retro game maker",
            {"retroforge", "2d", "retro", "game", "maker"},
        )

    def test_high_jaccard(self):
        tokens_a = {"claude", "sonnet", "4.5"}
        tokens_b = {"sonnet", "4.5"}
        # Jaccard = |{sonnet, 4.5}| / |{claude, sonnet, 4.5}| = 2/3 ≈ 0.67 > 0.55
        assert _should_merge_by_tokens("claude sonnet 4.5", tokens_a, "sonnet 4.5", tokens_b)

    def test_low_jaccard_no_merge(self):
        tokens_a = {"react", "framework"}
        tokens_b = {"vue", "framework"}
        # Jaccard = |{framework}| / |{react, framework, vue}| = 1/3 ≈ 0.33 < 0.55
        assert not _should_merge_by_tokens("react framework", tokens_a, "vue framework", tokens_b)

    def test_short_substring_no_false_merge(self):
        """短于 4 字符的子串不应触发合并（避免 'ai' 匹配到所有含 'ai' 的字符串）"""
        assert not _should_merge_by_tokens(
            "ai",
            {"ai"},
            "paint application",
            {"paint", "application"},
        )

    def test_empty_tokens_no_merge(self):
        assert not _should_merge_by_tokens("", set(), "something", {"something"})

    def test_abbreviation_vs_full_form(self):
        """GAN vs Generative Adversarial Networks — 通过词干子集匹配（gan→gan 匹配 gans→gan）"""
        norm_short = normalize_label("GAN")
        norm_long = normalize_label("Generative Adversarial Networks (GANs)")
        tokens_short = _extract_tokens(norm_short)
        tokens_long = _extract_tokens(norm_long)
        # 词干匹配: "gan" 的 stem = "gan"，"gans" 的 stem = "gan" → 子集匹配
        assert _should_merge_by_tokens(norm_short, tokens_short, norm_long, tokens_long)


# ============================================================================
# EntityResolver._token_overlap_stage 集成测试
# ============================================================================


class TestTokenOverlapStage:
    def setup_method(self):
        self.resolver = EntityResolver(ann_threshold=0.85)

    def test_abbreviation_and_full_form_merged(self):
        """GAN vs Generative Adversarial Networks (GANs) 应合并"""
        entities = [
            _make_entity("GAN", "concept", confidence=0.8),
            _make_entity("Generative Adversarial Networks (GANs)", "concept", confidence=0.9),
        ]
        merged = self.resolver._token_overlap_stage(entities, set())
        # 低置信度的 GAN 应被合并
        assert len(merged) == 1
        assert entities[0].id in [entities[i].id for i in merged] or entities[1].id in [entities[i].id for i in merged]

    def test_substring_variant_merged(self):
        """RetroForge vs RetroForge - 2D Retro Game Maker 应合并"""
        entities = [
            _make_entity("RetroForge", "product", confidence=0.85),
            _make_entity("RetroForge - 2D Retro Game Maker", "product", confidence=0.9),
        ]
        merged = self.resolver._token_overlap_stage(entities, set())
        assert len(merged) == 1

    def test_partial_name_merged(self):
        """Sonnet 4.5 vs Claude Sonnet 4.5 应合并"""
        entities = [
            _make_entity("Sonnet 4.5", "product", confidence=0.8),
            _make_entity("Claude Sonnet 4.5", "product", confidence=0.9),
        ]
        merged = self.resolver._token_overlap_stage(entities, set())
        assert len(merged) == 1

    def test_different_entities_not_merged(self):
        """不相关的实体不应合并"""
        entities = [
            _make_entity("React", "product", confidence=0.9),
            _make_entity("Vue", "product", confidence=0.9),
            _make_entity("Angular", "product", confidence=0.9),
        ]
        merged = self.resolver._token_overlap_stage(entities, set())
        assert len(merged) == 0

    def test_different_types_not_merged(self):
        """不同 entity_type 的实体即使名称相似也不合并"""
        entities = [
            _make_entity("Claude", "product", confidence=0.9),
            _make_entity("Claude", "person", confidence=0.9),
        ]
        merged = self.resolver._token_overlap_stage(entities, set())
        assert len(merged) == 0

    def test_higher_confidence_preserved(self):
        """合并时保留置信度更高的实体"""
        entities = [
            _make_entity("Claude Code", "product", confidence=0.7),
            _make_entity("Claude Code CLI", "product", confidence=0.95),
        ]
        merged = self.resolver._token_overlap_stage(entities, set())
        assert len(merged) == 1
        # 低置信度的短名称应被合并（是 secondary）
        assert entities[0].id in [entities[i].id for i in merged]

    def test_misspelling_not_merged_by_tokens(self):
        """Prithvi Rajasekaran vs Prithvi Rajasakeran — token 重叠不足（Jaccard 0.33 < 0.55），
        拼写变体需由 ANN 向量相似度阶段捕获，token overlap 不应误合并"""
        entities = [
            _make_entity("Prithvi Rajasekaran", "person", confidence=0.8),
            _make_entity("Prithvi Rajasakeran", "person", confidence=0.9),
        ]
        merged = self.resolver._token_overlap_stage(entities, set())
        # token Jaccard 仅为 0.33，不应合并（留给 ANN 阶段处理）
        assert len(merged) == 0

    def test_already_merged_entities_excluded(self):
        """已在 Stage 1 被合并的实体不应参与 token overlap"""
        entities = [
            _make_entity("Entity A", "concept", confidence=0.9),
            _make_entity("Entity B", "concept", confidence=0.9),
        ]
        # 模拟 Entity A 已被 Stage 1 合并
        already_merged = {0}
        merged = self.resolver._token_overlap_stage(entities, already_merged)
        # 只有 Entity B 参与，没有配对对象
        assert len(merged) == 0


# ============================================================================
# EntityResolver.resolve 端到端（含 token overlap）
# ============================================================================


class TestResolveWithTokenOverlap:
    @pytest.mark.asyncio
    async def test_end_to_end_with_abbreviations(self):
        """端到端：GAN 和 Generative Adversarial Networks 应被合并"""
        resolver = EntityResolver(ann_threshold=0.85)
        entities = [
            _make_entity("GAN", "concept", confidence=0.8),
            _make_entity("Generative Adversarial Networks (GANs)", "concept", confidence=0.9),
            _make_entity("React", "product", confidence=0.9),
        ]
        result = await resolver.resolve(entities, find_similar=None, corpus_id=uuid4())
        labels = {e.label for e in result.entities}
        # GAN 和 GANs 应被合并为一个
        assert len(result.entities) == 2
        assert "React" in labels
        # 保留的应是高置信度的那个
        assert any("Generative" in lbl or "GAN" in lbl for lbl in labels)

    @pytest.mark.asyncio
    async def test_exact_match_before_token_overlap(self):
        """精确匹配应在 token overlap 之前执行"""
        resolver = EntityResolver()
        entities = [
            _make_entity("Claude", "product", confidence=0.8),
            _make_entity("Claude", "product", confidence=0.9),
        ]
        result = await resolver.resolve(entities, find_similar=None, corpus_id=uuid4())
        # 两个完全相同的实体应被精确匹配合并
        assert len(result.entities) == 1
