"""
Graph Service 单元测试

测试 GraphService 的核心功能。
使用 mocked repository 以避免实际数据库操作。
"""

from __future__ import annotations

from datetime import UTC
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from negentropy.knowledge.graph.repository import (
    BuildRunRecord,
    GraphSearchResult,
)
from negentropy.knowledge.graph.service import (
    GraphBuildResult,
    GraphQueryResult,
    GraphService,
    get_graph_service,
)
from negentropy.knowledge.types import (
    GraphBuildConfig,
    GraphEdge,
    GraphNode,
)

_CORPUS_ID = UUID("00000000-0000-0000-0000-000000000001")


class TestGetGraphService:
    """Factory function 测试"""

    def test_returns_graph_service(self):
        """应返回 GraphService 实例"""
        with patch("negentropy.knowledge.graph.service.get_graph_repository") as mock_repo:
            mock_repo.return_value = MagicMock()
            service = get_graph_service()
            assert isinstance(service, GraphService)

    def test_accepts_optional_session(self):
        """应接受可选的 session 参数"""
        mock_session = MagicMock()
        with patch("negentropy.knowledge.graph.service.get_graph_repository") as mock_repo:
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
    async def test_get_graph_cache_key_isolates_as_of(self, service, mock_repository):
        """as_of 不同时缓存键应不同 — 避免脏读 (G3)"""
        from datetime import datetime

        from negentropy.knowledge.graph.service import _graph_cache
        from negentropy.knowledge.types import KnowledgeGraphPayload

        # 清空缓存避免互测污染
        _graph_cache._store.clear()

        nodes_now = [GraphNode(id="e_now", label="Now", node_type="person")]
        nodes_past = [GraphNode(id="e_past", label="Past", node_type="person")]

        async def _stub_get_graph(corpus_id, app_name, as_of=None):  # noqa: ARG001
            return KnowledgeGraphPayload(
                nodes=nodes_past if as_of else nodes_now,
                edges=[],
            )

        mock_repository.get_graph.side_effect = _stub_get_graph

        # 第一次：当前快照（as_of=None）
        cur = await service.get_graph(_CORPUS_ID, "app")
        assert cur.nodes[0].id == "e_now"

        # 第二次：历史快照（as_of=2024-05-01）
        past = await service.get_graph(
            _CORPUS_ID,
            "app",
            as_of=datetime(2024, 5, 1, tzinfo=UTC),
        )
        assert past.nodes[0].id == "e_past"

        # repository 被调用两次（不同 cache key 不命中）
        assert mock_repository.get_graph.call_count == 2

    @pytest.mark.asyncio
    async def test_get_subgraph_bfs_radius_1(self, service, mock_repository):
        """get_subgraph: radius=1 应只返回 center + 直接邻居 (G2)"""
        from negentropy.knowledge.types import KnowledgeGraphPayload

        # 全图：A — B — C — D（链式）
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
        # B (center) + A + C 直接相邻；D 不在 1 跳内
        assert ids == {"entity:a", "entity:b", "entity:c"}
        # 边只保留两端都在节点集合中的
        assert len(sub.edges) == 2  # A-B 与 B-C

    @pytest.mark.asyncio
    async def test_get_subgraph_respects_limit(self, service, mock_repository):
        """get_subgraph: limit=2 应按 (跳数, importance) 排序后截断"""
        from negentropy.knowledge.types import KnowledgeGraphPayload

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
        # center 必在；n1 importance 高，应优先于 n2
        assert "entity:c" in ids
        assert "entity:n1" in ids
        assert "entity:n2" not in ids

    @pytest.mark.asyncio
    async def test_get_subgraph_invalid_radius_raises(self, service, mock_repository):
        """get_subgraph: radius 超出 [1,3] 应抛 ValueError"""
        with pytest.raises(ValueError, match="radius"):
            await service.get_subgraph(_CORPUS_ID, "app", center_id="entity:c", radius=5)

    @pytest.mark.asyncio
    async def test_get_relation_timeline_delegates_to_repository(self, service, mock_repository):
        """get_relation_timeline 应委托给 repository 并透传 bucket"""
        mock_repository.get_relation_timeline = AsyncMock(
            return_value=[{"date": "2024-05-01", "active_count": 7, "expired_count": 2}]
        )
        timeline = await service.get_relation_timeline(_CORPUS_ID, bucket="day")
        assert len(timeline) == 1
        mock_repository.get_relation_timeline.assert_called_once_with(corpus_id=_CORPUS_ID, bucket="day")

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


# ================================
# GraphBuildConfig Model Name Tests
# ================================


class FakeGraphRepository:
    """用于测试 build_graph 的 Fake Repository"""

    def __init__(self) -> None:
        self.create_build_run_kwargs = None
        self.update_build_run_kwargs = None

    async def create_build_run(self, **kwargs):
        self.create_build_run_kwargs = kwargs
        return "run-uuid"

    async def clear_graph(self, corpus_id):
        return None

    async def create_entities(self, entities, corpus_id):
        return []

    async def create_relations(self, relations):
        return None

    async def update_build_run(self, **kwargs):
        self.update_build_run_kwargs = kwargs
        return None

    async def find_similar_entities(self, **kwargs):
        return []


@pytest.mark.asyncio
async def test_build_graph_persists_canonical_model_name():
    repository = FakeGraphRepository()
    service = GraphService(repository=repository, config=GraphBuildConfig(llm_model="openai/gpt-5-mini"))

    result = await service.build_graph(
        corpus_id=uuid4(),
        app_name="test-app",
        chunks=[],
    )

    assert result.status == "completed"
    assert repository.create_build_run_kwargs["model_name"] == "openai/gpt-5-mini"
    assert repository.create_build_run_kwargs["extractor_config"]["llm_model"] == "openai/gpt-5-mini"
