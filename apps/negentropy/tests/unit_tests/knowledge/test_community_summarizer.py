"""
CommunitySummarizer 单元测试

验证社区摘要生成管线的核心逻辑：
  - LLM 调用与回退
  - 空社区处理
  - 摘要格式
  - 嵌入失败可观测性（P5 回归）
"""

from __future__ import annotations

import inspect
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from negentropy.knowledge.graph.community_summarizer import (
    CommunitySummarizer,
    CommunitySummary,
)


class TestCommunitySummarizer:
    async def test_empty_communities(self):
        summarizer = CommunitySummarizer()
        db = AsyncMock()

        result = await summarizer.summarize_communities(db, uuid4(), community_entities={})
        assert result["communities_summarized"] == 0
        assert result["errors"] == 0

    async def test_single_community(self):
        summarizer = CommunitySummarizer()
        db = AsyncMock()
        db.commit = AsyncMock()
        db.execute = AsyncMock()

        entities = {
            1: [
                {"name": "OpenAI", "entity_type": "organization", "confidence": 0.95},
                {"name": "Sam Altman", "entity_type": "person", "confidence": 0.9},
                {"name": "GPT-4", "entity_type": "product", "confidence": 0.85},
            ]
        }

        with patch.object(summarizer, "_call_llm", return_value="AI industry leaders"):
            result = await summarizer.summarize_communities(db, uuid4(), community_entities=entities)

        assert result["communities_summarized"] == 1
        assert result["errors"] == 0

    async def test_llm_failure_uses_fallback(self):
        summarizer = CommunitySummarizer()
        db = AsyncMock()
        db.commit = AsyncMock()
        db.execute = AsyncMock()

        entities = {
            1: [{"name": "Test", "entity_type": "concept", "confidence": 0.8}],
        }

        with patch.object(summarizer, "_call_llm", return_value=""):
            result = await summarizer.summarize_communities(db, uuid4(), community_entities=entities)

        # 即使 LLM 返回空，也应使用回退摘要
        assert result["communities_summarized"] == 1

    async def test_skips_empty_community(self):
        summarizer = CommunitySummarizer()
        db = AsyncMock()
        db.commit = AsyncMock()

        entities = {
            1: [],
            2: [{"name": "Test", "entity_type": "concept", "confidence": 0.8}],
        }

        with patch.object(summarizer, "_call_llm", return_value="Summary"):
            with patch.object(summarizer, "_persist_summary", new_callable=AsyncMock):
                result = await summarizer.summarize_communities(db, uuid4(), community_entities=entities)

        # 只有社区 2 被摘要
        assert result["communities_summarized"] == 1


# ============================================================================
# P5: 嵌入失败可观测性回归测试
# ============================================================================


class TestEmbeddingFailure:
    """验证 _persist_summary 嵌入失败返回值与计数"""

    @pytest.mark.asyncio
    async def test_persist_summary_returns_false_on_embedding_success(self):
        """embedding 成功时 _persist_summary 应返回 False"""
        summarizer = CommunitySummarizer(embedding_fn=AsyncMock(return_value=[0.1] * 10))
        db = AsyncMock()
        summary = CommunitySummary(
            community_id=1,
            summary_text="A summary of the community",
            entity_count=3,
            relation_count=2,
            top_entities=["A", "B"],
        )

        with patch.object(summarizer, "_persist_summary", new_callable=AsyncMock, return_value=False):
            result = await summarizer._persist_summary(db, uuid4(), summary)
        assert result is False

    @pytest.mark.asyncio
    async def test_persist_summary_returns_true_on_embedding_failure(self):
        """embedding 失败时 _persist_summary 应返回 True"""
        summarizer = CommunitySummarizer(embedding_fn=AsyncMock(side_effect=RuntimeError("proxy unsupported")))
        db = AsyncMock()
        summary = CommunitySummary(
            community_id=1,
            summary_text="A summary of the community that is longer than nothing",
            entity_count=3,
            relation_count=2,
            top_entities=["A", "B"],
        )

        result = await summarizer._persist_summary(db, uuid4(), summary)
        assert result is True

    @pytest.mark.asyncio
    async def test_persist_summary_no_embedding_fn_returns_false(self):
        """无 embedding_fn 时不视为失败，返回 False"""
        summarizer = CommunitySummarizer(embedding_fn=None)
        db = AsyncMock()
        summary = CommunitySummary(
            community_id=1,
            summary_text="Some summary text",
            entity_count=2,
            relation_count=1,
            top_entities=["X"],
        )

        result = await summarizer._persist_summary(db, uuid4(), summary)
        assert result is False

    @pytest.mark.asyncio
    async def test_summarize_communities_counts_embeddings_failed(self):
        """summarize_communities 应统计 embedding 失败数"""
        summarizer = CommunitySummarizer()
        db = AsyncMock()
        db.commit = AsyncMock()

        entities = {
            1: [{"name": "A", "entity_type": "concept", "confidence": 0.8}],
            2: [{"name": "B", "entity_type": "concept", "confidence": 0.8}],
        }

        # 社区 1 embedding 失败，社区 2 成功
        with patch.object(summarizer, "_call_llm", return_value="Summary"):
            with patch.object(summarizer, "_persist_summary", new_callable=AsyncMock, side_effect=[True, False]):
                result = await summarizer.summarize_communities(db, uuid4(), community_entities=entities)

        assert result["communities_summarized"] == 2
        assert result["embeddings_failed"] == 1

    @pytest.mark.asyncio
    async def test_summarize_communities_no_embedding_failure_omits_key(self):
        """无 embedding 失败时结果不应包含 embeddings_failed 键"""
        summarizer = CommunitySummarizer()
        db = AsyncMock()
        db.commit = AsyncMock()

        entities = {
            1: [{"name": "A", "entity_type": "concept", "confidence": 0.8}],
        }

        with patch.object(summarizer, "_call_llm", return_value="Summary"):
            with patch.object(summarizer, "_persist_summary", new_callable=AsyncMock, return_value=False):
                result = await summarizer.summarize_communities(db, uuid4(), community_entities=entities)

        assert result["communities_summarized"] == 1
        assert "embeddings_failed" not in result

    @pytest.mark.asyncio
    async def test_all_embeddings_failed(self):
        """所有社区 embedding 均失败时计数应等于社区总数"""
        summarizer = CommunitySummarizer()
        db = AsyncMock()
        db.commit = AsyncMock()

        entities = {
            1: [{"name": "A", "entity_type": "concept", "confidence": 0.8}],
            2: [{"name": "B", "entity_type": "concept", "confidence": 0.8}],
            3: [{"name": "C", "entity_type": "concept", "confidence": 0.8}],
        }

        with patch.object(summarizer, "_call_llm", return_value="Summary"):
            with patch.object(
                summarizer,
                "_persist_summary",
                new_callable=AsyncMock,
                side_effect=[True, True, True],
            ):
                result = await summarizer.summarize_communities(db, uuid4(), community_entities=entities)

        assert result["embeddings_failed"] == 3


class TestEmbeddingFailureStructure:
    """验证 community_summarizer.py 中 embedding 失败处理的结构回归"""

    def test_persist_summary_returns_embedding_failed(self):
        """_persist_summary 方法应返回 embedding_failed 布尔值"""
        source = inspect.getsource(CommunitySummarizer._persist_summary)
        assert "embedding_failed" in source
        assert "return embedding_failed" in source

    def test_has_text_preview_in_warning(self):
        """embedding 失败的 warning 日志应包含 text_preview"""
        source = inspect.getsource(CommunitySummarizer._persist_summary)
        assert "text_preview" in source
        assert "summary_embedding_failed" in source

    def test_has_embeddings_failed_in_summarize(self):
        """summarize_communities 应追踪 embeddings_failed 计数"""
        source = inspect.getsource(CommunitySummarizer.summarize_communities)
        assert "embeddings_failed" in source
