"""
Memory Governance Service

提供用户记忆的审计、版本控制和治理功能。

职责:
1. 记忆审计决策处理
2. 版本冲突检测
3. 幂等性保障
4. 记忆保留策略执行

参考文献:
[1] A. Ebbinghaus, "Memory: A Contribution to Experimental Psychology," 1885.

遵循 AGENTS.md 原则：
- Single Responsibility: 只处理记忆治理逻辑
- Boundary Management: 与存储层分离
- Feedback Loops: 提供审计决策反馈
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.internalization import Fact, Memory, MemoryAuditLog

logger = get_logger("negentropy.engine.governance.memory")

# 记忆类型衰减率映射（ACT-R<sup>[[45]](#ref45)</sup> + FadeMem<sup>[[46]](#ref46)</sup>）
# Phase 4：新增 semantic（极慢衰减，对齐 CLS 互补学习理论<sup>[[2]](#ref2)</sup>）与 core（不衰减，常驻）
_MEMORY_TYPE_DECAY_RATES: dict[str, float] = {
    "core": 0.0,
    "semantic": 0.005,
    "preference": 0.05,
    "procedural": 0.06,
    "fact": 0.08,
    "episodic": 0.10,
}
_DEFAULT_DECAY_RATE = 0.10

_MEMORY_TYPE_MULTIPLIER: dict[str, float] = {
    "core": 1.5,
    "semantic": 1.4,
    "preference": 1.3,
    "procedural": 1.2,
    "fact": 1.15,
    "episodic": 1.0,
}

# 重要性评分类型权重（ACT-R 基础水平激活<sup>[[45]](#ref45)</sup>）
_MEMORY_TYPE_IMPORTANCE_WEIGHT: dict[str, float] = {
    "core": 1.0,
    "semantic": 0.95,
    "preference": 0.9,
    "procedural": 0.75,
    "fact": 0.6,
    "episodic": 0.4,
}
_DEFAULT_IMPORTANCE_WEIGHT = 0.4

# 已知合法的 memory_type 集合（Schema CHECK 兜底，避免脏数据）
VALID_MEMORY_TYPES: frozenset[str] = frozenset(_MEMORY_TYPE_DECAY_RATES.keys())


@dataclass(frozen=True)
class AuditRecord:
    """审计记录

    表示一次记忆审计决策的记录。
    """

    memory_id: str
    decision: str
    version: int | None = None
    note: str | None = None
    created_at: datetime | None = None


class MemoryGovernanceService:
    """用户记忆治理服务

    负责处理用户记忆的审计决策，包括保留、删除和匿名化操作。
    提供版本控制和幂等性保障。

    职责:
    1. 验证审计决策
    2. 检测版本冲突
    3. 执行审计决策
    4. 记录审计历史
    """

    def __init__(self, session_factory: type[AsyncSession] = AsyncSessionLocal) -> None:
        """初始化记忆治理服务"""
        self._session_factory = session_factory

    async def audit_memory(
        self,
        *,
        user_id: str,
        app_name: str,
        decisions: dict[str, str],
        expected_versions: dict[str, int] | None = None,
        note: str | None = None,
        idempotency_key: str | None = None,
    ) -> list[AuditRecord]:
        """处理用户记忆审计决策

        决策类型:
        - "retain": 保留记忆
        - "delete": 删除记忆
        - "anonymize": 匿名化处理（保留数据但移除 PII）

        Args:
            user_id: 用户 ID
            app_name: 应用名称
            decisions: {memory_id: decision} 映射
            expected_versions: 乐观锁版本号（用于版本冲突检测）
            note: 审计备注
            idempotency_key: 幂等性键（用于防止重复提交）

        Returns:
            审计记录列表

        Raises:
            ValueError: 版本冲突时抛出
        """
        logger.info(
            "audit_memory_started",
            user_id=user_id,
            app_name=app_name,
            decision_count=len(decisions),
            has_expected_versions=expected_versions is not None,
            idempotency_key=idempotency_key,
        )

        # 幂等性检查
        if idempotency_key:
            existing_records = await self._get_idempotent_records(
                app_name=app_name,
                user_id=user_id,
                idempotency_key=idempotency_key,
            )
            if existing_records:
                logger.info(
                    "audit_memory_idempotent",
                    idempotency_key=idempotency_key,
                    record_count=len(existing_records),
                )
                return existing_records

        records: list[AuditRecord] = []

        # 验证决策
        self._validate_decisions(decisions)

        async with self._session_factory() as db:
            # 处理每个决策
            for memory_id, decision in decisions.items():
                # 检查版本冲突
                if expected_versions and memory_id in expected_versions:
                    current_version = await self._get_current_version(
                        db=db,
                        app_name=app_name,
                        user_id=user_id,
                        memory_id=memory_id,
                    )
                    expected_version = expected_versions[memory_id]

                    if current_version != expected_version:
                        logger.warning(
                            "audit_memory_version_conflict",
                            memory_id=memory_id,
                            expected_version=expected_version,
                            actual_version=current_version,
                        )
                        raise ValueError(
                            f"Version conflict for memory '{memory_id}': "
                            f"expected {expected_version}, got {current_version}"
                        )

                # 执行决策
                await self._execute_decision(
                    db=db,
                    app_name=app_name,
                    user_id=user_id,
                    memory_id=memory_id,
                    decision=decision,
                )

                # 创建审计记录
                next_version = await self._get_next_version(
                    db=db,
                    app_name=app_name,
                    user_id=user_id,
                    memory_id=memory_id,
                )

                audit_log = MemoryAuditLog(
                    app_name=app_name,
                    user_id=user_id,
                    memory_id=memory_id,
                    decision=decision,
                    note=note,
                    idempotency_key=idempotency_key,
                    version=next_version,
                )
                db.add(audit_log)

                record = AuditRecord(
                    memory_id=memory_id,
                    decision=decision,
                    version=next_version,
                    note=note,
                    created_at=datetime.now(),
                )
                records.append(record)

                logger.debug(
                    "audit_memory_decision_executed",
                    memory_id=memory_id,
                    decision=decision,
                    version=next_version,
                )

            await db.commit()

        logger.info(
            "audit_memory_completed",
            user_id=user_id,
            record_count=len(records),
        )

        return records

    async def get_audit_history(
        self,
        *,
        user_id: str,
        app_name: str,
        limit: int = 100,
    ) -> list[AuditRecord]:
        """获取审计历史

        Args:
            user_id: 用户 ID
            app_name: 应用名称
            limit: 返回记录数量限制

        Returns:
            审计记录列表
        """
        logger.debug(
            "get_audit_history_started",
            user_id=user_id,
            app_name=app_name,
            limit=limit,
        )

        async with self._session_factory() as db:
            stmt = (
                select(MemoryAuditLog)
                .where(
                    MemoryAuditLog.app_name == app_name,
                    MemoryAuditLog.user_id == user_id,
                )
                .order_by(MemoryAuditLog.created_at.desc())
                .limit(limit)
            )
            result = await db.execute(stmt)
            audit_logs = result.scalars().all()

        records = [
            AuditRecord(
                memory_id=log.memory_id,
                decision=log.decision,
                version=log.version,
                note=log.note,
                created_at=log.created_at,
            )
            for log in audit_logs
        ]

        logger.debug(
            "get_audit_history_completed",
            user_id=user_id,
            record_count=len(records),
        )

        return records

    def calculate_importance_score(
        self,
        *,
        access_count: int = 0,
        memory_type: str = "episodic",
        related_fact_count: int = 0,
        days_since_creation: float = 0.0,
        days_since_last_access: float = 0.0,
    ) -> float:
        """计算记忆重要性评分

        五因子加权公式 (ACT-R 基础水平激活<sup>[[45]](#ref45)</sup> + FadeMem<sup>[[46]](#ref46)</sup>):

            importance = min(1.0,
                base_activation * 0.30 +    # ACT-R log-sum 访问间隔
                access_frequency * 0.25 +   # log(access_count) 归一化
                fact_support * 0.20 +       # 关联事实数 / 10
                type_weight * 0.15 +        # preference > procedural > fact > episodic
                recency_bonus * 0.10        # max(0, 1 - days_since_creation / 90)
            )

        Args:
            access_count: 访问次数
            memory_type: 记忆类型
            related_fact_count: 关联事实数量
            days_since_creation: 距创建天数
            days_since_last_access: 距最后访问天数

        Returns:
            重要性评分 (0.0 - 1.0)
        """
        # Factor 1: 基础激活 (ACT-R 简化公式)
        if access_count > 0:
            base_activation = min(
                1.0, math.log(1 + access_count) / math.log(1 + max(1, days_since_last_access + 1) ** 0.5)
            )
        else:
            base_activation = 0.1

        # Factor 2: 访问频率 (对数饱和)
        access_frequency = min(1.0, math.log(1 + access_count) / math.log(101))

        # Factor 3: 事实支撑 (每个事实贡献 0.1, 上限 1.0)
        fact_support = min(1.0, related_fact_count / 10.0)

        # Factor 4: 类型权重
        type_weight = _MEMORY_TYPE_IMPORTANCE_WEIGHT.get(memory_type, _DEFAULT_IMPORTANCE_WEIGHT)

        # Factor 5: 时效性加成 (90 天衰减)
        recency_bonus = max(0.0, 1.0 - days_since_creation / 90.0)

        importance = min(
            1.0,
            base_activation * 0.30
            + access_frequency * 0.25
            + fact_support * 0.20
            + type_weight * 0.15
            + recency_bonus * 0.10,
        )

        logger.debug(
            "calculate_importance_score",
            importance=importance,
            base_activation=base_activation,
            access_frequency=access_frequency,
            fact_support=fact_support,
            type_weight=type_weight,
            recency_bonus=recency_bonus,
            memory_type=memory_type,
        )

        return max(0.0, importance)

    async def calculate_retention_score(
        self,
        *,
        memory_id: str,
        access_count: int,
        last_accessed_at: datetime,
        created_at: datetime,
        memory_type: str = "episodic",
        related_count: int | None = None,
        lambda_: float | None = None,
    ) -> float:
        """多因子自适应保留评分

        五因子公式:
            retention = min(1.0, time_decay × frequency_boost × type_multiplier
                            × semantic_importance / 5.0 + recency_bonus)

        因子：
        1. 时间衰减（Ebbinghaus 指数衰减 + 类型特定 λ）
        2. 频率增强（对数饱和）
        3. 类型乘子（偏好 > 流程 > 事实 > 情景）
        4. 语义重要性（关联记忆/事实数量加成）
        5. 时效性加成（近期创建的记忆额外加分）

        参考文献:
        [1] Ebbinghaus, "Memory," 1885.
        [2] Anderson et al., "An Integrated Theory of the Mind,"
            *Psychological Review*, vol. 111, no. 4, pp. 1036-1060, 2004.
        [3] FadeMem, arXiv:2601.18642, 2026.

        Args:
            memory_id: 记忆 ID
            access_count: 访问次数
            last_accessed_at: 最后访问时间
            created_at: 创建时间
            memory_type: 记忆类型（影响衰减率）
            related_count: 关联记忆/事实数量（None 时自动查询 DB）
            lambda_: 自定义衰减常数（覆盖类型默认值）

        Returns:
            保留分数 (0.0 - 1.0)
        """
        now = datetime.now()

        # Factor 1: 时间衰减（类型特定 λ）
        days_since_access = max(0, (now - last_accessed_at).total_seconds() / 86400)
        effective_lambda = (
            lambda_ if lambda_ is not None else _MEMORY_TYPE_DECAY_RATES.get(memory_type, _DEFAULT_DECAY_RATE)
        )
        time_decay = math.exp(-effective_lambda * days_since_access)

        # Factor 2: 频率增强（对数饱和）
        frequency_boost = 1.0 + math.log(1.0 + access_count)

        # Factor 3: 类型乘子
        type_multiplier = _MEMORY_TYPE_MULTIPLIER.get(memory_type, 1.0)

        # Factor 4: 语义重要性（网络效应 — 关联越多越重要）
        effective_related_count = (
            related_count if related_count is not None else await self._get_related_count(memory_id)
        )
        semantic_importance = 1.0 + min(0.5, effective_related_count * 0.1)

        # Factor 5: 时效性加成（1 年内创建的记忆获得额外加分）
        days_since_creation = max(0, (now - created_at).total_seconds() / 86400)
        recency_bonus = max(0, 1.0 - days_since_creation / 365.0) * 0.1

        # 综合评分
        retention_score = time_decay * frequency_boost * type_multiplier * semantic_importance / 5.0 + recency_bonus

        logger.debug(
            "calculate_retention_score",
            memory_id=memory_id,
            retention_score=retention_score,
            time_decay=time_decay,
            frequency_boost=frequency_boost,
            type_multiplier=type_multiplier,
            semantic_importance=semantic_importance,
            recency_bonus=recency_bonus,
            memory_type=memory_type,
            effective_lambda=effective_lambda,
        )

        return max(0.0, min(1.0, retention_score))

    def _validate_decisions(self, decisions: dict[str, str]) -> None:
        """验证审计决策

        Args:
            decisions: 决策映射

        Raises:
            ValueError: 决策值无效时抛出
        """
        valid_actions = {"retain", "delete", "anonymize"}

        for memory_id, decision in decisions.items():
            if decision not in valid_actions:
                raise ValueError(
                    f"Invalid decision '{decision}' for memory '{memory_id}'. Must be one of {valid_actions}"
                )

    async def _get_related_count(self, memory_id: str) -> int:
        """查询记忆的关联数量（同 thread 的事实 + 其他记忆）

        用于多因子评分的语义重要性因子。
        """
        async with self._session_factory() as db:
            memory_stmt = select(Memory.thread_id).where(Memory.id == memory_id)
            result = await db.execute(memory_stmt)
            thread_id = result.scalar_one_or_none()
            if thread_id is None:
                return 0

            fact_count_stmt = select(func.count()).select_from(Fact).where(Fact.thread_id == thread_id)
            fact_count = (await db.execute(fact_count_stmt)).scalar() or 0

            mem_count_stmt = (
                select(func.count())
                .select_from(Memory)
                .where(
                    Memory.thread_id == thread_id,
                    Memory.id != memory_id,
                )
            )
            mem_count = (await db.execute(mem_count_stmt)).scalar() or 0

            return fact_count + mem_count

    async def _get_current_version(
        self,
        *,
        db: AsyncSession,
        app_name: str,
        user_id: str,
        memory_id: str,
    ) -> int:
        """获取当前版本号

        Args:
            db: 数据库会话
            app_name: 应用名称
            user_id: 用户 ID
            memory_id: 记忆 ID

        Returns:
            当前版本号（0 如果不存在）
        """
        stmt = select(func.max(MemoryAuditLog.version)).where(
            MemoryAuditLog.app_name == app_name,
            MemoryAuditLog.user_id == user_id,
            MemoryAuditLog.memory_id == memory_id,
        )
        result = await db.execute(stmt)
        current_version = result.scalar_one()
        return current_version if current_version is not None else 0

    async def _get_next_version(
        self,
        *,
        db: AsyncSession,
        app_name: str,
        user_id: str,
        memory_id: str,
    ) -> int:
        """获取下一个版本号

        Args:
            db: 数据库会话
            app_name: 应用名称
            user_id: 用户 ID
            memory_id: 记忆 ID

        Returns:
            下一个版本号
        """
        current_version = await self._get_current_version(
            db=db,
            app_name=app_name,
            user_id=user_id,
            memory_id=memory_id,
        )
        return current_version + 1

    async def _execute_decision(
        self,
        *,
        db: AsyncSession,
        app_name: str,
        user_id: str,
        memory_id: str,
        decision: str,
    ) -> None:
        """执行审计决策

        同时处理 Memory 和关联的 Fact 记录，确保 GDPR 合规:
        - delete: 物理删除 Memory 和关联 Fact
        - anonymize: 匿名化 Memory 和关联 Fact（保留统计价值但移除 PII）
        - retain: 保留，不做操作

        Args:
            db: 数据库会话
            app_name: 应用名称
            user_id: 用户 ID
            memory_id: 记忆 ID
            decision: 决策类型
        """
        if decision == "delete":
            # 删除 Memory
            stmt = select(Memory).where(
                Memory.app_name == app_name,
                Memory.user_id == user_id,
                Memory.id == memory_id,
            )
            result = await db.execute(stmt)
            memory = result.scalar_one_or_none()
            if memory:
                # 同时删除关联的 Fact 记录（同一用户、同一 thread）
                if memory.thread_id:
                    fact_stmt = select(Fact).where(
                        Fact.app_name == app_name,
                        Fact.user_id == user_id,
                        Fact.thread_id == memory.thread_id,
                    )
                    fact_result = await db.execute(fact_stmt)
                    facts = fact_result.scalars().all()
                    for fact in facts:
                        await db.delete(fact)
                        logger.debug("execute_decision_delete_fact", fact_key=fact.key)

                await db.delete(memory)
                logger.debug("execute_decision_delete", memory_id=memory_id)

        elif decision == "anonymize":
            # 匿名化 Memory
            stmt = select(Memory).where(
                Memory.app_name == app_name,
                Memory.user_id == user_id,
                Memory.id == memory_id,
            )
            result = await db.execute(stmt)
            memory = result.scalar_one_or_none()
            if memory:
                memory.content = "[ANONYMIZED]"
                memory.metadata_ = {}
                memory.embedding = None  # 清除向量表示

                # 匿名化关联的 Fact 记录
                if memory.thread_id:
                    fact_stmt = select(Fact).where(
                        Fact.app_name == app_name,
                        Fact.user_id == user_id,
                        Fact.thread_id == memory.thread_id,
                    )
                    fact_result = await db.execute(fact_stmt)
                    facts = fact_result.scalars().all()
                    for fact in facts:
                        fact.value = {"anonymized": True}
                        fact.embedding = None
                        logger.debug("execute_decision_anonymize_fact", fact_key=fact.key)

                logger.debug("execute_decision_anonymize", memory_id=memory_id)

        elif decision == "retain":
            logger.debug("execute_decision_retain", memory_id=memory_id)

    async def _get_idempotent_records(
        self,
        *,
        app_name: str,
        user_id: str,
        idempotency_key: str,
    ) -> list[AuditRecord] | None:
        """获取幂等性键对应的记录

        Args:
            app_name: 应用名称
            user_id: 用户 ID
            idempotency_key: 幂等性键

        Returns:
            之前的审计记录（如果存在），否则返回 None
        """
        async with self._session_factory() as db:
            stmt = select(MemoryAuditLog).where(
                MemoryAuditLog.app_name == app_name,
                MemoryAuditLog.user_id == user_id,
                MemoryAuditLog.idempotency_key == idempotency_key,
            )
            result = await db.execute(stmt)
            audit_logs = result.scalars().all()

        if not audit_logs:
            return None

        return [
            AuditRecord(
                memory_id=log.memory_id,
                decision=log.decision,
                version=log.version,
                note=log.note,
                created_at=log.created_at,
            )
            for log in audit_logs
        ]
