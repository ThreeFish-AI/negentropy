"""Global Search Map-Reduce 流水线 (Edge et al., 2024)

针对"汇总性问题"（如"该语料库的核心主题是什么？"）的查询路径：
1. Selection: 用 query embedding 在 kg_community_summaries 上做余弦排序，
   取 top_k 候选社区摘要（避免对全部摘要做 LLM 调用）。
2. Map: 对每个候选摘要并发调用 LLM，让其基于该摘要片段独立产出"部分答案 +
   置信度"，并以 asyncio.Semaphore 限流，防止触达提供商速率上限。
3. Reduce: 把所有部分答案聚合为最终答案，附带 evidence 列表（社区 ID、
   置信度、top entities）供 UI 展开溯源。

设计原则:
  - 复用现有 community_summarizer / kg_community_summaries 数据底座
  - 与 G3 时态查询正交（is_active 过滤已在 community 层完成）
  - 单 LLM 失败不阻塞整体（map 阶段错误降级为空串）

参考文献:
  [1] D. Edge et al., "From Local to Global: A Graph RAG Approach to
      Query-Focused Summarization," *arXiv:2404.16130*, 2024.
"""

from __future__ import annotations

import asyncio
import json
import time
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.logging import get_logger
from negentropy.model_names import canonicalize_model_name
from negentropy.models.base import NEGENTROPY_SCHEMA

logger = get_logger("negentropy.knowledge.graph.global_search")


_MAP_PROMPT = """你正在参与一次"全局检索"的 Map 阶段：基于一个社区摘要，独立产出一个针对查询的部分答案。

查询: {query}

社区 ID: {community_id}
社区摘要:
{summary_text}

要求：
- 用 1-3 句话直接回答查询（中文），仅使用上面的社区摘要内容；若社区与查询无关，明确说"无相关信息"。
- 不要捏造摘要中没有的内容；不要复读摘要。

部分答案:"""


_REDUCE_PROMPT = """你正在参与一次"全局检索"的 Reduce 阶段：把多个社区的部分答案聚合为最终答案。

查询: {query}

各社区的部分答案：
{partial_answers}

要求：
- 用 3-6 句话给出最终回答（中文），整合多个社区的视角。
- 突出共识 / 主题 / 关键实体；若部分答案彼此矛盾，请明确指出分歧而非任意取舍。
- 严禁引入摘要之外的事实。

最终答案:"""


@dataclass(frozen=True)
class GlobalSearchEvidence:
    """单个社区贡献的部分答案（Map 阶段产物）"""

    community_id: int
    partial_answer: str
    similarity: float
    top_entities: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class GlobalSearchResult:
    """Global Search 最终结果（Reduce 阶段产物）"""

    query: str
    answer: str
    evidence: list[GlobalSearchEvidence]
    candidates_total: int
    latency_ms: float
    summaries_dirty: bool = False


class GlobalSearchService:
    """GraphRAG Global Search 服务 — Map-Reduce 流水线封装。"""

    def __init__(
        self,
        model: str | None = None,
        map_concurrency: int = 5,
        max_communities: int = 10,
    ) -> None:
        self._model = canonicalize_model_name(model) if model else None
        self._semaphore = asyncio.Semaphore(map_concurrency)
        self._max_communities = max_communities

    async def search(
        self,
        db: AsyncSession,
        corpus_id: UUID,
        query: str,
        query_embedding: list[float],
        max_communities: int | None = None,
        level: int | None = None,
    ) -> GlobalSearchResult:
        """端到端执行 Global Search 流水线。

        Args:
            db: 数据库会话
            corpus_id: 语料库 ID
            query: 用户查询文本
            query_embedding: 查询向量（与 community summary embedding 同维度）
            max_communities: 候选社区数上限（默认 self._max_communities）
            level: 社区层级（None=自动选择最高 level）

        Returns:
            GlobalSearchResult，含最终答案与 evidence 列表
        """
        start = time.time()
        top_k = max_communities or self._max_communities

        # 自动选择 level：优先使用最高 level（最粗粒度）
        if level is None:
            level = await self._get_highest_level(db, corpus_id)

        candidates = await self._select_relevant_summaries(
            db,
            corpus_id=corpus_id,
            query_embedding=query_embedding,
            top_k=top_k,
            level=level,
        )

        if not candidates:
            logger.info("global_search_no_candidates", corpus_id=str(corpus_id))
            return GlobalSearchResult(
                query=query,
                answer="该语料库尚未生成社区摘要，请先执行 PageRank + Louvain + 社区摘要流程。",
                evidence=[],
                candidates_total=0,
                latency_ms=(time.time() - start) * 1000,
                summaries_dirty=False,
            )

        # Map: 并发调用 LLM 产出 partial answers（asyncio.Semaphore 限流）。
        # return_exceptions=True：单个社区的 helper 抛错（如 prompt 拼接 KeyError、
        # 后续新增校验失败）不应让全局检索整体 500；下方与空串同构丢弃即可。
        partials = await asyncio.gather(
            *[self._map_one(query, c) for c in candidates],
            return_exceptions=True,
        )

        evidence: list[GlobalSearchEvidence] = []
        for c, p in zip(candidates, partials, strict=True):
            if isinstance(p, BaseException):
                logger.warning(
                    "global_search_map_exception",
                    community_id=c["community_id"],
                    error=str(p),
                )
                continue
            if not p:
                continue  # 丢弃 LLM 失败的空串
            evidence.append(
                GlobalSearchEvidence(
                    community_id=c["community_id"],
                    partial_answer=p,
                    similarity=c["similarity"],
                    top_entities=c["top_entities"],
                )
            )

        if not evidence:
            return GlobalSearchResult(
                query=query,
                answer="所有社区均无与查询相关的信息。",
                evidence=[],
                candidates_total=len(candidates),
                latency_ms=(time.time() - start) * 1000,
                summaries_dirty=False,
            )

        # Reduce: 把 partials 聚合
        final = await self._reduce(query, evidence)

        elapsed = (time.time() - start) * 1000
        logger.info(
            "global_search_done",
            corpus_id=str(corpus_id),
            candidates=len(candidates),
            evidence=len(evidence),
            latency_ms=elapsed,
        )

        # 摘要陈旧度检查（>7 天未更新视为陈旧 — 与 incremental_build 标记互补）
        summaries_dirty = await self._check_summaries_stale(db, corpus_id)

        return GlobalSearchResult(
            query=query,
            answer=final,
            evidence=evidence,
            candidates_total=len(candidates),
            latency_ms=elapsed,
            summaries_dirty=summaries_dirty,
        )

    async def _select_relevant_summaries(
        self,
        db: AsyncSession,
        corpus_id: UUID,
        query_embedding: list[float],
        top_k: int,
        *,
        level: int | None = None,
    ) -> list[dict[str, Any]]:
        """按 embedding 余弦相似度筛选 top_k 候选社区摘要。

        若 kg_community_summaries.embedding 列尚未填充（旧数据 / 无 pgvector），
        回退为按 entity_count DESC 取 top_k —— 牺牲精度换取可用性。
        """
        # 先探测 embedding 列是否存在 + 是否有非空数据
        has_embedding = await self._has_summary_embeddings(db, corpus_id)

        level_filter = "AND level = :level" if level is not None else ""

        if has_embedding:
            query = text(f"""
                SELECT community_id, summary_text, entity_count, top_entities,
                       1 - (embedding <=> :embedding::vector) AS similarity
                FROM {NEGENTROPY_SCHEMA}.kg_community_summaries
                WHERE corpus_id = :corpus_id AND embedding IS NOT NULL {level_filter}
                ORDER BY embedding <=> :embedding::vector
                LIMIT :limit
            """)
            params: dict[str, Any] = {
                "corpus_id": str(corpus_id),
                "embedding": json.dumps(query_embedding),
                "limit": top_k,
            }
        else:
            # Fallback: 按规模排序，相似度兜底为 0
            query = text(f"""
                SELECT community_id, summary_text, entity_count, top_entities,
                       0.0 AS similarity
                FROM {NEGENTROPY_SCHEMA}.kg_community_summaries
                WHERE corpus_id = :corpus_id {level_filter}
                ORDER BY entity_count DESC
                LIMIT :limit
            """)
            params = {"corpus_id": str(corpus_id), "limit": top_k}

        if level is not None:
            params["level"] = level

        result = await db.execute(query, params)
        rows = []
        for row in result:
            top_entities_raw = row.top_entities
            if isinstance(top_entities_raw, str):
                try:
                    top_entities = json.loads(top_entities_raw)
                except json.JSONDecodeError:
                    top_entities = []
            elif isinstance(top_entities_raw, list):
                top_entities = top_entities_raw
            else:
                top_entities = []

            rows.append(
                {
                    "community_id": int(row.community_id),
                    "summary_text": row.summary_text or "",
                    "entity_count": int(row.entity_count or 0),
                    "top_entities": top_entities,
                    "similarity": float(row.similarity or 0.0),
                }
            )
        return rows

    async def _has_summary_embeddings(
        self,
        db: AsyncSession,
        corpus_id: UUID,
    ) -> bool:
        """检测当前 corpus 是否有非空 summary embeddings（决定 SELECT 路径）"""
        try:
            result = await db.execute(
                text(f"""
                    SELECT 1
                    FROM {NEGENTROPY_SCHEMA}.kg_community_summaries
                    WHERE corpus_id = :corpus_id AND embedding IS NOT NULL
                    LIMIT 1
                """),
                {"corpus_id": str(corpus_id)},
            )
            return result.scalar() is not None
        except Exception as exc:
            # 列尚未创建（极旧数据库 + 未跑迁移 0024）：吞异常并回退
            logger.debug("embedding_column_probe_failed", error=str(exc))
            return False

    async def _get_highest_level(
        self,
        db: AsyncSession,
        corpus_id: UUID,
    ) -> int | None:
        """获取当前 corpus 的最高社区层级"""
        try:
            result = await db.execute(
                text(f"""
                    SELECT MAX(level) FROM {NEGENTROPY_SCHEMA}.kg_community_summaries
                    WHERE corpus_id = :corpus_id
                """),
                {"corpus_id": str(corpus_id)},
            )
            val = result.scalar()
            return int(val) if val is not None else None
        except Exception:
            return None

    async def _check_summaries_stale(
        self,
        db: AsyncSession,
        corpus_id: UUID,
    ) -> bool:
        """检测摘要是否陈旧 — 最近一次实体写入晚于最近一次社区摘要刷新时为 dirty。

        Note:
            语义为"是否需要重跑摘要流水线"：对比 MAX(entity.updated_at) 与
            MAX(summary.updated_at)。早期实现误用 MIN(summary)，导致单个老旧
            社区会把整体状态长期拖成 dirty —— 已修正为 MAX 对 MAX。
        """
        try:
            result = await db.execute(
                text(f"""
                    SELECT
                        (SELECT MAX(updated_at) FROM {NEGENTROPY_SCHEMA}.kg_entities
                         WHERE corpus_id = :corpus_id) AS entity_max,
                        (SELECT MAX(updated_at) FROM {NEGENTROPY_SCHEMA}.kg_community_summaries
                         WHERE corpus_id = :corpus_id) AS summary_max
                """),
                {"corpus_id": str(corpus_id)},
            )
            row = result.first()
            if row is None or row.entity_max is None or row.summary_max is None:
                return False
            return row.entity_max > row.summary_max
        except Exception:
            return False

    async def _map_one(
        self,
        query: str,
        candidate: dict[str, Any],
    ) -> str:
        """Map 阶段：基于单个社区摘要产出部分答案。"""
        async with self._semaphore:
            prompt = _MAP_PROMPT.format(
                query=query,
                community_id=candidate["community_id"],
                summary_text=candidate["summary_text"],
            )
            return await self._call_llm(prompt, max_tokens=300)

    async def _reduce(
        self,
        query: str,
        evidence: list[GlobalSearchEvidence],
    ) -> str:
        """Reduce 阶段：聚合多个 partial answers。"""
        # 限制 partial answer 总长度，防止 token 预算溢出
        rendered = "\n\n".join(
            f"[Community {e.community_id} | sim={e.similarity:.3f}]\n{e.partial_answer.strip()}" for e in evidence[:20]
        )
        prompt = _REDUCE_PROMPT.format(query=query, partial_answers=rendered)
        return await self._call_llm(prompt, max_tokens=500) or "（Reduce 阶段未能产出最终答案）"

    async def _call_llm(self, prompt: str, max_tokens: int) -> str:
        import litellm

        model = self._model or "gpt-4o-mini"
        try:
            response = await litellm.acompletion(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=max_tokens,
            )
            return (response.choices[0].message.content or "").strip()
        except Exception as exc:
            logger.warning("global_search_llm_failed", model=model, error=str(exc))
            return ""
