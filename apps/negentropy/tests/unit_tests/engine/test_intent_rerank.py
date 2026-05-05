"""
PostgresMemoryService._apply_intent_rerank 补充单元测试

与 test_memory_intent_rerank.py 互补，覆盖该文件中未涉及的场景：
- episodic query 加权
- 中文 query 意图识别
- boost_types 次选类型加权
- 分数边界 (base=0 时)
- metadata 写入完整性
- 多种 memory_type 混合结果的重排

不连真实 DB。
"""

from __future__ import annotations

from negentropy.engine.adapters.postgres.memory_service import PostgresMemoryService


class TestApplyIntentRerankEpisodic:
    """episodic 意图场景。"""

    def test_episodic_query_boosts_episodic_memories(self) -> None:
        """包含时间词的 query 应提升 episodic 类型记忆的分数。"""
        results = [
            {"id": "1", "memory_type": "semantic", "relevance_score": 0.70, "metadata": {}},
            {"id": "2", "memory_type": "episodic", "relevance_score": 0.65, "metadata": {}},
        ]
        out = PostgresMemoryService._apply_intent_rerank(results, "what happened last week")
        # episodic 命中 primary（boost=0.15）：0.65 × 1.15 = 0.7475 > 0.70
        assert out[0]["id"] == "2"
        assert out[0]["metadata"]["intent_primary"] == "episodic"

    def test_chinese_episodic_keywords(self) -> None:
        """中文时间关键词（昨天/上次/曾经）也应触发 episodic 意图。"""
        results = [
            {"id": "1", "memory_type": "episodic", "relevance_score": 0.5, "metadata": {}},
            {"id": "2", "memory_type": "semantic", "relevance_score": 0.6, "metadata": {}},
        ]
        out = PostgresMemoryService._apply_intent_rerank(results, "昨天发生了什么")
        # episodic boost: 0.5 * 1.15 = 0.575 < 0.6, 但 0.575 + semantic 无 boost = 0.6
        # episodic 排第二，但 metadata 仍应标记
        epi = next(r for r in out if r["id"] == "1")
        assert epi["metadata"]["intent_primary"] == "episodic"
        assert epi["metadata"]["intent_boost_applied"] == 0.15


class TestApplyIntentRerankBoostTypes:
    """boost_types（次选类型 +3%）场景。"""

    def test_procedural_query_boosts_fact_as_secondary(self) -> None:
        """procedural query 的 boost_types 包含 fact，fact 应获得 +3% 加权。"""
        results = [
            {"id": "1", "memory_type": "fact", "relevance_score": 0.50, "metadata": {}},
            {"id": "2", "memory_type": "episodic", "relevance_score": 0.50, "metadata": {}},
        ]
        out = PostgresMemoryService._apply_intent_rerank(results, "how to deploy")
        fact = next(r for r in out if r["id"] == "1")
        epi = next(r for r in out if r["id"] == "2")
        # fact 属于 boost_types → boost=0.03: 0.50 * 1.03 = 0.515
        # episodic 不在 boost_types → boost=0.0: 0.50
        assert fact["relevance_score"] > epi["relevance_score"]
        assert fact["metadata"]["intent_boost_applied"] == 0.03

    def test_semantic_query_boosts_fact_as_secondary(self) -> None:
        """semantic query 的 boost_types 包含 fact，fact 应获得 +3% 加权。"""
        results = [
            {"id": "1", "memory_type": "fact", "relevance_score": 0.60, "metadata": {}},
            {"id": "2", "memory_type": "episodic", "relevance_score": 0.65, "metadata": {}},
        ]
        out = PostgresMemoryService._apply_intent_rerank(results, "what is the definition of consensus")
        fact = next(r for r in out if r["id"] == "1")
        assert fact["metadata"]["intent_boost_applied"] == 0.03


class TestApplyIntentRerankZeroScore:
    """base score 为 0 的边界场景。"""

    def test_zero_score_stays_zero_after_boost(self) -> None:
        """relevance_score 为 0 时，boost 后应仍为 0。"""
        results = [
            {"id": "1", "memory_type": "procedural", "relevance_score": 0.0, "metadata": {}},
        ]
        out = PostgresMemoryService._apply_intent_rerank(results, "how to deploy")
        assert out[0]["relevance_score"] == 0.0

    def test_zero_base_with_metadata_still_written(self) -> None:
        """即使分数为 0，metadata 中仍应写入 intent 信息。"""
        results = [
            {"id": "1", "memory_type": "procedural", "relevance_score": 0.0, "metadata": {}},
        ]
        out = PostgresMemoryService._apply_intent_rerank(results, "how to deploy")
        assert "intent_primary" in out[0]["metadata"]
        assert "intent_boost_applied" in out[0]["metadata"]


class TestApplyIntentRerankMixedTypes:
    """多种 memory_type 混合场景。"""

    def test_results_resorted_by_boosted_scores(self) -> None:
        """加权后结果应按新分数降序排列。"""
        results = [
            {"id": "epi", "memory_type": "episodic", "relevance_score": 0.80, "metadata": {}},
            {"id": "pro", "memory_type": "procedural", "relevance_score": 0.75, "metadata": {}},
            {"id": "sem", "memory_type": "semantic", "relevance_score": 0.70, "metadata": {}},
            {"id": "fac", "memory_type": "fact", "relevance_score": 0.65, "metadata": {}},
        ]
        out = PostgresMemoryService._apply_intent_rerank(results, "how to configure HPA step by step")
        ids = [r["id"] for r in out]
        # procedural 命中 primary (+15%): 0.75 * 1.15 = 0.8625 → 排第一
        assert ids[0] == "pro"

    def test_all_metadata_contain_intent_info(self) -> None:
        """所有结果的 metadata 都应包含 intent_primary 和 intent_boost_applied。"""
        results = [
            {"id": str(i), "memory_type": mt, "relevance_score": 0.5, "metadata": {}}
            for i, mt in enumerate(["episodic", "procedural", "semantic", "fact"])
        ]
        out = PostgresMemoryService._apply_intent_rerank(results, "how to deploy")
        for r in out:
            assert "intent_primary" in r["metadata"]
            assert "intent_boost_applied" in r["metadata"]

    def test_unmatched_type_gets_zero_boost(self) -> None:
        """不在 primary 也不在 boost_types 中的类型应获得 0 boost。"""
        results = [
            {"id": "1", "memory_type": "episodic", "relevance_score": 0.6, "metadata": {}},
        ]
        out = PostgresMemoryService._apply_intent_rerank(results, "how to deploy")
        # procedural 是 primary，episodic 不在 boost_types（procedural 的 boost_types = semantic, fact）
        assert out[0]["metadata"]["intent_boost_applied"] == 0.0


class TestApplyIntentRerankChinese:
    """中文 query 意图识别场景。"""

    def test_chinese_procedural_keywords(self) -> None:
        """中文步骤关键词（步骤/流程/怎么做）应触发 procedural 意图。"""
        results = [
            {"id": "1", "memory_type": "procedural", "relevance_score": 0.5, "metadata": {}},
            {"id": "2", "memory_type": "episodic", "relevance_score": 0.6, "metadata": {}},
        ]
        out = PostgresMemoryService._apply_intent_rerank(results, "怎么做服务部署")
        # procedural boost: 0.5 * 1.15 = 0.575, episodic 0.6
        # 但如果 episodic boost=0.0，则 episodic 仍为 0.6 > 0.575
        # 检查 procedural 确实被标记为 primary
        proc = next(r for r in out if r["id"] == "1")
        assert proc["metadata"]["intent_primary"] == "procedural"
        assert proc["metadata"]["intent_boost_applied"] == 0.15

    def test_chinese_semantic_keywords(self) -> None:
        """中文定义关键词（什么是/定义/含义）应触发 semantic 意图。"""
        results = [
            {"id": "1", "memory_type": "semantic", "relevance_score": 0.5, "metadata": {}},
        ]
        out = PostgresMemoryService._apply_intent_rerank(results, "什么是 Kubernetes")
        assert out[0]["metadata"]["intent_primary"] == "semantic"
        assert out[0]["metadata"]["intent_boost_applied"] == 0.15
