"""AssociationService: 记忆关联服务

管理记忆/事实之间的轻量关联，支持四种自动链接策略：
- semantic: embedding 相似度 > 0.75
- temporal: 同 thread 30 分钟内
- thread_shared: 共享 thread_id
- entity: 共享命名实体（依赖 KG，无 KG 时跳过）

多跳扩展：通过关联实现 Spreading Activation 式的上下文扩展。

参考文献:
[1] E. Tulving, "Episodic and semantic memory," 1972.
[2] A. M. Collins and E. F. Loftus, "A spreading-activation theory,"
    Psychological Review, vol. 82, no. 6, pp. 407–428, 1975.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import delete, func, or_, select, text
from sqlalchemy.exc import IntegrityError

import negentropy.db.session as db_session
from negentropy.logging import get_logger
from negentropy.models.base import NEGENTROPY_SCHEMA
from negentropy.models.internalization import Memory, MemoryAssociation

logger = get_logger("negentropy.engine.adapters.postgres.association_service")

_SEMANTIC_SIMILARITY_THRESHOLD = 0.75
_MAX_SEMANTIC_LINKS_PER_MEMORY = 5
_TEMPORAL_WINDOW_MINUTES = 30
_THREAD_SHARED_WEIGHT = 0.6


class AssociationService:
    """记忆关联服务"""

    async def auto_link_memory(
        self,
        *,
        memory_id: UUID,
        user_id: str,
        app_name: str,
        thread_id: UUID | None = None,
        embedding: list[float] | None = None,
        created_at: datetime | None = None,
    ) -> int:
        """为新记忆自动建立关联

        Returns:
            创建的关联数
        """
        count = 0

        # 1. Thread-shared 关联
        if thread_id:
            count += await self._create_thread_shared_links(
                memory_id=memory_id,
                thread_id=thread_id,
                user_id=user_id,
                app_name=app_name,
            )

            # 2. Temporal 关联
            if created_at:
                count += await self._create_temporal_links(
                    memory_id=memory_id,
                    thread_id=thread_id,
                    user_id=user_id,
                    app_name=app_name,
                    created_at=created_at,
                )

        # 3. Semantic 关联
        if embedding:
            count += await self._create_semantic_links(
                memory_id=memory_id,
                embedding=embedding,
                user_id=user_id,
                app_name=app_name,
            )

        if count:
            logger.info("auto_link_completed", memory_id=str(memory_id), links_created=count)

        return count

    async def get_associations(
        self,
        *,
        item_id: UUID,
        association_type: str | None = None,
        direction: str = "both",
        limit: int = 20,
        user_id: str | None = None,
        app_name: str | None = None,
    ) -> list[MemoryAssociation]:
        """获取记忆/事实的关联

        Review fix：可选 ``user_id`` / ``app_name`` 用于水平越权防线下推；
        ``None`` 时维持旧行为（admin / 内部调用），上游负责鉴权。
        """
        async with db_session.AsyncSessionLocal() as db:
            conditions_out = [MemoryAssociation.source_id == item_id]
            conditions_in = [MemoryAssociation.target_id == item_id]

            if association_type:
                conditions_out.append(MemoryAssociation.association_type == association_type)
                conditions_in.append(MemoryAssociation.association_type == association_type)

            if user_id is not None:
                conditions_out.append(MemoryAssociation.user_id == user_id)
                conditions_in.append(MemoryAssociation.user_id == user_id)
            if app_name is not None:
                conditions_out.append(MemoryAssociation.app_name == app_name)
                conditions_in.append(MemoryAssociation.app_name == app_name)

            if direction in ("outgoing", "both"):
                stmt = select(MemoryAssociation).where(*conditions_out).limit(limit)
                result = await db.execute(stmt)
                outgoing = list(result.scalars().all())
            else:
                outgoing = []

            if direction in ("incoming", "both"):
                stmt = select(MemoryAssociation).where(*conditions_in).limit(limit)
                result = await db.execute(stmt)
                incoming = list(result.scalars().all())
            else:
                incoming = []

            # 去重
            seen: set[UUID] = set()
            all_assocs: list[MemoryAssociation] = []
            for a in outgoing + incoming:
                if a.id not in seen:
                    seen.add(a.id)
                    all_assocs.append(a)

            return all_assocs[:limit]

    async def create_manual_association(
        self,
        *,
        source_id: UUID,
        target_id: UUID,
        association_type: str,
        weight: float,
        user_id: str,
        app_name: str,
        source_type: str = "memory",
        target_type: str = "memory",
    ) -> MemoryAssociation:
        """手动创建关联"""
        async with db_session.AsyncSessionLocal() as db:
            assoc = MemoryAssociation(
                source_id=source_id,
                source_type=source_type,
                target_id=target_id,
                target_type=target_type,
                association_type=association_type,
                weight=max(0.0, min(1.0, weight)),
                user_id=user_id,
                app_name=app_name,
            )
            db.add(assoc)
            await db.commit()
            await db.refresh(assoc)
        return assoc

    async def delete_association(
        self,
        association_id: UUID,
        *,
        user_id: str | None = None,
        app_name: str | None = None,
    ) -> bool:
        """删除关联

        Review fix：可选 ``user_id`` / ``app_name`` 用于水平越权防线下推；
        非 admin 调用必须传，否则任何持 token 用户拿到 UUID 即可越权删除他人关联。
        ``None`` 时维持旧行为（admin / 内部调用）。
        """
        async with db_session.AsyncSessionLocal() as db:
            conditions = [MemoryAssociation.id == association_id]
            if user_id is not None:
                conditions.append(MemoryAssociation.user_id == user_id)
            if app_name is not None:
                conditions.append(MemoryAssociation.app_name == app_name)
            stmt = delete(MemoryAssociation).where(*conditions)
            result = await db.execute(stmt)
            await db.commit()
            return result.rowcount > 0

    async def expand_multi_hop(
        self,
        *,
        item_ids: list[UUID],
        max_hops: int = 3,
        min_weight: float = 0.6,
        limit: int = 10,
    ) -> list[UUID]:
        """多跳扩展：从给定项目出发，沿关联扩展到相关项目"""
        visited: set[UUID] = set(item_ids)
        frontier: set[UUID] = set(item_ids)
        result_ids: list[UUID] = []

        for _ in range(max_hops):
            if not frontier or len(result_ids) >= limit:
                break

            next_frontier: set[UUID] = set()
            async with db_session.AsyncSessionLocal() as db:
                stmt = (
                    select(MemoryAssociation)
                    .where(
                        or_(
                            MemoryAssociation.source_id.in_(frontier),
                            MemoryAssociation.target_id.in_(frontier),
                        ),
                        MemoryAssociation.weight >= min_weight,
                        MemoryAssociation.association_type.in_(["semantic", "temporal"]),
                    )
                    .limit(limit * 2)
                )
                res = await db.execute(stmt)
                assocs = res.scalars().all()

                for a in assocs:
                    neighbors = []
                    if a.source_id in frontier and a.target_id not in visited:
                        neighbors.append(a.target_id)
                    if a.target_id in frontier and a.source_id not in visited:
                        neighbors.append(a.source_id)
                    for neighbor_id in neighbors:
                        visited.add(neighbor_id)
                        result_ids.append(neighbor_id)
                        next_frontier.add(neighbor_id)
                        if len(result_ids) >= limit:
                            break

            frontier = next_frontier

        return result_ids[:limit]

    # ------------------------------------------------------------------
    # 内部方法
    # ------------------------------------------------------------------

    async def _create_thread_shared_links(
        self,
        *,
        memory_id: UUID,
        thread_id: UUID,
        user_id: str,
        app_name: str,
    ) -> int:
        """创建 thread_shared 关联"""
        async with db_session.AsyncSessionLocal() as db:
            # 查找同 thread 的其他记忆
            stmt = (
                select(Memory.id)
                .where(
                    Memory.thread_id == thread_id,
                    Memory.id != memory_id,
                    Memory.user_id == user_id,
                    Memory.app_name == app_name,
                )
                .limit(20)
            )
            result = await db.execute(stmt)
            sibling_ids = [row.id for row in result.fetchall()]

            if not sibling_ids:
                return 0

            count = 0
            for sibling_id in sibling_ids:
                try:
                    async with db.begin_nested():
                        assoc = MemoryAssociation(
                            source_id=memory_id,
                            target_id=sibling_id,
                            association_type="thread_shared",
                            weight=_THREAD_SHARED_WEIGHT,
                            user_id=user_id,
                            app_name=app_name,
                        )
                        db.add(assoc)
                        await db.flush()
                        count += 1
                except IntegrityError:
                    continue

            await db.commit()
        return count

    async def _create_temporal_links(
        self,
        *,
        memory_id: UUID,
        thread_id: UUID,
        user_id: str,
        app_name: str,
        created_at: datetime,
    ) -> int:
        """创建 temporal 关联"""
        window = timedelta(minutes=_TEMPORAL_WINDOW_MINUTES)
        async with db_session.AsyncSessionLocal() as db:
            stmt = (
                select(Memory.id, Memory.created_at)
                .where(
                    Memory.thread_id == thread_id,
                    Memory.id != memory_id,
                    Memory.user_id == user_id,
                    Memory.app_name == app_name,
                    Memory.created_at.between(created_at - window, created_at + window),
                )
                .limit(10)
            )
            result = await db.execute(stmt)
            rows = result.fetchall()

            count = 0
            for row in rows:
                minutes_apart = abs((created_at - row.created_at).total_seconds()) / 60
                weight = max(0.3, 1.0 - minutes_apart / _TEMPORAL_WINDOW_MINUTES)
                try:
                    async with db.begin_nested():
                        assoc = MemoryAssociation(
                            source_id=memory_id,
                            target_id=row.id,
                            association_type="temporal",
                            weight=weight,
                            user_id=user_id,
                            app_name=app_name,
                        )
                        db.add(assoc)
                        await db.flush()
                        count += 1
                except IntegrityError:
                    continue

            await db.commit()
        return count

    # ------------------------------------------------------------------
    # Phase 4 — KG 双向同步（接通 association.target_type='entity' 与 KG 真实节点）
    # ------------------------------------------------------------------

    async def link_to_kg_entity(
        self,
        *,
        memory_id: UUID,
        entity_id: UUID,
        user_id: str,
        app_name: str,
        weight: float = 0.7,
    ) -> MemoryAssociation | None:
        """建立 Memory → KG entity 的实体关联（target_type='entity'）。

        幂等：唯一键 (source_id, target_id, association_type='entity') 已建。
        """
        try:
            async with db_session.AsyncSessionLocal() as db:
                async with db.begin_nested():
                    assoc = MemoryAssociation(
                        source_id=memory_id,
                        source_type="memory",
                        target_id=entity_id,
                        target_type="entity",
                        association_type="entity",
                        weight=max(0.0, min(1.0, weight)),
                        user_id=user_id,
                        app_name=app_name,
                    )
                    db.add(assoc)
                    await db.flush()
                    assoc_id = assoc.id
                await db.commit()
                # 重新查询返回（避免 detached instance 问题）
                stmt = select(MemoryAssociation).where(MemoryAssociation.id == assoc_id)
                result = await db.execute(stmt)
                return result.scalar_one_or_none()
        except IntegrityError:
            logger.debug("kg_entity_link_already_exists", memory_id=str(memory_id), entity_id=str(entity_id))
            return None

    async def get_kg_entities_for_memory(
        self,
        memory_id: UUID,
        limit: int = 20,
    ) -> list[dict]:
        """反查 Memory 关联的 KG entity 列表。

        返回 [{"entity_id", "weight", "metadata"}, ...]，KG 表读取在调用方处理。
        """
        async with db_session.AsyncSessionLocal() as db:
            stmt = (
                select(MemoryAssociation)
                .where(
                    MemoryAssociation.source_id == memory_id,
                    MemoryAssociation.target_type == "entity",
                    MemoryAssociation.association_type == "entity",
                )
                .limit(limit)
            )
            result = await db.execute(stmt)
            assocs = result.scalars().all()

        return [
            {
                "entity_id": str(a.target_id),
                "weight": float(a.weight),
                "metadata": a.metadata_ or {},
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in assocs
        ]

    # ------------------------------------------------------------------
    # Phase 5 F1 — HippoRAG Personalized PageRank 加权扩散
    # ------------------------------------------------------------------

    async def expand_via_ppr(
        self,
        *,
        seeds: list[UUID],
        depth: int = 2,
        alpha: float = 0.5,
        top_k: int = 50,
    ) -> dict[str, float]:
        """从种子节点出发做 BFS 加权扩散，等价 Personalized PageRank<sup>[3]</sup>。

        每跳累加权重为 ``α^d × edge_weight``；同一目标被多条路径到达时分数相加。
        当 KG 关系数极少时直接返回种子自身的 score=1.0 字典。

        Args:
            seeds: 种子 KG entity_id 列表
            depth: BFS 扩散最大深度（默认 2，HippoRAG 论文经验值）
            alpha: 衰减系数（默认 0.5）
            top_k: 返回的最高分 entity 数

        Returns:
            ``{entity_id_str: score}``，分数已按 max-min 归一化到 [0, 1]。

        参考文献：
        [3] L. Page et al., "PageRank citation ranking," Stanford Tech. Rep., 1999.
        [4] B. J. Gutiérrez et al., "HippoRAG," in Proc. NeurIPS, 2024.
        """
        if not seeds:
            return {}
        seed_strs = [str(s) for s in seeds]
        scores: dict[str, float] = {s: 1.0 for s in seed_strs}

        # frontier：当前层待扩散节点；visited：所有已经被打过分的节点
        # （含种子）。仅对 visited 之外的端点累加分数，避免 depth ≥ 2 时
        # 把分数回流到种子或上一层节点导致 PPR 归一化失真。
        frontier: set[str] = set(seed_strs)
        visited: set[str] = set(seed_strs)
        for d in range(1, max(1, depth) + 1):
            if not frontier:
                break
            decay = alpha**d
            try:
                async with db_session.AsyncSessionLocal() as db:
                    sql = text(
                        f"""
                        SELECT r.source_id::text AS src, r.target_id::text AS tgt,
                               COALESCE(r.weight, 1.0) AS w
                        FROM {NEGENTROPY_SCHEMA}.kg_relations r
                        WHERE r.is_active IS TRUE
                          AND (r.source_id::text = ANY(:frontier)
                               OR r.target_id::text = ANY(:frontier))
                        """
                    )
                    result = await db.execute(sql, {"frontier": list(frontier)})
                    edges = result.fetchall()
            except Exception as exc:
                logger.debug("ppr_expand_query_failed", depth=d, error=str(exc))
                break

            # 同层内每个端点的最大累积权重（对多条路径取 max，避免重复加权放大）
            level_gain: dict[str, float] = {}
            for row in edges:
                src = row.src
                tgt = row.tgt
                w = float(row.w or 1.0)
                # KG 视为无向图扩散（HippoRAG 论文采用对称邻接）
                if src in frontier and tgt not in visited:
                    prev = level_gain.get(tgt, 0.0)
                    if w > prev:
                        level_gain[tgt] = w
                if tgt in frontier and src not in visited:
                    prev = level_gain.get(src, 0.0)
                    if w > prev:
                        level_gain[src] = w

            for node, w in level_gain.items():
                scores[node] = scores.get(node, 0.0) + decay * w

            new_frontier = set(level_gain.keys())
            visited.update(new_frontier)
            frontier = new_frontier

        # 归一化到 [0, 1]
        if not scores:
            return {}
        max_score = max(scores.values())
        if max_score <= 0:
            return {}
        normalized = {k: v / max_score for k, v in scores.items()}
        # 取 top_k
        ranked = sorted(normalized.items(), key=lambda kv: kv[1], reverse=True)[:top_k]
        return dict(ranked)

    async def memories_for_entity_scores(
        self,
        *,
        entity_scores: dict[str, float],
        user_id: str,
        app_name: str,
        limit: int = 50,
    ) -> list[dict]:
        """把 PPR 实体分数映射回 Memory 列表。

        memory.score = Σ entity_score × association.weight，按降序取 top-limit。
        """
        if not entity_scores:
            return []

        async with db_session.AsyncSessionLocal() as db:
            stmt = select(MemoryAssociation).where(
                MemoryAssociation.target_type == "entity",
                MemoryAssociation.target_id.in_([UUID(eid) for eid in entity_scores]),
                MemoryAssociation.user_id == user_id,
                MemoryAssociation.app_name == app_name,
            )
            result = await db.execute(stmt)
            assocs = result.scalars().all()

        agg: dict[str, float] = {}
        for a in assocs:
            entity_score = entity_scores.get(str(a.target_id), 0.0)
            agg[str(a.source_id)] = agg.get(str(a.source_id), 0.0) + entity_score * float(a.weight)

        ranked = sorted(agg.items(), key=lambda kv: kv[1], reverse=True)[:limit]
        return [{"memory_id": mid, "ppr_score": score} for mid, score in ranked]

    async def count_kg_associations(self, *, user_id: str, app_name: str) -> int:
        """返回该 (user, app) 下 ``target_type='entity'`` 的关联总数；用于启动期门控。

        使用 ``COUNT(*)`` 聚合而非加载 ORM 行：旧实现 ``.limit(200)`` 会把
        计数截断在 200，使得 ``min_kg_associations`` 配置 > 200 时门控永远
        失败、PPR 通道被永久关闭。
        """
        async with db_session.AsyncSessionLocal() as db:
            stmt = (
                select(func.count())
                .select_from(MemoryAssociation)
                .where(
                    MemoryAssociation.target_type == "entity",
                    MemoryAssociation.user_id == user_id,
                    MemoryAssociation.app_name == app_name,
                )
            )
            result = await db.execute(stmt)
            return int(result.scalar_one() or 0)

    async def get_memories_for_kg_entity(
        self,
        entity_id: UUID,
        limit: int = 50,
    ) -> list[dict]:
        """反查 KG entity 被哪些 Memory 引用。"""
        async with db_session.AsyncSessionLocal() as db:
            stmt = (
                select(MemoryAssociation)
                .where(
                    MemoryAssociation.target_id == entity_id,
                    MemoryAssociation.target_type == "entity",
                    MemoryAssociation.association_type == "entity",
                )
                .limit(limit)
            )
            result = await db.execute(stmt)
            assocs = result.scalars().all()
        return [
            {
                "memory_id": str(a.source_id),
                "weight": float(a.weight),
                "user_id": a.user_id,
                "app_name": a.app_name,
            }
            for a in assocs
        ]

    async def _create_semantic_links(
        self,
        *,
        memory_id: UUID,
        embedding: list[float],
        user_id: str,
        app_name: str,
    ) -> int:
        """创建 semantic 关联（基于 embedding 相似度）"""
        async with db_session.AsyncSessionLocal() as db:
            distance = Memory.embedding.op("<=>")(embedding)
            stmt = (
                select(Memory.id, distance.label("dist"))
                .where(
                    Memory.user_id == user_id,
                    Memory.app_name == app_name,
                    Memory.embedding.is_not(None),
                    Memory.id != memory_id,
                )
                .order_by(distance.asc())
                .limit(_MAX_SEMANTIC_LINKS_PER_MEMORY)
            )
            result = await db.execute(stmt)
            rows = result.fetchall()

            count = 0
            for row in rows:
                similarity = 1.0 - float(row.dist)
                if similarity >= _SEMANTIC_SIMILARITY_THRESHOLD:
                    try:
                        async with db.begin_nested():
                            assoc = MemoryAssociation(
                                source_id=memory_id,
                                target_id=row.id,
                                association_type="semantic",
                                weight=similarity,
                                user_id=user_id,
                                app_name=app_name,
                            )
                            db.add(assoc)
                            await db.flush()
                            count += 1
                    except IntegrityError:
                        continue

            await db.commit()
        return count
