"""
Graph Strategy Pattern 单元测试

测试 EntityExtractor/RelationExtractor 策略接口及其实现。
"""

from __future__ import annotations

from typing import List
from uuid import UUID, uuid4

import pytest

from negentropy.knowledge.graph import (
    CooccurrenceRelationExtractor,
    EntityExtractor,
    GraphProcessor,
    RegexEntityExtractor,
    RelationExtractor,
)
from negentropy.knowledge.types import GraphEdge, GraphNode


_CORPUS_ID = UUID("00000000-0000-0000-0000-000000000001")


class TestRegexEntityExtractor:
    """RegexEntityExtractor 单元测试"""

    @pytest.fixture
    def extractor(self):
        return RegexEntityExtractor()

    @pytest.mark.asyncio
    async def test_extract_person_names(self, extractor):
        """应提取大写开头的人名"""
        text = "John Smith and Jane Doe attended the conference."
        entities = await extractor.extract(text, _CORPUS_ID)
        labels = [e.label for e in entities]
        assert "John Smith" in labels
        assert "Jane Doe" in labels

    @pytest.mark.asyncio
    async def test_extract_organization_names(self, extractor):
        """应提取含常见后缀的组织名"""
        text = "Acme Corp announced a merger with Beta Inc last week."
        entities = await extractor.extract(text, _CORPUS_ID)
        labels = [e.label for e in entities]
        assert any("Acme Corp" in label for label in labels)

    @pytest.mark.asyncio
    async def test_extract_urls(self, extractor):
        """应提取 URL"""
        text = "Visit https://example.com/docs for more information."
        entities = await extractor.extract(text, _CORPUS_ID)
        url_entities = [e for e in entities if e.node_type == "url"]
        assert len(url_entities) >= 1
        assert url_entities[0].metadata.get("url") == "https://example.com/docs"

    @pytest.mark.asyncio
    async def test_empty_text(self, extractor):
        """空文本应返回空列表"""
        entities = await extractor.extract("", _CORPUS_ID)
        assert entities == []

    @pytest.mark.asyncio
    async def test_no_duplicate_entities(self, extractor):
        """同一实体不应重复提取"""
        text = "John Smith met John Smith at the park."
        entities = await extractor.extract(text, _CORPUS_ID)
        labels = [e.label for e in entities]
        assert labels.count("John Smith") == 1


class TestCooccurrenceRelationExtractor:
    """CooccurrenceRelationExtractor 单元测试"""

    @pytest.fixture
    def extractor(self):
        return CooccurrenceRelationExtractor()

    @pytest.mark.asyncio
    async def test_cooccurrence_in_same_sentence(self, extractor):
        """同一句子中的实体应产生 co_occurs 关系"""
        entities = [
            GraphNode(id="e1", label="Alice", node_type="person"),
            GraphNode(id="e2", label="Bob", node_type="person"),
        ]
        text = "Alice and Bob worked together on the project."
        edges = await extractor.extract(entities, text)
        assert len(edges) >= 1
        assert edges[0].label == "co_occurs"
        assert edges[0].source == "e1"
        assert edges[0].target == "e2"

    @pytest.mark.asyncio
    async def test_no_relation_different_sentences(self, extractor):
        """不同句子中的实体不应产生关系"""
        entities = [
            GraphNode(id="e1", label="Alice", node_type="person"),
            GraphNode(id="e2", label="Charlie", node_type="person"),
        ]
        text = "Alice went home. Charlie went to the office."
        edges = await extractor.extract(entities, text)
        assert len(edges) == 0

    @pytest.mark.asyncio
    async def test_empty_entities(self, extractor):
        """空实体列表应返回空关系"""
        edges = await extractor.extract([], "Some text here.")
        assert edges == []


class TestGraphProcessor:
    """GraphProcessor 策略注入测试"""

    @pytest.mark.asyncio
    async def test_default_extractors(self):
        """默认应使用 Regex + Cooccurrence 策略"""
        processor = GraphProcessor()
        assert isinstance(processor._entity_extractor, RegexEntityExtractor)
        assert isinstance(processor._relation_extractor, CooccurrenceRelationExtractor)

    @pytest.mark.asyncio
    async def test_custom_entity_extractor(self):
        """应支持注入自定义 EntityExtractor"""

        class MockEntityExtractor(EntityExtractor):
            async def extract(self, text: str, corpus_id: UUID) -> List[GraphNode]:
                return [GraphNode(id="mock-1", label="MockEntity", node_type="mock")]

        processor = GraphProcessor(entity_extractor=MockEntityExtractor())
        entities = await processor.extract_entities("any text", _CORPUS_ID)
        assert len(entities) == 1
        assert entities[0].label == "MockEntity"

    @pytest.mark.asyncio
    async def test_custom_relation_extractor(self):
        """应支持注入自定义 RelationExtractor"""

        class MockRelationExtractor(RelationExtractor):
            async def extract(self, entities: List[GraphNode], text: str) -> List[GraphEdge]:
                return [GraphEdge(source="a", target="b", label="mock_rel")]

        processor = GraphProcessor(relation_extractor=MockRelationExtractor())
        edges = await processor.extract_relations([], "any text")
        assert len(edges) == 1
        assert edges[0].label == "mock_rel"
