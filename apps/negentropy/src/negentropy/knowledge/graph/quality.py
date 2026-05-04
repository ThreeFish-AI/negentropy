"""Graph Quality Validation

基于 Paulheim (2017) "Knowledge Graph Refinement" 定义的完整性/正确性/一致性三维度，
提供图谱质量的量化评估。

参考文献:
[1] H. Paulheim, "Knowledge Graph Refinement: A Survey of Approaches
    and Evaluation Methods," *Semantic Web*, vol. 8, no. 3, pp. 489–508, 2017.
[2] Cognee Memify Pipeline — 后处理管线增强图谱质量。
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.models.base import NEGENTROPY_SCHEMA

_SCHEMA = NEGENTROPY_SCHEMA


@dataclass(frozen=True)
class GraphQualityReport:
    """图谱质量报告"""

    total_entities: int
    total_relations: int
    dangling_edges: int  # source/target 不存在于 kg_entities
    orphan_entities: int  # 零度实体（无任何关系）
    community_coverage: float  # 已分配社区的实体占比 0.0–1.0
    entity_confidence_avg: float
    relation_evidence_ratio: float  # 有 evidence_text 的关系占比
    type_distribution: dict[str, int]  # entity_type → count
    quality_score: float  # 综合 0.0–1.0


def _compute_quality_score(report: GraphQualityReport) -> float:
    """综合质量评分（加权算术平均）

    权重分配：
    - 完整性（无悬空边 + 无孤立节点）: 40%
    - 覆盖率（社区分配）: 20%
    - 置信度: 20%
    - 证据支持: 20%
    """
    if report.total_entities == 0:
        return 0.0

    # 完整性: 悬空边和孤立节点越少越好
    max_edges = max(report.total_relations, 1)
    max_entities = max(report.total_entities, 1)
    integrity = 1.0 - (report.dangling_edges / max_edges + report.orphan_entities / max_entities) / 2
    integrity = max(0.0, min(1.0, integrity))

    # 社区覆盖率
    coverage = max(0.0, min(1.0, report.community_coverage))

    # 置信度（归一化到 0–1）
    confidence = min(1.0, report.entity_confidence_avg)

    # 证据支持率
    evidence = max(0.0, min(1.0, report.relation_evidence_ratio))

    score = 0.4 * integrity + 0.2 * coverage + 0.2 * confidence + 0.2 * evidence
    return round(max(0.0, min(1.0, score)), 4)


async def validate_graph_quality(
    db: AsyncSession,
    corpus_id: UUID,
) -> GraphQualityReport:
    """对指定语料库的图谱执行全面质量检查

    Args:
        db: 数据库会话
        corpus_id: 语料库 ID

    Returns:
        GraphQualityReport 质量报告
    """
    # --- 基础统计 ---
    entity_count_row = await db.execute(
        select(func.count())
        .select_from(text(f"{_SCHEMA}.kg_entities"))
        .where(text("corpus_id = :cid"), text("is_active = true"))
        .params(cid=str(corpus_id))
    )
    total_entities = entity_count_row.scalar() or 0

    relation_count_row = await db.execute(
        select(func.count())
        .select_from(text(f"{_SCHEMA}.kg_relations"))
        .where(text("corpus_id = :cid"), text("is_active = true"))
        .params(cid=str(corpus_id))
    )
    total_relations = relation_count_row.scalar() or 0

    # --- 类型分布 ---
    type_dist_row = await db.execute(
        select(text("entity_type"), func.count())
        .select_from(text(f"{_SCHEMA}.kg_entities"))
        .where(text("corpus_id = :cid"), text("is_active = true"))
        .group_by(text("entity_type"))
        .params(cid=str(corpus_id))
    )
    type_distribution = {row[0]: row[1] for row in type_dist_row.all()}

    # --- 悬空边检测 (Paulheim, 2017 §3.1) ---
    # source_id 或 target_id 不在 kg_entities 中
    dangling_row = await db.execute(
        text(f"""
        SELECT COUNT(*) FROM {_SCHEMA}.kg_relations r
        WHERE r.corpus_id = :cid AND r.is_active = true
          AND (
            r.source_id NOT IN (SELECT id FROM {_SCHEMA}.kg_entities WHERE corpus_id = :cid AND is_active = true)
            OR r.target_id NOT IN (SELECT id FROM {_SCHEMA}.kg_entities WHERE corpus_id = :cid AND is_active = true)
          )
        """),
        params={"cid": str(corpus_id)},
    )
    dangling_edges = dangling_row.scalar() or 0

    # --- 孤立实体检测（零度节点）---
    orphan_row = await db.execute(
        text(f"""
        SELECT COUNT(*) FROM {_SCHEMA}.kg_entities e
        WHERE e.corpus_id = :cid AND e.is_active = true
          AND e.id NOT IN (
            SELECT source_id FROM {_SCHEMA}.kg_relations WHERE corpus_id = :cid AND is_active = true
            UNION
            SELECT target_id FROM {_SCHEMA}.kg_relations WHERE corpus_id = :cid AND is_active = true
          )
        """),
        params={"cid": str(corpus_id)},
    )
    orphan_entities = orphan_row.scalar() or 0

    # --- 社区覆盖率 ---
    community_row = await db.execute(
        select(func.count())
        .select_from(text(f"{_SCHEMA}.kg_entities"))
        .where(
            text("corpus_id = :cid"),
            text("is_active = true"),
            text("community_id IS NOT NULL"),
        )
        .params(cid=str(corpus_id))
    )
    entities_with_community = community_row.scalar() or 0
    community_coverage = round(entities_with_community / max(total_entities, 1), 4)

    # --- 平均置信度 ---
    confidence_row = await db.execute(
        select(func.avg(text("confidence")))
        .select_from(text(f"{_SCHEMA}.kg_entities"))
        .where(text("corpus_id = :cid"), text("is_active = true"))
        .params(cid=str(corpus_id))
    )
    entity_confidence_avg = round(confidence_row.scalar() or 0.0, 4)

    # --- 关系证据支持率 ---
    evidence_row = await db.execute(
        select(func.count())
        .select_from(text(f"{_SCHEMA}.kg_relations"))
        .where(
            text("corpus_id = :cid"),
            text("is_active = true"),
            text("evidence_text IS NOT NULL AND evidence_text != ''"),
        )
        .params(cid=str(corpus_id))
    )
    relations_with_evidence = evidence_row.scalar() or 0
    relation_evidence_ratio = round(relations_with_evidence / max(total_relations, 1), 4)

    report = GraphQualityReport(
        total_entities=total_entities,
        total_relations=total_relations,
        dangling_edges=dangling_edges,
        orphan_entities=orphan_entities,
        community_coverage=community_coverage,
        entity_confidence_avg=entity_confidence_avg,
        relation_evidence_ratio=relation_evidence_ratio,
        type_distribution=type_distribution,
        quality_score=0.0,
    )

    return replace(report, quality_score=_compute_quality_score(report))
