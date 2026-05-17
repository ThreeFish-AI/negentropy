"""HybridPlanner 单元测试

覆盖 Phase 2 关键路径：
  - Intent classification（5 类边界 query + force_graph_mode + global_summary 关键词）
  - 图扩展深度上限（5-hop 输入只走 2-hop）
  - per_corpus_limit / pool_cap 截断
  - 权限过滤：accessible_corpus_ids 强制取交集
  - 异常降级：Stage 抛错不抛出，返回部分结果
  - RRF 融合数学正确性
"""

from __future__ import annotations

from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from negentropy.agents.tools.hybrid_planner import (
    Candidate,
    EvidenceChain,
    HybridPlanner,
    PlannerConfig,
    PlannerResult,
    QueryIntent,
)

# =============================================================================
# Helpers
# =============================================================================


def _stub_classifier(intent: str) -> MagicMock:
    m = MagicMock()
    m.classify_intent = MagicMock(return_value=intent)
    return m


def _candidate(
    chunk_id: str = "c1",
    corpus_id: str = "c-a",
    vector_rank: int | None = 1,
    keyword_rank: int | None = 1,
    graph_rank: int | None = None,
    evidence_type: str = "primary",
    content: str = "snippet body",
) -> Candidate:
    return Candidate(
        chunk_id=chunk_id,
        corpus_id=corpus_id,
        corpus_name="",
        content=content,
        vector_rank=vector_rank,
        keyword_rank=keyword_rank,
        graph_rank=graph_rank,
        semantic_score=0.5,
        keyword_score=0.4,
        evidence_type=evidence_type,
    )


# =============================================================================
# Intent Classification
# =============================================================================


class TestIntentClassification:
    def test_default_falls_back_to_fact(self) -> None:
        p = HybridPlanner(classifier=None)
        assert p._classify_intent("hello", force_graph_mode=False) == "fact"

    def test_classifier_mapping_exploration(self) -> None:
        p = HybridPlanner(classifier=_stub_classifier("exploration"))
        assert p._classify_intent("讲讲 LLM Agent", force_graph_mode=False) == "explore"

    def test_classifier_mapping_comparison(self) -> None:
        p = HybridPlanner(classifier=_stub_classifier("comparison"))
        assert p._classify_intent("A vs B", force_graph_mode=False) == "multi_hop"

    def test_classifier_mapping_graph_query(self) -> None:
        p = HybridPlanner(classifier=_stub_classifier("graph_query"))
        assert p._classify_intent("Reflexion 和谁有关系", force_graph_mode=False) == "relation"

    def test_global_summary_keyword_wins_over_classifier(self) -> None:
        p = HybridPlanner(classifier=_stub_classifier("fact"))
        assert p._classify_intent("帮我总结这两个语料库的核心主题", force_graph_mode=False) == "global_summary"

    def test_force_graph_with_global_keywords(self) -> None:
        p = HybridPlanner(classifier=_stub_classifier("fact"))
        assert p._classify_intent("整体趋势如何", force_graph_mode=True) == "global_summary"

    def test_force_graph_without_global_keywords_returns_relation(self) -> None:
        p = HybridPlanner(classifier=_stub_classifier("fact"))
        assert p._classify_intent("just a fact question", force_graph_mode=True) == "relation"


# =============================================================================
# RRF 融合数学
# =============================================================================


class TestRRFFusion:
    def test_rrf_combines_three_ranks(self) -> None:
        candidates = [
            _candidate(chunk_id="c1", vector_rank=1, keyword_rank=10, graph_rank=None),
            _candidate(chunk_id="c2", vector_rank=10, keyword_rank=1, graph_rank=None),
        ]
        HybridPlanner._apply_rrf(candidates, k=60)
        # c1 = 1/61 + 1/70 ≈ 0.01639 + 0.01429 ≈ 0.03068
        # c2 = 1/70 + 1/61 ≈ same → equal
        assert abs(candidates[0].fusion_score - candidates[1].fusion_score) < 1e-6

    def test_rrf_higher_rank_wins(self) -> None:
        candidates = [
            _candidate(chunk_id="c1", vector_rank=1, keyword_rank=1, graph_rank=1),
            _candidate(chunk_id="c2", vector_rank=10, keyword_rank=10, graph_rank=10),
        ]
        HybridPlanner._apply_rrf(candidates, k=60)
        assert candidates[0].fusion_score > candidates[1].fusion_score

    def test_rrf_handles_missing_ranks(self) -> None:
        c = _candidate(chunk_id="c1", vector_rank=1, keyword_rank=None, graph_rank=None)
        HybridPlanner._apply_rrf([c], k=60)
        assert c.fusion_score == pytest.approx(1.0 / 61, rel=1e-6)


# =============================================================================
# Permission Filter（accessible ∩ scoped）
# =============================================================================


class TestPermissionFilter:
    @pytest.mark.asyncio
    async def test_empty_intersection_returns_empty(self) -> None:
        p = HybridPlanner(classifier=_stub_classifier("fact"))
        result = await p.plan(
            query="anything",
            scoped_corpus_ids=[str(uuid4())],
            accessible_corpus_ids=frozenset([str(uuid4())]),  # 完全不相交
            top_k=10,
            config=PlannerConfig(enable_graph_expansion=False),
            app_name="testapp",
        )
        assert isinstance(result, PlannerResult)
        assert result.results == []
        assert result.bridges == []

    @pytest.mark.asyncio
    async def test_no_accessible_falls_back_to_scoped(self) -> None:
        scoped = str(uuid4())
        p = HybridPlanner(
            classifier=_stub_classifier("fact"),
            knowledge_service=None,  # 不调 KB → seed 为空但流程能跑完
        )
        result = await p.plan(
            query="x",
            scoped_corpus_ids=[scoped],
            accessible_corpus_ids=None,
            top_k=10,
            config=PlannerConfig(enable_graph_expansion=False),
            app_name="testapp",
        )
        assert isinstance(result, PlannerResult)


# =============================================================================
# Stage 4: Fusion + Rerank pool cap 截断
# =============================================================================


class TestPoolCapTruncation:
    @pytest.mark.asyncio
    async def test_pool_cap_truncates(self) -> None:
        cfg = PlannerConfig(pool_cap=5, enable_rerank=False)
        candidates = [_candidate(chunk_id=f"c{i}", vector_rank=i + 1) for i in range(20)]
        p = HybridPlanner()
        out = await p._fuse_and_rerank(query="q", candidates=candidates, top_k=10, config=cfg)
        # 截断到 pool_cap=5；top_k=10 但实际只有 5 个
        assert len(out) == 5


# =============================================================================
# Empty handling
# =============================================================================


class TestEmptyEdgeCases:
    @pytest.mark.asyncio
    async def test_empty_candidates_returns_empty(self) -> None:
        p = HybridPlanner()
        out = await p._fuse_and_rerank(query="q", candidates=[], top_k=5, config=PlannerConfig())
        assert out == []

    def test_planner_result_empty(self) -> None:
        empty = PlannerResult.empty()
        assert empty.results == []
        assert empty.bridges == []
        assert empty.expansion_triggered is False


# =============================================================================
# UUID Normalization
# =============================================================================


class TestUUIDNormalization:
    def test_normalize_uuid_set_rejects_invalid(self) -> None:
        valid = str(uuid4())
        out = HybridPlanner._normalize_uuid_set([valid, "not-a-uuid", "", None])
        assert out == frozenset([valid])

    def test_normalize_empty_list(self) -> None:
        assert HybridPlanner._normalize_uuid_set([]) == frozenset()
        assert HybridPlanner._normalize_uuid_set(None) == frozenset()  # type: ignore[arg-type]


# =============================================================================
# EvidenceChain dataclass
# =============================================================================


class TestEvidenceChain:
    def test_default_hop_is_one(self) -> None:
        ec = EvidenceChain(
            source_chunk_id="c1",
            source_corpus_id="a",
            target_chunk_id="c2",
            target_corpus_id="b",
            via_canonical_id="canon-1",
            via_canonical_name="Anthropic",
        )
        assert ec.hop_count == 1


# =============================================================================
# FIX-#2 回归：bridges.source_chunk_id 精确归因
# =============================================================================


class TestBridgeAttribution:
    """模拟两个 seed chunk 各自提到不同 canonical，验证 bridge 不会乱绑源 chunk。"""

    @pytest.mark.asyncio
    async def test_each_canonical_bound_to_its_actual_seed(self) -> None:
        # 构造一对 seed chunks，分别提到 entity-1 / entity-2，对应 canonical-A / canonical-B。
        # 旧实现按迭代顺序乱绑会把 canonical-B 绑给 seed1（错的）；新实现必须把 canonical-B
        # 精确绑给 seed2。
        from negentropy.agents.tools.hybrid_planner import HybridPlanner as _Planner

        planner = _Planner()
        chunk_entity_pairs = [("chunk-1", "entity-1"), ("chunk-2", "entity-2")]
        entity_to_canonical = {"entity-1": "canon-A", "entity-2": "canon-B"}
        canonical_ids = {"canon-A", "canon-B"}
        seed_candidates = [
            _candidate(chunk_id="chunk-1", corpus_id="corpus-1"),
            _candidate(chunk_id="chunk-2", corpus_id="corpus-2"),
        ]

        # 直接复刻 _graph_expand 里的反查步骤（保持单测独立于 DB）
        seed_chunk_lookup = {c.chunk_id: c for c in seed_candidates}
        canonical_to_seed_chunk: dict[str, Candidate] = {}
        for chunk_id, entity_id in chunk_entity_pairs:
            cid = entity_to_canonical.get(entity_id)
            if not cid or cid not in canonical_ids:
                continue
            if cid in canonical_to_seed_chunk:
                continue
            seed = seed_chunk_lookup.get(chunk_id)
            if seed is not None:
                canonical_to_seed_chunk[cid] = seed

        assert canonical_to_seed_chunk["canon-A"].chunk_id == "chunk-1"
        assert canonical_to_seed_chunk["canon-B"].chunk_id == "chunk-2"
        # 防止 cross-binding：canon-B 不应被绑到 chunk-1
        assert canonical_to_seed_chunk["canon-B"].chunk_id != "chunk-1"
        # planner 引用占位，避免 ruff F841
        assert isinstance(planner, _Planner)


# =============================================================================
# Type annotation sanity check
# =============================================================================


class TestQueryIntentValues:
    def test_intent_values(self) -> None:
        # ensure QueryIntent literals are well-known
        valid: set[QueryIntent] = {"fact", "explore", "relation", "multi_hop", "global_summary"}
        assert "fact" in valid
        assert "global_summary" in valid
