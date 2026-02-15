"""
LLM Extractors 单元测试

测试 LLMEntityExtractor 和 LLMRelationExtractor 的核心功能。
使用 mocked LLM 响应以避免实际 API 调用。
"""

from __future__ import annotations

import hashlib
import json
from typing import List
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from negentropy.knowledge.llm_extractors import (
    CompositeEntityExtractor,
    CompositeRelationExtractor,
    EntityExtractionResult,
    LLMEntityExtractor,
    LLMRelationExtractor,
    RelationExtractionResult,
)
from negentropy.knowledge.types import GraphEdge, GraphNode, KgEntityType, KgRelationType


_CORPUS_ID = UUID("00000000-0000-0000-0000-000000000001")


class TestEntityIDGeneration:
    """实体 ID 生成测试 - 验证确定性"""

    def test_entity_id_is_deterministic(self):
        """相同输入应产生相同 ID"""
        extractor = LLMEntityExtractor()
        id1 = extractor._generate_entity_id("OpenAI", _CORPUS_ID)
        id2 = extractor._generate_entity_id("OpenAI", _CORPUS_ID)
        assert id1 == id2

    def test_entity_id_different_for_different_names(self):
        """不同名称应产生不同 ID"""
        extractor = LLMEntityExtractor()
        id1 = extractor._generate_entity_id("OpenAI", _CORPUS_ID)
        id2 = extractor._generate_entity_id("Anthropic", _CORPUS_ID)
        assert id1 != id2

    def test_entity_id_different_for_different_corpus(self):
        """不同语料库的相同名称应产生不同 ID"""
        extractor = LLMEntityExtractor()
        corpus2 = UUID("00000000-0000-0000-0000-000000000002")
        id1 = extractor._generate_entity_id("OpenAI", _CORPUS_ID)
        id2 = extractor._generate_entity_id("OpenAI", corpus2)
        assert id1 != id2

    def test_entity_id_consistent_across_processes(self):
        """ID 应跨进程一致（使用 SHA256 而非 Python hash）"""
        # 验证使用 SHA256 的预期结果
        name = "TestEntity"
        corpus_id = _CORPUS_ID
        expected_hash = hashlib.sha256(f"{corpus_id}:{name}".encode()).hexdigest()
        expected_id = f"entity:{expected_hash[:32]}"

        extractor = LLMEntityExtractor()
        actual_id = extractor._generate_entity_id(name, corpus_id)
        assert actual_id == expected_id

    def test_entity_id_format(self):
        """ID 格式应为 entity:{32位hex}"""
        extractor = LLMEntityExtractor()
        entity_id = extractor._generate_entity_id("Test", _CORPUS_ID)
        assert entity_id.startswith("entity:")
        # "entity:" (7 chars) + 32 hex chars = 39 total
        assert len(entity_id) == 39


class TestLLMEntityExtractor:
    """LLMEntityExtractor 单元测试"""

    @pytest.fixture
    def extractor(self):
        return LLMEntityExtractor()

    @pytest.fixture
    def mock_llm_response(self):
        """Mock LLM 返回有效 JSON 响应"""
        return json.dumps({
            "entities": [
                {"name": "Sam Altman", "type": "person", "confidence": 0.95, "description": "CEO of OpenAI"},
                {"name": "OpenAI", "type": "organization", "confidence": 0.9},
                {"name": "San Francisco", "type": "location", "confidence": 0.85},
            ]
        })

    @pytest.mark.asyncio
    async def test_extract_returns_entities_from_llm(self, extractor, mock_llm_response):
        """应正确解析 LLM 响应并返回实体列表"""
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = mock_llm_response

        with patch("litellm.acompletion", new=AsyncMock(return_value=mock_response)):
            entities = await extractor.extract("Sam Altman is CEO of OpenAI in San Francisco", _CORPUS_ID)

            assert len(entities) == 3
            labels = [e.label for e in entities]
            assert "Sam Altman" in labels
            assert "OpenAI" in labels
            assert "San Francisco" in labels

    @pytest.mark.asyncio
    async def test_extract_entity_types_correctly_parsed(self, extractor, mock_llm_response):
        """应正确解析实体类型"""
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = mock_llm_response

        with patch("litellm.acompletion", new=AsyncMock(return_value=mock_response)):
            entities = await extractor.extract("test text", _CORPUS_ID)

            entity_types = {e.label: e.node_type for e in entities}
            assert entity_types.get("Sam Altman") == "person"
            assert entity_types.get("OpenAI") == "organization"
            assert entity_types.get("San Francisco") == "location"

    @pytest.mark.asyncio
    async def test_extract_unknown_type_falls_back_to_other(self, extractor):
        """未知实体类型应回退到 'other'"""
        response = json.dumps({
            "entities": [
                {"name": "Something", "type": "unknown_type", "confidence": 0.9},
            ]
        })
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = response

        with patch("litellm.acompletion", new=AsyncMock(return_value=mock_response)):
            entities = await extractor.extract("test text", _CORPUS_ID)

            assert len(entities) == 1
            assert entities[0].node_type == "other"

    @pytest.mark.asyncio
    async def test_extract_malformed_json_returns_empty(self, extractor):
        """无效 JSON 应返回空列表"""
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "not valid json"

        with patch("litellm.acompletion", new=AsyncMock(return_value=mock_response)):
            entities = await extractor.extract("test text", _CORPUS_ID)

            assert entities == []

    @pytest.mark.asyncio
    async def test_extract_empty_text_returns_empty(self, extractor):
        """空文本应返回空列表"""
        entities = await extractor.extract("", _CORPUS_ID)
        assert entities == []


class TestLLMRelationExtractor:
    """LLMRelationExtractor 单元测试"""

    @pytest.fixture
    def extractor(self):
        return LLMRelationExtractor()

    @pytest.fixture
    def mock_entities(self):
        return [
            GraphNode(id="e1", label="Sam Altman", node_type="person"),
            GraphNode(id="e2", label="OpenAI", node_type="organization"),
        ]

    @pytest.fixture
    def mock_llm_response(self):
        return json.dumps({
            "relations": [
                {"source": "Sam Altman", "target": "OpenAI", "type": "WORKS_FOR", "confidence": 0.9},
            ]
        })

    @pytest.mark.asyncio
    async def test_extract_returns_relations_from_llm(self, extractor, mock_entities, mock_llm_response):
        """应正确解析 LLM 响应并返回关系列表"""
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = mock_llm_response

        with patch("litellm.acompletion", new=AsyncMock(return_value=mock_response)):
            edges = await extractor.extract(mock_entities, "Sam Altman works at OpenAI")

            assert len(edges) == 1
            assert edges[0].source == "e1"
            assert edges[0].target == "e2"
            assert edges[0].edge_type == "WORKS_FOR"

    @pytest.mark.asyncio
    async def test_extract_unknown_relation_type_falls_back(self, extractor, mock_entities):
        """未知关系类型应回退到 RELATED_TO"""
        response = json.dumps({
            "relations": [
                {"source": "Sam Altman", "target": "OpenAI", "type": "UNKNOWN_TYPE"},
            ]
        })
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = response

        with patch("litellm.acompletion", new=AsyncMock(return_value=mock_response)):
            edges = await extractor.extract(mock_entities, "test text")

            assert len(edges) == 1
            assert edges[0].edge_type == "RELATED_TO"

    @pytest.mark.asyncio
    async def test_extract_insufficient_entities_returns_empty(self, extractor):
        """少于2个实体时应返回空列表"""
        single_entity = [GraphNode(id="e1", label="Only One", node_type="person")]
        edges = await extractor.extract(single_entity, "test text")
        assert edges == []


class TestCompositeExtractors:
    """Composite 提取器测试 - 验证回退逻辑"""

    @pytest.fixture
    def composite_extractor(self):
        return CompositeEntityExtractor(enable_llm=True)

    @pytest.mark.asyncio
    async def test_composite_uses_llm_when_enabled(self, composite_extractor):
        """启用 LLM 时应使用 LLM 提取"""
        with patch.object(composite_extractor._llm_extractor, 'extract') as mock_extract:
            mock_extract.return_value = [GraphNode(id="e1", label="Test", node_type="person")]

            await composite_extractor.extract("test text", _CORPUS_ID)

            mock_extract.assert_called_once()

    @pytest.mark.asyncio
    async def test_composite_uses_regex_when_llm_disabled(self):
        """禁用 LLM 时应使用正则提取"""
        extractor = CompositeEntityExtractor(enable_llm=False)

        # 正则提取器能识别 "John Smith"
        entities = await extractor.extract("John Smith is here.", _CORPUS_ID)

        labels = [e.label for e in entities]
        assert "John Smith" in labels

    @pytest.mark.asyncio
    async def test_composite_propagates_llm_error(self, composite_extractor):
        """LLM 失败时应传播异常（不自动回退）"""
        with patch.object(composite_extractor._llm_extractor, 'extract') as mock_extract:
            mock_extract.side_effect = Exception("LLM error")

            # 当前实现不自动回退，异常会被传播
            with pytest.raises(Exception, match="LLM error"):
                await composite_extractor.extract("John Smith is here.", _CORPUS_ID)


class TestKgEntityTypeEnum:
    """KgEntityType 枚举测试"""

    def test_all_values_returns_list(self):
        """all_values() 应返回所有值的列表"""
        values = KgEntityType.all_values()
        assert isinstance(values, list)
        assert "person" in values
        assert "organization" in values
        assert "location" in values

    def test_enum_values_match_expected(self):
        """枚举值应符合预期"""
        assert KgEntityType.PERSON.value == "person"
        assert KgEntityType.ORGANIZATION.value == "organization"
        assert KgEntityType.OTHER.value == "other"


class TestKgRelationTypeEnum:
    """KgRelationType 枚举测试"""

    def test_all_values_returns_list(self):
        """all_values() 应返回所有值的列表"""
        values = KgRelationType.all_values()
        assert isinstance(values, list)
        assert "WORKS_FOR" in values
        assert "RELATED_TO" in values

    def test_enum_values_match_expected(self):
        """枚举值应符合预期"""
        assert KgRelationType.WORKS_FOR.value == "WORKS_FOR"
        assert KgRelationType.RELATED_TO.value == "RELATED_TO"
        assert KgRelationType.CO_OCCURS.value == "CO_OCCURS"
