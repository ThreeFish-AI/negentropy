"""Tests for HippoRAG PPR search + RRF fusion (Phase 5 F1)."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest


class TestRRFFuse:
    def test_both_channels_doc_ranks_higher(self):
        """同时出现在两个通道的文档 RRF 分数应高于单通道独占。"""
        from negentropy.engine.adapters.postgres.memory_service import (
            PostgresMemoryService,
        )

        result = PostgresMemoryService._rrf_fuse(
            channels={
                "hybrid": [
                    {"id": "m1", "content": "a"},
                    {"id": "m2", "content": "b"},
                ],
                "ppr": [
                    {"id": "m2", "content": "b"},
                    {"id": "m3", "content": "c"},
                ],
            },
            k=60,
            limit=10,
        )
        ids = [r["id"] for r in result]
        # m2 在两通道都出现，应排第一
        assert ids[0] == "m2"
        assert "m1" in ids and "m3" in ids

    def test_metadata_fusion_records_channel_ranks(self):
        from negentropy.engine.adapters.postgres.memory_service import (
            PostgresMemoryService,
        )

        result = PostgresMemoryService._rrf_fuse(
            channels={
                "hybrid": [{"id": "m1"}, {"id": "m2"}],
                "ppr": [{"id": "m2"}, {"id": "m3"}],
            },
            k=60,
            limit=10,
        )
        m2 = next(r for r in result if r["id"] == "m2")
        assert m2["metadata"]["fusion"]["channels"] == {"hybrid": 2, "ppr": 1}
        assert m2["metadata"]["fusion"]["rrf_k"] == 60
        assert m2["search_level"] == "ppr+hybrid"

    def test_search_level_single_channel(self):
        from negentropy.engine.adapters.postgres.memory_service import (
            PostgresMemoryService,
        )

        result = PostgresMemoryService._rrf_fuse(
            channels={
                "hybrid": [{"id": "m1", "search_level": "hybrid"}],
                "ppr": [{"id": "m2", "search_level": "ppr"}],
            },
            k=60,
            limit=10,
        )
        for r in result:
            # 单通道时保留原 search_level（不强制改为 ppr+hybrid）
            assert r["search_level"] in ("hybrid", "ppr")

    def test_limit_truncation(self):
        from negentropy.engine.adapters.postgres.memory_service import (
            PostgresMemoryService,
        )

        result = PostgresMemoryService._rrf_fuse(
            channels={
                "hybrid": [{"id": f"m{i}"} for i in range(10)],
                "ppr": [{"id": f"m{i}"} for i in range(10, 20)],
            },
            k=60,
            limit=5,
        )
        assert len(result) == 5

    def test_empty_channels(self):
        from negentropy.engine.adapters.postgres.memory_service import (
            PostgresMemoryService,
        )

        result = PostgresMemoryService._rrf_fuse(channels={}, k=60, limit=10)
        assert result == []


class TestExpandViaPPR:
    @pytest.fixture
    def fake_db(self):
        with patch("negentropy.engine.adapters.postgres.association_service.db_session") as mock_session:
            session = AsyncMock()
            mock_session.AsyncSessionLocal.return_value.__aenter__ = AsyncMock(return_value=session)
            mock_session.AsyncSessionLocal.return_value.__aexit__ = AsyncMock(return_value=False)
            yield session

    async def test_empty_seeds_returns_empty(self, fake_db):
        from negentropy.engine.adapters.postgres.association_service import (
            AssociationService,
        )

        service = AssociationService()
        out = await service.expand_via_ppr(seeds=[], depth=2, alpha=0.5, top_k=10)
        assert out == {}

    async def test_seed_self_score_one(self, fake_db):
        """无邻居时种子节点应仍以 score=1.0 返回。"""
        from negentropy.engine.adapters.postgres.association_service import (
            AssociationService,
        )

        # mock execute 返回空 edges
        empty_result = MagicMock()
        empty_result.fetchall = MagicMock(return_value=[])
        fake_db.execute = AsyncMock(return_value=empty_result)

        seed_id = uuid4()
        service = AssociationService()
        out = await service.expand_via_ppr(seeds=[seed_id], depth=2, alpha=0.5, top_k=10)
        assert str(seed_id) in out
        assert out[str(seed_id)] == 1.0

    async def test_one_hop_diffusion(self, fake_db):
        """一跳邻居获得 alpha * weight 分数；归一化后 ≤ 1。"""
        from negentropy.engine.adapters.postgres.association_service import (
            AssociationService,
        )

        seed_id = uuid4()
        target_id = uuid4()

        edges_row = MagicMock()
        edges_row.src = str(seed_id)
        edges_row.tgt = str(target_id)
        edges_row.w = 1.0
        edges_first = MagicMock()
        edges_first.fetchall = MagicMock(return_value=[edges_row])
        # 第二跳无新边
        edges_second = MagicMock()
        edges_second.fetchall = MagicMock(return_value=[])
        fake_db.execute = AsyncMock(side_effect=[edges_first, edges_second])

        service = AssociationService()
        out = await service.expand_via_ppr(seeds=[seed_id], depth=2, alpha=0.5, top_k=10)
        assert str(seed_id) in out
        assert str(target_id) in out
        # seed 归一化后还是 1.0；target = 0.5 / 1.0 = 0.5
        assert out[str(seed_id)] == 1.0
        assert 0.4 < out[str(target_id)] < 0.6

    async def test_top_k_caps_output(self, fake_db):
        from negentropy.engine.adapters.postgres.association_service import (
            AssociationService,
        )

        seed_id = uuid4()
        target_ids = [uuid4() for _ in range(10)]
        rows = []
        for t in target_ids:
            r = MagicMock()
            r.src = str(seed_id)
            r.tgt = str(t)
            r.w = 0.8
            rows.append(r)
        first = MagicMock()
        first.fetchall = MagicMock(return_value=rows)
        second = MagicMock()
        second.fetchall = MagicMock(return_value=[])
        fake_db.execute = AsyncMock(side_effect=[first, second])

        service = AssociationService()
        out = await service.expand_via_ppr(seeds=[seed_id], depth=2, alpha=0.5, top_k=3)
        assert len(out) == 3


class TestMaybeFusePPRGate:
    @pytest.fixture
    def memory_service(self):
        from negentropy.engine.adapters.postgres.memory_service import (
            PostgresMemoryService,
        )

        return PostgresMemoryService(embedding_fn=None)

    def _settings(self, *, enabled: bool, gray_users=None, min_kg=100):
        from types import SimpleNamespace

        return SimpleNamespace(
            memory=SimpleNamespace(
                hipporag=SimpleNamespace(
                    enabled=enabled,
                    gray_users=gray_users or [],
                    min_kg_associations=min_kg,
                    timeout_ms=120,
                    rrf_k=60,
                    depth=2,
                    alpha=0.5,
                    seed_top_k=5,
                    seed_threshold=0.75,
                )
            )
        )

    async def test_disabled_returns_hybrid_unchanged(self, memory_service):
        hybrid = [{"id": "m1"}]
        with patch.dict(
            "sys.modules",
            {"negentropy.config": MagicMock(settings=self._settings(enabled=False))},
        ):
            result = await memory_service._maybe_fuse_ppr(
                hybrid_results=hybrid,
                query="x",
                query_embedding=[0.1] * 4,
                user_id="u",
                app_name="a",
                limit=5,
            )
        assert result == hybrid

    async def test_user_not_in_gray_list_returns_hybrid(self, memory_service):
        hybrid = [{"id": "m1"}]
        with patch.dict(
            "sys.modules",
            {"negentropy.config": MagicMock(settings=self._settings(enabled=True, gray_users=["alice"]))},
        ):
            result = await memory_service._maybe_fuse_ppr(
                hybrid_results=hybrid,
                query="x",
                query_embedding=[0.1] * 4,
                user_id="bob",
                app_name="a",
                limit=5,
            )
        assert result == hybrid

    async def test_kg_too_few_returns_hybrid(self, memory_service):
        hybrid = [{"id": "m1"}]
        fake_assoc = MagicMock()
        fake_assoc.count_kg_associations = AsyncMock(return_value=10)

        with (
            patch.dict(
                "sys.modules",
                {"negentropy.config": MagicMock(settings=self._settings(enabled=True, min_kg=100))},
            ),
            patch(
                "negentropy.engine.factories.memory.get_association_service",
                return_value=fake_assoc,
            ),
        ):
            result = await memory_service._maybe_fuse_ppr(
                hybrid_results=hybrid,
                query="x",
                query_embedding=[0.1] * 4,
                user_id="u",
                app_name="a",
                limit=5,
            )
        assert result == hybrid

    async def test_full_path_calls_ppr_search(self, memory_service):
        hybrid = [{"id": "m1"}, {"id": "m2"}]
        fake_assoc = MagicMock()
        fake_assoc.count_kg_associations = AsyncMock(return_value=200)

        async def fake_ppr_search(**kwargs):
            return [
                {"id": "m2", "content": "b", "metadata": {}, "memory_type": "episodic", "relevance_score": 0.5},
                {"id": "m3", "content": "c", "metadata": {}, "memory_type": "episodic", "relevance_score": 0.4},
            ]

        with (
            patch.dict(
                "sys.modules",
                {"negentropy.config": MagicMock(settings=self._settings(enabled=True, min_kg=100))},
            ),
            patch(
                "negentropy.engine.factories.memory.get_association_service",
                return_value=fake_assoc,
            ),
            patch.object(memory_service, "_ppr_search", side_effect=fake_ppr_search),
        ):
            result = await memory_service._maybe_fuse_ppr(
                hybrid_results=hybrid,
                query="x",
                query_embedding=[0.1] * 4,
                user_id="u",
                app_name="a",
                limit=5,
            )
        # 融合后 m2 应排第一（两通道都出现）
        assert result[0]["id"] == "m2"
        assert {r["id"] for r in result} == {"m1", "m2", "m3"}
