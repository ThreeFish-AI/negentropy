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
[4] Edge et al., 2024 — From local to global: A graph RAG approach to query-focused summarization
[5] Guo et al., 2024 — LightRAG: Simple and fast retrieval-augmented generation
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select, text

import negentropy.db.session as db_session
from negentropy.engine.factories.memory import get_core_block_service, get_fact_service
from negentropy.engine.utils.query_intent import classify as classify_intent
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

        # Phase 4：注入 Core Memory Block（常驻摘要）
        core_blocks_text, core_block_tokens = await self._collect_core_blocks(
            user_id=user_id,
            app_name=app_name,
            thread_id=thread_id,
        )

        # Phase 5 F2：在 Core Block 之后、主记忆之前注入反思 Few-Shot
        # 仅在 reflection.enabled 且 query intent ∈ {procedural, episodic} 且 confidence ≥ 阈值时生效。
        reflection_text, reflection_tokens, reflection_count = await self._collect_reflections(
            user_id=user_id,
            app_name=app_name,
            query=query,
            query_embedding=query_embedding,
            memory_tokens_total=memory_tokens,
        )
        # Core Block 占用从 memory_tokens 中预留（不超过 30%）。超过时按预留上限截断，
        # 避免后续直接 prepend 时把 memory 段实际占用挤出预算（见 review #2）。
        core_block_cap = int(memory_tokens * 0.3)
        core_block_truncated = False
        if core_block_tokens > core_block_cap and core_block_cap > 0:
            core_blocks_text, core_block_tokens = await self._truncate_text_to_tokens(
                core_blocks_text,
                core_block_cap,
            )
            core_block_truncated = True
        reserved_for_core = min(core_block_tokens, core_block_cap)
        # Reflection budget 从 memory_tokens 中预留（不超过其 budget_ratio）。
        reserved_for_reflection = min(reflection_tokens, int(memory_tokens * 0.5))
        memory_tokens_after_core = max(0, memory_tokens - reserved_for_core - reserved_for_reflection)

        # Phase 4：query intent 分类（轻量启发式，仅用于日志/可观测）
        intent = classify_intent(query) if query else None

        try:
            result = await self._call_get_context_window(
                user_id=user_id,
                app_name=app_name,
                thread_id=thread_id,
                max_tokens=self._max_tokens,
                memory_tokens=memory_tokens_after_core,
                history_tokens=history_tokens,
                query=query,
                query_embedding=query_embedding,
            )

            # 拼接 Core Block 至上下文最前方（最高优先级）
            if core_blocks_text:
                if result.get("memory_context"):
                    result["memory_context"] = core_blocks_text + "\n" + result["memory_context"]
                else:
                    result["memory_context"] = core_blocks_text
                result["token_count"] = result.get("token_count", 0) + core_block_tokens

            # Phase 5 F2：反思 Few-Shot 紧跟 Core Block 之后注入
            if reflection_text:
                if result.get("memory_context"):
                    result["memory_context"] = reflection_text + "\n" + result["memory_context"]
                else:
                    result["memory_context"] = reflection_text
                result["token_count"] = result.get("token_count", 0) + reflection_tokens

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
            result["budget"]["core_block_tokens"] = core_block_tokens
            result["budget"]["core_block_truncated"] = core_block_truncated
            result["budget"]["reflection_tokens"] = reflection_tokens
            result["budget"]["reflection_count"] = reflection_count
            if intent is not None:
                result["budget"]["query_intent"] = {
                    "primary": intent.primary,
                    "boost_types": list(intent.boost_types),
                    "confidence": intent.confidence,
                }

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

        # GraphRAG 上下文注入：高重要性实体 + 1-hop 关系摘要
        # 理论: Edge et al., 2024 GraphRAG; Guo et al., 2024 LightRAG
        kg_parts = await self._collect_kg_context(app_name=app_name)
        if kg_parts:
            parts.append("[KnowledgeGraph]")
            parts.extend(kg_parts)

        context = "\n".join(parts)
        logger.debug(
            "memory_summary_assembled",
            user_id=user_id,
            memories_count=len(memories),
            facts_count=len(facts),
            kg_entities_count=len(kg_parts),
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

        # Post-join 安全校验：换行符 token 化可能导致超标，逐行回退
        while final_tokens > budget and truncated_lines:
            if len(truncated_lines) > 1:
                truncated_lines.pop()
            else:
                # 单行兜底：按字符比例截断至安全长度
                line = truncated_lines[0]
                if len(line) > 10:
                    safe_chars = max(0, int(len(line) * budget / max(final_tokens, 1) * 0.9))
                    truncated_lines[0] = line[:safe_chars] + "..." if safe_chars > 0 else ""
                else:
                    truncated_lines = []
                truncated_text = "\n".join(truncated_lines)
                final_tokens = await self._accurate_token_count(truncated_text)
                break
            truncated_text = "\n".join(truncated_lines)
            final_tokens = await self._accurate_token_count(truncated_text)

        return {
            "memory_context": truncated_text,
            "token_count": final_tokens,
            "budget": result.get("budget", {}),
        }

    async def _collect_core_blocks(
        self,
        *,
        user_id: str,
        app_name: str,
        thread_id: str | None,
    ) -> tuple[str, int]:
        """收集 Core Memory Block，按 thread → app → user 优先级拼接。

        Phase 4：Letta/MemGPT 风格的常驻摘要块，注入到上下文最前方，
        优先级最高，受 Self-editing Tools 主控。
        """
        try:
            service = get_core_block_service()
            blocks = await service.list_for_context(
                user_id=user_id,
                app_name=app_name,
                thread_id=thread_id,
            )
            if not blocks:
                return "", 0
            lines: list[str] = []
            for b in blocks:
                tag = b.get("scope", "user").upper()
                label = b.get("label", "persona")
                content = b.get("content", "").strip()
                if not content:
                    continue
                lines.append(f"[CoreBlock:{tag}:{label}] {content}")
            text = "\n".join(lines)
            tokens = await self._accurate_token_count(text) if text else 0
            logger.debug(
                "core_blocks_collected",
                user_id=user_id,
                count=len(lines),
                tokens=tokens,
            )
            return text, tokens
        except Exception as exc:
            logger.debug("core_blocks_collection_skipped", error=str(exc))
            return "", 0

    async def _collect_reflections(
        self,
        *,
        user_id: str,
        app_name: str,
        query: str | None,
        query_embedding: list[float] | None,
        memory_tokens_total: int,
    ) -> tuple[str, int, int]:
        """收集 Phase 5 F2 反思 Few-Shot，仅在启用且 intent 命中时返回非空。

        门控条件（任一不满足即跳过）：
        - settings.memory.reflection.enabled=True
        - intent.primary ∈ {procedural, episodic}
        - intent.confidence >= min_intent_confidence

        Returns:
            (reflection_text, reflection_tokens, reflection_count)
        """
        try:
            from negentropy.config import settings as global_settings

            ref_settings = global_settings.memory.reflection
            if not ref_settings.enabled:
                return "", 0, 0
        except Exception:
            return "", 0, 0

        intent = classify_intent(query) if query else None
        if intent is None:
            return "", 0, 0
        if intent.primary not in ("procedural", "episodic"):
            return "", 0, 0
        if intent.confidence < ref_settings.min_intent_confidence:
            return "", 0, 0

        budget = max(0, int(memory_tokens_total * ref_settings.budget_ratio))
        if budget <= 0:
            return "", 0, 0

        try:
            rows = await self._fetch_reflection_rows(
                user_id=user_id,
                app_name=app_name,
                query_embedding=query_embedding,
                limit=ref_settings.fewshot_k,
            )
        except Exception as exc:
            logger.debug("reflection_fewshot_fetch_failed", error=str(exc))
            return "", 0, 0

        if not rows:
            return "", 0, 0

        lines: list[str] = []
        used_tokens = 0
        for row in rows:
            content = (row.get("content") or "").strip()
            if not content:
                continue
            line = f"[Reflection] {content}"
            line_tokens = await self._accurate_token_count(line)
            if used_tokens + line_tokens > budget:
                break
            lines.append(line)
            used_tokens += line_tokens
        if not lines:
            return "", 0, 0
        text_block = "\n".join(lines)
        actual_tokens = await self._accurate_token_count(text_block)
        return text_block, actual_tokens, len(lines)

    async def _fetch_reflection_rows(
        self,
        *,
        user_id: str,
        app_name: str,
        query_embedding: list[float] | None,
        limit: int,
    ) -> list[dict[str, Any]]:
        """按向量近邻或时间倒序拉取反思记忆。"""
        if query_embedding:
            embedding_str = "[" + ",".join(f"{x:.7g}" for x in query_embedding) + "]"
            sql = text(
                f"""
                SELECT m.content, m.created_at,
                       (m.embedding <=> CAST(:embedding AS vector)) AS distance
                FROM {NEGENTROPY_SCHEMA}.memories m
                WHERE m.user_id = :user_id
                  AND m.app_name = :app_name
                  AND m.metadata->>'subtype' = 'reflection'
                  AND m.embedding IS NOT NULL
                  AND COALESCE(m.metadata->>'is_deleted', 'false') = 'false'
                ORDER BY distance ASC, m.created_at DESC
                LIMIT :limit
                """
            )
            params: dict[str, Any] = {
                "user_id": user_id,
                "app_name": app_name,
                "embedding": embedding_str,
                "limit": limit,
            }
        else:
            sql = text(
                f"""
                SELECT m.content, m.created_at, NULL::float AS distance
                FROM {NEGENTROPY_SCHEMA}.memories m
                WHERE m.user_id = :user_id
                  AND m.app_name = :app_name
                  AND m.metadata->>'subtype' = 'reflection'
                  AND COALESCE(m.metadata->>'is_deleted', 'false') = 'false'
                ORDER BY m.created_at DESC
                LIMIT :limit
                """
            )
            params = {"user_id": user_id, "app_name": app_name, "limit": limit}

        async with db_session.AsyncSessionLocal() as db:
            result = await db.execute(sql, params)
            rows = result.fetchall()
        return [{"content": r.content, "created_at": r.created_at, "distance": r.distance} for r in rows]

    async def _collect_kg_context(
        self,
        *,
        app_name: str,
        top_n: int = 5,
        max_tokens: int = 200,
    ) -> list[str]:
        """收集 KG 高重要性实体 + 1-hop 关系摘要

        从 kg_entities 按 importance_score 降序取 Top-N 实体，
        附带其 1-hop 出向关系。KG 不可用时静默返回空列表。

        参考文献:
        [4] Edge et al., 2024 — GraphRAG Local Search 实体邻域上下文
        [5] Guo et al., 2024 — LightRAG 双层检索 token 效率优化
        """
        try:
            from sqlalchemy.orm import selectinload

            from negentropy.models.perception import KgEntity, KgRelation

            async with db_session.AsyncSessionLocal() as db:
                stmt = (
                    select(KgEntity)
                    .where(
                        KgEntity.app_name == app_name,
                        KgEntity.is_active.is_(True),
                        KgEntity.importance_score.isnot(None),
                    )
                    .order_by(KgEntity.importance_score.desc())
                    .limit(top_n)
                    .options(
                        selectinload(KgEntity.outgoing_relations.and_(KgRelation.is_active.is_(True))).selectinload(
                            KgRelation.target_entity
                        )
                    )
                )
                result = await db.execute(stmt)
                entities = result.scalars().all()

            if not entities:
                return []

            lines: list[str] = []
            estimated_tokens = 0
            for ent in entities:
                line = f"{ent.name} ({ent.entity_type}, importance={ent.importance_score:.3f})"
                # 附带最多 3 条出向关系
                rels = ent.outgoing_relations[:3] if ent.outgoing_relations else []
                if rels:
                    rel_parts: list[str] = []
                    for r in rels:
                        if r.target_entity:
                            rel_parts.append(f"--{r.relation_type}--> {r.target_entity.name}")
                    if rel_parts:
                        line += " " + " ".join(rel_parts)
                line += ";"
                token_est = len(line) // 4
                if estimated_tokens + token_est > max_tokens:
                    break
                lines.append(line)
                estimated_tokens += token_est

            return lines
        except Exception as exc:
            logger.debug("kg_context_collection_skipped", error=str(exc))
            return []

    async def _accurate_token_count(self, text: str) -> int:
        """使用 tiktoken BPE 编码器精确计数（替代 LENGTH/4 估算）"""
        try:
            return await TokenCounter.count_tokens_async(text)
        except Exception:
            return len(text) // 4

    async def _truncate_text_to_tokens(
        self,
        text: str,
        budget: int,
    ) -> tuple[str, int]:
        """按 token 预算截断任意文本块（用于 Core Block 30% 上限）。

        策略：
        - 先按行累加，超预算时按字符比例对最后一行做安全截断；
        - 拼回后再 token 化校验，超标则逐行回退（与 ``_truncate_to_budget`` 一致）。

        Returns:
            (truncated_text, actual_tokens) — actual_tokens 不会超过 budget。
        """
        if budget <= 0 or not text:
            return "", 0
        lines = text.split("\n")
        kept: list[str] = []
        current = 0
        for line in lines:
            line_tokens = await self._accurate_token_count(line)
            if current + line_tokens <= budget:
                kept.append(line)
                current += line_tokens
                continue
            remaining = budget - current
            if remaining > 10 and line.strip():
                chars_per_token = len(line) / max(line_tokens, 1)
                safe_chars = int(remaining * chars_per_token * 0.9)
                if safe_chars > 0:
                    kept.append(line[:safe_chars] + "...")
            break
        out_text = "\n".join(kept)
        out_tokens = await self._accurate_token_count(out_text)
        # 防御性：极端情况下 join 后 token 反弹超标，逐行回退
        while out_tokens > budget and kept:
            kept.pop()
            out_text = "\n".join(kept)
            out_tokens = await self._accurate_token_count(out_text)
        return out_text, out_tokens
