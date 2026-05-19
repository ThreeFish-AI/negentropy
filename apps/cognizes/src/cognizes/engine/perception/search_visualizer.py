"""
Perception SearchVisualizer: 检索过程可视化接口

职责:
1. 提供多路召回过程可视化
2. 展示 RRF 融合和 Rerank 过程
3. 生成引用来源标注
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Optional
from datetime import datetime
from enum import Enum


class SearchEventType(str, Enum):
    """检索相关 AG-UI 事件类型"""

    RETRIEVAL_DETAIL = "retrieval_detail"
    RRF_RESULT = "rrf_result"
    RERANK_RESULT = "rerank_result"
    SOURCE_CITATION = "source_citation"


@dataclass
class RetrievalPathResult:
    """单路检索结果"""

    path_name: str  # semantic, keyword, metadata
    doc_count: int
    latency_ms: float
    top_docs: list[dict]  # [{id, score, preview}]


@dataclass
class RRFMergeResult:
    """RRF 融合结果"""

    input_paths: list[str]
    output_count: int
    rank_changes: list[dict]  # [{doc_id, before_rank, after_rank}]


@dataclass
class RerankComparison:
    """Rerank 前后对比"""

    doc_id: str
    content_preview: str
    l0_score: float  # 粗排分数
    l1_score: float  # 精排分数
    rank_before: int
    rank_after: int


@dataclass
class SourceCitation:
    """引用来源"""

    doc_id: str
    source_type: str  # memory, document, web
    title: str
    url: Optional[str] = None
    snippet: str = ""
    relevance_score: float = 0.0


class SearchVisualizer:
    """检索过程可视化器"""

    def __init__(self, event_emitter=None):
        """
        Args:
            event_emitter: AG-UI 事件发射器 (可选)
        """
        self._event_emitter = event_emitter

    async def emit_search_started(self, run_id: str, query: str, search_config: dict) -> None:
        """
        发射检索开始事件

        Args:
            run_id: 当前运行 ID
            query: 搜索查询
            search_config: 检索配置
        """
        if self._event_emitter:
            await self._event_emitter.emit_step_started(
                run_id=run_id,
                step_name="perception_search",
                data={
                    "query": query,
                    "config": {
                        "semanticWeight": search_config.get("semantic_weight", 0.5),
                        "keywordWeight": search_config.get("keyword_weight", 0.3),
                        "metadataFilters": search_config.get("filters", {}),
                        "topK": search_config.get("top_k", 50),
                    },
                },
            )

    async def emit_retrieval_paths(self, run_id: str, path_results: list[RetrievalPathResult]) -> None:
        """
        发射多路召回详情事件

        用于展示各检索路径的召回结果对比

        Args:
            run_id: 当前运行 ID
            path_results: 各路检索结果
        """
        if self._event_emitter:
            await self._event_emitter.emit_custom(
                run_id=run_id,
                event_name=SearchEventType.RETRIEVAL_DETAIL.value,
                data={
                    "paths": [
                        {
                            "name": p.path_name,
                            "docCount": p.doc_count,
                            "latencyMs": p.latency_ms,
                            "topDocs": p.top_docs[:5],  # 只展示 Top 5
                        }
                        for p in path_results
                    ],
                    "totalLatencyMs": sum(p.latency_ms for p in path_results),
                },
            )

    async def emit_rrf_merge(self, run_id: str, merge_result: RRFMergeResult) -> None:
        """
        发射 RRF 融合结果事件

        Args:
            run_id: 当前运行 ID
            merge_result: 融合结果
        """
        if self._event_emitter:
            await self._event_emitter.emit_custom(
                run_id=run_id,
                event_name=SearchEventType.RRF_RESULT.value,
                data={
                    "inputPaths": merge_result.input_paths,
                    "outputCount": merge_result.output_count,
                    "significantRankChanges": [
                        {
                            "docId": rc["doc_id"],
                            "beforeRank": rc["before_rank"],
                            "afterRank": rc["after_rank"],
                            "change": rc["before_rank"] - rc["after_rank"],
                        }
                        for rc in merge_result.rank_changes
                        if abs(rc["before_rank"] - rc["after_rank"]) >= 3
                    ][:10],  # 只展示显著变化
                },
            )

    async def emit_rerank_comparison(self, run_id: str, comparisons: list[RerankComparison]) -> None:
        """
        发射 Rerank 前后对比事件

        Args:
            run_id: 当前运行 ID
            comparisons: 对比列表
        """
        if self._event_emitter:
            await self._event_emitter.emit_custom(
                run_id=run_id,
                event_name=SearchEventType.RERANK_RESULT.value,
                data={
                    "comparisons": [
                        {
                            "docId": c.doc_id,
                            "preview": c.content_preview[:100],
                            "l0Score": round(c.l0_score, 4),
                            "l1Score": round(c.l1_score, 4),
                            "rankBefore": c.rank_before,
                            "rankAfter": c.rank_after,
                            "improved": c.rank_after < c.rank_before,
                        }
                        for c in comparisons[:20]  # 只展示 Top 20
                    ],
                    "avgScoreImprovement": sum(c.l1_score - c.l0_score for c in comparisons) / len(comparisons)
                    if comparisons
                    else 0,
                },
            )

    async def emit_search_finished(self, run_id: str, result_count: int, total_latency_ms: float) -> None:
        """
        发射检索完成事件

        Args:
            run_id: 当前运行 ID
            result_count: 结果数量
            total_latency_ms: 总延迟
        """
        if self._event_emitter:
            await self._event_emitter.emit_step_finished(
                run_id=run_id,
                step_name="perception_search",
                data={"resultCount": result_count, "totalLatencyMs": round(total_latency_ms, 2)},
            )

    def generate_citations(self, search_results: list[dict]) -> list[SourceCitation]:
        """
        生成引用来源列表

        用于在 Agent 响应中标注信息来源

        Args:
            search_results: 检索结果

        Returns:
            引用来源列表
        """
        citations = []
        for i, result in enumerate(search_results, 1):
            citation = SourceCitation(
                doc_id=result.get("id", f"doc_{i}"),
                source_type=result.get("source_type", "document"),
                title=result.get("title", f"Source {i}"),
                url=result.get("url"),
                snippet=result.get("content", "")[:200],
                relevance_score=result.get("score", 0.0),
            )
            citations.append(citation)
        return citations

    async def emit_citations(self, run_id: str, citations: list[SourceCitation]) -> None:
        """
        发射引用来源事件

        Args:
            run_id: 当前运行 ID
            citations: 引用来源列表
        """
        if self._event_emitter:
            await self._event_emitter.emit_custom(
                run_id=run_id,
                event_name=SearchEventType.SOURCE_CITATION.value,
                data={
                    "citations": [
                        {
                            "id": c.doc_id,
                            "type": c.source_type,
                            "title": c.title,
                            "url": c.url,
                            "snippet": c.snippet,
                            "score": round(c.relevance_score, 4),
                        }
                        for c in citations
                    ]
                },
            )
