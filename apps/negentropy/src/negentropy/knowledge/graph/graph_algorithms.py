"""
Knowledge Graph Algorithms

在 kg_entities + kg_relations 一等公民表上运行图算法，当前实现 PageRank、Leiden/Louvain 社区检测、PPR。

参考文献:
[1] S. Brin and L. Page, "The anatomy of a large-scale hypertextual Web search
    engine," Comput. Netw. ISDN Syst., vol. 30, no. 1-7, pp. 107-117, 1998.
[2] T. Wang et al., "EntityRank: Understanding entity importance via graph-based
    ranking," Proc. IEEE ICDM, pp. 499-508, 2019.
[3] V. D. Blondel, J.-L. Guillaume, R. Lambiotte, and E. Lefebvre, "Fast unfolding
    of communities in large networks," J. Stat. Mech., P10008, 2008.
[4] V. A. Traag, L. Waltman, and N. J. van Eck, "From Louvain to Leiden:
    guaranteeing well-connected communities," Sci. Rep., vol. 9, 5233, 2019.
[5] B. Edge et al., "From Local to Global: A Graph RAG Approach to Query-Focused
    Summarization," arXiv:2404.16130, 2024.
"""

from __future__ import annotations

import asyncio
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

    # 批量持久化到 kg_entities.importance_score
    schema = NEGENTROPY_SCHEMA
    batch_size = 500
    rank_items = list(ranks.items())

    for i in range(0, len(rank_items), batch_size):
        chunk = rank_items[i : i + batch_size]
        values_clause = ", ".join(f"(:eid_{j}, :score_{j})" for j in range(len(chunk)))
        params = {"cid": str(corpus_id)}
        for j, (entity_id_str, score) in enumerate(chunk):
            params[f"eid_{j}"] = entity_id_str
            params[f"score_{j}"] = score

        await db.execute(
            text(f"""
                UPDATE {schema}.kg_entities e
                SET importance_score = v.score
                FROM (VALUES {values_clause}) AS v(eid uuid, score float)
                WHERE e.id = v.eid AND e.corpus_id = :cid
            """),
            params,
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


async def compute_personalized_pagerank(
    db: AsyncSession,
    corpus_id: UUID,
    seed_entities: list[str],
    *,
    alpha: float = 0.85,
    max_iter: int = 100,
    tolerance: float = 1e-6,
) -> dict[str, float]:
    """Personalized PageRank — 以 seed 为偏置 teleport 向量传播相关性 (Page et al., 1999)。

    HippoRAG (Gutiérrez et al., NeurIPS 2024) 在多跳问答上证明 PPR + 命名实体抽取
    优于密集检索。本函数仅计算分数（不写库），供 multi_hop_reason 端点动态使用。

    Args:
        seed_entities: 种子实体 ID 列表（含或不含 ``entity:`` 前缀）；分数将平均分配
            为 personalization 向量。
        alpha: damping 系数（默认 0.85）
        max_iter / tolerance: 幂迭代收敛参数

    Returns:
        ``{entity_id_str: ppr_score}``；图为空或 seed 全部不在图中时返回 ``{}``。
    """
    import networkx as nx

    G, _ = await export_graph_to_networkx(db, corpus_id)

    if G.number_of_nodes() == 0:
        logger.info("ppr_skipped_empty_graph", corpus_id=str(corpus_id))
        return {}

    # 归一化 seed_entities：去 ``entity:`` 前缀，过滤不在图中的
    cleaned = [s.replace("entity:", "").strip() for s in seed_entities if s]
    valid_seeds = [s for s in cleaned if s in G]
    if not valid_seeds:
        logger.info(
            "ppr_seeds_not_in_graph",
            corpus_id=str(corpus_id),
            requested=cleaned,
        )
        return {}

    weight = 1.0 / len(valid_seeds)
    personalization = {node: 0.0 for node in G.nodes()}
    for seed in valid_seeds:
        personalization[seed] = weight

    try:
        # multi_hop_reason 是在线请求路径，PPR 在千节点级图上可能 100ms~数秒，
        # 必须卸载到线程池避免阻塞 FastAPI 事件循环（与同 worker 上其它请求互相饿死）。
        ranks = await asyncio.to_thread(
            nx.pagerank,
            G,
            alpha=alpha,
            max_iter=max_iter,
            tol=tolerance,
            personalization=personalization,
            weight="weight",
        )
    except nx.PowerIterationFailedConvergence:
        logger.warning(
            "ppr_convergence_failed",
            corpus_id=str(corpus_id),
            seeds=valid_seeds[:5],
        )
        # 降级：种子节点本身得分 1，其余 0（与 PageRank 失败降级互补）
        ranks = {node: (1.0 if node in set(valid_seeds) else 0.0) for node in G.nodes()}

    logger.info(
        "ppr_completed",
        corpus_id=str(corpus_id),
        seed_count=len(valid_seeds),
        node_count=G.number_of_nodes(),
    )

    return ranks


async def compute_communities(
    db: AsyncSession,
    corpus_id: UUID,
    *,
    resolutions: list[float] | None = None,
    threshold: float = 1e-07,
    seed: int = 42,
    algorithm: str = "auto",
) -> dict[int, dict[str, int]]:
    """计算多层级社区划分并持久化

    使用 Leiden (Traag et al., 2019) 或 Louvain (Blondel et al., 2008) 在无向投影图上运行。
    支持多分辨率参数产生层级化社区结构 (Edge et al., 2024)。
    Level 0 为最细粒度（高 resolution），Level N 为最粗粒度（低 resolution）。

    结果写入 kg_entities.community_id（使用中间 level）和 kg_community_summaries。

    Args:
        resolutions: 分辨率参数列表，默认 [0.5, 1.0, 2.0]
            高 resolution → 更多小社区（细粒度），低 → 更少大社区（粗粒度）
        threshold: 模块度优化收敛阈值
        seed: 随机种子，保证可复现性
        algorithm: "auto" | "leiden" | "louvain"

    Returns:
        {level: {entity_id_str: community_id}}
    """
    import networkx as nx

    if resolutions is None:
        resolutions = [0.5, 1.0, 2.0]

    G, id_to_name = await export_graph_to_networkx(db, corpus_id)

    if G.number_of_nodes() == 0:
        logger.info("communities_skipped_empty_graph", corpus_id=str(corpus_id))
        return {}

    G_undirected = G.to_undirected()

    # 选择算法：优先 Leiden（保证社区内部连通性，Traag et al., 2019）
    use_leiden = algorithm != "louvain" and hasattr(nx.community, "leiden_communities")
    algo_name = "leiden" if use_leiden else "louvain"

    # 按分辨率从高到低排列，映射为 level 0, 1, 2...
    sorted_resolutions = sorted(resolutions, reverse=True)
    all_levels: dict[int, dict[str, int]] = {}

    for level, res in enumerate(sorted_resolutions):
        try:
            if use_leiden:
                communities = nx.community.leiden_communities(
                    G_undirected,
                    weight="weight",
                    resolution=res,
                    seed=seed,
                )
            else:
                communities = nx.community.louvain_communities(
                    G_undirected,
                    weight="weight",
                    resolution=res,
                    threshold=threshold,
                    seed=seed,
                )
        except Exception as exc:
            logger.warning(
                "community_computation_failed",
                corpus_id=str(corpus_id),
                algorithm=algo_name,
                level=level,
                resolution=res,
                error=str(exc),
            )
            continue

        partition: dict[str, int] = {}
        for community_idx, community_set in enumerate(communities):
            for entity_id in community_set:
                partition[entity_id] = community_idx

        all_levels[level] = partition

        community_counts: dict[int, int] = {}
        for cid in partition.values():
            community_counts[cid] = community_counts.get(cid, 0) + 1

        logger.info(
            "community_level_completed",
            corpus_id=str(corpus_id),
            algorithm=algo_name,
            level=level,
            resolution=res,
            node_count=G.number_of_nodes(),
            community_count=len(communities),
            largest_community=max(community_counts.values()) if community_counts else 0,
        )

    # 使用中间 level 持久化到 kg_entities.community_id（向后兼容）
    if all_levels:
        mid_level = sorted(all_levels.keys())[len(all_levels) // 2]
        primary_partition = all_levels[mid_level]

        schema = NEGENTROPY_SCHEMA
        batch_size = 500
        partition_items = list(primary_partition.items())

        for i in range(0, len(partition_items), batch_size):
            chunk = partition_items[i : i + batch_size]
            values_clause = ", ".join(f"(:eid_{j}, :cid_{j})" for j in range(len(chunk)))
            params = {"corpus_id": str(corpus_id)}
            for j, (entity_id_str, community_id) in enumerate(chunk):
                params[f"eid_{j}"] = entity_id_str
                params[f"cid_{j}"] = community_id

            await db.execute(
                text(f"""
                    UPDATE {schema}.kg_entities e
                    SET community_id = v.cid
                    FROM (VALUES {values_clause}) AS v(eid uuid, cid int)
                    WHERE e.id = v.eid AND e.corpus_id = :corpus_id
                """),
                params,
            )

        await db.commit()

    return all_levels


# 向后兼容别名
async def compute_louvain(
    db: AsyncSession,
    corpus_id: UUID,
    *,
    resolution: float = 1.0,
    threshold: float = 1e-07,
    seed: int = 42,
) -> dict[str, int]:
    """计算社区划分（向后兼容接口）

    委托给 compute_communities，返回主 level 的 partition。
    """
    levels = await compute_communities(
        db,
        corpus_id,
        resolutions=[resolution],
        threshold=threshold,
        seed=seed,
        algorithm="auto",
    )
    if not levels:
        return {}
    return levels[0]
