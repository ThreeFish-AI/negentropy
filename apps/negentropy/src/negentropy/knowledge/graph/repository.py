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
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import UTC, datetime
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

# get_relation_timeline 单次返回的最大桶数 — day≈2 年 / week≈14 年 / month≈60 年。
# 选 730 是因为前端 TimeTravelSlider 把每个桶渲染为一根柱形 + 一个 slider 步进，
# 跨数年关系若不设限会一次性吐 1000+ 行，主线程会卡顿；超过该上限时仅展示最近 N 桶，
# 早期事件需要时再开放 from/to 参数（TODO，与产品协商上限策略）。
_TIMELINE_BUCKET_CAP = 730


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
    updated_at: datetime | None = None
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
        query_embedding: list[float] | None,
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
            query_embedding: 查询向量（None 时退化为纯图检索）
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
        human_run_id: str | None = None,
    ) -> None:
        """更新构建运行状态

        Args:
            run_id: 运行记录 ID（DB PK，UUID）
            status: 新状态
            entity_count: 实体数量
            relation_count: 关系数量
            error_message: 错误信息
            human_run_id: 人类可读 run_id（``build-<hex>-<ts>``），仅用于日志补全。
        """
        pass

    @abstractmethod
    async def get_latest_build_run(
        self,
        corpus_id: UUID,
        app_name: str,
        *,
        only_active: bool = False,
    ) -> BuildRunRecord | None:
        """获取最新一次构建记录（P3-1 SSE 进度订阅入口）"""
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

    @asynccontextmanager
    async def _session_scope(self) -> AsyncIterator[AsyncSession]:
        """获取数据库会话（上下文管理器形式，确保连接归还到池）。

        历史问题（PR-XXX）：旧版 ``_get_session`` 在 ``async with AsyncSessionLocal()
        as session:`` 块内 ``return session`` —— ``async with`` 在函数返回时立即退出，
        但 ``session`` 引用被外泄给调用方继续使用，导致底层连接未正确归还，触发
        ``AsyncAdaptedQueuePool: garbage collector is trying to clean up
        non-checked-in connection`` 警告，并在大批量构建（849 chunk × 多关系）时
        耗尽连接池，使后续 ``update_build_run`` / pagerank / community 等步骤 hang。

        修复：改为 ``@asynccontextmanager``，调用方使用 ``async with self._session_scope()
        as session:``，退出时自动 close + release。注入模式（``self._session != None``）
        保持不接管生命周期，由调用方负责。
        """
        if self._session is not None:
            # 注入模式：外部 session 由调用方管理，不接管生命周期
            yield self._session
            return
        async with AsyncSessionLocal() as session:
            yield session

    async def create_entity(
        self,
        entity: GraphNode,
        corpus_id: UUID,
    ) -> str:
        """创建实体节点

        将实体信息存储到 knowledge 表，并创建 Apache AGE 节点。

        SQL 占位符注意事项：
            ``:metadata::jsonb`` 这种「命名参数紧邻 PostgreSQL ``::`` cast 操作符」
            的写法会破坏 SQLAlchemy 命名参数边界识别，导致 ``:metadata`` 未被翻译为
            ``$N`` 而是原样发给 asyncpg，触发 ``syntax error at or near ":"``。
            修复：改用 ``CAST(:metadata AS jsonb)`` —— CAST 函数边界清晰，与项目
            ``update_build_run`` 等既有写法保持一致（参见 1804 行 ``CAST(:warnings AS json)``）。
        """
        import json as _json

        # 更新 knowledge 表的实体字段
        confidence = entity.metadata.get("confidence", 1.0)

        query = text(f"""
            UPDATE {self._schema}.knowledge
            SET entity_type = :entity_type,
                entity_confidence = :confidence,
                metadata = COALESCE(metadata, '{{}}'::jsonb) || CAST(:metadata AS jsonb)
            WHERE id = :entity_id
        """)

        async with self._session_scope() as session:
            await session.execute(
                query,
                {
                    "entity_id": entity.id.replace("entity:", ""),
                    "entity_type": entity.node_type,
                    "confidence": confidence,
                    "metadata": _json.dumps({"graph_label": entity.label}),
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
        """批量创建实体节点（单 Session 批量提交，消除逐条连接池抖动）

        SQL 占位符注意事项参见 :py:meth:`create_entity` 文档：
        ``CAST(:metadata AS jsonb)`` 取代 ``:metadata::jsonb`` 以规避 SQLAlchemy
        命名参数边界识别异常；参数值必须用 ``json.dumps`` 序列化为合法 JSON 字符串
        （而非 Python ``str(dict)`` 的单引号形式，否则 ``CAST`` 会再次报语法错误）。
        """
        if not entities:
            return []

        import json as _json

        query = text(f"""
            UPDATE {self._schema}.knowledge
            SET entity_type = :entity_type,
                entity_confidence = :confidence,
                metadata = COALESCE(metadata, '{{}}'::jsonb) || CAST(:metadata AS jsonb)
            WHERE id = :entity_id
        """)

        ids = []
        params_list = []
        for entity in entities:
            confidence = entity.metadata.get("confidence", 1.0)
            params_list.append(
                {
                    "entity_id": entity.id.replace("entity:", ""),
                    "entity_type": entity.node_type,
                    "confidence": confidence,
                    "metadata": _json.dumps({"graph_label": entity.label}),
                }
            )
            ids.append(entity.id)

        async with self._session_scope() as session:
            for params in params_list:
                await session.execute(query, params)
            await session.commit()

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
        """创建单条关系边（委托给 _create_relation_with_session）"""
        async with self._session_scope() as session:
            rid = await self._create_relation_with_session(session, source_id, target_id, relation)
            await session.commit()
            return rid

    async def _create_relation_with_session(
        self,
        session: AsyncSession,
        source_id: str,
        target_id: str,
        relation: GraphEdge,
    ) -> str:
        """在给定 Session 上创建关系边（批量场景复用同一 Session）

        写入 kg_relations 一等公民表（SSoT），同时保留 knowledge.metadata JSONB
        作为过渡期兼容。参见 Kleppmann §11 事务内双写模式。

        ON CONFLICT DO UPDATE（而非 DO NOTHING）：唯一约束 (source_id, target_id,
        relation_type) 命中时必须原地覆盖 evidence/weight/confidence。若使用
        DO NOTHING，evidence 变更后 INSERT 会被静默丢弃，叠加 TemporalResolver
        的 expire 流程会导致关系被彻底抹除（既无新行又无有效旧行）。
        """
        import json as _json

        clean_source = source_id.replace("entity:", "")
        clean_target = target_id.replace("entity:", "")
        confidence = relation.metadata.get("confidence", 1.0)
        evidence = relation.metadata.get("evidence")

        # SQL 占位符注意事项：``:metadata::jsonb`` / ``:related::jsonb`` 命名参数紧邻
        # ``::`` cast 会破坏 SQLAlchemy 命名参数边界识别（asyncpg 报 ``syntax error at or
        # near ":"``）。统一改为 ``CAST(:name AS jsonb)``，与 ``update_build_run`` 等既有
        # 写法保持一致。
        insert_query = text(f"""
            INSERT INTO {self._schema}.kg_relations
                (source_id, target_id, corpus_id, app_name, relation_type,
                 weight, confidence, evidence_text, metadata, is_active)
            SELECT :source_id, :target_id, k.corpus_id, k.app_name,
                   :relation_type, :weight, :confidence, :evidence, CAST(:metadata AS jsonb), true
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

        select_query = text(f"""
            SELECT metadata->'related_entities' as related
            FROM {self._schema}.knowledge
            WHERE id = :source_id
        """)

        update_query = text(f"""
            UPDATE {self._schema}.knowledge
            SET metadata = COALESCE(metadata, '{{}}'::jsonb) ||
                          jsonb_build_object('related_entities', CAST(:related AS jsonb))
            WHERE id = :source_id
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

        # 过渡期：同时写入 JSONB（兼容旧读取路径）
        relation_data = {
            "target_id": clean_target,
            "relation_type": relation.edge_type,
            "confidence": confidence,
            "evidence": evidence,
        }

        result = await session.execute(select_query, {"source_id": clean_source})
        row = result.fetchone()

        related_entities = []
        if row and row.related:
            related_entities = _json.loads(row.related) if isinstance(row.related, str) else row.related

        related_entities.append(relation_data)

        await session.execute(
            update_query,
            {
                "source_id": clean_source,
                "related": _json.dumps(related_entities),
            },
        )

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
        """批量创建关系边（单 Session 批量提交，消除逐条连接池抖动）"""
        if not relations:
            return []

        ids = []
        async with self._session_scope() as session:
            for relation in relations:
                rid = await self._create_relation_with_session(
                    session,
                    relation.source,
                    relation.target,
                    relation,
                )
                ids.append(rid)
            await session.commit()

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
        clean_id = entity_id.replace("entity:", "")

        # 时态过滤片段 (Snodgrass & Ahn, 1985) — 委托模块级 helper
        temporal_filter = ""
        if as_of:
            temporal_filter = f"\n                AND {_temporal_where_clause('r')}"

        query = text(f"""
            WITH RECURSIVE neighbor_tree AS (
                -- Base: direct neighbors of the seed entity (both directions)
                SELECT
                    CASE WHEN r.source_id = :entity_id THEN r.target_id ELSE r.source_id END AS neighbor_id,
                    r.source_id AS via_id,
                    1 AS distance,
                    ARRAY[:entity_id,
                          CASE WHEN r.source_id = :entity_id THEN r.target_id ELSE r.source_id END] AS visited
                FROM {self._schema}.kg_relations r
                WHERE (r.source_id = :entity_id OR r.target_id = :entity_id)
                  AND r.is_active = true{temporal_filter}

                UNION ALL

                -- Recursive: expand from known neighbors (both directions)
                SELECT
                    CASE WHEN r.source_id = nt.neighbor_id THEN r.target_id ELSE r.source_id END AS neighbor_id,
                    r.source_id AS via_id,
                    nt.distance + 1 AS distance,
                    nt.visited || CASE WHEN r.source_id = nt.neighbor_id THEN r.target_id ELSE r.source_id END
                FROM {self._schema}.kg_relations r
                JOIN neighbor_tree nt ON (r.source_id = nt.neighbor_id OR r.target_id = nt.neighbor_id)
                WHERE r.is_active = true{temporal_filter}
                  AND nt.distance < :max_depth
                  AND CASE WHEN r.source_id = nt.neighbor_id
                        THEN r.target_id ELSE r.source_id END != ALL(nt.visited)
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

        async with self._session_scope() as session:
            result = await session.execute(query, params)
            rows = list(result)

        neighbors = []
        for row in rows:
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

        async with self._session_scope() as session:
            result = await session.execute(query, params)
            rows = list(result)

        return [
            {
                "id": f"entity:{row.id}",
                "name": row.name,
                "type": row.entity_type,
                "relation": row.relation_type,
                "evidence": row.evidence_text or "",
            }
            for row in rows
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
                -- Base: all edges from source (both directions)
                SELECT
                    CASE WHEN source_id = :source_id THEN source_id ELSE target_id END AS source_id,
                    CASE WHEN source_id = :source_id THEN target_id ELSE source_id END AS target_id,
                    ARRAY[:source_id] AS path,
                    1 AS depth
                FROM {self._schema}.kg_relations
                WHERE (source_id = :source_id OR target_id = :source_id)
                  AND is_active = true{temporal_base}

                UNION ALL

                -- Recursive: expand edges from current frontier (both directions)
                SELECT
                    CASE WHEN r.source_id = ps.target_id THEN r.source_id ELSE r.target_id END,
                    CASE WHEN r.source_id = ps.target_id THEN r.target_id ELSE r.source_id END,
                    ps.path || ps.target_id,
                    ps.depth + 1
                FROM {self._schema}.kg_relations r
                JOIN path_search ps ON (r.source_id = ps.target_id OR r.target_id = ps.target_id)
                WHERE r.is_active = true
                  AND ps.depth < :max_depth
                  AND CASE WHEN r.source_id = ps.target_id
                        THEN r.target_id ELSE r.source_id END != ALL(ps.path){temporal_recur}
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

        async with self._session_scope() as session:
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
        query_embedding: list[float] | None,
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

        async with self._session_scope() as session:
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
        query_embedding: list[float] | None,
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

        # 1. 语义排序：基于向量相似度（embedding 不可用时跳过）
        entity_data: dict[str, dict[str, Any]] = {}
        sem_rank: dict[str, int] = {}

        if query_embedding is None:
            # embedding 不可用时退化为纯图结构排序（与 linear 方法一致）。
            # 直接按 importance_score 返回，避免把同一信号同时塞进 sem_rank 与
            # graph_rank 让 RRF 融合 1/(k+r)+1/(k+r) 退化为单信号 + 常数缩放、
            # 错误地暴露"双通道融合"指标。
            fallback_query = text(f"""
                SELECT e.id, e.name, e.entity_type, e.confidence, e.description,
                       e.properties,
                       COALESCE(e.importance_score, 0) AS importance_score
                FROM {schema}.kg_entities e
                WHERE e.corpus_id = :corpus_id AND e.is_active = true{temporal_exists}
                ORDER BY e.importance_score DESC NULLS LAST
                LIMIT :limit
            """)
            fb_params: dict[str, Any] = {
                "corpus_id": str(corpus_id),
                "limit": limit,
            }
            if as_of:
                fb_params["as_of"] = as_of
            fb_result = await session.execute(fallback_query, fb_params)
            results: list[GraphSearchResult] = []
            for row in fb_result:
                imp = float(row.importance_score or 0)
                entity = GraphNode(
                    id=f"entity:{row.id}",
                    label=row.name,
                    node_type=row.entity_type,
                    metadata=row.properties or {},
                )
                results.append(
                    GraphSearchResult(
                        entity=entity,
                        semantic_score=0.0,
                        graph_score=imp,
                        combined_score=imp,
                    )
                )
            return results
        else:
            semantic_query = text(f"""
                SELECT e.id, e.name, e.entity_type, e.confidence, e.description,
                       e.properties,
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
        query_embedding: list[float] | None,
        query_text: str,
        limit: int,
        graph_depth: int,
        semantic_weight: float,
        graph_weight: float,
    ) -> list[GraphSearchResult]:
        """线性加权混合检索（向后兼容）"""
        import json as _json

        if query_embedding is None:
            # embedding 不可用时，退化为纯图结构排序
            query = text(f"""
                SELECT e.id, e.name, e.entity_type, e.confidence, e.description,
                       e.properties, e.importance_score,
                       0.0 AS semantic_score,
                       COALESCE(e.importance_score, 0) AS graph_score,
                       COALESCE(e.importance_score, 0) AS combined_score
                FROM {self._schema}.kg_entities e
                WHERE e.corpus_id = :corpus_id AND e.is_active = true
                ORDER BY e.importance_score DESC NULLS LAST
                LIMIT :limit
            """)
            result = await session.execute(
                query,
                {
                    "corpus_id": str(corpus_id),
                    "limit": limit,
                },
            )
            results = []
            for row in result:
                entity = GraphNode(
                    id=f"entity:{row.id}",
                    label=row.name,
                    node_type=row.entity_type,
                    metadata=row.properties or {},
                )
                results.append(
                    GraphSearchResult(
                        entity=entity,
                        semantic_score=0.0,
                        graph_score=float(row.importance_score or 0),
                        combined_score=float(row.importance_score or 0),
                    )
                )
            return results

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
        async with self._session_scope() as session:
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

        async with self._session_scope() as session:
            result = await session.execute(
                query,
                {
                    "emb": _json.dumps(embedding),
                    "cid": str(corpus_id),
                    "type": entity_type,
                    "limit": limit,
                },
            )
            rows = list(result)

        return [(str(row.id), row.name, float(row.similarity)) for row in rows if float(row.similarity) >= threshold]

    async def find_existing_relations(
        self,
        source_id: str,
        target_id: str | None,
        relation_type: str,
        corpus_id: UUID,
    ) -> list[dict[str, Any]]:
        """查找已有关系，供 TemporalResolver 冲突检测使用 (Snodgrass & Ahn, 1985)"""
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

        async with self._session_scope() as session:
            result = await session.execute(query, params)
            rows = list(result)

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
            for row in rows
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

        async with self._session_scope() as session:
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
        async with self._session_scope() as session:
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

        # 同一查询返回两组事件密度：
        #   active_count   = COUNT(valid_from at bucket)
        #   expired_count  = COUNT(valid_to at bucket)
        # 通过 FULL OUTER JOIN 合并左右桶，缺失日期填 0；按 bucket_date 降序取最近
        # _TIMELINE_BUCKET_CAP 个桶，防止跨数年关系一次拉回数千点拖垮前端
        # TimeTravelSlider；最后在 Python 侧反转回升序，保持调用方语义不变。
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
            ORDER BY bucket_date DESC NULLS LAST
            LIMIT :limit
        """)

        async with self._session_scope() as session:
            result = await session.execute(
                query,
                {"corpus_id": str(corpus_id), "bucket": bucket, "limit": _TIMELINE_BUCKET_CAP},
            )
            rows = list(result)

        timeline: list[dict[str, Any]] = []
        for row in rows:
            if row.bucket_date is None:
                continue
            timeline.append(
                {
                    "date": row.bucket_date.isoformat(),
                    "active_count": int(row.active_count or 0),
                    "expired_count": int(row.expired_count or 0),
                }
            )
        # SQL 取出来时是 DESC（拿最近 N 个桶），调用方期望 ASC，本地反转一次即可。
        timeline.reverse()
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

        run_uuid = uuid.uuid4()

        query = text(f"""
            INSERT INTO {self._schema}.kg_build_runs
                (id, app_name, corpus_id, run_id, status, extractor_config, model_name, started_at, updated_at)
            VALUES
                (:id, :app_name, :corpus_id, :run_id, 'running', CAST(:config AS jsonb), :model, NOW(), NOW())
        """)

        async with self._session_scope() as session:
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

        # 双字段日志：``run_uuid`` 为 DB PK，``run_id`` 为人类可读 ``build-<hex>-<ts>``。
        # 与 ``build_run_updated`` 字段命名保持一致，便于跨日志检索。
        logger.info(
            "build_run_created",
            run_uuid=str(run_uuid),
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
        human_run_id: str | None = None,
    ) -> None:
        """更新构建运行状态。

        状态机不变量（ISSUE-080）：
        - 终态写入（``completed`` / ``failed`` / ``cancelled``）永远允许；
        - 非终态写入（如 ``running`` 进度上报）仅当 DB 当前**不在终态/cancelling** 时
          才生效。这避免 build task 的进度上报把取消 API 已写入的 ``cancelling``
          状态回滚为 ``running``，导致 watchdog 命中失败、跨 worker DB 兜底失明、
          UI 永远卡 CANCELLING 的连锁缺陷。
        - ``completed_at`` 仅在写入终态时设为 ``NOW()``；非终态保留旧值，避免
          被错误清零（既影响 watchdog 阈值计算，也丢失 cancel 请求时间锚）。

        参考: M. Kleppmann, *Designing Data-Intensive Applications*, ch. 9 §9.4 —
        以 DB 为权威协调源时，状态机迁移合法性必须在 SQL 层显式守护，避免
        多写入路径（cancel API、build task heartbeat、watchdog）形成竞态覆盖。

        Args:
            progress_percent: 构建进度 0.0-1.0，用于前端进度条 (Nygard, 2018)
            warnings: 非致命警告列表（如 PageRank 收敛失败）
            processed_chunk_ids: 增量构建已处理的 chunk ID 列表
            human_run_id: 人类可读的 run_id（``build-<short>-<ts>``）。仅用于日志
                字段补全；DB 写入仍以 UUID PK 为准。传入后 ``build_run_updated`` 与
                ``build_run_update_skipped_by_state_guard`` 同时输出 ``run_uuid`` +
                ``run_id`` 双字段，串联 service.py 层的人类可读 run_id 与 repository
                层的 DB PK，便于跨日志与跨 worker 排障。
        """
        import json as _json

        # WHERE 子句守卫状态机：
        # - 终态写入（含 cancel 异常处理路径）无条件允许；
        # - 非终态写入要求 DB 当前不在终态/cancelling，否则零行 UPDATE 静默忽略。
        query = text(f"""
            UPDATE {self._schema}.kg_build_runs
            SET status = :status,
                entity_count = :entity_count,
                relation_count = :relation_count,
                error_message = :error_message,
                progress_percent = COALESCE(:progress, progress_percent),
                warnings = COALESCE(CAST(:warnings AS json), warnings),
                processed_chunk_ids = COALESCE(CAST(:chunk_ids AS json), processed_chunk_ids),
                updated_at = NOW(),
                completed_at = CASE
                    WHEN CAST(:status AS varchar) IN (
                        'completed', 'completed_with_errors', 'failed', 'cancelled'
                    ) THEN NOW()
                    ELSE completed_at
                END
            WHERE id = :run_id
              AND (
                CAST(:status AS varchar) IN ('completed', 'completed_with_errors', 'failed', 'cancelled')
                OR status NOT IN ('completed', 'completed_with_errors', 'failed', 'cancelled', 'cancelling')
              )
        """)

        async with self._session_scope() as session:
            result = await session.execute(
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
            rowcount = result.rowcount or 0

        if rowcount == 0:
            # 零行 UPDATE：通常意味着 DB 已在终态/cancelling 且本次为非终态写入，
            # 这是状态机守卫的正常拒绝路径；以 debug 级保留观测线索，便于 cancel 链路排查。
            logger.debug(
                "build_run_update_skipped_by_state_guard",
                run_uuid=str(run_id),
                run_id=human_run_id,
                attempted_status=status,
            )
            return

        # 双字段日志：``run_uuid`` 为 DB PK（持久化主键），``run_id`` 为人类可读
        # ``build-<hex>-<ts>``（service 层局部变量名），便于跨日志/跨 worker 串联。
        logger.info(
            "build_run_updated",
            run_uuid=str(run_id),
            run_id=human_run_id,
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
        query = text(f"""
            SELECT processed_chunk_ids
            FROM {self._schema}.kg_build_runs
            WHERE corpus_id = :corpus_id
              AND app_name = :app_name
              AND status IN ('completed', 'completed_with_errors')
              AND processed_chunk_ids IS NOT NULL
            ORDER BY completed_at DESC
            LIMIT 1
        """)

        async with self._session_scope() as session:
            result = await session.execute(
                query,
                {"corpus_id": str(corpus_id), "app_name": app_name},
            )
            row = result.fetchone()

        if row and row.processed_chunk_ids:
            return set(row.processed_chunk_ids)
        return set()

    async def get_latest_build_run(
        self,
        corpus_id: UUID,
        app_name: str,
        *,
        only_active: bool = False,
    ) -> BuildRunRecord | None:
        """获取该 corpus 最新一次构建运行（按 created_at DESC 排序）。

        Args:
            only_active: 仅返回 status in ('pending', 'running') 的活跃 run（用于 SSE 订阅入口）。

        参考：P3-1 SSE 进度推送依赖此查询定位 paper_kg_pipeline 刚 enqueue 的后台 build。
        """
        status_filter = "AND status IN ('pending', 'running')" if only_active else ""
        query = text(f"""
            SELECT id, app_name, corpus_id, run_id, status,
                   entity_count, relation_count, extractor_config, model_name,
                   error_message, started_at, completed_at, created_at,
                   progress_percent, warnings
            FROM {self._schema}.kg_build_runs
            WHERE corpus_id = :corpus_id AND app_name = :app_name
              {status_filter}
            ORDER BY created_at DESC
            LIMIT 1
        """)

        async with self._session_scope() as session:
            result = await session.execute(
                query,
                {"corpus_id": str(corpus_id), "app_name": app_name},
            )
            row = result.fetchone()

        if row is None:
            return None
        return BuildRunRecord(
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

    async def get_build_runs(
        self,
        corpus_id: UUID,
        app_name: str,
        limit: int = 20,
    ) -> list[BuildRunRecord]:
        """获取构建运行历史"""
        query = text(f"""
            SELECT id, app_name, corpus_id, run_id, status,
                   entity_count, relation_count, extractor_config, model_name,
                   error_message, started_at, completed_at, created_at, updated_at,
                   progress_percent, warnings
            FROM {self._schema}.kg_build_runs
            WHERE corpus_id = :corpus_id AND app_name = :app_name
            ORDER BY created_at DESC
            LIMIT :limit
        """)

        async with self._session_scope() as session:
            result = await session.execute(
                query,
                {
                    "corpus_id": str(corpus_id),
                    "app_name": app_name,
                    "limit": limit,
                },
            )
            rows = list(result)

        runs = []
        for row in rows:
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
                updated_at=row.updated_at,
                progress_percent=float(row.progress_percent) if row.progress_percent else 0.0,
                warnings=row.warnings if row.warnings else None,
            )
            runs.append(run)

        return runs

    async def get_build_run_by_run_id(
        self,
        run_id: str,
        app_name: str,
    ) -> BuildRunRecord | None:
        """按业务 `run_id`（非 UUID 主键）查找构建记录。

        cancel API 收到前端的 run_id（形如 `build-xxx-timestamp`），需要根据它定位
        kg_build_runs 行。
        """
        query = text(f"""
            SELECT id, app_name, corpus_id, run_id, status,
                   entity_count, relation_count, extractor_config, model_name,
                   error_message, started_at, completed_at, created_at, updated_at,
                   progress_percent, warnings
            FROM {self._schema}.kg_build_runs
            WHERE run_id = :run_id AND app_name = :app_name
            LIMIT 1
        """)
        async with self._session_scope() as session:
            result = await session.execute(
                query,
                {"run_id": run_id, "app_name": app_name},
            )
            row = result.fetchone()
        if row is None:
            return None
        return BuildRunRecord(
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
            updated_at=row.updated_at,
            progress_percent=float(row.progress_percent) if row.progress_percent else 0.0,
            warnings=row.warnings if row.warnings else None,
        )

    async def request_build_run_cancel(
        self,
        run_id: str,
        app_name: str,
        *,
        cancellation_meta: dict[str, Any],
    ) -> tuple[str, BuildRunRecord | None]:
        """对 KG Build Run 发起取消（条件 UPDATE，规避 race）。

        与 `KnowledgeRunDao.request_pipeline_run_cancel` 同思路：
        - WHERE status NOT IN ('completed','failed','cancelled')；
        - pending → cancelled（task 尚未启动 / 极少出现因 KG build 是同步入口）；
        - running → cancelling；
        - cancelling → noop；
        - 元数据写入 warnings JSONB 末尾的 _cancellation 条目（与 _phase / _metrics
          同型 sentinel 模式，避免 alembic 迁移）。

        Returns:
            (status, record):
            - `("not_found", None)`
            - `("terminal", record)`：完成/失败/已取消
            - `("noop", record)`：已 cancelling
            - `("cancelled", record)`：pending → cancelled
            - `("cancelling", record)`：running → cancelling
        """
        import json as _json

        async with self._session_scope() as session:
            select_stmt = text(f"""
                SELECT id, status, warnings, app_name, corpus_id, run_id,
                       entity_count, relation_count, extractor_config, model_name,
                       error_message, started_at, completed_at, created_at, updated_at, progress_percent
                FROM {self._schema}.kg_build_runs
                WHERE run_id = :run_id AND app_name = :app_name
                FOR UPDATE
            """)
            row = (await session.execute(select_stmt, {"run_id": run_id, "app_name": app_name})).fetchone()
            if row is None:
                return ("not_found", None)

            current_status = (row.status or "").lower()
            existing_warnings = list(row.warnings or [])

            def _to_record(updated_status: str, updated_warnings: list, completed_at_override=None) -> BuildRunRecord:
                return BuildRunRecord(
                    id=row.id,
                    app_name=row.app_name,
                    corpus_id=row.corpus_id,
                    run_id=row.run_id,
                    status=updated_status,
                    entity_count=row.entity_count,
                    relation_count=row.relation_count,
                    extractor_config=row.extractor_config or {},
                    model_name=row.model_name,
                    error_message=row.error_message,
                    started_at=row.started_at,
                    completed_at=completed_at_override if completed_at_override is not None else row.completed_at,
                    created_at=row.created_at,
                    updated_at=row.updated_at,
                    progress_percent=float(row.progress_percent) if row.progress_percent else 0.0,
                    warnings=updated_warnings or None,
                )

            if current_status in ("completed", "failed", "cancelled"):
                return ("terminal", _to_record(row.status, existing_warnings))
            if current_status == "cancelling":
                return ("noop", _to_record(row.status, existing_warnings))

            new_status = "cancelled" if current_status == "pending" else "cancelling"
            new_warnings = list(existing_warnings) + [{"_cancellation": cancellation_meta}]

            update_stmt = text(f"""
                UPDATE {self._schema}.kg_build_runs
                SET status = :status,
                    warnings = CAST(:warnings AS json),
                    completed_at = NOW(),
                    updated_at = NOW()
                WHERE id = :id
            """)
            await session.execute(
                update_stmt,
                {
                    "status": new_status,
                    "warnings": _json.dumps(new_warnings),
                    "id": str(row.id),
                },
            )
            await session.commit()
            return (new_status, _to_record(new_status, new_warnings, completed_at_override=datetime.now(UTC)))

    async def finalize_stale_kg_build_runs(
        self,
        *,
        app_name: str | None = None,
        cancelling_threshold_minutes: int = 2,
        running_threshold_minutes: int = 30,
    ) -> dict[str, int]:
        """KG 看门狗：把卡死的中间态 build_run 收敛到终态。

        - ``running`` 超 ``running_threshold_minutes`` 分钟无更新 → 标记为 ``failed``；
        - ``cancelling`` 超 ``cancelling_threshold_minutes`` → 强制 ``cancelled``。

        阈值（ISSUE-080）：``cancelling_threshold_minutes`` 默认从 5 → 2，配合
        bootstrap 内 watchdog tick 间隔 60s，最坏兜底 ≤ 3 分钟。``running_threshold_minutes``
        保持 30 分钟（保守，配合 ``update_build_run`` 修复后 ``completed_at`` 保留语义，
        真实反映任务最后一次心跳时间而非任务启动时间）。
        """
        async with self._session_scope() as session:
            stale_msg = (
                "Pipeline was running for over "
                + str(running_threshold_minutes)
                + " minutes and was forcibly marked as failed."
            )
            failed_stmt = text(f"""
                UPDATE {self._schema}.kg_build_runs
                SET status = 'failed',
                    error_message = COALESCE(error_message, :stale_msg),
                    completed_at = NOW()
                WHERE status = 'running'
                  AND COALESCE(updated_at, created_at) < NOW() - make_interval(mins => :running_threshold)
                  {"AND app_name = :app_name" if app_name is not None else ""}
            """)
            cancelled_stmt = text(f"""
                UPDATE {self._schema}.kg_build_runs
                SET status = 'cancelled',
                    completed_at = NOW()
                WHERE status = 'cancelling'
                  AND COALESCE(updated_at, created_at) < NOW() - make_interval(mins => :cancelling_threshold)
                  {"AND app_name = :app_name" if app_name is not None else ""}
            """)

            params_failed: dict[str, Any] = {
                "running_threshold": running_threshold_minutes,
                "stale_msg": stale_msg,
            }
            params_cancelled: dict[str, Any] = {"cancelling_threshold": cancelling_threshold_minutes}
            if app_name is not None:
                params_failed["app_name"] = app_name
                params_cancelled["app_name"] = app_name

            failed_result = await session.execute(failed_stmt, params_failed)
            cancelled_result = await session.execute(cancelled_stmt, params_cancelled)
            await session.commit()

            return {
                "forced_failed": failed_result.rowcount or 0,
                "forced_cancelled": cancelled_result.rowcount or 0,
            }


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
