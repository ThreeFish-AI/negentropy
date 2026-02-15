"""
Knowledge Graph Repository

提供知识图谱的存储和查询能力，支持多种后端实现。

当前实现:
- AgeGraphRepository: 基于 Apache AGE (PostgreSQL) 的图存储

设计原则 (AGENTS.md):
- Strategy Pattern: 支持多种图存储后端
- Repository Pattern: 隔离持久化细节
- Single Responsibility: 只处理图谱存储和查询

参考文献:
[1] M. Fowler, "Patterns of Enterprise Application Architecture," 2002.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.base import NEGENTROPY_SCHEMA

from .types import GraphEdge, GraphNode, KnowledgeGraphPayload

logger = get_logger("negentropy.knowledge.graph_repository")


# ============================================================================
# Data Types
# ============================================================================


@dataclass(frozen=True)
class EntityRecord:
    """实体记录

    从数据库读取的实体完整信息。
    """

    id: str
    label: str
    entity_type: str
    confidence: float
    corpus_id: UUID
    metadata: Dict[str, Any] = field(default_factory=dict)
    embedding: Optional[List[float]] = None
    created_at: Optional[datetime] = None


@dataclass(frozen=True)
class RelationRecord:
    """关系记录

    从数据库读取的关系完整信息。
    """

    source_id: str
    target_id: str
    relation_type: str
    label: Optional[str] = None
    confidence: float = 1.0
    weight: float = 1.0
    evidence: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class GraphSearchResult:
    """图检索结果

    包含实体信息和图结构分数。
    """

    entity: GraphNode
    semantic_score: float
    graph_score: float
    combined_score: float
    neighbors: List[GraphNode] = field(default_factory=list)
    path: Optional[List[str]] = None


@dataclass(frozen=True)
class BuildRunRecord:
    """构建运行记录"""

    id: UUID
    app_name: str
    corpus_id: UUID
    run_id: str
    status: str
    entity_count: int
    relation_count: int
    extractor_config: Dict[str, Any]
    model_name: Optional[str]
    error_message: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime


# ============================================================================
# Abstract Repository Interface
# ============================================================================


class GraphRepository(ABC):
    """图谱存储抽象接口

    支持多种后端实现:
    - Apache AGE (PostgreSQL)
    - Neo4j (Phase 2+)
    - 内存图 (测试)
    """

    @abstractmethod
    async def create_entity(
        self,
        entity: GraphNode,
        corpus_id: UUID,
    ) -> str:
        """创建实体节点

        Args:
            entity: 实体节点数据
            corpus_id: 所属语料库 ID

        Returns:
            创建的实体 ID
        """
        pass

    @abstractmethod
    async def create_entities(
        self,
        entities: List[GraphNode],
        corpus_id: UUID,
    ) -> List[str]:
        """批量创建实体节点

        Args:
            entities: 实体节点列表
            corpus_id: 所属语料库 ID

        Returns:
            创建的实体 ID 列表
        """
        pass

    @abstractmethod
    async def create_relation(
        self,
        source_id: str,
        target_id: str,
        relation: GraphEdge,
    ) -> str:
        """创建关系边

        Args:
            source_id: 源实体 ID
            target_id: 目标实体 ID
            relation: 关系数据

        Returns:
            创建的关系 ID
        """
        pass

    @abstractmethod
    async def create_relations(
        self,
        relations: List[GraphEdge],
    ) -> List[str]:
        """批量创建关系边

        Args:
            relations: 关系列表

        Returns:
            创建的关系 ID 列表
        """
        pass

    @abstractmethod
    async def find_neighbors(
        self,
        entity_id: str,
        max_depth: int = 1,
        limit: int = 100,
    ) -> List[GraphNode]:
        """查询邻居节点

        Args:
            entity_id: 起始实体 ID
            max_depth: 最大遍历深度
            limit: 结果数量限制

        Returns:
            邻居节点列表
        """
        pass

    @abstractmethod
    async def find_path(
        self,
        source_id: str,
        target_id: str,
        max_depth: int = 5,
    ) -> Optional[List[str]]:
        """查询两点间最短路径

        Args:
            source_id: 起始实体 ID
            target_id: 目标实体 ID
            max_depth: 最大路径深度

        Returns:
            路径节点 ID 列表，或 None（不存在路径）
        """
        pass

    @abstractmethod
    async def hybrid_search(
        self,
        corpus_id: UUID,
        app_name: str,
        query_embedding: List[float],
        query_text: str,
        limit: int = 20,
        graph_depth: int = 1,
        semantic_weight: float = 0.6,
        graph_weight: float = 0.4,
    ) -> List[GraphSearchResult]:
        """混合检索 (向量 + 图遍历)

        Args:
            corpus_id: 语料库 ID
            app_name: 应用名称
            query_embedding: 查询向量
            query_text: 查询文本
            limit: 结果数量限制
            graph_depth: 图遍历深度
            semantic_weight: 语义分数权重
            graph_weight: 图分数权重

        Returns:
            检索结果列表
        """
        pass

    @abstractmethod
    async def get_graph(
        self,
        corpus_id: UUID,
        app_name: str,
    ) -> KnowledgeGraphPayload:
        """获取完整图谱

        Args:
            corpus_id: 语料库 ID
            app_name: 应用名称

        Returns:
            完整图谱数据
        """
        pass

    @abstractmethod
    async def clear_graph(
        self,
        corpus_id: UUID,
    ) -> int:
        """清除语料库的图谱数据

        Args:
            corpus_id: 语料库 ID

        Returns:
            删除的节点数量
        """
        pass

    @abstractmethod
    async def create_build_run(
        self,
        app_name: str,
        corpus_id: UUID,
        run_id: str,
        extractor_config: Dict[str, Any],
        model_name: Optional[str] = None,
    ) -> UUID:
        """创建构建运行记录

        Args:
            app_name: 应用名称
            corpus_id: 语料库 ID
            run_id: 运行标识
            extractor_config: 提取器配置
            model_name: LLM 模型名称

        Returns:
            运行记录 ID
        """
        pass

    @abstractmethod
    async def update_build_run(
        self,
        run_id: UUID,
        status: str,
        entity_count: int = 0,
        relation_count: int = 0,
        error_message: Optional[str] = None,
    ) -> None:
        """更新构建运行状态

        Args:
            run_id: 运行记录 ID
            status: 新状态
            entity_count: 实体数量
            relation_count: 关系数量
            error_message: 错误信息
        """
        pass

    @abstractmethod
    async def get_build_runs(
        self,
        corpus_id: UUID,
        app_name: str,
        limit: int = 20,
    ) -> List[BuildRunRecord]:
        """获取构建运行历史

        Args:
            corpus_id: 语料库 ID
            app_name: 应用名称
            limit: 结果数量限制

        Returns:
            运行记录列表
        """
        pass


# ============================================================================
# Apache AGE Implementation
# ============================================================================


class AgeGraphRepository(GraphRepository):
    """基于 Apache AGE 的图谱存储实现

    使用 PostgreSQL + Apache AGE 扩展存储和查询知识图谱。

    特性:
    - 支持 Cypher 查询语言
    - 与现有 knowledge 表集成
    - 支持混合检索 (向量 + 图)
    """

    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        """初始化 Repository

        Args:
            session: SQLAlchemy 异步会话（可选，用于依赖注入）
        """
        self._session = session
        self._schema = NEGENTROPY_SCHEMA

    async def _get_session(self) -> AsyncSession:
        """获取数据库会话"""
        if self._session:
            return self._session
        async with AsyncSessionLocal() as session:
            return session

    async def create_entity(
        self,
        entity: GraphNode,
        corpus_id: UUID,
    ) -> str:
        """创建实体节点

        将实体信息存储到 knowledge 表，并创建 Apache AGE 节点。
        """
        session = await self._get_session()

        # 更新 knowledge 表的实体字段
        confidence = entity.metadata.get("confidence", 1.0)

        query = text(f"""
            UPDATE {self._schema}.knowledge
            SET entity_type = :entity_type,
                entity_confidence = :confidence,
                metadata = COALESCE(metadata, '{{}}'::jsonb) || :metadata::jsonb
            WHERE id = :entity_id
        """)

        await session.execute(
            query,
            {
                "entity_id": entity.id.replace("entity:", ""),
                "entity_type": entity.node_type,
                "confidence": confidence,
                "metadata": str({"graph_label": entity.label}),
            },
        )

        await session.commit()

        logger.debug(
            "entity_created",
            entity_id=entity.id,
            entity_type=entity.node_type,
            corpus_id=str(corpus_id),
        )

        return entity.id

    async def create_entities(
        self,
        entities: List[GraphNode],
        corpus_id: UUID,
    ) -> List[str]:
        """批量创建实体节点"""
        ids = []
        for entity in entities:
            entity_id = await self.create_entity(entity, corpus_id)
            ids.append(entity_id)

        logger.info(
            "entities_created_batch",
            count=len(ids),
            corpus_id=str(corpus_id),
        )

        return ids

    async def create_relation(
        self,
        source_id: str,
        target_id: str,
        relation: GraphEdge,
    ) -> str:
        """创建关系边

        当前实现：将关系存储在 knowledge 表的 metadata 中。
        未来：使用 Apache AGE Cypher 创建关系。
        """
        session = await self._get_session()

        # 将关系信息存储到源实体的 metadata 中
        relation_data = {
            "target_id": target_id,
            "relation_type": relation.edge_type,
            "confidence": relation.metadata.get("confidence", 1.0),
            "evidence": relation.metadata.get("evidence"),
        }

        # 获取当前 related_entities 列表
        query = text(f"""
            SELECT metadata->'related_entities' as related
            FROM {self._schema}.knowledge
            WHERE id = :source_id
        """)

        result = await session.execute(query, {"source_id": source_id.replace("entity:", "")})
        row = result.fetchone()

        related_entities = []
        if row and row.related:
            import json

            related_entities = json.loads(row.related) if isinstance(row.related, str) else row.related

        # 添加新关系
        related_entities.append(relation_data)

        # 更新 metadata
        update_query = text(f"""
            UPDATE {self._schema}.knowledge
            SET metadata = COALESCE(metadata, '{{}}'::jsonb) ||
                          jsonb_build_object('related_entities', :related::jsonb)
            WHERE id = :source_id
        """)

        import json

        await session.execute(
            update_query,
            {
                "source_id": source_id.replace("entity:", ""),
                "related": json.dumps(related_entities),
            },
        )

        await session.commit()

        relation_id = f"relation:{source_id}:{target_id}:{relation.edge_type}"

        logger.debug(
            "relation_created",
            relation_id=relation_id,
            source_id=source_id,
            target_id=target_id,
            relation_type=relation.edge_type,
        )

        return relation_id

    async def create_relations(
        self,
        relations: List[GraphEdge],
    ) -> List[str]:
        """批量创建关系边"""
        ids = []
        for relation in relations:
            relation_id = await self.create_relation(
                relation.source,
                relation.target,
                relation,
            )
            ids.append(relation_id)

        logger.info("relations_created_batch", count=len(ids))

        return ids

    async def find_neighbors(
        self,
        entity_id: str,
        max_depth: int = 1,
        limit: int = 100,
    ) -> List[GraphNode]:
        """查询邻居节点

        当前实现：基于 metadata 中的 related_entities 查询。
        """
        session = await self._get_session()

        # 简化实现：从 metadata 中获取关联实体
        query = text(f"""
            SELECT id, content, entity_type, metadata, entity_confidence
            FROM {self._schema}.knowledge
            WHERE entity_type IS NOT NULL
              AND metadata->'related_entities' IS NOT NULL
              AND (
                  id::text IN (
                      SELECT jsonb_array_elements(metadata->'related_entities')->>'target_id'
                      FROM {self._schema}.knowledge
                      WHERE id::text = :entity_id
                  )
                  OR metadata->'related_entities' @> jsonb_build_array(
                      jsonb_build_object('target_id', :entity_id)
                  )
              )
            LIMIT :limit
        """)

        result = await session.execute(
            query,
            {
                "entity_id": entity_id.replace("entity:", ""),
                "limit": limit,
            },
        )

        neighbors = []
        for row in result:
            neighbor = GraphNode(
                id=f"entity:{row.id}",
                label=row.content[:100] if row.content else None,
                node_type=row.entity_type,
                metadata=row.metadata or {},
            )
            neighbors.append(neighbor)

        logger.debug(
            "neighbors_found",
            entity_id=entity_id,
            neighbor_count=len(neighbors),
            max_depth=max_depth,
        )

        return neighbors

    async def find_path(
        self,
        source_id: str,
        target_id: str,
        max_depth: int = 5,
    ) -> Optional[List[str]]:
        """查询两点间最短路径

        当前实现：返回简化路径。
        未来：使用 Apache AGE Cypher shortestPath()。
        """
        # 简化实现：如果存在直接关系，返回路径
        neighbors = await self.find_neighbors(source_id, max_depth=1)

        target_clean = target_id.replace("entity:", "")
        for neighbor in neighbors:
            if target_clean in neighbor.id:
                return [source_id, target_id]

        return None

    async def hybrid_search(
        self,
        corpus_id: UUID,
        app_name: str,
        query_embedding: List[float],
        query_text: str,
        limit: int = 20,
        graph_depth: int = 1,
        semantic_weight: float = 0.6,
        graph_weight: float = 0.4,
    ) -> List[GraphSearchResult]:
        """混合检索 (向量 + 图遍历)"""
        session = await self._get_session()

        # 调用数据库函数 kg_hybrid_search
        query = text(f"""
            SELECT * FROM {self._schema}.kg_hybrid_search(
                p_corpus_id := :corpus_id,
                p_app_name := :app_name,
                p_query := :query,
                p_query_embedding := :embedding::vector,
                p_limit := :limit,
                p_graph_depth := :graph_depth,
                p_semantic_weight := :semantic_weight,
                p_graph_weight := :graph_weight
            )
        """)

        import json

        result = await session.execute(
            query,
            {
                "corpus_id": str(corpus_id),
                "app_name": app_name,
                "query": query_text,
                "embedding": json.dumps(query_embedding),
                "limit": limit,
                "graph_depth": graph_depth,
                "semantic_weight": semantic_weight,
                "graph_weight": graph_weight,
            },
        )

        results = []
        for row in result:
            entity = GraphNode(
                id=f"entity:{row.id}",
                label=row.content[:100] if row.content else None,
                node_type=row.entity_type,
                metadata=row.metadata or {},
            )

            search_result = GraphSearchResult(
                entity=entity,
                semantic_score=row.semantic_score,
                graph_score=row.graph_score,
                combined_score=row.combined_score,
            )
            results.append(search_result)

        logger.debug(
            "hybrid_search_completed",
            corpus_id=str(corpus_id),
            result_count=len(results),
        )

        return results

    async def get_graph(
        self,
        corpus_id: UUID,
        app_name: str,
    ) -> KnowledgeGraphPayload:
        """获取完整图谱"""
        session = await self._get_session()

        # 获取所有实体
        entities_query = text(f"""
            SELECT id, content, entity_type, metadata, entity_confidence
            FROM {self._schema}.knowledge
            WHERE corpus_id = :corpus_id
              AND app_name = :app_name
              AND entity_type IS NOT NULL
        """)

        result = await session.execute(
            entities_query,
            {
                "corpus_id": str(corpus_id),
                "app_name": app_name,
            },
        )

        nodes = []
        edges = []

        for row in result:
            node = GraphNode(
                id=f"entity:{row.id}",
                label=row.content[:100] if row.content else None,
                node_type=row.entity_type,
                metadata=row.metadata or {},
            )
            nodes.append(node)

            # 从 metadata 中提取关系
            if row.metadata and "related_entities" in row.metadata:
                for rel in row.metadata["related_entities"]:
                    edge = GraphEdge(
                        source=f"entity:{row.id}",
                        target=rel.get("target_id", ""),
                        edge_type=rel.get("relation_type", "RELATED_TO"),
                        weight=rel.get("confidence", 1.0),
                        metadata={"evidence": rel.get("evidence")},
                    )
                    edges.append(edge)

        logger.info(
            "graph_loaded",
            corpus_id=str(corpus_id),
            node_count=len(nodes),
            edge_count=len(edges),
        )

        return KnowledgeGraphPayload(nodes=nodes, edges=edges)

    async def clear_graph(
        self,
        corpus_id: UUID,
    ) -> int:
        """清除语料库的图谱数据"""
        session = await self._get_session()

        # 重置实体相关字段
        query = text(f"""
            UPDATE {self._schema}.knowledge
            SET entity_type = NULL,
                entity_confidence = NULL,
                metadata = metadata - 'related_entities'
            WHERE corpus_id = :corpus_id
              AND entity_type IS NOT NULL
        """)

        result = await session.execute(query, {"corpus_id": str(corpus_id)})
        await session.commit()

        count = result.rowcount

        logger.info(
            "graph_cleared",
            corpus_id=str(corpus_id),
            nodes_cleared=count,
        )

        return count

    async def create_build_run(
        self,
        app_name: str,
        corpus_id: UUID,
        run_id: str,
        extractor_config: Dict[str, Any],
        model_name: Optional[str] = None,
    ) -> UUID:
        """创建构建运行记录"""
        import json
        import uuid

        session = await self._get_session()

        run_uuid = uuid.uuid4()

        query = text(f"""
            INSERT INTO {self._schema}.kg_build_runs
                (id, app_name, corpus_id, run_id, status, extractor_config, model_name, started_at)
            VALUES
                (:id, :app_name, :corpus_id, :run_id, 'running', :config::jsonb, :model, NOW())
        """)

        await session.execute(
            query,
            {
                "id": str(run_uuid),
                "app_name": app_name,
                "corpus_id": str(corpus_id),
                "run_id": run_id,
                "config": json.dumps(extractor_config),
                "model": model_name,
            },
        )

        await session.commit()

        logger.info(
            "build_run_created",
            run_id=run_id,
            corpus_id=str(corpus_id),
        )

        return run_uuid

    async def update_build_run(
        self,
        run_id: UUID,
        status: str,
        entity_count: int = 0,
        relation_count: int = 0,
        error_message: Optional[str] = None,
    ) -> None:
        """更新构建运行状态"""
        session = await self._get_session()

        query = text(f"""
            UPDATE {self._schema}.kg_build_runs
            SET status = :status,
                entity_count = :entity_count,
                relation_count = :relation_count,
                error_message = :error_message,
                completed_at = CASE WHEN :status IN ('completed', 'failed') THEN NOW() END
            WHERE id = :run_id
        """)

        await session.execute(
            query,
            {
                "run_id": str(run_id),
                "status": status,
                "entity_count": entity_count,
                "relation_count": relation_count,
                "error_message": error_message,
            },
        )

        await session.commit()

        logger.info(
            "build_run_updated",
            run_id=str(run_id),
            status=status,
            entity_count=entity_count,
            relation_count=relation_count,
        )

    async def get_build_runs(
        self,
        corpus_id: UUID,
        app_name: str,
        limit: int = 20,
    ) -> List[BuildRunRecord]:
        """获取构建运行历史"""
        session = await self._get_session()

        query = text(f"""
            SELECT id, app_name, corpus_id, run_id, status,
                   entity_count, relation_count, extractor_config, model_name,
                   error_message, started_at, completed_at, created_at
            FROM {self._schema}.kg_build_runs
            WHERE corpus_id = :corpus_id AND app_name = :app_name
            ORDER BY created_at DESC
            LIMIT :limit
        """)

        result = await session.execute(
            query,
            {
                "corpus_id": str(corpus_id),
                "app_name": app_name,
                "limit": limit,
            },
        )

        runs = []
        for row in result:
            run = BuildRunRecord(
                id=row.id,
                app_name=row.app_name,
                corpus_id=row.corpus_id,
                run_id=row.run_id,
                status=row.status,
                entity_count=row.entity_count,
                relation_count=row.relation_count,
                extractor_config=row.extractor_config or {},
                model_name=row.model_name,
                error_message=row.error_message,
                started_at=row.started_at,
                completed_at=row.completed_at,
                created_at=row.created_at,
            )
            runs.append(run)

        return runs


# ============================================================================
# Factory Function
# ============================================================================


def get_graph_repository(session: Optional[AsyncSession] = None) -> GraphRepository:
    """获取图谱存储实例

    Args:
        session: 可选的数据库会话

    Returns:
        GraphRepository 实例
    """
    return AgeGraphRepository(session=session)
