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

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.internalization import Memory, MemoryAuditLog

logger = get_logger("negentropy.engine.governance.memory")


@dataclass(frozen=True)
class AuditRecord:
    """审计记录

    表示一次记忆审计决策的记录。
    """
    memory_id: str
    decision: str
    version: Optional[int] = None
    note: Optional[str] = None
    created_at: Optional[datetime] = None


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
        decisions: Dict[str, str],
        expected_versions: Optional[Dict[str, int]] = None,
        note: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> List[AuditRecord]:
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

        records: List[AuditRecord] = []

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
    ) -> List[AuditRecord]:
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

    async def calculate_retention_score(
        self,
        *,
        memory_id: str,
        access_count: int,
        last_accessed_at: datetime,
        created_at: datetime,
    ) -> float:
        """计算记忆保留分数

        基于艾宾浩斯遗忘曲线计算记忆的保留分数。
        分数越高表示记忆越重要，应该保留。

        参考文献:
        [1] A. Ebbinghaus, "Memory: A Contribution to Experimental Psychology,"
            1885. (艾宾浩斯遗忘曲线)

        Args:
            memory_id: 记忆 ID
            access_count: 访问次数
            last_accessed_at: 最后访问时间
            created_at: 创建时间

        Returns:
            保留分数 (0.0 - 1.0)
        """
        # 计算时间衰减因子
        now = datetime.now()
        days_since_creation = (now - created_at).days
        days_since_access = (now - last_accessed_at).days

        # 艾宾浩斯遗忘曲线简化模型
        # R(t) = e^(-t/S)
        # 其中 t 是时间，S 是记忆强度（与访问次数相关）

        memory_strength = 1.0 + (access_count * 0.1)  # 记忆强度
        time_decay = max(0.0, 1.0 - (days_since_access / (memory_strength * 365)))

        # 访问频率因子
        access_frequency_factor = min(1.0, access_count / 10.0)

        # 综合保留分数
        retention_score = (time_decay * 0.7) + (access_frequency_factor * 0.3)

        logger.debug(
            "calculate_retention_score",
            memory_id=memory_id,
            retention_score=retention_score,
            access_count=access_count,
            days_since_access=days_since_access,
        )

        return max(0.0, min(1.0, retention_score))

    def _validate_decisions(self, decisions: Dict[str, str]) -> None:
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
                    f"Invalid decision '{decision}' for memory '{memory_id}'. "
                    f"Must be one of {valid_actions}"
                )

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

        Args:
            db: 数据库会话
            app_name: 应用名称
            user_id: 用户 ID
            memory_id: 记忆 ID
            decision: 决策类型
        """
        if decision == "delete":
            # 执行删除操作
            stmt = select(Memory).where(
                Memory.app_name == app_name,
                Memory.user_id == user_id,
                Memory.id == memory_id,
            )
            result = await db.execute(stmt)
            memory = result.scalar_one_or_none()
            if memory:
                await db.delete(memory)
                logger.debug("execute_decision_delete", memory_id=memory_id)
        elif decision == "anonymize":
            # 执行匿名化操作（移除 PII）
            stmt = select(Memory).where(
                Memory.app_name == app_name,
                Memory.user_id == user_id,
                Memory.id == memory_id,
            )
            result = await db.execute(stmt)
            memory = result.scalar_one_or_none()
            if memory:
                # 简单的匿名化：清空 content 和 metadata
                memory.content = "[ANONYMIZED]"
                memory.metadata_ = {}
                logger.debug("execute_decision_anonymize", memory_id=memory_id)
        elif decision == "retain":
            logger.debug("execute_decision_retain", memory_id=memory_id)

    async def _get_idempotent_records(
        self,
        *,
        app_name: str,
        user_id: str,
        idempotency_key: str,
    ) -> Optional[List[AuditRecord]]:
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
