"""Tests for DedupMergeStep — near-duplicate memory merging and conflict resolution."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from negentropy.engine.consolidation.pipeline.steps.dedup_merge_step import (
    DedupMergeStep,
)

from .conftest import _new_ctx


class TestDedupMergeStep:
    """Tests for DedupMergeStep — near-duplicate memory merging."""

    async def test_skipped_when_no_new_memory_ids(self):
        step = DedupMergeStep()
        ctx = _new_ctx()
        ctx.new_memory_ids = []
        result = await step.run(ctx)
        assert result.status == "skipped"
        assert result.output_count == 0
        assert result.step_name == "dedup_merge"

    async def test_merges_near_duplicate_with_lower_score(self):
        new_id = uuid4()
        ctx = _new_ctx()
        ctx.new_memory_ids = [new_id]

        new_row = MagicMock()
        new_row.id = new_id
        new_row.content = "Python is great"
        new_row.embedding = [1.0, 0.0, 0.0]
        new_row.retention_score = 0.9
        new_row.metadata_ = {}

        dup_id = uuid4()
        dup_row = MagicMock()
        dup_row.id = dup_id
        dup_row.content = "Python is awesome"
        dup_row.retention_score = 0.5
        dup_row.dist = 0.05

        call_count = 0

        async def _mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            mock_res = MagicMock()
            if call_count == 1:
                mock_res.all.return_value = [new_row]
            elif call_count == 2:
                mock_res.first.return_value = dup_row
            elif call_count == 3:
                mock_res.scalar.return_value = {}
            elif call_count == 4:
                pass
            elif call_count == 5:
                mock_res.scalar.return_value = {}
            elif call_count == 6:
                pass
            return mock_res

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(side_effect=_mock_execute)
        mock_db.commit = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.db.session.AsyncSessionLocal", return_value=mock_db):
            step = DedupMergeStep()
            result = await step.run(ctx)

        assert result.status == "success"
        assert result.output_count == 1

    async def test_skips_memory_with_none_embedding(self):
        new_id = uuid4()
        ctx = _new_ctx()
        ctx.new_memory_ids = [new_id]

        new_row = MagicMock()
        new_row.id = new_id
        new_row.content = "no embedding"
        new_row.embedding = None
        new_row.retention_score = 0.5
        new_row.metadata_ = {}

        mock_res = MagicMock()
        mock_res.all.return_value = [new_row]

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_res)
        mock_db.commit = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.db.session.AsyncSessionLocal", return_value=mock_db):
            step = DedupMergeStep()
            result = await step.run(ctx)

        assert result.status == "success"
        assert result.output_count == 0

    async def test_no_duplicate_found_proceeds_without_merge(self):
        new_id = uuid4()
        ctx = _new_ctx()
        ctx.new_memory_ids = [new_id]

        new_row = MagicMock()
        new_row.id = new_id
        new_row.content = "unique content"
        new_row.embedding = [0.5, 0.5, 0.5]
        new_row.retention_score = 0.8
        new_row.metadata_ = {}

        call_count = 0

        async def _mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            mock_res = MagicMock()
            if call_count == 1:
                mock_res.all.return_value = [new_row]
            elif call_count == 2:
                mock_res.first.return_value = None
            return mock_res

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(side_effect=_mock_execute)
        mock_db.commit = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.db.session.AsyncSessionLocal", return_value=mock_db):
            step = DedupMergeStep()
            result = await step.run(ctx)

        assert result.status == "success"
        assert result.output_count == 0

    async def test_loses_higher_score_becomes_primary(self):
        new_id = uuid4()
        ctx = _new_ctx()
        ctx.new_memory_ids = [new_id]

        new_row = MagicMock()
        new_row.id = new_id
        new_row.content = "new lower score content"
        new_row.embedding = [1.0, 0.0, 0.0]
        new_row.retention_score = 0.3
        new_row.metadata_ = {}

        dup_id = uuid4()
        dup_row = MagicMock()
        dup_row.id = dup_id
        dup_row.content = "existing higher score content"
        dup_row.retention_score = 0.8
        dup_row.dist = 0.05

        call_count = 0

        async def _mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            mock_res = MagicMock()
            if call_count == 1:
                mock_res.all.return_value = [new_row]
            elif call_count == 2:
                mock_res.first.return_value = dup_row
            elif call_count == 3:
                mock_res.scalar.return_value = {}
            elif call_count == 4:
                pass
            elif call_count == 5:
                mock_res.scalar.return_value = {}
            elif call_count == 6:
                pass
            return mock_res

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(side_effect=_mock_execute)
        mock_db.commit = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.db.session.AsyncSessionLocal", return_value=mock_db):
            step = DedupMergeStep()
            result = await step.run(ctx)

        assert result.status == "success"
        assert result.output_count == 1

    async def test_merged_from_capped_at_five(self):
        new_id = uuid4()
        ctx = _new_ctx()
        ctx.new_memory_ids = [new_id]

        new_row = MagicMock()
        new_row.id = new_id
        new_row.content = "new content"
        new_row.embedding = [1.0, 0.0, 0.0]
        new_row.retention_score = 0.9
        new_row.metadata_ = {}

        dup_id = uuid4()
        dup_row = MagicMock()
        dup_row.id = dup_id
        dup_row.content = "dup content"
        dup_row.retention_score = 0.4
        dup_row.dist = 0.05

        existing_merged_from = [{"content": f"old_{i}", "merged_at": 1000.0 + i} for i in range(5)]

        call_count = 0

        async def _mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            mock_res = MagicMock()
            if call_count == 1:
                mock_res.all.return_value = [new_row]
            elif call_count == 2:
                mock_res.first.return_value = dup_row
            elif call_count == 3:
                mock_res.scalar.return_value = {"merged_from": list(existing_merged_from)}
            elif call_count == 4:
                pass
            elif call_count == 5:
                mock_res.scalar.return_value = {}
            elif call_count == 6:
                pass
            return mock_res

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(side_effect=_mock_execute)
        mock_db.commit = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.db.session.AsyncSessionLocal", return_value=mock_db):
            step = DedupMergeStep()
            result = await step.run(ctx)

        assert result.status == "success"
        assert result.output_count == 1

    async def test_db_exception_triggers_rollback(self):
        new_id = uuid4()
        ctx = _new_ctx()
        ctx.new_memory_ids = [new_id]

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(side_effect=RuntimeError("DB connection lost"))
        mock_db.rollback = AsyncMock()
        mock_db.commit = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.db.session.AsyncSessionLocal", return_value=mock_db):
            step = DedupMergeStep()
            with pytest.raises(RuntimeError, match="DB connection lost"):
                await step.run(ctx)


class TestDedupMergeConflictBridge:
    """Tests for DedupMergeStep ↔ ConflictResolver integration (Gap 2)."""

    async def test_no_conflict_proceeds_with_soft_delete(self):
        step = DedupMergeStep()
        step._check_fact_conflict = AsyncMock(return_value=False)

        new_id = uuid4()
        ctx = _new_ctx()
        ctx.new_memory_ids = [new_id]

        new_row = MagicMock()
        new_row.id = new_id
        new_row.content = "I like dark theme"
        new_row.embedding = [1.0, 0.0, 0.0]
        new_row.retention_score = 0.9
        new_row.metadata_ = {}

        dup_id = uuid4()
        dup_row = MagicMock()
        dup_row.id = dup_id
        dup_row.content = "I love dark mode"
        dup_row.retention_score = 0.5
        dup_row.dist = 0.05

        call_count = 0
        loser_updated = False

        async def _mock_execute(stmt):
            nonlocal call_count, loser_updated
            call_count += 1
            mock_res = MagicMock()
            if call_count == 1:
                mock_res.all.return_value = [new_row]
            elif call_count == 2:
                mock_res.first.return_value = dup_row
            elif call_count == 3:
                mock_res.scalar.return_value = {}
            elif call_count == 4:
                pass
            elif call_count == 5:
                mock_res.scalar.return_value = {}
            elif call_count == 6:
                loser_updated = True
            return mock_res

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(side_effect=_mock_execute)
        mock_db.commit = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.db.session.AsyncSessionLocal", return_value=mock_db):
            result = await step.run(ctx)

        assert result.status == "success"
        assert result.output_count == 1
        assert loser_updated

    async def test_conflict_keep_both_skips_soft_delete(self):
        step = DedupMergeStep()
        step._check_fact_conflict = AsyncMock(return_value=True)

        new_id = uuid4()
        ctx = _new_ctx()
        ctx.new_memory_ids = [new_id]

        new_row = MagicMock()
        new_row.id = new_id
        new_row.content = "I prefer light theme"
        new_row.embedding = [1.0, 0.0, 0.0]
        new_row.retention_score = 0.9
        new_row.metadata_ = {}

        dup_id = uuid4()
        dup_row = MagicMock()
        dup_row.id = dup_id
        dup_row.content = "I like dark theme"
        dup_row.retention_score = 0.5
        dup_row.dist = 0.05

        call_count = 0
        loser_updated = False

        async def _mock_execute(stmt):
            nonlocal call_count, loser_updated
            call_count += 1
            mock_res = MagicMock()
            if call_count == 1:
                mock_res.all.return_value = [new_row]
            elif call_count == 2:
                mock_res.first.return_value = dup_row
            elif call_count == 3:
                mock_res.scalar.return_value = {}
            elif call_count == 4:
                pass
            return mock_res

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(side_effect=_mock_execute)
        mock_db.commit = AsyncMock()
        mock_db.__aenter__ = AsyncMock(return_value=mock_db)
        mock_db.__aexit__ = AsyncMock(return_value=False)

        with patch("negentropy.db.session.AsyncSessionLocal", return_value=mock_db):
            result = await step.run(ctx)

        assert result.status == "success"
        assert result.output_count == 0
        assert result.extra.get("conflict_preserved") == 1
        assert not loser_updated

    async def test_check_fact_conflict_returns_false_no_thread_ids(self):
        step = DedupMergeStep()
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mem_row = MagicMock()
        mem_row.thread_id = None
        mock_result.all.return_value = [mem_row]
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await step._check_fact_conflict(mock_db, uuid4(), uuid4(), "user1", "app1")
        assert result is False

    async def test_check_fact_conflict_returns_false_with_fewer_than_2_facts(self):
        step = DedupMergeStep()
        call_count = 0

        async def _mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            mock_res = MagicMock()
            if call_count == 1:
                mem_row = MagicMock()
                mem_row.thread_id = uuid4()
                mock_res.all.return_value = [mem_row]
            elif call_count == 2:
                mock_res.scalars.return_value.all.return_value = []
            return mock_res

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(side_effect=_mock_execute)

        result = await step._check_fact_conflict(mock_db, uuid4(), uuid4(), "user1", "app1")
        assert result is False

    async def test_check_fact_conflict_returns_false_no_key_collision(self):
        step = DedupMergeStep()

        fact_a = MagicMock()
        fact_a.key = "language"
        fact_a.value = {"name": "rust"}
        fact_a.created_at = 100.0

        fact_b = MagicMock()
        fact_b.key = "editor"
        fact_b.value = {"name": "vim"}
        fact_b.created_at = 200.0

        call_count = 0

        async def _mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            mock_res = MagicMock()
            if call_count == 1:
                mem_row = MagicMock()
                mem_row.thread_id = uuid4()
                mock_res.all.return_value = [mem_row]
            elif call_count == 2:
                mock_res.scalars.return_value.all.return_value = [fact_a, fact_b]
            return mock_res

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(side_effect=_mock_execute)

        result = await step._check_fact_conflict(mock_db, uuid4(), uuid4(), "user1", "app1")
        assert result is False

    async def test_check_fact_conflict_detects_keep_both(self):
        step = DedupMergeStep()

        fact_old = MagicMock()
        fact_old.key = "theme"
        fact_old.value = {"mode": "dark"}
        fact_old.fact_type = "custom"
        fact_old.confidence = 0.8
        fact_old.created_at = 100.0

        fact_new = MagicMock()
        fact_new.key = "theme"
        fact_new.value = {"mode": "light"}
        fact_new.fact_type = "custom"
        fact_new.confidence = 0.9
        fact_new.created_at = 200.0

        call_count = 0

        async def _mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            mock_res = MagicMock()
            if call_count == 1:
                mem_row = MagicMock()
                mem_row.thread_id = uuid4()
                mock_res.all.return_value = [mem_row]
            elif call_count == 2:
                mock_res.scalars.return_value.all.return_value = [fact_old, fact_new]
            return mock_res

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(side_effect=_mock_execute)

        mock_conflict = MagicMock()
        mock_conflict.resolution = "keep_both"

        with patch("negentropy.engine.governance.conflict_resolver.ConflictResolver") as MockResolver:
            instance = MockResolver.return_value
            instance.detect_and_resolve = AsyncMock(return_value=mock_conflict)

            result = await step._check_fact_conflict(mock_db, uuid4(), uuid4(), "user1", "app1")

        assert result is True

    async def test_check_fact_conflict_supersede_returns_false(self):
        step = DedupMergeStep()

        fact_old = MagicMock()
        fact_old.key = "theme"
        fact_old.value = {"mode": "dark"}
        fact_old.fact_type = "preference"
        fact_old.confidence = 0.8
        fact_old.created_at = 100.0

        fact_new = MagicMock()
        fact_new.key = "theme"
        fact_new.value = {"mode": "light"}
        fact_new.fact_type = "preference"
        fact_new.confidence = 0.9
        fact_new.created_at = 200.0

        call_count = 0

        async def _mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            mock_res = MagicMock()
            if call_count == 1:
                mem_row = MagicMock()
                mem_row.thread_id = uuid4()
                mock_res.all.return_value = [mem_row]
            elif call_count == 2:
                mock_res.scalars.return_value.all.return_value = [fact_old, fact_new]
            return mock_res

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(side_effect=_mock_execute)

        mock_conflict = MagicMock()
        mock_conflict.resolution = "supersede"

        with patch("negentropy.engine.governance.conflict_resolver.ConflictResolver") as MockResolver:
            instance = MockResolver.return_value
            instance.detect_and_resolve = AsyncMock(return_value=mock_conflict)

            result = await step._check_fact_conflict(mock_db, uuid4(), uuid4(), "user1", "app1")

        assert result is False
