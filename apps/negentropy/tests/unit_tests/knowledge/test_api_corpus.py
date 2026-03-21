"""Corpus CRUD API 路由单元测试。

验证语料库创建与更新接口的序列化行为，包括分块策略字符串化、
后端默认提取器路由注入以及显式路由保留等场景。
"""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest

from negentropy.knowledge import api as knowledge_api
from negentropy.knowledge.types import ChunkingStrategy

from .conftest import FakeDefaultRouteSession, FakeKnowledgeService, FakeScalarSession


@pytest.mark.asyncio
async def test_create_corpus_serializes_chunking_strategy_to_string(monkeypatch):
    fake_service = FakeKnowledgeService()

    async def fake_default_routes():
        return {"url": {"targets": []}, "file_pdf": {"targets": []}}

    monkeypatch.setattr(knowledge_api, "_get_service", lambda: fake_service)
    monkeypatch.setattr(knowledge_api, "_resolve_default_extractor_routes", fake_default_routes)

    result = await knowledge_api.create_corpus(
        knowledge_api.CorpusCreateRequest(
            app_name="negentropy",
            name="docs",
            description="Knowledge base",
            config={
                "strategy": "hierarchical",
                "preserve_newlines": True,
                "separators": ["###"],
                "hierarchical_parent_chunk_size": 1500,
                "hierarchical_child_chunk_size": 500,
                "hierarchical_child_overlap": 150,
            },
        )
    )

    spec = fake_service.ensure_corpus_calls[0]
    assert spec.config["strategy"] == "hierarchical"
    assert isinstance(spec.config["strategy"], str)
    assert spec.config["separators"] == ["###"]


@pytest.mark.asyncio
async def test_create_corpus_injects_backend_default_extractor_routes(monkeypatch):
    fake_service = FakeKnowledgeService()
    server_id = uuid4()

    class FakeDefaultExtractorRoutes:
        def model_dump(self, mode="python"):
            _ = mode
            return {
                "url": {
                    "primary": {
                        "server_name": "Data Extractor",
                        "tool_name": "convert_webpage_to_markdown",
                    },
                    "secondary": {
                        "server_name": "Data Extractor",
                        "tool_name": "batch_convert_webpages_to_markdown",
                    },
                },
                "file_pdf": {
                    "primary": {
                        "server_name": "Data Extractor",
                        "tool_name": "convert_pdfs_to_markdown",
                    },
                    "secondary": {
                        "server_name": "Data Extractor",
                        "tool_name": "batch_convert_pdfs_to_markdown",
                    },
                },
            }

    monkeypatch.setattr(knowledge_api, "_get_service", lambda: fake_service)
    monkeypatch.setattr(
        knowledge_api,
        "settings",
        SimpleNamespace(
            knowledge=SimpleNamespace(
                default_extractor_routes=FakeDefaultExtractorRoutes(),
            )
        ),
    )
    monkeypatch.setattr(
        knowledge_api,
        "AsyncSessionLocal",
        lambda: FakeDefaultRouteSession(
            responses=[
                [(server_id, "Data Extractor")],
                [
                    (server_id, "convert_webpage_to_markdown"),
                    (server_id, "batch_convert_webpages_to_markdown"),
                    (server_id, "convert_pdfs_to_markdown"),
                    (server_id, "batch_convert_pdfs_to_markdown"),
                ],
            ]
        ),
    )

    result = await knowledge_api.create_corpus(
        knowledge_api.CorpusCreateRequest(
            app_name="negentropy",
            name="docs",
            config={},
        )
    )

    spec = fake_service.ensure_corpus_calls[0]
    assert spec.config["extractor_routes"] == {
        "url": {
            "targets": [
                {
                    "server_id": str(server_id),
                    "tool_name": "convert_webpage_to_markdown",
                    "priority": 0,
                    "enabled": True,
                },
                {
                    "server_id": str(server_id),
                    "tool_name": "batch_convert_webpages_to_markdown",
                    "priority": 1,
                    "enabled": True,
                },
            ]
        },
        "file_pdf": {
            "targets": [
                {
                    "server_id": str(server_id),
                    "tool_name": "convert_pdfs_to_markdown",
                    "priority": 0,
                    "enabled": True,
                },
                {
                    "server_id": str(server_id),
                    "tool_name": "batch_convert_pdfs_to_markdown",
                    "priority": 1,
                    "enabled": True,
                },
            ]
        },
    }
    assert result.config["extractor_routes"]["url"]["targets"][0]["tool_name"] == "convert_webpage_to_markdown"


@pytest.mark.asyncio
async def test_create_corpus_keeps_explicit_extractor_routes_without_backend_override(monkeypatch):
    fake_service = FakeKnowledgeService()
    explicit_routes = {
        "url": {
            "targets": [
                {
                    "server_id": "server-explicit",
                    "tool_name": "explicit_web",
                    "priority": 0,
                    "enabled": True,
                }
            ]
        },
        "file_pdf": {"targets": []},
    }

    async def should_not_resolve_defaults():
        pytest.fail("should not resolve backend defaults when extractor_routes already provided")

    monkeypatch.setattr(knowledge_api, "_get_service", lambda: fake_service)
    monkeypatch.setattr(knowledge_api, "_resolve_default_extractor_routes", should_not_resolve_defaults)

    await knowledge_api.create_corpus(
        knowledge_api.CorpusCreateRequest(
            app_name="negentropy",
            name="docs",
            config={
                "strategy": "recursive",
                "extractor_routes": explicit_routes,
            },
        )
    )

    spec = fake_service.ensure_corpus_calls[0]
    assert spec.config["extractor_routes"] == explicit_routes


@pytest.mark.asyncio
async def test_update_corpus_serializes_chunking_strategy_to_string(monkeypatch):
    corpus_id = uuid4()
    fake_service = FakeKnowledgeService()

    monkeypatch.setattr(knowledge_api, "_get_service", lambda: fake_service)
    monkeypatch.setattr(knowledge_api, "AsyncSessionLocal", lambda: FakeScalarSession())

    result = await knowledge_api.update_corpus(
        corpus_id=corpus_id,
        payload=knowledge_api.CorpusUpdateRequest(
            config={
                "strategy": "hierarchical",
                "preserve_newlines": True,
                "separators": ["###"],
                "hierarchical_parent_chunk_size": 1500,
                "hierarchical_child_chunk_size": 500,
                "hierarchical_child_overlap": 150,
            }
        ),
    )

    update_call = fake_service.update_corpus_calls[0]
    assert update_call["corpus_id"] == corpus_id
    assert update_call["spec"]["config"]["strategy"] == "hierarchical"
    assert isinstance(update_call["spec"]["config"]["strategy"], str)
    assert update_call["spec"]["config"]["separators"] == ["###"]
    assert result.config["strategy"] == "hierarchical"
