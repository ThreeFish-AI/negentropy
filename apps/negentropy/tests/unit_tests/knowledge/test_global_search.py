"""Phase 4 G1 GraphRAG Global Search Map-Reduce 单元测试

不打开真实数据库 / LLM 连接（mock AsyncSession + mock litellm）。

References:
    [1] D. Edge et al., "From Local to Global: A Graph RAG Approach to
        Query-Focused Summarization," *arXiv:2404.16130*, 2024.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest

from negentropy.knowledge.graph.global_search import (
    GlobalSearchEvidence,
    GlobalSearchResult,
    GlobalSearchService,
)

_CORPUS_ID = UUID("00000000-0000-0000-0000-000000000001")


@pytest.fixture
def mock_db() -> AsyncMock:
    db = AsyncMock()
    db.execute = AsyncMock()
    return db


def _make_summary_row(community_id: int, text_value: str, sim: float = 0.5):
    row = MagicMock()
    row.community_id = community_id
    row.summary_text = text_value
    row.entity_count = 5
    row.top_entities = ["A", "B", "C"]
    row.similarity = sim
    return row


@pytest.mark.asyncio
async def test_select_relevant_summaries_returns_top_k_when_embeddings_present(mock_db):
    service = GlobalSearchService(map_concurrency=2, max_communities=10)

    # 先返回"探测有 embedding"，再返回 top-3 候选
    probe_result = MagicMock()
    probe_result.scalar = MagicMock(return_value=1)

    candidates_result = MagicMock()
    candidates_result.__iter__ = MagicMock(
        return_value=iter(
            [
                _make_summary_row(1, "AI/ML 主题", sim=0.92),
                _make_summary_row(2, "数据库系统", sim=0.81),
                _make_summary_row(3, "网络协议", sim=0.55),
            ]
        )
    )

    mock_db.execute.side_effect = [probe_result, candidates_result]

    rows = await service._select_relevant_summaries(mock_db, _CORPUS_ID, query_embedding=[0.1] * 4, top_k=3)
    assert len(rows) == 3
    assert rows[0]["community_id"] == 1
    assert rows[0]["similarity"] == 0.92
    assert rows[0]["top_entities"] == ["A", "B", "C"]


@pytest.mark.asyncio
async def test_select_relevant_summaries_falls_back_when_no_embeddings(mock_db):
    service = GlobalSearchService()

    probe_result = MagicMock()
    probe_result.scalar = MagicMock(return_value=None)

    candidates_result = MagicMock()
    candidates_result.__iter__ = MagicMock(return_value=iter([_make_summary_row(7, "fallback", sim=0.0)]))

    mock_db.execute.side_effect = [probe_result, candidates_result]

    rows = await service._select_relevant_summaries(mock_db, _CORPUS_ID, query_embedding=[0.1] * 4, top_k=5)
    assert len(rows) == 1
    # fallback 路径相似度兜底为 0
    assert rows[0]["similarity"] == 0.0


@pytest.mark.asyncio
async def test_search_returns_fallback_when_no_candidates(mock_db):
    service = GlobalSearchService()

    # _get_highest_level → None (no levels)
    level_result = MagicMock()
    level_result.scalar = MagicMock(return_value=None)
    # _has_summary_embeddings → None (no embeddings)
    probe_result = MagicMock()
    probe_result.scalar = MagicMock(return_value=None)
    # _select_relevant_summaries → empty
    empty_result = MagicMock()
    empty_result.__iter__ = MagicMock(return_value=iter([]))
    mock_db.execute.side_effect = [level_result, probe_result, empty_result]

    result = await service.search(mock_db, _CORPUS_ID, query="主题？", query_embedding=[0.0] * 4)
    assert isinstance(result, GlobalSearchResult)
    assert result.candidates_total == 0
    assert "尚未生成社区摘要" in result.answer
    assert result.evidence == []


@pytest.mark.asyncio
async def test_map_reduce_pipeline_aggregates_partials(mock_db):
    service = GlobalSearchService(map_concurrency=2)

    # _get_highest_level → level 1
    level_result = MagicMock()
    level_result.scalar = MagicMock(return_value=1)
    # _has_summary_embeddings → True
    probe_result = MagicMock()
    probe_result.scalar = MagicMock(return_value=1)
    candidates_result = MagicMock()
    candidates_result.__iter__ = MagicMock(
        return_value=iter(
            [
                _make_summary_row(1, "AI 社区", sim=0.9),
                _make_summary_row(2, "DB 社区", sim=0.7),
            ]
        )
    )
    stale_result = MagicMock()
    stale_row = MagicMock()
    stale_row.entity_max = None
    stale_row.summary_max = None
    stale_result.first = MagicMock(return_value=stale_row)

    mock_db.execute.side_effect = [level_result, probe_result, candidates_result, stale_result]

    # 让 _call_llm 直接返回固定字符串（避免依赖 litellm）
    call_count = {"map": 0, "reduce": 0}

    async def fake_call_llm(self, prompt: str, max_tokens: int) -> str:  # noqa: ARG001
        if "Reduce" in prompt or "Map-Reduce" in prompt or "聚合" in prompt:
            call_count["reduce"] += 1
            return "聚合后的最终答案"
        call_count["map"] += 1
        return f"partial-{call_count['map']}"

    with patch.object(GlobalSearchService, "_call_llm", new=fake_call_llm):
        result = await service.search(mock_db, _CORPUS_ID, query="主题？", query_embedding=[0.1] * 4)

    assert result.candidates_total == 2
    assert len(result.evidence) == 2
    assert result.answer == "聚合后的最终答案"
    assert call_count["map"] == 2
    assert call_count["reduce"] == 1


@pytest.mark.asyncio
async def test_evidence_drops_empty_partial_answers(mock_db):
    """Map 阶段失败的社区（空字符串）应从 evidence 列表中剔除"""
    service = GlobalSearchService()

    # _get_highest_level → level 1
    level_result = MagicMock()
    level_result.scalar = MagicMock(return_value=1)
    # _has_summary_embeddings → True
    probe_result = MagicMock()
    probe_result.scalar = MagicMock(return_value=1)
    candidates_result = MagicMock()
    candidates_result.__iter__ = MagicMock(
        return_value=iter(
            [
                _make_summary_row(1, "A", sim=0.9),
                _make_summary_row(2, "B", sim=0.8),
            ]
        )
    )
    stale_result = MagicMock()
    stale_row = MagicMock()
    stale_row.entity_max = None
    stale_row.summary_max = None
    stale_result.first = MagicMock(return_value=stale_row)
    mock_db.execute.side_effect = [level_result, probe_result, candidates_result, stale_result]

    # 第一个社区返回空（LLM 失败），第二个返回正常
    answers = iter(["", "answer-2", "reduced"])

    async def fake_call_llm(self, prompt: str, max_tokens: int) -> str:  # noqa: ARG001
        return next(answers)

    with patch.object(GlobalSearchService, "_call_llm", new=fake_call_llm):
        result = await service.search(mock_db, _CORPUS_ID, query="X", query_embedding=[0.0] * 4)

    assert len(result.evidence) == 1
    assert result.evidence[0].community_id == 2


def test_global_search_evidence_dataclass_frozen():
    e = GlobalSearchEvidence(community_id=1, partial_answer="x", similarity=0.5, top_entities=[])
    # frozen dataclass 字段写入会抛 dataclasses.FrozenInstanceError
    import dataclasses

    with pytest.raises(dataclasses.FrozenInstanceError):
        e.community_id = 2  # type: ignore[misc]


@pytest.mark.asyncio
async def test_call_llm_uses_resolve_llm_config_by_id_when_provided():
    """Service 接到 ``llm_config_id`` 时应调用 ``resolve_llm_config_by_id`` 而非默认解析。

    回归 Fix 2：``GlobalSearchService._call_llm`` 必须把 Corpus 绑定的 LLM 配置
    透传给 ``call_llm_with_retry``，避免回退到无凭证的硬编码默认 OpenAI 模型。
    """
    target_cfg_id = "11111111-1111-1111-1111-111111111111"
    service = GlobalSearchService(llm_config_id=target_cfg_id)

    captured: dict[str, object] = {}

    async def fake_resolve_by_id(cfg_id):
        captured["called_with"] = cfg_id
        return ("vertex_ai/gemini-1.5-pro", {"api_key": "k", "api_base": "https://b"})

    async def fake_call_llm_with_retry(**kwargs):
        captured["model"] = kwargs["model"]
        captured["extra_kwargs"] = kwargs.get("extra_kwargs")
        return "ok"

    with (
        patch(
            "negentropy.config.model_resolver.resolve_llm_config_by_id",
            side_effect=fake_resolve_by_id,
        ),
        patch(
            "negentropy.knowledge.graph.extractors.call_llm_with_retry",
            side_effect=fake_call_llm_with_retry,
        ),
    ):
        result = await service._call_llm("prompt", max_tokens=100)

    assert result == "ok"
    assert captured["called_with"] == target_cfg_id
    assert captured["model"] == "vertex_ai/gemini-1.5-pro"
    assert captured["extra_kwargs"] == {"api_key": "k", "api_base": "https://b"}


@pytest.mark.asyncio
async def test_call_llm_falls_back_to_default_resolver_when_no_config_id():
    """无 ``llm_config_id`` 时走 ``resolve_llm_config()`` 全局默认（保持向后兼容）。"""
    service = GlobalSearchService()  # llm_config_id 默认 None

    captured: dict[str, object] = {}

    async def fake_resolve_default():
        captured["default_called"] = True
        return ("openai/gpt-4o-mini", {"api_key": "global"})

    async def fake_call_llm_with_retry(**kwargs):
        captured["model"] = kwargs["model"]
        return "fallback-answer"

    with (
        patch(
            "negentropy.config.model_resolver.resolve_llm_config",
            side_effect=fake_resolve_default,
        ),
        patch(
            "negentropy.knowledge.graph.extractors.call_llm_with_retry",
            side_effect=fake_call_llm_with_retry,
        ),
    ):
        result = await service._call_llm("prompt", max_tokens=100)

    assert result == "fallback-answer"
    assert captured["default_called"] is True
    assert captured["model"] == "openai/gpt-4o-mini"


@pytest.mark.asyncio
async def test_zero_evidence_with_candidates_returns_infrastructure_error_message(mock_db):
    """候选 > 0 但所有 map 调用返回空（凭证错误）时，answer 必须明确指向后端配置故障。

    回归 Fix 4：避免基础设施故障被伪装成「所有社区均无与查询相关的信息」。
    """
    service = GlobalSearchService()

    level_result = MagicMock()
    level_result.scalar = MagicMock(return_value=1)
    probe_result = MagicMock()
    probe_result.scalar = MagicMock(return_value=1)
    candidates_result = MagicMock()
    candidates_result.__iter__ = MagicMock(
        return_value=iter(
            [
                _make_summary_row(1, "A", sim=0.9),
                _make_summary_row(2, "B", sim=0.8),
            ]
        )
    )
    mock_db.execute.side_effect = [level_result, probe_result, candidates_result]

    async def fake_call_llm(self, prompt: str, max_tokens: int) -> str:  # noqa: ARG001
        return ""  # 模拟所有 map 阶段全失败（call_llm_with_retry fail-fast 后空串）

    with patch.object(GlobalSearchService, "_call_llm", new=fake_call_llm):
        result = await service.search(mock_db, _CORPUS_ID, query="主题？", query_embedding=[0.1] * 4)

    assert result.candidates_total == 2
    assert result.evidence == []
    assert "全局检索失败" in result.answer
    assert "候选社区 2 个" in result.answer
    assert "api_key" in result.answer or "模型" in result.answer
