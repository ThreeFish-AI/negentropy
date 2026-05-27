"""ingest_to_corpus 工具单测。

覆盖点（ISSUE-095 后续 / Ingest 智能识别闭环）：
- 入参校验（corpus_id 空 / text 空 / UUID 非法）
- 越权防御 fail-close（corpus_id 不在 state.corpus_ids）
- Approval Gate（always 拦截 / denied / timeout / never 直通）
- KnowledgeService 正常路径（metadata 注入 captured_by="ingest_intent"）
- 失败降级（KnowledgeService 抛错 → state.pending_ingest_buffer）
- 进度上报（终态 clear）
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest


class _FakeState:
    def __init__(self) -> None:
        self.data: dict[str, Any] = {}

    def get(self, key: str, default: Any = None) -> Any:
        return self.data.get(key, default)

    def __setitem__(self, key: str, value: Any) -> None:
        self.data[key] = value

    def __getitem__(self, key: str) -> Any:
        return self.data[key]

    def __contains__(self, key: str) -> bool:
        return key in self.data


class _FakeToolContext:
    """最小 ToolContext mock — 仅模拟 ingest_to_corpus 实际依赖的字段。"""

    def __init__(
        self,
        *,
        corpus_ids: list[str] | None = None,
        approval_mode: str = "never",
        function_call_id: str | None = "test-call-id",
    ) -> None:
        self.state = _FakeState()
        # 默认关闭审批门，避免阻塞测试；需要测试审批的用例可显式覆盖
        self.state.data["approval_policy"] = {"mode": approval_mode}
        if corpus_ids is not None:
            self.state.data["corpus_ids"] = corpus_ids
        if function_call_id:
            self.function_call_id = function_call_id


def _fake_record(record_id: str = "k-1") -> MagicMock:
    record = MagicMock()
    record.id = record_id
    return record


# ----------------------------------------------------------------------------
# 入参校验
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_empty_corpus_id_rejected() -> None:
    from negentropy.agents.tools.ingest import ingest_to_corpus

    ctx = _FakeToolContext(corpus_ids=[])
    out = await ingest_to_corpus(corpus_id="", text="hi", source_uri=None, metadata=None, tool_context=ctx)
    assert out["status"] == "failed"
    assert "corpus_id 不可为空" in out["error"]


@pytest.mark.asyncio
async def test_empty_text_rejected() -> None:
    from negentropy.agents.tools.ingest import ingest_to_corpus

    cid = str(uuid4())
    ctx = _FakeToolContext(corpus_ids=[cid])
    out = await ingest_to_corpus(corpus_id=cid, text="   \n  ", source_uri=None, metadata=None, tool_context=ctx)
    assert out["status"] == "failed"
    assert "text 不可为空" in out["error"]


@pytest.mark.asyncio
async def test_invalid_uuid_rejected() -> None:
    """corpus_id 在 state 中（绕过越权门）但格式非法 → fail。"""
    from negentropy.agents.tools.ingest import ingest_to_corpus

    bogus = "not-a-uuid"
    ctx = _FakeToolContext(corpus_ids=[bogus])
    out = await ingest_to_corpus(corpus_id=bogus, text="hi", source_uri=None, metadata=None, tool_context=ctx)
    assert out["status"] == "failed"
    assert "UUID" in out["error"]


# ----------------------------------------------------------------------------
# 越权防御
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_unauthorized_corpus_id_rejected() -> None:
    """corpus_id 不在 state.corpus_ids → fail-close，且 error 含「越权」。"""
    from negentropy.agents.tools.ingest import ingest_to_corpus

    in_scope = str(uuid4())
    out_of_scope = str(uuid4())
    ctx = _FakeToolContext(corpus_ids=[in_scope])
    out = await ingest_to_corpus(corpus_id=out_of_scope, text="hi", source_uri=None, metadata=None, tool_context=ctx)
    assert out["status"] == "failed"
    assert "越权" in out["error"]
    assert out["corpus_id"] == out_of_scope


@pytest.mark.asyncio
async def test_no_corpus_ids_state_rejected() -> None:
    """state.corpus_ids 缺席 → 任何 corpus_id 都视为越权。"""
    from negentropy.agents.tools.ingest import ingest_to_corpus

    cid = str(uuid4())
    ctx = _FakeToolContext()  # 不设置 corpus_ids
    out = await ingest_to_corpus(corpus_id=cid, text="hi", source_uri=None, metadata=None, tool_context=ctx)
    assert out["status"] == "failed"
    assert "越权" in out["error"]


# ----------------------------------------------------------------------------
# Approval Gate
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_approval_denied_returns_failed() -> None:
    """always 模式 + 用户拒绝 → failed。"""
    from negentropy.agents.tools import ingest as ingest_mod
    from negentropy.agents.tools.ingest import ingest_to_corpus

    cid = str(uuid4())
    ctx = _FakeToolContext(corpus_ids=[cid], approval_mode="always")

    fake_response = MagicMock(decision="denied", reason="user_clicked_no")
    with patch.object(ingest_mod, "consume_approval_response", return_value=fake_response):
        out = await ingest_to_corpus(corpus_id=cid, text="hi", source_uri=None, metadata=None, tool_context=ctx)
    assert out["status"] == "failed"
    assert "拒绝" in out["error"] or "超时" in out["error"]


@pytest.mark.asyncio
async def test_approval_timeout_returns_failed(monkeypatch) -> None:
    """always 模式 + 30s 内无响应 → timeout failed；测试用短超时避免拖慢。"""
    from negentropy.agents.tools import ingest as ingest_mod
    from negentropy.agents.tools.ingest import ingest_to_corpus

    monkeypatch.setattr(ingest_mod, "_APPROVAL_TIMEOUT_SECONDS", 0.05)
    monkeypatch.setattr(ingest_mod, "_APPROVAL_POLL_INTERVAL", 0.02)

    cid = str(uuid4())
    ctx = _FakeToolContext(corpus_ids=[cid], approval_mode="always")

    with patch.object(ingest_mod, "consume_approval_response", return_value=None):
        out = await ingest_to_corpus(corpus_id=cid, text="hi", source_uri=None, metadata=None, tool_context=ctx)
    assert out["status"] == "failed"
    assert "超时" in out["error"]


# ----------------------------------------------------------------------------
# 成功路径 + metadata 注入
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_success_path_writes_records_and_injects_metadata() -> None:
    """成功路径：返回 status=success + record_count；KnowledgeService.ingest_text
    的调用参数中 metadata 含 captured_by='ingest_intent'。"""
    from negentropy.agents.tools import ingest as ingest_mod
    from negentropy.agents.tools.ingest import ingest_to_corpus

    cid = str(uuid4())
    ctx = _FakeToolContext(corpus_ids=[cid])

    fake_service = MagicMock()
    fake_service.ingest_text = AsyncMock(return_value=[_fake_record("k-1"), _fake_record("k-2")])

    with patch.object(ingest_mod, "_get_knowledge_service", return_value=fake_service):
        out = await ingest_to_corpus(
            corpus_id=cid,
            text="HippoRAG 是非参数化记忆架构",
            source_uri="home:session/x/run/y",
            metadata={"tag": "memo"},
            tool_context=ctx,
        )

    assert out["status"] == "success"
    assert out["record_count"] == 2
    assert out["knowledge_ids"] == ["k-1", "k-2"]
    # metadata 注入断言
    call_kwargs = fake_service.ingest_text.call_args.kwargs
    assert call_kwargs["metadata"]["captured_by"] == "ingest_intent"
    assert call_kwargs["metadata"]["tag"] == "memo"
    assert call_kwargs["source_uri"] == "home:session/x/run/y"
    # 进度终态被清理
    assert ctx.state["tool_progress"] == {} or not any(
        v.get("percent", 0) < 100 for v in ctx.state["tool_progress"].values()
    )


@pytest.mark.asyncio
async def test_success_path_with_none_metadata_still_injects_captured_by() -> None:
    """metadata=None 时仍应注入 captured_by。"""
    from negentropy.agents.tools import ingest as ingest_mod
    from negentropy.agents.tools.ingest import ingest_to_corpus

    cid = str(uuid4())
    ctx = _FakeToolContext(corpus_ids=[cid])

    fake_service = MagicMock()
    fake_service.ingest_text = AsyncMock(return_value=[_fake_record()])

    with patch.object(ingest_mod, "_get_knowledge_service", return_value=fake_service):
        out = await ingest_to_corpus(corpus_id=cid, text="note", source_uri=None, metadata=None, tool_context=ctx)

    assert out["status"] == "success"
    call_kwargs = fake_service.ingest_text.call_args.kwargs
    assert call_kwargs["metadata"] == {"captured_by": "ingest_intent"}


# ----------------------------------------------------------------------------
# 失败降级
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_service_exception_buffers_to_state() -> None:
    """KnowledgeService 抛错 → status=degraded + state.pending_ingest_buffer 长度 1。"""
    from negentropy.agents.tools import ingest as ingest_mod
    from negentropy.agents.tools.ingest import ingest_to_corpus

    cid = str(uuid4())
    ctx = _FakeToolContext(corpus_ids=[cid])

    fake_service = MagicMock()
    fake_service.ingest_text = AsyncMock(side_effect=RuntimeError("boom"))

    with patch.object(ingest_mod, "_get_knowledge_service", return_value=fake_service):
        out = await ingest_to_corpus(
            corpus_id=cid,
            text="note",
            source_uri="s://x",
            metadata={"k": "v"},
            tool_context=ctx,
        )

    assert out["status"] == "degraded"
    assert out["buffer_count"] == 1
    buf = ctx.state.get("pending_ingest_buffer")
    assert isinstance(buf, list) and len(buf) == 1
    entry = buf[0]
    assert entry["corpus_id"] == cid
    assert entry["text"] == "note"
    assert entry["source_uri"] == "s://x"
    assert entry["metadata"] == {"k": "v"}


# ----------------------------------------------------------------------------
# 进度上报
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_progress_emitted_then_cleared_on_success() -> None:
    """成功路径下，tool_progress 在 100% 后被清理。"""
    from negentropy.agents.tools import ingest as ingest_mod
    from negentropy.agents.tools.ingest import ingest_to_corpus

    cid = str(uuid4())
    ctx = _FakeToolContext(corpus_ids=[cid])

    fake_service = MagicMock()
    fake_service.ingest_text = AsyncMock(return_value=[_fake_record()])

    with patch.object(ingest_mod, "_get_knowledge_service", return_value=fake_service):
        await ingest_to_corpus(corpus_id=cid, text="hi", source_uri=None, metadata=None, tool_context=ctx)

    # 终态后 tool_call_id 已被 clear；bucket 可能不存在或为空
    progress = ctx.state.get("tool_progress")
    if progress is not None:
        # 不应有任何未达 100 的残留
        for entry in progress.values():
            assert entry.get("percent", 0) == 100 or entry.get("stage") != "等待用户审批"
