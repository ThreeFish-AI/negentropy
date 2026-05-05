"""P2-3 · G2 单测：Citation 规范化 + KG 反向推荐工具的核心契约。

不连数据库，不实际启动 GraphService —— mock 边界即可。验证：
- _format_citation 在含 arxiv_id / 仅 title / 仅 source_uri / 完全缺失四种 metadata
  形态下的输出格式（保证旧消息零回归）；
- search_knowledge_graph_with_papers 在 corpus 不存在 / 实体为空 / 异常路径下的降级语义。
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ----------------------------------------------------------------------------
# _format_citation：四种 metadata 形态
# ----------------------------------------------------------------------------


def test_format_citation_full_arxiv_metadata():
    """完整 arxiv 元数据 → IEEE 风格 ``[N] {Author} et al., "{Title}," arXiv:{ID}, {Year}.``"""
    from negentropy.agents.tools.perception import _format_citation

    citation = _format_citation(
        metadata={
            "arxiv_id": "2310.11511",
            "title": "Self-RAG: Learning to Retrieve, Generate, and Critique",
            "authors": ["Akari Asai", "Zeqiu Wu", "Yizhong Wang"],
            "published_at": "2024-01-15T08:30:00Z",
        },
        source_uri="https://arxiv.org/pdf/2310.11511.pdf",
        idx=1,
    )
    assert citation.startswith("[1] Akari Asai et al.,")
    assert "Self-RAG" in citation
    assert "arXiv:2310.11511" in citation
    assert "2024" in citation


def test_format_citation_minimal_arxiv_no_authors():
    """没 authors 仍能输出（不出现 'None et al.' 之类畸形字符串）。"""
    from negentropy.agents.tools.perception import _format_citation

    citation = _format_citation(
        metadata={"arxiv_id": "2404.16130", "title": "GraphRAG"},
        source_uri="https://arxiv.org/pdf/2404.16130.pdf",
        idx=2,
    )
    assert citation.startswith("[2]")
    assert "et al." not in citation  # 无作者时不应出现 et al.
    assert "arXiv:2404.16130" in citation


def test_format_citation_legacy_no_arxiv_with_title_only():
    """旧消息无 arxiv_id 但有 title → 用 title + source_uri 兜底，不抛异常。"""
    from negentropy.agents.tools.perception import _format_citation

    citation = _format_citation(
        metadata={"title": "Legacy Document"},
        source_uri="https://example.com/doc.pdf",
        idx=3,
    )
    assert citation.startswith("[3]")
    assert "Legacy Document" in citation
    assert "example.com" in citation


def test_format_citation_legacy_no_metadata_no_uri():
    """完全空 → ``[N] Unknown source`` 兜底，不抛异常（确保 search 结果 100% 有 citation）。"""
    from negentropy.agents.tools.perception import _format_citation

    citation = _format_citation(metadata=None, source_uri=None, idx=4)
    assert citation == "[4] Unknown source"


def test_format_citation_handles_malformed_authors_field():
    """authors 字段不是 list 时（比如脏数据 = "Alice"）也不应抛。"""
    from negentropy.agents.tools.perception import _format_citation

    citation = _format_citation(
        metadata={
            "arxiv_id": "2501.12345",
            "title": "Test",
            "authors": "Alice Smith",  # 错误类型
        },
        source_uri=None,
        idx=5,
    )
    assert "[5]" in citation
    assert "arXiv:2501.12345" in citation
    # 错误类型 authors 应被忽略：不应出现 "Alice Smith et al."
    assert "Alice Smith et al." not in citation


def test_format_citation_handles_malformed_published_at():
    """published_at 不是 ISO 时间戳时（如 "unknown"）也不抛，只是 year 字段为空。"""
    from negentropy.agents.tools.perception import _format_citation

    citation = _format_citation(
        metadata={
            "arxiv_id": "2501.12345",
            "title": "Test",
            "published_at": "unknown",
        },
        source_uri=None,
        idx=6,
    )
    assert "[6]" in citation
    # 不应包含 "unknown" 字面量
    assert "unknown" not in citation


# ----------------------------------------------------------------------------
# search_knowledge_graph_with_papers：异常路径 fail-soft 契约
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_search_knowledge_graph_rejects_empty_query():
    """空 query 立即返回 graph_error，不发起任何 DB / KG 操作。"""
    from negentropy.agents.tools.perception import search_knowledge_graph_with_papers

    ctx = MagicMock()
    result = await search_knowledge_graph_with_papers(query="", top_k=5, tool_context=ctx)
    assert result["status"] == "failed"
    assert result["kg_status"] == "graph_error"


@pytest.mark.asyncio
async def test_search_knowledge_graph_returns_graph_empty_when_no_corpus():
    """``agent-papers`` Corpus 不存在时（典型新装环境）返回 graph_empty + fallback 提示。"""
    from negentropy.agents.tools import perception as perception_module

    fake_session = MagicMock()
    fake_session.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: None))

    fake_session_cm = MagicMock()
    fake_session_cm.__aenter__ = AsyncMock(return_value=fake_session)
    fake_session_cm.__aexit__ = AsyncMock(return_value=False)

    with patch.object(perception_module.db_session, "AsyncSessionLocal", return_value=fake_session_cm):
        ctx = MagicMock()
        result = await perception_module.search_knowledge_graph_with_papers(
            query="Reflexion 自我反思", top_k=5, tool_context=ctx
        )

    assert result["status"] == "success"
    assert result["kg_status"] == "graph_empty"
    assert result["papers"] == []
    assert "fallback_hint" in result


@pytest.mark.asyncio
async def test_search_knowledge_graph_fail_soft_on_unexpected_exception():
    """任何 unexpected exception 都降级为 graph_error，绝不向上抛 —— LLM 可平滑 fallback。"""
    from negentropy.agents.tools import perception as perception_module

    fake_session_cm = MagicMock()
    fake_session_cm.__aenter__ = AsyncMock(side_effect=RuntimeError("simulated DB failure"))
    fake_session_cm.__aexit__ = AsyncMock(return_value=False)

    with patch.object(perception_module.db_session, "AsyncSessionLocal", return_value=fake_session_cm):
        ctx = MagicMock()
        result = await perception_module.search_knowledge_graph_with_papers(
            query="Transformer", top_k=5, tool_context=ctx
        )

    assert result["status"] == "success"  # fail-soft：不让 LLM 看到 status=failed
    assert result["kg_status"] == "graph_error"
    assert result["papers"] == []
    assert "RuntimeError" in result["fallback_hint"]


# ----------------------------------------------------------------------------
# search_knowledge_base 注入 citation_id + formatted_citation 字段
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_search_knowledge_base_injects_citation_fields():
    """正常命中路径必须为每条 result 注入 citation_id + formatted_citation。"""
    from negentropy.agents.tools import perception as perception_module

    # mock corpus 列表查询
    fake_corpus = MagicMock(id="corpus-uuid", name="agent-papers")
    fake_session = MagicMock()
    fake_session.execute = AsyncMock(return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: [fake_corpus])))
    fake_session_cm = MagicMock()
    fake_session_cm.__aenter__ = AsyncMock(return_value=fake_session)
    fake_session_cm.__aexit__ = AsyncMock(return_value=False)

    # mock KnowledgeService.search 返回 2 条 KnowledgeMatch 风格记录
    match_1 = MagicMock(
        id="k-1",
        content="Reflexion uses self-reflection to iteratively improve.",
        source_uri="https://arxiv.org/pdf/2303.11366.pdf",
        metadata={
            "arxiv_id": "2303.11366",
            "title": "Reflexion",
            "authors": ["Noah Shinn"],
            "published_at": "2023-10-01T00:00:00Z",
        },
        semantic_score=0.85,
        keyword_score=0.72,
        combined_score=0.81,
    )
    match_2 = MagicMock(
        id="k-2",
        content="LATS combines tree search with LLM reasoning.",
        source_uri="https://arxiv.org/pdf/2310.04406.pdf",
        metadata={
            "arxiv_id": "2310.04406",
            "title": "LATS",
            "authors": ["Andy Zhou"],
            "published_at": "2024-06-01T00:00:00Z",
        },
        semantic_score=0.78,
        keyword_score=0.69,
        combined_score=0.75,
    )

    fake_service = MagicMock()
    fake_service.search = AsyncMock(return_value=[match_1, match_2])

    with (
        patch.object(perception_module.db_session, "AsyncSessionLocal", return_value=fake_session_cm),
        patch.object(perception_module, "_get_knowledge_service", return_value=fake_service),
    ):
        ctx = MagicMock()
        result = await perception_module.search_knowledge_base(query="self-reflection", top_k=10, tool_context=ctx)

    assert result["status"] == "success"
    assert result["count"] == 2
    # 按 combined_score 降序：match_1 应排第 1
    first = result["results"][0]
    assert first["citation_id"] == 1
    assert first["formatted_citation"].startswith("[1]")
    assert "Reflexion" in first["formatted_citation"]
    assert "arXiv:2303.11366" in first["formatted_citation"]

    second = result["results"][1]
    assert second["citation_id"] == 2
    assert "[2]" in second["formatted_citation"]
    assert "arXiv:2310.04406" in second["formatted_citation"]
