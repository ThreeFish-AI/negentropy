"""
时态事实冲突检测 (Temporal Fact Resolution)

基于 Snodgrass & Ahn (1985) 的双时轴模型实现事实有效期管理：
  - valid_from / valid_to: 事实在现实中的有效时间窗口
  - 当新提取的事实与已有事实矛盾时，自动过期旧事实

工程参考:
  - Graphiti (Zep): valid_at / invalid_at 自动矛盾检测
  - mem0: 时间戳加权的事实偏好（较新的优先）

参考文献:
  [1] R. Snodgrass and I. Ahn, "A taxonomy of time in databases,"
      *Proc. ACM SIGMOD*, pp. 236–246, 1985.
  [2] L. Jiang et al., "Encoding temporal information for temporal
      knowledge graph completion," *IJCAI*, 2021.
"""

from __future__ import annotations

from datetime import UTC, datetime
from enum import Enum
from typing import Any

from negentropy.logging import get_logger

logger = get_logger(__name__.rsplit(".", 1)[0])


class TemporalVerdict(str, Enum):
    """时态冲突分类"""

    REINFORCE = "reinforce"  # 强化：同一事实，增加置信度
    UPDATE = "update"  # 更新：事实值变化，过期旧值
    CONTRADICTION = "contradiction"  # 矛盾：互斥事实，标记待审


class TemporalResolver:
    """时态事实冲突检测服务

    在图谱构建管线中，对新提取的关系与已有关系进行时态分析，
    自动分类并处理三种情况：
      1. 强化 (REINFORCE): 同一 source-target-edge_type 且证据文本一致
      2. 更新 (UPDATE): 同一 source-target-edge_type 但 evidence 不同
      3. 矛盾 (CONTRADICTION): 互斥关系（如 WORKS_FOR 不同的目标）
    """

    # 互斥关系类型：同一源实体只能有一个当前有效值
    MUTUALLY_EXCLUSIVE_TYPES = {
        "WORKS_FOR",
        "LOCATED_IN",
        "PART_OF",
        "CREATED_BY",
    }

    async def resolve_relations(
        self,
        new_relations: list[dict[str, Any]],
        existing_lookup: Any,  # Callable: (source_id, target_id, edge_type, corpus_id) → list[dict]
        corpus_id: Any,
    ) -> list[dict[str, Any]]:
        """对新关系列表执行时态冲突检测

        Args:
            new_relations: 新提取的关系列表，每项包含 source, target, edge_type, evidence, weight
            existing_lookup: 异步回调，查找已有关系
            corpus_id: 语料库 ID

        Returns:
            带有时态元数据的关系列表
        """
        now = datetime.now(UTC)
        results = []

        for rel in new_relations:
            source = rel.get("source", "")
            target = rel.get("target", "")
            edge_type = rel.get("edge_type", "RELATED_TO")
            evidence = rel.get("evidence", "")

            verdict = TemporalVerdict.REINFORCE
            expire_ids: list[str] = []

            if existing_lookup is not None:
                try:
                    existing = await existing_lookup(source, target, edge_type, corpus_id)

                    if existing:
                        # 检查是否为完全相同的事实（相同端点 + 相同证据）
                        for ex in existing:
                            if ex.get("evidence_text", "") == evidence:
                                verdict = TemporalVerdict.REINFORCE
                                break
                        else:
                            # 端点相同但证据不同 → 更新
                            verdict = TemporalVerdict.UPDATE
                            expire_ids = [str(ex.get("id", "")) for ex in existing]

                    # 检查互斥关系
                    if edge_type in self.MUTUALLY_EXCLUSIVE_TYPES:
                        conflicting = await existing_lookup(source, None, edge_type, corpus_id)
                        if conflicting:
                            for cf in conflicting:
                                if str(cf.get("target_id", "")) != str(target):
                                    verdict = TemporalVerdict.CONTRADICTION
                                    expire_ids.append(str(cf.get("id", "")))

                except Exception as exc:
                    logger.warning(
                        "temporal_lookup_failed",
                        error=str(exc),
                        source=source,
                        edge_type=edge_type,
                    )

            # 注入时态元数据
            resolved_rel = {
                **rel,
                "valid_from": now.isoformat(),
                "valid_to": None,
                "temporal_verdict": verdict.value,
                "expire_ids": expire_ids,
            }
            results.append(resolved_rel)

            if verdict != TemporalVerdict.REINFORCE:
                logger.info(
                    "temporal_resolution",
                    verdict=verdict.value,
                    source=source,
                    target=target,
                    edge_type=edge_type,
                    expire_count=len(expire_ids),
                )

        return results
