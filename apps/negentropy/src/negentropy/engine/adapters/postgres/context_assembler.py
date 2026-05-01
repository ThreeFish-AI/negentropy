"""
ContextAssembler: 记忆上下文组装器

封装 `get_context_window()` SQL 函数，管理 token 预算分配，
为 Agent 运行时提供记忆增强的上下文注入。

Token 预算分配策略（借鉴 Claude Code POST_COMPACT_TOKEN_BUDGET）：
- 30% 记忆 (memory_ratio) → 高优先级 Facts + 最近 Memories
- 50% 历史 (history_ratio) → 近期对话历史
- 20% 系统 (system_ratio) → 提示词 + 指令

参考文献:
[1] Claude Code compact.ts — POST_COMPACT_TOKEN_BUDGET 分配策略
[2] shareAI-lab learn-claude-code s06 — 三层压缩管线
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import select, text

import negentropy.db.session as db_session
from negentropy.engine.factories.memory import get_fact_service
from negentropy.logging import get_logger
from negentropy.models.base import NEGENTROPY_SCHEMA
from negentropy.models.internalization import Memory

logger = get_logger("negentropy.engine.adapters.postgres.context_assembler")

# 默认 token 预算
_DEFAULT_MAX_TOKENS = 4000
_DEFAULT_MEMORY_RATIO = 0.3
_DEFAULT_HISTORY_RATIO = 0.5
# system_ratio = 1.0 - memory_ratio - history_ratio


class ContextAssembler:
    """记忆上下文组装器

    调用 PostgreSQL 的 `get_context_window()` SQL 函数，
    按 token 预算组装记忆上下文。
    """

    def __init__(
        self,
        *,
        max_tokens: int = _DEFAULT_MAX_TOKENS,
        memory_ratio: float = _DEFAULT_MEMORY_RATIO,
        history_ratio: float = _DEFAULT_HISTORY_RATIO,
    ) -> None:
        self._max_tokens = max_tokens
        self._memory_ratio = memory_ratio
        self._history_ratio = history_ratio

    async def assemble(
        self,
        *,
        user_id: str,
        app_name: str,
        thread_id: str | None = None,
    ) -> dict[str, Any]:
        """组装记忆上下文

        Args:
            user_id: 用户 ID
            app_name: 应用名称
            thread_id: 当前会话 ID（用于获取近期历史）

        Returns:
            {"memory_context": str, "token_count": int, "budget": {...}}
        """
        memory_tokens = int(self._max_tokens * self._memory_ratio)
        history_tokens = int(self._max_tokens * self._history_ratio)

        try:
            result = await self._call_get_context_window(
                user_id=user_id,
                app_name=app_name,
                thread_id=thread_id,
                max_tokens=self._max_tokens,
                memory_tokens=memory_tokens,
                history_tokens=history_tokens,
            )
            return result
        except Exception as exc:
            logger.warning(
                "context_assembly_failed",
                user_id=user_id,
                error=str(exc),
            )
            return {
                "memory_context": "",
                "token_count": 0,
                "budget": {
                    "max_tokens": self._max_tokens,
                    "memory_ratio": self._memory_ratio,
                    "history_ratio": self._history_ratio,
                },
            }

    async def _call_get_context_window(
        self,
        *,
        user_id: str,
        app_name: str,
        thread_id: str | None,
        max_tokens: int,
        memory_tokens: int,
        history_tokens: int,
    ) -> dict[str, Any]:
        """调用 SQL 函数 get_context_window()"""
        sql = text(f"""
            SELECT context_text, token_estimate
            FROM {NEGENTROPY_SCHEMA}.get_context_window(
                :user_id, :app_name, :thread_id,
                :max_tokens, :memory_ratio, :history_ratio
            )
        """)

        async with db_session.AsyncSessionLocal() as db:
            result = await db.execute(
                sql,
                {
                    "user_id": user_id,
                    "app_name": app_name,
                    "thread_id": thread_id,
                    "max_tokens": max_tokens,
                    "memory_ratio": self._memory_ratio,
                    "history_ratio": self._history_ratio,
                },
            )
            row = result.first()

        if row is None:
            return {
                "memory_context": "",
                "token_count": 0,
                "budget": {"max_tokens": max_tokens},
            }

        return {
            "memory_context": row.context_text or "",
            "token_count": row.token_estimate or 0,
            "budget": {
                "max_tokens": max_tokens,
                "memory_tokens": memory_tokens,
                "history_tokens": history_tokens,
            },
        }

    async def get_memory_summary(
        self,
        *,
        user_id: str,
        app_name: str,
    ) -> str:
        """获取用户记忆摘要（轻量接口，用于注入到查询上下文）

        不依赖 SQL 函数，直接查询最近的记忆和事实。
        """
        parts: list[str] = []

        # 获取最近的记忆
        async with db_session.AsyncSessionLocal() as db:
            stmt = (
                select(Memory)
                .where(Memory.user_id == user_id, Memory.app_name == app_name)
                .order_by(Memory.created_at.desc())
                .limit(5)
            )
            result = await db.execute(stmt)
            memories = result.scalars().all()

        for m in memories:
            if m.content and m.retention_score and m.retention_score > 0.3:
                snippet = m.content[:200] + ("..." if len(m.content) > 200 else "")
                parts.append(f"[Memory] {snippet}")

        # 获取活跃事实
        fact_service = get_fact_service()
        facts = await fact_service.list_facts(user_id=user_id, app_name=app_name, limit=10)

        for f in facts:
            value_text = str(f.value)[:100]
            parts.append(f"[Fact:{f.fact_type}] {f.key}: {value_text}")

        context = "\n".join(parts)
        logger.debug(
            "memory_summary_assembled",
            user_id=user_id,
            memories_count=len(memories),
            facts_count=len(facts),
            context_length=len(context),
        )
        return context
