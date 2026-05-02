"""
社区摘要生成 (Community Summarization)

基于 Microsoft GraphRAG 的层级社区摘要方法，对 Louvain 检测到的社区生成
LLM 摘要，支持全局检索模式 (Global Search)。

工程参考:
  - Microsoft GraphRAG: Leiden/Louvain 社区 → LLM 摘要 → Map-Reduce 全局检索
  - LightRAG: 双层检索（实体级 + 概念级）

参考文献:
  [1] E. K. V. Edge et al., "From local to global: A graph RAG approach
      to query-focused summarization," *Microsoft Research*, 2024.
  [2] V. A. Traag, L. Waltman, and N. J. van Eck, "From Louvain to Leiden:
      guaranteeing well-connected communities," *Scientific Reports*, 2019.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.logging import get_logger
from negentropy.model_names import canonicalize_model_name

logger = get_logger(__name__.rsplit(".", 1)[0])

_SUMMARY_PROMPT = """You are analyzing a community of related entities in a knowledge graph.

Community ID: {community_id}
Entity Count: {entity_count}
Top Entities: {top_entities}
Relationship Summary: {relations_summary}

Please generate a concise 2-3 sentence summary in {language} that captures the main theme,
key entities, and their relationships within this community. Focus on the most important
aspects that would help someone understand what this community is about.

Summary:"""


@dataclass(frozen=True)
class CommunitySummary:
    """社区摘要结果"""

    community_id: int
    corpus_id: UUID
    summary_text: str
    entity_count: int
    relation_count: int
    top_entities: list[str]


class CommunitySummarizer:
    """社区摘要生成器 (Edge et al., 2024)

    对 Louvain 社区检测结果生成 LLM 摘要，支持全局检索模式。
    """

    def __init__(self, model: str | None = None) -> None:
        self._model = canonicalize_model_name(model) if model else None

    async def summarize_communities(
        self,
        db: AsyncSession,
        corpus_id: UUID,
        community_entities: dict[int, list[dict[str, Any]]] | None = None,
    ) -> dict[str, Any]:
        """为语料库中的所有社区生成摘要

        Args:
            db: 数据库会话
            corpus_id: 语料库 ID
            community_entities: 可选的社区实体映射（None 则从 DB 查询）

        Returns:
            统计信息 {"communities_summarized": int, "errors": int}
        """
        if community_entities is None:
            community_entities = await self._load_communities(db, corpus_id)

        if not community_entities:
            logger.info("no_communities_found", corpus_id=str(corpus_id))
            return {"communities_summarized": 0, "errors": 0}

        summarized = 0
        errors = 0

        for community_id, entities in community_entities.items():
            if not entities:
                continue

            try:
                summary = await self._summarize_one(community_id, entities)
                await self._persist_summary(db, corpus_id, summary)
                summarized += 1
            except Exception as exc:
                errors += 1
                logger.warning(
                    "community_summary_failed",
                    community_id=community_id,
                    error=str(exc),
                )

        await db.commit()

        logger.info(
            "communities_summarized",
            corpus_id=str(corpus_id),
            total=len(community_entities),
            summarized=summarized,
            errors=errors,
        )

        return {"communities_summarized": summarized, "errors": errors}

    async def _load_communities(
        self,
        db: AsyncSession,
        corpus_id: UUID,
    ) -> dict[int, list[dict[str, Any]]]:
        """从数据库加载社区的实体列表"""
        from negentropy.models.base import NEGENTROPY_SCHEMA

        query = text(f"""
            SELECT community_id, name, entity_type, confidence
            FROM {NEGENTROPY_SCHEMA}.kg_entities
            WHERE corpus_id = :corpus_id AND community_id IS NOT NULL
            ORDER BY community_id, confidence DESC
        """)
        result = await db.execute(query, {"corpus_id": str(corpus_id)})

        communities: dict[int, list[dict[str, Any]]] = {}
        for row in result:
            cid = row[0]
            if cid not in communities:
                communities[cid] = []
            communities[cid].append(
                {
                    "name": row[1],
                    "entity_type": row[2],
                    "confidence": float(row[3]) if row[3] else 0.0,
                }
            )

        return communities

    async def _summarize_one(
        self,
        community_id: int,
        entities: list[dict[str, Any]],
    ) -> CommunitySummary:
        """为单个社区生成摘要"""
        top_entities = [e["name"] for e in entities[:10]]

        prompt = _SUMMARY_PROMPT.format(
            community_id=community_id,
            entity_count=len(entities),
            top_entities=", ".join(top_entities),
            relations_summary=f"{len(entities)} interconnected entities",
            language="the original language of the entities",
        )

        summary_text = await self._call_llm(prompt)

        if not summary_text:
            summary_text = f"Community of {len(entities)} related entities: {', '.join(top_entities[:5])}"

        return CommunitySummary(
            community_id=community_id,
            corpus_id=UUID("00000000-0000-0000-0000-000000000000"),  # 将在 persist 时设置
            summary_text=summary_text.strip(),
            entity_count=len(entities),
            relation_count=0,
            top_entities=top_entities[:5],
        )

    async def _call_llm(self, prompt: str) -> str:
        """调用 LLM 生成摘要"""
        import litellm

        model = self._model or "gpt-4o-mini"
        try:
            response = await litellm.acompletion(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=200,
            )
            return response.choices[0].message.content or ""
        except Exception as exc:
            logger.warning("llm_summary_failed", model=model, error=str(exc))
            return ""

    async def _persist_summary(
        self,
        db: AsyncSession,
        corpus_id: UUID,
        summary: CommunitySummary,
    ) -> None:
        """持久化社区摘要到数据库"""
        from negentropy.models.base import NEGENTROPY_SCHEMA

        # 使用 UPSERT 避免重复
        query = text(f"""
            INSERT INTO {NEGENTROPY_SCHEMA}.kg_community_summaries
                (id, corpus_id, community_id, level, summary_text, entity_count, relation_count, top_entities)
            VALUES (:id, :corpus_id, :community_id, 1, :summary_text, :entity_count, :relation_count, :top_entities)
            ON CONFLICT (corpus_id, community_id, level)
            DO UPDATE SET
                summary_text = EXCLUDED.summary_text,
                entity_count = EXCLUDED.entity_count,
                relation_count = EXcluded.relation_count,
                top_entities = EXCLUDED.top_entities,
                updated_at = NOW()
        """)
        import json

        await db.execute(
            query,
            {
                "id": str(uuid4()),
                "corpus_id": str(corpus_id),
                "community_id": summary.community_id,
                "summary_text": summary.summary_text,
                "entity_count": summary.entity_count,
                "relation_count": summary.relation_count,
                "top_entities": json.dumps(summary.top_entities),
            },
        )
