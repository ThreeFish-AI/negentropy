"""
Graph Service 单元测试

测试 GraphService 的核心功能。
使用 mocked repository 以避免实际数据库操作。
"""

from __future__ import annotations

from typing import List
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from negentropy.knowledge.graph_service import (
    GraphBuildResult,
    GraphService,
    GraphQueryResult,
    get_graph_service,
)
from negentropy.knowledge.graph_repository import (
    BuildRunRecord,
    GraphSearchResult,
)
from negentropy.knowledge.types import (
    GraphBuildConfigModel,
    GraphEdge,
    GraphNode,
    GraphSearchConfig,
)


_CORPUS_ID = UUID("00000000-0000-0000-0000-000000000001")


class TestGetGraphService:
    """Factory function 测试"""

    def test_returns_graph_service(self):
        """应返回 GraphService 实例"""
        with patch("negentropy.knowledge.graph_service.get_graph_repository") as mock_repo:
            mock_repo.return_value = MagicMock()
            service = get_graph_service()
            assert isinstance(service, GraphService)

    def test_accepts_optional_session(self):
        """应接受可选的 session 参数"""
        mock_session = MagicMock()
        with patch("negentropy.knowledge.graph_service.get_graph_repository") as mock_repo:
            mock_repo.return_value = MagicMock()
            service = get_graph_service(session=mock_session)
            assert service is not None


class TestGraphService:
    """GraphService 单元测试"""

    @pytest.fixture
    def mock_repository(self):
        """Mock GraphRepository"""
        repo = MagicMock()
        repo.create_entity = AsyncMock(return_value="entity:id")
        repo.create_entities = AsyncMock(return_value=["entity:1", "entity:2"])
        repo.create_relation = AsyncMock(return_value="relation:id")
        repo.find_neighbors = AsyncMock(return_value=[])
        repo.find_path = AsyncMock(return_value=None)
        repo.get_graph = AsyncMock()
        repo.clear_graph = AsyncMock(return_value=0)
        repo.create_build_run = AsyncMock(return_value=uuid4())
        repo.update_build_run = AsyncMock()
        repo.get_build_runs = AsyncMock(return_value=[])
        repo.hybrid_search = AsyncMock(return_value=[])
        return repo

    @pytest.fixture
    def service(self, mock_repository):
        """GraphService with mocked repository"""
        return GraphService(repository=mock_repository)

    @pytest.fixture
    def sample_entities(self):
        """Sample entities for testing"""
        return [
            GraphNode(id="e1", label="OpenAI", node_type="organization"),
            GraphNode(id="e2", label="Sam Altman", node_type="person"),
        ]

    @pytest.fixture
    def sample_edges(self):
        """Sample edges for testing"""
        return [
            GraphEdge(source="e1", target="e2", edge_type="WORKS_FOR"),
        ]

    @pytest.mark.asyncio
    async def test_find_neighbors_returns_entities(self, service, mock_repository, sample_entities):
        """find_neighbors 应返回邻居实体"""
        mock_repository.find_neighbors.return_value = sample_entities

        neighbors = await service.find_neighbors("entity:test-id", max_depth=2)

        # Verify the call was made
        mock_repository.find_neighbors.assert_called_once()
        assert len(neighbors) == 2

    @pytest.mark.asyncio
    async def test_find_path_returns_path_or_none(self, service, mock_repository):
        """find_path 应返回路径或 None"""
        # Test with path found
        mock_repository.find_path.return_value = ["entity:a", "entity:b"]
        path = await service.find_path("entity:a", "entity:b")
        assert path == ["entity:a", "entity:b"]

        # Test with no path
        mock_repository.find_path.return_value = None
        path = await service.find_path("entity:a", "entity:c")
        assert path is None

    @pytest.mark.asyncio
    async def test_get_graph_returns_payload(self, service, mock_repository):
        """get_graph 应返回图谱数据"""
        from negentropy.knowledge.types import KnowledgeGraphPayload

        nodes = [GraphNode(id="e1", label="Test", node_type="person")]
        edges = []
        mock_payload = KnowledgeGraphPayload(nodes=nodes, edges=edges)
        mock_repository.get_graph.return_value = mock_payload

        result = await service.get_graph(_CORPUS_ID, "test_app")

        assert result is not None
        assert len(result.nodes) == 1

    @pytest.mark.asyncio
    async def test_clear_graph_deletes_data(self, service, mock_repository):
        """clear_graph 应删除图谱数据"""
        mock_repository.clear_graph.return_value = 5

        count = await service.clear_graph(_CORPUS_ID)

        mock_repository.clear_graph.assert_called_once_with(_CORPUS_ID)
        assert count == 5

    @pytest.mark.asyncio
    async def test_get_build_history_returns_records(self, service, mock_repository):
        """get_build_history 应返回构建历史"""
        record = BuildRunRecord(
            id=uuid4(),
            app_name="test_app",
            corpus_id=_CORPUS_ID,
            run_id="run-001",
            status="completed",
            entity_count=10,
            relation_count=5,
            extractor_config={},
            model_name="gpt-4",
            error_message=None,
            started_at=None,
            completed_at=None,
            created_at=None,
        )
        mock_repository.get_build_runs.return_value = [record]

        history = await service.get_build_history(_CORPUS_ID, "test_app")

        assert len(history) == 1
        assert history[0].status == "completed"


class TestGraphBuildResult:
    """GraphBuildResult dataclass 测试"""

    def test_create_build_result(self):
        """应正确创建 GraphBuildResult"""
        result = GraphBuildResult(
            run_id="run-001",
            corpus_id=_CORPUS_ID,
            status="completed",
            entity_count=10,
            relation_count=5,
            chunks_processed=100,
            elapsed_seconds=30.5,
            error_message=None,
        )

        assert result.run_id == "run-001"
        assert result.status == "completed"
        assert result.entity_count == 10
        assert result.relation_count == 5
        assert result.chunks_processed == 100
        assert result.elapsed_seconds == 30.5
        assert result.error_message is None

    def test_build_result_with_error(self):
        """应支持包含错误信息"""
        result = GraphBuildResult(
            run_id="run-002",
            corpus_id=_CORPUS_ID,
            status="failed",
            entity_count=0,
            relation_count=0,
            chunks_processed=50,
            elapsed_seconds=10.0,
            error_message="LLM timeout",
        )

        assert result.status == "failed"
        assert result.error_message == "LLM timeout"


class TestGraphQueryResult:
    """GraphQueryResult dataclass 测试"""

    def test_create_query_result(self):
        """应正确创建 GraphQueryResult"""
        entity = GraphNode(id="e1", label="Test", node_type="person")
        search_result = GraphSearchResult(
            entity=entity,
            semantic_score=0.9,
            graph_score=0.8,
            combined_score=0.85,
        )
        result = GraphQueryResult(
            entities=[search_result],
            total_count=1,
            query_time_ms=50.5,
        )

        assert len(result.entities) == 1
        assert result.entities[0].entity.id == "e1"
        assert result.total_count == 1
        assert result.query_time_ms == 50.5

    def test_query_result_empty(self):
        """应支持空结果"""
        result = GraphQueryResult(
            entities=[],
            total_count=0,
            query_time_ms=10.0,
        )

        assert len(result.entities) == 0
        assert result.total_count == 0
