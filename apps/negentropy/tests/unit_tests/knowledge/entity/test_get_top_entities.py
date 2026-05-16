"""get_top_entities() 单元测试。"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from negentropy.knowledge.graph.entity_service import KgEntityService
from tests.unit_tests.knowledge.conftest import FakeEntityDbSession

from .conftest import CORPUS_ID, FakeSelectResult, make_entity_ns


class TestGetTopEntities:
    @pytest.fixture
    def service(self) -> KgEntityService:
        return KgEntityService()

    @pytest.fixture
    def db(self) -> FakeEntityDbSession:
        session = FakeEntityDbSession()
        session.entities = [
            make_entity_ns(name="HighMention", mention_count=100),
            make_entity_ns(name="MidMention", mention_count=50),
            make_entity_ns(name="LowMention", mention_count=10),
            make_entity_ns(name="ZeroMention", mention_count=0),
        ]
        return session

    async def test_get_top_entities_returns_ordered_list(self, service, db):
        async def _fake_execute(stmt):
            rows = [(e.id, e.name, e.entity_type, e.confidence or 0, e.mention_count, None) for e in db.entities]
            return FakeSelectResult(rows)

        with patch.object(db, "execute", side_effect=_fake_execute):
            results = await service.get_top_entities(db, limit=10)

        names = [r["name"] for r in results]
        counts = [r["mention_count"] for r in results]

        assert counts == sorted(counts, reverse=True)
        assert names[0] == "HighMention"

    async def test_get_top_entities_with_corpus_filter(self, service, db):
        filter_called = False

        async def _fake_execute(stmt):
            nonlocal filter_called
            stmt_str = str(stmt)
            if "corpus_id" in stmt_str:
                filter_called = True
            return FakeSelectResult([])

        with patch.object(db, "execute", side_effect=_fake_execute):
            await service.get_top_entities(db, corpus_id=CORPUS_ID, limit=5)

        assert filter_called is True

    async def test_get_top_entities_with_type_filter(self, service, db):
        filter_called = False

        async def _fake_execute(stmt):
            nonlocal filter_called
            stmt_str = str(stmt)
            if "entity_type" in stmt_str:
                filter_called = True
            return FakeSelectResult([])

        with patch.object(db, "execute", side_effect=_fake_execute):
            await service.get_top_entities(db, entity_type="PERSON", limit=5)

        assert filter_called is True

    async def test_get_top_entities_respects_limit(self, service, db):
        returned_rows = []

        async def _fake_execute(stmt):
            rows = [(e.id, e.name, e.entity_type, e.confidence or 0, e.mention_count, None) for e in db.entities[:2]]
            returned_rows.extend(rows)
            return FakeSelectResult(rows)

        with patch.object(db, "execute", side_effect=_fake_execute):
            results = await service.get_top_entities(db, limit=2)

        assert len(results) <= 2
