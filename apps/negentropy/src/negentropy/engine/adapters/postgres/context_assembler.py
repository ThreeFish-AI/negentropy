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
from uuid import UUID

from sqlalchemy import select, text

import negentropy.db.session as db_session
from negentropy.engine.factories.memory import get_fact_service
from negentropy.engine.utils.token_counter import TokenCounter
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
        query: str | None = None,
        query_embedding: list[float] | None = None,
        retrieval_log_id: UUID | None = None,
    ) -> dict[str, Any]:
        """组装记忆上下文

        Query-Aware 增强<sup>[[35]](#ref35)</sup>：当提供 query 和 query_embedding 时，
        通过 SQL 函数的 relevance_score（cosine_similarity × retention_score）
        实现查询相关性与时间衰减的联合排序，对齐 MMR 多样性选择思路。

        Args:
            user_id: 用户 ID
            app_name: 应用名称
            thread_id: 当前会话 ID（用于获取近期历史）
            query: 当前检索查询（可选，用于 query-aware 排序）
            query_embedding: 查询向量（可选，用于语义相关性计算）
            retrieval_log_id: 检索日志 ID（可选，用于隐式反馈闭环）

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
                query=query,
                query_embedding=query_embedding,
            )

            # Token Budget 硬性校验：超标时按行截断
            budget_total = memory_tokens + history_tokens
            actual_tokens = result.get("token_count", 0)
            if actual_tokens > budget_total:
                result = await self._truncate_to_budget(result, budget_total)
                logger.warning(
                    "context_budget_overflow",
                    actual_tokens=actual_tokens,
                    budget=budget_total,
                    truncated_tokens=result["token_count"],
                )

            # 丰富 budget 元数据
            result["budget"]["actual_tokens"] = result["token_count"]
            result["budget"]["budget_utilization"] = (
                result["token_count"] / self._max_tokens if self._max_tokens > 0 else 0.0
            )
            result["budget"]["overflow"] = actual_tokens > budget_total

            # 隐式反馈：记忆被注入 LLM 上下文 → mark_referenced<sup>[[33]](#ref33)</sup>
            if result.get("memory_context") and retrieval_log_id:
                try:
                    from negentropy.engine.adapters.postgres.retrieval_tracker import RetrievalTracker

                    tracker = RetrievalTracker()
                    await tracker.mark_referenced(retrieval_log_id)
                except Exception:
                    pass  # 反馈标记不应影响上下文组装

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
        query: str | None = None,
        query_embedding: list[float] | None = None,
    ) -> dict[str, Any]:
        """调用 SQL 函数 get_context_window()

        SQL 函数签名: get_context_window(p_user_id, p_app_name, p_query, p_query_embedding,
                                            p_max_tokens, p_memory_ratio, p_history_ratio)
        当 p_query 为 NULL 时退化为纯 retention_score 排序。
        """
        sql = text(f"""
            SELECT content, relevance_score, token_estimate
            FROM {NEGENTROPY_SCHEMA}.get_context_window(
                :user_id, :app_name, :p_query, :p_query_embedding,
                :max_tokens, :memory_ratio, :history_ratio
            )
        """)

        async with db_session.AsyncSessionLocal() as db:
            result = await db.execute(
                sql,
                {
                    "user_id": user_id,
                    "app_name": app_name,
                    "p_query": query,
                    "p_query_embedding": str(query_embedding) if query_embedding else None,
                    "max_tokens": max_tokens,
                    "memory_ratio": self._memory_ratio,
                    "history_ratio": self._history_ratio,
                },
            )
            rows = result.fetchall()

        if not rows:
            return {
                "memory_context": "",
                "token_count": 0,
                "budget": {"max_tokens": max_tokens},
            }

        # 合并所有行的 content 为上下文文本
        parts = [row.content for row in rows if row.content]
        context_text = "\n".join(parts)
        accurate_tokens = await self._accurate_token_count(context_text)

        return {
            "memory_context": context_text,
            "token_count": accurate_tokens,
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

        优先返回 MemorySummarizer 生成的结构化画像摘要；
        无摘要或生成失败时降级到原始内容拼接。
        """
        # 优先尝试结构化摘要
        try:
            from negentropy.engine.factories.memory import get_memory_summarizer

            summarizer = get_memory_summarizer()
            summary = await summarizer.get_or_generate_summary(user_id=user_id, app_name=app_name)
            if summary and summary.content:
                logger.debug("using_cached_summary", user_id=user_id)
                return summary.content
        except Exception as exc:
            logger.debug("summary_fallback_to_raw", user_id=user_id, error=str(exc))

        # 降级到原始拼接
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

    async def _truncate_to_budget(
        self,
        result: dict[str, Any],
        budget: int,
    ) -> dict[str, Any]:
        """按行截断上下文至 token 预算内

        优先保留先召回的高相关性内容（SQL 已按 relevance_score 排序），
        末行按字符安全截断（chars_per_token × remaining × 0.9）。

        参考 MemGPT<sup>[[7]](#ref7)</sup> Virtual Context Management 的
        分页截断策略。
        """
        context_text = result.get("memory_context", "")
        if not context_text:
            return result

        lines = context_text.split("\n")
        truncated_lines: list[str] = []
        current_tokens = 0

        for line in lines:
            line_tokens = await self._accurate_token_count(line)
            if current_tokens + line_tokens <= budget:
                truncated_lines.append(line)
                current_tokens += line_tokens
            else:
                remaining = budget - current_tokens
                if remaining > 50 and line.strip():
                    chars_per_token = len(line) / max(line_tokens, 1)
                    safe_chars = int(remaining * chars_per_token * 0.9)
                    if safe_chars > 0:
                        truncated_lines.append(line[:safe_chars] + "...")
                break

        truncated_text = "\n".join(truncated_lines)
        final_tokens = await self._accurate_token_count(truncated_text)

        return {
            "memory_context": truncated_text,
            "token_count": final_tokens,
            "budget": result.get("budget", {}),
        }

    async def _accurate_token_count(self, text: str) -> int:
        """使用 tiktoken BPE 编码器精确计数（替代 LENGTH/4 估算）"""
        try:
            return await TokenCounter.count_tokens_async(text)
        except Exception:
            return len(text) // 4
