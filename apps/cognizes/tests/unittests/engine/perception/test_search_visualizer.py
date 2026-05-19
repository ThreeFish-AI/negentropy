"""
SearchVisualizer 单元测试

测试检索过程可视化组件。

对应任务: P3-4-2
"""

import pytest

from cognizes.engine.perception.search_visualizer import (
    RerankComparison,
    RetrievalPathResult,
    RRFMergeResult,
    SearchEventType,
    SearchVisualizer,
    SourceCitation,
)

pytestmark = pytest.mark.asyncio


class TestSearchEventType:
    """事件类型枚举测试"""

    def test_event_type_values(self):
        """验证事件类型值"""
        assert SearchEventType.RETRIEVAL_DETAIL.value == "retrieval_detail"
        assert SearchEventType.RRF_RESULT.value == "rrf_result"
        assert SearchEventType.RERANK_RESULT.value == "rerank_result"
        assert SearchEventType.SOURCE_CITATION.value == "source_citation"

    def test_event_type_count(self):
        """验证事件类型数量"""
        assert len(SearchEventType) == 4


class TestDataClasses:
    """数据类测试"""

    def test_retrieval_path_result(self):
        """测试 RetrievalPathResult"""
        result = RetrievalPathResult(
            path_name="semantic", doc_count=10, latency_ms=15.5, top_docs=[{"id": "doc1", "score": 0.9}]
        )

        assert result.path_name == "semantic"
        assert result.doc_count == 10
        assert result.latency_ms == 15.5
        assert len(result.top_docs) == 1

    def test_rrf_merge_result(self):
        """测试 RRFMergeResult"""
        result = RRFMergeResult(
            input_paths=["semantic", "keyword"],
            output_count=50,
            rank_changes=[{"doc_id": "doc1", "before_rank": 5, "after_rank": 1}],
        )

        assert len(result.input_paths) == 2
        assert result.output_count == 50

    def test_rerank_comparison(self):
        """测试 RerankComparison"""
        comparison = RerankComparison(
            doc_id="doc1", content_preview="Test content...", l0_score=0.8, l1_score=0.95, rank_before=5, rank_after=1
        )

        assert comparison.l1_score > comparison.l0_score
        assert comparison.rank_after < comparison.rank_before

    def test_source_citation_defaults(self):
        """测试 SourceCitation 默认值"""
        citation = SourceCitation(doc_id="doc1", source_type="memory", title="Test Document")

        assert citation.url is None
        assert citation.snippet == ""
        assert citation.relevance_score == 0.0


class TestSearchVisualizer:
    """SearchVisualizer 测试"""

    def test_init_without_emitter(self):
        """无事件发射器初始化"""
        visualizer = SearchVisualizer()
        assert visualizer._event_emitter is None

    def test_init_with_emitter(self, mock_event_emitter):
        """带事件发射器初始化"""
        visualizer = SearchVisualizer(event_emitter=mock_event_emitter)
        assert visualizer._event_emitter is not None

    async def test_emit_search_started_no_emitter(self):
        """无发射器时不抛异常"""
        visualizer = SearchVisualizer()
        # 应该静默返回
        await visualizer.emit_search_started(run_id="run_001", query="test query", search_config={"top_k": 50})

    async def test_emit_search_started_with_emitter(self, mock_event_emitter):
        """有发射器时正确调用"""
        visualizer = SearchVisualizer(event_emitter=mock_event_emitter)

        await visualizer.emit_search_started(
            run_id="run_001", query="test query", search_config={"top_k": 50, "semantic_weight": 0.7}
        )

        mock_event_emitter.emit_step_started.assert_called_once()

    async def test_emit_search_finished(self, mock_event_emitter):
        """测试检索完成事件"""
        visualizer = SearchVisualizer(event_emitter=mock_event_emitter)

        await visualizer.emit_search_finished(run_id="run_001", result_count=25, total_latency_ms=45.5)

        mock_event_emitter.emit_step_finished.assert_called_once()

    def test_generate_citations(self):
        """测试生成引用"""
        visualizer = SearchVisualizer()
        results = [
            {"id": "doc1", "content": "Content 1", "score": 0.9, "title": "Doc 1"},
            {"id": "doc2", "content": "Content 2", "score": 0.8},
        ]

        citations = visualizer.generate_citations(results)

        assert len(citations) == 2
        assert citations[0].doc_id == "doc1"
        assert citations[0].title == "Doc 1"
        assert citations[1].title == "Source 2"  # 使用默认标题

    def test_generate_citations_empty(self):
        """空结果测试"""
        visualizer = SearchVisualizer()
        citations = visualizer.generate_citations([])
        assert len(citations) == 0

    async def test_emit_retrieval_paths(self, mock_event_emitter):
        """测试多路召回事件"""
        visualizer = SearchVisualizer(event_emitter=mock_event_emitter)

        path_results = [
            RetrievalPathResult(path_name="semantic", doc_count=30, latency_ms=10.0, top_docs=[{"id": "doc1"}]),
            RetrievalPathResult(path_name="keyword", doc_count=20, latency_ms=5.0, top_docs=[]),
        ]

        await visualizer.emit_retrieval_paths(run_id="run_001", path_results=path_results)

        mock_event_emitter.emit_custom.assert_called_once()
        call_args = mock_event_emitter.emit_custom.call_args
        assert call_args.kwargs["event_name"] == "retrieval_detail"

    async def test_emit_rrf_merge(self, mock_event_emitter):
        """测试 RRF 融合事件"""
        visualizer = SearchVisualizer(event_emitter=mock_event_emitter)

        merge_result = RRFMergeResult(
            input_paths=["semantic", "keyword"],
            output_count=40,
            rank_changes=[
                {"doc_id": "doc1", "before_rank": 10, "after_rank": 1},
                {"doc_id": "doc2", "before_rank": 2, "after_rank": 3},
            ],
        )

        await visualizer.emit_rrf_merge(run_id="run_001", merge_result=merge_result)

        mock_event_emitter.emit_custom.assert_called_once()
        call_args = mock_event_emitter.emit_custom.call_args
        assert call_args.kwargs["event_name"] == "rrf_result"

    async def test_emit_rerank_comparison(self, mock_event_emitter):
        """测试 Rerank 对比事件"""
        visualizer = SearchVisualizer(event_emitter=mock_event_emitter)

        comparisons = [
            RerankComparison(
                doc_id="doc1",
                content_preview="preview",
                l0_score=0.5,
                l1_score=0.9,
                rank_before=10,
                rank_after=1,
            )
        ]

        await visualizer.emit_rerank_comparison(run_id="run_001", comparisons=comparisons)

        mock_event_emitter.emit_custom.assert_called_once()
        call_args = mock_event_emitter.emit_custom.call_args
        assert call_args.kwargs["event_name"] == "rerank_result"
        assert len(call_args.kwargs["data"]["comparisons"]) == 1
        assert call_args.kwargs["data"]["avgScoreImprovement"] == 0.4

    async def test_emit_citations(self, mock_event_emitter):
        """测试引用来源事件"""
        visualizer = SearchVisualizer(event_emitter=mock_event_emitter)

        citations = [
            SourceCitation(
                doc_id="doc1",
                source_type="document",
                title="Doc 1",
                relevance_score=0.9,
            )
        ]

        await visualizer.emit_citations(run_id="run_001", citations=citations)

        mock_event_emitter.emit_custom.assert_called_once()
        call_args = mock_event_emitter.emit_custom.call_args
        assert call_args.kwargs["event_name"] == "source_citation"
        assert len(call_args.kwargs["data"]["citations"]) == 1
        assert call_args.kwargs["data"]["citations"][0]["id"] == "doc1"
