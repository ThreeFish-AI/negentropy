"""
Knowledge Graph 处理模块

提供知识图谱的构建、查询和更新功能。
使用 Strategy Pattern 分离实体/关系提取策略，便于后续替换（如 LLM 提取）。

参考文献:
[1] J. Tang et al., "LINE: Large-scale Information Network Embedding,"
    WWW'15, 2015.
[2] T. Mikolov et al., "Distributed Representations of Words and Phrases,"
    NIPS'13, 2013.
"""

from __future__ import annotations

import re
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from negentropy.logging import get_logger

from .types import GraphEdge, GraphNode, KnowledgeGraphPayload

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
    ) -> List[GraphNode]:
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
        pass


# ============================================================================
# Strategy 实现
# ============================================================================


class RegexEntityExtractor(EntityExtractor):
    """基于正则表达式的实体提取器

    使用规则和模式匹配提取常见实体类型:
    - 人名（大写开头的词组）
    - 组织名（Inc, Corp, LLC 后缀）
    - URL

    局限性: 无法处理中文实体，对英文的准确率较低。
    建议在生产环境中替换为 LLMEntityExtractor。
    """

    async def extract(
        self,
        text: str,
        corpus_id: UUID,
    ) -> List[GraphNode]:
        logger.debug(
            "extract_entities_started",
            corpus_id=str(corpus_id),
            text_length=len(text),
            extractor="regex",
        )

        entities: List[GraphNode] = []
        seen = set()

        # 提取人名模式（大写开头的连续词）
        name_pattern = r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b"
        for match in re.finditer(name_pattern, text):
            name = match.group()
            if name not in seen:
                entity = GraphNode(
                    id=f"entity:{uuid4()}",
                    label=name,
                    node_type="person",
                    metadata={"source": "regex_extraction", "corpus_id": str(corpus_id)},
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
                    metadata={"source": "regex_extraction", "corpus_id": str(corpus_id)},
                )
                entities.append(entity)
                seen.add(org)

        # 提取 URL
        url_pattern = r"https?://[^\s]+"
        for match in re.finditer(url_pattern, text):
            url = match.group()
            if url not in seen:
                entity = GraphNode(
                    id=f"entity:{uuid4()}",
                    label=url[:50],
                    node_type="url",
                    metadata={"url": url, "source": "regex_extraction"},
                )
                entities.append(entity)
                seen.add(url)

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
        entities: List[GraphNode],
        text: str,
    ) -> List[GraphEdge]:
        logger.debug(
            "extract_relations_started",
            entity_count=len(entities),
            text_length=len(text),
            extractor="cooccurrence",
        )

        edges: List[GraphEdge] = []
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


class GraphProcessor:
    """知识图谱处理器

    职责:
    1. 从知识块提取实体和关系（通过可替换的 Strategy）
    2. 构建图结构
    3. 支持图谱查询和更新
    4. 图谱去重和合并

    遵循 AGENTS.md 原则：
    - Single Responsibility: 只处理图谱相关逻辑
    - Orthogonal Decomposition: 与存储、展示分离
    - Strategy Pattern: 实体/关系提取可替换
    """

    def __init__(
        self,
        entity_extractor: Optional[EntityExtractor] = None,
        relation_extractor: Optional[RelationExtractor] = None,
    ) -> None:
        """初始化图谱处理器

        Args:
            entity_extractor: 实体提取策略（默认 RegexEntityExtractor）
            relation_extractor: 关系提取策略（默认 CooccurrenceRelationExtractor）
        """
        self._entity_extractor = entity_extractor or RegexEntityExtractor()
        self._relation_extractor = relation_extractor or CooccurrenceRelationExtractor()
        self._nodes: Dict[str, GraphNode] = {}
        self._edges: List[GraphEdge] = []

    async def extract_entities(
        self,
        text: str,
        corpus_id: UUID,
    ) -> List[GraphNode]:
        """从文本中提取实体节点（委托给 EntityExtractor）"""
        return await self._entity_extractor.extract(text, corpus_id)

    async def extract_relations(
        self,
        entities: List[GraphNode],
        text: str,
    ) -> List[GraphEdge]:
        """从文本中提取实体间关系（委托给 RelationExtractor）"""
        return await self._relation_extractor.extract(entities, text)

    async def build_graph(
        self,
        knowledge_chunks: List[str],
        corpus_id: UUID,
    ) -> KnowledgeGraphPayload:
        """从知识块构建图谱

        流程:
        1. 对每个 chunk 提取实体
        2. 提取实体间关系
        3. 合并去重（相同 label 的节点合并）
        4. 返回图谱结构

        Args:
            knowledge_chunks: 知识块列表
            corpus_id: 语料库 ID

        Returns:
            知识图谱数据结构
        """
        logger.info(
            "build_graph_started",
            corpus_id=str(corpus_id),
            chunk_count=len(knowledge_chunks),
        )

        all_nodes: Dict[str, GraphNode] = {}
        all_edges: List[GraphEdge] = []

        for chunk in knowledge_chunks:
            # 提取实体
            entities = await self.extract_entities(chunk, corpus_id)

            # 合并节点（按 label 去重）
            for entity in entities:
                if entity.label:
                    # 查找已存在的相同标签节点
                    existing = next(
                        (n for n in all_nodes.values() if n.label == entity.label),
                        None,
                    )
                    if existing:
                        # 使用已存在的节点
                        continue

                all_nodes[entity.id] = entity

            # 提取关系
            relations = await self.extract_relations(list(all_nodes.values()), chunk)
            all_edges.extend(relations)

        # 去重边（source + target 唯一）
        unique_edges = self._deduplicate_edges(all_edges)

        logger.info(
            "build_graph_completed",
            corpus_id=str(corpus_id),
            node_count=len(all_nodes),
            edge_count=len(unique_edges),
        )

        return KnowledgeGraphPayload(
            nodes=list(all_nodes.values()),
            edges=unique_edges,
        )

    def _deduplicate_edges(self, edges: List[GraphEdge]) -> List[GraphEdge]:
        """去重边列表

        基于 source 和 target 组合去重，保留权重最大的边。

        Args:
            edges: 边列表

        Returns:
            去重后的边列表
        """
        edge_map: Dict[tuple[str, str], GraphEdge] = {}

        for edge in edges:
            key = (edge.source, edge.target)
            existing = edge_map.get(key)

            if existing is None or edge.weight > existing.weight:
                edge_map[key] = edge

        return list(edge_map.values())

    async def merge_graphs(
        self,
        graphs: List[KnowledgeGraphPayload],
    ) -> KnowledgeGraphPayload:
        """合并多个图谱

                合并策略：
        - 节点按 label 合并
                - 边去重并累加权重

                Args:
                    graphs: 图谱列表

                Returns:
                    合并后的图谱
        """
        logger.info(
            "merge_graphs_started",
            graph_count=len(graphs),
        )

        all_nodes: Dict[str, GraphNode] = {}
        all_edges: List[GraphEdge] = []

        for graph in graphs:
            # 合并节点
            for node in graph.nodes:
                if node.label:
                    existing = next(
                        (n for n in all_nodes.values() if n.label == node.label),
                        None,
                    )
                    if existing:
                        continue

                all_nodes[node.id] = node

            # 收集所有边
            all_edges.extend(graph.edges)

        # 去重边
        unique_edges = self._deduplicate_edges(all_edges)

        logger.info(
            "merge_graphs_completed",
            merged_node_count=len(all_nodes),
            merged_edge_count=len(unique_edges),
        )

        return KnowledgeGraphPayload(
            nodes=list(all_nodes.values()),
            edges=unique_edges,
        )

    async def query_neighbors(
        self,
        graph: KnowledgeGraphPayload,
        node_id: str,
        max_depth: int = 1,
    ) -> List[GraphNode]:
        """查询节点的邻居

        获取指定节点在指定深度内的所有邻居节点。

        Args:
            graph: 知识图谱
            node_id: 起始节点 ID
            max_depth: 最大深度（默认 1）

        Returns:
            邻居节点列表
        """
        logger.debug(
            "query_neighbors_started",
            node_id=node_id,
            max_depth=max_depth,
        )

        neighbors: List[GraphNode] = []
        visited = set()
        to_visit = {node_id}

        for _ in range(max_depth + 1):
            if not to_visit:
                break

            current_level = to_visit
            to_visit = set()

            for current_id in current_level:
                if current_id in visited:
                    continue
                visited.add(current_id)

                # 查找直接连接的边
                for edge in graph.edges:
                    if edge.source == current_id:
                        neighbor = next(
                            (n for n in graph.nodes if n.id == edge.target),
                            None,
                        )
                        if neighbor and neighbor.id not in visited:
                            neighbors.append(neighbor)
                            to_visit.add(neighbor.id)
                    elif edge.target == current_id:
                        neighbor = next(
                            (n for n in graph.nodes if n.id == edge.source),
                            None,
                        )
                        if neighbor and neighbor.id not in visited:
                            neighbors.append(neighbor)
                            to_visit.add(neighbor.id)

        logger.debug(
            "query_neighbors_completed",
            node_id=node_id,
            neighbor_count=len(neighbors),
        )

        return neighbors
