"""
PRFExpander — 伪相关反馈查询扩展。

理论：
- Pseudo-Relevance Feedback (PRF)<sup>[[1]](#ref1)</sup>：
  将 top-K 初检结果视为伪相关文档，用其 embedding 质心扩展查询向量。
  q' = α·q + (1-α)·centroid(top_k_embeddings)

参考文献:
[1] Y. Lv and C. Zhai, "A comparative study of methods for estimating
    query language models," in *Proc. SIGIR*, 2009, pp. 289-296.
"""

from __future__ import annotations

from negentropy.logging import get_logger

logger = get_logger("negentropy.engine.relevance.prf_expander")


def expand_query_embedding(
    query_embedding: list[float],
    top_k_embeddings: list[list[float]],
    *,
    alpha: float = 1.0,
    prf_alpha: float = 0.7,
) -> list[float]:
    """用 top-K 结果的 embedding 质心扩展查询向量。

    PRF 公式<sup>[[1]](#ref1)</sup>：
    expanded = prf_alpha × query + (1 - prf_alpha) × centroid(top_k)

    Args:
        query_embedding: 原始查询向量
        top_k_embeddings: 初检 top-K 结果的向量列表
        alpha: Rocchio α 参数（此处固定为 1.0，保持查询原始权重）
        prf_alpha: PRF 融合系数，越高越偏向原始查询

    Returns:
        扩展后的查询向量
    """
    if not top_k_embeddings:
        return query_embedding

    dim = len(query_embedding)

    # 计算质心
    centroid = [0.0] * dim
    for emb in top_k_embeddings:
        if len(emb) != dim:
            continue
        for i in range(dim):
            centroid[i] += emb[i]

    valid_count = len(top_k_embeddings)
    if valid_count == 0:
        return query_embedding

    for i in range(dim):
        centroid[i] /= valid_count

    # 融合
    expanded = [prf_alpha * query_embedding[i] + (1 - prf_alpha) * centroid[i] for i in range(dim)]

    # 归一化（可选：保持向量模长稳定）
    import math

    norm = math.sqrt(sum(x * x for x in expanded))
    if norm > 0:
        expanded = [x / norm for x in expanded]

    return expanded
