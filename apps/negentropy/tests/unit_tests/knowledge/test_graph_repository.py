"""
Graph Repository 单元测试

测试 AgeGraphRepository 的核心功能。
使用 mocked database session 以避免实际数据库连接。
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.knowledge.graph.repository import (
    AgeGraphRepository,
    BuildRunRecord,
    GraphSearchResult,
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
        """create_entities 应批量创建实体（单 Session 批量提交）"""
        entities = [
            sample_entity,
            GraphNode(id="entity:second", label="Second", node_type="person"),
        ]

        ids = await repository.create_entities(entities, _CORPUS_ID)

        assert len(ids) == 2
        assert ids[0] == sample_entity.id
        assert ids[1] == "entity:second"
        # 批量提交：每个 entity 一次 execute，最后一次 commit
        assert mock_session.execute.call_count == 2
        mock_session.commit.assert_called_once()

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
        mock_result = MagicMock()
        mock_result.first.return_value = None
        mock_session.execute.return_value = mock_result

        path = await repository.find_path("entity:a", "entity:b")

        assert path is None

    @pytest.mark.asyncio
    async def test_find_path_returns_path_if_direct_relation(self, repository, mock_session):
        """find_path 有直接关系时应返回路径"""
        mock_row = MagicMock()
        mock_row.full_path = ["source-id", "target-id"]
        mock_result = MagicMock()
        mock_result.first.return_value = mock_row
        mock_session.execute.return_value = mock_result

        path = await repository.find_path("entity:source-id", "entity:target-id")

        assert path is not None
        assert len(path) == 2
        assert "source" in path[0]
        assert "target" in path[1]

    @pytest.mark.asyncio
    async def test_clear_graph_resets_entity_fields(self, repository, mock_session):
        """clear_graph 应重置一等公民表和 knowledge 表"""
        mock_result = MagicMock()
        mock_result.rowcount = 5
        mock_session.execute.return_value = mock_result

        count = await repository.clear_graph(_CORPUS_ID)

        # 3 calls: delete kg_relations, delete kg_entities, update knowledge
        assert mock_session.execute.call_count == 3
        mock_session.commit.assert_called_once()
        assert count == 5

    @pytest.mark.asyncio
    async def test_get_graph_returns_nodes_and_edges(self, repository, mock_session):
        """get_graph 应从一等公民表优先读取，回退到 JSONB"""
        # 第一阶段：一等公民表返回空（触发回退）
        empty_result = MagicMock()
        empty_result.__iter__ = lambda self: iter([])

        # 第二阶段：JSONB 回退路径返回数据
        mock_row = MagicMock()
        mock_row.id = "entity-id"
        mock_row.content = "Entity content"
        mock_row.entity_type = "person"
        mock_row.metadata = {"related_entities": [{"target_id": "other-id", "relation_type": "WORKS_FOR"}]}
        mock_row.entity_confidence = 0.9

        jsonb_result = MagicMock()
        jsonb_result.__iter__ = lambda self: iter([mock_row])

        mock_session.execute.side_effect = [empty_result, jsonb_result]

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


class TestSessionScope:
    """``_session_scope`` 上下文管理器回归测试。

    历史问题：旧版 ``_get_session`` 在 ``async with AsyncSessionLocal() as s: return s``
    中把 session 引用泄露到上下文外，导致连接未归还到池，触发
    ``AsyncAdaptedQueuePool: garbage collector is trying to clean up non-checked-in
    connection`` 警告，并在大批量构建（849 chunk × 多关系 ≈ 数千次调用）下耗尽连接池，
    使后续 ``update_build_run`` / pagerank / community 等步骤 hang。

    本套测试覆盖修复后的不变量：
    1. 自建分支：N 次操作必须有等量的 ``__aenter__`` / ``__aexit__`` 调用对，连接归还。
    2. 注入分支：外部 session 不被接管生命周期（``__aexit__`` 不应触发）。
    3. 异常路径：即便方法体内抛异常，``__aexit__`` 仍被调用（连接归还）。
    """

    @pytest.mark.asyncio
    async def test_self_owned_session_returns_connection(self):
        """自建 session 路径：每次方法调用必须 enter/exit 一次（连接归还到池）"""
        from contextlib import asynccontextmanager

        enter_count = 0
        exit_count = 0
        mock_session = AsyncMock(spec=AsyncSession)
        mock_session.execute = AsyncMock()
        mock_session.commit = AsyncMock()

        @asynccontextmanager
        async def fake_session_local():
            nonlocal enter_count, exit_count
            enter_count += 1
            try:
                yield mock_session
            finally:
                exit_count += 1

        repo = AgeGraphRepository()  # 注意：未注入 session，走自建分支
        with patch(
            "negentropy.knowledge.graph.repository.AsyncSessionLocal",
            side_effect=lambda: fake_session_local(),
        ):
            entity = GraphNode(
                id="entity:t1",
                label="X",
                node_type="organization",
                metadata={"confidence": 0.9},
            )
            for _ in range(10):
                await repo.create_entity(entity, _CORPUS_ID)

        assert enter_count == 10, "每次 create_entity 应触发一次 __aenter__"
        assert exit_count == 10, "每次 create_entity 应触发一次 __aexit__（连接归还）"
        assert mock_session.commit.await_count == 10

    @pytest.mark.asyncio
    async def test_injected_session_lifecycle_not_hijacked(self):
        """注入 session 路径：外部 session 不应被 __aexit__"""
        injected = AsyncMock(spec=AsyncSession)
        injected.execute = AsyncMock()
        injected.commit = AsyncMock()

        repo = AgeGraphRepository(session=injected)

        async with repo._session_scope() as s1:
            assert s1 is injected

        # 注入 session 不应被关闭/重新创建：再用一次仍是同一个对象
        async with repo._session_scope() as s2:
            assert s2 is injected

        # 注入 session 的 close 由调用方负责，repository 不会调它
        assert injected.close.await_count == 0 if hasattr(injected, "close") else True

    @pytest.mark.asyncio
    async def test_self_owned_session_releases_on_exception(self):
        """异常路径：方法体抛错也必须归还连接（__aexit__ 仍被调用）"""
        from contextlib import asynccontextmanager

        enter_count = 0
        exit_count = 0
        mock_session = AsyncMock(spec=AsyncSession)
        mock_session.execute = AsyncMock(side_effect=RuntimeError("simulated db error"))
        mock_session.commit = AsyncMock()

        @asynccontextmanager
        async def fake_session_local():
            nonlocal enter_count, exit_count
            enter_count += 1
            try:
                yield mock_session
            finally:
                exit_count += 1

        repo = AgeGraphRepository()
        entity = GraphNode(
            id="entity:t-err",
            label="X",
            node_type="organization",
            metadata={"confidence": 0.9},
        )
        with patch(
            "negentropy.knowledge.graph.repository.AsyncSessionLocal",
            side_effect=lambda: fake_session_local(),
        ):
            with pytest.raises(RuntimeError, match="simulated db error"):
                await repo.create_entity(entity, _CORPUS_ID)

        assert enter_count == 1
        assert exit_count == 1, "异常路径下 __aexit__ 仍必须触发以归还连接"
