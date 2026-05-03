"""Memory Service — query intent 类型加权重排单元测试

不连真实 DB，仅测试 ``PostgresMemoryService._apply_intent_rerank`` 算法。
"""

from __future__ import annotations

from negentropy.engine.adapters.postgres.memory_service import PostgresMemoryService


class TestApplyIntentRerank:
    def test_no_query_returns_unchanged(self) -> None:
        results = [
            {"id": "1", "memory_type": "episodic", "relevance_score": 0.5, "metadata": {}},
            {"id": "2", "memory_type": "semantic", "relevance_score": 0.4, "metadata": {}},
        ]
        out = PostgresMemoryService._apply_intent_rerank(list(results), "")
        assert out[0]["id"] == "1"
        assert out[1]["id"] == "2"

    def test_procedural_query_boosts_procedural_memories(self) -> None:
        results = [
            {"id": "1", "memory_type": "episodic", "relevance_score": 0.6, "metadata": {}},
            {"id": "2", "memory_type": "procedural", "relevance_score": 0.55, "metadata": {}},
        ]
        out = PostgresMemoryService._apply_intent_rerank(results, "how to deploy this service")
        # procedural 命中 primary（boost=0.15）：0.55 × 1.15 = 0.6325 > 0.6
        assert out[0]["id"] == "2"
        proc_meta = next(r["metadata"] for r in out if r["id"] == "2")
        assert proc_meta.get("intent_primary") == "procedural"
        assert proc_meta.get("intent_boost_applied") == 0.15

    def test_semantic_query_boosts_semantic(self) -> None:
        results = [
            {"id": "1", "memory_type": "episodic", "relevance_score": 0.7, "metadata": {}},
            {"id": "2", "memory_type": "semantic", "relevance_score": 0.65, "metadata": {}},
        ]
        out = PostgresMemoryService._apply_intent_rerank(results, "what is consensus algorithm")
        sem = next(r for r in out if r["id"] == "2")
        # 0.65 * 1.10 = 0.715 > 0.7, semantic 应排第一
        assert out[0]["id"] == "2"
        assert sem["metadata"]["intent_primary"] == "semantic"

    def test_low_confidence_no_rerank(self) -> None:
        results = [
            {"id": "1", "memory_type": "episodic", "relevance_score": 0.5, "metadata": {}},
        ]
        # query 不含任何关键词 → 默认置信度 0.3，刚好 >= threshold，但走默认路径
        out = PostgresMemoryService._apply_intent_rerank(results, "random text")
        # 至少不抛异常，且分数 clamp 在 [0,1]
        assert 0.0 <= out[0]["relevance_score"] <= 1.0

    def test_empty_results_returns_empty(self) -> None:
        out = PostgresMemoryService._apply_intent_rerank([], "how to do X")
        assert out == []

    def test_score_clamped_to_one(self) -> None:
        results = [
            {"id": "1", "memory_type": "procedural", "relevance_score": 0.99, "metadata": {}},
        ]
        out = PostgresMemoryService._apply_intent_rerank(results, "how to deploy")
        assert 0.0 <= out[0]["relevance_score"] <= 1.0
