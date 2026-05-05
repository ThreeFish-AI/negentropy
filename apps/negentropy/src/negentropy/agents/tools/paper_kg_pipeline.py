"""Paper KG 自动闭环 — ingest_paper 完成后异步触发 KG schema-guided 抽取。

设计目标（参见 plan P2-2）：
    论文采集 → 知识库 → KG 的端到端闭环必须在用户单一对话动作内完成；本模块负责
    把刚刚 ingest 的 chunks 异步喂给 ``GraphService.build_graph``（schema=ai_paper,
    incremental=True），不阻塞 ``ingest_paper`` 的主路径返回。

核心契约（fail-open）：
    - 任意环节抛错（创建 service / 转换 chunks / 启动异步任务）一律降级为
      ``{"kg_status": "kg_skipped", "kg_error_code": <短码>}``，绝不污染 ingest 主路径；
    - 成功返回 ``{"kg_status": "kg_enqueued", "kg_run_id": str | None,
      "kg_chunk_count": int}``；
    - ``kg_run_id`` 在异步任务真正开始前是 ``None`` —— 这是设计意图：``ingest_paper``
      不等 KG run 完成，只确认调度成功，前端按 ``kg_status`` 渲染足以。

为什么不用 STATE_DELTA 推 KG 进度：
    KG 抽取耗时通常 > 30s 且对话窗口可能已切走，独立 SSE 事件流（``kg.build.progress``）
    Phase 3 才上；MVP 通过 ``kg_status`` 字段告知调度成功即可。

参考文献：
  [1] D. Edge et al., "From Local to Global: A Graph RAG Approach to Query-Focused
      Summarization," arXiv:2404.16130, 2024.（schema-guided 抽取的端到端必要性）
  [2] A. Hogan et al., "Knowledge Graphs," ACM Comput. Surv., 2021/2024 §6.3.
      （增量构建的一致性原则）
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, Any
from uuid import UUID

from negentropy.config import settings
from negentropy.logging import get_logger

if TYPE_CHECKING:
    from negentropy.knowledge.types import KnowledgeRecord

logger = get_logger("negentropy.tools.paper_kg")

# AI 论文 schema 名称（参见 knowledge/graph/extraction_schema.py:191 SCHEMA_REGISTRY）
_AI_PAPER_SCHEMA_NAME = "ai_paper"

# Fire-and-forget Task 强引用持有器：Python asyncio 文档（3.11+）明确 event loop 只持
# 弱引用，无外部强引用的 task 在完成前可能被 GC。保留模块级 set + add_done_callback
# 自清理，确保 ingest_paper 返回后 KG 构建仍能跑完。
_BACKGROUND_TASKS: set[asyncio.Task[None]] = set()


def _records_to_chunks(records: list[KnowledgeRecord]) -> list[dict[str, Any]]:
    """把 ``KnowledgeRecord`` 序列转换为 ``GraphService.build_graph`` 期望的 chunks 字典。

    必备字段：``id``（用于 incremental dedup，参见 service.py:269）+ ``content``。
    其余 metadata 透传供 entity/relation extractor 使用。
    """
    chunks: list[dict[str, Any]] = []
    for r in records:
        rid = getattr(r, "id", None)
        if rid is None:
            continue
        chunks.append(
            {
                "id": str(rid),
                "content": getattr(r, "content", "") or "",
                "metadata": dict(getattr(r, "metadata", {}) or {}),
                "source_uri": getattr(r, "source_uri", None),
                "chunk_index": getattr(r, "chunk_index", 0),
            }
        )
    return chunks


async def _run_kg_build_background(
    corpus_id: UUID,
    chunks: list[dict[str, Any]],
) -> None:
    """后台 KG 构建主体（不被 ingest_paper await）。"""
    try:
        from negentropy.knowledge.graph.service import GraphService
        from negentropy.knowledge.types import GraphBuildConfig

        service = GraphService()
        config = GraphBuildConfig(
            incremental=True,
            extraction_schema_name=_AI_PAPER_SCHEMA_NAME,
        )
        result = await service.build_graph(
            corpus_id=corpus_id,
            app_name=settings.app_name,
            chunks=chunks,
            config=config,
        )
        logger.info(
            "paper_kg_build_completed",
            corpus_id=str(corpus_id),
            chunk_count=len(chunks),
            run_id=getattr(result, "run_id", None),
            entity_count=getattr(result, "entity_count", None),
            relation_count=getattr(result, "relation_count", None),
        )
    except Exception as exc:
        # 后台任务失败仅记录，不向上抛 —— ingest_paper 主路径已成功完成
        logger.warning(
            "paper_kg_build_failed",
            corpus_id=str(corpus_id),
            chunk_count=len(chunks),
            error=str(exc),
        )


async def enqueue_kg_build(
    corpus_id: UUID,
    records: list[KnowledgeRecord],
) -> dict[str, Any]:
    """异步排队启动 ai_paper schema 增量 KG 构建。

    Args:
        corpus_id: 目标 corpus（agent-papers）。
        records: 刚 ingest 的 ``KnowledgeRecord`` 列表（来自 ``service.ingest_url`` 返回）。

    Returns:
        - 成功：``{"kg_status": "kg_enqueued", "kg_chunk_count": int}``；
        - 失败：``{"kg_status": "kg_skipped", "kg_error_code": str}``；
        - 空 records：``{"kg_status": "kg_skipped", "kg_error_code": "no_chunks"}``（短路路径）。

    fail-open 兜底：任何 except 都不抛出，调用方可直接合并到 ingest_paper 返回值。
    """
    try:
        chunks = _records_to_chunks(records)
        if not chunks:
            return {"kg_status": "kg_skipped", "kg_error_code": "no_chunks"}

        # asyncio.create_task 让 KG 构建在 event loop 上独立运行；ingest_paper 立即返回。
        # 必须把 task 强引用挂到 _BACKGROUND_TASKS，否则 event loop 仅持弱引用，task 可能
        # 在完成前被 GC（Python asyncio 文档 3.11+）。done_callback 完成后自清理，零泄漏。
        task = asyncio.create_task(_run_kg_build_background(corpus_id, chunks))
        _BACKGROUND_TASKS.add(task)
        task.add_done_callback(_BACKGROUND_TASKS.discard)

        logger.info(
            "paper_kg_build_enqueued",
            corpus_id=str(corpus_id),
            chunk_count=len(chunks),
            schema=_AI_PAPER_SCHEMA_NAME,
        )
        return {
            "kg_status": "kg_enqueued",
            "kg_chunk_count": len(chunks),
        }
    except Exception as exc:
        logger.warning(
            "paper_kg_enqueue_failed",
            corpus_id=str(corpus_id),
            error=str(exc),
        )
        return {
            "kg_status": "kg_skipped",
            "kg_error_code": type(exc).__name__,
        }


__all__ = ["enqueue_kg_build"]
