"""KG Build 管线七项级联缺陷修复回归用例

参考 issue.md ISSUE-027~033，每项缺陷一条 UT，独立运行不依赖真实 DB / LiteLLM。

References:
    [1] V. A. Traag et al., "From Louvain to Leiden," *Sci. Rep.*, 2019.
    [2] D. Edge et al., "From local to global: A graph RAG approach," 2024.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest

from negentropy.knowledge.graph import graph_algorithms

_CORPUS_ID = UUID("00000000-0000-0000-0000-0000000000aa")


# =====================================================================
# 缺陷 #1：PageRank UPDATE SQL — UUID 类型转换
# =====================================================================


def _entity_row(eid: str, name: str = "Entity"):
    row = MagicMock()
    row.id = eid
    row.name = name
    return row


def _relation_row(src: str, tgt: str, weight: float = 1.0):
    row = MagicMock()
    row.source_id = src
    row.target_id = tgt
    row.weight = weight
    return row


@pytest.mark.asyncio
async def test_pagerank_update_uses_explicit_uuid_cast():
    """PageRank UPDATE SQL 应使用 `CAST(:eid AS uuid)` 显式转换，
    避免 PostgreSQL 报 `syntax error at or near "uuid"`（ISSUE-027）。
    """
    db = AsyncMock()
    db.commit = AsyncMock()
    captured_sqls: list[str] = []

    entities_result = MagicMock()
    entities_result.__iter__ = MagicMock(return_value=iter([_entity_row("e1", "A"), _entity_row("e2", "B")]))
    relations_result = MagicMock()
    relations_result.__iter__ = MagicMock(return_value=iter([_relation_row("e1", "e2")]))

    async def _execute(stmt, params=None):
        captured_sqls.append(str(stmt))
        # 前两次为 entities / relations SELECT
        if "kg_entities" in str(stmt) and "SELECT" in str(stmt).upper():
            return entities_result
        if "kg_relations" in str(stmt):
            return relations_result
        # UPDATE 返回 mock
        return MagicMock()

    db.execute = AsyncMock(side_effect=_execute)

    with patch("networkx.pagerank", return_value={"e1": 0.6, "e2": 0.4}):
        await graph_algorithms.compute_pagerank(db, _CORPUS_ID)

    # 验证至少有一条 UPDATE 语句，并且 SQL 包含 CAST(:eid_? AS uuid) / CAST(:cid AS uuid)
    update_sqls = [s for s in captured_sqls if "UPDATE" in s.upper() and "importance_score" in s]
    assert update_sqls, "应该至少触发一条 importance_score UPDATE"
    sql = update_sqls[0]
    assert "CAST(:eid_0 AS uuid)" in sql, "占位符必须显式 CAST AS uuid"
    assert "CAST(:score_0 AS double precision)" in sql, "score 占位符必须显式 CAST AS double precision"
    assert "CAST(:cid AS uuid)" in sql, "corpus_id 占位符必须显式 CAST AS uuid"
    # 反向断言：原 bug 的 `AS v(eid uuid, score float)` 应不再出现
    assert "v(eid uuid" not in sql
    assert "v(eid, score)" in sql


# =====================================================================
# 缺陷 #2：Leiden 直连 igraph + leidenalg
# =====================================================================


def test_run_leiden_uses_leidenalg_not_networkx_dispatch():
    """_run_leiden 应经由 leidenalg.find_partition 而非 nx.community.leiden_communities
    （ISSUE-028）。
    """
    import networkx as nx

    G = nx.Graph()
    G.add_edge("a", "b", weight=1.0)
    G.add_edge("b", "c", weight=1.0)
    G.add_edge("c", "a", weight=1.0)
    G.add_edge("d", "e", weight=1.0)

    # nx.community.leiden_communities 不应被调用 → mock 之 raise
    with patch(
        "networkx.community.leiden_communities",
        side_effect=AssertionError("不应调用 NetworkX dispatch wrapper"),
    ):
        if not graph_algorithms._LEIDEN_AVAILABLE:
            pytest.skip("leidenalg / igraph 未安装")
        partition = graph_algorithms._run_leiden(G, resolution=1.0, seed=42)

    # 应识别出 2 个独立子图
    assert len(partition) >= 2
    # 每个节点恰属于一个社区
    flat = {n for cluster in partition for n in cluster}
    assert flat == {"a", "b", "c", "d", "e"}


# =====================================================================
# 缺陷 #3：call_llm_with_retry 注入 drop_params + extra_kwargs
# =====================================================================


@pytest.mark.asyncio
async def test_call_llm_with_retry_sets_global_drop_params():
    """call_llm_with_retry 调用应幂等设置 litellm.drop_params = True（ISSUE-029）。"""
    import litellm

    from negentropy.knowledge.graph.extractors import call_llm_with_retry

    # 重置全局开关，验证函数会主动设置
    original = getattr(litellm, "drop_params", False)
    try:
        litellm.drop_params = False
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content="ok"))]
        with patch("litellm.acompletion", new=AsyncMock(return_value=mock_response)):
            await call_llm_with_retry(
                model="openai/gpt-5-mini",
                messages=[{"role": "user", "content": "hi"}],
            )
        assert litellm.drop_params is True
    finally:
        litellm.drop_params = original


@pytest.mark.asyncio
async def test_call_llm_with_retry_propagates_extra_kwargs():
    """extra_kwargs 中的字段应透传给 litellm.acompletion，protected key 不被覆盖。"""
    from negentropy.knowledge.graph.extractors import call_llm_with_retry

    captured: dict = {}
    mock_response = MagicMock()
    mock_response.choices = [MagicMock(message=MagicMock(content="ok"))]

    async def _spy_acompletion(**kwargs):
        captured.update(kwargs)
        return mock_response

    with patch("litellm.acompletion", new=AsyncMock(side_effect=_spy_acompletion)):
        await call_llm_with_retry(
            model="openai/gpt-5-mini",
            messages=[{"role": "user", "content": "hi"}],
            temperature=0.3,
            extra_kwargs={
                "drop_params": True,
                "api_key": "sk-test",
                "api_base": "https://proxy.local/v1",
                # protected：不应覆盖应用层重试/超时
                "num_retries": 99,
                "max_retries": 99,
                "timeout": 9999,
            },
        )

    assert captured["model"] == "openai/gpt-5-mini"
    assert captured["temperature"] == 0.3
    assert captured["drop_params"] is True
    assert captured["api_key"] == "sk-test"
    assert captured["api_base"] == "https://proxy.local/v1"
    # protected keys 由本函数管理：应用层值优先
    assert captured["num_retries"] == 0
    assert captured["max_retries"] == 0
    # timeout 来自本函数管理（KG_LLM_TIMEOUT_SECONDS），不应被 extra_kwargs 覆盖到 9999
    assert captured["timeout"] != 9999


# =====================================================================
# 缺陷 #4：Embedding 失败 hint
# =====================================================================


def test_embedding_failure_hint_for_invalid_prompts():
    """上游 'request body doesn't contain valid prompts' 应触发 actionable hint
    （ISSUE-030 / ISSUE-020 同型）。
    """
    from negentropy.knowledge.ingestion.embedding import _build_embedding_failure_hint

    upstream = (
        'litellm.BadRequestError: GeminiException - {"error":{"message":"request body doesn\'t contain valid prompts"}}'
    )
    hint = _build_embedding_failure_hint(upstream, "localhost:3392")
    assert hint, "已知模式必须给出 hint"
    assert "openai" in hint.lower(), "hint 应建议切换到 openai 系列 embedding"
    assert "NATIVE_GEMINI_BASE_URL" in hint
    assert "localhost:3392" in hint


def test_embedding_failure_hint_empty_on_unknown_error():
    """未知错误模式应返回空 hint，避免误导诊断。"""
    from negentropy.knowledge.ingestion.embedding import _build_embedding_failure_hint

    assert _build_embedding_failure_hint("", "") == ""
    assert _build_embedding_failure_hint("connection reset by peer", "host:1234") == ""


# =====================================================================
# 缺陷 #5/#6：在 graph_service 内的修改通过 black-box 集成回归
# =====================================================================


@pytest.mark.asyncio
async def test_community_summarizer_propagates_drop_params_to_llm():
    """CommunitySummarizer._call_llm 应透传 extra_kwargs（drop_params）给
    call_llm_with_retry，规避 ISSUE-029 同型 UnsupportedParamsError。
    """
    from negentropy.knowledge.graph.community_summarizer import CommunitySummarizer

    summarizer = CommunitySummarizer(model="openai/gpt-5-mini")

    captured: dict = {}

    async def _fake_call_llm_with_retry(**kwargs):
        captured.update(kwargs)
        return "summary text"

    resolved_cfg = (
        "openai/gpt-5-mini",
        {"temperature": 0.7, "drop_params": True, "api_key": "sk-x"},
    )
    with (
        patch(
            "negentropy.config.model_resolver.resolve_llm_config",
            new=AsyncMock(return_value=resolved_cfg),
        ),
        patch(
            "negentropy.knowledge.graph.extractors.call_llm_with_retry",
            new=AsyncMock(side_effect=_fake_call_llm_with_retry),
        ),
    ):
        result = await summarizer._call_llm("test prompt")

    assert result == "summary text"
    assert captured["model"] == "openai/gpt-5-mini"
    # 当 caller 显式指定 model 时，保留凭证透传字段 (api_key/api_base/drop_params)，
    # 仅丢弃 temperature 等模型选择类参数（避免 OPENAI_API_KEY 丢失导致 LLM 全量失败）
    extra = captured.get("extra_kwargs") or {}
    assert extra.get("drop_params") is True
    assert extra.get("api_key") == "sk-x"
    # temperature 等非凭证字段应被丢弃
    assert "temperature" not in extra


# =====================================================================
# 缺陷 #7：sync_relation 端点缺失返回 False（额外覆盖 sync_relation 单点契约）
# =====================================================================


@pytest.mark.asyncio
async def test_sync_relation_returns_false_when_endpoint_missing():
    """sync_relation 端点缺失时必须返回 False（ISSUE-032），调用方据此区分
    `relations_skipped` vs `relations_synced`，避免计数虚高。
    """
    from negentropy.knowledge.graph.entity_service import KgEntityService

    service = KgEntityService()
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()

    empty = MagicMock()
    empty.scalar_one_or_none = MagicMock(return_value=None)
    db.execute = AsyncMock(return_value=empty)

    inserted = await service.sync_relation(
        db,
        source_name="Ghost",
        target_name="Phantom",
        relation_type="HAUNTS",
        corpus_id=_CORPUS_ID,
    )
    assert inserted is False
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_sync_relation_returns_true_when_endpoints_match_and_new():
    """sync_relation 端点命中 + 无重复时插入新行并返回 True。"""
    from negentropy.knowledge.graph.entity_service import KgEntityService

    service = KgEntityService()
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()

    src = MagicMock(id=UUID("11111111-1111-1111-1111-111111111111"))
    tgt = MagicMock(id=UUID("22222222-2222-2222-2222-222222222222"))

    call_idx = [0]

    def _result(value):
        r = MagicMock()
        r.scalar_one_or_none = MagicMock(return_value=value)
        return r

    async def _execute(stmt, *args, **kwargs):
        call_idx[0] += 1
        # 1: src SELECT, 2: tgt SELECT, 3: existing relation SELECT
        if call_idx[0] == 1:
            return _result(src)
        if call_idx[0] == 2:
            return _result(tgt)
        return _result(None)  # 无重复关系

    db.execute = AsyncMock(side_effect=_execute)

    inserted = await service.sync_relation(
        db,
        source_name="Alice",
        target_name="Bob",
        relation_type="KNOWS",
        corpus_id=_CORPUS_ID,
    )
    assert inserted is True
    db.add.assert_called_once()
    db.flush.assert_awaited()
