"""
ContextAssembler: 上下文组装器

负责根据 Token 预算动态组装上下文窗口：
- System Prompt
- Top-K Memories (按相关性)
- Recent History (最近对话)
- Facts (用户偏好)
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any

import asyncpg


@dataclass
class ContextItem:
    """上下文项"""

    context_type: str  # 'system', 'memory', 'history', 'fact'
    content: str
    relevance_score: float = 1.0
    token_estimate: int = 0
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ContextWindow:
    """组装后的上下文窗口"""

    items: list[ContextItem]
    total_tokens: int
    budget_used: float  # 使用的预算比例


class ContextAssembler:
    """
    上下文组装器

    职责:
    1. 根据 Token 预算分配各部分上下文
    2. 按相关性和重要性排序
    3. 动态截断以适应预算
    """

    def __init__(
        self,
        pool: asyncpg.Pool,
        max_tokens: int = 8000,
        system_ratio: float = 0.1,  # System Prompt 占比
        memory_ratio: float = 0.3,  # 记忆占比
        history_ratio: float = 0.4,  # 历史占比
        fact_ratio: float = 0.2,  # 事实占比
    ):
        self.pool = pool
        self.max_tokens = max_tokens
        self.system_ratio = system_ratio
        self.memory_ratio = memory_ratio
        self.history_ratio = history_ratio
        self.fact_ratio = fact_ratio

    async def assemble(
        self,
        user_id: str,
        app_name: str,
        thread_id: str,
        query: str,
        query_embedding: list[float],
        system_prompt: str | None = None,
    ) -> ContextWindow:
        """
        组装上下文窗口

        Args:
            user_id: 用户 ID
            app_name: 应用名称
            thread_id: 当前会话 ID
            query: 用户查询
            query_embedding: 查询的向量嵌入
            system_prompt: 系统提示词

        Returns:
            ContextWindow: 组装后的上下文
        """
        items: list[ContextItem] = []
        total_tokens = 0

        # 1. 添加 System Prompt
        if system_prompt:
            system_tokens = self._estimate_tokens(system_prompt)
            system_budget = int(self.max_tokens * self.system_ratio)

            if system_tokens <= system_budget:
                items.append(
                    ContextItem(
                        context_type="system",
                        content=system_prompt,
                        relevance_score=1.0,
                        token_estimate=system_tokens,
                    )
                )
                total_tokens += system_tokens

        # 2. 检索相关记忆
        memory_budget = int(self.max_tokens * self.memory_ratio)
        memories = await self._retrieve_memories(user_id, app_name, query_embedding, memory_budget)
        for mem in memories:
            if total_tokens + mem.token_estimate <= self.max_tokens:
                items.append(mem)
                total_tokens += mem.token_estimate

        # 3. 获取最近历史
        history_budget = int(self.max_tokens * self.history_ratio)
        history = await self._retrieve_history(thread_id, history_budget)
        for hist in history:
            if total_tokens + hist.token_estimate <= self.max_tokens:
                items.append(hist)
                total_tokens += hist.token_estimate

        # 4. 获取用户 Facts
        fact_budget = int(self.max_tokens * self.fact_ratio)
        facts = await self._retrieve_facts(user_id, app_name, query_embedding, fact_budget)
        for fact in facts:
            if total_tokens + fact.token_estimate <= self.max_tokens:
                items.append(fact)
                total_tokens += fact.token_estimate

        return ContextWindow(
            items=items,
            total_tokens=total_tokens,
            budget_used=total_tokens / self.max_tokens,
        )

    async def _retrieve_memories(
        self,
        user_id: str,
        app_name: str,
        query_embedding: list[float],
        budget: int,
    ) -> list[ContextItem]:
        """检索相关记忆"""
        query = """
            SELECT
                id, content, retention_score,
                1 - (embedding <=> $3::vector) AS similarity
            FROM memories
            WHERE user_id = $1
              AND app_name = $2
              AND embedding IS NOT NULL
            ORDER BY similarity * retention_score DESC
            LIMIT 10
        """
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, user_id, app_name, query_embedding)

        items = []
        tokens_used = 0
        for row in rows:
            token_est = self._estimate_tokens(row["content"])
            if tokens_used + token_est > budget:
                break
            items.append(
                ContextItem(
                    context_type="memory",
                    content=row["content"],
                    relevance_score=float(row["similarity"]) * float(row["retention_score"]),
                    token_estimate=token_est,
                    metadata={"memory_id": str(row["id"])},
                )
            )
            tokens_used += token_est
            # 更新访问记录
            await self._record_memory_access(str(row["id"]))

        return items

    async def _retrieve_history(
        self,
        thread_id: str,
        budget: int,
    ) -> list[ContextItem]:
        """检索最近历史"""
        query = """
            SELECT id, author, content, created_at
            FROM events
            WHERE thread_id = $1
              AND event_type = 'message'
            ORDER BY sequence_num DESC
            LIMIT 30
        """
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, uuid.UUID(thread_id))

        items = []
        tokens_used = 0
        # 反转以按时间正序
        for row in reversed(rows):
            content = row["content"]
            if isinstance(content, dict):
                text = content.get("text", str(content))
            else:
                text = str(content)

            formatted = f"[{row['author']}]: {text}"
            token_est = self._estimate_tokens(formatted)

            if tokens_used + token_est > budget:
                break
            items.append(
                ContextItem(
                    context_type="history",
                    content=formatted,
                    relevance_score=1.0,  # 历史按时间排序
                    token_estimate=token_est,
                )
            )
            tokens_used += token_est

        return items

    async def _retrieve_facts(
        self,
        user_id: str,
        app_name: str,
        query_embedding: list[float],
        budget: int,
    ) -> list[ContextItem]:
        """检索用户 Facts"""
        query = """
            SELECT
                id, fact_type, key, value, confidence,
                1 - (embedding <=> $3::vector) AS similarity
            FROM facts
            WHERE user_id = $1
              AND app_name = $2
              AND (valid_until IS NULL OR valid_until > NOW())
            ORDER BY COALESCE(1 - (embedding <=> $3::vector), confidence) DESC
            LIMIT 10
        """
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, user_id, app_name, query_embedding)

        items = []
        tokens_used = 0
        for row in rows:
            content = f"[{row['fact_type']}] {row['key']}: {row['value']}"
            token_est = self._estimate_tokens(content)

            if tokens_used + token_est > budget:
                break
            items.append(
                ContextItem(
                    context_type="fact",
                    content=content,
                    relevance_score=float(row.get("similarity") or row["confidence"]),
                    token_estimate=token_est,
                    metadata={"fact_id": str(row["id"])},
                )
            )
            tokens_used += token_est

        return items

    async def _record_memory_access(self, memory_id: str) -> None:
        """记录记忆访问"""
        query = """
            UPDATE memories
            SET access_count = access_count + 1,
                last_accessed_at = NOW()
            WHERE id = $1
        """
        async with self.pool.acquire() as conn:
            await conn.execute(query, uuid.UUID(memory_id))

    def _estimate_tokens(self, text: str) -> int:
        """估算 Token 数量 (简化: 4 字符 ≈ 1 token)"""
        return len(text) // 4 + 1

    def format_context(self, window: ContextWindow) -> str:
        """将上下文窗口格式化为 Prompt"""
        sections = {
            "system": [],
            "fact": [],
            "memory": [],
            "history": [],
        }

        for item in window.items:
            sections[item.context_type].append(item.content)

        parts = []

        if sections["system"]:
            parts.append("\n".join(sections["system"]))

        if sections["fact"]:
            parts.append("## 用户偏好")
            parts.extend(sections["fact"])

        if sections["memory"]:
            parts.append("## 相关记忆")
            parts.extend(sections["memory"])

        if sections["history"]:
            parts.append("## 对话历史")
            parts.extend(sections["history"])

        return "\n\n".join(parts)
