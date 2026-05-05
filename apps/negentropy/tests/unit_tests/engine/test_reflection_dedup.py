"""Tests for ReflectionDedup (Phase 5 F2)."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from negentropy.engine.governance.reflection_dedup import (
    DedupVerdict,
    ReflectionDedup,
    hash_query,
    normalize_query,
)


class TestNormalize:
    def test_lowercase_and_trim(self):
        assert normalize_query("  Hello  WORLD  ") == "hello world"

    def test_nfkc_full_width(self):
        # Full-width letters should fold to ASCII
        assert normalize_query("ＡＢＣ") == "abc"

    def test_empty(self):
        assert normalize_query("") == ""
        assert normalize_query("   ") == ""

    def test_hash_query_stable_and_short(self):
        h1 = hash_query("Deploy guide")
        h2 = hash_query("  deploy GUIDE  ")
        assert h1 == h2
        assert len(h1) == 32  # 16 bytes hex


@pytest.fixture
def fake_db():
    """Patch db_session 让计数 / 命中行为可被 mock。"""
    with patch("negentropy.engine.governance.reflection_dedup.db_session") as mock_session:
        session = AsyncMock()
        mock_session.AsyncSessionLocal.return_value.__aenter__ = AsyncMock(return_value=session)
        mock_session.AsyncSessionLocal.return_value.__aexit__ = AsyncMock(return_value=False)
        yield session


class TestReflectionDedup:
    async def test_empty_query_skipped(self, fake_db):
        dedup = ReflectionDedup()
        verdict = await dedup.should_skip(user_id="u", app_name="a", query="")
        assert verdict.skip is True
        assert verdict.reason == "empty_query"

    async def test_daily_limit_skips(self, fake_db):
        # Mock count_today_reflections 返回 10
        scalar = AsyncMock()
        scalar.scalar_one = MagicMock(return_value=10)
        fake_db.execute = AsyncMock(return_value=scalar)

        dedup = ReflectionDedup(daily_limit=10)
        verdict = await dedup.should_skip(user_id="u", app_name="a", query="hello")
        assert verdict.skip is True
        assert verdict.reason == "daily_limit"

    async def test_hash_hit_skips(self, fake_db):
        # 第一次（count）返回 0，第二次（hash hit）返回 1
        count_result = MagicMock()
        count_result.scalar_one = MagicMock(return_value=0)
        hash_result = MagicMock()
        hash_result.scalar = MagicMock(return_value=1)
        fake_db.execute = AsyncMock(side_effect=[count_result, hash_result])

        dedup = ReflectionDedup()
        verdict = await dedup.should_skip(user_id="u", app_name="a", query="deploy guide")
        assert verdict.skip is True
        assert verdict.reason == "hash_hit"

    async def test_no_hit_proceeds(self, fake_db):
        # 全部未命中
        count_result = MagicMock()
        count_result.scalar_one = MagicMock(return_value=0)
        hash_result = MagicMock()
        hash_result.scalar = MagicMock(return_value=None)
        fake_db.execute = AsyncMock(side_effect=[count_result, hash_result])

        dedup = ReflectionDedup()
        verdict = await dedup.should_skip(user_id="u", app_name="a", query="brand new query")
        assert verdict.skip is False
        assert verdict.reason is None

    async def test_cluster_hit_skips_when_embedding_present(self, fake_db):
        count_result = MagicMock()
        count_result.scalar_one = MagicMock(return_value=0)
        hash_result = MagicMock()
        hash_result.scalar = MagicMock(return_value=None)
        cluster_result = MagicMock()
        cluster_result.scalar = MagicMock(return_value=1)
        fake_db.execute = AsyncMock(side_effect=[count_result, hash_result, cluster_result])

        dedup = ReflectionDedup()
        verdict = await dedup.should_skip(
            user_id="u",
            app_name="a",
            query="deploy guide v2",
            query_embedding=[0.1, 0.2, 0.3],
        )
        assert verdict.skip is True
        assert verdict.reason == "cluster_hit"

    def test_dedup_verdict_dataclass(self):
        v = DedupVerdict(skip=True, reason="hash_hit")
        assert v.skip is True
        assert v.reason == "hash_hit"
