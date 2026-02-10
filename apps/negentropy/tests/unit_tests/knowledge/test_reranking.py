"""
Reranking 模块单元测试

测试 L1 Reranking 层的各种实现：
- NoopReranker: 无操作重排序器
- CompositeReranker: 组合重排序器回退机制
- RerankConfig: 配置验证

遵循 AGENTS.md 的测试原则：
- 独立性: 每个测试独立运行
- 可重复性: 测试结果稳定可重复
- 快速反馈: 单元测试应快速执行
"""

from __future__ import annotations

import pytest
from uuid import UUID, uuid4

from negentropy.knowledge.reranking import (
    CompositeReranker,
    NoopReranker,
    Reranker,
    RerankConfig,
)
from negentropy.knowledge.types import KnowledgeMatch


# ================================
# Test Data Fixtures
# ================================


@pytest.fixture
def sample_matches() -> list[KnowledgeMatch]:
    """生成示例匹配结果

    Returns:
        包含 5 个示例 KnowledgeMatch 对象的列表
    """
    return [
        KnowledgeMatch(
            id=uuid4(),
            content=f"content_{i}",
            source_uri=f"source_{i}",
            metadata={"index": i},
            semantic_score=0.5 + i * 0.1,
            keyword_score=0.3 + i * 0.05,
            combined_score=0.4 + i * 0.08,
        )
        for i in range(1, 6)
    ]


# ================================
# NoopReranker Tests
# ================================


class TestNoopReranker:
    """测试 NoopReranker 无操作重排序器"""

    @pytest.mark.asyncio
    async def test_noop_reranker_returns_all(self, sample_matches):
        """测试 NoopReranker 返回所有结果（当 top_k 足够大时）"""
        reranker = NoopReranker()
        config = RerankConfig(top_k=10)
        result = await reranker.rerank("test query", sample_matches, config)
        assert len(result) == len(sample_matches)

    @pytest.mark.asyncio
    async def test_noop_reranker_limits_results(self, sample_matches):
        """测试 NoopReranker 限制返回数量"""
        reranker = NoopReranker()
        config = RerankConfig(top_k=3)
        result = await reranker.rerank("test query", sample_matches, config)
        assert len(result) == 3

    @pytest.mark.asyncio
    async def test_noop_reranker_preserves_order(self, sample_matches):
        """测试 NoopReranker 保持原始顺序"""
        reranker = NoopReranker()
        config = RerankConfig(top_k=10)
        result = await reranker.rerank("test query", sample_matches, config)
        original_ids = [m.id for m in sample_matches]
        result_ids = [m.id for m in result]
        assert original_ids == result_ids

    @pytest.mark.asyncio
    async def test_noop_reranker_empty_candidates(self):
        """测试 NoopReranker 处理空候选列表"""
        reranker = NoopReranker()
        config = RerankConfig(top_k=10)
        result = await reranker.rerank("test query", [], config)
        assert result == []

    @pytest.mark.asyncio
    async def test_noop_reranker_score_threshold_no_filter(self, sample_matches):
        """测试 NoopReranker 不应用分数过滤（阈值设为 0）"""
        reranker = NoopReranker()
        config = RerankConfig(top_k=10, score_threshold=0.0)
        result = await reranker.rerank("test query", sample_matches, config)
        assert len(result) == len(sample_matches)

    @pytest.mark.asyncio
    async def test_noop_reranker_top_k_zero(self, sample_matches):
        """测试 NoopReranker 处理 top_k=0 的情况"""
        reranker = NoopReranker()
        config = RerankConfig(top_k=0)
        result = await reranker.rerank("test query", sample_matches, config)
        assert result == []


# ================================
# CompositeReranker Tests
# ================================


class TestCompositeReranker:
    """测试 CompositeReranker 组合重排序器"""

    @pytest.mark.asyncio
    async def test_composite_uses_primary(self, sample_matches):
        """测试 CompositeReranker 优先使用 primary 重排序器"""
        primary = NoopReranker()
        fallback = NoopReranker()
        reranker = CompositeReranker(primary=primary, fallback=fallback)
        config = RerankConfig(top_k=3)
        result = await reranker.rerank("test query", sample_matches, config)
        assert len(result) == 3

    @pytest.mark.asyncio
    async def test_composite_fallback_to_fallback(self, sample_matches):
        """测试 CompositeReranker 回退到 fallback 重排序器"""
        fallback = NoopReranker()
        reranker = CompositeReranker(primary=None, fallback=fallback)
        config = RerankConfig(top_k=3)
        result = await reranker.rerank("test query", sample_matches, config)
        assert len(result) == 3

    @pytest.mark.asyncio
    async def test_composite_all_none_uses_final_fallback(self, sample_matches):
        """测试 CompositeReranker 所有重排序器为 None 时使用最终回退"""
        reranker = CompositeReranker(primary=None, fallback=None, final_fallback=NoopReranker())
        config = RerankConfig(top_k=3)
        result = await reranker.rerank("test query", sample_matches, config)
        assert len(result) == 3

    @pytest.mark.asyncio
    async def test_composite_empty_candidates(self):
        """测试 CompositeReranker 处理空候选列表"""
        reranker = CompositeReranker(primary=NoopReranker())
        config = RerankConfig(top_k=10)
        result = await reranker.rerank("test query", [], config)
        assert result == []


# ================================
# FailingReranker (测试辅助类)
# ================================


class FailingReranker(Reranker):
    """总是失败的重排序器，用于测试回退机制"""

    async def rerank(
        self,
        query: str,
        candidates: list[KnowledgeMatch],
        config: RerankConfig | None = None,
    ) -> list[KnowledgeMatch]:
        raise RuntimeError("Intentional test failure")


class TestCompositeRerankerFallback:
    """测试 CompositeReranker 回退机制"""

    @pytest.mark.asyncio
    async def test_composite_fallback_on_primary_failure(self, sample_matches):
        """测试 primary 失败时回退到 fallback"""
        primary = FailingReranker()
        fallback = NoopReranker()
        reranker = CompositeReranker(primary=primary, fallback=fallback)
        config = RerankConfig(top_k=3)
        result = await reranker.rerank("test query", sample_matches, config)
        assert len(result) == 3

    @pytest.mark.asyncio
    async def test_composite_fallback_on_all_failures(self, sample_matches):
        """测试所有重排序器失败时使用最终回退"""
        primary = FailingReranker()
        fallback = FailingReranker()
        final_fallback = NoopReranker()
        reranker = CompositeReranker(primary=primary, fallback=fallback, final_fallback=final_fallback)
        config = RerankConfig(top_k=3)
        result = await reranker.rerank("test query", sample_matches, config)
        assert len(result) == 3


# ================================
# RerankConfig Tests
# ================================


class TestRerankConfig:
    """测试 RerankConfig 配置"""

    def test_rerank_config_defaults(self):
        """测试 RerankConfig 默认值"""
        config = RerankConfig()
        assert config.top_k == 10
        assert config.score_threshold == 0.0
        assert config.normalize_scores is True

    def test_rerank_config_custom_values(self):
        """测试 RerankConfig 自定义值"""
        config = RerankConfig(top_k=5, score_threshold=0.5, normalize_scores=False)
        assert config.top_k == 5
        assert config.score_threshold == 0.5
        assert config.normalize_scores is False

    def test_rerank_config_top_k_zero(self):
        """测试 RerankConfig top_k=0"""
        config = RerankConfig(top_k=0)
        assert config.top_k == 0

    def test_rerank_config_score_threshold_bounds(self):
        """测试 RerankConfig 分数阈值边界"""
        config = RerankConfig(score_threshold=1.0)
        assert config.score_threshold == 1.0


# ================================
# Integration Tests
# ================================


class TestRerankingIntegration:
    """重排序集成测试"""

    @pytest.mark.asyncio
    async def test_reranking_pipeline(self, sample_matches):
        """测试完整的重排序流程"""
        # 1. 原始结果
        assert len(sample_matches) == 5

        # 2. 应用重排序（限制返回 3 条）
        reranker = NoopReranker()
        config = RerankConfig(top_k=3, score_threshold=0.0)
        reranked = await reranker.rerank("test query", sample_matches, config)

        # 3. 验证结果
        assert len(reranked) == 3
        assert all(isinstance(r, KnowledgeMatch) for r in reranked)

    @pytest.mark.asyncio
    async def test_reranking_with_metadata_preservation(self, sample_matches):
        """测试重排序后元数据保留"""
        reranker = NoopReranker()
        config = RerankConfig(top_k=10)
        reranked = await reranker.rerank("test query", sample_matches, config)

        for original, reranked_match in zip(sample_matches, reranked):
            assert original.id == reranked_match.id
            assert original.content == reranked_match.content
            assert original.source_uri == reranked_match.source_uri
            assert original.metadata == reranked_match.metadata
