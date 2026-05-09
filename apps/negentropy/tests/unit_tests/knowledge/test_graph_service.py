"""
Graph Service 单元测试

测试 GraphService 的核心功能。
使用 mocked repository 以避免实际数据库操作。
"""

from __future__ import annotations

from contextlib import contextmanager
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


@contextmanager
def _patch_build_graph(repository):
    """为 build_graph 测试创建共享 Session mock + AgeGraphRepository mock。

    build_graph 内部通过 AsyncSessionLocal() 创建共享 Session、再构造
    AgeGraphRepository(session=shared_session) 作为 build_repo——绕过注入的 fake。
    本 helper 将两者 mock 为使用注入的 fake repository，使单元测试无需真实 DB。
    """
    mock_session = AsyncMock()
    mock_session.in_transaction = MagicMock(return_value=False)
    mock_session.is_active = True
    with (
        patch("negentropy.db.session.AsyncSessionLocal", return_value=mock_session),
        patch("negentropy.knowledge.graph.repository.AgeGraphRepository", return_value=repository),
    ):
        yield


@pytest.mark.asyncio
async def test_build_graph_persists_canonical_model_name():
    repository = FakeGraphRepository()
    service = GraphService(repository=repository, config=GraphBuildConfig(llm_model="openai/gpt-5-mini"))

    with _patch_build_graph(repository):
        result = await service.build_graph(
            corpus_id=uuid4(),
            app_name="test-app",
            chunks=[],
        )

    assert result.status == "completed"
    assert repository.create_build_run_kwargs["model_name"] == "openai/gpt-5-mini"
    assert repository.create_build_run_kwargs["extractor_config"]["llm_model"] == "openai/gpt-5-mini"


# ================================
# Build Phase Progress Tests
# ================================


class PhaseTrackingFakeRepository:
    """记录 build_graph 期间所有 update_build_run 调用，便于断言 phase 切换序列。

    与 FakeGraphRepository 区别：本 fake 保留 ``update_build_run`` 的全量调用历史
    （update_calls 列表），用于验证 service.emit_phase 写入的 _phase 条目顺序与
    progress_percent 单调性。仅 build_graph 阶段化进度回归测试使用。
    """

    def __init__(self) -> None:
        self.update_calls: list[dict] = []

    async def create_build_run(self, **kwargs):
        return "run-uuid"

    async def clear_graph(self, corpus_id):
        return None

    async def create_entities(self, entities, corpus_id):
        return []

    async def create_relations(self, relations):
        return None

    async def update_build_run(self, **kwargs):
        self.update_calls.append(kwargs)
        return None

    async def find_similar_entities(self, **kwargs):
        return []


def _extract_phase_sequence(update_calls: list[dict]) -> list[str]:
    """从 update_build_run 调用历史中按顺序解出 _phase name 序列。"""
    phases: list[str] = []
    for call in update_calls:
        warnings = call.get("warnings") or []
        for entry in warnings:
            if isinstance(entry, dict) and "_phase" in entry:
                meta = entry["_phase"]
                if isinstance(meta, dict) and "name" in meta:
                    phases.append(meta["name"])
    return phases


@pytest.mark.asyncio
async def test_build_graph_emits_phase_milestones_in_order():
    """build_graph 应按 extracting → resolving → syncing → pagerank → communities → summaries 顺序触发 emit_phase。

    回归保护：旧实现只在 chunk 循环每批结束时上报 progress_percent，五个后置阶段
    无任何"开始"日志/进度切换。修复后每个阶段应在执行前调用 emit_phase 写入 _phase 条目，
    SSE 端点据此透传中文标签给 KgBuildProgressPill。
    """
    repository = PhaseTrackingFakeRepository()
    service = GraphService(repository=repository, config=GraphBuildConfig(llm_model="openai/gpt-5-mini"))

    with _patch_build_graph(repository):
        result = await service.build_graph(
            corpus_id=uuid4(),
            app_name="test-app",
            chunks=[],  # 空 chunk：跳过实体抽取与持久化阶段，但所有 emit_phase 仍应触发
        )

    assert result.status == "completed"

    phases = _extract_phase_sequence(repository.update_calls)
    expected = ["extracting", "resolving", "syncing", "pagerank", "communities", "summaries"]
    assert phases == expected, f"phase 序列不符合预期，实际={phases}"


@pytest.mark.asyncio
async def test_build_graph_progress_percent_monotonically_increases():
    """build_graph 期间所有 update_build_run 上报的 progress_percent 应单调非递减。

    回归保护：emit_phase 与 maybe_report_chunk_progress 之间若进度计算错误，
    可能导致进度条"倒退"，影响用户对构建进展的判断。
    """
    repository = PhaseTrackingFakeRepository()
    service = GraphService(repository=repository, config=GraphBuildConfig())

    with _patch_build_graph(repository):
        await service.build_graph(corpus_id=uuid4(), app_name="test-app", chunks=[])

    progresses = [
        call["progress_percent"]
        for call in repository.update_calls
        if "progress_percent" in call and call["progress_percent"] is not None
    ]
    assert len(progresses) >= 6, "至少应有 6 次进度上报（每个 phase 一次）"
    for prev, curr in zip(progresses, progresses[1:], strict=False):
        assert curr >= prev, f"progress_percent 不应回退：prev={prev} curr={curr}"


@pytest.mark.asyncio
async def test_build_graph_strips_phase_entries_from_terminal_warnings():
    """终态 warnings 中不应残留 _phase 条目（service._strip_phase_entries 行为）。

    回归保护：_phase 是运行期前端实时渲染信号；落入终态 warnings 会污染历史诊断
    （warnings 语义混淆）。前端在 status=completed/failed 时也不依赖 _phase。
    """
    repository = PhaseTrackingFakeRepository()
    service = GraphService(repository=repository, config=GraphBuildConfig())

    with _patch_build_graph(repository):
        await service.build_graph(corpus_id=uuid4(), app_name="test-app", chunks=[])

    # 找到 status=completed 的最后一次 update 调用
    terminal_call = next(
        (c for c in reversed(repository.update_calls) if c.get("status") == "completed"),
        None,
    )
    assert terminal_call is not None, "build_graph 应在结束时调用 update_build_run(status='completed')"

    warnings = terminal_call.get("warnings") or []
    phase_entries = [w for w in warnings if isinstance(w, dict) and "_phase" in w]
    assert phase_entries == [], "终态 warnings 不应包含 _phase 运行期条目"

    # _metrics 应保留（与原有 build_graph 行为一致）
    metrics_entries = [w for w in warnings if isinstance(w, dict) and "_metrics" in w]
    assert len(metrics_entries) == 1, "终态 warnings 应包含一条 _metrics 条目"


# ================================
# Failure Path Warnings Persistence
# ================================


class _FailingClearGraphRepository(PhaseTrackingFakeRepository):
    """clear_graph 抛错以模拟早期失败，验证 except 分支可正确落库 warnings。"""

    async def clear_graph(self, corpus_id):  # type: ignore[override]
        raise RuntimeError("simulated clear_graph failure")


class _FailingCreateRelationsRepository(PhaseTrackingFakeRepository):
    """create_relations 抛错以模拟中段失败，验证 except 分支会剥离 _phase 并保留
    已累积的 algorithm warning（如 temporal_resolution）+ build_metrics（若已构造）。
    """

    async def create_relations(self, relations):  # type: ignore[override]
        raise RuntimeError("simulated create_relations failure")


@pytest.mark.asyncio
async def test_build_graph_failure_strips_phase_and_persists_warnings_on_early_exception():
    """早期失败：异常发生在 build_warnings/build_metrics 构造之前也不应触发 UnboundLocalError；
    failure 终态 warnings 不应残留 _phase 条目（与 success 分支语义对称）。

    回归保护本 PR 评审 #1：旧实现 except 分支未传 warnings → DB 行保留上一次 emit_phase
    写入的 _phase 运行期标记，且丢失任何已累积的 algorithm warning。
    """
    repository = _FailingClearGraphRepository()
    service = GraphService(repository=repository, config=GraphBuildConfig())

    with _patch_build_graph(repository):
        result = await service.build_graph(corpus_id=uuid4(), app_name="test-app", chunks=[])

    assert result.status == "failed"
    failed_call = next(
        (c for c in reversed(repository.update_calls) if c.get("status") == "failed"),
        None,
    )
    assert failed_call is not None, "失败终态必须调用 update_build_run(status='failed')"

    # 早期失败路径下 warnings 应为 None（_strip_phase_entries([]) 为空 → 落 None 节流 SQL）
    # 关键不变量：DB 不应残留任何 _phase 条目
    warnings = failed_call.get("warnings") or []
    phase_entries = [w for w in warnings if isinstance(w, dict) and "_phase" in w]
    assert phase_entries == [], "失败终态 warnings 不应包含 _phase 运行期条目"


@pytest.mark.asyncio
async def test_build_graph_failure_preserves_algorithm_warnings():
    """中段失败：build_warnings 中已累积的 algorithm warning 必须随 failed 终态落库。

    构造手法：让 create_relations 抛错。此时 chunks=[] 不会进 chunk 循环抽取，但
    emit_phase(extracting/resolving) 已写过 _phase；failure 分支应剥离 _phase 后落库。
    若有 algorithm warning（本测试用 chunks=[] 路径无法注入，仅验证 _phase 剥离与
    UnboundLocalError 不发生）。
    """
    repository = _FailingCreateRelationsRepository()
    service = GraphService(repository=repository, config=GraphBuildConfig())

    with _patch_build_graph(repository):
        result = await service.build_graph(corpus_id=uuid4(), app_name="test-app", chunks=[])

    assert result.status == "failed"
    failed_call = next(
        (c for c in reversed(repository.update_calls) if c.get("status") == "failed"),
        None,
    )
    assert failed_call is not None

    warnings = failed_call.get("warnings") or []
    phase_entries = [w for w in warnings if isinstance(w, dict) and "_phase" in w]
    assert phase_entries == [], "失败终态 warnings 不应残留 _phase（应被 _strip_phase_entries 剥离）"
