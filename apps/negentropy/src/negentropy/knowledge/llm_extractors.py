"""
LLM 增强的知识图谱提取器

基于大语言模型的实体和关系提取器，支持中英文多语言。

相比正则/共现提取器的优势：
1. 支持多语言（中英文）
2. 语义理解，准确率更高
3. 可提取抽象概念和事件
4. 提供置信度分数

参考文献:
[1] J. Wei et al., "Chain-of-thought prompting elicits reasoning in large language models,"
    NeurIPS'22.
[2] Z. Wei et al., "A simple framework for relation extraction," EMNLP'19.
"""

from __future__ import annotations

import asyncio
import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Dict, List, Optional
from uuid import UUID

from negentropy.config import settings
from negentropy.logging import get_logger

if TYPE_CHECKING:
    from .graph import EntityExtractor, RelationExtractor

from .types import GraphEdge, GraphNode

logger = get_logger("negentropy.knowledge.llm_extractors")


# ============================================================================
# Entity and Relation Types
# ============================================================================


class EntityType:
    """知识图谱实体类型

    定义支持的实体类型，用于分类和筛选。
    """

    PERSON = "person"  # 人物
    ORGANIZATION = "organization"  # 组织/公司
    LOCATION = "location"  # 地点
    EVENT = "event"  # 事件
    CONCEPT = "concept"  # 概念/术语
    PRODUCT = "product"  # 产品
    DOCUMENT = "document"  # 文档
    OTHER = "other"  # 其他

    ALL = [PERSON, ORGANIZATION, LOCATION, EVENT, CONCEPT, PRODUCT, DOCUMENT, OTHER]


class RelationType:
    """知识图谱关系类型

    定义支持的实体间关系类型。
    """

    # 组织关系
    WORKS_FOR = "WORKS_FOR"  # 就职于
    PART_OF = "PART_OF"  # 隶属于
    LOCATED_IN = "LOCATED_IN"  # 位于

    # 语义关系
    RELATED_TO = "RELATED_TO"  # 相关
    SIMILAR_TO = "SIMILAR_TO"  # 相似
    DERIVED_FROM = "DERIVED_FROM"  # 衍生自

    # 因果关系
    CAUSES = "CAUSES"  # 导致
    PRECEDES = "PRECEDES"  # 先于
    FOLLOWS = "FOLLOWS"  # 后于

    # 引用关系
    MENTIONS = "MENTIONS"  # 提及
    CREATED_BY = "CREATED_BY"  # 创建者

    # 共现关系（回退）
    CO_OCCURS = "CO_OCCURS"  # 共现

    ALL = [
        WORKS_FOR,
        PART_OF,
        LOCATED_IN,
        RELATED_TO,
        SIMILAR_TO,
        DERIVED_FROM,
        CAUSES,
        PRECEDES,
        FOLLOWS,
        MENTIONS,
        CREATED_BY,
        CO_OCCURS,
    ]


# ============================================================================
# Extraction Result Types
# ============================================================================


@dataclass(frozen=True)
class EntityExtractionResult:
    """实体提取结果

    LLM 提取的实体信息，包含置信度和来源。
    """

    name: str
    entity_type: str
    description: Optional[str] = None
    confidence: float = 1.0
    source_text: Optional[str] = None  # 来源文本片段
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class RelationExtractionResult:
    """关系提取结果

    LLM 提取的关系信息，包含证据和置信度。
    """

    source_name: str
    target_name: str
    relation_type: str
    description: Optional[str] = None
    confidence: float = 1.0
    evidence: Optional[str] = None  # 支撑文本
    metadata: Dict[str, Any] = field(default_factory=dict)


# ============================================================================
# LLM Entity Extractor
# ============================================================================


class LLMEntityExtractor:
    """基于 LLM 的实体提取器

    使用 LLM 结构化输出提取命名实体，支持中英文。

    特性:
    - 支持多语言（中英文）
    - 语义理解，准确率高
    - 可提取抽象概念和事件
    - 提供置信度分数
    - 支持回退到正则提取器

    使用示例:
    ```python
    extractor = LLMEntityExtractor(model="gpt-4o-mini")
    entities = await extractor.extract(text, corpus_id)
    ```
    """

    # 实体提取 Prompt 模板
    EXTRACTION_PROMPT = """Extract named entities from the following text.

Text:
{text}

Instructions:
1. Identify all named entities (people, organizations, locations, events, concepts, products)
2. For each entity, provide:
   - name: The entity name (preserve original language)
   - type: One of [person, organization, location, event, concept, product, other]
   - description: Brief description in 1-2 sentences (optional)
   - confidence: Extraction confidence between 0 and 1

Important:
- Extract entities in their original language (Chinese, English, etc.)
- Only include entities explicitly mentioned in the text
- Assign confidence based on how clearly the entity is identified

Output as JSON with the following structure:
{{"entities": [{{"name": "...", "type": "...", "description": "...", "confidence": 0.9}}]}}"""

    def __init__(
        self,
        model: Optional[str] = None,
        temperature: float = 0.0,
        max_retries: int = 3,
        fallback_to_regex: bool = True,
    ) -> None:
        """初始化 LLM 实体提取器

        Args:
            model: LLM 模型名称（默认使用配置中的 chat_model）
            temperature: 生成温度（0.0 确保一致性）
            max_retries: 最大重试次数
            fallback_to_regex: 失败时是否回退到正则提取器
        """
        self._model = model or self._get_default_model()
        self._temperature = temperature
        self._max_retries = max_retries
        self._fallback_to_regex = fallback_to_regex

    def _get_default_model(self) -> str:
        """获取默认 LLM 模型"""
        # 尝试从 settings 获取，否则使用默认值
        try:
            return getattr(settings.llm, "chat_model", "gpt-4o-mini")
        except AttributeError:
            return "gpt-4o-mini"

    async def extract(
        self,
        text: str,
        corpus_id: UUID,
    ) -> List[GraphNode]:
        """从文本中提取实体节点

        使用 LLM 结构化输出提取实体。

        Args:
            text: 输入文本
            corpus_id: 语料库 ID

        Returns:
            提取的实体节点列表
        """
        logger.debug(
            "llm_extract_entities_started",
            corpus_id=str(corpus_id),
            text_length=len(text),
            model=self._model,
        )

        try:
            results = await self._extract_with_llm(text)

            entities = []
            seen = set()

            for result in results:
                name = result.name.strip()
                if not name or name in seen:
                    continue

                # 生成稳定的实体 ID（基于名称哈希）
                entity_id = self._generate_entity_id(name, corpus_id)

                entity = GraphNode(
                    id=entity_id,
                    label=name,
                    node_type=result.entity_type,
                    metadata={
                        "description": result.description,
                        "confidence": result.confidence,
                        "source": "llm_extraction",
                        "source_text": result.source_text,
                        "corpus_id": str(corpus_id),
                        "model": self._model,
                    },
                )
                entities.append(entity)
                seen.add(name)

            logger.debug(
                "llm_extract_entities_completed",
                corpus_id=str(corpus_id),
                entity_count=len(entities),
                model=self._model,
            )

            return entities

        except Exception as exc:
            logger.error(
                "llm_extract_entities_failed",
                corpus_id=str(corpus_id),
                error=str(exc),
            )

            if self._fallback_to_regex:
                logger.info("falling_back_to_regex_extractor", corpus_id=str(corpus_id))
                return await self._fallback_extract(text, corpus_id)

            raise

    async def _extract_with_llm(self, text: str) -> List[EntityExtractionResult]:
        """使用 LLM 提取实体

        Args:
            text: 输入文本

        Returns:
            实体提取结果列表
        """
        import litellm

        # 截断文本以避免 token 限制
        truncated_text = text[:4000] if len(text) > 4000 else text

        prompt = self.EXTRACTION_PROMPT.format(text=truncated_text)

        # 重试逻辑
        last_error = None
        for attempt in range(self._max_retries):
            try:
                response = await litellm.acompletion(
                    model=self._model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=self._temperature,
                    response_format={"type": "json_object"},
                )

                content = response.choices[0].message.content
                return self._parse_entity_response(content)

            except Exception as exc:
                last_error = exc
                logger.warning(
                    "llm_extraction_retry",
                    attempt=attempt + 1,
                    error=str(exc),
                )
                await asyncio.sleep(2**attempt)  # 指数退避

        raise RuntimeError(f"LLM entity extraction failed after {self._max_retries} retries: {last_error}")

    def _parse_entity_response(self, content: str) -> List[EntityExtractionResult]:
        """解析 LLM 响应为实体列表

        Args:
            content: LLM 返回的 JSON 字符串

        Returns:
            实体提取结果列表
        """
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            logger.warning("llm_response_not_json", content_preview=content[:200])
            return []

        entities = data.get("entities", [])
        if not isinstance(entities, list):
            return []

        results = []
        for entity_data in entities:
            if not isinstance(entity_data, dict):
                continue

            name = entity_data.get("name", "").strip()
            if not name:
                continue

            entity_type = entity_data.get("type", EntityType.OTHER)
            if entity_type not in EntityType.ALL:
                entity_type = EntityType.OTHER

            result = EntityExtractionResult(
                name=name,
                entity_type=entity_type,
                description=entity_data.get("description"),
                confidence=float(entity_data.get("confidence", 1.0)),
                source_text=entity_data.get("source_text"),
            )
            results.append(result)

        return results

    def _generate_entity_id(self, name: str, corpus_id: UUID) -> str:
        """生成稳定的实体 ID

        基于名称和语料库 ID 生成确定性 ID，确保同一实体在同一语料库中 ID 一致。

        Args:
            name: 实体名称
            corpus_id: 语料库 ID

        Returns:
            实体 ID 字符串
        """
        # 使用哈希生成确定性 ID
        hash_input = f"{corpus_id}:{name}"
        hash_value = abs(hash(hash_input))
        return f"entity:{hash_value:032x}"

    async def _fallback_extract(
        self,
        text: str,
        corpus_id: UUID,
    ) -> List[GraphNode]:
        """回退到正则提取器

        当 LLM 提取失败时，使用正则提取作为回退。

        Args:
            text: 输入文本
            corpus_id: 语料库 ID

        Returns:
            提取的实体节点列表
        """
        from .graph import RegexEntityExtractor

        fallback = RegexEntityExtractor()
        return await fallback.extract(text, corpus_id)


# ============================================================================
# LLM Relation Extractor
# ============================================================================


class LLMRelationExtractor:
    """基于 LLM 的关系提取器

    使用 LLM 结构化输出提取实体间关系。

    特性:
    - 提取精确的语义关系类型
    - 提供证据文本
    - 置信度评估
    - 支持回退到共现提取器

    使用示例:
    ```python
    extractor = LLMRelationExtractor(model="gpt-4o-mini")
    relations = await extractor.extract(entities, text)
    ```
    """

    # 关系提取 Prompt 模板
    EXTRACTION_PROMPT = """Extract relationships between the following entities found in the text.

Entities:
{entity_names}

Text:
{text}

Instructions:
1. Identify relationships between the entities listed above
2. For each relationship, provide:
   - source: Source entity name (must be from the entity list)
   - target: Target entity name (must be from the entity list)
   - type: Relationship type (one of: {relation_types})
   - description: Brief description of the relationship
   - evidence: Exact text from the source that indicates this relationship
   - confidence: Extraction confidence between 0 and 1

Important:
- Only create relationships between entities from the provided list
- Use the most specific relationship type available
- Include the exact text evidence when possible

Output as JSON with the following structure:
{{"relations": [{{"source": "...", "target": "...", "type": "...", "description": "...", "evidence": "...", "confidence": 0.9}}]}}"""

    def __init__(
        self,
        model: Optional[str] = None,
        temperature: float = 0.0,
        max_retries: int = 3,
        fallback_to_cooccurrence: bool = True,
    ) -> None:
        """初始化 LLM 关系提取器

        Args:
            model: LLM 模型名称
            temperature: 生成温度
            max_retries: 最大重试次数
            fallback_to_cooccurrence: 失败时是否回退到共现提取器
        """
        self._model = model or self._get_default_model()
        self._temperature = temperature
        self._max_retries = max_retries
        self._fallback_to_cooccurrence = fallback_to_cooccurrence

    def _get_default_model(self) -> str:
        """获取默认 LLM 模型"""
        try:
            return getattr(settings.llm, "chat_model", "gpt-4o-mini")
        except AttributeError:
            return "gpt-4o-mini"

    async def extract(
        self,
        entities: List[GraphNode],
        text: str,
    ) -> List[GraphEdge]:
        """从文本中提取实体间关系

        Args:
            entities: 实体节点列表
            text: 输入文本

        Returns:
            提取的关系边列表
        """
        logger.debug(
            "llm_extract_relations_started",
            entity_count=len(entities),
            text_length=len(text),
            model=self._model,
        )

        # 实体数量检查
        if len(entities) < 2:
            logger.debug("insufficient_entities_for_relations", count=len(entities))
            return []

        try:
            results = await self._extract_with_llm(entities, text)

            # 创建实体名称到 ID 的映射
            entity_map = {e.label: e.id for e in entities if e.label}

            edges = []
            seen = set()

            for result in results:
                source_id = entity_map.get(result.source_name)
                target_id = entity_map.get(result.target_name)

                if not source_id or not target_id:
                    continue

                # 去重键
                key = (source_id, target_id, result.relation_type)
                if key in seen:
                    continue

                edge = GraphEdge(
                    source=source_id,
                    target=target_id,
                    label=result.description or result.relation_type,
                    edge_type=result.relation_type,
                    weight=result.confidence,
                    metadata={
                        "evidence": result.evidence,
                        "confidence": result.confidence,
                        "source": "llm_extraction",
                        "model": self._model,
                    },
                )
                edges.append(edge)
                seen.add(key)

            logger.debug(
                "llm_extract_relations_completed",
                entity_count=len(entities),
                edge_count=len(edges),
                model=self._model,
            )

            return edges

        except Exception as exc:
            logger.error(
                "llm_extract_relations_failed",
                error=str(exc),
            )

            if self._fallback_to_cooccurrence:
                logger.info("falling_back_to_cooccurrence_extractor")
                return await self._fallback_extract(entities, text)

            raise

    async def _extract_with_llm(
        self,
        entities: List[GraphNode],
        text: str,
    ) -> List[RelationExtractionResult]:
        """使用 LLM 提取关系

        Args:
            entities: 实体节点列表
            text: 输入文本

        Returns:
            关系提取结果列表
        """
        import litellm

        # 提取实体名称
        entity_names = [e.label for e in entities if e.label]
        if len(entity_names) < 2:
            return []

        # 限制实体数量（避免 prompt 过长）
        entity_names = entity_names[:50]

        # 截断文本
        truncated_text = text[:4000] if len(text) > 4000 else text

        prompt = self.EXTRACTION_PROMPT.format(
            entity_names=json.dumps(entity_names, ensure_ascii=False),
            text=truncated_text,
            relation_types=", ".join(RelationType.ALL),
        )

        # 重试逻辑
        last_error = None
        for attempt in range(self._max_retries):
            try:
                response = await litellm.acompletion(
                    model=self._model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=self._temperature,
                    response_format={"type": "json_object"},
                )

                content = response.choices[0].message.content
                return self._parse_relation_response(content)

            except Exception as exc:
                last_error = exc
                logger.warning(
                    "llm_relation_extraction_retry",
                    attempt=attempt + 1,
                    error=str(exc),
                )
                await asyncio.sleep(2**attempt)

        raise RuntimeError(f"LLM relation extraction failed after {self._max_retries} retries: {last_error}")

    def _parse_relation_response(self, content: str) -> List[RelationExtractionResult]:
        """解析 LLM 响应为关系列表

        Args:
            content: LLM 返回的 JSON 字符串

        Returns:
            关系提取结果列表
        """
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            logger.warning("llm_response_not_json", content_preview=content[:200])
            return []

        relations = data.get("relations", [])
        if not isinstance(relations, list):
            return []

        results = []
        for rel_data in relations:
            if not isinstance(rel_data, dict):
                continue

            source = rel_data.get("source", "").strip()
            target = rel_data.get("target", "").strip()

            if not source or not target:
                continue

            relation_type = rel_data.get("type", RelationType.RELATED_TO)
            if relation_type not in RelationType.ALL:
                relation_type = RelationType.RELATED_TO

            result = RelationExtractionResult(
                source_name=source,
                target_name=target,
                relation_type=relation_type,
                description=rel_data.get("description"),
                confidence=float(rel_data.get("confidence", 1.0)),
                evidence=rel_data.get("evidence"),
            )
            results.append(result)

        return results

    async def _fallback_extract(
        self,
        entities: List[GraphNode],
        text: str,
    ) -> List[GraphEdge]:
        """回退到共现提取器

        Args:
            entities: 实体节点列表
            text: 输入文本

        Returns:
            提取的关系边列表
        """
        from .graph import CooccurrenceRelationExtractor

        fallback = CooccurrenceRelationExtractor()
        return await fallback.extract(entities, text)


# ============================================================================
# Composite Extractor (LLM + Regex fallback)
# ============================================================================


class CompositeEntityExtractor:
    """组合实体提取器

    优先使用 LLM 提取，失败时自动回退到正则提取。

    使用示例:
    ```python
    extractor = CompositeEntityExtractor(
        llm_model="gpt-4o-mini",
        enable_llm=True,
    )
    entities = await extractor.extract(text, corpus_id)
    ```
    """

    def __init__(
        self,
        llm_model: Optional[str] = None,
        enable_llm: bool = True,
        fallback_to_regex: bool = True,
    ) -> None:
        """初始化组合提取器

        Args:
            llm_model: LLM 模型名称
            enable_llm: 是否启用 LLM 提取
            fallback_to_regex: 失败时是否回退到正则
        """
        self._enable_llm = enable_llm
        self._llm_extractor = (
            LLMEntityExtractor(
                model=llm_model,
                fallback_to_regex=fallback_to_regex,
            )
            if enable_llm
            else None
        )

    async def extract(
        self,
        text: str,
        corpus_id: UUID,
    ) -> List[GraphNode]:
        """从文本中提取实体

        Args:
            text: 输入文本
            corpus_id: 语料库 ID

        Returns:
            提取的实体节点列表
        """
        if self._enable_llm and self._llm_extractor:
            return await self._llm_extractor.extract(text, corpus_id)

        # 禁用 LLM 时直接使用正则
        from .graph import RegexEntityExtractor

        regex_extractor = RegexEntityExtractor()
        return await regex_extractor.extract(text, corpus_id)


class CompositeRelationExtractor:
    """组合关系提取器

    优先使用 LLM 提取，失败时自动回退到共现提取。
    """

    def __init__(
        self,
        llm_model: Optional[str] = None,
        enable_llm: bool = True,
        fallback_to_cooccurrence: bool = True,
    ) -> None:
        """初始化组合提取器

        Args:
            llm_model: LLM 模型名称
            enable_llm: 是否启用 LLM 提取
            fallback_to_cooccurrence: 失败时是否回退到共现
        """
        self._enable_llm = enable_llm
        self._llm_extractor = (
            LLMRelationExtractor(
                model=llm_model,
                fallback_to_cooccurrence=fallback_to_cooccurrence,
            )
            if enable_llm
            else None
        )

    async def extract(
        self,
        entities: List[GraphNode],
        text: str,
    ) -> List[GraphEdge]:
        """从文本中提取关系

        Args:
            entities: 实体节点列表
            text: 输入文本

        Returns:
            提取的关系边列表
        """
        if self._enable_llm and self._llm_extractor:
            return await self._llm_extractor.extract(entities, text)

        # 禁用 LLM 时直接使用共现
        from .graph import CooccurrenceRelationExtractor

        cooccurrence_extractor = CooccurrenceRelationExtractor()
        return await cooccurrence_extractor.extract(entities, text)
