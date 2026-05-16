"""GraphService CRUD 单元测试

涵盖 factory function, find_neighbors, get__graph,
subgraph, timeline, build_history 等操作。
"""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from negentropy.knowledge.graph.repository import BuildRunRecord
from negentropy.knowledge.graph.service import GraphService, get_graph_service
from negentropy.knowledge.types import GraphEdge, GraphNode, KnowledgeGraphPayload

_CORPUS_ID = UUID("00000000-0000-0000-0000-000000000001")


class TestGetGraphService:
    def test_returns_graph_service(self):
        with patch("negentropy.knowledge.graph.service.get_graph_repository") as mock_repo:
            mock_repo.return_value = MagicMock()
            service = get_graph_service()
            assert isinstance(service, GraphService)

    def test_accepts_optional_session(self):
        mock_session = MagicMock()
        with patch("negentropy.knowledge.graph.service.get_graph_repository") as mock_repo:
            mock_repo.return_value = MagicMock()
            service = get_graph_service(session=mock_session)
            assert service is not None


class TestGraphService:
    @pytest.fixture
    def mock_repository(self):
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
        return GraphService(repository=mock_repository)

    @pytest.fixture
    def sample_entities(self):
        return [
            GraphNode(id="e1", label="OpenAI", node_type="organization"),
            GraphNode(id="e2", label="Sam Altman", node_type="person"),
        ]

    @pytest.mark.asyncio
    async def test_find_neighbors_returns_entities(self, service, mock_repository, sample_entities):
        mock_repository.find_neighbors.return_value = sample_entities
        neighbors = await service.find_neighbors("entity:test-id", max_depth=2)
        mock_repository.find_neighbors.assert_called_once()
        assert len(neighbors) == 2

    @pytest.mark.asyncio
    async def test_find_path_returns_path_or_none(self, service, mock_repository):
        mock_repository.find_path.return_value = ["entity:a", "entity:b"]
        path = await service.find_path("entity:a", "entity:b")
        assert path == ["entity:a", "entity:b"]

        mock_repository.find_path.return_value = None
        path = await service.find_path("entity:a", "entity:c")
        assert path is None

    @pytest.mark.asyncio
    async def test_get_graph_returns_payload(self, service, mock_repository):
        nodes = [GraphNode(id="e1", label="Test", node_type="person")]
        edges = []
        mock_payload = KnowledgeGraphPayload(nodes=nodes, edges=edges)
        mock_repository.get_graph.return_value = mock_payload
        result = await service.get_graph(_CORPUS_ID, "test_app")
        assert result is not None
        assert len(result.nodes) == 1

    @pytest.mark.asyncio
    async def test_clear_graph_deletes_data(self, service, mock_repository):
        mock_repository.clear_graph.return_value = 5
        count = await service.clear_graph(_CORPUS_ID)
        mock_repository.clear_graph.assert_called_once_with(_CORPUS_ID)
        assert count == 5

    @pytest.mark.asyncio
    async def test_get_graph_cache_key_isolates_as_of(self, service, mock_repository):
        from negentropy.knowledge.graph.service import _graph_cache

        _graph_cache._store.clear()

        nodes_now = [GraphNode(id="e_now", label="Now", node_type="person")]
        nodes_past = [GraphNode(id="e_past", label="Past", node_type="person")]

        async def _stub_get_graph(corpus_id, app_name, as_of=None):  # noqa: ARG001
            return KnowledgeGraphPayload(
                nodes=nodes_past if as_of else nodes_now,
                edges=[],
            )

        mock_repository.get_graph.side_effect = _stub_get_graph

        cur = await service.get_graph(_CORPUS_ID, "app")
        assert cur.nodes[0].id == "e_now"

        past = await service.get_graph(
            _CORPUS_ID,
            "app",
            as_of=datetime(2024, 5, 1, tzinfo=UTC),
        )
        assert past.nodes[0].id == "e_past"

        assert mock_repository.get_graph.call_count == 2

    @pytest.mark.asyncio
    async def test_get_subgraph_bfs_radius_1(self, service, mock_repository):
        nodes = [
            GraphNode(id="entity:a", label="A", node_type="t"),
            GraphNode(id="entity:b", label="B", node_type="t"),
            GraphNode(id="entity:c", label="C", node_type="t"),
            GraphNode(id="entity:d", label="D", node_type="t"),
        ]
        edges = [
            GraphEdge(source="entity:a", target="entity:b", edge_type="X"),
            GraphEdge(source="entity:b", target="entity:c", edge_type="X"),
            GraphEdge(source="entity:c", target="entity:d", edge_type="X"),
        ]
        mock_repository.get_graph.side_effect = None
        mock_repository.get_graph.return_value = KnowledgeGraphPayload(nodes=nodes, edges=edges)

        from negentropy.knowledge.graph.service import _graph_cache

        _graph_cache._store.clear()
        sub = await service.get_subgraph(_CORPUS_ID, "app", center_id="entity:b", radius=1)
        ids = {n.id for n in sub.nodes}
        assert ids == {"entity:a", "entity:b", "entity:c"}
        assert len(sub.edges) == 2

    @pytest.mark.asyncio
    async def test_get_subgraph_respects_limit(self, service, mock_repository):
        nodes = [
            GraphNode(id="entity:c", label="Center", node_type="t", metadata={}),
            GraphNode(id="entity:n1", label="N1", node_type="t", metadata={"importance_score": 0.9}),
            GraphNode(id="entity:n2", label="N2", node_type="t", metadata={"importance_score": 0.1}),
        ]
        edges = [
            GraphEdge(source="entity:c", target="entity:n1", edge_type="X"),
            GraphEdge(source="entity:c", target="entity:n2", edge_type="X"),
        ]
        mock_repository.get_graph.side_effect = None
        mock_repository.get_graph.return_value = KnowledgeGraphPayload(nodes=nodes, edges=edges)

        from negentropy.knowledge.graph.service import _graph_cache

        _graph_cache._store.clear()
        sub = await service.get_subgraph(_CORPUS_ID, "app", center_id="entity:c", radius=1, limit=2)
        ids = [n.id for n in sub.nodes]
        assert "entity:c" in ids
        assert "entity:n1" in ids
        assert "entity:n2" not in ids

    @pytest.mark.asyncio
    async def test_get_subgraph_invalid_radius_raises(self, service, mock_repository):
        with pytest.raises(ValueError, match="radius"):
            await service.get_subgraph(_CORPUS_ID, "app", center_id="entity:c", radius=5)

    @pytest.mark.asyncio
    async def test_get_relation_timeline_delegates_to_repository(self, service, mock_repository):
        mock_repository.get_relation_timeline = AsyncMock(
            return_value=[{"date": "2024-05-01", "active_count": 7, "expired_count": 2}]
        )
        timeline = await service.get_relation_timeline(_CORPUS_ID, bucket="day")
        assert len(timeline) == 1
        mock_repository.get_relation_timeline.assert_called_once_with(corpus_id=_CORPUS_ID, bucket="day")

    @pytest.mark.asyncio
    async def test_get_build_history_returns_records(self, service, mock_repository):
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
