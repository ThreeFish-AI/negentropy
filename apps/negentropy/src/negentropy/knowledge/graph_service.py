"""
Knowledge Graph Service

提供知识图谱的高层服务接口，协调实体/关系提取、图谱持久化和查询。

设计原则 (AGENTS.md):
- Service Layer Pattern: 封装业务逻辑，协调多个组件
- Single Responsibility: 只处理图谱相关的业务逻辑
- 正交分解: 与 KnowledgeService 正交，可独立使用

参考文献:
[1] M. Fowler, "Patterns of Enterprise Application Architecture," 2002.
"""

from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.config import settings
from negentropy.logging import get_logger

from .graph_repository import (
    AgeGraphRepository,
    BuildRunRecord,
    GraphRepository,
    GraphSearchResult,
    get_graph_repository,
)
from .llm_extractors import (
    CompositeEntityExtractor,
    CompositeRelationExtractor,
    EntityType,
    RelationType,
)
from .types import GraphEdge, GraphNode, KnowledgeGraphPayload

logger = get_logger("negentropy.knowledge.graph_service")


# ============================================================================
# Configuration Types
# ============================================================================


@dataclass(frozen=True)
class GraphBuildConfig:
    """图谱构建配置

    控制实体和关系提取的行为。
    """

    enable_llm_extraction: bool = True
    llm_model: Optional[str] = None
    entity_types: List[str] = field(default_factory=lambda: EntityType.ALL)
    relation_types: List[str] = field(default_factory=lambda: RelationType.ALL)
    min_entity_confidence: float = 0.5
    min_relation_confidence: float = 0.5
    batch_size: int = 10
    max_concurrency: int = 3


@dataclass(frozen=True)
class GraphQueryConfig:
    """图谱查询配置

    控制图谱检索和遍历的行为。
    """

    max_depth: int = 2
    limit: int = 100
    semantic_weight: float = 0.6
    graph_weight: float = 0.4
    include_neighbors: bool = True
    neighbor_limit: int = 10


# ============================================================================
# Service Result Types
# ============================================================================


@dataclass(frozen=True)
class GraphBuildResult:
    """图谱构建结果

    包含构建统计和运行信息。
    """

    run_id: str
    corpus_id: UUID
    status: str
    entity_count: int
    relation_count: int
    chunks_processed: int
    elapsed_seconds: float
    error_message: Optional[str] = None


@dataclass(frozen=True)
class GraphQueryResult:
    """图谱查询结果

    包含匹配的实体和可选的邻居信息。
    """

    entities: List[GraphSearchResult]
    total_count: int
    query_time_ms: float


# ============================================================================
# Graph Service
# ============================================================================


class GraphService:
    """知识图谱服务

    提供图谱的构建、查询和管理功能。

    核心职责:
    1. 协调实体/关系提取器
    2. 管理图谱持久化
    3. 提供混合检索能力
    4. 追踪构建历史

    使用示例:
    ```python
    service = GraphService()

    # 构建图谱
    result = await service.build_graph(
        corpus_id=corpus_id,
        app_name="my_app",
        chunks=knowledge_chunks,
    )

    # 查询图谱
    results = await service.search(
        corpus_id=corpus_id,
        app_name="my_app",
        query="机器学习",
        query_embedding=embedding,
    )
    ```
    """

    def __init__(
        self,
        repository: Optional[GraphRepository] = None,
        session: Optional[AsyncSession] = None,
        config: Optional[GraphBuildConfig] = None,
    ) -> None:
        """初始化图谱服务

        Args:
            repository: 图谱存储实例（可选，用于依赖注入）
            session: 数据库会话（可选）
            config: 构建配置（可选）
        """
        self._repository = repository or get_graph_repository(session)
        self._config = config or GraphBuildConfig()

        # 初始化提取器
        self._entity_extractor = CompositeEntityExtractor(
            llm_model=self._config.llm_model,
            enable_llm=self._config.enable_llm_extraction,
        )
        self._relation_extractor = CompositeRelationExtractor(
            llm_model=self._config.llm_model,
            enable_llm=self._config.enable_llm_extraction,
        )

    async def build_graph(
        self,
        corpus_id: UUID,
        app_name: str,
        chunks: List[Dict[str, Any]],
        config: Optional[GraphBuildConfig] = None,
    ) -> GraphBuildResult:
        """构建知识图谱

        从知识块中提取实体和关系，构建图谱。

        Args:
            corpus_id: 语料库 ID
            app_name: 应用名称
            chunks: 知识块列表，每个包含 content 和 metadata
            config: 构建配置（可选，覆盖默认配置）

        Returns:
            构建结果统计
        """
        build_config = config or self._config
        run_id = f"build-{uuid.uuid4().hex[:8]}-{int(time.time())}"
        start_time = time.time()

        logger.info(
            "graph_build_started",
            corpus_id=str(corpus_id),
            app_name=app_name,
            run_id=run_id,
            chunk_count=len(chunks),
        )

        # 创建构建运行记录
        run_uuid = await self._repository.create_build_run(
            app_name=app_name,
            corpus_id=corpus_id,
            run_id=run_id,
            extractor_config={
                "enable_llm": build_config.enable_llm_extraction,
                "llm_model": build_config.llm_model,
                "entity_types": build_config.entity_types,
                "relation_types": build_config.relation_types,
            },
            model_name=build_config.llm_model,
        )

        try:
            # 清除旧图谱数据
            await self._repository.clear_graph(corpus_id)

            # 分批处理
            all_entities: List[GraphNode] = []
            all_relations: List[GraphEdge] = []
            chunks_processed = 0

            batch_size = build_config.batch_size
            semaphore = asyncio.Semaphore(build_config.max_concurrency)

            async def process_chunk(chunk: Dict[str, Any]) -> tuple[List[GraphNode], List[GraphEdge]]:
                """处理单个知识块"""
                async with semaphore:
                    text = chunk.get("content", "")
                    if not text:
                        return [], []

                    # 提取实体
                    entities = await self._entity_extractor.extract(text, corpus_id)

                    # 过滤低置信度实体
                    entities = [
                        e for e in entities if e.metadata.get("confidence", 1.0) >= build_config.min_entity_confidence
                    ]

                    # 提取关系
                    relations = await self._relation_extractor.extract(entities, text)

                    # 过滤低置信度关系
                    relations = [
                        r
                        for r in relations
                        if r.metadata.get("confidence", 1.0) >= build_config.min_relation_confidence
                    ]

                    return entities, relations

            # 批量处理
            for i in range(0, len(chunks), batch_size):
                batch = chunks[i : i + batch_size]
                results = await asyncio.gather(
                    *[process_chunk(chunk) for chunk in batch],
                    return_exceptions=True,
                )

                for result in results:
                    if isinstance(result, Exception):
                        logger.warning(
                            "chunk_processing_error",
                            error=str(result),
                        )
                        continue

                    entities, relations = result
                    all_entities.extend(entities)
                    all_relations.extend(relations)
                    chunks_processed += 1

            # 去重实体（基于 label）
            unique_entities: Dict[str, GraphNode] = {}
            for entity in all_entities:
                if entity.label and entity.label not in unique_entities:
                    unique_entities[entity.label] = entity

            entities_to_save = list(unique_entities.values())

            # 持久化实体
            entity_ids = await self._repository.create_entities(
                entities_to_save,
                corpus_id,
            )

            # 重新映射关系中的实体 ID
            label_to_id = {e.label: e.id for e in entities_to_save}

            valid_relations = []
            for relation in all_relations:
                # 查找源和目标实体
                source_id = relation.source
                target_id = relation.target

                # 如果 source/target 是 label，需要映射
                if source_id in label_to_id:
                    source_id = label_to_id[source_id]
                if target_id in label_to_id:
                    target_id = label_to_id[target_id]

                # 确保源和目标都存在
                if source_id and target_id and source_id != target_id:
                    updated_relation = GraphEdge(
                        source=source_id,
                        target=target_id,
                        label=relation.label,
                        edge_type=relation.edge_type,
                        weight=relation.weight,
                        metadata=relation.metadata,
                    )
                    valid_relations.append(updated_relation)

            # 持久化关系
            await self._repository.create_relations(valid_relations)

            elapsed = time.time() - start_time

            # 更新构建运行状态
            await self._repository.update_build_run(
                run_id=run_uuid,
                status="completed",
                entity_count=len(entities_to_save),
                relation_count=len(valid_relations),
            )

            logger.info(
                "graph_build_completed",
                corpus_id=str(corpus_id),
                run_id=run_id,
                entity_count=len(entities_to_save),
                relation_count=len(valid_relations),
                chunks_processed=chunks_processed,
                elapsed_seconds=elapsed,
            )

            return GraphBuildResult(
                run_id=run_id,
                corpus_id=corpus_id,
                status="completed",
                entity_count=len(entities_to_save),
                relation_count=len(valid_relations),
                chunks_processed=chunks_processed,
                elapsed_seconds=elapsed,
            )

        except Exception as exc:
            elapsed = time.time() - start_time
            error_message = str(exc)

            logger.error(
                "graph_build_failed",
                corpus_id=str(corpus_id),
                run_id=run_id,
                error=error_message,
                elapsed_seconds=elapsed,
            )

            # 更新构建运行状态
            await self._repository.update_build_run(
                run_id=run_uuid,
                status="failed",
                error_message=error_message,
            )

            return GraphBuildResult(
                run_id=run_id,
                corpus_id=corpus_id,
                status="failed",
                entity_count=0,
                relation_count=0,
                chunks_processed=0,
                elapsed_seconds=elapsed,
                error_message=error_message,
            )

    async def search(
        self,
        corpus_id: UUID,
        app_name: str,
        query: str,
        query_embedding: List[float],
        config: Optional[GraphQueryConfig] = None,
    ) -> GraphQueryResult:
        """混合检索图谱

        结合向量相似度和图结构分数进行检索。

        Args:
            corpus_id: 语料库 ID
            app_name: 应用名称
            query: 查询文本
            query_embedding: 查询向量
            config: 查询配置（可选）

        Returns:
            检索结果
        """
        query_config = config or GraphQueryConfig()
        start_time = time.time()

        logger.debug(
            "graph_search_started",
            corpus_id=str(corpus_id),
            query=query[:50],
        )

        # 执行混合检索
        results = await self._repository.hybrid_search(
            corpus_id=corpus_id,
            app_name=app_name,
            query_embedding=query_embedding,
            query_text=query,
            limit=query_config.limit,
            graph_depth=query_config.max_depth,
            semantic_weight=query_config.semantic_weight,
            graph_weight=query_config.graph_weight,
        )

        # 可选：加载邻居信息
        if query_config.include_neighbors and results:
            for result in results[:5]:  # 只为前 5 个结果加载邻居
                try:
                    neighbors = await self._repository.find_neighbors(
                        entity_id=result.entity.id,
                        max_depth=1,
                        limit=query_config.neighbor_limit,
                    )
                    # 创建新的结果对象（因为 dataclass 是 frozen 的）
                    object.__setattr__(result, "neighbors", neighbors)
                except Exception as exc:
                    logger.warning(
                        "neighbor_load_error",
                        entity_id=result.entity.id,
                        error=str(exc),
                    )

        elapsed_ms = (time.time() - start_time) * 1000

        logger.debug(
            "graph_search_completed",
            corpus_id=str(corpus_id),
            result_count=len(results),
            elapsed_ms=elapsed_ms,
        )

        return GraphQueryResult(
            entities=results,
            total_count=len(results),
            query_time_ms=elapsed_ms,
        )

    async def get_graph(
        self,
        corpus_id: UUID,
        app_name: str,
        include_runs: bool = False,
    ) -> KnowledgeGraphPayload:
        """获取完整图谱

        Args:
            corpus_id: 语料库 ID
            app_name: 应用名称
            include_runs: 是否包含构建运行历史

        Returns:
            完整图谱数据
        """
        logger.debug(
            "get_graph_started",
            corpus_id=str(corpus_id),
            app_name=app_name,
        )

        # 获取图谱数据
        graph = await self._repository.get_graph(corpus_id, app_name)

        # 可选：包含构建历史
        if include_runs:
            runs = await self._repository.get_build_runs(corpus_id, app_name)
            runs_data = [
                {
                    "run_id": r.run_id,
                    "status": r.status,
                    "entity_count": r.entity_count,
                    "relation_count": r.relation_count,
                    "started_at": r.started_at.isoformat() if r.started_at else None,
                    "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                    "model_name": r.model_name,
                }
                for r in runs
            ]
            # 创建新的 payload（因为 dataclass 是 frozen 的）
            graph = KnowledgeGraphPayload(
                nodes=graph.nodes,
                edges=graph.edges,
                runs=runs_data,
            )

        logger.info(
            "get_graph_completed",
            corpus_id=str(corpus_id),
            node_count=len(graph.nodes),
            edge_count=len(graph.edges),
        )

        return graph

    async def find_neighbors(
        self,
        entity_id: str,
        max_depth: int = 2,
        limit: int = 100,
    ) -> List[GraphNode]:
        """查询实体邻居

        Args:
            entity_id: 起始实体 ID
            max_depth: 最大遍历深度
            limit: 结果数量限制

        Returns:
            邻居节点列表
        """
        logger.debug(
            "find_neighbors_started",
            entity_id=entity_id,
            max_depth=max_depth,
        )

        neighbors = await self._repository.find_neighbors(
            entity_id=entity_id,
            max_depth=max_depth,
            limit=limit,
        )

        logger.debug(
            "find_neighbors_completed",
            entity_id=entity_id,
            neighbor_count=len(neighbors),
        )

        return neighbors

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
            路径节点 ID 列表，或 None
        """
        logger.debug(
            "find_path_started",
            source_id=source_id,
            target_id=target_id,
        )

        path = await self._repository.find_path(
            source_id=source_id,
            target_id=target_id,
            max_depth=max_depth,
        )

        if path:
            logger.debug(
                "find_path_completed",
                source_id=source_id,
                target_id=target_id,
                path_length=len(path),
            )
        else:
            logger.debug(
                "find_path_no_path",
                source_id=source_id,
                target_id=target_id,
            )

        return path

    async def get_build_history(
        self,
        corpus_id: UUID,
        app_name: str,
        limit: int = 20,
    ) -> List[BuildRunRecord]:
        """获取构建历史

        Args:
            corpus_id: 语料库 ID
            app_name: 应用名称
            limit: 结果数量限制

        Returns:
            构建运行记录列表
        """
        return await self._repository.get_build_runs(
            corpus_id=corpus_id,
            app_name=app_name,
            limit=limit,
        )

    async def clear_graph(
        self,
        corpus_id: UUID,
    ) -> int:
        """清除图谱数据

        Args:
            corpus_id: 语料库 ID

        Returns:
            删除的节点数量
        """
        logger.info(
            "clear_graph_started",
            corpus_id=str(corpus_id),
        )

        count = await self._repository.clear_graph(corpus_id)

        logger.info(
            "clear_graph_completed",
            corpus_id=str(corpus_id),
            nodes_cleared=count,
        )

        return count


# ============================================================================
# Factory Function
# ============================================================================


def get_graph_service(
    session: Optional[AsyncSession] = None,
    config: Optional[GraphBuildConfig] = None,
) -> GraphService:
    """获取图谱服务实例

    Args:
        session: 可选的数据库会话
        config: 可选的构建配置

    Returns:
        GraphService 实例
    """
    return GraphService(session=session, config=config)
