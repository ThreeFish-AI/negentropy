"""
RRF (Reciprocal Rank Fusion) 实现

融合多路检索结果，使用倒数排名公式合并排序。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class SearchResult:
    """单条检索结果"""

    id: str
    content: str
    score: float
    metadata: dict[str, Any] | None = None
    rank: int = 0


def rrf_fusion(result_lists: list[list[SearchResult]], k: int = 60, limit: int = 50) -> list[SearchResult]:
    """
    Reciprocal Rank Fusion 算法

    公式: RRF(d) = Σ (1 / (k + rank(d)))

    Args:
        result_lists: 多个检索器的结果列表
        k: 平滑常数 (标准值 60)
        limit: 返回结果数量

    Returns:
        融合后的排序结果
    """
    # 1. 为每个列表分配排名
    for results in result_lists:
        for rank, result in enumerate(results, start=1):
            result.rank = rank

    # 2. 按 ID 聚合计算 RRF 分数
    rrf_scores: dict[str, tuple[float, SearchResult]] = {}

    for results in result_lists:
        for result in results:
            if result.id not in rrf_scores:
                rrf_scores[result.id] = (0.0, result)

            current_score, current_result = rrf_scores[result.id]
            # RRF 公式: 1 / (k + rank)
            new_score = current_score + 1.0 / (k + result.rank)
            rrf_scores[result.id] = (new_score, current_result)

    # 3. 按 RRF 分数排序
    sorted_results = sorted(rrf_scores.values(), key=lambda x: x[0], reverse=True)

    # 4. 返回 Top-K 结果
    return [
        SearchResult(id=result.id, content=result.content, score=score, metadata=result.metadata)
        for score, result in sorted_results[:limit]
    ]


# 使用示例
if __name__ == "__main__":
    # 模拟两路检索结果
    semantic_results = [
        SearchResult(id="doc1", content="Python programming", score=0.95),
        SearchResult(id="doc2", content="Machine learning", score=0.90),
        SearchResult(id="doc3", content="Data science", score=0.85),
    ]

    keyword_results = [
        SearchResult(id="doc2", content="Machine learning", score=0.88),
        SearchResult(id="doc4", content="Deep learning", score=0.85),
        SearchResult(id="doc1", content="Python programming", score=0.80),
    ]

    fused = rrf_fusion([semantic_results, keyword_results], k=60, limit=10)

    for result in fused:
        print(f"ID: {result.id}, RRF Score: {result.score:.4f}")
