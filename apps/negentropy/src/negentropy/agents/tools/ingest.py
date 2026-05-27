"""ingest_to_corpus — 用户 @ Corpus 场景下的「主动沉淀」工具。

设计动机（ISSUE-095 后续）：
    Composer @ 唤出框收敛为 2 Tab 后，沉淀入口由 UI 显式按钮迁移至 LLM 自主
    判断：用户在自然语言中表达「沉淀/入库/保存到 X」时，root LLM 依据
    ``state.action_intent_hint == "ingest"`` + ``state.corpus_ids`` 非空，
    transfer 给 InternalizationFaculty 调用本工具完成写入。

权限红线（fail-close）：
    ``corpus_id`` 必须严格出现在 ``state.corpus_ids`` 内（用户已在 Composer 显式
    @ 选中），否则视为越权调用直接返回 ``status="failed"``。这与 perception.py
    的 ``corpus_ids`` 边界对齐，杜绝 LLM 幻觉造成的越权写入。

参考文献：
    [1] T. Rebedea et al., "NeMo Guardrails: A Toolkit for Controllable and
        Safe LLM Applications with Programmable Rails," in *Proc. EMNLP System
        Demos*, 2023.
        — Programmable Rails 中 input rail / tool gate 工业范式对应本工具的
        越权防御 + Approval Gate 双门户。
    [2] J. Wang, Z. Chen, R. Pasunuru et al., "Self-RAG: Learning to Retrieve,
        Generate, and Critique through Self-Reflection," in *Proc. ICLR*, 2024.
        — agent 自主决策 retrieve vs ingest 的可解释范式依据。
"""

from __future__ import annotations

import asyncio
import time
from typing import TYPE_CHECKING, Any
from uuid import UUID

from google.adk.tools import ToolContext

from negentropy.config import settings
from negentropy.logging import get_logger

from ..approval import (
    ApprovalPolicy,
    consume_approval_response,
    request_approval,
    should_request_approval,
)
from .common import clear_tool_progress, emit_tool_progress

if TYPE_CHECKING:
    from negentropy.knowledge.service import KnowledgeService

logger = get_logger("negentropy.tools.ingest")

_knowledge_service: KnowledgeService | None = None

_APPROVAL_TIMEOUT_SECONDS = 30.0
_APPROVAL_POLL_INTERVAL = 0.5


def _get_knowledge_service() -> KnowledgeService:
    """获取 KnowledgeService 单例（与 paper.py 同模式）。"""
    global _knowledge_service
    if _knowledge_service is None:
        from negentropy.knowledge.ingestion.embedding import (
            build_batch_embedding_fn,
            build_embedding_fn,
        )
        from negentropy.knowledge.service import KnowledgeService

        _knowledge_service = KnowledgeService(
            embedding_fn=build_embedding_fn(),
            batch_embedding_fn=build_batch_embedding_fn(),
        )
    return _knowledge_service


async def ingest_to_corpus(
    corpus_id: str,
    text: str,
    source_uri: str | None,
    metadata: dict[str, Any] | None,
    tool_context: ToolContext,
) -> dict[str, Any]:
    """将一段文本沉淀到指定 Corpus（用户已 @ 选中）。

    Args:
        corpus_id: 目标 Corpus UUID 字符串（必须 ∈ ``state.corpus_ids``）。
        text: 要沉淀的自然语言内容（chunking + embedding 由 KnowledgeService 完成）。
        source_uri: 可选来源标识（如 session URI、文件 URL、conversation/thread 链接）。
        metadata: 可选 metadata（工具会自动注入 ``captured_by="ingest_intent"``）。
        tool_context: ADK 自动注入。

    Returns:
        - ``status="success"``：``{corpus_id, record_count, knowledge_ids}``
        - ``status="failed"``：``{error, corpus_id}``（含越权 / UUID 非法 / 用户拒绝等）
        - ``status="degraded"``：``{message, buffer_count}``（KnowledgeService 不可用，
          已 buffer 到 ``state['pending_ingest_buffer']``）
    """
    # === Step 0. 入参校验 ===
    if not corpus_id or not isinstance(corpus_id, str):
        return {"status": "failed", "error": "corpus_id 不可为空"}
    if not text or not text.strip():
        return {"status": "failed", "error": "text 不可为空"}

    # === Step 1. 越权防御（fail-close） ===
    # corpus_id 必须在 state.corpus_ids（用户已 @ 选中）内，杜绝 LLM 幻觉越权写入。
    scoped: list[str] = []
    if tool_context is not None and getattr(tool_context, "state", None):
        raw = tool_context.state.get("corpus_ids")
        if isinstance(raw, list):
            scoped = [s for s in raw if isinstance(s, str) and s]
    if corpus_id not in scoped:
        logger.warning(
            "ingest_to_corpus_unauthorized",
            corpus_id=corpus_id,
            scoped_count=len(scoped),
        )
        return {
            "status": "failed",
            "error": "corpus_id 不在用户 @ 选中的范围内（越权防御）",
            "corpus_id": corpus_id,
        }

    # === Step 2. Approval Gate（受 ApprovalPolicy 控制；默认 per_tool 模式下拦截） ===
    policy_payload = None
    if hasattr(tool_context, "state") and tool_context.state:
        policy_payload = tool_context.state.get("approval_policy")
    try:
        policy = ApprovalPolicy(**policy_payload) if isinstance(policy_payload, dict) else ApprovalPolicy()
    except TypeError:
        logger.warning("approval_policy_parse_failed", payload=policy_payload)
        policy = ApprovalPolicy()

    if should_request_approval("ingest_to_corpus", policy):
        action_id = request_approval(
            tool_context,
            tool_name="ingest_to_corpus",
            label="沉淀文本到 Corpus",
            detail=f"将一段 {len(text)} 字符的内容写入 Corpus {corpus_id[:8]}…",
            args_preview={"corpus_id": corpus_id, "text_preview": text[:80]},
            risk_tier="medium",
        )
        if action_id is None:
            logger.warning("approval_request_failed_fail_close", corpus_id=corpus_id)
            return {"status": "failed", "error": "审批请求失败（state 不可用）", "corpus_id": corpus_id}

        approval_progress_id = f"approval_wait:ingest:{corpus_id[:8]}"
        emit_tool_progress(tool_context, tool_call_id=approval_progress_id, percent=0, stage="等待用户审批")
        elapsed = 0.0
        response = None
        while elapsed < _APPROVAL_TIMEOUT_SECONDS:
            await asyncio.sleep(_APPROVAL_POLL_INTERVAL)
            elapsed += _APPROVAL_POLL_INTERVAL
            response = consume_approval_response(tool_context, action_id)
            if response is not None:
                break
        clear_tool_progress(tool_context, tool_call_id=approval_progress_id)
        if response is None or response.decision == "denied":
            logger.info(
                "ingest_to_corpus_denied",
                corpus_id=corpus_id,
                reason=getattr(response, "reason", "timeout"),
            )
            return {"status": "failed", "error": "用户拒绝或审批超时", "corpus_id": corpus_id}

    # === Step 3. corpus UUID 校验 ===
    tool_call_id = (
        getattr(tool_context, "function_call_id", None)
        or getattr(tool_context, "tool_call_id", None)
        or f"ingest_to_corpus:{corpus_id[:8]}:{int(time.time() * 1000)}"
    )
    emit_tool_progress(tool_context, tool_call_id=tool_call_id, percent=5, stage="解析 corpus")

    try:
        corpus_uuid = UUID(corpus_id)
    except (ValueError, AttributeError):
        clear_tool_progress(tool_context, tool_call_id=tool_call_id)
        return {"status": "failed", "error": "corpus_id 不是合法 UUID", "corpus_id": corpus_id}

    emit_tool_progress(tool_context, tool_call_id=tool_call_id, percent=20, stage="chunk + embed")

    # === Step 4. 调用 KnowledgeService 直连服务层（零 HTTP 往返） ===
    try:
        service = _get_knowledge_service()
        merged_metadata: dict[str, Any] = {**(metadata or {}), "captured_by": "ingest_intent"}
        records = await service.ingest_text(
            corpus_id=corpus_uuid,
            app_name=settings.app_name,
            text=text,
            source_uri=source_uri,
            metadata=merged_metadata,
        )
        emit_tool_progress(
            tool_context,
            tool_call_id=tool_call_id,
            percent=100,
            stage=f"沉淀完成（{len(records)} chunk）",
        )
        clear_tool_progress(tool_context, tool_call_id=tool_call_id)
        logger.info(
            "ingest_to_corpus_completed",
            corpus_id=corpus_id,
            record_count=len(records),
            text_length=len(text),
        )
        return {
            "status": "success",
            "corpus_id": corpus_id,
            "record_count": len(records),
            "knowledge_ids": [str(getattr(r, "id", "")) for r in records],
        }
    except Exception as exc:
        clear_tool_progress(tool_context, tool_call_id=tool_call_id)
        logger.error("ingest_to_corpus_failed", corpus_id=corpus_id, exc_info=exc)
        # === Step 5. 失败降级：state buffer（与 save_to_memory 失败降级范式对齐） ===
        if tool_context and hasattr(tool_context, "state"):
            try:
                state = tool_context.state
                buf = state.get("pending_ingest_buffer")
                if not isinstance(buf, list):
                    buf = []
                buf.append(
                    {
                        "corpus_id": corpus_id,
                        "text": text,
                        "source_uri": source_uri,
                        "metadata": metadata,
                    }
                )
                state["pending_ingest_buffer"] = buf
                return {
                    "status": "degraded",
                    "message": "KnowledgeService unavailable; buffered in session state",
                    "buffer_count": len(buf),
                    "corpus_id": corpus_id,
                }
            except Exception:
                pass
        return {"status": "failed", "error": str(exc), "corpus_id": corpus_id}


__all__ = ["ingest_to_corpus"]
