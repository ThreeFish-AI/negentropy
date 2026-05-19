"""
OpenMemoryService 单元测试

覆盖:
- 服务初始化
- 接口参数验证
- 响应数据结构
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from cognizes.engine.hippocampus.memory_service import (
    OpenMemoryService,
    SearchMemoryResult,
    SearchMemoryResponse,
)


class TestSearchMemoryResultDataclass:
    """SearchMemoryResult 数据类测试"""

    def test_result_creation(self):
        """验证 SearchMemoryResult 创建"""
        result = SearchMemoryResult(
            memory_id="mem-123",
            content="测试记忆内容",
            memory_type="episodic",
            relevance_score=0.92,
            metadata={"source": "chat"},
        )
        assert result.memory_id == "mem-123"
        assert result.content == "测试记忆内容"
        assert result.memory_type == "episodic"
        assert result.relevance_score == 0.92
        assert result.metadata["source"] == "chat"

    def test_result_defaults(self):
        """验证默认值"""
        result = SearchMemoryResult(
            memory_id="mem-1",
            content="content",
            memory_type="semantic",
            relevance_score=0.5,
        )
        assert result.metadata == {}


class TestSearchMemoryResponseDataclass:
    """SearchMemoryResponse 数据类测试"""

    def test_response_creation(self):
        """验证 SearchMemoryResponse 创建"""
        memories = [
            SearchMemoryResult(
                memory_id="mem-1",
                content="内容1",
                memory_type="episodic",
                relevance_score=0.9,
            ),
            SearchMemoryResult(
                memory_id="mem-2",
                content="内容2",
                memory_type="semantic",
                relevance_score=0.8,
            ),
        ]
        response = SearchMemoryResponse(
            memories=memories,
            total_count=2,
            query="测试查询",
        )
        assert len(response.memories) == 2
        assert response.total_count == 2
        assert response.query == "测试查询"


class TestOpenMemoryServiceUnit:
    """OpenMemoryService 单元测试"""

    @pytest.fixture
    def mock_pool(self):
        """创建 Mock 连接池"""
        return MagicMock()

    @pytest.fixture
    def service(self, mock_pool):
        """创建 Service 实例"""
        with patch("cognizes.engine.hippocampus.memory_service.MemoryConsolidationWorker"):
            with patch("cognizes.engine.hippocampus.memory_service.MemoryRetentionManager"):
                with patch("cognizes.engine.hippocampus.memory_service.ContextAssembler"):
                    return OpenMemoryService(mock_pool)

    def test_default_parameters(self, mock_pool):
        """验证默认参数"""
        with patch("cognizes.engine.hippocampus.memory_service.MemoryConsolidationWorker"):
            with patch("cognizes.engine.hippocampus.memory_service.MemoryRetentionManager"):
                with patch("cognizes.engine.hippocampus.memory_service.ContextAssembler"):
                    service = OpenMemoryService(mock_pool)
                    assert service.embedding_model == "text-embedding-004"
                    assert service.max_search_results == 10

    def test_custom_parameters(self, mock_pool):
        """验证自定义参数"""
        with patch("cognizes.engine.hippocampus.memory_service.MemoryConsolidationWorker"):
            with patch("cognizes.engine.hippocampus.memory_service.MemoryRetentionManager"):
                with patch("cognizes.engine.hippocampus.memory_service.ContextAssembler"):
                    service = OpenMemoryService(
                        mock_pool,
                        embedding_model="custom-model",
                        max_search_results=20,
                    )
                    assert service.embedding_model == "custom-model"
                    assert service.max_search_results == 20


class TestConsolidationTypeMapping:
    """巩固类型映射测试"""

    def test_consolidation_type_values(self):
        """验证巩固类型值"""
        from cognizes.engine.hippocampus.consolidation_worker import JobType

        type_mapping = {
            "fast": JobType.FAST_REPLAY,
            "deep": JobType.DEEP_REFLECTION,
            "full": JobType.FULL_CONSOLIDATION,
        }
        assert type_mapping["fast"] == JobType.FAST_REPLAY
        assert type_mapping["deep"] == JobType.DEEP_REFLECTION
        assert type_mapping["full"] == JobType.FULL_CONSOLIDATION
