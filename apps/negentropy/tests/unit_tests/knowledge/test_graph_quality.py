"""Graph Quality Validation 单元测试

测试 validate_graph_quality 的质量评分逻辑。
数据库交互通过 mock session 模拟。

参考文献:
[1] H. Paulheim, "Knowledge Graph Refinement: A Survey of Approaches
    and Evaluation Methods," Semantic Web, vol. 8, no. 3, 2017.
"""

from __future__ import annotations

from uuid import UUID

import pytest

from negentropy.knowledge.graph.quality import (
    GraphQualityReport,
    _compute_quality_score,
)

_CORPUS_ID = UUID("00000000-0000-0000-0000-000000000001")


class TestComputeQualityScore:
    """综合质量评分计算测试"""

    def test_empty_graph(self):
        """空图谱应返回 0.0"""
        report = GraphQualityReport(
            total_entities=0,
            total_relations=0,
            dangling_edges=0,
            orphan_entities=0,
            community_coverage=0.0,
            entity_confidence_avg=0.0,
            relation_evidence_ratio=0.0,
            type_distribution={},
            quality_score=0.0,
        )
        assert _compute_quality_score(report) == 0.0

    def test_perfect_graph(self):
        """完美图谱（无悬空/孤立、满覆盖、高置信度、满证据）"""
        report = GraphQualityReport(
            total_entities=100,
            total_relations=200,
            dangling_edges=0,
            orphan_entities=0,
            community_coverage=1.0,
            entity_confidence_avg=1.0,
            relation_evidence_ratio=1.0,
            type_distribution={"concept": 100},
            quality_score=0.0,
        )
        score = _compute_quality_score(report)
        assert score == pytest.approx(1.0, abs=0.01)

    def test_poor_graph(self):
        """差图谱（有悬空边、孤立节点、无社区、低置信度、无证据）"""
        report = GraphQualityReport(
            total_entities=10,
            total_relations=5,
            dangling_edges=5,
            orphan_entities=10,
            community_coverage=0.0,
            entity_confidence_avg=0.1,
            relation_evidence_ratio=0.0,
            type_distribution={},
            quality_score=0.0,
        )
        score = _compute_quality_score(report)
        # integrity = 1 - (5/5 + 10/10) / 2 = 1 - 1.0 = 0.0
        # total = 0.4 * 0 + 0.2 * 0 + 0.2 * 0.1 + 0.2 * 0 = 0.02
        assert 0.0 <= score <= 0.1

    def test_partial_quality(self):
        """部分质量图谱"""
        report = GraphQualityReport(
            total_entities=50,
            total_relations=40,
            dangling_edges=2,
            orphan_entities=5,
            community_coverage=0.6,
            entity_confidence_avg=0.75,
            relation_evidence_ratio=0.5,
            type_distribution={"person": 30, "org": 20},
            quality_score=0.0,
        )
        score = _compute_quality_score(report)
        assert 0.0 < score < 1.0
        # integrity = 1 - (2/40 + 5/50) / 2 ≈ 0.935
        # total ≈ 0.4*0.935 + 0.2*0.6 + 0.2*0.75 + 0.2*0.5 ≈ 0.724
        assert score > 0.5

    def test_score_bounded(self):
        """评分应在 [0, 1] 范围内"""
        report = GraphQualityReport(
            total_entities=100,
            total_relations=50,
            dangling_edges=0,
            orphan_entities=0,
            community_coverage=1.0,
            entity_confidence_avg=1.5,  # 超范围
            relation_evidence_ratio=1.0,
            type_distribution={},
            quality_score=0.0,
        )
        score = _compute_quality_score(report)
        assert 0.0 <= score <= 1.0


class TestGraphQualityReport:
    """GraphQualityReport 数据类测试"""

    def test_frozen(self):
        """报告应为不可变"""
        report = GraphQualityReport(
            total_entities=10,
            total_relations=5,
            dangling_edges=0,
            orphan_entities=0,
            community_coverage=0.5,
            entity_confidence_avg=0.8,
            relation_evidence_ratio=0.6,
            type_distribution={},
            quality_score=0.7,
        )
        with pytest.raises(AttributeError):
            report.total_entities = 20  # type: ignore[misc]

    def test_quality_score_is_final(self):
        """quality_score 应在创建时确定"""
        report = GraphQualityReport(
            total_entities=10,
            total_relations=5,
            dangling_edges=0,
            orphan_entities=0,
            community_coverage=1.0,
            entity_confidence_avg=1.0,
            relation_evidence_ratio=1.0,
            type_distribution={},
            quality_score=0.95,
        )
        assert report.quality_score == 0.95
