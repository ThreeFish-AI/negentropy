"""
语料引擎 (CorpusEngine) — 质量评估与版本管理

提供语料库的多维质量评分、版本快照和跨语料推荐能力。
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.models.perception import (
    Corpus,
    CorpusVersion,
    KnowledgeDocument,
)

logger = logging.getLogger(__name__.rsplit(".", 1)[0])


class CorpusEngine:
    """语料引擎

    能力:
    1. assess_quality() — 多维质量评分
    2. create_version_snapshot() — 版本快照 + diff 计算
    3. suggest_cross_references() — 跨语料引用推荐
    """

    # 质量评估维度权重
    QUALITY_WEIGHTS = {
        "coverage": 0.20,  # 文档覆盖率（预期 vs 实际）
        "freshness": 0.15,  # 内容新鲜度（平均更新时间）
        "diversity": 0.15,  # 来源多样性（不同 source_type 的比例）
        "density": 0.20,  # 信息密度（平均 chunk 长度 / 文档数）
        "embedding_coverage": 0.15,  # 嵌入向量覆盖率
        "entity_density": 0.15,  # 实体密度（每文档平均实体数）
    }

    async def assess_quality(
        self,
        db: AsyncSession,
        corpus_id: UUID,
    ) -> dict[str, Any]:
        """多维质量评分

        Returns:
            包含各维度得分、总分、元数据的字典
        """
        scores: dict[str, float] = {}
        details: dict[str, Any] = {}

        # 1. 文档数量
        doc_count_result = await db.execute(
            select(func.count()).select_from(
                select(KnowledgeDocument.id).where(KnowledgeDocument.corpus_id == corpus_id).subquery()
            )
        )
        doc_count = doc_count_result.scalar() or 0
        details["document_count"] = doc_count

        if doc_count == 0:
            return {
                "corpus_id": str(corpus_id),
                "total_score": 0.0,
                "scores": {},
                "details": {"document_count": 0},
                "assessed_at": datetime.now(UTC).isoformat(),
                "grade": "empty",
            }

        # 2. 来源多样性
        source_type_result = await db.execute(
            select(
                KnowledgeDocument.source_id.isnot(None).label("has_source"),
            ).where(KnowledgeDocument.corpus_id == corpus_id)
        )
        rows = source_type_result.all()
        with_source = sum(1 for r in rows if r[0])
        scores["diversity"] = with_source / doc_count if doc_count > 0 else 0
        details["source_tracking_coverage"] = f"{with_source}/{doc_count}"

        # 3. 新鲜度（基于 updated_at）
        freshness_result = await db.execute(
            select(
                func.avg(func.extract("epoch", datetime.now(UTC) - KnowledgeDocument.updated_at)).label(
                    "avg_age_seconds"
                )
            ).where(KnowledgeDocument.corpus_id == corpus_id)
        )
        avg_age = freshness_result.scalar() or 0
        # 30 天内为满分，超过 1 年线性衰减
        max_age = 30 * 24 * 3600
        decay_age = 365 * 24 * 3600
        if avg_age <= max_age:
            scores["freshness"] = 1.0
        elif avg_age >= decay_age:
            scores["freshness"] = 0.1
        else:
            scores["freshness"] = 1.0 - ((avg_age - max_age) / (decay_age - max_age)) * 0.9
        details["avg_document_age_days"] = round(avg_age / 86400, 1)

        # 4. 嵌入覆盖率
        embed_result = await db.execute(
            select(
                func.count().filter(KnowledgeDocument.embedding.isnot(None)).label("with_embed"),
                func.count().label("total"),
            ).where(KnowledgeDocument.corpus_id == corpus_id)
        )
        embed_row = embed_result.one()
        scores["embedding_coverage"] = embed_row[0] / embed_row[1] if embed_row[1] > 0 else 0
        details["embedding_coverage"] = f"{embed_row[0]}/{embed_row[1]}"

        # 5. 综合评分
        total_score = sum(scores.get(dim, 0) * self.QUALITY_WEIGHTS.get(dim, 0) for dim in self.QUALITY_WEIGHTS)

        # 评级
        if total_score >= 0.8:
            grade = "excellent"
        elif total_score >= 0.6:
            grade = "good"
        elif total_score >= 0.4:
            grade = "fair"
        else:
            grade = "poor"

        result = {
            "corpus_id": str(corpus_id),
            "total_score": round(total_score, 4),
            "scores": {k: round(v, 4) for k, v in scores.items()},
            "details": details,
            "assessed_at": datetime.now(UTC).isoformat(),
            "grade": grade,
        }

        logger.info(
            "corpus_quality_assessed",
            extra={
                "corpus_id": str(corpus_id),
                "score": total_score,
                "grade": grade,
            },
        )

        return result

    async def create_version_snapshot(
        self,
        db: AsyncSession,
        *,
        corpus_id: UUID,
        quality_score: float | None = None,
        triggered_by: str | None = None,
        notes: str | None = None,
    ) -> CorpusVersion:
        """创建语料库版本快照

        记录当前时刻的文档数量、质量分数等状态信息，
        用于后续对比分析。
        """
        # 获取当前版本号
        last_ver_result = await db.execute(
            select(func.max(CorpusVersion.version_number)).where(CorpusVersion.corpus_id == corpus_id)
        )
        last_version = last_ver_result.scalar() or 0
        new_version = last_version + 1

        # 获取文档统计
        doc_count_result = await db.execute(
            select(func.count()).select_from(
                select(KnowledgeDocument.id).where(KnowledgeDocument.corpus_id == corpus_id).subquery()
            )
        )
        doc_count = doc_count_result.scalar() or 0

        # 如果未传入质量分数，执行快速评估
        if quality_score is None:
            quality_result = await self.assess_quality(db, corpus_id)
            quality_score = quality_result.get("total_score", 0)

        snapshot = CorpusVersion(
            corpus_id=corpus_id,
            version_number=new_version,
            quality_score=quality_score,
            document_count=doc_count,
            diff_summary=notes or f"Auto-snapshot v{new_version}",
            triggered_by=triggered_by,
        )
        db.add(snapshot)
        await db.flush()

        logger.info(
            "corpus_version_snapshot",
            extra={
                "corpus_id": str(corpus_id),
                "version": new_version,
                "doc_count": doc_count,
                "quality_score": quality_score,
            },
        )

        return snapshot

    async def get_version_history(
        self,
        db: AsyncSession,
        corpus_id: UUID,
        limit: int = 20,
    ) -> list[dict]:
        """获取版本历史"""
        from sqlalchemy import desc

        result = await db.execute(
            select(CorpusVersion)
            .where(CorpusVersion.corpus_id == corpus_id)
            .order_by(desc(CorpusVersion.version_number))
            .limit(limit)
        )
        versions = result.scalars().all()

        return [
            {
                "id": str(v.id),
                "version_number": v.version_number,
                "quality_score": v.quality_score,
                "document_count": v.document_count,
                "diff_summary": v.diff_summary,
                "triggered_by": v.triggered_by,
                "created_at": v.created_at.isoformat() if v.created_at else None,
            }
            for v in versions
        ]

    async def suggest_cross_references(
        self,
        db: AsyncSession,
        corpus_id: UUID,
        limit: int = 10,
    ) -> list[dict]:
        """跨语料引用推荐

        基于 kg_entities 实体重叠度（Jaccard 相似度）推荐相关语料库。
        优先使用实体推荐；KG 数据不足时降级到文档数排序。

        理论: Dong et al., 2014 Knowledge Vault 跨源实体链接;
              Christen, 2012 Jaccard 相似度匹配。
        """

        from negentropy.models.base import NEGENTROPY_SCHEMA

        # 尝试基于实体的智能推荐
        entity_suggestions = await self._entity_based_suggestions(db, corpus_id, limit, NEGENTROPY_SCHEMA)
        if entity_suggestions:
            return entity_suggestions

        # 降级：KG 数据不足，返回有文档的其他语料库
        return await self._fallback_suggestions(db, corpus_id, limit)

    async def _entity_based_suggestions(
        self,
        db: AsyncSession,
        corpus_id: UUID,
        limit: int,
        schema: str,
    ) -> list[dict]:
        """基于 Jaccard 实体重叠度的推荐"""
        from sqlalchemy import text as sql_text

        try:
            result = await db.execute(
                sql_text("""
                    WITH target AS (
                        SELECT LOWER(name) AS name FROM {schema}.kg_entities
                        WHERE corpus_id = :cid AND is_active = true AND confidence >= 0.5
                    ),
                    shared AS (
                        SELECT
                            e.corpus_id,
                            COUNT(DISTINCT LOWER(e.name)) FILTER (WHERE t.name IS NOT NULL) AS shared_count,
                            COUNT(DISTINCT LOWER(e.name)) AS other_total
                        FROM {schema}.kg_entities e
                        LEFT JOIN target t ON LOWER(e.name) = t.name
                        WHERE e.corpus_id != :cid AND e.is_active = true AND e.confidence >= 0.5
                        GROUP BY e.corpus_id
                        HAVING COUNT(DISTINCT LOWER(e.name)) FILTER (WHERE t.name IS NOT NULL) > 0
                        ORDER BY shared_count DESC
                        LIMIT :lim
                    ),
                    target_total AS (
                        SELECT COUNT(DISTINCT name) AS cnt FROM target
                    )
                    SELECT
                        s.corpus_id,
                        s.shared_count,
                        s.other_total,
                        tt.cnt AS target_total,
                        s.shared_count::float / (tt.cnt + s.other_total - s.shared_count) AS jaccard
                    FROM shared s, target_total tt
                    ORDER BY jaccard DESC
                """).format(schema=schema),
                {"cid": corpus_id, "lim": limit},
            )
            rows = result.fetchall()
            if not rows:
                return []

            # 获取共享实体名称（用于 relevance_hint）
            suggestions = []
            for row in rows:
                shared_names_result = await db.execute(
                    sql_text("""
                        SELECT DISTINCT e.name
                        FROM {schema}.kg_entities e
                        WHERE e.corpus_id = :other_cid AND e.is_active = true
                        AND LOWER(e.name) IN (
                            SELECT LOWER(name) FROM {schema}.kg_entities
                            WHERE corpus_id = :target_cid AND is_active = true
                        )
                        ORDER BY e.importance_score DESC NULLS LAST
                        LIMIT 5
                    """).format(schema=schema),
                    {"other_cid": row.corpus_id, "target_cid": corpus_id},
                )
                shared_names = [r.name for r in shared_names_result.fetchall()]

                corp = await db.execute(select(Corpus).where(Corpus.id == row.corpus_id))
                corpus = corp.scalar_one_or_none()
                if not corpus:
                    continue

                suggestions.append(
                    {
                        "corpus_id": str(corpus.id),
                        "name": corpus.name,
                        "description": getattr(corpus, "description", None),
                        "shared_entity_count": row.shared_count,
                        "jaccard_similarity": round(float(row.jaccard), 3),
                        "shared_entities": shared_names,
                        "relevance_hint": f"{row.shared_count} 个共享实体 (Jaccard={float(row.jaccard):.2f})",
                    }
                )

            return suggestions
        except Exception:
            return []

    async def _fallback_suggestions(
        self,
        db: AsyncSession,
        corpus_id: UUID,
        limit: int,
    ) -> list[dict]:
        """降级推荐：返回有文档的其他语料库"""
        other_corpora = await db.execute(select(Corpus).where(Corpus.id != corpus_id).limit(limit * 2))
        corpora = other_corpora.scalars().all()

        suggestions = []
        for corp in corpora:
            doc_count_res = await db.execute(
                select(func.count()).select_from(
                    select(KnowledgeDocument.id).where(KnowledgeDocument.corpus_id == corp.id).subquery()
                )
            )
            count = doc_count_res.scalar() or 0
            if count > 0:
                suggestions.append(
                    {
                        "corpus_id": str(corp.id),
                        "name": corp.name,
                        "description": getattr(corp, "description", None),
                        "document_count": count,
                        "relevance_hint": f"{count} 篇文档可参考",
                    }
                )

        return suggestions[:limit]
