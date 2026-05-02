"""ConflictResolver: 记忆冲突检测与解决服务

基于 AGM 信念修正理论 (Alchourrón, Gärdenfors, Makinson, 1985)，
当新事实与现有事实矛盾时，通过三阶段检测识别冲突并自动解决。

检测阶段:
1. Key-based（快速路径）: 同 key 不同 value → 标记为潜在冲突
2. Embedding-based（中速路径）: 高相似度但非精确重复 → 标记为潜在冲突
3. LLM-based（深度路径）: 使用 LLM 判断是否真正矛盾

解决策略:
- supersede: 旧事实标记为 superseded，新事实取代
- merge: 合并两者值
- keep_both: 记录冲突但保留两者（独立但相关的事实）

参考文献:
[1] C. E. Alchourrón, P. Gärdenfors, and D. Makinson,
    "On the logic of theory change," J. Symbolic Logic, vol. 50, no. 2,
    pp. 510–530, 1985.
[2] J. Doyle, "A truth maintenance system," Artificial Intelligence,
    vol. 12, no. 3, pp. 231–272, 1979.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

import negentropy.db.session as db_session
from negentropy.logging import get_logger
from negentropy.models.internalization import Fact, MemoryConflict

logger = get_logger("negentropy.engine.governance.conflict_resolver")

# 冲突检测阈值
_EMBEDDING_CONFLICT_SIMILARITY = 0.85  # 超过此值才可能冲突


class ConflictResolver:
    """记忆冲突检测与解决服务"""

    def __init__(self, session_factory: type[AsyncSession] = db_session.AsyncSessionLocal) -> None:
        self._session_factory = session_factory

    async def detect_and_resolve(
        self,
        *,
        old_fact: Fact,
        new_fact: Fact,
        user_id: str,
        app_name: str,
    ) -> MemoryConflict | None:
        """检测并解决事实冲突

        Args:
            old_fact: 现有事实
            new_fact: 新插入的事实
            user_id: 用户 ID
            app_name: 应用名称

        Returns:
            MemoryConflict 记录，或 None（无冲突）
        """
        # Stage 1: Key-based 检测 — 同 key 不同 value
        if old_fact.key != new_fact.key:
            return None

        if old_fact.value == new_fact.value:
            return None  # 值完全相同，不是冲突

        # 判定是否真正矛盾（简单启发式）
        conflict_type = self._classify_conflict(old_fact, new_fact)

        if conflict_type == "no_conflict":
            return None

        # 执行解决策略
        resolution = self._determine_resolution(old_fact, new_fact, conflict_type)

        conflict = await self._resolve(
            old_fact=old_fact,
            new_fact=new_fact,
            user_id=user_id,
            app_name=app_name,
            conflict_type=conflict_type,
            resolution=resolution,
            detected_by="key_collision",
        )

        logger.info(
            "conflict_resolved",
            old_key=old_fact.key,
            new_key=new_fact.key,
            conflict_type=conflict_type,
            resolution=resolution,
            user_id=user_id,
        )

        return conflict

    def _classify_conflict(self, old_fact: Fact, new_fact: Fact) -> str:
        """分类冲突类型

        Returns:
            'contradiction' | 'refinement' | 'temporal_update' | 'no_conflict'
        """
        # 同 key，不同 value
        if old_fact.fact_type == "preference":
            return "contradiction"
        if old_fact.fact_type == "rule":
            return "contradiction"
        if old_fact.fact_type == "profile":
            # 个人信息更新通常是 temporal_update
            return "temporal_update"

        return "refinement"

    def _determine_resolution(self, old_fact: Fact, new_fact: Fact, conflict_type: str) -> str:
        """决定解决策略

        Returns:
            'supersede' | 'merge' | 'keep_both'
        """
        if conflict_type == "contradiction":
            # 矛盾事实：新值取代旧值
            return "supersede"
        if conflict_type == "temporal_update":
            # 时间性更新：新值取代旧值
            return "supersede"
        # refinement: 根据置信度决定
        if new_fact.confidence > old_fact.confidence:
            return "supersede"
        return "keep_both"

    async def _resolve(
        self,
        *,
        old_fact: Fact,
        new_fact: Fact,
        user_id: str,
        app_name: str,
        conflict_type: str,
        resolution: str,
        detected_by: str,
    ) -> MemoryConflict:
        """执行冲突解决并记录"""
        confidence_delta = new_fact.confidence - old_fact.confidence

        async with self._session_factory() as db:
            if resolution == "supersede":
                # 标记旧事实为 superseded
                now = datetime.now(UTC)
                await db.execute(
                    update(Fact)
                    .where(Fact.id == old_fact.id)
                    .values(
                        status="superseded",
                        superseded_by=new_fact.id,
                        superseded_at=now,
                    )
                )

            # 创建冲突记录
            conflict = MemoryConflict(
                user_id=user_id,
                app_name=app_name,
                old_fact_id=old_fact.id,
                new_fact_id=new_fact.id,
                conflict_type=conflict_type,
                resolution=resolution,
                confidence_delta=confidence_delta,
                detected_by=detected_by,
                metadata_={
                    "old_key": old_fact.key,
                    "old_value": old_fact.value,
                    "new_key": new_fact.key,
                    "new_value": new_fact.value,
                    "old_confidence": old_fact.confidence,
                    "new_confidence": new_fact.confidence,
                },
            )
            db.add(conflict)
            await db.commit()
            await db.refresh(conflict)

        return conflict

    async def list_conflicts(
        self,
        *,
        user_id: str | None = None,
        app_name: str,
        resolution: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[MemoryConflict]:
        """列出冲突记录"""
        async with self._session_factory() as db:
            stmt = select(MemoryConflict).where(MemoryConflict.app_name == app_name)
            if user_id:
                stmt = stmt.where(MemoryConflict.user_id == user_id)
            if resolution:
                stmt = stmt.where(MemoryConflict.resolution == resolution)
            stmt = stmt.order_by(MemoryConflict.created_at.desc()).offset(offset).limit(limit)
            result = await db.execute(stmt)
            return list(result.scalars().all())

    async def get_fact_history(self, fact_id: UUID) -> list[Fact]:
        """获取事实的版本链（通过 superseded_by 向前追踪）"""
        async with self._session_factory() as db:
            facts: list[Fact] = []

            # 向后追踪：查找被此事实取代的旧事实
            stmt = select(Fact).where(Fact.superseded_by == fact_id)
            result = await db.execute(stmt)
            predecessors = list(result.scalars().all())

            # 向前追踪：查找取代此事实的新事实
            current = await db.get(Fact, fact_id)
            if current:
                facts.append(current)
                successor_id = current.superseded_by
                while successor_id:
                    successor = await db.get(Fact, successor_id)
                    if successor:
                        facts.append(successor)
                        successor_id = successor.superseded_by
                    else:
                        break

            facts.extend(predecessors)
            return facts

    async def manual_resolve(
        self,
        *,
        conflict_id: UUID,
        resolution: str,
    ) -> MemoryConflict | None:
        """手动解决冲突（管理员操作）"""
        if resolution not in ("supersede", "keep_old", "keep_new", "merge"):
            raise ValueError(f"Invalid resolution: {resolution}")

        async with self._session_factory() as db:
            conflict = await db.get(MemoryConflict, conflict_id)
            if not conflict:
                return None

            conflict.resolution = resolution
            conflict.updated_at = datetime.now(UTC)

            if resolution == "keep_old" and conflict.new_fact_id:
                # 恢复旧事实，标记新事实为 superseded
                await db.execute(
                    update(Fact)
                    .where(Fact.id == conflict.new_fact_id)
                    .values(status="superseded", superseded_by=conflict.old_fact_id, superseded_at=datetime.now(UTC))
                )
                if conflict.old_fact_id:
                    await db.execute(
                        update(Fact).where(Fact.id == conflict.old_fact_id).values(status="active", superseded_by=None)
                    )

            elif resolution == "keep_new" and conflict.old_fact_id:
                # 标记旧事实为 superseded，确保新事实为 active
                await db.execute(
                    update(Fact)
                    .where(Fact.id == conflict.old_fact_id)
                    .values(status="superseded", superseded_by=conflict.new_fact_id, superseded_at=datetime.now(UTC))
                )
                if conflict.new_fact_id:
                    await db.execute(
                        update(Fact).where(Fact.id == conflict.new_fact_id).values(status="active", superseded_by=None)
                    )

            elif resolution == "merge" and conflict.old_fact_id and conflict.new_fact_id:
                # 合并：保留旧事实，将新事实的值合并到旧事实中，新事实标记为 superseded
                old = await db.get(Fact, conflict.old_fact_id)
                new = await db.get(Fact, conflict.new_fact_id)
                if old and new:
                    merged_value = {**old.value, **new.value}
                    await db.execute(update(Fact).where(Fact.id == old.id).values(value=merged_value, status="active"))
                    await db.execute(
                        update(Fact)
                        .where(Fact.id == new.id)
                        .values(status="superseded", superseded_by=old.id, superseded_at=datetime.now(UTC))
                    )

            await db.commit()
            await db.refresh(conflict)

        return conflict
