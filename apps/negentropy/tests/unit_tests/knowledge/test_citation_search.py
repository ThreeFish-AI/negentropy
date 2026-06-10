"""knowledge/retrieval/citation_search 共享检索核心单测（mock 边界，不连真实数据）。

覆盖：
- ``search_kb_with_citations``：多 corpus 聚合 / 单库失败容错 / 排序截断 /
  citation 按最终顺序注入 / snippet 截断；
- ``resolve_corpus_scope``：名称 + UUID 混合过滤、无过滤透传；
- ``kg_global_search_with_citations``：全部失败 → status=failed 降级。

注：``format_citation`` 的四形态契约已由
``tests/unit_tests/agents/test_perception_citation.py`` 经 re-export 路径覆盖，
此处仅补充 import 源头的别名一致性断言，避免双份维护。
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from negentropy.knowledge.retrieval import citation_search


def test_format_citation_is_single_source_of_truth():
    """perception 工具的 _format_citation 必须是本模块 format_citation 的别名。"""
    from negentropy.agents.tools.perception import _format_citation

    assert _format_citation is citation_search.format_citation


def test_resolve_corpus_label():
    assert citation_search.resolve_corpus_label("agent-papers", "id-1") == "agent-papers"
    assert citation_search.resolve_corpus_label(None, "a1b2c3d4-rest") == "corpus:a1b2c3d4"
    assert citation_search.resolve_corpus_label(None, None) == "unknown"


def _make_match(*, mid: str, content: str, score: float, source_uri: str | None = None) -> MagicMock:
    return MagicMock(
        id=mid,
        content=content,
        source_uri=source_uri,
        metadata={},
        semantic_score=score,
        keyword_score=score,
        combined_score=score,
    )


def _make_corpus(cid, name: str) -> MagicMock:
    # NB: ``name`` 是 MagicMock 的保留构造参数，必须事后赋值。
    corpus = MagicMock(id=cid)
    corpus.name = name
    return corpus


@pytest.mark.asyncio
async def test_search_kb_with_citations_aggregates_sorts_and_injects():
    """多 corpus 聚合 → 按 combined_score 降序 → citation 按最终顺序注入。"""
    corpus_a = _make_corpus("corpus-a", "corpus-alpha")
    corpus_b = _make_corpus("corpus-b", "corpus-beta")

    service = MagicMock()
    service.search = AsyncMock(
        side_effect=[
            [_make_match(mid="m-low", content="low score", score=0.3)],
            [_make_match(mid="m-high", content="high score", score=0.9, source_uri="https://x.example/doc")],
        ]
    )

    payload = await citation_search.search_kb_with_citations(
        query="q",
        top_k=10,
        service=service,
        corpora=[corpus_a, corpus_b],
        app_name="negentropy",
    )

    assert payload["status"] == "success"
    assert payload["count"] == 2
    # 降序：m-high 第 1
    assert payload["results"][0]["id"] == "m-high"
    assert payload["results"][0]["citation_id"] == 1
    assert payload["results"][0]["formatted_citation"].startswith("[1]")
    assert payload["results"][0]["corpus_label"] == "corpus-beta"
    assert payload["results"][1]["id"] == "m-low"
    assert payload["results"][1]["citation_id"] == 2


@pytest.mark.asyncio
async def test_search_kb_with_citations_tolerates_single_corpus_failure():
    """单 corpus 检索异常不中断其他 corpus。"""
    corpus_bad = _make_corpus("corpus-bad", "bad")
    corpus_ok = _make_corpus("corpus-ok", "ok")

    service = MagicMock()
    service.search = AsyncMock(
        side_effect=[
            RuntimeError("simulated corpus failure"),
            [_make_match(mid="m-1", content="survives", score=0.5)],
        ]
    )

    payload = await citation_search.search_kb_with_citations(
        query="q",
        top_k=5,
        service=service,
        corpora=[corpus_bad, corpus_ok],
        app_name="negentropy",
    )

    assert payload["count"] == 1
    assert payload["results"][0]["id"] == "m-1"


@pytest.mark.asyncio
async def test_search_kb_with_citations_truncates_snippet_and_limits():
    """snippet 截断至 MAX_SNIPPET_CHARS；top_k 钳制到 MAX_RESULTS_LIMIT。"""
    corpus = _make_corpus("c", "c")
    long_content = "x" * (citation_search.MAX_SNIPPET_CHARS + 100)

    matches = [_make_match(mid=f"m-{i}", content=long_content, score=1.0 - i * 0.01) for i in range(30)]
    service = MagicMock()
    service.search = AsyncMock(return_value=matches)

    payload = await citation_search.search_kb_with_citations(
        query="q",
        top_k=999,  # 超限：应钳制到 MAX_RESULTS_LIMIT
        service=service,
        corpora=[corpus],
        app_name="negentropy",
    )

    assert payload["count"] == citation_search.MAX_RESULTS_LIMIT
    first = payload["results"][0]
    assert len(first["snippet"]) == citation_search.MAX_SNIPPET_CHARS
    assert first["truncated"] is True


@pytest.mark.asyncio
async def test_search_kb_with_citations_empty_results_no_fallback():
    """count=0 时本层不做 fallback（策略归调用方）。"""
    corpus = _make_corpus("c", "c")
    service = MagicMock()
    service.search = AsyncMock(return_value=[])

    payload = await citation_search.search_kb_with_citations(
        query="q", top_k=5, service=service, corpora=[corpus], app_name="negentropy"
    )
    assert payload["status"] == "success"
    assert payload["count"] == 0
    assert payload["results"] == []


def _session_cm_returning(corpora: list) -> MagicMock:
    fake_session = MagicMock()
    fake_session.execute = AsyncMock(return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: corpora)))
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=fake_session)
    cm.__aexit__ = AsyncMock(return_value=False)
    return cm


@pytest.mark.asyncio
async def test_resolve_corpus_scope_filters_by_name_and_uuid():
    """名称与 UUID 混合过滤；不在 filter 集的 corpus 被剔除。"""
    uid = uuid.uuid4()
    c1 = _make_corpus(uid, "agent-papers")
    c2 = _make_corpus(uuid.uuid4(), "design-docs")
    c3 = _make_corpus(uuid.uuid4(), "misc")

    with patch.object(
        citation_search.db_session, "AsyncSessionLocal", return_value=_session_cm_returning([c1, c2, c3])
    ):
        # 按 UUID 命中 c1，按名称命中 c2
        result = await citation_search.resolve_corpus_scope(app_name="negentropy", filters=[str(uid), "design-docs"])

    assert {c.name for c in result} == {"agent-papers", "design-docs"}


@pytest.mark.asyncio
async def test_resolve_corpus_scope_no_filter_returns_all():
    c1 = _make_corpus(uuid.uuid4(), "a")
    c2 = _make_corpus(uuid.uuid4(), "b")

    with patch.object(citation_search.db_session, "AsyncSessionLocal", return_value=_session_cm_returning([c1, c2])):
        result = await citation_search.resolve_corpus_scope(app_name="negentropy", filters=None)

    assert len(result) == 2


@pytest.mark.asyncio
async def test_kg_global_search_all_corpus_failures_degrade_to_failed():
    """全部 per-corpus 失败 → status=failed + per_corpus 保留失败明细。"""
    cid = uuid.uuid4()

    fake_svc = MagicMock()
    fake_svc.search = AsyncMock(side_effect=RuntimeError("graph down"))

    with (
        patch.object(citation_search.db_session, "AsyncSessionLocal", return_value=_session_cm_returning([])),
        patch("negentropy.knowledge.graph.global_search.GlobalSearchService", return_value=fake_svc),
        patch(
            "negentropy.knowledge.ingestion.embedding.build_embedding_fn",
            side_effect=RuntimeError("no embedding"),
        ),
    ):
        payload = await citation_search.kg_global_search_with_citations(
            query="主题概览",
            corpus_ids=[cid],
            app_name="negentropy",
        )

    assert payload["status"] == "failed"
    assert payload["corpus_count"] == 1
    assert payload["per_corpus"][0]["status"] == "failed"
    assert "graph down" in payload["per_corpus"][0]["error"]
