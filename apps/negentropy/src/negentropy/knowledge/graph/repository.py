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
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.base import NEGENTROPY_SCHEMA

from ..types import GraphEdge, GraphNode, KnowledgeGraphPayload

logger = get_logger("negentropy.knowledge.graph_repository")


# ============================================================================
# 时态过滤工具（Snodgrass & Ahn, 1985 双时轴模型 — bi-temporal）
# ============================================================================
#
# 单一事实源：所有需要按 valid_from / valid_to 过滤的查询都通过本工具构造
# WHERE 片段，确保跨 `find_neighbors / find_path / hybrid_search / get_graph`
# 的时态语义一致；由 G3 时间穿梭检索引入。

_TEMPORAL_RELATION_CLAUSE = (
    "(:rel_alias.valid_from IS NULL OR :rel_alias.valid_from <= :as_of) "
    "AND (:rel_alias.valid_to IS NULL OR :rel_alias.valid_to > :as_of)"
)


def _temporal_where_clause(rel_alias: str = "r") -> str:
    """生成时态过滤 SQL 片段（不含前导 AND）。

    Args:
        rel_alias: kg_relations 表在 SQL 中使用的别名，如 ``r`` / ``rel``。

    Returns:
        例如：``(r.valid_from IS NULL OR r.valid_from <= :as_of)
               AND (r.valid_to IS NULL OR r.valid_to > :as_of)``。

    Note:
        调用方需自行拼接 ``AND`` 连接前缀；绑定参数名固定为 ``:as_of``。
    """
    return _TEMPORAL_RELATION_CLAUSE.replace(":rel_alias", rel_alias)


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
    metadata: dict[str, Any] = field(default_factory=dict)
    embedding: list[float] | None = None
    created_at: datetime | None = None


@dataclass(frozen=True)
class RelationRecord:
    """关系记录

    从数据库读取的关系完整信息。
    """

    source_id: str
    target_id: str
    relation_type: str
    label: str | None = None
    confidence: float = 1.0
    weight: float = 1.0
    evidence: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class GraphSearchResult:
    """图检索结果

    包含实体信息和图结构分数。
    """

    entity: GraphNode
    semantic_score: float
    graph_score: float
    combined_score: float
    neighbors: list[GraphNode] = field(default_factory=list)
    path: list[str] | None = None


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
    extractor_config: dict[str, Any]
    model_name: str | None
    error_message: str | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    progress_percent: float = 0.0
    warnings: list[dict[str, Any]] | None = None


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
        entities: list[GraphNode],
        corpus_id: UUID,
    ) -> list[str]:
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
        relations: list[GraphEdge],
    ) -> list[str]:
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
        as_of: datetime | None = None,
    ) -> list[GraphNode]:
        """查询邻居节点

        Args:
            entity_id: 起始实体 ID
            max_depth: 最大遍历深度
            limit: 结果数量限制
            as_of: 时态过滤 — 仅返回 valid_from <= as_of 且 valid_to IS NULL 或 > as_of 的关系

        Returns:
            邻居节点列表
        """
        pass

    @abstractmethod
    async def find_neighbor_edges(
        self,
        entity_id: str,
        limit: int = 50,
        as_of: datetime | None = None,
    ) -> list[dict[str, Any]]:
        """查询 1-hop 邻居及连接边的关系信息（供子图上下文构建使用）

        与 `find_neighbors` 互补：后者只返回邻居实体节点，无法承载 relation 字段；
        本方法直接 JOIN kg_relations 与 kg_entities，每行携带边的 relation_type / evidence。

        Args:
            entity_id: 起始实体 ID（含/不含 entity: 前缀）
            limit: 返回的邻居边数上限
            as_of: 可选的时态过滤时间戳

        Returns:
            [{id, name, type, relation, evidence}] — 与 GraphContextBuilder 的
            neighbor_fn 协议对齐
        """
        pass

    @abstractmethod
    async def find_path(
        self,
        source_id: str,
        target_id: str,
        max_depth: int = 5,
        as_of: datetime | None = None,
    ) -> list[str] | None:
        """查询两点间最短路径

        Args:
            source_id: 起始实体 ID
            target_id: 目标实体 ID
            max_depth: 最大路径深度
            as_of: 可选时态快照时刻；提供时仅遍历在该时刻有效的关系

        Returns:
            路径节点 ID 列表，或 None（不存在路径）
        """
        pass

    @abstractmethod
    async def hybrid_search(
        self,
        corpus_id: UUID,
        app_name: str,
        query_embedding: list[float],
        query_text: str,
        limit: int = 20,
        graph_depth: int = 1,
        semantic_weight: float = 0.6,
        graph_weight: float = 0.4,
        as_of: datetime | None = None,
    ) -> list[GraphSearchResult]:
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
            as_of: 可选时态快照时刻；提供时仅纳入在该时刻有效的关系

        Returns:
            检索结果列表
        """
        pass

    @abstractmethod
    async def get_graph(
        self,
        corpus_id: UUID,
        app_name: str,
        as_of: datetime | None = None,
    ) -> KnowledgeGraphPayload:
        """获取完整图谱

        Args:
            corpus_id: 语料库 ID
            app_name: 应用名称
            as_of: 可选时态快照时刻；提供时仅返回在该时刻有效的关系

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
    async def get_relation_timeline(
        self,
        corpus_id: UUID,
        bucket: str = "day",
    ) -> list[dict[str, Any]]:
        """按时间桶聚合关系生效/失效事件，用于前端时间轴密度直方图。

        Args:
            corpus_id: 语料库 ID
            bucket: ``day`` / ``week`` / ``month``，对应 PostgreSQL date_trunc 单位。

        Returns:
            ``[{"date": ISO8601, "active_count": N, "expired_count": M}]`` 列表，
            按 date 升序；空语料库返回 ``[]``。
        """
        pass

    @abstractmethod
    async def create_build_run(
        self,
        app_name: str,
        corpus_id: UUID,
        run_id: str,
        extractor_config: dict[str, Any],
        model_name: str | None = None,
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
        error_message: str | None = None,
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
    ) -> list[BuildRunRecord]:
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

    def __init__(self, session: AsyncSession | None = None) -> None:
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
        entities: list[GraphNode],
        corpus_id: UUID,
    ) -> list[str]:
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

        写入 kg_relations 一等公民表（SSoT），同时保留 knowledge.metadata JSONB
        作为过渡期兼容。参见 Kleppmann §11 事务内双写模式。
        """
        import json as _json

        session = await self._get_session()

        clean_source = source_id.replace("entity:", "")
        clean_target = target_id.replace("entity:", "")
        confidence = relation.metadata.get("confidence", 1.0)
        evidence = relation.metadata.get("evidence")

        # 1. 写入 kg_relations 一等公民表
        # 唯一约束 (source_id, target_id, relation_type) 命中时使用 DO UPDATE，
        # 而非 DO NOTHING：否则 evidence 变更后 INSERT 被静默丢弃，再叠加
        # TemporalResolver 的 expire 流程会导致关系被彻底抹除（既无新行又无有效旧行）。
        insert_query = text(f"""
            INSERT INTO {self._schema}.kg_relations
                (source_id, target_id, corpus_id, app_name, relation_type,
                 weight, confidence, evidence_text, metadata, is_active)
            SELECT :source_id, :target_id, k.corpus_id, k.app_name,
                   :relation_type, :weight, :confidence, :evidence, :metadata::jsonb, true
            FROM {self._schema}.knowledge k
            WHERE k.id = :source_id
            ON CONFLICT (source_id, target_id, relation_type) DO UPDATE SET
                weight = EXCLUDED.weight,
                confidence = EXCLUDED.confidence,
                evidence_text = EXCLUDED.evidence_text,
                metadata = EXCLUDED.metadata,
                is_active = true,
                valid_to = NULL,
                last_observed_at = NOW(),
                observation_count = kg_relations.observation_count + 1
        """)

        await session.execute(
            insert_query,
            {
                "source_id": clean_source,
                "target_id": clean_target,
                "relation_type": relation.edge_type or "RELATED_TO",
                "weight": relation.weight or 1.0,
                "confidence": confidence,
                "evidence": evidence,
                "metadata": _json.dumps(relation.metadata or {}),
            },
        )

        # 2. 过渡期：同时写入 JSONB（兼容旧读取路径）
        relation_data = {
            "target_id": clean_target,
            "relation_type": relation.edge_type,
            "confidence": confidence,
            "evidence": evidence,
        }

        select_query = text(f"""
            SELECT metadata->'related_entities' as related
            FROM {self._schema}.knowledge
            WHERE id = :source_id
        """)

        result = await session.execute(select_query, {"source_id": clean_source})
        row = result.fetchone()

        related_entities = []
        if row and row.related:
            related_entities = _json.loads(row.related) if isinstance(row.related, str) else row.related

        related_entities.append(relation_data)

        update_query = text(f"""
            UPDATE {self._schema}.knowledge
            SET metadata = COALESCE(metadata, '{{}}'::jsonb) ||
                          jsonb_build_object('related_entities', :related::jsonb)
            WHERE id = :source_id
        """)

        await session.execute(
            update_query,
            {
                "source_id": clean_source,
                "related": _json.dumps(related_entities),
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
        relations: list[GraphEdge],
    ) -> list[str]:
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
        as_of: datetime | None = None,
    ) -> list[GraphNode]:
        """查询邻居节点（基于 kg_relations 递归 CTE 多跳遍历）

        通过 kg_entities + kg_relations 表进行图遍历，
        支持 1-max_depth 跳的邻居查询。
        """
        session = await self._get_session()
        clean_id = entity_id.replace("entity:", "")

        # 时态过滤片段 (Snodgrass & Ahn, 1985) — 委托模块级 helper
        temporal_filter = ""
        if as_of:
            temporal_filter = f"\n                AND {_temporal_where_clause('r')}"

        query = text(f"""
            WITH RECURSIVE neighbor_tree AS (
                -- Base: direct neighbors of the seed entity
                SELECT
                    r.target_id AS neighbor_id,
                    r.source_id AS via_id,
                    1 AS distance
                FROM {self._schema}.kg_relations r
                WHERE r.source_id = :entity_id AND r.is_active = true{temporal_filter}

                UNION

                SELECT
                    r.source_id AS neighbor_id,
                    r.target_id AS via_id,
                    1 AS distance
                FROM {self._schema}.kg_relations r
                WHERE r.target_id = :entity_id AND r.is_active = true{temporal_filter}

                UNION ALL

                -- Recursive: expand from known neighbors
                SELECT
                    r.target_id AS neighbor_id,
                    r.source_id AS via_id,
                    nt.distance + 1 AS distance
                FROM {self._schema}.kg_relations r
                JOIN neighbor_tree nt ON r.source_id = nt.neighbor_id
                WHERE r.is_active = true{temporal_filter}
                  AND nt.distance < :max_depth
                  AND r.target_id != :entity_id

                UNION ALL

                SELECT
                    r.source_id AS neighbor_id,
                    r.target_id AS via_id,
                    nt.distance + 1 AS distance
                FROM {self._schema}.kg_relations r
                JOIN neighbor_tree nt ON r.target_id = nt.neighbor_id
                WHERE r.is_active = true{temporal_filter}
                  AND nt.distance < :max_depth
                  AND r.source_id != :entity_id
            )
            SELECT DISTINCT ON (e.id)
                e.id, e.name, e.entity_type, e.confidence, e.properties
            FROM neighbor_tree nt
            JOIN {self._schema}.kg_entities e ON e.id = nt.neighbor_id
            WHERE e.is_active = true
            ORDER BY e.id, nt.distance
            LIMIT :limit
        """)

        params: dict[str, Any] = {
            "entity_id": clean_id,
            "max_depth": max_depth,
            "limit": limit,
        }
        if as_of:
            params["as_of"] = as_of

        result = await session.execute(query, params)

        neighbors = []
        for row in result:
            neighbor = GraphNode(
                id=f"entity:{row.id}",
                label=row.name,
                node_type=row.entity_type,
                metadata={
                    "confidence": float(row.confidence) if row.confidence else 0,
                    **(row.properties or {}),
                },
            )
            neighbors.append(neighbor)

        logger.debug(
            "neighbors_found",
            entity_id=entity_id,
            neighbor_count=len(neighbors),
            max_depth=max_depth,
        )

        return neighbors

    async def find_neighbor_edges(
        self,
        entity_id: str,
        limit: int = 50,
        as_of: datetime | None = None,
    ) -> list[dict[str, Any]]:
        """查询 1-hop 邻居及边信息（供 GraphContextBuilder 构建三元组）

        与 find_neighbors 不同，本查询单跳 JOIN kg_relations × kg_entities，
        每行返回邻居节点 + 连接边的 relation_type / evidence_text。
        """
        session = await self._get_session()
        clean_id = entity_id.replace("entity:", "")

        temporal_filter = ""
        if as_of:
            temporal_filter = f"\n                AND {_temporal_where_clause('r')}"

        query = text(f"""
            WITH edges AS (
                SELECT r.target_id AS neighbor_id, r.relation_type, r.evidence_text, r.weight
                FROM {self._schema}.kg_relations r
                WHERE r.source_id = :entity_id AND r.is_active = true{temporal_filter}
                UNION ALL
                SELECT r.source_id AS neighbor_id, r.relation_type, r.evidence_text, r.weight
                FROM {self._schema}.kg_relations r
                WHERE r.target_id = :entity_id AND r.is_active = true{temporal_filter}
            )
            SELECT e.id, e.name, e.entity_type,
                   ed.relation_type, ed.evidence_text, ed.weight
            FROM edges ed
            JOIN {self._schema}.kg_entities e ON e.id = ed.neighbor_id
            WHERE e.is_active = true AND e.id != :entity_id
            ORDER BY ed.weight DESC NULLS LAST
            LIMIT :limit
        """)

        params: dict[str, Any] = {"entity_id": clean_id, "limit": limit}
        if as_of:
            params["as_of"] = as_of

        result = await session.execute(query, params)

        return [
            {
                "id": f"entity:{row.id}",
                "name": row.name,
                "type": row.entity_type,
                "relation": row.relation_type,
                "evidence": row.evidence_text or "",
            }
            for row in result
        ]

    async def find_path(
        self,
        source_id: str,
        target_id: str,
        max_depth: int = 5,
        as_of: datetime | None = None,
    ) -> list[str] | None:
        """查询两点间最短路径（基于 kg_relations 递归 CTE BFS）

        使用广度优先搜索在 kg_relations 表上查找最短路径。
        ``as_of`` 提供时仅遍历在该时刻有效的关系（Snodgrass & Ahn, 1985）。
        """
        session = await self._get_session()
        source_clean = source_id.replace("entity:", "")
        target_clean = target_id.replace("entity:", "")

        if source_clean == target_clean:
            return [source_clean]

        # 时态过滤片段；CTE 中的两段 base 与两段 recursive 复用同一谓词。
        temporal_base = ""
        temporal_recur = ""
        if as_of:
            # base 段使用 kg_relations 主体，无别名 → 临时使用 kg_relations 别名
            temporal_base = (
                "\n                  AND (valid_from IS NULL OR valid_from <= :as_of)"
                "\n                  AND (valid_to IS NULL OR valid_to > :as_of)"
            )
            temporal_recur = f"\n                  AND {_temporal_where_clause('r')}"

        query = text(f"""
            WITH RECURSIVE path_search AS (
                -- Base case: forward edges from source
                SELECT
                    source_id,
                    target_id,
                    ARRAY[source_id] AS path,
                    1 AS depth
                FROM {self._schema}.kg_relations
                WHERE source_id = :source_id AND is_active = true{temporal_base}

                UNION ALL

                -- Base case: reverse edges from source
                SELECT
                    target_id AS source_id,
                    source_id AS target_id,
                    ARRAY[:source_id] AS path,
                    1 AS depth
                FROM {self._schema}.kg_relations
                WHERE target_id = :source_id AND is_active = true
                  AND source_id != :source_id{temporal_base}

                UNION ALL

                -- Recursive: forward direction
                SELECT
                    r.source_id,
                    r.target_id,
                    ps.path || ps.target_id,
                    ps.depth + 1
                FROM {self._schema}.kg_relations r
                JOIN path_search ps ON r.source_id = ps.target_id
                WHERE r.is_active = true
                  AND ps.depth < :max_depth
                  AND r.target_id != ALL(ps.path){temporal_recur}

                UNION ALL

                -- Recursive: reverse direction
                SELECT
                    r.target_id AS source_id,
                    r.source_id AS target_id,
                    ps.path || ps.target_id,
                    ps.depth + 1
                FROM {self._schema}.kg_relations r
                JOIN path_search ps ON r.target_id = ps.target_id
                WHERE r.is_active = true
                  AND ps.depth < :max_depth
                  AND r.source_id != ALL(ps.path){temporal_recur}
            )
            SELECT path || target_id AS full_path
            FROM path_search
            WHERE target_id = :target_id
            ORDER BY depth
            LIMIT 1
        """)

        params: dict[str, Any] = {
            "source_id": source_clean,
            "target_id": target_clean,
            "max_depth": max_depth,
        }
        if as_of:
            params["as_of"] = as_of

        result = await session.execute(query, params)

        row = result.first()
        if row is None:
            return None

        path = [str(pid) for pid in row.full_path]
        logger.debug(
            "path_found",
            source_id=source_id,
            target_id=target_id,
            path_length=len(path),
        )

        return path

    async def hybrid_search(
        self,
        corpus_id: UUID,
        app_name: str,
        query_embedding: list[float],
        query_text: str,
        limit: int = 20,
        graph_depth: int = 1,
        semantic_weight: float = 0.6,
        graph_weight: float = 0.4,
        rrf_k: int | None = None,
        as_of: datetime | None = None,
    ) -> list[GraphSearchResult]:
        """混合检索 (向量 + 图遍历)

        当 rrf_k 不为 None 时使用 Reciprocal Rank Fusion (Cormack et al., SIGIR 2009)，
        否则使用线性加权组合。``as_of`` 提供时仅纳入在该时刻仍存在至少一条有效
        关系的实体（双时态过滤；Snodgrass & Ahn, 1985）。
        """

        session = await self._get_session()

        if rrf_k is not None:
            # RRF 模式：分别查询语义和图排序，然后融合
            results = await self._rrf_search(
                session,
                corpus_id,
                app_name,
                query_embedding,
                query_text,
                limit,
                rrf_k,
                as_of=as_of,
            )
        else:
            if as_of is not None:
                # 线性加权调用 SQL 函数 kg_hybrid_search，函数本身未感知时态；
                # 此处不静默丢弃 as_of，而是显式自动升级为 RRF 模式以满足语义。
                logger.info(
                    "hybrid_search_as_of_upgraded_to_rrf",
                    corpus_id=str(corpus_id),
                    reason="linear_weighted_path_lacks_temporal_filter",
                )
                results = await self._rrf_search(
                    session,
                    corpus_id,
                    app_name,
                    query_embedding,
                    query_text,
                    limit,
                    60,  # 与 unified_search 默认 rrf_k 对齐
                    as_of=as_of,
                )
            else:
                # 线性加权模式（向后兼容）
                results = await self._linear_weighted_search(
                    session,
                    corpus_id,
                    app_name,
                    query_embedding,
                    query_text,
                    limit,
                    graph_depth,
                    semantic_weight,
                    graph_weight,
                )

        logger.debug(
            "hybrid_search_completed",
            corpus_id=str(corpus_id),
            result_count=len(results),
            mode="rrf" if (rrf_k or as_of) else "linear",
            as_of=as_of.isoformat() if as_of else None,
        )

        return results

    async def _rrf_search(
        self,
        session: AsyncSession,
        corpus_id: UUID,
        app_name: str,
        query_embedding: list[float],
        query_text: str,
        limit: int,
        rrf_k: int,
        as_of: datetime | None = None,
    ) -> list[GraphSearchResult]:
        """RRF 混合检索：score(d) = Σ 1/(k + rank_i(d))。

        ``as_of`` 提供时通过 EXISTS 子查询将实体集限制为"在该时刻仍至少有一条
        有效关系"的实体，与图谱时态语义对齐。
        """
        import json as _json

        schema = self._schema

        # 时态过滤：as_of 时通过 EXISTS 子查询排除"在该时刻无任何有效关系"的实体
        temporal_exists = ""
        if as_of:
            temporal_exists = (
                f"\n              AND EXISTS (SELECT 1 FROM {schema}.kg_relations r "
                f"WHERE (r.source_id = e.id OR r.target_id = e.id) "
                f"AND r.is_active = true AND {_temporal_where_clause('r')})"
            )

        # 1. 语义排序：基于向量相似度
        semantic_query = text(f"""
            SELECT e.id, e.name, e.entity_type, e.confidence, e.description,
                   e.metadata as properties,
                   1 - (e.embedding <=> :embedding::vector) as semantic_score
            FROM {schema}.kg_entities e
            WHERE e.corpus_id = :corpus_id AND e.is_active = true
              AND e.embedding IS NOT NULL{temporal_exists}
            ORDER BY e.embedding <=> :embedding::vector
            LIMIT :limit * 2
        """)

        sem_params: dict[str, Any] = {
            "corpus_id": str(corpus_id),
            "embedding": _json.dumps(query_embedding),
            "limit": limit,
        }
        if as_of:
            sem_params["as_of"] = as_of

        sem_result = await session.execute(semantic_query, sem_params)

        # 收集语义排名
        entity_data: dict[str, dict[str, Any]] = {}
        sem_rank: dict[str, int] = {}
        for i, row in enumerate(sem_result, start=1):
            eid = str(row.id)
            sem_rank[eid] = i
            entity_data[eid] = {
                "name": row.name,
                "entity_type": row.entity_type,
                "confidence": row.confidence,
                "description": row.description,
                "properties": row.properties or {},
                "semantic_score": float(row.semantic_score),
            }

        if not entity_data:
            return []

        # 2. 图排序：基于 importance_score (PageRank)
        graph_query = text(f"""
            SELECT e.id, e.name, e.importance_score
            FROM {schema}.kg_entities e
            WHERE e.corpus_id = :corpus_id AND e.is_active = true
              AND e.importance_score IS NOT NULL{temporal_exists}
            ORDER BY e.importance_score DESC
            LIMIT :limit * 2
        """)

        graph_params: dict[str, Any] = {"corpus_id": str(corpus_id), "limit": limit}
        if as_of:
            graph_params["as_of"] = as_of

        graph_result = await session.execute(graph_query, graph_params)

        graph_rank: dict[str, int] = {}
        for i, row in enumerate(graph_result, start=1):
            eid = str(row.id)
            graph_rank[eid] = i
            imp_score = float(row.importance_score) if row.importance_score else 0.0
            if eid not in entity_data:
                entity_data[eid] = {
                    "name": row.name,
                    "entity_type": "",
                    "confidence": 0,
                    "description": None,
                    "properties": {},
                    "semantic_score": 0.0,
                    "importance_score": imp_score,
                }
            else:
                entity_data[eid]["importance_score"] = imp_score

        # 3. RRF 融合
        rrf_scores: dict[str, float] = {}
        for eid in entity_data:
            score = 0.0
            if eid in sem_rank:
                score += 1.0 / (rrf_k + sem_rank[eid])
            if eid in graph_rank:
                score += 1.0 / (rrf_k + graph_rank[eid])
            rrf_scores[eid] = score

        # 4. 排序并构建结果
        sorted_ids = sorted(rrf_scores, key=rrf_scores.get, reverse=True)[:limit]

        results = []
        for eid in sorted_ids:
            data = entity_data[eid]
            entity = GraphNode(
                id=f"entity:{eid}",
                label=data["name"],
                node_type=data.get("entity_type"),
                metadata=data.get("properties", {}),
            )
            results.append(
                GraphSearchResult(
                    entity=entity,
                    semantic_score=data.get("semantic_score", 0),
                    graph_score=float(entity_data[eid].get("importance_score", 0) or 0),
                    combined_score=rrf_scores[eid],
                )
            )

        return results

    async def _linear_weighted_search(
        self,
        session: AsyncSession,
        corpus_id: UUID,
        app_name: str,
        query_embedding: list[float],
        query_text: str,
        limit: int,
        graph_depth: int,
        semantic_weight: float,
        graph_weight: float,
    ) -> list[GraphSearchResult]:
        """线性加权混合检索（向后兼容）"""
        import json as _json

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

        result = await session.execute(
            query,
            {
                "corpus_id": str(corpus_id),
                "app_name": app_name,
                "query": query_text,
                "embedding": _json.dumps(query_embedding),
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
        as_of: datetime | None = None,
    ) -> KnowledgeGraphPayload:
        """获取完整图谱

        优先从 kg_entities + kg_relations 一等公民表读取。
        若一等公民表为空（旧数据迁移前），回退到 knowledge.metadata JSONB。
        ``as_of`` 提供时仅返回在该时刻有效的关系（节点保留全集；连接被过滤
        的孤立节点会被自然剔除，因为 _load_graph_from_first_class_tables 仅
        保留两端实体在结果中的边）。
        """
        session = await self._get_session()

        # 尝试从一等公民表读取
        nodes, edges = await self._load_graph_from_first_class_tables(
            session,
            corpus_id,
            app_name,
            as_of=as_of,
        )

        # 回退：从 knowledge.metadata JSONB 读取（兼容旧数据）
        if not nodes:
            # JSONB 回退路径不支持时态过滤（旧数据无 valid_from/valid_to）
            nodes, edges = await self._load_graph_from_jsonb(
                session,
                corpus_id,
                app_name,
            )

        logger.info(
            "graph_loaded",
            corpus_id=str(corpus_id),
            node_count=len(nodes),
            edge_count=len(edges),
        )

        return KnowledgeGraphPayload(nodes=nodes, edges=edges)

    async def _load_graph_from_first_class_tables(
        self,
        session: AsyncSession,
        corpus_id: UUID,
        app_name: str,  # noqa: ARG002 — kg_entities 按 corpus 去重，不受 app 维度约束
        as_of: datetime | None = None,
    ) -> tuple[list[GraphNode], list[GraphEdge]]:
        """从 kg_entities + kg_relations 一等公民表加载图谱

        kg_entities 按 corpus_id 去重存储（同一实体跨 app 合并），
        因此不按 app_name 过滤，与 JSONB 回退路径按 app 过滤的行为不同。
        ``as_of`` 提供时按 valid_from/valid_to 过滤关系。
        """
        # 加载实体
        entities_query = text(f"""
            SELECT id, name, canonical_name, entity_type, confidence,
                   mention_count, description, properties,
                   importance_score, community_id
            FROM {self._schema}.kg_entities
            WHERE corpus_id = :corpus_id AND is_active = true
            ORDER BY mention_count DESC NULLS LAST
        """)

        result = await session.execute(
            entities_query,
            {"corpus_id": str(corpus_id)},
        )

        nodes = []
        entity_ids = set()
        for row in result:
            nodes.append(
                GraphNode(
                    id=f"entity:{row.id}",
                    label=row.name or row.canonical_name,
                    node_type=row.entity_type,
                    metadata={
                        "confidence": row.confidence,
                        "mention_count": row.mention_count,
                        "description": row.description,
                        "importance_score": float(row.importance_score) if row.importance_score else None,
                        "community_id": row.community_id,
                        **(row.properties or {}),
                    },
                )
            )
            entity_ids.add(str(row.id))

        if not nodes:
            return [], []

        # 加载关系（支持时态过滤）
        temporal_filter = ""
        if as_of:
            temporal_filter = f" AND {_temporal_where_clause('r')}"

        relations_query = text(f"""
            SELECT r.source_id, r.target_id, r.relation_type,
                   r.weight, r.confidence, r.evidence_text
            FROM {self._schema}.kg_relations r
            WHERE r.corpus_id = :corpus_id AND r.is_active = true{temporal_filter}
        """)

        rel_params: dict[str, Any] = {"corpus_id": str(corpus_id)}
        if as_of:
            rel_params["as_of"] = as_of

        result = await session.execute(relations_query, rel_params)

        edges = []
        for row in result:
            source_str = str(row.source_id)
            target_str = str(row.target_id)
            # 只包含两端实体都在结果中的边
            if source_str in entity_ids and target_str in entity_ids:
                edges.append(
                    GraphEdge(
                        source=f"entity:{source_str}",
                        target=f"entity:{target_str}",
                        edge_type=row.relation_type,
                        weight=row.weight or 1.0,
                        metadata={
                            "confidence": row.confidence,
                            "evidence": row.evidence_text,
                        },
                    )
                )

        return nodes, edges

    async def _load_graph_from_jsonb(
        self,
        session: AsyncSession,
        corpus_id: UUID,
        app_name: str,
    ) -> tuple[list[GraphNode], list[GraphEdge]]:
        """从 knowledge.metadata JSONB 加载图谱（旧数据回退路径）"""
        entities_query = text(f"""
            SELECT id, content, entity_type, metadata, entity_confidence
            FROM {self._schema}.knowledge
            WHERE corpus_id = :corpus_id
              AND app_name = :app_name
              AND entity_type IS NOT NULL
        """)

        result = await session.execute(
            entities_query,
            {"corpus_id": str(corpus_id), "app_name": app_name},
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

            if row.metadata and "related_entities" in row.metadata:
                for rel in row.metadata["related_entities"]:
                    edges.append(
                        GraphEdge(
                            source=f"entity:{row.id}",
                            target=rel.get("target_id", ""),
                            edge_type=rel.get("relation_type", "RELATED_TO"),
                            weight=rel.get("confidence", 1.0),
                            metadata={"evidence": rel.get("evidence")},
                        )
                    )

        return nodes, edges

    async def find_similar_entities(
        self,
        embedding: list[float],
        corpus_id: UUID,
        entity_type: str,
        threshold: float = 0.92,
        limit: int = 5,
    ) -> list[tuple[str, str, float]]:
        """基于 embedding 的 ANN 实体查找 (Fellegi & Sunter, 1969; Mudgal et al., 2018)

        利用 HNSW 向量索引查找语义相似的实体，仅在 entity_type 相同时比较。

        Returns:
            [(entity_id, entity_name, similarity_score)]
        """
        import json as _json

        session = await self._get_session()

        query = text(f"""
            SELECT id, name, 1 - (embedding <=> :emb::vector) AS similarity
            FROM {self._schema}.kg_entities
            WHERE corpus_id = :cid
              AND entity_type = :type
              AND is_active = true
              AND embedding IS NOT NULL
            ORDER BY embedding <=> :emb::vector
            LIMIT :limit
        """)

        result = await session.execute(
            query,
            {
                "emb": _json.dumps(embedding),
                "cid": str(corpus_id),
                "type": entity_type,
                "limit": limit,
            },
        )

        return [(str(row.id), row.name, float(row.similarity)) for row in result if float(row.similarity) >= threshold]

    async def find_existing_relations(
        self,
        source_id: str,
        target_id: str | None,
        relation_type: str,
        corpus_id: UUID,
    ) -> list[dict[str, Any]]:
        """查找已有关系，供 TemporalResolver 冲突检测使用 (Snodgrass & Ahn, 1985)"""
        session = await self._get_session()
        clean_source = source_id.replace("entity:", "")

        conditions = [
            "source_id = :source_id",
            "relation_type = :rtype",
            "corpus_id = :cid",
            "is_active = true",
        ]
        params: dict[str, Any] = {
            "source_id": clean_source,
            "rtype": relation_type,
            "cid": str(corpus_id),
        }
        if target_id:
            clean_target = target_id.replace("entity:", "")
            conditions.append("target_id = :target_id")
            params["target_id"] = clean_target

        where = " AND ".join(conditions)
        query = text(f"""
            SELECT id, source_id, target_id, relation_type,
                   evidence_text, valid_from, valid_to
            FROM {self._schema}.kg_relations
            WHERE {where}
        """)
        result = await session.execute(query, params)
        return [
            {
                "id": str(row.id),
                "source_id": str(row.source_id),
                "target_id": str(row.target_id),
                "relation_type": row.relation_type,
                "evidence_text": row.evidence_text,
                "valid_from": row.valid_from.isoformat() if row.valid_from else None,
                "valid_to": row.valid_to.isoformat() if row.valid_to else None,
            }
            for row in result
        ]

    async def expire_relations(
        self,
        relation_ids: list[str],
        valid_to: datetime,
    ) -> int:
        """批量将指定关系的 valid_to 设置为给定时间 (Snodgrass & Ahn, 1985)

        Args:
            relation_ids: 需要过期的关系 ID 列表
            valid_to: 过期时间戳

        Returns:
            更新的行数
        """
        if not relation_ids:
            return 0

        session = await self._get_session()

        result = await session.execute(
            text(f"""
                UPDATE {self._schema}.kg_relations
                SET valid_to = :valid_to
                WHERE id = ANY(:ids)
            """),
            {"valid_to": valid_to, "ids": relation_ids},
        )
        await session.commit()

        count = result.rowcount or 0
        logger.info(
            "relations_expired",
            requested=len(relation_ids),
            expired=count,
        )
        return count

    async def clear_graph(
        self,
        corpus_id: UUID,
    ) -> int:
        """清除语料库的图谱数据

        同时清理 kg_entities、kg_relations 一等公民表和 knowledge.metadata JSONB。
        """
        session = await self._get_session()

        # 1. 清理一等公民表
        await session.execute(
            text(f"DELETE FROM {self._schema}.kg_relations WHERE corpus_id = :cid"),
            {"cid": str(corpus_id)},
        )
        entity_result = await session.execute(
            text(f"DELETE FROM {self._schema}.kg_entities WHERE corpus_id = :cid"),
            {"cid": str(corpus_id)},
        )
        entity_count = entity_result.rowcount or 0

        # 2. 重置 knowledge 表的实体字段
        knowledge_result = await session.execute(
            text(f"""
                UPDATE {self._schema}.knowledge
                SET entity_type = NULL,
                    entity_confidence = NULL,
                    metadata = metadata - 'related_entities'
                WHERE corpus_id = :corpus_id
                  AND entity_type IS NOT NULL
            """),
            {"corpus_id": str(corpus_id)},
        )
        knowledge_count = knowledge_result.rowcount or 0

        await session.commit()

        count = max(entity_count, knowledge_count)

        logger.info(
            "graph_cleared",
            corpus_id=str(corpus_id),
            entities_cleared=entity_count,
            knowledge_cleared=knowledge_count,
        )

        return count

    async def get_relation_timeline(
        self,
        corpus_id: UUID,
        bucket: str = "day",
    ) -> list[dict[str, Any]]:
        """聚合 valid_from / valid_to 事件为时间轴密度直方图。"""
        if bucket not in {"day", "week", "month"}:
            raise ValueError(f"unsupported bucket '{bucket}'; expected day|week|month")

        session = await self._get_session()
        # 同一查询返回两组事件密度：
        #   active_count   = COUNT(valid_from at bucket)
        #   expired_count  = COUNT(valid_to at bucket)
        # 通过 FULL OUTER JOIN 合并左右桶，缺失日期填 0；DESC NULLS LAST + LIMIT 让
        # 大语料库不至于返回数千行。
        query = text(f"""
            WITH starts AS (
                SELECT date_trunc(:bucket, valid_from) AS bucket_date,
                       COUNT(*) AS active_count
                FROM {self._schema}.kg_relations
                WHERE corpus_id = :corpus_id AND valid_from IS NOT NULL
                GROUP BY 1
            ),
            ends AS (
                SELECT date_trunc(:bucket, valid_to) AS bucket_date,
                       COUNT(*) AS expired_count
                FROM {self._schema}.kg_relations
                WHERE corpus_id = :corpus_id AND valid_to IS NOT NULL
                GROUP BY 1
            )
            SELECT COALESCE(s.bucket_date, e.bucket_date) AS bucket_date,
                   COALESCE(s.active_count, 0)             AS active_count,
                   COALESCE(e.expired_count, 0)            AS expired_count
            FROM starts s
            FULL OUTER JOIN ends e ON s.bucket_date = e.bucket_date
            ORDER BY bucket_date ASC
        """)

        result = await session.execute(
            query,
            {"corpus_id": str(corpus_id), "bucket": bucket},
        )

        timeline: list[dict[str, Any]] = []
        for row in result:
            if row.bucket_date is None:
                continue
            timeline.append(
                {
                    "date": row.bucket_date.isoformat(),
                    "active_count": int(row.active_count or 0),
                    "expired_count": int(row.expired_count or 0),
                }
            )
        return timeline

    async def create_build_run(
        self,
        app_name: str,
        corpus_id: UUID,
        run_id: str,
        extractor_config: dict[str, Any],
        model_name: str | None = None,
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
        error_message: str | None = None,
        progress_percent: float | None = None,
        warnings: list[dict[str, Any]] | None = None,
        processed_chunk_ids: list[str] | None = None,
    ) -> None:
        """更新构建运行状态

        Args:
            progress_percent: 构建进度 0.0-1.0，用于前端进度条 (Nygard, 2018)
            warnings: 非致命警告列表（如 PageRank 收敛失败）
            processed_chunk_ids: 增量构建已处理的 chunk ID 列表
        """
        import json as _json

        session = await self._get_session()

        query = text(f"""
            UPDATE {self._schema}.kg_build_runs
            SET status = :status,
                entity_count = :entity_count,
                relation_count = :relation_count,
                error_message = :error_message,
                progress_percent = COALESCE(:progress, progress_percent),
                warnings = COALESCE(:warnings::jsonb, warnings),
                processed_chunk_ids = COALESCE(:chunk_ids::jsonb, processed_chunk_ids),
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
                "progress": progress_percent,
                "warnings": _json.dumps(warnings) if warnings else None,
                "chunk_ids": _json.dumps(processed_chunk_ids) if processed_chunk_ids else None,
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

    async def get_processed_chunk_ids(
        self,
        corpus_id: UUID,
        app_name: str,
    ) -> set[str]:
        """获取最近一次成功构建已处理的 chunk ID 集合 (Hogan et al., 2021 §6.3)"""
        session = await self._get_session()

        query = text(f"""
            SELECT processed_chunk_ids
            FROM {self._schema}.kg_build_runs
            WHERE corpus_id = :corpus_id
              AND app_name = :app_name
              AND status = 'completed'
              AND processed_chunk_ids IS NOT NULL
            ORDER BY completed_at DESC
            LIMIT 1
        """)

        result = await session.execute(
            query,
            {"corpus_id": str(corpus_id), "app_name": app_name},
        )
        row = result.fetchone()
        if row and row.processed_chunk_ids:
            return set(row.processed_chunk_ids)
        return set()

    async def get_build_runs(
        self,
        corpus_id: UUID,
        app_name: str,
        limit: int = 20,
    ) -> list[BuildRunRecord]:
        """获取构建运行历史"""
        session = await self._get_session()

        query = text(f"""
            SELECT id, app_name, corpus_id, run_id, status,
                   entity_count, relation_count, extractor_config, model_name,
                   error_message, started_at, completed_at, created_at,
                   progress_percent, warnings
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
                progress_percent=float(row.progress_percent) if row.progress_percent else 0.0,
                warnings=row.warnings if row.warnings else None,
            )
            runs.append(run)

        return runs


# ============================================================================
# Factory Function
# ============================================================================


def get_graph_repository(session: AsyncSession | None = None) -> GraphRepository:
    """获取图谱存储实例

    Args:
        session: 可选的数据库会话

    Returns:
        GraphRepository 实例
    """
    return AgeGraphRepository(session=session)
