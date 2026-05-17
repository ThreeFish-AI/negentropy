"""sync_entity_from_knowledge() 单元测试。"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from negentropy.knowledge.graph.entity_service import KgEntityService
from tests.unit_tests.knowledge.conftest import FakeEntityDbSession

from .conftest import CORPUS_ID, CORPUS_ID_B, KNOWLEDGE_ID, MockExecuteReturn, make_entity_ns


class TestSyncEntityFromKnowledge:
    @pytest.fixture
    def service(self) -> KgEntityService:
        return KgEntityService()

    @pytest.fixture
    def db(self) -> FakeEntityDbSession:
        return FakeEntityDbSession()

    async def test_sync_creates_new_entity(self, service, db):
        await service.sync_entity_from_knowledge(
            db,
            knowledge_id=KNOWLEDGE_ID,
            name="Alice",
            entity_type="PERSON",
            confidence=0.85,
            corpus_id=CORPUS_ID,
        )
        assert len(db.added) == 2
        entity = db.added[0]
        assert entity.name == "Alice"
        assert entity.entity_type == "PERSON"
        assert entity.confidence == pytest.approx(0.85)
        assert entity.mention_count == 1
        assert entity.corpus_id == CORPUS_ID
        mention = db.added[1]
        assert mention.knowledge_chunk_id is None

    async def test_sync_create_logs_with_non_reserved_extra_keys(self, service, db, monkeypatch):
        captured: dict[str, object] = {}

        def fake_info(event: str, *, extra: dict[str, object]) -> None:
            captured["event"] = event
            captured["extra"] = extra

        monkeypatch.setattr("negentropy.knowledge.graph.entity_service.logger.info", fake_info)

        await service.sync_entity_from_knowledge(
            db,
            knowledge_id=KNOWLEDGE_ID,
            name="Alice",
            entity_type="PERSON",
            confidence=0.85,
            corpus_id=CORPUS_ID,
        )

        assert captured["event"] == "kg_entity_created"
        assert captured["extra"]["entity_name"] == "Alice"
        assert "name" not in captured["extra"]

    async def test_sync_updates_existing_entity_confidence_upgrade(self, service, db):
        existing = make_entity_ns(name="Bob", confidence=0.5)
        db.entities.append(existing)

        with patch.object(db, "execute", new_callable=MockExecuteReturn, return_value=existing):
            await service.sync_entity_from_knowledge(
                db,
                knowledge_id=KNOWLEDGE_ID,
                name="Bob",
                entity_type="PERSON",
                confidence=0.9,
                corpus_id=CORPUS_ID,
            )

        assert existing.confidence == pytest.approx(0.9)

    async def test_sync_skips_confidence_downgrade(self, service, db):
        existing = make_entity_ns(name="Carol", confidence=0.9)
        db.entities.append(existing)

        with patch.object(db, "execute", new_callable=MockExecuteReturn, return_value=existing):
            await service.sync_entity_from_knowledge(
                db,
                knowledge_id=KNOWLEDGE_ID,
                name="Carol",
                entity_type="PERSON",
                confidence=0.3,
                corpus_id=CORPUS_ID,
            )

        assert existing.confidence == pytest.approx(0.9)

    async def test_sync_increments_mention_count_on_update(self, service, db):
        existing = make_entity_ns(name="Dave", mention_count=3)
        db.entities.append(existing)

        with patch.object(db, "execute", new_callable=MockExecuteReturn, return_value=existing):
            await service.sync_entity_from_knowledge(
                db,
                knowledge_id=KNOWLEDGE_ID,
                name="Dave",
                entity_type="PERSON",
                confidence=0.7,
                corpus_id=CORPUS_ID,
            )

        assert existing.mention_count == 4

    async def test_sync_update_logs_with_non_reserved_extra_keys(self, service, db, monkeypatch):
        existing = make_entity_ns(name="Dave", mention_count=3)
        db.entities.append(existing)
        captured: dict[str, object] = {}

        def fake_debug(event: str, *, extra: dict[str, object]) -> None:
            captured["event"] = event
            captured["extra"] = extra

        monkeypatch.setattr("negentropy.knowledge.graph.entity_service.logger.debug", fake_debug)

        with patch.object(db, "execute", new_callable=MockExecuteReturn, return_value=existing):
            await service.sync_entity_from_knowledge(
                db,
                knowledge_id=KNOWLEDGE_ID,
                name="Dave",
                entity_type="PERSON",
                confidence=0.7,
                corpus_id=CORPUS_ID,
            )

        assert captured["event"] == "kg_entity_updated"
        assert captured["extra"]["entity_name"] == "Dave"
        assert "name" not in captured["extra"]

    async def test_sync_merges_properties_metadata(self, service, db):
        existing = make_entity_ns(
            name="Eve",
            properties={"role": "engineer", "level": "senior"},
        )
        db.entities.append(existing)

        with patch.object(db, "execute", new_callable=MockExecuteReturn, return_value=existing):
            await service.sync_entity_from_knowledge(
                db,
                knowledge_id=KNOWLEDGE_ID,
                name="Eve",
                entity_type="PERSON",
                metadata={"level": "staff", "department": "AI"},
                corpus_id=CORPUS_ID,
            )

        assert existing.properties["role"] == "engineer"
        assert existing.properties["level"] == "staff"
        assert existing.properties["department"] == "AI"

    async def test_sync_updates_embedding_when_provided(self, service, db):
        existing = make_entity_ns(name="Frank", embedding=[0.1, 0.2])
        db.entities.append(existing)
        new_embedding = [0.3, 0.4, 0.5]

        with patch.object(db, "execute", new_callable=MockExecuteReturn, return_value=existing):
            await service.sync_entity_from_knowledge(
                db,
                knowledge_id=KNOWLEDGE_ID,
                name="Frank",
                entity_type="PERSON",
                embedding=new_embedding,
                corpus_id=CORPUS_ID,
            )

        assert existing.embedding == new_embedding

    async def test_sync_creates_mention_record(self, service, db):
        await service.sync_entity_from_knowledge(
            db,
            knowledge_id=KNOWLEDGE_ID,
            name="Grace",
            entity_type="ORG",
            corpus_id=CORPUS_ID,
        )
        assert len(db.added) >= 2
        mention = db.added[1]
        assert hasattr(mention, "knowledge_chunk_id")
        assert mention.knowledge_chunk_id is None
        assert hasattr(mention, "context_snippet")

    async def test_sync_with_corpus_id_filtering(self, service, db):
        corpus_a_entity = make_entity_ns(name="Hank", corpus_id=CORPUS_ID)
        db.entities.append(corpus_a_entity)

        with patch.object(db, "execute", new_callable=MockExecuteReturn, return_value=None):
            await service.sync_entity_from_knowledge(
                db,
                knowledge_id=KNOWLEDGE_ID,
                name="Hank",
                entity_type="PERSON",
                corpus_id=CORPUS_ID_B,
            )

        assert len(db.added) == 2
