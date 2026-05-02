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
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.logging import get_logger
from negentropy.model_names import canonicalize_model_name

from .graph_repository import (
    BuildRunRecord,
    GraphRepository,
    GraphSearchResult,
    get_graph_repository,
)
from .llm_extractors import (
    CompositeEntityExtractor,
    CompositeRelationExtractor,
)
from .types import (
    GraphBuildConfig,
    GraphEdge,
    GraphNode,
    GraphQueryConfig,
    KgEntityType,
    KgRelationType,
    KnowledgeGraphPayload,
)

logger = get_logger("negentropy.knowledge.graph_service")


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
    error_message: str | None = None
    warnings: list[dict[str, Any]] = field(default_factory=list)
    failed_chunk_count: int = 0


@dataclass(frozen=True)
class GraphQueryResult:
    """图谱查询结果

    包含匹配的实体和可选的邻居信息。
    """

    entities: list[GraphSearchResult]
    total_count: int
    query_time_ms: float


# ============================================================================
# Graph Query Cache (Tanenbaum & Van Steen, 2017; Kleppmann, 2017 §3)
# ============================================================================


class _TTLCache:
    """进程内 TTL 缓存，用于图谱查询结果 (Tanenbaum & Van Steen, 2017)

    场景优势：图谱数据仅在构建完成时批量变更，失效时机确定性高。
    """

    def __init__(self, ttl_seconds: int = 300) -> None:
        self._store: dict[str, tuple[Any, float]] = {}
        self._ttl = ttl_seconds

    def get(self, key: str) -> Any | None:
        if key in self._store:
            value, ts = self._store[key]
            if time.time() - ts < self._ttl:
                return value
            del self._store[key]
        return None

    def set(self, key: str, value: Any) -> None:
        self._store[key] = (value, time.time())

    def invalidate(self, prefix: str) -> None:
        keys_to_delete = [k for k in self._store if k.startswith(prefix)]
        for k in keys_to_delete:
            del self._store[k]


_graph_cache = _TTLCache(ttl_seconds=300)


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
        repository: GraphRepository | None = None,
        session: AsyncSession | None = None,
        config: GraphBuildConfig | None = None,
    ) -> None:
        """初始化图谱服务

        Args:
            repository: 图谱存储实例（可选，用于依赖注入）
            session: 数据库会话（可选）
            config: 构建配置（可选）
        """
        self._repository = repository or get_graph_repository(session)
        self._config = config or GraphBuildConfig(
            entity_types=tuple(KgEntityType.all_values()),
            relation_types=tuple(KgRelationType.all_values()),
        )

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
        chunks: list[dict[str, Any]],
        config: GraphBuildConfig | None = None,
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
        normalized_llm_model = canonicalize_model_name(build_config.llm_model)
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
                "llm_model": normalized_llm_model,
                "entity_types": build_config.entity_types,
                "relation_types": build_config.relation_types,
            },
            model_name=normalized_llm_model,
        )

        try:
            # 增量构建：跳过已处理的 chunk (Hogan et al., 2021 §6.3; Graphiti, 2025)
            prev_processed: set[str] = set()
            if build_config.incremental:
                prev_processed = await self._repository.get_processed_chunk_ids(corpus_id, app_name)
                original_count = len(chunks)
                chunks = [c for c in chunks if c.get("id") and str(c["id"]) not in prev_processed]
                logger.info(
                    "incremental_build_filter",
                    total_chunks=original_count,
                    new_chunks=len(chunks),
                    skipped=len(prev_processed),
                )
            else:
                # 全量构建：清除旧图谱数据
                await self._repository.clear_graph(corpus_id)

            # 分批处理
            all_entities: list[GraphNode] = []
            all_relations: list[GraphEdge] = []
            chunks_processed = 0
            failed_chunk_count = 0
            build_warnings: list[dict[str, Any]] = []
            total_chunks = len(chunks)

            batch_size = build_config.batch_size
            semaphore = asyncio.Semaphore(build_config.max_concurrency)

            async def process_chunk(
                chunk: dict[str, Any],
                _retries: int = 1,
            ) -> tuple[list[GraphNode], list[GraphEdge]]:
                """处理单个知识块，LLM 提取失败时重试一次 (Nygard, 2018)"""
                async with semaphore:
                    text = chunk.get("content", "")
                    if not text:
                        return [], []

                    try:
                        # 提取实体
                        entities = await self._entity_extractor.extract(text, corpus_id)

                        # 过滤低置信度实体
                        min_conf = build_config.min_entity_confidence
                        entities = [e for e in entities if e.metadata.get("confidence", 1.0) >= min_conf]

                        # 提取关系
                        relations = await self._relation_extractor.extract(entities, text)

                        # 过滤低置信度关系
                        relations = [
                            r
                            for r in relations
                            if r.metadata.get("confidence", 1.0) >= build_config.min_relation_confidence
                        ]

                        return entities, relations
                    except Exception:
                        if _retries > 0:
                            await asyncio.sleep(1.0)
                            return await process_chunk(chunk, _retries - 1)
                        raise

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
                        failed_chunk_count += 1
                        continue

                    entities, relations = result
                    all_entities.extend(entities)
                    all_relations.extend(relations)
                    chunks_processed += 1

                # 进度上报 (Majors, Observability Engineering, 2022)
                progress = min((i + len(batch)) / total_chunks, 1.0) if total_chunks > 0 else 1.0
                try:
                    await self._repository.update_build_run(
                        run_id=run_uuid,
                        status="running",
                        progress_percent=progress,
                    )
                except Exception:
                    pass  # 进度上报失败不影响构建

            # 去重实体（基于 label）
            unique_entities: dict[str, GraphNode] = {}
            for entity in all_entities:
                if entity.label and entity.label not in unique_entities:
                    unique_entities[entity.label] = entity

            entities_to_save = list(unique_entities.values())

            # 语义去重 (Fellegi & Sunter, 1969; Mudgal et al., 2018)
            # 在 label 精确去重之后，利用 embedding ANN 查找语义近义实体
            if build_config.semantic_dedup_threshold > 0 and len(entities_to_save) > 0:
                try:
                    await self._semantic_dedup(
                        entities_to_save,
                        corpus_id,
                        build_config.semantic_dedup_threshold,
                    )
                except Exception as dedup_exc:
                    build_warnings.append({"phase": "semantic_dedup", "error": str(dedup_exc)})
                    logger.warning("semantic_dedup_failed", error=str(dedup_exc))

            # 持久化实体
            await self._repository.create_entities(
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

            # 同步到一等公民表 (kg_entities / kg_relations)
            # 参见 Kleppmann DDIA §11: 事务内双写保证 SSoT 一致性
            try:
                from negentropy.db.session import AsyncSessionLocal

                from .kg_entity_service import KgEntityService

                kg_service = KgEntityService()
                node_dicts = [
                    {
                        "id": e.id.replace("entity:", ""),
                        "label": e.label,
                        "node_type": e.node_type,
                        "confidence": e.metadata.get("confidence", 1.0),
                        "metadata": e.metadata,
                    }
                    for e in entities_to_save
                ]
                edge_dicts = [
                    {
                        "source": r.source.replace("entity:", ""),
                        "target": r.target.replace("entity:", ""),
                        "edge_type": r.edge_type,
                        "label": r.label,
                        "weight": r.weight,
                        "evidence_text": r.metadata.get("evidence"),
                    }
                    for r in valid_relations
                ]
                async with AsyncSessionLocal() as sync_db:
                    sync_result = await kg_service.batch_sync_from_graph_build(
                        sync_db,
                        nodes=node_dicts,
                        edges=edge_dicts,
                        corpus_id=corpus_id,
                        app_name=app_name,
                    )
                    logger.info(
                        "kg_first_class_sync",
                        **sync_result,
                    )
            except Exception as sync_exc:
                logger.warning(
                    "kg_first_class_sync_failed",
                    error=str(sync_exc),
                )

            # 计算 PageRank 实体重要性 (Brin & Page, 1998)
            try:
                from negentropy.db.session import AsyncSessionLocal

                from .graph_algorithms import compute_pagerank

                async with AsyncSessionLocal() as pr_db:
                    pr_result = await compute_pagerank(pr_db, corpus_id)
                    logger.info(
                        "pagerank_computed",
                        entity_count=len(pr_result),
                    )
            except Exception as pr_exc:
                build_warnings.append({"algorithm": "pagerank", "error": str(pr_exc)})
                logger.warning(
                    "pagerank_computation_failed",
                    error=str(pr_exc),
                )

            # 计算 Louvain 社区检测 (Blondel et al., 2008)
            try:
                from negentropy.db.session import AsyncSessionLocal

                from .graph_algorithms import compute_louvain

                async with AsyncSessionLocal() as lv_db:
                    lv_result = await compute_louvain(lv_db, corpus_id)
                    logger.info(
                        "louvain_computed",
                        entity_count=len(lv_result),
                        community_count=len(set(lv_result.values())) if lv_result else 0,
                    )
            except Exception as lv_exc:
                build_warnings.append({"algorithm": "louvain", "error": str(lv_exc)})
                logger.warning(
                    "louvain_computation_failed",
                    error=str(lv_exc),
                )

            elapsed = time.time() - start_time

            # 计算已处理 chunk ID 列表（增量模式需合并上次）
            current_chunk_ids = [str(c["id"]) for c in chunks if c.get("id")]
            if build_config.incremental and prev_processed:
                all_processed = list(prev_processed | set(current_chunk_ids))
            else:
                all_processed = current_chunk_ids

            # 更新构建运行状态（含警告 + 已处理 chunk）
            await self._repository.update_build_run(
                run_id=run_uuid,
                status="completed",
                entity_count=len(entities_to_save),
                relation_count=len(valid_relations),
                warnings=build_warnings if build_warnings else None,
                processed_chunk_ids=all_processed if all_processed else None,
            )

            # 缓存失效：构建完成时清除该语料库的缓存
            _graph_cache.invalidate(f"graph:{corpus_id}")
            _graph_cache.invalidate(f"stats:{corpus_id}")

            logger.info(
                "graph_build_completed",
                corpus_id=str(corpus_id),
                run_id=run_id,
                entity_count=len(entities_to_save),
                relation_count=len(valid_relations),
                chunks_processed=chunks_processed,
                failed_chunk_count=failed_chunk_count,
                warning_count=len(build_warnings),
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
                warnings=build_warnings,
                failed_chunk_count=failed_chunk_count,
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
        query_embedding: list[float],
        config: GraphQueryConfig | None = None,
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
            rrf_k=query_config.rrf_k if query_config.use_rrf else None,
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

        # 缓存检查
        cache_key = f"graph:{corpus_id}"
        cached = _graph_cache.get(cache_key)
        if cached is not None:
            logger.debug("get_graph_cache_hit", corpus_id=str(corpus_id))
            return cached

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

        _graph_cache.set(cache_key, graph)
        return graph

    async def find_neighbors(
        self,
        entity_id: str,
        max_depth: int = 2,
        limit: int = 100,
    ) -> list[GraphNode]:
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
    ) -> list[str] | None:
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
    ) -> list[BuildRunRecord]:
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

    async def get_stats(
        self,
        db: AsyncSession,
        corpus_id: UUID,
    ) -> dict[str, Any]:
        """获取图谱统计信息

        Returns:
            统计字典（total_entities, by_type, avg_confidence, edge_count, health_metrics）
        """
        import math

        from sqlalchemy import func as sql_func
        from sqlalchemy import select as sql_select

        from negentropy.models.perception import KgEntity, KgRelation

        # Total entities
        total_result = await db.execute(
            sql_select(sql_func.count())
            .select_from(KgEntity)
            .where(KgEntity.corpus_id == corpus_id, KgEntity.is_active == True)  # noqa: E712
        )
        total_entities = total_result.scalar_one()

        # By type
        by_type_result = await db.execute(
            sql_select(KgEntity.entity_type, sql_func.count())
            .where(KgEntity.corpus_id == corpus_id, KgEntity.is_active == True)  # noqa: E712
            .group_by(KgEntity.entity_type)
        )
        by_type = {row[0]: row[1] for row in by_type_result.all()}

        # Avg confidence
        avg_result = await db.execute(
            sql_select(sql_func.avg(KgEntity.confidence)).where(
                KgEntity.corpus_id == corpus_id,
                KgEntity.is_active,  # noqa: E712
            )  # noqa: E712
        )
        avg_confidence = float(avg_result.scalar() or 0)

        # Edge count
        edge_result = await db.execute(
            sql_select(sql_func.count())
            .select_from(KgRelation)
            .where(KgRelation.corpus_id == corpus_id, KgRelation.is_active == True)  # noqa: E712
        )
        edge_count = edge_result.scalar_one()

        # Density: edges / (entities * (entities - 1))
        density = 0.0
        if total_entities > 1:
            max_edges = total_entities * (total_entities - 1)
            density = round(edge_count / max_edges, 4)

        # Top entities by importance (PageRank)
        top_entities_result = await db.execute(
            sql_select(KgEntity.id, KgEntity.name, KgEntity.entity_type, KgEntity.importance_score)
            .where(
                KgEntity.corpus_id == corpus_id,
                KgEntity.is_active == True,  # noqa: E712
                KgEntity.importance_score != None,  # noqa: E711
            )
            .order_by(KgEntity.importance_score.desc())
            .limit(5)
        )
        top_entities = [
            {
                "id": str(row.id),
                "name": row.name,
                "entity_type": row.entity_type,
                "importance_score": round(float(row.importance_score), 6),
            }
            for row in top_entities_result
        ]

        # Community distribution (Louvain)
        community_result = await db.execute(
            sql_select(KgEntity.community_id, sql_func.count())
            .where(
                KgEntity.corpus_id == corpus_id,
                KgEntity.is_active == True,  # noqa: E712
                KgEntity.community_id != None,  # noqa: E711
            )
            .group_by(KgEntity.community_id)
            .order_by(sql_func.count().desc())
            .limit(10)
        )
        community_distribution = {str(row[0]): row[1] for row in community_result.all()}

        community_count_result = await db.execute(
            sql_select(sql_func.count(sql_func.distinct(KgEntity.community_id))).where(
                KgEntity.corpus_id == corpus_id,
                KgEntity.is_active == True,  # noqa: E712
                KgEntity.community_id != None,  # noqa: E711
            )
        )
        community_count = community_count_result.scalar_one()

        # --- 健康指标（Farber et al., 2018; Hogan et al., 2021 §7） ---
        from negentropy.models.base import NEGENTROPY_SCHEMA

        # 1. 孤立实体比例：无任何关系的实体占比
        isolated_result = await db.execute(
            text("""
                SELECT COALESCE(
                    COUNT(*) FILTER (WHERE r_count = 0)::float / NULLIF(COUNT(*), 0),
                    0
                ) AS isolated_ratio
                FROM (
                    SELECT e.id, COUNT(r.id) AS r_count
                    FROM {schema}.kg_entities e
                    LEFT JOIN {schema}.kg_relations r ON (
                        (r.source_id = e.id OR r.target_id = e.id)
                        AND r.is_active = true
                    )
                    WHERE e.corpus_id = :cid AND e.is_active = true
                    GROUP BY e.id
                ) sub
            """).format(schema=NEGENTROPY_SCHEMA),
            {"cid": corpus_id},
        )
        isolated_ratio = float(isolated_result.scalar() or 0)

        # 2. Shannon 熵：类型分布均衡度（> 1.5 健康, < 1.0 告警）
        shannon_entropy = 0.0
        if by_type:
            total_typed = sum(by_type.values())
            shannon_entropy = -sum((c / total_typed) * math.log2(c / total_typed) for c in by_type.values() if c > 0)

        # 3. 连通分量数：小图实时计算，大图标记 needs_refresh
        connected_components = None
        if 0 < total_entities <= 10000:
            try:
                from negentropy.knowledge.graph_algorithms import export_graph_to_networkx

                nx_graph = await export_graph_to_networkx(db, corpus_id)
                import networkx as nx

                connected_components = nx.number_weakly_connected_components(nx_graph)
            except Exception:
                connected_components = None

        # 4. 构建管道健康：最近 30 天成功率和平均时长
        build_health = await self._get_build_health(db, corpus_id)

        # 5. 综合 health_score (0-100)
        health_score = self._compute_health_score(
            total_entities=total_entities,
            isolated_ratio=isolated_ratio,
            shannon_entropy=shannon_entropy,
            avg_confidence=avg_confidence,
            density=density,
            build_success_rate=build_health.get("success_rate", 1.0),
        )

        return {
            "total_entities": total_entities,
            "edge_count": edge_count,
            "by_type": by_type,
            "avg_confidence": round(avg_confidence, 3),
            "density": density,
            "avg_degree": round(2 * edge_count / total_entities, 1) if total_entities > 0 else 0,
            "top_entities": top_entities,
            "community_count": community_count,
            "community_distribution": community_distribution,
            # 健康指标
            "health": {
                "score": health_score,
                "level": "healthy" if health_score >= 70 else ("warning" if health_score >= 40 else "critical"),
                "isolated_ratio": round(isolated_ratio, 3),
                "shannon_entropy": round(shannon_entropy, 3),
                "connected_components": connected_components,
                "build": build_health,
            },
        }

    async def _get_build_health(
        self,
        db: AsyncSession,
        corpus_id: UUID,
    ) -> dict[str, Any]:
        """获取构建管道健康指标（最近 30 天）"""
        try:
            from negentropy.models.base import NEGENTROPY_SCHEMA

            result = await db.execute(
                text("""
                    SELECT
                        COUNT(*) AS total,
                        COUNT(*) FILTER (WHERE status = 'completed') AS succeeded,
                        COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - started_at))), 0) AS avg_duration_sec
                    FROM {schema}.kg_build_runs
                    WHERE corpus_id = :cid
                      AND started_at >= NOW() - INTERVAL '30 days'
                """).format(schema=NEGENTROPY_SCHEMA),
                {"cid": corpus_id},
            )
            row = result.one()
            total = row.total or 0
            return {
                "total_runs": total,
                "success_rate": round(row.succeeded / total, 3) if total > 0 else 1.0,
                "avg_duration_sec": round(float(row.avg_duration_sec or 0), 1),
            }
        except Exception:
            return {"total_runs": 0, "success_rate": 1.0, "avg_duration_sec": 0}

    @staticmethod
    def _compute_health_score(
        *,
        total_entities: int,
        isolated_ratio: float,
        shannon_entropy: float,
        avg_confidence: float,
        density: float,
        build_success_rate: float,
    ) -> int:
        """综合健康评分 (0-100)

        权重分配:
        - 实体覆盖度 (25%): total_entities > 100 满分
        - 孤立率 (20%): isolated_ratio < 0.2 满分
        - 密度 (10%): density > 0.005 满分
        - 类型均衡 (15%): shannon_entropy > 1.5 满分
        - 置信度 (15%): avg_confidence > 0.8 满分
        - 构建成功率 (15%): build_success_rate > 0.95 满分
        """
        coverage_score = min(total_entities / 100, 1.0) * 25
        isolation_score = max(0, 1 - isolated_ratio / 0.4) * 20
        density_score = min(density / 0.005, 1.0) * 10
        entropy_score = min(shannon_entropy / 1.5, 1.0) * 15
        confidence_score = min(avg_confidence / 0.8, 1.0) * 15
        build_score = min(build_success_rate / 0.95, 1.0) * 15
        return int(coverage_score + isolation_score + density_score + entropy_score + confidence_score + build_score)

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

        # 缓存失效
        _graph_cache.invalidate(f"graph:{corpus_id}")
        _graph_cache.invalidate(f"stats:{corpus_id}")

        logger.info(
            "clear_graph_completed",
            corpus_id=str(corpus_id),
            nodes_cleared=count,
        )

        return count

    async def _semantic_dedup(
        self,
        entities: list[GraphNode],
        corpus_id: UUID,
        threshold: float,
    ) -> None:
        """语义去重阶段：利用 embedding ANN 查找并合并近义实体

        三阶段流程 (Christen, 2012)：
        1. 阻塞 (Blocking): entity_type 预过滤
        2. 比较 (Comparison): HNSW ANN 余弦相似度
        3. 分类 (Classification): 阈值判定 + 合并
        """
        from negentropy.db.session import AsyncSessionLocal

        from .embedding import build_batch_embedding_fn
        from .kg_entity_service import KgEntityService

        # 1. 批量生成实体 label 的 embedding
        labels = [e.label for e in entities if e.label]
        if not labels:
            return

        embed_fn = await build_batch_embedding_fn()
        embeddings = await embed_fn(labels)

        # 2. 对每个实体查找 DB 中已有的相似实体
        merged_count = 0
        kg_service = KgEntityService()

        async with AsyncSessionLocal() as db:
            for entity, embedding in zip(entities, embeddings, strict=False):
                if not embedding or not entity.node_type:
                    continue

                similar = await self._repository.find_similar_entities(
                    embedding=embedding,
                    corpus_id=corpus_id,
                    entity_type=entity.node_type,
                    threshold=threshold,
                    limit=3,
                )

                for similar_id, similar_name, _score in similar:
                    # 找到已存在的同名实体则跳过（精确匹配已处理）
                    if similar_name == entity.label:
                        continue
                    await kg_service.merge_entities(
                        db,
                        primary_id=similar_id,
                        secondary_id=entity.id.replace("entity:", "") if entity.id else "",
                        corpus_id=corpus_id,
                    )
                    merged_count += 1

            if merged_count > 0:
                await db.commit()

        logger.info(
            "semantic_dedup_completed",
            corpus_id=str(corpus_id),
            entity_count=len(entities),
            merged_count=merged_count,
        )


# ============================================================================
# Factory Function
# ============================================================================


def get_graph_service(
    session: AsyncSession | None = None,
    config: GraphBuildConfig | None = None,
) -> GraphService:
    """获取图谱服务实例

    Args:
        session: 可选的数据库会话
        config: 可选的构建配置

    Returns:
        GraphService 实例
    """
    return GraphService(session=session, config=config)
