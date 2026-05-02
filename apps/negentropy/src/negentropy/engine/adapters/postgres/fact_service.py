"""
FactService: Fact (语义记忆) 的 CRUD 服务层

为 Fact ORM 模型提供完整的 upsert/get/search/delete 操作，
复用现有 DB Session 和 ORM 模型。

Fact 表示从对话中提取的结构化知识（用户偏好、配置、事实性知识等），
与 Memory（情景记忆）形成互补。

语义记忆的特点：
- 结构化: key-value 格式
- 持久化: 不受遗忘曲线影响
- 有效期: 支持 valid_from/valid_until 时间窗口
- 置信度: confidence 表示提取可靠性

参考文献:
[1] A. Ebbinghaus, "Memory: A Contribution to Experimental Psychology," 1885.
[2] Google ADK, "MemoryBank" pattern for structured fact storage.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

import negentropy.db.session as db_session
from negentropy.engine.governance.memory import MemoryGovernanceService
from negentropy.logging import get_logger
from negentropy.models.internalization import Fact

logger = get_logger("negentropy.engine.adapters.postgres.fact_service")


class FactService:
    """Fact (语义记忆) CRUD 服务

    提供 upsert/get/search/delete 操作，
    基于 (user_id, app_name, fact_type, key) 唯一约束实现 upsert。
    """

    def __init__(self, embedding_fn: callable | None = None):
        self._embedding_fn = embedding_fn
        self._governance = MemoryGovernanceService()

    async def upsert_fact(
        self,
        *,
        user_id: str,
        app_name: str,
        fact_type: str = "preference",
        key: str,
        value: dict[str, Any],
        confidence: float = 1.0,
        valid_from: datetime | None = None,
        valid_until: datetime | None = None,
        thread_id: UUID | None = None,
    ) -> Fact:
        """创建或更新 Fact

        基于 (user_id, app_name, fact_type, key) 唯一约束，
        存在则更新 value/confidence/valid_until，不存在则创建。

        Args:
            user_id: 用户 ID
            app_name: 应用名称
            fact_type: 事实类型 (preference/profile/knowledge)
            key: 事实键
            value: 事实值 (JSONB)
            confidence: 置信度 (0.0-1.0)
            valid_from: 生效时间
            valid_until: 失效时间
            thread_id: 关联的 Thread ID

        Returns:
            创建或更新的 Fact 实例
        """
        # 生成向量 (用于语义检索)
        embedding = None
        if self._embedding_fn:
            text_for_embedding = f"{key}: {str(value)}"
            try:
                embedding = await self._embedding_fn(text_for_embedding)
            except Exception as exc:
                logger.warning(
                    "fact_embedding_failed",
                    key=key,
                    error=str(exc),
                )

        now = datetime.now(UTC)

        importance = self._governance.calculate_importance_score(
            access_count=0,
            memory_type=fact_type,
            related_fact_count=0,
            days_since_creation=0.0,
            days_since_last_access=0.0,
        )

        async with db_session.AsyncSessionLocal() as db:
            stmt = (
                pg_insert(Fact)
                .values(
                    user_id=user_id,
                    app_name=app_name,
                    fact_type=fact_type,
                    key=key,
                    value=value,
                    confidence=confidence,
                    importance_score=importance,
                    embedding=embedding,
                    valid_from=valid_from or now,
                    valid_until=valid_until,
                    thread_id=thread_id,
                )
                .on_conflict_do_update(
                    constraint="facts_user_key_unique",
                    set_={
                        "value": value,
                        "confidence": confidence,
                        "embedding": embedding,
                        "valid_until": valid_until,
                        "importance_score": importance,
                    },
                )
                .returning(Fact)
            )
            result = await db.execute(stmt)
            await db.commit()
            fact = result.scalar_one()

        logger.info(
            "fact_upserted",
            user_id=user_id,
            key=key,
            fact_type=fact_type,
        )

        # 异步冲突检测（fire-and-forget，不阻塞主路径）
        try:
            await self._detect_conflicts(
                new_fact=fact,
                user_id=user_id,
                app_name=app_name,
            )
        except Exception as exc:
            logger.debug("conflict_detection_failed", key=key, error=str(exc))

        return fact

    async def get_fact(
        self,
        *,
        user_id: str,
        app_name: str,
        key: str,
        fact_type: str | None = None,
    ) -> Fact | None:
        """按 key 精确获取 Fact

        自动过滤已失效的 Fact (valid_until < now)。

        Args:
            user_id: 用户 ID
            app_name: 应用名称
            key: 事实键
            fact_type: 可选的事实类型过滤

        Returns:
            Fact 实例或 None
        """
        now = datetime.now(UTC)

        async with db_session.AsyncSessionLocal() as db:
            stmt = select(Fact).where(
                Fact.user_id == user_id,
                Fact.app_name == app_name,
                Fact.key == key,
            )

            if fact_type:
                stmt = stmt.where(Fact.fact_type == fact_type)

            # 过滤已失效的 Fact
            stmt = stmt.where((Fact.valid_until.is_(None)) | (Fact.valid_until > now))

            result = await db.execute(stmt)
            return result.scalar_one_or_none()

    async def search_facts(
        self,
        *,
        user_id: str,
        app_name: str,
        query: str,
        limit: int = 10,
    ) -> list[Fact]:
        """搜索相关 Fact

        优先使用向量语义检索，回退到 key ilike 匹配。

        Args:
            user_id: 用户 ID
            app_name: 应用名称
            query: 搜索查询
            limit: 返回数量限制

        Returns:
            匹配的 Fact 列表
        """
        now = datetime.now(UTC)

        # 尝试向量语义检索
        if self._embedding_fn:
            try:
                query_embedding = await self._embedding_fn(query)
                return await self._semantic_search_facts(
                    user_id=user_id,
                    app_name=app_name,
                    query_embedding=query_embedding,
                    limit=limit,
                    now=now,
                )
            except Exception as exc:
                logger.warning(
                    "fact_semantic_search_failed",
                    error=str(exc),
                    fallback="ilike",
                )

        # 回退到 ilike 搜索
        async with db_session.AsyncSessionLocal() as db:
            stmt = (
                select(Fact)
                .where(
                    Fact.user_id == user_id,
                    Fact.app_name == app_name,
                    Fact.key.ilike(f"%{query}%"),
                    (Fact.valid_until.is_(None)) | (Fact.valid_until > now),
                )
                .order_by(Fact.created_at.desc())
                .limit(limit)
            )
            result = await db.execute(stmt)
            return list(result.scalars().all())

    async def _semantic_search_facts(
        self,
        *,
        user_id: str,
        app_name: str,
        query_embedding: list[float],
        limit: int,
        now: datetime,
    ) -> list[Fact]:
        """向量语义检索 Fact"""
        async with db_session.AsyncSessionLocal() as db:
            distance = Fact.embedding.op("<=>")(query_embedding)
            stmt = (
                select(Fact)
                .where(
                    Fact.user_id == user_id,
                    Fact.app_name == app_name,
                    Fact.embedding.is_not(None),
                    (Fact.valid_until.is_(None)) | (Fact.valid_until > now),
                )
                .order_by(distance.asc())
                .limit(limit)
            )
            result = await db.execute(stmt)
            return list(result.scalars().all())

    async def delete_fact(
        self,
        *,
        user_id: str,
        app_name: str,
        key: str,
        fact_type: str | None = None,
    ) -> bool:
        """删除指定 Fact

        Args:
            user_id: 用户 ID
            app_name: 应用名称
            key: 事实键
            fact_type: 可选的事实类型过滤

        Returns:
            是否成功删除
        """
        async with db_session.AsyncSessionLocal() as db:
            stmt = select(Fact).where(
                Fact.user_id == user_id,
                Fact.app_name == app_name,
                Fact.key == key,
            )
            if fact_type:
                stmt = stmt.where(Fact.fact_type == fact_type)

            result = await db.execute(stmt)
            fact = result.scalar_one_or_none()

            if not fact:
                return False

            await db.delete(fact)
            await db.commit()

        logger.info(
            "fact_deleted",
            user_id=user_id,
            key=key,
        )
        return True

    async def list_facts(
        self,
        *,
        user_id: str,
        app_name: str,
        fact_type: str | None = None,
        limit: int = 100,
    ) -> list[Fact]:
        """列出用户的所有有效 Fact

        Args:
            user_id: 用户 ID
            app_name: 应用名称
            fact_type: 可选的事实类型过滤
            limit: 返回数量限制

        Returns:
            Fact 列表
        """
        now = datetime.now(UTC)

        async with db_session.AsyncSessionLocal() as db:
            stmt = select(Fact).where(
                Fact.user_id == user_id,
                Fact.app_name == app_name,
                Fact.status == "active",
                (Fact.valid_until.is_(None)) | (Fact.valid_until > now),
            )

            if fact_type:
                stmt = stmt.where(Fact.fact_type == fact_type)

            stmt = stmt.order_by(Fact.created_at.desc()).limit(limit)

            result = await db.execute(stmt)
            return list(result.scalars().all())

    @staticmethod
    def _cosine_similarity(a: list[float], b: list[float]) -> float:
        """计算两个向量的余弦相似度"""
        dot = sum(x * y for x, y in zip(a, b, strict=True))
        norm_a = sum(x * x for x in a) ** 0.5
        norm_b = sum(x * x for x in b) ** 0.5
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    async def merge_similar_facts(
        self,
        *,
        user_id: str,
        app_name: str,
        similarity_threshold: float = 0.85,
    ) -> int:
        """合并语义相似的 Facts（近重复检测<sup>[[38]](#ref38)</sup>）

        加载用户全部有效 facts，两两比对 embedding 余弦相似度。
        相似度超阈值且 type 相同 → 保留高 confidence、删除低 confidence。

        Returns:
            合并的 fact 数量
        """
        if not self._embedding_fn:
            return 0

        facts = await self.list_facts(user_id=user_id, app_name=app_name, limit=200)
        if len(facts) < 2:
            return 0

        # 生成 embedding
        embedded: list[tuple[Fact, list[float]]] = []
        for f in facts:
            text = f"{f.key}: {str(f.value)}"
            try:
                emb = await self._embedding_fn(text)
                if emb:
                    embedded.append((f, emb))
            except Exception:
                continue

        merged = 0
        seen: set[UUID] = set()
        for i, (f1, e1) in enumerate(embedded):
            if f1.id in seen:
                continue
            for j, (f2, e2) in enumerate(embedded):
                if j <= i or f2.id in seen:
                    continue
                if f1.fact_type != f2.fact_type:
                    continue
                sim = self._cosine_similarity(e1, e2)
                if sim >= similarity_threshold:
                    drop = f2 if f1.confidence >= f2.confidence else f1
                    await self.delete_fact(
                        user_id=user_id,
                        app_name=app_name,
                        key=drop.key,
                        fact_type=drop.fact_type,
                    )
                    seen.add(drop.id)
                    merged += 1
                    # 锚点被删除后停止内层循环，避免用已删除事实的 embedding 继续比对
                    if f1.id in seen:
                        break

        if merged:
            logger.info("facts_merged", user_id=user_id, merged_count=merged)
        return merged

    async def _detect_conflicts(
        self,
        *,
        new_fact: Fact,
        user_id: str,
        app_name: str,
    ) -> None:
        """检测新事实与现有事实的冲突

        查找同 user+app+type 下的旧事实（status=active），检查是否冲突。
        """
        from negentropy.engine.governance.conflict_resolver import ConflictResolver

        resolver = ConflictResolver()

        # 查找同 key 的旧事实（被 upsert 覆盖的）
        async with db_session.AsyncSessionLocal() as db:
            stmt = (
                select(Fact)
                .where(
                    Fact.user_id == user_id,
                    Fact.app_name == app_name,
                    Fact.key == new_fact.key,
                    Fact.fact_type == new_fact.fact_type,
                    Fact.id != new_fact.id,
                    Fact.status == "superseded",
                )
                .order_by(Fact.superseded_at.desc())
                .limit(1)
            )
            result = await db.execute(stmt)
            old_fact = result.scalar_one_or_none()

        if old_fact and old_fact.value != new_fact.value:
            await resolver.detect_and_resolve(
                old_fact=old_fact,
                new_fact=new_fact,
                user_id=user_id,
                app_name=app_name,
            )
