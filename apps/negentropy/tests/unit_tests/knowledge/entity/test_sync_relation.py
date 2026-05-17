"""sync_relation() 单元测试。"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from negentropy.knowledge.graph.entity_service import KgEntityService
from tests.unit_tests.knowledge.conftest import FakeEntityDbSession

from .conftest import CORPUS_ID, FakeExecuteResult, make_entity_ns, make_relation_ns


class TestSyncRelation:
    @pytest.fixture
    def service(self) -> KgEntityService:
        return KgEntityService()

    @pytest.fixture
    def db(self) -> FakeEntityDbSession:
        return FakeEntityDbSession()

    async def test_sync_relation_creates_new_relation(self, service, db):
        src = make_entity_ns(name="Alice")
        tgt = make_entity_ns(name="Bob")
        db.entities.extend([src, tgt])

        call_count = [0]

        async def _fake_execute(stmt):
            stmt_str = str(stmt).lower()
            if "kg_relation" in stmt_str:
                return FakeExecuteResult([])
            call_count[0] += 1
            if call_count[0] % 2 == 1:
                return FakeExecuteResult([src])
            else:
                return FakeExecuteResult([tgt])

        with patch.object(db, "execute", side_effect=_fake_execute):
            await service.sync_relation(
                db,
                source_name="Alice",
                target_name="Bob",
                relation_type="WORKS_FOR",
                weight=2.0,
                evidence_text="Alice works for Bob Inc.",
                corpus_id=CORPUS_ID,
            )

        assert len(db.added) == 1
        rel = db.added[0]
        assert rel.relation_type == "WORKS_FOR"
        assert rel.weight == pytest.approx(2.0)
        assert rel.evidence_text == "Alice works for Bob Inc."

    async def test_sync_relation_skips_when_source_missing(self, service, db):
        tgt = make_entity_ns(name="Bob")
        db.entities.append(tgt)

        call_count = [0]

        async def _fake_execute(stmt):
            stmt_str = str(stmt).lower()
            if "kg_relation" in stmt_str:
                return FakeExecuteResult([])
            call_count[0] += 1
            if call_count[0] == 1:
                return FakeExecuteResult([])
            return FakeExecuteResult([tgt])

        with patch.object(db, "execute", side_effect=_fake_execute):
            await service.sync_relation(
                db,
                source_name="GhostSource",
                target_name="Bob",
                relation_type="KNOWS",
                corpus_id=CORPUS_ID,
            )

        assert len(db.added) == 0

    async def test_sync_relation_skips_when_target_missing(self, service, db):
        src = make_entity_ns(name="Alice")
        db.entities.append(src)

        call_count = [0]

        async def _fake_execute(stmt):
            stmt_str = str(stmt).lower()
            if "kg_relation" in stmt_str:
                return FakeExecuteResult([])
            call_count[0] += 1
            if call_count[0] == 1:
                return FakeExecuteResult([src])
            return FakeExecuteResult([])

        with patch.object(db, "execute", side_effect=_fake_execute):
            await service.sync_relation(
                db,
                source_name="Alice",
                target_name="GhostTarget",
                relation_type="KNOWS",
                corpus_id=CORPUS_ID,
            )

        assert len(db.added) == 0

    async def test_sync_relation_idempotent(self, service, db):
        src = make_entity_ns(name="Alice")
        tgt = make_entity_ns(name="Bob")
        existing_rel = make_relation_ns(source_id=src.id, target_id=tgt.id, relation_type="WORKS_FOR")
        db.entities.extend([src, tgt])
        db.relations.append(existing_rel)

        call_count = [0]

        async def _fake_execute(stmt):
            stmt_str = str(stmt).lower()
            if "kg_relation" in stmt_str:
                return FakeExecuteResult([existing_rel])
            call_count[0] += 1
            if call_count[0] % 2 == 1:
                return FakeExecuteResult([src])
            return FakeExecuteResult([tgt])

        with patch.object(db, "execute", side_effect=_fake_execute):
            await service.sync_relation(
                db,
                source_name="Alice",
                target_name="Bob",
                relation_type="WORKS_FOR",
                corpus_id=CORPUS_ID,
            )

        assert len(db.added) == 0

    async def test_sync_relation_with_evidence_text(self, service, db):
        src = make_entity_ns(name="Alice")
        tgt = make_entity_ns(name="Charlie")
        db.entities.extend([src, tgt])

        evidence = "Published joint paper on NLP in 2024"

        call_count = [0]

        async def _fake_execute(stmt):
            stmt_str = str(stmt).lower()
            if "kg_relation" in stmt_str:
                return FakeExecuteResult([])
            call_count[0] += 1
            if call_count[0] % 2 == 1:
                return FakeExecuteResult([src])
            return FakeExecuteResult([tgt])

        with patch.object(db, "execute", side_effect=_fake_execute):
            await service.sync_relation(
                db,
                source_name="Alice",
                target_name="Charlie",
                relation_type="CO_AUTHOR",
                evidence_text=evidence,
                corpus_id=CORPUS_ID,
            )

        assert len(db.added) == 1
        assert db.added[0].evidence_text == evidence

    async def test_sync_relation_weight_persistence(self, service, db):
        src = make_entity_ns(name="Alice")
        tgt = make_entity_ns(name="Diana")
        db.entities.extend([src, tgt])

        call_count = [0]

        async def _fake_execute(stmt):
            stmt_str = str(stmt).lower()
            if "kg_relation" in stmt_str:
                return FakeExecuteResult([])
            call_count[0] += 1
            if call_count[0] % 2 == 1:
                return FakeExecuteResult([src])
            return FakeExecuteResult([tgt])

        with patch.object(db, "execute", side_effect=_fake_execute):
            await service.sync_relation(
                db,
                source_name="Alice",
                target_name="Diana",
                relation_type="MANAGES",
                weight=5.5,
                corpus_id=CORPUS_ID,
            )

        assert len(db.added) == 1
        assert db.added[0].weight == pytest.approx(5.5)
