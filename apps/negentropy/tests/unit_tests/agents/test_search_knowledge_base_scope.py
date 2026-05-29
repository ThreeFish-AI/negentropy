"""单测：``search_knowledge_base`` 按 ``tool_context.state.corpus_ids`` 限定检索范围。

业务背景：Home Composer 通过 ``@Corpus`` 选中若干语料库后，前端将其 UUID 列表
经 ``forwardedProps.corpus_ids`` → BFF ``state_delta`` → ADK session.state
透传到 perception tool。命中时，``Corpus`` 查询追加 ``id IN (...)`` 过滤，仅在
指定语料库内检索（KB+KG hybrid 由 HybridPlanner 自主决策图扩展）；未命中时
保持原"全 Corpus 聚合"行为。

不连真实 DB / 不实际启动 KnowledgeService —— mock 边界即可。
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest


def _make_corpus(corpus_id: str, name: str) -> MagicMock:
    c = MagicMock()
    c.id = corpus_id
    c.name = name
    return c


def _make_session_cm(corpora: list[MagicMock]) -> tuple[MagicMock, MagicMock]:
    """构造 ``AsyncSessionLocal()`` 返回的上下文管理器；返回 (cm, session) 以便断言。"""
    fake_session = MagicMock()
    fake_session.execute = AsyncMock(return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: corpora)))
    fake_cm = MagicMock()
    fake_cm.__aenter__ = AsyncMock(return_value=fake_session)
    fake_cm.__aexit__ = AsyncMock(return_value=False)
    return fake_cm, fake_session


def _make_match(corpus_id: str) -> MagicMock:
    m = MagicMock(
        id=f"k-{corpus_id[:4]}",
        content="snippet",
        source_uri=f"file://{corpus_id}",
        metadata={"title": "T"},
        semantic_score=0.5,
        keyword_score=0.5,
        combined_score=0.5,
    )
    return m


# ----------------------------------------------------------------------------
# corpus_ids 命中：仅在 IN 子集内检索
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_corpus_ids_appends_in_clause_and_limits_search():
    """state.corpus_ids = [uuid_a] → SQL 含 IN (uuid_a)，service.search 仅调用一次。"""
    from negentropy.agents.tools import perception as perception_module

    uuid_a, uuid_b = str(uuid4()), str(uuid4())
    # 模拟 DB 已过滤为 1 个（uuid_a），uuid_b 不在结果中
    corpus_a = _make_corpus(uuid_a, "Corpus-A")
    cm, session = _make_session_cm([corpus_a])

    fake_service = MagicMock()
    fake_service.search = AsyncMock(return_value=[_make_match(uuid_a)])

    ctx = MagicMock()
    ctx.state = {"corpus_ids": [uuid_a]}

    with (
        patch.object(perception_module.db_session, "AsyncSessionLocal", return_value=cm),
        patch.object(perception_module, "_get_knowledge_service", return_value=fake_service),
    ):
        result = await perception_module.search_knowledge_base(query="entropy", top_k=5, tool_context=ctx)

    # SQL 含 IN 子句（避免误退化为无 scope 的全 corpus 查询）
    stmt_str = str(session.execute.call_args.args[0]).lower()
    assert " in (" in stmt_str

    # service.search 只在过滤后的单个 corpus 上调用
    assert fake_service.search.call_count == 1
    called_corpus_id = fake_service.search.call_args.kwargs["corpus_id"]
    assert called_corpus_id == uuid_a

    assert result["status"] == "success"
    assert result["count"] == 1
    # uuid_b 不出现在结果中
    assert all(uuid_b not in r["source_uri"] for r in result["results"])


# ----------------------------------------------------------------------------
# corpus_ids 未命中：保持原"全 Corpus 聚合"行为
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_no_scope_falls_back_to_aggregate_search_across_all_corpora():
    """state 不含 corpus_ids → SQL 不含 IN 子句，service.search 对每个 corpus 各调一次。"""
    from negentropy.agents.tools import perception as perception_module

    uuid_a, uuid_b = str(uuid4()), str(uuid4())
    corpora = [_make_corpus(uuid_a, "A"), _make_corpus(uuid_b, "B")]
    cm, session = _make_session_cm(corpora)

    fake_service = MagicMock()
    fake_service.search = AsyncMock(side_effect=lambda **kw: [_make_match(str(kw["corpus_id"]))])

    ctx = MagicMock()
    ctx.state = {}  # 无 corpus_ids

    with (
        patch.object(perception_module.db_session, "AsyncSessionLocal", return_value=cm),
        patch.object(perception_module, "_get_knowledge_service", return_value=fake_service),
    ):
        result = await perception_module.search_knowledge_base(query="entropy", top_k=5, tool_context=ctx)

    stmt_str = str(session.execute.call_args.args[0]).lower()
    assert " in (" not in stmt_str  # 无 scope 时不追加 IN 子句

    assert fake_service.search.call_count == 2
    assert result["status"] == "success"
    assert result["count"] == 2


# ----------------------------------------------------------------------------
# 非法/空 scope 防御性处理
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_empty_scope_list_treated_as_no_scope():
    """state.corpus_ids = [] → 视作未指定，不追加 IN 子句。"""
    from negentropy.agents.tools import perception as perception_module

    uuid_a = str(uuid4())
    cm, session = _make_session_cm([_make_corpus(uuid_a, "A")])
    fake_service = MagicMock()
    fake_service.search = AsyncMock(return_value=[_make_match(uuid_a)])

    ctx = MagicMock()
    ctx.state = {"corpus_ids": []}

    with (
        patch.object(perception_module.db_session, "AsyncSessionLocal", return_value=cm),
        patch.object(perception_module, "_get_knowledge_service", return_value=fake_service),
    ):
        await perception_module.search_knowledge_base(query="q", top_k=3, tool_context=ctx)

    stmt_str = str(session.execute.call_args.args[0]).lower()
    assert " in (" not in stmt_str


@pytest.mark.asyncio
async def test_scope_with_non_string_entries_filtered_out():
    """state.corpus_ids 含 None/int 等异类条目 → 过滤后若仍非空仍走 IN。"""
    from negentropy.agents.tools import perception as perception_module

    uuid_a = str(uuid4())
    cm, session = _make_session_cm([_make_corpus(uuid_a, "A")])
    fake_service = MagicMock()
    fake_service.search = AsyncMock(return_value=[_make_match(uuid_a)])

    ctx = MagicMock()
    ctx.state = {"corpus_ids": [uuid_a, None, 123, ""]}

    with (
        patch.object(perception_module.db_session, "AsyncSessionLocal", return_value=cm),
        patch.object(perception_module, "_get_knowledge_service", return_value=fake_service),
    ):
        await perception_module.search_knowledge_base(query="q", top_k=3, tool_context=ctx)

    stmt_str = str(session.execute.call_args.args[0]).lower()
    assert " in (" in stmt_str  # 仍有合法条目 uuid_a，应追加 IN


@pytest.mark.asyncio
async def test_scope_hits_nonexistent_corpus_returns_memory_fallback():
    """scope 指向不存在的 corpus → DB 返回空 → 走 memory fallback（与 no_corpora 同路径）。"""
    from negentropy.agents.tools import perception as perception_module

    cm, _ = _make_session_cm([])  # DB 过滤后为空

    ctx = MagicMock()
    ctx.state = {"corpus_ids": [str(uuid4())]}
    # search_memory 缺席 → fallback 返回 count=0
    if hasattr(ctx, "search_memory"):
        del ctx.search_memory

    with patch.object(perception_module.db_session, "AsyncSessionLocal", return_value=cm):
        result = await perception_module.search_knowledge_base(query="q", top_k=3, tool_context=ctx)

    # 不抛异常，降级到 memory_fallback
    assert result["status"] == "success"
    assert result["search_mode"] == "memory_fallback"


# ----------------------------------------------------------------------------
# tool_context 缺失 / state 为 None：防御性兜底
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_tool_context_without_state_does_not_raise():
    """tool_context.state 为 None / 缺失 → 视作未指定 scope，不抛异常。"""
    from negentropy.agents.tools import perception as perception_module

    uuid_a = str(uuid4())
    cm, session = _make_session_cm([_make_corpus(uuid_a, "A")])
    fake_service = MagicMock()
    fake_service.search = AsyncMock(return_value=[_make_match(uuid_a)])

    ctx = MagicMock()
    ctx.state = None

    with (
        patch.object(perception_module.db_session, "AsyncSessionLocal", return_value=cm),
        patch.object(perception_module, "_get_knowledge_service", return_value=fake_service),
    ):
        result = await perception_module.search_knowledge_base(query="q", top_k=3, tool_context=ctx)

    stmt_str = str(session.execute.call_args.args[0]).lower()
    assert " in (" not in stmt_str
    assert result["status"] == "success"
