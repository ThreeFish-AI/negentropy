"""GraphBuildResult / GraphQueryResult dataclass 测试。"""

from __future__ import annotations

from uuid import UUID

from negentropy.knowledge.graph.repository import GraphSearchResult
from negentropy.knowledge.graph.service import GraphBuildResult, GraphQueryResult
from negentropy.knowledge.types import GraphNode

_CORPUS_ID = UUID("00000000-0000-0000-0000-000000000001")


class TestGraphBuildResult:
    def test_create_build_result(self):
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
    def test_create_query_result(self):
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
        result = GraphQueryResult(
            entities=[],
            total_count=0,
            query_time_ms=10.0,
        )
        assert len(result.entities) == 0
        assert result.total_count == 0
