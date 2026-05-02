"""
Knowledge Graph Algorithms

在 kg_entities + kg_relations 一等公民表上运行图算法，当前实现 PageRank。

参考文献:
[1] S. Brin and L. Page, "The anatomy of a large-scale hypertextual Web search
    engine," Comput. Netw. ISDN Syst., vol. 30, no. 1-7, pp. 107-117, 1998.
[2] T. Wang et al., "EntityRank: Understanding entity importance via graph-based
    ranking," Proc. IEEE ICDM, pp. 499-508, 2019.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.logging import get_logger
from negentropy.models.base import NEGENTROPY_SCHEMA

logger = get_logger("negentropy.knowledge.graph_algorithms")


async def export_graph_to_networkx(
    db: AsyncSession,
    corpus_id: UUID,
) -> tuple[Any, dict[str, str]]:
    """从 kg_relations 导出图为 NetworkX DiGraph

    Returns:
        (nx.DiGraph, entity_id_map)  entity_id_map: {str(uuid): name}
    """
    import networkx as nx

    schema = NEGENTROPY_SCHEMA

    # 加载实体名称映射
    entities_result = await db.execute(
        text(f"""
            SELECT id, name FROM {schema}.kg_entities
            WHERE corpus_id = :cid AND is_active = true
        """),
        {"cid": str(corpus_id)},
    )
    id_to_name: dict[str, str] = {}
    for row in entities_result:
        id_to_name[str(row.id)] = row.name or str(row.id)

    # 加载关系
    rels_result = await db.execute(
        text(f"""
            SELECT source_id, target_id, weight FROM {schema}.kg_relations
            WHERE corpus_id = :cid AND is_active = true
        """),
        {"cid": str(corpus_id)},
    )

    G = nx.DiGraph()
    for row in rels_result:
        src, tgt = str(row.source_id), str(row.target_id)
        w = float(row.weight) if row.weight else 1.0
        G.add_edge(src, tgt, weight=w)

    # 添加孤立节点
    for eid in id_to_name:
        if eid not in G:
            G.add_node(eid)

    return G, id_to_name


async def compute_pagerank(
    db: AsyncSession,
    corpus_id: UUID,
    *,
    alpha: float = 0.85,
    max_iter: int = 100,
    tolerance: float = 1e-6,
) -> dict[str, float]:
    """计算并持久化 PageRank 实体重要性分数

    使用 NetworkX SciPy 后端幂迭代法 (Brin & Page, 1998)。
    结果写入 kg_entities.importance_score。

    Returns:
        {entity_id_str: pagerank_score}
    """
    import networkx as nx

    G, id_to_name = await export_graph_to_networkx(db, corpus_id)

    if G.number_of_nodes() == 0:
        logger.info("pagerank_skipped_empty_graph", corpus_id=str(corpus_id))
        return {}

    try:
        ranks = nx.pagerank(G, alpha=alpha, max_iter=max_iter, tol=tolerance, weight="weight")
    except nx.PowerIterationFailedConvergence:
        logger.warning("pagerank_convergence_failed", corpus_id=str(corpus_id), max_iter=max_iter)
        # 降级：使用度中心性
        ranks = {node: (G.in_degree(node, weight="weight") + G.out_degree(node, weight="weight")) for node in G.nodes()}
        total = sum(ranks.values()) or 1.0
        ranks = {k: v / total for k, v in ranks.items()}

    # 持久化到 kg_entities.importance_score
    schema = NEGENTROPY_SCHEMA
    for entity_id_str, score in ranks.items():
        await db.execute(
            text(f"""
                UPDATE {schema}.kg_entities
                SET importance_score = :score
                WHERE id = :eid AND corpus_id = :cid
            """),
            {"score": score, "eid": entity_id_str, "cid": str(corpus_id)},
        )

    await db.commit()

    logger.info(
        "pagerank_completed",
        corpus_id=str(corpus_id),
        node_count=G.number_of_nodes(),
        edge_count=G.number_of_edges(),
        top_entity=id_to_name.get(max(ranks, key=ranks.get), "unknown") if ranks else None,
    )

    return ranks
