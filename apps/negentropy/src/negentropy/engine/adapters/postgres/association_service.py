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

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError

import negentropy.db.session as db_session
from negentropy.logging import get_logger
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
    ) -> list[MemoryAssociation]:
        """获取记忆/事实的关联"""
        async with db_session.AsyncSessionLocal() as db:
            conditions_out = [MemoryAssociation.source_id == item_id]
            conditions_in = [MemoryAssociation.target_id == item_id]

            if association_type:
                conditions_out.append(MemoryAssociation.association_type == association_type)
                conditions_in.append(MemoryAssociation.association_type == association_type)

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

    async def delete_association(self, association_id: UUID) -> bool:
        """删除关联"""
        async with db_session.AsyncSessionLocal() as db:
            stmt = delete(MemoryAssociation).where(MemoryAssociation.id == association_id)
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
                        MemoryAssociation.source_id.in_(frontier),
                        MemoryAssociation.weight >= min_weight,
                        MemoryAssociation.association_type.in_(["semantic", "temporal"]),
                    )
                    .limit(limit * 2)
                )
                res = await db.execute(stmt)
                assocs = res.scalars().all()

                for a in assocs:
                    if a.target_id not in visited:
                        visited.add(a.target_id)
                        result_ids.append(a.target_id)
                        next_frontier.add(a.target_id)
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
                    assoc = MemoryAssociation(
                        source_id=memory_id,
                        target_id=sibling_id,
                        association_type="thread_shared",
                        weight=_THREAD_SHARED_WEIGHT,
                        user_id=user_id,
                        app_name=app_name,
                    )
                    db.add(assoc)
                    count += 1
                except IntegrityError:
                    pass  # UNIQUE 约束冲突时忽略

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
                    assoc = MemoryAssociation(
                        source_id=memory_id,
                        target_id=row.id,
                        association_type="temporal",
                        weight=weight,
                        user_id=user_id,
                        app_name=app_name,
                    )
                    db.add(assoc)
                    count += 1
                except IntegrityError:
                    pass

            await db.commit()
        return count

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
                        assoc = MemoryAssociation(
                            source_id=memory_id,
                            target_id=row.id,
                            association_type="semantic",
                            weight=similarity,
                            user_id=user_id,
                            app_name=app_name,
                        )
                        db.add(assoc)
                        count += 1
                    except IntegrityError:
                        pass

            await db.commit()
        return count
