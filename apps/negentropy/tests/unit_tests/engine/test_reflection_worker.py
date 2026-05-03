"""Tests for ReflectionWorker (Phase 5 F2)."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from negentropy.engine.consolidation.reflection_generator import Reflection
from negentropy.engine.consolidation.reflection_worker import ReflectionWorker
from negentropy.engine.governance.reflection_dedup import DedupVerdict


def _make_log_record(query: str = "deploy steps") -> dict:
    return {
        "user_id": "alice",
        "app_name": "negentropy",
        "thread_id": None,
        "query": query,
        "retrieved_memory_ids": [uuid4()],
    }


@pytest.fixture
def worker_factory():
    def _factory(
        *,
        log_record=None,
        snippets=None,
        verdict=None,
        reflection=None,
        embed_fn=None,
        write_id="mem-id-1",
    ):
        gen = MagicMock()
        gen.generate = AsyncMock(return_value=reflection)
        dedup = MagicMock()
        dedup.should_skip = AsyncMock(return_value=verdict or DedupVerdict(skip=False, reason=None))

        memory_service = MagicMock()
        memory_service._embedding_fn = embed_fn
        memory_service.add_memory_typed = AsyncMock(return_value={"id": write_id})

        worker = ReflectionWorker(generator=gen, dedup=dedup, memory_service=memory_service)

        async def _fetch_log(self, log_id):
            return log_record

        async def _fetch_snippets(self, ids):
            return snippets or []

        async def _boost(self, *, memory_id):
            return None

        worker._fetch_log = _fetch_log.__get__(worker, ReflectionWorker)  # type: ignore
        worker._fetch_snippets = _fetch_snippets.__get__(worker, ReflectionWorker)  # type: ignore
        worker._boost_importance = _boost.__get__(worker, ReflectionWorker)  # type: ignore
        return worker, gen, dedup, memory_service

    return _factory


class TestReflectionWorker:
    async def test_log_missing_returns_none(self, worker_factory):
        worker, *_ = worker_factory(log_record=None)
        result = await worker.process(log_id=uuid4(), outcome="harmful")
        assert result is None

    async def test_empty_query_skipped(self, worker_factory):
        rec = _make_log_record(query="")
        worker, *_ = worker_factory(log_record=rec)
        result = await worker.process(log_id=uuid4(), outcome="harmful")
        assert result == {"status": "skipped", "reason": "empty_query", "memory_id": None}

    async def test_dedup_skipped(self, worker_factory):
        rec = _make_log_record()
        worker, gen, dedup, memory_service = worker_factory(
            log_record=rec,
            snippets=["x"],
            verdict=DedupVerdict(skip=True, reason="hash_hit"),
        )
        result = await worker.process(log_id=uuid4(), outcome="harmful")
        assert result["status"] == "skipped"
        assert result["reason"] == "hash_hit"
        gen.generate.assert_not_called()
        memory_service.add_memory_typed.assert_not_called()

    async def test_generation_failed(self, worker_factory):
        rec = _make_log_record()
        worker, gen, dedup, memory_service = worker_factory(
            log_record=rec,
            snippets=["x"],
            reflection=None,
        )
        result = await worker.process(log_id=uuid4(), outcome="harmful")
        assert result["status"] == "skipped"
        assert result["reason"] == "generation_failed"
        memory_service.add_memory_typed.assert_not_called()

    async def test_full_path_writes_memory(self, worker_factory):
        rec = _make_log_record()
        ref = Reflection(
            lesson="避免在『部署』中召回 init.d",
            applicable_when=["deploy"],
            anti_examples=["旧版 init.d"],
            method="llm",
        )
        worker, gen, dedup, memory_service = worker_factory(
            log_record=rec, snippets=["init.d snippet"], reflection=ref, write_id="mid-1"
        )
        result = await worker.process(log_id=uuid4(), outcome="harmful")
        assert result == {"status": "written", "reason": "llm", "memory_id": "mid-1"}
        memory_service.add_memory_typed.assert_awaited_once()
        kwargs = memory_service.add_memory_typed.await_args.kwargs
        assert kwargs["memory_type"] == "episodic"
        assert kwargs["metadata"]["subtype"] == "reflection"
        assert kwargs["metadata"]["outcome"] == "harmful"
        assert kwargs["metadata"]["method"] == "llm"
        assert kwargs["metadata"]["query_hash"]
        assert kwargs["metadata"]["applicable_when"] == ["deploy"]

    async def test_write_failure_returns_skipped(self, worker_factory):
        rec = _make_log_record()
        ref = Reflection(lesson="lesson", applicable_when=[], anti_examples=[], method="pattern")
        worker, gen, dedup, memory_service = worker_factory(log_record=rec, snippets=["snip"], reflection=ref)
        memory_service.add_memory_typed = AsyncMock(side_effect=RuntimeError("db down"))
        result = await worker.process(log_id=uuid4(), outcome="irrelevant")
        assert result["status"] == "skipped"
        assert result["reason"] == "write_failed"
