"""
EntityResolver 单元测试

验证多策略实体消解管线的各阶段：
  - normalize_label: 规范化标签
  - blocking_key: Blocking key 生成
  - Exact: 精确匹配去重
  - ANN: 向量相似度去重
  - resolve: 端到端管线
"""

from __future__ import annotations

from uuid import uuid4

from negentropy.knowledge.graph.entity_resolver import (
    EntityResolver,
    blocking_key,
    normalize_label,
)
from negentropy.knowledge.types import GraphNode


def _make_entity(label: str, entity_type: str = "organization", confidence: float = 0.9) -> GraphNode:
    return GraphNode(
        id=f"entity:{uuid4().hex[:8]}",
        label=label,
        node_type=entity_type,
        metadata={"confidence": confidence},
    )


# ============================================================================
# normalize_label
# ============================================================================


class TestNormalizeLabel:
    def test_basic(self):
        assert normalize_label("OpenAI") == "openai"

    def test_unicode_nfc(self):
        assert normalize_label("café") == "café"

    def test_strip_legal_suffix_inc(self):
        assert normalize_label("OpenAI Inc.") == "openai"

    def test_strip_legal_suffix_llc(self):
        assert normalize_label("Acme LLC") == "acme"

    def test_strip_legal_suffix_ltd(self):
        assert normalize_label("Tencent Ltd.") == "tencent"

    def test_case_insensitive(self):
        assert normalize_label("OPENAI") == normalize_label("openai")

    def test_whitespace_normalization(self):
        assert normalize_label("  OpenAI  ") == "openai"

    def test_multi_space(self):
        assert normalize_label("Open  AI") == "open ai"

    def test_remove_punctuation(self):
        assert normalize_label("OpenAI, Inc.") == "openai"

    def test_chinese_unchanged(self):
        assert normalize_label("腾讯") == "腾讯"


# ============================================================================
# blocking_key
# ============================================================================


class TestBlockingKey:
    def test_basic(self):
        entity = _make_entity("OpenAI", "organization")
        key = blocking_key(entity)
        assert key == "ope|organization"

    def test_short_label(self):
        entity = _make_entity("AI", "concept")
        key = blocking_key(entity)
        assert key == "ai|concept"

    def test_different_types_different_blocks(self):
        e1 = _make_entity("Apple", "organization")
        e2 = _make_entity("Apple", "product")
        assert blocking_key(e1) != blocking_key(e2)

    def test_normalized_input(self):
        e1 = _make_entity("OpenAI Inc.", "organization")
        e2 = _make_entity("openai", "organization")
        assert blocking_key(e1) == blocking_key(e2)


# ============================================================================
# EntityResolver.resolve
# ============================================================================


class TestEntityResolverExactMatch:
    async def test_removes_exact_duplicates(self):
        resolver = EntityResolver()
        entities = [
            _make_entity("OpenAI", "organization"),
            _make_entity("openai", "organization"),  # 规范化后相同
        ]
        result = await resolver.resolve(entities, find_similar=None, corpus_id=None)
        assert len(result) == 1

    async def test_removes_suffix_duplicates(self):
        resolver = EntityResolver()
        entities = [
            _make_entity("OpenAI", "organization"),
            _make_entity("OpenAI Inc.", "organization"),  # 去后缀后相同
        ]
        result = await resolver.resolve(entities, find_similar=None, corpus_id=None)
        assert len(result) == 1

    async def test_keeps_different_entities(self):
        resolver = EntityResolver()
        entities = [
            _make_entity("OpenAI", "organization"),
            _make_entity("Google", "organization"),
        ]
        result = await resolver.resolve(entities, find_similar=None, corpus_id=None)
        assert len(result) == 2

    async def test_keeps_different_types(self):
        resolver = EntityResolver()
        entities = [
            _make_entity("Apple", "organization"),
            _make_entity("Apple", "product"),
        ]
        result = await resolver.resolve(entities, find_similar=None, corpus_id=None)
        assert len(result) == 2

    async def test_empty_input(self):
        resolver = EntityResolver()
        result = await resolver.resolve([], find_similar=None, corpus_id=None)
        assert result == []

    async def test_single_entity(self):
        resolver = EntityResolver()
        entities = [_make_entity("OpenAI", "organization")]
        result = await resolver.resolve(entities, find_similar=None, corpus_id=None)
        assert len(result) == 1

    async def test_keeps_higher_confidence(self):
        resolver = EntityResolver()
        entities = [
            _make_entity("OpenAI", "organization", confidence=0.7),
            _make_entity("OpenAI Inc.", "organization", confidence=0.95),
        ]
        result = await resolver.resolve(entities, find_similar=None, corpus_id=None)
        assert len(result) == 1
        assert result[0].metadata["confidence"] == 0.95

    async def test_keeps_higher_confidence_when_primary_idx_ge_1(self):
        # 回归：dedup 命中发生在 primary_idx >= 1 时，应保留高置信度实体
        # （前缀不同于第一项，使两个 OpenAI 落入与 Google 不同的 block）
        resolver = EntityResolver()
        entities = [
            _make_entity("Google", "organization", confidence=0.9),
            _make_entity("OpenAI", "organization", confidence=0.95),
            _make_entity("OpenAI Inc.", "organization", confidence=0.7),
        ]
        result = await resolver.resolve(entities, find_similar=None, corpus_id=None)
        assert len(result) == 2
        labels = {e.label: e.metadata["confidence"] for e in result}
        assert "Google" in labels
        # 关键断言：保留的是 0.95 的 OpenAI，而非 0.7 的 OpenAI Inc.
        assert "OpenAI" in labels
        assert labels["OpenAI"] == 0.95


class TestEntityResolverANN:
    async def test_ann_merges_similar(self):
        resolver = EntityResolver(ann_threshold=0.85)

        async def fake_find_similar(embedding, corpus_id, entity_type, threshold, limit):
            # 模拟找到一个相似实体
            return [("existing-id", "OpenAI Inc.", 0.91)]

        entities = [
            _make_entity("OpenAI", "organization"),
            _make_entity("Google", "organization"),
        ]
        # 给 OpenAI 添加 embedding
        entities[0] = GraphNode(
            id=entities[0].id,
            label="OpenAI",
            node_type="organization",
            metadata={"confidence": 0.9, "embedding": [0.1] * 10},
        )

        result = await resolver.resolve(entities, find_similar=fake_find_similar, corpus_id=uuid4())
        # OpenAI 应被 ANN 合并，Google 保留
        assert len(result) == 1
        assert result[0].label == "Google"

    async def test_ann_skips_same_name(self):
        resolver = EntityResolver(ann_threshold=0.85)

        async def fake_find_similar(embedding, corpus_id, entity_type, threshold, limit):
            return [("existing-id", "OpenAI", 0.99)]  # 同名应跳过

        entities = [
            _make_entity("OpenAI", "organization"),
        ]
        entities[0] = GraphNode(
            id=entities[0].id,
            label="OpenAI",
            node_type="organization",
            metadata={"confidence": 0.9, "embedding": [0.1] * 10},
        )

        result = await resolver.resolve(entities, find_similar=fake_find_similar, corpus_id=uuid4())
        # 同名不算合并
        assert len(result) == 1

    async def test_ann_error_does_not_crash(self):
        resolver = EntityResolver(ann_threshold=0.85)

        async def failing_find_similar(**kwargs):
            raise RuntimeError("DB connection lost")

        entities = [
            _make_entity("OpenAI", "organization"),
        ]
        entities[0] = GraphNode(
            id=entities[0].id,
            label="OpenAI",
            node_type="organization",
            metadata={"confidence": 0.9, "embedding": [0.1] * 10},
        )

        result = await resolver.resolve(entities, find_similar=failing_find_similar, corpus_id=uuid4())
        # ANN 失败不应丢失实体
        assert len(result) == 1
