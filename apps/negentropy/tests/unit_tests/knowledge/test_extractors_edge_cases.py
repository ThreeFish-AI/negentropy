"""
Extractors 边界用例测试

验证 LLM extractor 对异常输入的处理：
  - _parse_entity_response: 畸形 JSON / 噪声实体 / 无效类型
  - _parse_relation_response: hash-like source / 空字段 / 无效 JSON
  - relation extraction 中 entity_map 查找失败的静默跳过
"""

from __future__ import annotations

import json
from uuid import uuid4

import pytest

from negentropy.knowledge.graph.extractors import (
    LLMEntityExtractor,
    LLMRelationExtractor,
)
from negentropy.knowledge.types import GraphNode


def _make_entity(label: str, entity_type: str = "product") -> GraphNode:
    return GraphNode(
        id=f"entity:{uuid4().hex[:8]}",
        label=label,
        node_type=entity_type,
        metadata={"confidence": 0.9},
    )


# ============================================================================
# LLMEntityExtractor._parse_entity_response
# ============================================================================


class TestParseEntityResponse:
    def setup_method(self):
        self.extractor = LLMEntityExtractor(model="test-model")

    def test_valid_json(self):
        content = json.dumps(
            {
                "entities": [
                    {"name": "Claude", "type": "product", "confidence": 0.9},
                    {"name": "Anthropic", "type": "organization", "confidence": 0.85},
                ]
            }
        )
        results = self.extractor._parse_entity_response(content)
        assert len(results) == 2
        assert results[0].name == "Claude"
        assert results[1].name == "Anthropic"

    def test_invalid_json(self):
        content = "not valid json {"
        results = self.extractor._parse_entity_response(content)
        assert results == []

    def test_empty_json(self):
        content = json.dumps({"entities": []})
        results = self.extractor._parse_entity_response(content)
        assert results == []

    def test_missing_entities_key(self):
        content = json.dumps({"stuff": []})
        results = self.extractor._parse_entity_response(content)
        assert results == []

    def test_entities_not_list(self):
        content = json.dumps({"entities": "not a list"})
        results = self.extractor._parse_entity_response(content)
        assert results == []

    def test_non_dict_items_skipped(self):
        content = json.dumps({"entities": ["string_item", 42, None]})
        results = self.extractor._parse_entity_response(content)
        assert results == []

    def test_empty_name_skipped(self):
        content = json.dumps({"entities": [{"name": "", "type": "product"}]})
        results = self.extractor._parse_entity_response(content)
        assert results == []

    def test_unknown_type_falls_back_to_other(self):
        content = json.dumps({"entities": [{"name": "TestEntity", "type": "unknown_type_xyz"}]})
        results = self.extractor._parse_entity_response(content)
        assert len(results) == 1
        assert results[0].entity_type == "other"

    def test_missing_type_defaults_to_other(self):
        content = json.dumps({"entities": [{"name": "TestEntity"}]})
        results = self.extractor._parse_entity_response(content)
        assert len(results) == 1
        assert results[0].entity_type == "other"

    def test_confidence_non_numeric_raises(self):
        """非数字 confidence 会导致 ValueError（extractor 不做容错转换）"""
        content = json.dumps({"entities": [{"name": "Test", "type": "product", "confidence": "high"}]})
        with pytest.raises(ValueError, match="could not convert"):
            self.extractor._parse_entity_response(content)

    def test_noise_entity_filtered(self):
        """URL、文件名等噪声实体应被过滤"""
        content = json.dumps(
            {
                "entities": [
                    {"name": "https://example.com", "type": "other"},
                    {"name": "main.py", "type": "other"},
                    {"name": "ValidEntity", "type": "product"},
                ]
            }
        )
        results = self.extractor._parse_entity_response(content)
        names = [r.name for r in results]
        assert "ValidEntity" in names
        assert "https://example.com" not in names
        assert "main.py" not in names


# ============================================================================
# LLMRelationExtractor._parse_relation_response
# ============================================================================


class TestParseRelationResponse:
    def setup_method(self):
        self.extractor = LLMRelationExtractor(model="test-model")

    def test_valid_json(self):
        content = json.dumps(
            {
                "relations": [
                    {"source": "Claude", "target": "Anthropic", "type": "PART_OF", "confidence": 0.9},
                ]
            }
        )
        results = self.extractor._parse_relation_response(content)
        assert len(results) == 1
        assert results[0].source_name == "Claude"
        assert results[0].target_name == "Anthropic"

    def test_invalid_json(self):
        results = self.extractor._parse_relation_response("broken json{")
        assert results == []

    def test_empty_source_skipped(self):
        content = json.dumps({"relations": [{"source": "", "target": "B", "type": "RELATED_TO"}]})
        results = self.extractor._parse_relation_response(content)
        assert results == []

    def test_empty_target_skipped(self):
        content = json.dumps({"relations": [{"source": "A", "target": "", "type": "RELATED_TO"}]})
        results = self.extractor._parse_relation_response(content)
        assert results == []

    def test_hash_like_source_accepted_as_name(self):
        """LLM 输出的 32 位十六进制哈希应被接受为 source_name（后续由 service.py 解析）"""
        hash_ref = "cf696f6dcaaea21728c622f01c168ebc"
        content = json.dumps(
            {
                "relations": [
                    {"source": hash_ref, "target": "RetroForge", "type": "PART_OF"},
                ]
            }
        )
        results = self.extractor._parse_relation_response(content)
        # extractor 层面不应过滤，让上层 service.py 处理
        assert len(results) == 1
        assert results[0].source_name == hash_ref

    def test_unknown_relation_type_becomes_custom(self):
        content = json.dumps(
            {
                "relations": [
                    {"source": "A", "target": "B", "type": "SOME_UNKNOWN_TYPE"},
                ]
            }
        )
        results = self.extractor._parse_relation_response(content)
        assert len(results) == 1
        assert results[0].relation_type == "CUSTOM"
        assert results[0].metadata.get("raw_relation_type") == "SOME_UNKNOWN_TYPE"

    def test_non_dict_items_skipped(self):
        content = json.dumps({"relations": ["string", 42, None]})
        results = self.extractor._parse_relation_response(content)
        assert results == []

    def test_multiple_relations(self):
        content = json.dumps(
            {
                "relations": [
                    {"source": "A", "target": "B", "type": "WORKS_FOR"},
                    {"source": "B", "target": "C", "type": "RELATED_TO"},
                    {"source": "C", "target": "D", "type": "PART_OF"},
                ]
            }
        )
        results = self.extractor._parse_relation_response(content)
        assert len(results) == 3


# ============================================================================
# LLMRelationExtractor.extract — entity_map 查找
# ============================================================================


class TestRelationEntityMapLookup:
    """验证 relation extractor 中 entity_map 查找逻辑"""

    @pytest.mark.asyncio
    async def test_unresolved_source_silently_skipped(self):
        """当 source 不在 entity_map 中时，关系应被静默跳过"""
        entities = [
            _make_entity("Claude", "product"),
            _make_entity("Anthropic", "organization"),
        ]
        # 构造 LLM extractor 并 mock _extract_with_llm 返回引用不存在实体的关系
        extractor = LLMRelationExtractor(model="test-model")

        from negentropy.knowledge.graph.extractors import RelationExtractionResult

        mock_result = RelationExtractionResult(
            source_name="NonExistentEntity",
            target_name="Claude",
            relation_type="RELATED_TO",
            confidence=0.8,
        )

        with pytest.MonkeyPatch.context() as mp:
            mp.setattr(extractor, "_extract_with_llm", lambda ents, text: [mock_result])
            edges = await extractor.extract(entities, "test text")

        # NonExistentEntity 不在 entity_map 中，关系应被跳过
        assert len(edges) == 0

    @pytest.mark.asyncio
    async def test_hash_source_silently_skipped(self):
        """MD5 哈希作为 source 时，关系应被静默跳过"""
        entities = [
            _make_entity("Claude", "product"),
            _make_entity("RetroForge", "product"),
        ]
        extractor = LLMRelationExtractor(model="test-model")

        from negentropy.knowledge.graph.extractors import RelationExtractionResult

        mock_result = RelationExtractionResult(
            source_name="cf696f6dcaaea21728c622f01c168ebc",
            target_name="RetroForge",
            relation_type="PART_OF",
            confidence=0.8,
        )

        with pytest.MonkeyPatch.context() as mp:
            mp.setattr(extractor, "_extract_with_llm", lambda ents, text: [mock_result])
            edges = await extractor.extract(entities, "test text")

        assert len(edges) == 0
