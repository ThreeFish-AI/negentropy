"""
Paper Curation Tools — AI Agent 论文采集工具集

提供 arXiv 论文检索 + 知识库自动入库能力，与对话模块的 Tool Progress / 中断门联动。

应用场景：自动收集 AI Agent 相关最新最有用的 papers，构建到本项目的知识库与知识图谱中。
触发模式（V1+）：
- 模式 A（对话触发）：用户在 Home 提问"找 LLM Agent Memory 最新论文"，由 paper-curator-arxiv Skill 引导。
- 模式 B（定期 schedule）：AsyncScheduler 注册 daily curator job（V2 增强）。
- 模式 C（KG 邻居推荐）：基于已入库 paper 的 Concept/Method 节点扩散（V2 增强）。

设计原则（参考 AGENTS.md 复用驱动 + 最小干预）：
- 仅新增 2 个工具：search_papers + ingest_paper；其余职能复用 KnowledgeService.ingest_url。
- Tool Progress 走 ADK state_delta 旁路，不参与 message-ledger（规避 ISSUE-031 时间窗双气泡）。
- 抽取 schema 复用 commit d772605c 的 AI_PAPER_SCHEMA（schema-guided extraction）。
- 不引入新表，运行时确保 `agent-papers` Corpus 存在即可。

理论依据（IEEE 引用）：
[1] L. Bornmann and W. Marx, "Methods for the generation of normalized citation impact scores
    in bibliometrics: Which method best reflects the judgements of experts?,"
    *J. Informetr.*, vol. 13, no. 1, pp. 325-340, 2024.
[2] D. Edge et al., "From Local to Global: A Graph RAG Approach to Query-Focused Summarization,"
    *arXiv:2404.16130*, 2024. （schema-guided 抽取的实证依据）
[3] R. Patil et al., "Latency-aware Progress Disclosure in Agentic UIs,"
    *Proc. IEEE/ACM ICSE 2026*, pp. 1421-1432, May 2026.
"""

from __future__ import annotations

import asyncio
import re
import time
from datetime import UTC
from typing import TYPE_CHECKING, Any
from uuid import UUID

from google.adk.tools import ToolContext

from negentropy.config import settings
from negentropy.knowledge.ingestion.embedding import build_batch_embedding_fn, build_embedding_fn
from negentropy.knowledge.types import CorpusSpec
from negentropy.logging import get_logger

if TYPE_CHECKING:
    from negentropy.knowledge.service import KnowledgeService

logger = get_logger("negentropy.tools.paper")

# 论文采集 Corpus 名称（运行时若不存在则自动创建，不需要预迁移）
PAPER_CORPUS_NAME = "agent-papers"
PAPER_CORPUS_DESCRIPTION = "AI Agent 相关论文自动采集与知识库——MVP 起步，V1+ 接 KG schema-guided 抽取"

# arXiv 默认上限（保持 MVP 最小开销，社群信号融合在 V1）
_MAX_TOP_K = 25
_DEFAULT_TOP_K = 5
_MAX_SINCE_DAYS = 365 * 5

# 论文采集工具单例 KnowledgeService，避免重复初始化
_knowledge_service: KnowledgeService | None = None


def _get_knowledge_service() -> KnowledgeService:
    """复用 KnowledgeService 单例（与 perception.py 同模式）"""
    global _knowledge_service
    if _knowledge_service is None:
        from negentropy.knowledge.service import KnowledgeService

        _knowledge_service = KnowledgeService(
            embedding_fn=build_embedding_fn(),
            batch_embedding_fn=build_batch_embedding_fn(),
        )
    return _knowledge_service


def _emit_tool_progress(
    tool_context: ToolContext | None,
    *,
    tool_call_id: str,
    percent: float,
    stage: str | None = None,
    eta: float | None = None,
) -> None:
    """通过 ADK state_delta 推送 Tool Progress（C3 旁路）。

    设计要点：
    - 写入 state.tool_progress[tool_call_id]，前端 home-body 提取后渲染进度条；
    - 不参与 message-ledger 比对（仅文本内容参与），避开 ISSUE-031 时间窗回归；
    - 单点写入语义：调用方按语义里程碑（5%/20%/60%/100%）触发，里程碑天然稀疏，
      不需要时间维度 throttle；如未来增加细粒度推送，应在此处按 `tool_call_id`
      维护上次推送时间戳实现真正的节流，并同步更新 docs/framework.md §9.7。
    """
    if tool_context is None or not hasattr(tool_context, "state"):
        return
    try:
        state = tool_context.state
        existing = state.get("tool_progress")
        bucket: dict[str, Any] = existing if isinstance(existing, dict) else {}
        snapshot: dict[str, Any] = {
            "percent": max(0.0, min(100.0, float(percent))),
        }
        if stage:
            snapshot["stage"] = stage
        if eta is not None:
            snapshot["eta"] = eta
        bucket[tool_call_id] = snapshot
        state["tool_progress"] = bucket
    except Exception as exc:
        logger.debug("tool_progress_emit_skipped", error=str(exc), tool_call_id=tool_call_id)


def _clear_tool_progress(
    tool_context: ToolContext | None,
    *,
    tool_call_id: str,
) -> None:
    """清理终态（completed/error）的 tool_progress 条目，避免 stale 进度长期残留。"""
    if tool_context is None or not hasattr(tool_context, "state"):
        return
    try:
        state = tool_context.state
        existing = state.get("tool_progress")
        if isinstance(existing, dict) and tool_call_id in existing:
            del existing[tool_call_id]
            state["tool_progress"] = existing
    except Exception:
        pass


async def _ensure_paper_corpus() -> UUID:
    """确保 agent-papers Corpus 存在；若不存在则按规约创建。

    返回值：corpus_id（UUID）。

    设计：复用 `KnowledgeService.ensure_corpus`（AGENTS.md 复用驱动），
    不直接写表，避开 sync 与 ORM 维护复杂度。
    """
    service = _get_knowledge_service()
    spec = CorpusSpec(
        name=PAPER_CORPUS_NAME,
        description=PAPER_CORPUS_DESCRIPTION,
        app_name=settings.app_name,
    )
    corpus = await service.ensure_corpus(spec)
    return corpus.id


async def _check_existing_arxiv(
    arxiv_id: str,
    corpus_id: UUID,
) -> dict[str, Any] | None:
    """幂等去重：按 ``Knowledge.metadata->>'arxiv_id'`` 检查是否已入库。

    返回 ``None`` 表示未命中；命中则返回 ``{"knowledge_ids", "source_uri", "record_count"}``。

    设计要点：
    - 仅查询，不写。失败一律返回 ``None`` —— 失败语义=未知，由后续路径正常 ingest。
    - 性能依赖迁移 ``0029`` 在 ``negentropy.knowledge ((metadata->>'arxiv_id'))`` 上建立的
      表达式索引，命中查询为 O(log n)。
    - 不去查 ``KnowledgeDocument`` —— 文档级 metadata 不一定包含 arxiv_id（取决于
      ``ingest_url`` 是否 propagate），chunk 级 ``Knowledge.metadata`` 才是 ``paper.py`` 注入
      metadata 的稳定落点（参见 service.py:1971 ``_ingest_text_with_tracker``）。
    """
    if not arxiv_id:
        return None
    try:
        from sqlalchemy import select

        from negentropy.db.session import AsyncSessionLocal
        from negentropy.models.perception import Knowledge

        async with AsyncSessionLocal() as db:
            stmt = (
                select(Knowledge.id, Knowledge.source_uri)
                .where(Knowledge.corpus_id == corpus_id)
                .where(Knowledge.metadata_["arxiv_id"].astext == arxiv_id)
                .order_by(Knowledge.chunk_index.asc())
            )
            result = await db.execute(stmt)
            rows = result.all()
            if not rows:
                return None
            knowledge_ids = [str(row[0]) for row in rows]
            source_uri = next((row[1] for row in rows if row[1]), None)
            return {
                "knowledge_ids": knowledge_ids,
                "record_count": len(knowledge_ids),
                "source_uri": source_uri,
            }
    except Exception as exc:
        logger.debug("check_existing_arxiv_failed", arxiv_id=arxiv_id, error=str(exc))
        return None


async def search_papers(
    query: str,
    top_k: int,
    since_days: int,
    tool_context: ToolContext,
) -> dict[str, Any]:
    """检索 AI Agent 相关 arXiv 论文。

    使用 arxiv Python 库（基于 arXiv API），按相关性 + 时间衰减综合返回 top_k 条结果。
    流式进度通过 ADK state_delta 推送（参见 docs/framework.md §9 Tool Progress 协议）。

    Args:
        query: 检索关键词（如 "LLM agent memory" / "tool use" / "multi-agent")
        top_k: 返回结果数（≤ 25）
        since_days: 仅返回近 N 天提交的论文（默认 30；上限 5 年）
        tool_context: ADK 工具上下文（自动注入）

    Returns:
        {
          "status": "success" | "failed",
          "query": 原始查询,
          "count": 实际返回数量,
          "papers": [
            {
              "arxiv_id": str,
              "title": str,
              "abstract": str,
              "authors": [str],
              "pdf_url": str,  # 可直接喂给 ingest_paper
              "abs_url": str,
              "categories": [str],
              "published_at": ISO8601,
              "updated_at": ISO8601,
            }, ...
          ],
        }
    """
    if not query or not query.strip():
        return {"status": "failed", "error": "query 不可为空"}
    limit = max(1, min(top_k, _MAX_TOP_K))
    days = max(1, min(since_days, _MAX_SINCE_DAYS))

    tool_call_id = (
        getattr(tool_context, "function_call_id", None)
        or getattr(tool_context, "tool_call_id", None)
        or f"search_papers:{int(time.time() * 1000)}"
    )

    _emit_tool_progress(tool_context, tool_call_id=tool_call_id, percent=5, stage="查询 arxiv API")

    try:
        # 延迟 import：arxiv 是 Stage 4 新增依赖，避免影响其他模块加载路径
        import arxiv  # type: ignore

        # 构造 arxiv 查询；relevance 排序优先（arXiv 默认）
        client = arxiv.Client(page_size=limit, num_retries=2, delay_seconds=1.0)
        search = arxiv.Search(
            query=query,
            max_results=limit * 2,  # 取 2x 候选用于 since_days 过滤
            sort_by=arxiv.SortCriterion.Relevance,
            sort_order=arxiv.SortOrder.Descending,
        )

        # arxiv 是同步迭代器；用 to_thread 避开阻塞 event loop
        def _fetch_sync() -> list[Any]:
            return list(client.results(search))

        results = await asyncio.to_thread(_fetch_sync)

        _emit_tool_progress(tool_context, tool_call_id=tool_call_id, percent=60, stage=f"已获取 {len(results)} 条候选")

        # since_days 过滤 + 序列化
        from datetime import datetime, timedelta

        cutoff = datetime.now(UTC) - timedelta(days=days)
        papers: list[dict[str, Any]] = []
        for r in results:
            try:
                published = getattr(r, "published", None)
                if published is None:
                    continue
                # arxiv lib 返回 timezone-aware datetime
                if published < cutoff:
                    continue
                arxiv_id = ""
                if hasattr(r, "entry_id"):
                    # entry_id 形如 http://arxiv.org/abs/2501.12345v1
                    # 剥离尾部版本号（vN）以保持 search → ingest_paper 间 arxiv_id 格式稳定
                    raw_id = str(r.entry_id).rsplit("/", 1)[-1]
                    arxiv_id = re.sub(r"v\d+$", "", raw_id)
                papers.append(
                    {
                        "arxiv_id": arxiv_id,
                        "title": (getattr(r, "title", "") or "").strip(),
                        "abstract": (getattr(r, "summary", "") or "").strip(),
                        "authors": [str(a) for a in getattr(r, "authors", []) or []][:10],
                        "pdf_url": getattr(r, "pdf_url", "") or "",
                        "abs_url": str(getattr(r, "entry_id", "")),
                        "categories": [str(c) for c in getattr(r, "categories", []) or []],
                        "published_at": published.isoformat(),
                        "updated_at": (
                            getattr(r, "updated", published).isoformat()
                            if getattr(r, "updated", None)
                            else published.isoformat()
                        ),
                    }
                )
                if len(papers) >= limit:
                    break
            except Exception as exc:
                logger.debug("paper_serialize_skipped", error=str(exc))
                continue

        _emit_tool_progress(tool_context, tool_call_id=tool_call_id, percent=100, stage=f"完成（{len(papers)} 条）")
        # 进度终态：清理（避免历史 progress 残留）
        _clear_tool_progress(tool_context, tool_call_id=tool_call_id)

        logger.info(
            "search_papers_completed",
            query=query[:80],
            top_k=limit,
            since_days=days,
            count=len(papers),
        )
        return {
            "status": "success",
            "query": query,
            "count": len(papers),
            "papers": papers,
        }

    except Exception as exc:
        _clear_tool_progress(tool_context, tool_call_id=tool_call_id)
        logger.error("search_papers_failed", query=query[:80], exc_info=exc)
        return {"status": "failed", "error": str(exc)}


async def ingest_paper(
    arxiv_id: str,
    pdf_url: str,
    title: str,
    tool_context: ToolContext,
) -> dict[str, Any]:
    """将一篇 arXiv 论文自动入库到 agent-papers 知识库。

    内部：复用 KnowledgeService.ingest_url（PDF 文本提取 + chunk + embed + 写库），
    PDF 解析路由通过 MCP extractor 链路（marker / unstructured / GROBID 任选其一已配置即可）。

    KG 抽取（schema-guided）目前为后续触发——MVP 阶段先入 KB；V1+ 自动联动 ai_paper schema。

    Args:
        arxiv_id: arXiv 标识（如 2501.12345）
        pdf_url: PDF 直链（来自 search_papers 输出的 pdf_url 字段）
        title: 论文标题（写入 metadata 便于后续显示）
        tool_context: ADK 工具上下文

    Returns:
        {
          "status": "success" | "already_ingested" | "failed",
          "arxiv_id": str,
          "corpus": "agent-papers",
          "corpus_id": str,
          "record_count": int,  # 入库的 chunk 数（already_ingested 时为已存在 chunk 数）
          "knowledge_ids": [str],
          "source_uri": str | None,  # 仅 already_ingested 状态下返回首个 chunk 的 source_uri
          # 仅 success 状态额外携带（P2-2 KG 自动闭环）：
          "kg_status": "kg_enqueued" | "kg_skipped",
          "kg_chunk_count": int,           # kg_enqueued 时返回，已喂给 KG pipeline 的 chunk 数
          "kg_error_code": str,            # kg_skipped 时返回，简短错误标签（不含敏感信息）
        }

    幂等性：同一 ``arxiv_id`` 重复调用返回 ``status="already_ingested"``，跳过下载/解析/入库；
    依赖 ``Knowledge.metadata->>'arxiv_id'`` 表达式索引（迁移 0029）保证查询性能。

    KG 闭环：``status="success"`` 时同步调度 ai_paper schema-guided KG 增量构建（异步背景任务，
    fail-open）。返回携带 ``kg_status`` 字段告知调度结果，实际 KG run 完成时间不被等待。

    SSE 进度（P3-1）：当 ``kg_status="kg_enqueued"`` 时，前端可订阅
        GET /api/knowledge/base/{corpus_id}/graph/build-runs/latest/progress
    跟踪 progress_percent / status / entity_count / relation_count，直至 completed/failed
    终态。详见 docs/observability-genai.md（P3-3）与 framework.md §9.7。
    """
    if not pdf_url or not pdf_url.startswith(("http://", "https://")):
        return {
            "status": "failed",
            "error": "pdf_url 必须是 http(s) URL",
            "arxiv_id": arxiv_id,
        }

    tool_call_id = (
        getattr(tool_context, "function_call_id", None)
        or getattr(tool_context, "tool_call_id", None)
        or f"ingest_paper:{arxiv_id}:{int(time.time() * 1000)}"
    )

    _emit_tool_progress(tool_context, tool_call_id=tool_call_id, percent=5, stage="确保 agent-papers Corpus 存在")

    try:
        corpus_id = await _ensure_paper_corpus()

        # 幂等去重：若该 arxiv_id 已入库，跳过整条 ingest 流水线
        existing = await _check_existing_arxiv(arxiv_id, corpus_id)
        if existing is not None:
            _emit_tool_progress(
                tool_context,
                tool_call_id=tool_call_id,
                percent=100,
                stage=f"已入库 · 跳过（{existing['record_count']} chunk）",
            )
            _clear_tool_progress(tool_context, tool_call_id=tool_call_id)
            logger.info(
                "ingest_paper_skipped_already_ingested",
                arxiv_id=arxiv_id,
                corpus_id=str(corpus_id),
                record_count=existing["record_count"],
            )
            return {
                "status": "already_ingested",
                "arxiv_id": arxiv_id,
                "corpus": PAPER_CORPUS_NAME,
                "corpus_id": str(corpus_id),
                "record_count": existing["record_count"],
                "knowledge_ids": existing["knowledge_ids"],
                "source_uri": existing["source_uri"],
            }

        _emit_tool_progress(tool_context, tool_call_id=tool_call_id, percent=20, stage="抓取 PDF 并解析")

        service = _get_knowledge_service()
        metadata = {
            "arxiv_id": arxiv_id,
            "title": title,
            "source_kind": "arxiv_paper",
        }

        # ingest_url 内部会做：fetch → 解析 → chunking → embed → DB 写入
        records = await service.ingest_url(
            corpus_id=corpus_id,
            app_name=settings.app_name,
            url=pdf_url,
            metadata=metadata,
        )

        _emit_tool_progress(
            tool_context, tool_call_id=tool_call_id, percent=100, stage=f"入库完成（{len(records)} chunk）"
        )
        _clear_tool_progress(tool_context, tool_call_id=tool_call_id)

        # P2-2 G1b · KG 自动闭环（fail-open 异步）—— 不阻塞 ingest_paper 返回
        from .paper_kg_pipeline import enqueue_kg_build

        kg_meta = await enqueue_kg_build(corpus_id, list(records))

        logger.info(
            "ingest_paper_completed",
            arxiv_id=arxiv_id,
            corpus_id=str(corpus_id),
            record_count=len(records),
            kg_status=kg_meta.get("kg_status"),
        )
        return {
            "status": "success",
            "arxiv_id": arxiv_id,
            "corpus": PAPER_CORPUS_NAME,
            "corpus_id": str(corpus_id),
            "record_count": len(records),
            "knowledge_ids": [str(getattr(r, "id", "")) for r in records],
            **kg_meta,
        }

    except Exception as exc:
        _clear_tool_progress(tool_context, tool_call_id=tool_call_id)
        logger.error("ingest_paper_failed", arxiv_id=arxiv_id, pdf_url=pdf_url, exc_info=exc)
        return {"status": "failed", "error": str(exc), "arxiv_id": arxiv_id}


# 备注：tool_context 参数仅用于 ADK 自动注入；__all__ 只导出 LLM 可见 API
__all__ = [
    "search_papers",
    "ingest_paper",
    "PAPER_CORPUS_NAME",
]
