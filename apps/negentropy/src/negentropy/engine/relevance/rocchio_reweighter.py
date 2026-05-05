"""
RocchioReweighter — 基于累积反馈的 per-memory 相关性重加权。

理论：
- Rocchio (1971) 相关性反馈<sup>[[1]](#ref1)</sup>：
  weight = 1.0 + β·helpful_ratio - γ·irrelevant_ratio
- 权重 clamp 到 [min_weight, max_weight] 防止极端值

参考文献:
[1] J. J. Rocchio, "Relevance feedback in information retrieval,"
    in *The SMART Retrieval System*, Prentice-Hall, 1971, pp. 313-323.
"""

from __future__ import annotations

import uuid

import sqlalchemy as sa

import negentropy.db.session as db_session
from negentropy.logging import get_logger
from negentropy.models.internalization import MemoryRetrievalLog

logger = get_logger("negentropy.engine.relevance.rocchio_reweighter")


def compute_relevance_weight(
    helpful_count: int,
    irrelevant_count: int,
    total_count: int,
    *,
    beta: float = 0.75,
    gamma: float = 0.15,
    min_count: int = 3,
    min_weight: float = 0.5,
    max_weight: float = 2.0,
) -> float:
    """计算单条记忆的相关性权重。

    基于 Rocchio<sup>[[1]](#ref1)</sup>公式：
    weight = 1.0 + β·(helpful/total) - γ·(irrelevant/total)

    Args:
        helpful_count: helpful 反馈数
        irrelevant_count: irrelevant + harmful 反馈数
        total_count: 总反馈数
        beta: 正反馈系数
        gamma: 负反馈系数
        min_count: 最低反馈数门槛
        min_weight: 权重下限
        max_weight: 权重上限
    """
    if total_count < min_count:
        return 1.0
    helpful_ratio = helpful_count / total_count
    irrelevant_ratio = irrelevant_count / total_count
    weight = 1.0 + (beta * helpful_ratio) - (gamma * irrelevant_ratio)
    return max(min_weight, min(max_weight, weight))


async def reweight_memories(
    *,
    user_id: str,
    app_name: str,
    beta: float = 0.75,
    gamma: float = 0.15,
    min_count: int = 3,
) -> int:
    """聚合用户所有反馈并重写 memories.metadata_.relevance_weight。

    Returns:
        被更新的记忆条数
    """
    # 聚合反馈
    async with db_session.AsyncSessionLocal() as db:
        stmt = sa.select(
            MemoryRetrievalLog.retrieved_memory_ids,
            MemoryRetrievalLog.outcome_feedback,
        ).where(
            MemoryRetrievalLog.user_id == user_id,
            MemoryRetrievalLog.app_name == app_name,
            MemoryRetrievalLog.outcome_feedback.isnot(None),
        )
        rows = (await db.execute(stmt)).all()

    # 统计 per-memory 反馈
    feedback_map: dict[str, dict[str, int]] = {}
    for row in rows:
        outcome = row.outcome_feedback
        if not outcome:
            continue
        for mid in row.retrieved_memory_ids or []:
            key = str(mid)
            if key not in feedback_map:
                feedback_map[key] = {"helpful": 0, "irrelevant": 0}
            if outcome == "helpful":
                feedback_map[key]["helpful"] += 1
            else:
                feedback_map[key]["irrelevant"] += 1

    if not feedback_map:
        return 0

    # 计算权重并批量更新
    updated = 0
    from negentropy.models.internalization import Memory

    async with db_session.AsyncSessionLocal() as db:
        for mid_str, counts in feedback_map.items():
            total = counts["helpful"] + counts["irrelevant"]
            weight = compute_relevance_weight(
                counts["helpful"],
                counts["irrelevant"],
                total,
                beta=beta,
                gamma=gamma,
                min_count=min_count,
            )
            if abs(weight - 1.0) < 1e-6:
                continue

            try:
                mid_uuid = uuid.UUID(mid_str)
            except ValueError:
                continue
            # JSONB merge: 保留现有 metadata，新增 relevance_weight
            stmt = (
                sa.update(Memory)
                .where(Memory.id == mid_uuid)
                .values(
                    metadata_=sa.func.jsonb_set(
                        sa.func.coalesce(
                            Memory.metadata_,
                            sa.text("'{}'::jsonb"),
                        ),
                        sa.text("ARRAY['relevance_weight']"),
                        sa.func.to_jsonb(sa.literal(weight)),
                    )
                )
            )
            result = await db.execute(stmt)
            if result.rowcount and result.rowcount > 0:
                updated += 1
        await db.commit()

    logger.info(
        "rocchio_reweight_completed",
        user_id=user_id,
        memories_evaluated=len(feedback_map),
        memories_updated=updated,
    )
    return updated
