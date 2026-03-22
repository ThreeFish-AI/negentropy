from __future__ import annotations

from uuid import uuid4

import pytest

from negentropy.knowledge.graph_service import GraphBuildConfig, GraphService


class _FakeGraphRepository:
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


@pytest.mark.asyncio
async def test_build_graph_persists_canonical_model_name():
    repository = _FakeGraphRepository()
    service = GraphService(repository=repository, config=GraphBuildConfig(llm_model="glm-5"))

    result = await service.build_graph(
        corpus_id=uuid4(),
        app_name="test-app",
        chunks=[],
    )

    assert result.status == "completed"
    assert repository.create_build_run_kwargs["model_name"] == "zai/glm-5"
    assert repository.create_build_run_kwargs["extractor_config"]["llm_model"] == "zai/glm-5"
