"""
Knowledge Graph 提取策略基类与正则/共现实现

使用 Strategy Pattern 分离实体/关系提取策略。
LLM 实现见 extractors.py（CompositeEntityExtractor / CompositeRelationExtractor）。

参考文献:
[1] E. Gamma et al., "Design Patterns: Elements of Reusable Object-Oriented Software," 1994.
"""

from __future__ import annotations

import re
from abc import ABC, abstractmethod
from uuid import UUID, uuid4

from negentropy.logging import get_logger

from ..types import GraphEdge, GraphNode

logger = get_logger("negentropy.knowledge.graph")


# ============================================================================
# Strategy 抽象基类
# ============================================================================


class EntityExtractor(ABC):
    """实体提取器抽象基类

    定义实体提取的通用接口，支持多种实现:
    - RegexEntityExtractor: 基于正则表达式（当前默认）
    - LLMEntityExtractor: 基于 LLM（预留接口）
    """

    @abstractmethod
    async def extract(
        self,
        text: str,
        corpus_id: UUID,
    ) -> list[GraphNode]:
        """从文本中提取实体节点

        Args:
            text: 输入文本
            corpus_id: 语料库 ID

        Returns:
            提取的实体节点列表
        """
        pass


class RelationExtractor(ABC):
    """关系提取器抽象基类

    定义关系提取的通用接口，支持多种实现:
    - CooccurrenceRelationExtractor: 基于共现（当前默认）
    - LLMRelationExtractor: 基于 LLM（预留接口）
    """

    @abstractmethod
    async def extract(
        self,
        entities: list[GraphNode],
        text: str,
    ) -> list[GraphEdge]:
        """从文本中提取实体间关系

        Args:
            entities: 实体节点列表
            text: 输入文本

        Returns:
            提取的关系边列表
        """
        pass


# ============================================================================
# Strategy 实现
# ============================================================================


class RegexEntityExtractor(EntityExtractor):
    """基于正则表达式的实体提取器

    使用规则和模式匹配提取常见实体类型:
    - 人名（大写开头的词组）
    - 组织名（Inc, Corp, LLC 后缀）

    局限性: 无法处理中文实体，对英文的准确率较低。
    建议在生产环境中替换为 LLMEntityExtractor。
    """

    # 常见 section heading / 功能性短语，不应被提取为实体
    _HEADING_STOPWORDS = frozenset(
        {
            "the",
            "and",
            "or",
            "for",
            "with",
            "from",
            "this",
            "that",
            "acknowledgements",
            "references",
            "abstract",
            "introduction",
            "conclusion",
            "appendix",
            "chapter",
            "section",
            "figure",
            "table",
            "contents",
            "overview",
            "summary",
            "testing",
            "one",
            "two",
            "three",
            "first",
            "second",
            "third",
            "published",
            "written",
            "special",
            "management",
        }
    )

    # 产品关键词（首字母大写）
    _PRODUCT_PATTERN = re.compile(
        r"\b(?:Claude|GPT|BERT|T5|LLaMA|Mistral|Gemini|Copilot|ChatGPT)\b",
    )
    # 概念/技术后缀
    _CONCEPT_PATTERN = re.compile(
        r"\b(?:Algorithm|Framework|Architecture|Model|Method|System|Engine|"
        r"Editor|Workstation|Protocol|Standard|Interface|Pattern|"
        r"Dashboard|Behavior|Completeness|Stories)\b",
    )

    def _classify_type(self, name: str) -> str:
        """启发式类型分类：正则无法精确区分人名/产品/概念，
        但可根据关键词做基本分流，减少系统性误分类。"""
        if self._PRODUCT_PATTERN.search(name):
            return "product"
        if self._CONCEPT_PATTERN.search(name):
            return "concept"
        return "other"

    def _is_valid_name(self, name: str) -> bool:
        """过滤 heading 碎片、跨行垃圾等无效匹配。"""
        words = name.split()
        if len(words) < 2:
            return False
        if any(w.lower() in self._HEADING_STOPWORDS for w in words):
            return False
        # 复用 LLM 提取器的统一噪声检测（停用词 / URL / 文件名 / 日期等）
        try:
            from .extractors import is_noise_entity

            if is_noise_entity(name):
                return False
        except Exception:
            pass
        return True

    async def extract(
        self,
        text: str,
        corpus_id: UUID,
    ) -> list[GraphNode]:
        logger.debug(
            "extract_entities_started",
            corpus_id=str(corpus_id),
            text_length=len(text),
            extractor="regex",
        )

        # 归一化空白：防止跨行碎片（如 "Testing\\n\\nOne"）被匹配
        text = re.sub(r"\s+", " ", text)

        entities: list[GraphNode] = []
        seen = set()

        # 提取人名模式（大写开头的连续词）
        name_pattern = r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b"
        for match in re.finditer(name_pattern, text):
            name = match.group()
            if name not in seen and self._is_valid_name(name):
                node_type = self._classify_type(name)
                entity = GraphNode(
                    id=f"entity:{uuid4()}",
                    label=name,
                    node_type=node_type,
                    metadata={
                        "source": "regex_extraction",
                        "corpus_id": str(corpus_id),
                        "confidence": 0.5,
                    },
                )
                entities.append(entity)
                seen.add(name)

        # 提取组织名模式
        org_pattern = r"\b[A-Z][a-zA-Z]+\s+(?:Inc|Corp|LLC|Ltd|Company|Organization)\b"
        for match in re.finditer(org_pattern, text):
            org = match.group()
            if org not in seen:
                entity = GraphNode(
                    id=f"entity:{uuid4()}",
                    label=org,
                    node_type="organization",
                    metadata={
                        "source": "regex_extraction",
                        "corpus_id": str(corpus_id),
                        "confidence": 0.6,
                    },
                )
                entities.append(entity)
                seen.add(org)

        logger.debug(
            "extract_entities_completed",
            corpus_id=str(corpus_id),
            entity_count=len(entities),
        )

        return entities


class CooccurrenceRelationExtractor(RelationExtractor):
    """基于共现的关系提取器

    如果两个实体在同一句话中出现，创建 "co_occurs" 关系。

    局限性: 无法提取精确的语义关系。
    建议在生产环境中替换为 LLMRelationExtractor。
    """

    async def extract(
        self,
        entities: list[GraphNode],
        text: str,
    ) -> list[GraphEdge]:
        logger.debug(
            "extract_relations_started",
            entity_count=len(entities),
            text_length=len(text),
            extractor="cooccurrence",
        )

        edges: list[GraphEdge] = []
        sentences = re.split(r"[.!?]+", text)

        for sentence in sentences:
            sentence_entities = []
            for entity in entities:
                if entity.label and entity.label in sentence:
                    sentence_entities.append(entity)

            for i, entity1 in enumerate(sentence_entities):
                for entity2 in sentence_entities[i + 1 :]:
                    edge = GraphEdge(
                        source=entity1.id,
                        target=entity2.id,
                        label="co_occurs",
                        edge_type="co_occurrence",
                        weight=1.0,
                        metadata={"sentence": sentence.strip()},
                    )
                    edges.append(edge)

        logger.debug(
            "extract_relations_completed",
            edge_count=len(edges),
        )

        return edges
