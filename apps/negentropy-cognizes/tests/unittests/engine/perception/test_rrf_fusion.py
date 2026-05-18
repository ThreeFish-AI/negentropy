"""
RRF Fusion 单元测试

测试 Reciprocal Rank Fusion 算法的正确性。

对应任务: P3-1-8
"""

import pytest

from cognizes.engine.perception.rrf_fusion import SearchResult, rrf_fusion


class TestSearchResult:
    """SearchResult 数据类测试"""

    def test_create_with_defaults(self):
        """测试默认值创建"""
        result = SearchResult(id="doc1", content="Test", score=0.9)

        assert result.id == "doc1"
        assert result.content == "Test"
        assert result.score == 0.9
        assert result.metadata is None
        assert result.rank == 0

    def test_create_with_all_fields(self):
        """测试完整字段创建"""
        metadata = {"source": "test"}
        result = SearchResult(id="doc1", content="Test content", score=0.95, metadata=metadata, rank=5)

        assert result.metadata == {"source": "test"}
        assert result.rank == 5


class TestRRFFusion:
    """RRF 融合算法测试"""

    def test_single_list_fusion(self):
        """单列表融合"""
        results = [
            SearchResult(id="doc1", content="A", score=0.9),
            SearchResult(id="doc2", content="B", score=0.8),
        ]

        fused = rrf_fusion([results], k=60, limit=10)

        assert len(fused) == 2
        # 第一个结果分数应为 1/(60+1)
        assert abs(fused[0].score - 1 / 61) < 0.0001
        assert fused[0].id == "doc1"

    def test_two_list_fusion(self):
        """两路融合测试"""
        semantic = [
            SearchResult(id="doc1", content="A", score=0.95),
            SearchResult(id="doc2", content="B", score=0.90),
            SearchResult(id="doc3", content="C", score=0.85),
        ]
        keyword = [
            SearchResult(id="doc2", content="B", score=0.88),
            SearchResult(id="doc3", content="C", score=0.85),
            SearchResult(id="doc1", content="A", score=0.80),
        ]

        fused = rrf_fusion([semantic, keyword], k=60, limit=10)

        # doc2 在两个列表中都排名靠前，应排第一
        # doc2: 1/(60+2) + 1/(60+1) = 0.0161 + 0.0164 = 0.0325
        # doc1: 1/(60+1) + 1/(60+3) = 0.0164 + 0.0159 = 0.0323

        # 验证 doc2 排名靠前
        assert fused[0].id == "doc2" or fused[1].id == "doc2"
        assert len(fused) == 3

    def test_limit_parameter(self):
        """测试限制返回数量"""
        results = [SearchResult(id=f"doc{i}", content=f"Content {i}", score=0.9 - i * 0.1) for i in range(10)]

        fused = rrf_fusion([results], k=60, limit=3)

        assert len(fused) == 3
        # 验证按分数排序
        assert fused[0].score >= fused[1].score >= fused[2].score

    def test_empty_list(self):
        """空列表测试"""
        fused = rrf_fusion([[]], k=60, limit=10)
        assert len(fused) == 0

    def test_k_parameter_effect(self):
        """测试 k 参数影响"""
        results = [
            SearchResult(id="doc1", content="A", score=0.9),
        ]

        # k=60 时，第一名分数 = 1/(60+1) ≈ 0.0164
        fused_k60 = rrf_fusion([results], k=60, limit=10)

        # k=10 时，第一名分数 = 1/(10+1) ≈ 0.0909
        fused_k10 = rrf_fusion([results], k=10, limit=10)

        assert fused_k10[0].score > fused_k60[0].score

    def test_disjoint_lists(self):
        """不交集列表测试"""
        list1 = [SearchResult(id="doc1", content="A", score=0.9)]
        list2 = [SearchResult(id="doc2", content="B", score=0.8)]

        fused = rrf_fusion([list1, list2], k=60, limit=10)

        assert len(fused) == 2
        # 两者分数相同 (都只出现一次)
        assert abs(fused[0].score - fused[1].score) < 0.0001

    def test_rrf_formula_correctness(self):
        """验证 RRF 公式正确性"""
        semantic = [
            SearchResult(id="docA", content="A", score=0.9),
        ]
        keyword = [
            SearchResult(id="docA", content="A", score=0.8),
        ]

        fused = rrf_fusion([semantic, keyword], k=60, limit=10)

        # docA 在两个列表中都是第 1 名
        # RRF = 1/(60+1) + 1/(60+1) = 2/(61) ≈ 0.0328
        expected_score = 2 / 61
        assert abs(fused[0].score - expected_score) < 0.0001
