"""
Graph Entity Service 单元测试

测试 KgEntityService 的实体列表、详情功能。
使用 mocked database session 以避免实际数据库操作。
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import pytest

from negentropy.knowledge.kg_entity_service import KgEntityService

_CORPUS_ID = UUID("00000000-0000-0000-0000-000000000001")


class TestGetTopEntities:
    """高频实体查询测试（已有功能回归）"""

    @pytest.fixture
    def service(self):
        return KgEntityService()

    @pytest.mark.asyncio
    async def test_get_top_entities_returns_list(self):
        """get_top_entities 应返回实体列表"""
        service = KgEntityService()
        mock_db = AsyncMock()

        mock_result = MagicMock()
        mock_result.all.return_value = [
            (uuid4(), "Alice", "person", 0.9, 5),
            (uuid4(), "OpenAI", "organization", 0.95, 3),
        ]
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await service.get_top_entities(
            mock_db,
            corpus_id=_CORPUS_ID,
            limit=10,
        )

        assert len(result) == 2
        assert result[0]["name"] == "Alice"
        assert result[1]["name"] == "OpenAI"


class TestGetEntityDetail:
    """实体详情测试"""

    @pytest.mark.asyncio
    async def test_get_entity_detail_not_found(self):
        """未找到实体应返回 None"""
        service = KgEntityService()
        mock_db = AsyncMock()

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=mock_result)

        detail = await service.get_entity_detail(
            mock_db,
            entity_id=uuid4(),
        )

        assert detail is None

    @pytest.mark.asyncio
    async def test_get_entity_detail_with_outgoing_relation(self):
        """应返回实体详情含出边关系"""
        service = KgEntityService()
        mock_db = AsyncMock()

        entity_id = uuid4()
        peer_id = uuid4()
        rel_id = uuid4()

        mock_peer = MagicMock()
        mock_peer.id = peer_id
        mock_peer.name = "Target Entity"
        mock_peer.entity_type = "concept"

        mock_rel = MagicMock()
        mock_rel.id = rel_id
        mock_rel.relation_type = "RELATED_TO"
        mock_rel.weight = 1.0
        mock_rel.confidence = 0.85
        mock_rel.evidence_text = "test evidence"
        mock_rel.target_entity = mock_peer

        mock_entity = MagicMock()
        mock_entity.id = entity_id
        mock_entity.name = "Test Entity"
        mock_entity.entity_type = "person"
        mock_entity.confidence = 0.9
        mock_entity.mention_count = 3
        mock_entity.description = "A test entity"
        mock_entity.aliases = None
        mock_entity.properties = {"key": "value"}
        mock_entity.is_active = True
        mock_entity.outgoing_relations = [mock_rel]
        mock_entity.incoming_relations = []

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_entity
        mock_db.execute = AsyncMock(return_value=mock_result)

        detail = await service.get_entity_detail(mock_db, entity_id=entity_id)

        assert detail is not None
        assert detail["name"] == "Test Entity"
        assert detail["entity_type"] == "person"
        assert len(detail["relations"]) == 1
        assert detail["relations"][0]["direction"] == "outgoing"
        assert detail["relations"][0]["relation_type"] == "RELATED_TO"
        assert detail["relations"][0]["peer_entity_name"] == "Target Entity"

    @pytest.mark.asyncio
    async def test_get_entity_detail_with_incoming_relation(self):
        """应正确映射入边关系"""
        service = KgEntityService()
        mock_db = AsyncMock()

        entity_id = uuid4()
        peer_id = uuid4()
        rel_id = uuid4()

        mock_peer = MagicMock()
        mock_peer.id = peer_id
        mock_peer.name = "Source Entity"
        mock_peer.entity_type = "organization"

        mock_rel = MagicMock()
        mock_rel.id = rel_id
        mock_rel.relation_type = "WORKS_FOR"
        mock_rel.weight = 0.9
        mock_rel.confidence = 0.8
        mock_rel.evidence_text = None
        mock_rel.source_entity = mock_peer

        mock_entity = MagicMock()
        mock_entity.id = entity_id
        mock_entity.name = "Alice"
        mock_entity.entity_type = "person"
        mock_entity.confidence = 0.95
        mock_entity.mention_count = 7
        mock_entity.description = None
        mock_entity.aliases = {"also_known_as": ["Ally"]}
        mock_entity.properties = {}
        mock_entity.is_active = True
        mock_entity.outgoing_relations = []
        mock_entity.incoming_relations = [mock_rel]

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_entity
        mock_db.execute = AsyncMock(return_value=mock_result)

        detail = await service.get_entity_detail(mock_db, entity_id=entity_id)

        assert detail is not None
        assert len(detail["relations"]) == 1
        assert detail["relations"][0]["direction"] == "incoming"
        assert detail["relations"][0]["relation_type"] == "WORKS_FOR"
        assert detail["relations"][0]["peer_entity_name"] == "Source Entity"


class TestBatchSyncFromGraphBuild:
    """批量同步测试"""

    @pytest.mark.asyncio
    async def test_batch_sync_counts(self):
        """batch_sync 应返回正确的同步计数"""
        service = KgEntityService()
        mock_db = AsyncMock()

        # sync_entity_from_knowledge and sync_relation just do db operations
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)))
        mock_db.flush = AsyncMock()
        mock_db.add = MagicMock()

        nodes = [
            {"id": str(uuid4()), "label": "Entity A", "node_type": "person", "confidence": 0.9},
            {"id": str(uuid4()), "label": "Entity B", "node_type": "org", "confidence": 0.8},
        ]
        edges = [
            {"source": "Entity A", "target": "Entity B", "edge_type": "WORKS_FOR", "weight": 1.0},
        ]

        result = await service.batch_sync_from_graph_build(
            mock_db,
            nodes=nodes,
            edges=edges,
            corpus_id=_CORPUS_ID,
        )

        assert result["entities_synced"] == 2
        assert result["relations_synced"] == 1


class TestSchemas:
    """Schema 验证测试"""

    def test_graph_entity_list_response_schema(self):
        """GraphEntityListResponse 应正确序列化"""
        from negentropy.knowledge.schemas import GraphEntityItem, GraphEntityListResponse

        item = GraphEntityItem(
            id=uuid4(),
            name="Test",
            entity_type="person",
            confidence=0.9,
            mention_count=5,
        )
        resp = GraphEntityListResponse(count=1, items=[item])
        assert resp.count == 1
        assert len(resp.items) == 1
        assert resp.items[0].name == "Test"

    def test_graph_entity_detail_response_schema(self):
        """GraphEntityDetailResponse 应正确序列化"""
        from negentropy.knowledge.schemas import GraphEntityDetailResponse

        resp = GraphEntityDetailResponse(
            id=uuid4(),
            name="Alice",
            entity_type="person",
            confidence=0.95,
            mention_count=10,
            relations=[],
        )
        assert resp.name == "Alice"
        assert resp.relations == []

    def test_graph_stats_response_schema(self):
        """GraphStatsResponse 应正确序列化"""
        from negentropy.knowledge.schemas import GraphStatsResponse

        resp = GraphStatsResponse(
            total_entities=100,
            edge_count=250,
            by_type={"person": 60, "organization": 40},
            avg_confidence=0.85,
            density=0.025,
            avg_degree=5.0,
        )
        assert resp.total_entities == 100
        assert resp.by_type["person"] == 60

    def test_graph_entity_relation_item_schema(self):
        """GraphEntityRelationItem 应正确序列化"""
        from negentropy.knowledge.schemas import GraphEntityRelationItem

        item = GraphEntityRelationItem(
            id=uuid4(),
            direction="outgoing",
            relation_type="WORKS_FOR",
            peer_entity_id=uuid4(),
            peer_entity_name="OpenAI",
            peer_entity_type="organization",
        )
        assert item.direction == "outgoing"
        assert item.peer_entity_name == "OpenAI"
