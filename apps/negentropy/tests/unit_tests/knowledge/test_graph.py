"""
Graph Strategy Pattern 单元测试

测试 EntityExtractor/RelationExtractor 策略接口及其实现。
"""

from __future__ import annotations

from uuid import UUID

import pytest

from negentropy.knowledge.graph import (
    CooccurrenceRelationExtractor,
    EntityExtractor,
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
    async def test_urls_not_extracted(self, extractor):
        """URL 不应被提取为实体（URL 不在 KgEntityType 中）"""
        text = "Visit https://example.com/docs for more information."
        entities = await extractor.extract(text, _CORPUS_ID)
        url_entities = [e for e in entities if e.node_type == "url"]
        assert len(url_entities) == 0

    @pytest.mark.asyncio
    async def test_heading_stopwords_filtered(self, extractor):
        """section heading 碎片不应被提取为实体"""
        text = "Acknowledgements\n\nWritten by the team. Testing One two three."
        entities = await extractor.extract(text, _CORPUS_ID)
        labels = [e.label for e in entities]
        for label in labels:
            assert "Acknowledgements" not in label
            assert "Testing" not in label

    @pytest.mark.asyncio
    async def test_product_keyword_classification(self, extractor):
        """含产品关键词的名称应被分类为 product"""
        text = "Claude Code is a powerful coding assistant. GPT models are widely used."
        entities = await extractor.extract(text, _CORPUS_ID)
        product_entities = [e for e in entities if e.node_type == "product"]
        assert len(product_entities) >= 1

    @pytest.mark.asyncio
    async def test_concept_suffix_classification(self, extractor):
        """含概念后缀的名称应被分类为 concept"""
        text = "The Digital Audio Workstation supports Level Editor features."
        entities = await extractor.extract(text, _CORPUS_ID)
        concept_entities = [e for e in entities if e.node_type == "concept"]
        assert len(concept_entities) >= 1

    @pytest.mark.asyncio
    async def test_default_type_is_other(self, extractor):
        """无法判定的名称应分类为 other 而非 person"""
        text = "Some Random Name appeared in the document."
        entities = await extractor.extract(text, _CORPUS_ID)
        random_entities = [e for e in entities if e.label == "Some Random Name"]
        assert len(random_entities) == 1
        assert random_entities[0].node_type == "other"

    @pytest.mark.asyncio
    async def test_regex_extraction_confidence(self, extractor):
        """regex 提取的实体应有较低置信度"""
        text = "John Smith and Jane Doe attended the conference."
        entities = await extractor.extract(text, _CORPUS_ID)
        for entity in entities:
            assert entity.metadata.get("confidence", 1.0) <= 0.7

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


class TestStrategyAbstractContracts:
    """Strategy 抽象基类契约测试

    验证 EntityExtractor / RelationExtractor 抽象基类要求子类必须实现 extract。
    取代了已删除的 GraphProcessor 注入测试，聚焦真正存活的抽象契约。
    """

    @pytest.mark.asyncio
    async def test_custom_entity_extractor_subclass(self):
        """自定义 EntityExtractor 子类可被实例化并按契约工作"""

        class MockEntityExtractor(EntityExtractor):
            async def extract(self, text: str, corpus_id: UUID) -> list[GraphNode]:
                return [GraphNode(id="mock-1", label="MockEntity", node_type="mock")]

        extractor = MockEntityExtractor()
        entities = await extractor.extract("any text", _CORPUS_ID)
        assert len(entities) == 1
        assert entities[0].label == "MockEntity"

    @pytest.mark.asyncio
    async def test_custom_relation_extractor_subclass(self):
        """自定义 RelationExtractor 子类可被实例化并按契约工作"""

        class MockRelationExtractor(RelationExtractor):
            async def extract(self, entities: list[GraphNode], text: str) -> list[GraphEdge]:
                return [GraphEdge(source="a", target="b", label="mock_rel")]

        extractor = MockRelationExtractor()
        edges = await extractor.extract([], "any text")
        assert len(edges) == 1
        assert edges[0].label == "mock_rel"

    def test_entity_extractor_is_abstract(self):
        """EntityExtractor 不能直接实例化"""
        import pytest as _pt

        with _pt.raises(TypeError):
            EntityExtractor()  # type: ignore[abstract]

    def test_relation_extractor_is_abstract(self):
        """RelationExtractor 不能直接实例化"""
        import pytest as _pt

        with _pt.raises(TypeError):
            RelationExtractor()  # type: ignore[abstract]
