"""共享辅助工具：GraphService build_graph 测试的 Fake Repository 和 patch helper。"""

from __future__ import annotations

from contextlib import contextmanager
from unittest.mock import AsyncMock, MagicMock, patch

_CORPUS_ID = "00000000-0000-0000-0000-000000000001"


class FakeGraphRepository:
    """用于测试 build_graph 的 Fake Repository"""

    def __init__(self) -> None:
        self.create_build_run_kwargs = None
        self.update_build_run_kwargs = None

    async def create_build_run(self, **kwargs):
        self.create_build_run_kwargs = kwargs
        return "run-uuid"

    async def clear_graph(self, corpus_id):
        return None

    async def create_entities(self, entities, corpus_id):
        return []

    async def create_relations(self, relations):
        return None

    async def update_build_run(self, **kwargs):
        self.update_build_run_kwargs = kwargs
        return None

    async def find_similar_entities(self, **kwargs):
        return []


class PhaseTrackingFakeRepository:
    """记录 build_graph 期间所有 update_build_run 调用，便于断言 phase 切换序列。"""

    def __init__(self) -> None:
        self.update_calls: list[dict] = []

    async def create_build_run(self, **kwargs):
        return "run-uuid"

    async def clear_graph(self, corpus_id):
        return None

    async def create_entities(self, entities, corpus_id):
        return []

    async def create_relations(self, relations):
        return None

    async def update_build_run(self, **kwargs):
        self.update_calls.append(kwargs)
        return None

    async def find_similar_entities(self, **kwargs):
        return []


class FailingClearGraphRepository(PhaseTrackingFakeRepository):
    async def clear_graph(self, corpus_id):  # type: ignore[override]
        raise RuntimeError("simulated clear_graph failure")


class FailingCreateRelationsRepository(PhaseTrackingFakeRepository):
    async def create_relations(self, relations):  # type: ignore[override]
        raise RuntimeError("simulated create_relations failure")


def extract_phase_sequence(update_calls: list[dict]) -> list[str]:
    phases: list[str] = []
    for call in update_calls:
        warnings = call.get("warnings") or []
        for entry in warnings:
            if isinstance(entry, dict) and "_phase" in entry:
                meta = entry["_phase"]
                if isinstance(meta, dict) and "name" in meta:
                    phases.append(meta["name"])
    return phases


def make_fake_extractor_class(side_effect):
    class FakeExtractor:
        def __init__(self, *args, **kwargs):
            pass

        async def extract(self, *args, **kwargs):
            return await side_effect(*args, **kwargs)

    return FakeExtractor


@contextmanager
def patch_build_graph(repository):
    mock_session = AsyncMock()
    mock_session.in_transaction = MagicMock(return_value=False)
    mock_session.is_active = True
    with (
        patch("negentropy.db.session.AsyncSessionLocal", return_value=mock_session),
        patch("negentropy.knowledge.graph.repository.AgeGraphRepository", return_value=repository),
    ):
        yield
