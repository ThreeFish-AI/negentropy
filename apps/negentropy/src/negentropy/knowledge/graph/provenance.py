"""Provenance Builder — 多跳推理证据链构造 (Phase 4 G4)

针对 PPR top-K 实体反向追溯到 seed 的最短路径，每条边附带 evidence_text，
让 LLM 在最终答案中引用具体来源（chunk）。

设计参考：
  - HippoRAG (NeurIPS'24) 的 path-based reasoning
  - Think-on-Graph (ICLR'24) 的三元路径验证

参考文献:
  [1] B. Gutiérrez et al., "HippoRAG: Neurobiologically Inspired Long-Term
      Memory for LLMs," *NeurIPS*, 2024.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.logging import get_logger
from negentropy.models.base import NEGENTROPY_SCHEMA

logger = get_logger("negentropy.knowledge.graph.provenance")


@dataclass(frozen=True)
class EvidenceEdge:
    """单条证据边 — 三元组 + 证据文本"""

    source_id: str
    target_id: str
    relation: str
    evidence_text: str
    weight: float = 1.0
    source_label: str = ""
    target_label: str = ""


@dataclass(frozen=True)
class EvidenceChain:
    """单个 top entity 的证据链 — 从某 seed 到该 entity 的路径 + 沿途三元组"""

    target_entity_id: str
    target_label: str
    score: float
    seed_entity_id: str | None  # None 表示 seed 自身
    path: list[str] = field(default_factory=list)  # entity ID 列表（含两端）
    edges: list[EvidenceEdge] = field(default_factory=list)


class ProvenanceBuilder:
    """证据链构造器 — 对 PPR top-K 反向找最短路径并组装三元组。"""

    def __init__(self, max_chain_depth: int = 5) -> None:
        if max_chain_depth < 1 or max_chain_depth > 10:
            raise ValueError(f"max_chain_depth must be in [1,10], got {max_chain_depth}")
        self._max_depth = max_chain_depth

    async def build(
        self,
        db: AsyncSession,
        corpus_id: UUID,
        top_entities: list[tuple[str, float]],
        seed_entities: list[str],
    ) -> list[EvidenceChain]:
        """为 top_entities 中每个实体构造一条证据链。

        Args:
            top_entities: ``[(entity_id, ppr_score), ...]``
            seed_entities: PPR 种子（用于路径追溯起点）

        Returns:
            按 score 降序排列的 EvidenceChain 列表
        """
        if not top_entities:
            return []

        seed_set = {s.replace("entity:", "") for s in seed_entities if s}
        chains: list[EvidenceChain] = []

        # 一次性加载所有相关实体的 label，减少 round-trip
        all_ids = {tid.replace("entity:", "") for tid, _ in top_entities} | seed_set
        labels = await self._load_labels(db, corpus_id, all_ids)

        for entity_id_raw, score in top_entities:
            target_id = entity_id_raw.replace("entity:", "")
            if target_id in seed_set:
                # seed 本身：路径长度 0
                chains.append(
                    EvidenceChain(
                        target_entity_id=target_id,
                        target_label=labels.get(target_id, target_id),
                        score=score,
                        seed_entity_id=target_id,
                        path=[target_id],
                        edges=[],
                    )
                )
                continue

            best = await self._best_path_to_seeds(db, corpus_id, target_id, seed_set)
            if best is None:
                # 无路径：仍保留实体节点但 path=[target] / edges=[]
                chains.append(
                    EvidenceChain(
                        target_entity_id=target_id,
                        target_label=labels.get(target_id, target_id),
                        score=score,
                        seed_entity_id=None,
                        path=[target_id],
                        edges=[],
                    )
                )
                continue

            seed_id, path = best
            edges = await self._fetch_edges_along_path(db, corpus_id, path)
            chains.append(
                EvidenceChain(
                    target_entity_id=target_id,
                    target_label=labels.get(target_id, target_id),
                    score=score,
                    seed_entity_id=seed_id,
                    path=path,
                    edges=edges,
                )
            )

        return chains

    async def _load_labels(
        self,
        db: AsyncSession,
        corpus_id: UUID,
        ids: set[str],
    ) -> dict[str, str]:
        if not ids:
            return {}
        result = await db.execute(
            text(f"""
                SELECT id, name FROM {NEGENTROPY_SCHEMA}.kg_entities
                WHERE corpus_id = :cid AND id = ANY(CAST(:ids AS uuid[])) AND is_active = true
            """),
            {"cid": str(corpus_id), "ids": list(ids)},
        )
        return {str(row.id): row.name or str(row.id) for row in result}

    async def _best_path_to_seeds(
        self,
        db: AsyncSession,
        corpus_id: UUID,
        target_id: str,
        seed_set: set[str],
    ) -> tuple[str, list[str]] | None:
        """对每个 seed 调一次 BFS，取最短路径。

        简化实现：本类只产出"展示用"路径，不依赖时态过滤；正式时态版本由
        graph repository.find_path 承担（有 as_of 参数），此处保留独立实现以
        避免引入循环依赖。
        """
        # 单次递归 CTE 找出从 target 到任意 seed 的最短无向路径
        if not seed_set:
            return None
        result = await db.execute(
            text(f"""
                WITH RECURSIVE path_search AS (
                    SELECT
                        CAST(:target_id AS uuid) AS current_id,
                        ARRAY[CAST(:target_id AS uuid)] AS path,
                        0 AS depth
                    UNION ALL
                    SELECT
                        CASE
                            WHEN r.source_id = ps.current_id THEN r.target_id
                            ELSE r.source_id
                        END AS current_id,
                        ps.path || (CASE
                            WHEN r.source_id = ps.current_id THEN r.target_id
                            ELSE r.source_id
                        END),
                        ps.depth + 1
                    FROM {NEGENTROPY_SCHEMA}.kg_relations r
                    JOIN path_search ps ON (r.source_id = ps.current_id OR r.target_id = ps.current_id)
                    WHERE r.is_active = true
                      AND r.corpus_id = :cid
                      AND ps.depth < :max_depth
                      AND NOT (CASE
                            WHEN r.source_id = ps.current_id THEN r.target_id
                            ELSE r.source_id
                        END = ANY(ps.path))
                )
                SELECT current_id, path, depth
                FROM path_search
                WHERE current_id = ANY(CAST(:seed_ids AS uuid[])) AND depth > 0
                ORDER BY depth
                LIMIT 1
            """),
            {
                "target_id": target_id,
                "cid": str(corpus_id),
                "max_depth": self._max_depth,
                "seed_ids": list(seed_set),
            },
        )
        row = result.first()
        if row is None:
            return None
        return str(row.current_id), [str(p) for p in row.path]

    async def _fetch_edges_along_path(
        self,
        db: AsyncSession,
        corpus_id: UUID,
        path: list[str],
    ) -> list[EvidenceEdge]:
        if len(path) < 2:
            return []
        edges: list[EvidenceEdge] = []
        for a, b in zip(path[:-1], path[1:], strict=True):
            result = await db.execute(
                text(f"""
                    SELECT r.source_id, r.target_id, r.relation_type, r.evidence_text, r.weight,
                           s.label AS source_label, t.label AS target_label
                    FROM {NEGENTROPY_SCHEMA}.kg_relations r
                    LEFT JOIN {NEGENTROPY_SCHEMA}.kg_entities s ON r.source_id = s.id
                    LEFT JOIN {NEGENTROPY_SCHEMA}.kg_entities t ON r.target_id = t.id
                    WHERE r.corpus_id = :cid AND r.is_active = true
                      AND ((r.source_id = :a AND r.target_id = :b)
                        OR (r.source_id = :b AND r.target_id = :a))
                    ORDER BY r.weight DESC NULLS LAST
                    LIMIT 1
                """),
                {"cid": str(corpus_id), "a": a, "b": b},
            )
            row = result.first()
            if row is None:
                continue
            edges.append(
                EvidenceEdge(
                    source_id=str(row.source_id),
                    target_id=str(row.target_id),
                    relation=row.relation_type or "related_to",
                    evidence_text=row.evidence_text or "",
                    weight=float(row.weight or 1.0),
                    source_label=row.source_label or "",
                    target_label=row.target_label or "",
                )
            )
        return edges


def evidence_chain_to_dict(chain: EvidenceChain) -> dict[str, Any]:
    """序列化为 API 友好 dict。"""
    return {
        "target_entity_id": chain.target_entity_id,
        "target_label": chain.target_label,
        "score": chain.score,
        "seed_entity_id": chain.seed_entity_id,
        "path": chain.path,
        "edges": [
            {
                "source_id": e.source_id,
                "target_id": e.target_id,
                "source_label": e.source_label,
                "target_label": e.target_label,
                "relation": e.relation,
                "evidence_text": e.evidence_text,
                "weight": e.weight,
            }
            for e in chain.edges
        ],
    }
