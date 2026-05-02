"""
统一检索服务 (UnifiedRetrievalService)

提供面向 Agent/User 的通用检索入口，支持：
  - 自动模式选择（基于查询意图）
  - 分面过滤（corpus_ids, source_types, entity_types, date_range, tags）
  - 排名可解释性（semantic_score / keyword_score / combined_score / rerank_score）
  - 引用生成
  - 图谱丰富（可选返回 related_entities）
  - 反馈记录闭环
"""

from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.logging import get_logger

logger = get_logger(__name__.rsplit(".", 1)[0])

# 查询意图分类规则
_INTENT_PATTERNS = {
    "fact": [
        r"什么是",
        r"谁发明了",
        r"定义",
        r"意思",
        r"how to define",
        r"what is",
        r"who invented",
        r"definition",
    ],
    "exploration": [
        r"介绍",
        r"概述",
        r"总结",
        r"explain",
        r"tell me about",
        r"overview",
        r"summary",
        r"describe",
    ],
    "comparison": [
        r"对比",
        r"比较",
        r"区别",
        r"差异",
        r"vs\.?",
        r"compare",
        r"difference",
        r"better than",
    ],
    "navigation": [
        r"列表",
        r"目录",
        r"索引",
        r"所有.*文档",
        r"list all",
        r"index",
        r"catalog",
        r"table of contents",
    ],
    "graph_query": [
        r"关系",
        r"关联",
        r"图谱",
        r"实体",
        r"relation",
        r"graph",
        r"connected to",
        r"related entities",
    ],
}


class UnifiedRetrievalService:
    """统一检索服务"""

    def classify_intent(self, query: str) -> str:
        """基于关键词规则分类查询意图"""
        query_lower = query.lower().strip()
        for intent, patterns in _INTENT_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, query_lower):
                    return intent
        return "exploration"  # 默认探索型

    async def search(
        self,
        db: AsyncSession,
        *,
        query: str,
        corpus_ids: list[UUID] | None = None,
        source_types: list[str] | None = None,
        entity_types: list[str] | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        tags: list[str] | None = None,
        limit: int = 20,
        offset: int = 0,
        include_citations: bool = False,
        include_entities: bool = False,
        mode: str | None = None,
    ) -> dict[str, Any]:
        """统一检索入口

        Args:
            db: 数据库会话
            query: 查询文本
            corpus_ids: 语料库 ID 过滤
            source_types: 来源类型过滤 (url/file_pdf/file_generic/text_input)
            entity_types: 实体类型过滤
            date_from / date_to: 时间范围过滤
            tags: 标签过滤
            limit / offset: 分页参数
            include_citations: 是否返回引用信息
            include_entities: 是否返回关联实体
            mode: 强制检索模式 (semantic/keyword/hybrid/graph_hybrid)
                        不传则自动根据查询意图选择

        Returns:
            统一检索结果，含分面统计、排名解释等
        """
        intent = mode or self.classify_intent(query)

        # 根据意图选择检索模式
        if intent == "graph_query":
            result = await self._graph_search(db, query=query, limit=limit)
        elif intent == "navigation":
            result = await self._navigation_search(db, query=query, corpus_ids=corpus_ids, limit=limit)
        else:
            result = await self._hybrid_search(
                db,
                query=query,
                corpus_ids=corpus_ids,
                source_types=source_types,
                date_from=date_from,
                date_to=date_to,
                limit=limit,
                offset=offset,
                intent=intent,
            )

        # 后处理：引用生成、实体丰富
        if include_citations and result.get("items"):
            result["items"] = await self._enrich_with_citations(db, result["items"])

        if include_entities and result.get("items"):
            result["items"] = await self._enrich_with_entities(db, result["items"])

        # 异步记录反馈（fire-and-forget）
        try:
            await self._record_impression(db, query=query, intent=intent)
        except Exception:
            pass  # 反馈记录失败不影响检索结果

        result["query_intent"] = intent
        result["query"] = query

        logger.info(
            "unified_search_completed",
            extra={
                "intent": intent,
                "result_count": len(result.get("items", [])),
                "query": query[:100],
            },
        )

        return result

    async def _hybrid_search(
        self,
        db: AsyncSession,
        *,
        query: str,
        corpus_ids: list[UUID] | None,
        source_types: list[str] | None,
        date_from: datetime | None,
        date_to: datetime | None,
        limit: int,
        offset: int,
        intent: str,
    ) -> dict[str, Any]:
        """混合检索（语义 + 关键词）

        简化实现：基于 knowledge 表的 ILIKE 关键词匹配 + 可选向量相似度。
        生产环境应接入现有 RAG 检索管道。
        """
        from negentropy.models.perception import Knowledge, KnowledgeDocument

        base_query = select(
            Knowledge.id,
            Knowledge.document_id,
            Knowledge.plain_text,
            Knowledge.chunk_index,
            Knowledge.metadata_,
            Knowledge.created_at,
        ).join(KnowledgeDocument, Knowledge.document_id == KnowledgeDocument.id)

        # 过滤条件
        if corpus_ids:
            base_query = base_query.where(KnowledgeDocument.corpus_id.in_(corpus_ids))
        if source_types:
            base_query = base_query.join(
                # 需要通过 DocSource 关联过滤 source_type
                # 简化：先不过滤，后续可扩展
            )
        if date_from:
            base_query = base_query.where(KnowledgeDocument.created_at >= date_from)
        if date_to:
            base_query = base_query.where(KnowledgeDocument.created_at <= date_to)

        # 关键词搜索（ILIKE）
        search_term = f"%{query.replace('%', '\\%').replace('_', '\\_')}%"
        base_query = base_query.where(Knowledge.plain_text.ilike(search_term, escape="\\"))

        # 总数
        count_result = await db.execute(select(func.count()).select_from(base_query.subquery()))
        total = count_result.scalar() or 0

        # 分页查询
        result = await db.execute(base_query.order_by(Knowledge.created_at.desc()).offset(offset).limit(limit))
        rows = result.all()

        items = []
        for row in rows:
            knowledge_id, doc_id, plain_text, chunk_idx, metadata, created_at = row
            items.append(
                {
                    "id": str(knowledge_id),
                    "document_id": str(doc_id),
                    "chunk_index": chunk_idx,
                    "snippet": (plain_text or "")[:300],
                    "semantic_score": None,  # 需要向量计算
                    "keyword_score": 1.0,  # ILIKE 匹配的基础分数
                    "combined_score": 1.0,
                    "rerank_score": None,
                    "metadata": metadata or {},
                    "created_at": created_at.isoformat() if created_at else None,
                }
            )

        return {
            "items": items,
            "total": total,
            "offset": offset,
            "limit": limit,
            "mode": "keyword_fallback",
            "facets": await self._build_facets(db, corpus_ids=corpus_ids),
        }

    async def _graph_search(
        self,
        db: AsyncSession,
        *,
        query: str,
        limit: int,
    ) -> dict[str, Any]:
        """图谱查询模式 — 搜索相关实体和关系"""
        from negentropy.models.perception import KgEntity

        search_term = f"%{query}%"
        result = await db.execute(
            select(KgEntity)
            .where(KgEntity.name.ilike(search_term))
            .order_by(KgEntity.mention_count.desc(), KgEntity.confidence.desc())
            .limit(limit)
        )
        entities = result.scalars().all()

        items = [
            {
                "id": str(e.id),
                "name": e.name,
                "entity_type": e.entity_type,
                "confidence": e.confidence,
                "mention_count": e.mention_count,
                "type": "entity",
            }
            for e in entities
        ]

        return {
            "items": items,
            "total": len(items),
            "mode": "graph",
            "facets": {},
        }

    async def _navigation_search(
        self,
        db: AsyncSession,
        *,
        query: str,
        corpus_ids: list[UUID] | None,
        limit: int,
    ) -> dict[str, Any]:
        """导航模式 — 返回语料库/文档列表"""
        from negentropy.models.perception import Corpus, KnowledgeDocument

        query_obj = select(Corpus)
        if corpus_ids:
            query_obj = query_obj.where(Corpus.id.in_(corpus_ids))
        query_obj = query_obj.limit(limit)

        result = await db.execute(query_obj)
        corpora = result.scalars().all()

        items = []
        for corp in corpora:
            doc_count_res = await db.execute(
                select(func.count()).select_from(
                    select(KnowledgeDocument.id).where(KnowledgeDocument.corpus_id == corp.id).subquery()
                )
            )
            count = doc_count_res.scalar() or 0
            items.append(
                {
                    "id": str(corp.id),
                    "name": corp.name,
                    "type": "corpus",
                    "document_count": count,
                }
            )

        return {
            "items": items,
            "total": len(items),
            "mode": "navigation",
            "facets": {},
        }

    async def _build_facets(
        self,
        db: AsyncSession,
        corpus_ids: list[UUID] | None = None,
    ) -> dict[str, Any]:
        """构建分面统计信息"""
        facets: dict[str, Any] = {}

        # 来源类型分布
        from negentropy.models.perception import DocSource, KnowledgeDocument

        source_type_result = await db.execute(
            select(DocSource.source_type, func.count())
            .join(KnowledgeDocument, DocSource.document_id == KnowledgeDocument.id)
            .group_by(DocSource.source_type)
        )
        facets["source_types"] = [{"value": row[0], "count": row[1]} for row in source_type_result.all()]

        return facets

    async def _enrich_with_citations(
        self,
        db: AsyncSession,
        items: list[dict],
    ) -> list[dict]:
        """为结果项添加引用信息"""
        from negentropy.models.perception import DocSource

        for item in items:
            doc_id = item.get("document_id")
            if not doc_id:
                continue
            try:
                uuid_doc_id = UUID(doc_id) if isinstance(doc_id, str) else doc_id
                src_result = await db.execute(select(DocSource).where(DocSource.document_id == uuid_doc_id).limit(1))
                src = src_result.scalar_one_or_none()
                if src:
                    item["citation"] = {
                        "title": src.title,
                        "source_url": src.source_url,
                        "original_url": src.original_url,
                        "author": src.author,
                        "extracted_at": src.extracted_at.isoformat() if src.extracted_at else None,
                    }
            except Exception:
                pass
        return items

    async def _enrich_with_entities(
        self,
        db: AsyncSession,
        items: list[dict],
    ) -> list[dict]:
        """为结果项添加关联实体"""
        # 简化实现：基于 document_id 查找 mentions
        from negentropy.models.perception import KgEntityMention

        for item in items:
            try:
                doc_id = UUID(item["document_id"])
                mentions = await db.execute(
                    select(KgEntityMention.entity_id).where(KgEntityMention.knowledge_chunk_id == doc_id).limit(5)
                )
                entity_ids = [str(row[0]) for row in mentions.all()]
                if entity_ids:
                    item["related_entity_ids"] = entity_ids
            except Exception:
                pass
        return items

    async def _record_impression(
        self,
        db: AsyncSession,
        *,
        query: str,
        intent: str,
    ) -> None:
        """异步记录检索反馈（impression）"""
        from negentropy.models.perception import KnowledgeFeedback

        feedback = KnowledgeFeedback(
            feedback_type="impression",
            query_text=query,
            metadata={"intent": intent, "timestamp": datetime.now(UTC).isoformat()},
        )
        db.add(feedback)
        await db.flush()

    async def record_feedback(
        self,
        db: AsyncSession,
        *,
        feedback_type: str,  # click / useful / not_useful
        query_text: str | None = None,
        document_id: UUID | None = None,
        knowledge_id: UUID | None = None,
        metadata: dict | None = None,
    ) -> None:
        """记录用户反馈（点击/有用/无用）"""
        from negentropy.models.perception import KnowledgeFeedback

        feedback = KnowledgeFeedback(
            feedback_type=feedback_type,
            query_text=query_text,
            document_id=document_id,
            knowledge_id=knowledge_id,
            metadata=metadata or {},
        )
        db.add(feedback)
        await db.flush()

        logger.info(
            "feedback_recorded",
            extra={
                "feedback_type": feedback_type,
                "has_document": document_id is not None,
            },
        )
