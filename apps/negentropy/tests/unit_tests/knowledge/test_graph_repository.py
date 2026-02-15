"""
Graph Repository 单元测试

测试 AgeGraphRepository 的核心功能。
使用 mocked database session 以避免实际数据库连接。
"""

from __future__ import annotations

from typing import List
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.knowledge.graph_repository import (
    AgeGraphRepository,
    BuildRunRecord,
    EntityRecord,
    GraphRepository,
    GraphSearchResult,
    RelationRecord,
    get_graph_repository,
)
from negentropy.knowledge.types import GraphEdge, GraphNode


_CORPUS_ID = UUID("00000000-0000-0000-0000-000000000001")


class TestGetGraphRepository:
    """Factory function 测试"""

    def test_returns_age_graph_repository(self):
        """应返回 AgeGraphRepository 实例"""
        repo = get_graph_repository()
        assert isinstance(repo, AgeGraphRepository)

    def test_accepts_optional_session(self):
        """应接受可选的 session 参数"""
        mock_session = MagicMock(spec=AsyncSession)
        repo = get_graph_repository(session=mock_session)
        assert repo._session == mock_session


class TestAgeGraphRepository:
    """AgeGraphRepository 单元测试"""

    @pytest.fixture
    def mock_session(self):
        """Mock AsyncSession"""
        session = AsyncMock(spec=AsyncSession)
        session.execute = AsyncMock()
        session.commit = AsyncMock()
        return session

    @pytest.fixture
    def repository(self, mock_session):
        """Repository with mocked session"""
        return AgeGraphRepository(session=mock_session)

    @pytest.fixture
    def sample_entity(self):
        """Sample GraphNode for testing"""
        return GraphNode(
            id="entity:test-entity-id",
            label="OpenAI",
            node_type="organization",
            metadata={"confidence": 0.95},
        )

    @pytest.fixture
    def sample_edge(self):
        """Sample GraphEdge for testing"""
        return GraphEdge(
            source="entity:source-id",
            target="entity:target-id",
            edge_type="WORKS_FOR",
            weight=0.9,
            metadata={"confidence": 0.85},
        )

    @pytest.mark.asyncio
    async def test_create_entity_updates_knowledge_table(self, repository, mock_session, sample_entity):
        """create_entity 应更新 knowledge 表"""
        # Mock execute result
        mock_result = MagicMock()
        mock_session.execute.return_value = mock_result

        entity_id = await repository.create_entity(sample_entity, _CORPUS_ID)

        # Verify session.execute was called
        mock_session.execute.assert_called_once()
        mock_session.commit.assert_called_once()

        # Verify entity ID is returned
        assert entity_id == sample_entity.id

    @pytest.mark.asyncio
    async def test_create_entities_batch(self, repository, mock_session, sample_entity):
        """create_entities 应批量创建实体"""
        entities = [
            sample_entity,
            GraphNode(id="entity:second", label="Second", node_type="person"),
        ]

        with patch.object(repository, 'create_entity') as mock_create:
            mock_create.return_value = "entity:id"
            ids = await repository.create_entities(entities, _CORPUS_ID)

            assert len(ids) == 2
            assert mock_create.call_count == 2

    @pytest.mark.asyncio
    async def test_create_relation_stores_in_metadata(self, repository, mock_session, sample_edge):
        """create_relation 应存储关系信息"""
        # Mock first query result (get current related_entities)
        mock_result = MagicMock()
        mock_result.fetchone.return_value = MagicMock(related=None)
        mock_session.execute.return_value = mock_result

        relation_id = await repository.create_relation(
            sample_edge.source,
            sample_edge.target,
            sample_edge,
        )

        # Verify session methods called
        assert mock_session.execute.call_count >= 2  # SELECT + UPDATE
        mock_session.commit.assert_called()

        # Verify relation ID format
        assert relation_id.startswith("relation:")

    @pytest.mark.asyncio
    async def test_find_neighbors_returns_related_entities(self, repository, mock_session):
        """find_neighbors 应返回关联实体"""
        # Mock query result
        mock_row = MagicMock()
        mock_row.id = "neighbor-id"
        mock_row.content = "Neighbor entity content"
        mock_row.entity_type = "person"
        mock_row.metadata = {}
        mock_row.entity_confidence = 0.9

        mock_result = MagicMock()
        mock_result.__iter__ = lambda self: iter([mock_row])
        mock_session.execute.return_value = mock_result

        neighbors = await repository.find_neighbors("entity:test-id", max_depth=1)

        assert len(neighbors) == 1
        assert neighbors[0].id == "entity:neighbor-id"

    @pytest.mark.asyncio
    async def test_find_path_returns_none_if_no_direct_relation(self, repository, mock_session):
        """find_path 无直接关系时应返回 None"""
        with patch.object(repository, 'find_neighbors') as mock_neighbors:
            mock_neighbors.return_value = []  # No neighbors

            path = await repository.find_path("entity:a", "entity:b")

            assert path is None

    @pytest.mark.asyncio
    async def test_find_path_returns_path_if_direct_relation(self, repository, mock_session):
        """find_path 有直接关系时应返回路径"""
        with patch.object(repository, 'find_neighbors') as mock_neighbors:
            mock_neighbors.return_value = [
                GraphNode(id="entity:target-id", label="Target", node_type="person"),
            ]

            path = await repository.find_path("entity:source-id", "entity:target-id")

            assert path is not None
            assert len(path) == 2
            assert "source" in path[0]
            assert "target" in path[1]

    @pytest.mark.asyncio
    async def test_clear_graph_resets_entity_fields(self, repository, mock_session):
        """clear_graph 应重置实体相关字段"""
        mock_result = MagicMock()
        mock_result.rowcount = 5
        mock_session.execute.return_value = mock_result

        count = await repository.clear_graph(_CORPUS_ID)

        mock_session.execute.assert_called_once()
        mock_session.commit.assert_called_once()
        assert count == 5

    @pytest.mark.asyncio
    async def test_get_graph_returns_nodes_and_edges(self, repository, mock_session):
        """get_graph 应返回节点和边"""
        # Mock entities query result
        mock_row = MagicMock()
        mock_row.id = "entity-id"
        mock_row.content = "Entity content"
        mock_row.entity_type = "person"
        mock_row.metadata = {"related_entities": [{"target_id": "other-id", "relation_type": "WORKS_FOR"}]}
        mock_row.entity_confidence = 0.9

        mock_result = MagicMock()
        mock_result.__iter__ = lambda self: iter([mock_row])
        mock_session.execute.return_value = mock_result

        graph = await repository.get_graph(_CORPUS_ID, "test_app")

        assert len(graph.nodes) == 1
        assert len(graph.edges) == 1
        assert graph.nodes[0].id == "entity:entity-id"
        assert graph.edges[0].edge_type == "WORKS_FOR"


class TestBuildRunRecord:
    """BuildRunRecord dataclass 测试"""

    def test_create_build_run_record(self):
        """应正确创建 BuildRunRecord"""
        record = BuildRunRecord(
            id=uuid4(),
            app_name="test_app",
            corpus_id=_CORPUS_ID,
            run_id="run-001",
            status="completed",
            entity_count=10,
            relation_count=5,
            extractor_config={"llm": True},
            model_name="gpt-4",
            error_message=None,
            started_at=None,
            completed_at=None,
            created_at=None,
        )

        assert record.status == "completed"
        assert record.entity_count == 10
        assert record.relation_count == 5


class TestGraphSearchResult:
    """GraphSearchResult dataclass 测试"""

    def test_create_search_result(self):
        """应正确创建 GraphSearchResult"""
        entity = GraphNode(id="e1", label="Test", node_type="person")
        result = GraphSearchResult(
            entity=entity,
            semantic_score=0.85,
            graph_score=0.72,
            combined_score=0.79,
        )

        assert result.entity.id == "e1"
        assert result.semantic_score == 0.85
        assert result.graph_score == 0.72
        assert result.combined_score == 0.79
        assert result.neighbors == []
        assert result.path is None

    def test_search_result_with_neighbors(self):
        """应支持包含邻居节点"""
        entity = GraphNode(id="e1", label="Test", node_type="person")
        neighbor = GraphNode(id="e2", label="Neighbor", node_type="person")

        result = GraphSearchResult(
            entity=entity,
            semantic_score=0.85,
            graph_score=0.72,
            combined_score=0.79,
            neighbors=[neighbor],
        )

        assert len(result.neighbors) == 1
        assert result.neighbors[0].id == "e2"
