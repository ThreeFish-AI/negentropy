"""
CommunitySummarizer 单元测试

验证社区摘要生成管线的核心逻辑：
  - LLM 调用与回退
  - 空社区处理
  - 摘要格式
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch
from uuid import uuid4

from negentropy.knowledge.graph.community_summarizer import CommunitySummarizer


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
