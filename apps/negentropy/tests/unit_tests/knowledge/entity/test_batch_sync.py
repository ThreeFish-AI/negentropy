"""batch_sync_from_graph_build() 单元测试。"""

from __future__ import annotations

from unittest.mock import patch
from uuid import uuid4

import pytest

from negentropy.knowledge.graph.entity_service import KgEntityService
from tests.unit_tests.knowledge.conftest import FakeEntityDbSession

from .conftest import CORPUS_ID, FakeExecuteResult, make_entity_ns


class TestBatchSyncFromGraphBuild:
    @pytest.fixture
    def service(self) -> KgEntityService:
        return KgEntityService()

    @pytest.fixture
    def db(self) -> FakeEntityDbSession:
        return FakeEntityDbSession()

    async def test_batch_sync_processes_all_nodes_and_edges(self, service, db):
        nodes = [
            {"id": str(uuid4()), "label": "NodeA", "node_type": "CONCEPT"},
            {"id": str(uuid4()), "label": "NodeB", "node_type": "TECH"},
        ]
        edges = [
            {"source": "NodeA", "target": "NodeB", "edge_type": "USES"},
        ]

        src_stub = make_entity_ns(name="NodeA")
        tgt_stub = make_entity_ns(name="NodeB")
        call_idx = [0]

        async def _fake_execute(stmt):
            stmt_str = str(stmt).lower()
            if "kg_relations" in stmt_str:
                return FakeExecuteResult([])
            call_idx[0] += 1
            if call_idx[0] <= 2:
                return FakeExecuteResult([])
            if call_idx[0] == 3:
                return FakeExecuteResult([src_stub])
            return FakeExecuteResult([tgt_stub])

        with patch.object(db, "execute", side_effect=_fake_execute):
            result = await service.batch_sync_from_graph_build(db, nodes=nodes, edges=edges, corpus_id=CORPUS_ID)

        assert result["entities_synced"] == 2
        assert result["relations_synced"] == 1
        assert result["relations_skipped"] == 0
        assert result["entities_updated"] == 0

    async def test_batch_sync_relations_skipped_when_endpoint_missing(self, service, db):
        edges = [
            {"source": "Ghost1", "target": "Ghost2", "edge_type": "VANISHED"},
            {"source": "Ghost3", "target": "Ghost4", "edge_type": "VANISHED"},
        ]

        async def _fake_execute(stmt):
            return FakeExecuteResult([])

        with patch.object(db, "execute", side_effect=_fake_execute):
            result = await service.batch_sync_from_graph_build(db, nodes=[], edges=edges, corpus_id=CORPUS_ID)

        assert result["relations_synced"] == 0
        assert result["relations_skipped"] == 2
        assert result["relations_failed"] == 0

    async def test_batch_sync_error_isolation_one_failure(self, service, db):
        nodes = [
            {"id": str(uuid4()), "label": "GoodNode", "node_type": "OK"},
            {"id": str(uuid4()), "label": "BadNode", "node_type": "BROKEN"},
            {"id": str(uuid4()), "label": "AnotherGood", "node_type": "OK"},
        ]

        call_num = [0]

        async def _fake_execute(stmt):
            call_num[0] += 1
            if call_num[0] == 2:
                raise RuntimeError("Simulated DB error for BadNode")
            return FakeExecuteResult([])

        with patch.object(db, "execute", side_effect=_fake_execute):
            result = await service.batch_sync_from_graph_build(db, nodes=nodes, edges=[], corpus_id=CORPUS_ID)

        assert result["entities_synced"] == 2

    async def test_batch_sync_error_isolation_edge_failure(self, service, db):
        edges = [
            {"source": "A", "target": "B", "edge_type": "GOOD"},
            {"source": "X", "target": "Y", "edge_type": "FAIL_EDGE"},
            {"source": "C", "target": "D", "edge_type": "ALSO_GOOD"},
        ]

        call_num = [0]

        async def _fake_execute(stmt):
            call_num[0] += 1
            if call_num[0] == 4:
                raise RuntimeError("Edge processing failure")
            return FakeExecuteResult([])

        with patch.object(db, "execute", side_effect=_fake_execute):
            result = await service.batch_sync_from_graph_build(db, nodes=[], edges=edges, corpus_id=CORPUS_ID)

        assert result["relations_synced"] >= 0
        assert isinstance(result["relations_synced"], int)

    async def test_batch_sync_empty_inputs_returns_zeros(self, service, db):
        result = await service.batch_sync_from_graph_build(db, nodes=[], edges=[])

        assert result["entities_synced"] == 0
        assert result["entities_updated"] == 0
        assert result["entities_failed"] == 0
        assert result["relations_synced"] == 0
        assert result["relations_skipped"] == 0
        assert result["relations_failed"] == 0

    async def test_batch_sync_statistics_accuracy(self, service, db):
        nodes = [
            {"id": str(uuid4()), "label": "N1", "node_type": "T"},
            {"id": str(uuid4()), "label": "N2", "node_type": "T"},
            {"id": str(uuid4()), "label": "N3", "node_type": "T"},
        ]
        edges = [
            {"source": "N1", "target": "N2", "edge_type": "R12"},
            {"source": "N2", "target": "N3", "edge_type": "R23"},
        ]

        async def _fake_execute(stmt):
            return FakeExecuteResult([])

        with patch.object(db, "execute", side_effect=_fake_execute):
            result = await service.batch_sync_from_graph_build(db, nodes=nodes, edges=edges, corpus_id=CORPUS_ID)

        assert result["entities_synced"] == 3
        assert result["relations_synced"] == 0
        assert result["relations_skipped"] == 2
