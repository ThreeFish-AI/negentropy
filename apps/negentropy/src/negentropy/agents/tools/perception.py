"""
Perception Faculty Tools - 感知系部专用工具

提供知识检索、Web 搜索等信息获取能力。

基于研究文档 [034-knowledge-base.md](https://github.com/ThreeFish-AI/agentic-ai-cognizes/blob/master/docs/research/034-knowledge-base.md)
和 [030-the-perception.md](https://github.com/ThreeFish-AI/agentic-ai-cognizes/blob/master/docs/concepts/030-the-perception.md)，
本工具集成混合检索 (Hybrid Search) 能力，支持语义、关键词和混合三种检索模式。

参考文献:
[1] P. Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks,"
    *Adv. Neural Inf. Process. Syst.*, vol. 33, pp. 9459-9474, 2020.
"""

from __future__ import annotations

import asyncio
import inspect
from collections.abc import Awaitable, Callable
from typing import TYPE_CHECKING, Any, Literal
from uuid import UUID

import httpx
from google.adk.tools import ToolContext
from sqlalchemy import select

import negentropy.db.session as db_session
from negentropy.config import settings
from negentropy.config.search import SearchProvider, SearchSettings
from negentropy.knowledge.constants import (
    DEFAULT_KEYWORD_WEIGHT,
    DEFAULT_SEMANTIC_WEIGHT,
)
from negentropy.knowledge.ingestion.embedding import build_batch_embedding_fn, build_embedding_fn
from negentropy.knowledge.types import SearchConfig
from negentropy.logging import get_logger
from negentropy.models.perception import Corpus

if TYPE_CHECKING:
    from negentropy.knowledge.service import KnowledgeService

logger = get_logger("negentropy.tools.perception")

_MAX_SNIPPET_CHARS = 500
_MAX_RESULTS_LIMIT = 20
_GOOGLE_SEARCH_URL = "https://www.googleapis.com/customsearch/v1"

# 全局 KnowledgeService 单例，避免重复初始化
_knowledge_service: KnowledgeService | None = None


# ----------------------------------------------------------------------------
# P2-3 G2 · Citation 规范化 helper（IEEE 风格）
# ----------------------------------------------------------------------------


def _format_citation(
    metadata: dict[str, Any] | None,
    source_uri: str | None,
    idx: int,
) -> str:
    """生成 IEEE 风格 citation 字符串：``[N] {first_author} et al., "{title}," arXiv:{id}, {year}.``

    旧记录无 arxiv_id 则退化为 ``[N] {source_uri or 'Unknown'}``。所有字段都是 best-effort，
    不抛异常。仅依赖 ``metadata`` 中可能存在的 ``arxiv_id`` / ``title`` / ``authors`` /
    ``published_at`` —— 这与 ``paper.py`` `ingest_paper` 注入的 metadata 兼容。

    设计动机（参见 docs/architecture/conversation-foundation.md §3 RAG + 引用机制）：
        Self-RAG 与 Corrective RAG 等近期工作均强调 retrieval 过程必须返回 stable citation
        token，让模型在生成阶段引用，从而把 hallucination 率压到可控。本 helper 是该
        契约的工程落点。

    Args:
        metadata: chunk 级 metadata（可能为 None）。
        source_uri: chunk 关联的源 URL（用于 fallback 与跳转）。
        idx: 1-based 引用序号（数组下标 + 1）。

    Returns:
        single-line citation 字符串（前端渲染时按 ``[N]`` 解析尾注）。
    """
    meta = metadata or {}
    arxiv_id = (meta.get("arxiv_id") or "").strip()
    title = (meta.get("title") or "").strip()
    authors = meta.get("authors") or []
    if not isinstance(authors, list):
        authors = []
    first_author = ""
    if authors:
        first = authors[0]
        first_author = str(first).split(",")[0].strip() if first else ""
    year = ""
    published_at = (meta.get("published_at") or "").strip()
    if len(published_at) >= 4 and published_at[:4].isdigit():
        year = published_at[:4]

    if arxiv_id:
        author_part = f"{first_author} et al., " if first_author else ""
        title_part = f'"{title}," ' if title else ""
        # year 缺席时直接以句点收尾，避免 ", " 与孤逗号污染（IEEE 风格保持一致）。
        if year:
            return f"[{idx}] {author_part}{title_part}arXiv:{arxiv_id}, {year}."
        return f"[{idx}] {author_part}{title_part}arXiv:{arxiv_id}."

    # 退化路径：无 arxiv_id 时使用 source_uri，仍尽量保留 title
    if title:
        suffix = f" — {source_uri}" if source_uri else ""
        return f'[{idx}] "{title}"{suffix}'
    return f"[{idx}] {source_uri or 'Unknown source'}"


def _get_knowledge_service() -> KnowledgeService:
    """获取 KnowledgeService 单例

    遵循 AGENTS.md 的复用驱动原则，复用已初始化的服务实例。
    """
    global _knowledge_service
    if _knowledge_service is None:
        from negentropy.knowledge.service import KnowledgeService

        _knowledge_service = KnowledgeService(
            embedding_fn=build_embedding_fn(),
            batch_embedding_fn=build_batch_embedding_fn(),
        )
    return _knowledge_service


async def _call_with_retry(
    coro_factory: Callable[[], Awaitable[Any]],
    *,
    max_retries: int,
    base_backoff: float,
    timeout: float,
    context: str = "",
) -> Any:
    """带指数退避重试的异步调用

    参考 embedding.py 的重试模式，实现网络请求的弹性处理。

    Args:
        coro_factory: 返回协程的工厂函数（每次重试创建新协程）
        max_retries: 最大重试次数
        base_backoff: 基础退避秒数
        timeout: 单次调用超时秒数
        context: 上下文描述（用于日志）

    Returns:
        协程返回值

    Raises:
        最后一次重试的异常
    """
    last_exc = None
    for attempt in range(1, max_retries + 1):
        try:
            return await asyncio.wait_for(coro_factory(), timeout=timeout)
        except TimeoutError:
            last_exc = TimeoutError(f"Search API timed out after {timeout}s")
            logger.warning(
                "search_timeout",
                attempt=attempt,
                max_retries=max_retries,
                timeout=timeout,
                context=context,
            )
        except httpx.HTTPStatusError as exc:
            # 4xx 错误（配置错误）不重试
            if exc.response.status_code < 500:
                last_exc = exc
                logger.error(
                    "search_http_error",
                    status_code=exc.response.status_code,
                    context=context,
                )
                raise
            # 5xx 错误重试
            last_exc = exc
            logger.warning(
                "search_http_error_retry",
                attempt=attempt,
                max_retries=max_retries,
                status_code=exc.response.status_code,
                context=context,
            )
        except (httpx.NetworkError, httpx.RemoteProtocolError) as exc:
            last_exc = exc
            logger.warning(
                "search_network_error",
                attempt=attempt,
                max_retries=max_retries,
                error=str(exc),
                context=context,
            )
        except Exception as exc:
            last_exc = exc
            logger.warning(
                "search_retry",
                attempt=attempt,
                max_retries=max_retries,
                error=str(exc),
                context=context,
            )

        if attempt < max_retries:
            backoff = base_backoff * (2 ** (attempt - 1))
            await asyncio.sleep(backoff)

    raise last_exc


async def search_knowledge_base(
    query: str,
    top_k: int,
    tool_context: ToolContext,
    search_mode: Literal["semantic", "keyword", "hybrid"] = "hybrid",
    semantic_weight: float = DEFAULT_SEMANTIC_WEIGHT,
    keyword_weight: float = DEFAULT_KEYWORD_WEIGHT,
) -> dict[str, Any]:
    """在知识库中检索相关信息 (混合检索)

    支持三种检索模式:
    - **semantic**: 基于向量相似度的语义检索
    - **keyword**: 基于 BM25 的关键词检索
    - **hybrid**: 融合语义和关键词的混合检索 (默认)

    Args:
        query: 搜索查询文本
        top_k: 返回结果数量
        search_mode: 检索模式 ("semantic" | "keyword" | "hybrid")
        semantic_weight: 语义检索权重 (0.0-1.0)
        keyword_weight: 关键词检索权重 (0.0-1.0)

    Returns:
        包含检索结果的字典，包含相关性分数:
        - semantic_score: 语义相似度分数
        - keyword_score: 关键词匹配分数
        - combined_score: 融合分数
    """
    if top_k <= 0:
        return {"status": "failed", "error": "top_k must be positive"}
    limit = min(top_k, _MAX_RESULTS_LIMIT)

    # 用户 @ Corpus 范围（来自 Home Composer 的 forwardedProps.corpus_ids
    # → BFF state_delta → ADK session.state → tool_context.state）。命中时仅在
    # 指定语料库内检索；未命中则保持原"全 Corpus 聚合"行为。是否进入 graph
    # expansion 路径由 HybridPlanner 自主判定，不再受前端强制信号驱动。
    scoped_ids: list[str] | None = None
    if tool_context is not None and getattr(tool_context, "state", None):
        raw_scope = tool_context.state.get("corpus_ids")
        if isinstance(raw_scope, list) and raw_scope:
            scoped_ids = [s for s in raw_scope if isinstance(s, str) and s]

    # Feature flag gate: 当 enable_cross_corpus_kg=True 且 corpus_ids 非空时
    # 走 HybridPlanner 四阶段管线；否则保持现有 legacy 路径，确保灰度回退安全。
    try:
        from negentropy.config.knowledge import KnowledgeSettings

        kb_settings = KnowledgeSettings()
        feature_flags = getattr(kb_settings, "feature_flags", None)
        use_planner = bool(
            feature_flags is not None and getattr(feature_flags, "enable_cross_corpus_kg", False) and scoped_ids
        )
    except Exception:  # noqa: BLE001 — 任何配置异常都回退到 legacy
        use_planner = False

    if use_planner:
        try:
            return await _planner_search_knowledge_base(
                query=query,
                top_k=limit,
                scoped_ids=scoped_ids or [],
                tool_context=tool_context,
            )
        except Exception as exc:  # noqa: BLE001 — Stage 异常降级到 legacy
            logger.warning("planner_fallback_to_legacy", error=str(exc))

    logger.info(
        "knowledge_search_started",
        query=query[:100],
        mode=search_mode,
        limit=limit,
        semantic_weight=semantic_weight,
        keyword_weight=keyword_weight,
        corpus_ids=scoped_ids,
    )

    try:
        # 获取所有可用的语料库（按 scoped_ids 限定）
        async with db_session.AsyncSessionLocal() as db:
            stmt = select(Corpus).where(Corpus.app_name == settings.app_name)
            if scoped_ids:
                stmt = stmt.where(Corpus.id.in_(scoped_ids))
            result = await db.execute(stmt)
            corpora = result.scalars().all()

        if not corpora:
            logger.warning(
                "no_corpora_found",
                app_name=settings.app_name,
                corpus_ids=scoped_ids,
            )
            return await _fallback_to_memory_search(query, limit, tool_context)

        # 使用混合检索从所有语料库中搜索
        service = _get_knowledge_service()
        config = SearchConfig(
            mode=search_mode,
            limit=limit,
            semantic_weight=semantic_weight,
            keyword_weight=keyword_weight,
        )

        all_results = []
        for corpus in corpora:
            try:
                matches = await service.search(
                    corpus_id=corpus.id,
                    app_name=settings.app_name,
                    query=query,
                    config=config,
                )
                for match in matches:
                    content = match.content
                    truncated = len(content) > _MAX_SNIPPET_CHARS
                    snippet = content[:_MAX_SNIPPET_CHARS] if truncated else content
                    all_results.append(
                        {
                            "id": str(match.id),
                            "corpus": corpus.name,
                            "corpus_id": str(corpus.id),
                            "source_uri": match.source_uri,
                            "chunk_index": 0,  # KnowledgeMatch 不包含 chunk_index
                            "snippet": snippet,
                            "truncated": truncated,
                            "metadata": match.metadata,
                            # 相关性分数
                            "semantic_score": round(match.semantic_score, 4),
                            "keyword_score": round(match.keyword_score, 4),
                            "combined_score": round(match.combined_score, 4),
                            # citation 字段稍后按最终排序后的 idx 注入
                        }
                    )
            except Exception as exc:
                # 单个语料库搜索失败不影响其他语料库
                logger.warning(
                    "corpus_search_failed",
                    corpus_id=str(corpus.id),
                    corpus_name=corpus.name,
                    error=str(exc),
                )
                continue

        # 按融合分数排序并限制返回数量
        all_results.sort(key=lambda x: x["combined_score"], reverse=True)
        all_results = all_results[:limit]

        # P2-3 G2 · Citation 规范化：按最终排序顺序注入 citation_id + formatted_citation
        for idx, result in enumerate(all_results, start=1):
            result["citation_id"] = idx
            result["formatted_citation"] = _format_citation(
                metadata=result.get("metadata"),
                source_uri=result.get("source_uri"),
                idx=idx,
            )

        logger.info(
            "knowledge_search_completed",
            query=query[:100],
            mode=search_mode,
            result_count=len(all_results),
        )

        if all_results:
            return {
                "status": "success",
                "query": query,
                "count": len(all_results),
                "results": all_results,
                "search_mode": search_mode,
            }

        # 知识库为空或无结果时，回退到 Memory 搜索
        return await _fallback_to_memory_search(query, limit, tool_context)

    except Exception as exc:
        logger.error("knowledge_base_search_failed", exc_info=exc)
        return {"status": "failed", "error": str(exc)}


async def _fallback_to_memory_search(query: str, limit: int, tool_context: ToolContext) -> dict[str, Any]:
    """回退到 ADK MemoryService 搜索

    当知识库为空或检索失败时，使用 MemoryService 作为回退方案。
    同时通过 ContextAssembler 注入记忆上下文增强检索。
    """
    # 先尝试通过 ContextAssembler 获取记忆摘要
    memory_context = ""
    try:
        from negentropy.engine.adapters.postgres.context_assembler import ContextAssembler

        assembler = ContextAssembler()
        memory_context = await assembler.get_memory_summary(
            user_id=getattr(tool_context, "user_id", ""),
            app_name=settings.app_name,
        )
    except Exception as exc:
        logger.debug("context_assembler_fallback", error=str(exc))
    if not (tool_context and hasattr(tool_context, "search_memory")):
        return {
            "status": "success",
            "query": query,
            "count": 0,
            "results": [],
            "search_mode": "memory_fallback",
            "memory_context": memory_context,
        }

    memory_results = tool_context.search_memory(query)
    if inspect.isawaitable(memory_results):
        memory_results = await memory_results
    memories = getattr(memory_results, "memories", memory_results) or []

    fallback = []
    for entry in memories[:limit]:
        content = entry.content if hasattr(entry, "content") else {}
        text = ""
        if isinstance(content, dict):
            parts = content.get("parts", [])
            if parts and isinstance(parts[0], dict):
                text = parts[0].get("text", "")
        fallback.append(
            {
                "id": getattr(entry, "id", None),
                "corpus": "memory",
                "corpus_id": None,
                "source_uri": None,
                "chunk_index": 0,
                "snippet": text[:_MAX_SNIPPET_CHARS],
                "truncated": len(text) > _MAX_SNIPPET_CHARS,
                "metadata": (getattr(entry, "custom_metadata", {}) if hasattr(entry, "custom_metadata") else {}),
                "semantic_score": 0.0,
                "keyword_score": 0.0,
                "combined_score": 0.0,
            }
        )

    logger.info("memory_fallback_completed", query=query[:100], result_count=len(fallback))

    return {
        "status": "success",
        "query": query,
        "count": len(fallback),
        "results": fallback,
        "search_mode": "memory_fallback",
        "memory_context": memory_context,
    }


# ============================================================================
# HybridPlanner 路径（P2-3 Cross-Corpus KG + Citation Corpus Label）
# ============================================================================


def _resolve_corpus_label(corpus_name: str | None, corpus_id: str | None) -> str:
    """生成 citation 中的 Corpus 来源徽章文本"""
    if corpus_name:
        return str(corpus_name)
    if corpus_id:
        return f"corpus:{corpus_id[:8]}"
    return "unknown"


async def _planner_search_knowledge_base(
    *,
    query: str,
    top_k: int,
    scoped_ids: list[str],
    tool_context: ToolContext,  # noqa: ARG001  # 预留 RBAC user 上下文注入
) -> dict[str, Any]:
    """HybridPlanner 路径：四阶段管线 + bridges + Citation Corpus 来源徽章

    返回结构兼容 legacy search_knowledge_base：
      {status, query, count, results: [...], search_mode}
    新增字段：
      - intent / expansion_triggered / stage_latencies_ms（顶层）
      - results[i].corpus_label / evidence_type / bridge_path
      - bridges: list[EvidenceChain dict]（顶层）

    设计取舍：scoped_ids 即用户 @ Corpus 的全集；是否进入 graph expansion
    由 Planner.plan 内部 Intent Classifier 自主判定，不再受前端强制信号驱动。
    """
    from negentropy.agents.tools.hybrid_planner import (
        PlannerConfig,
        configure_planner,
        get_planner,
    )
    from negentropy.knowledge.retrieval.reranking import LocalReranker

    # 单例注入
    planner = get_planner()
    if planner._kb is None:  # noqa: SLF001
        configure_planner(knowledge_service=_get_knowledge_service())
    if planner._reranker is None:  # noqa: SLF001
        try:
            configure_planner(reranker=LocalReranker())
        except Exception as exc:  # noqa: BLE001  reranker 加载失败不阻塞
            logger.warning("planner_reranker_init_failed", error=str(exc))

    effective_scoped = list(dict.fromkeys(scoped_ids or []))
    if not effective_scoped:
        return {"status": "failed", "error": "no scoped corpus ids"}

    # 解析 app_name 下的所有可访问 corpus（暂以 settings.app_name 为 accessible 集合
    # 兜底；Phase 2 后续可接入 user RBAC 视图）
    async with db_session.AsyncSessionLocal() as db:
        corpora_rows = (await db.execute(select(Corpus).where(Corpus.app_name == settings.app_name))).scalars().all()
    accessible = frozenset(str(c.id) for c in corpora_rows)
    corpus_name_by_id = {str(c.id): c.name for c in corpora_rows}

    result = await planner.plan(
        query=query,
        scoped_corpus_ids=effective_scoped,
        accessible_corpus_ids=accessible,
        top_k=top_k,
        config=PlannerConfig(),
        app_name=settings.app_name,
    )

    # 映射到 legacy 返回结构 + 注入 corpus_label + citation
    items: list[dict[str, Any]] = []
    for idx, cand in enumerate(result.results, start=1):
        corpus_name = corpus_name_by_id.get(cand.corpus_id, cand.corpus_name)
        snippet = (cand.content or "")[:_MAX_SNIPPET_CHARS]
        items.append(
            {
                "id": cand.chunk_id,
                "corpus": corpus_name,
                "corpus_id": cand.corpus_id,
                "corpus_label": _resolve_corpus_label(corpus_name, cand.corpus_id),
                "source_uri": cand.source_uri,
                "chunk_index": 0,
                "snippet": snippet,
                "truncated": bool(cand.content and len(cand.content) > _MAX_SNIPPET_CHARS),
                "metadata": cand.metadata,
                "semantic_score": round(cand.semantic_score, 4),
                "keyword_score": round(cand.keyword_score, 4),
                "graph_score": round(cand.graph_score, 4),
                "combined_score": round(cand.fusion_score, 4),
                "rerank_score": (round(cand.rerank_score, 4) if cand.rerank_score is not None else None),
                "evidence_type": cand.evidence_type,
                "bridge_path": cand.bridge_path,
                "citation_id": idx,
                "formatted_citation": _format_citation(metadata=cand.metadata, source_uri=cand.source_uri, idx=idx),
            }
        )

    bridges_payload = [
        {
            "source_chunk_id": b.source_chunk_id,
            "source_corpus_id": b.source_corpus_id,
            "source_corpus_label": _resolve_corpus_label(corpus_name_by_id.get(b.source_corpus_id), b.source_corpus_id),
            "target_chunk_id": b.target_chunk_id,
            "target_corpus_id": b.target_corpus_id,
            "target_corpus_label": _resolve_corpus_label(corpus_name_by_id.get(b.target_corpus_id), b.target_corpus_id),
            "via_canonical_name": b.via_canonical_name,
            "hop_count": b.hop_count,
        }
        for b in result.bridges
    ]

    logger.info(
        "planner_search_completed",
        query=query[:100],
        intent=result.intent,
        result_count=len(items),
        bridge_count=len(bridges_payload),
        expansion_triggered=result.expansion_triggered,
        stage_latencies_ms=result.stage_latencies_ms,
    )

    return {
        "status": "success",
        "query": query,
        "count": len(items),
        "results": items,
        "search_mode": "hybrid_planner",
        "intent": result.intent,
        "expansion_triggered": result.expansion_triggered,
        "stage_latencies_ms": result.stage_latencies_ms,
        "bridges": bridges_payload,
    }


async def search_knowledge_graph_global(
    query: str,
    tool_context: ToolContext,
    max_communities: int = 5,
) -> dict[str, Any]:
    """GraphRAG 风格全局检索：基于社区摘要做 Map-Reduce 汇总

    当问题明显是「主题概览 / 整体趋势 / 核心观点」类（关键词：主题/概览/总体/核心
    overall/key topics）时调用此工具。

    与 ``search_knowledge_base`` 互斥：不要在同一轮同时调用二者。

    参考文献：
      [1] D. Edge et al., "From Local to Global: A Graph RAG Approach to
          Query-Focused Summarization," arXiv:2404.16130, 2024.

    Args:
        query: 全局摘要级问题
        tool_context: ADK 注入；读取 corpus_ids
        max_communities: 每 Corpus 最多取多少社区摘要参与 Map 阶段

    Returns:
        多 Corpus 聚合结果：
          ``{status, query, corpus_count, per_corpus: [{corpus_id, corpus_label,
          answer, evidence, candidates_total, latency_ms, summaries_dirty}, ...]}``
    """
    from dataclasses import asdict

    scoped_ids: list[str] = []
    if tool_context is not None and getattr(tool_context, "state", None):
        raw = tool_context.state.get("corpus_ids")
        if isinstance(raw, list) and raw:
            scoped_ids.extend(s for s in raw if isinstance(s, str) and s)

    if not scoped_ids:
        return {
            "status": "failed",
            "error": "search_knowledge_graph_global requires @corpus mention",
        }

    valid_ids = [UUID(c) for c in scoped_ids if _is_uuid(c)]
    if not valid_ids:
        return {"status": "failed", "error": "no valid corpus UUIDs in scope"}

    try:
        from negentropy.knowledge.graph.global_search import GlobalSearchService  # type: ignore
    except Exception as exc:  # noqa: BLE001
        logger.warning("global_search_unavailable", error=str(exc))
        return {
            "status": "failed",
            "error": "GlobalSearchService not available; falling back to search_knowledge_base.",
        }

    # 计算 query embedding（与 GraphService.search 同款）；失败 → None，
    # GlobalSearchService 会按 entity_count DESC fallback。
    try:
        embedding_fn = build_embedding_fn()
        query_embedding = (
            await embedding_fn(query) if inspect.iscoroutinefunction(embedding_fn) else embedding_fn(query)
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("global_search_embedding_failed", error=str(exc))
        query_embedding = None

    # 解析 corpus 显示名（用于来源徽章）—— 单次会话内拉一次
    async with db_session.AsyncSessionLocal() as db:
        rows = (
            (
                await db.execute(
                    select(Corpus).where(
                        Corpus.app_name == settings.app_name,
                        Corpus.id.in_(valid_ids),
                    )
                )
            )
            .scalars()
            .all()
        )
    corpus_name_by_id = {str(c.id): c.name for c in rows}

    svc = GlobalSearchService()

    async def _one(corpus_id: UUID) -> dict[str, Any]:
        # 每个 corpus 独立开 session：GlobalSearchService.search 要求 db 是第一位
        # positional arg（见 knowledge/graph/global_search.py:116）。
        async with db_session.AsyncSessionLocal() as db:
            try:
                result = await svc.search(
                    db=db,
                    corpus_id=corpus_id,
                    query=query,
                    query_embedding=query_embedding,
                    max_communities=max_communities,
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("global_search_per_corpus_failed", corpus_id=str(corpus_id), error=str(exc))
                return {
                    "corpus_id": str(corpus_id),
                    "corpus_label": _resolve_corpus_label(corpus_name_by_id.get(str(corpus_id)), str(corpus_id)),
                    "status": "failed",
                    "error": str(exc),
                }
        payload = asdict(result)
        payload["corpus_id"] = str(corpus_id)
        payload["corpus_label"] = _resolve_corpus_label(corpus_name_by_id.get(str(corpus_id)), str(corpus_id))
        payload["status"] = "success"
        return payload

    per_corpus = await asyncio.gather(*[_one(cid) for cid in valid_ids])
    succeeded = [p for p in per_corpus if p.get("status") == "success"]
    if not succeeded:
        return {
            "status": "failed",
            "query": query,
            "corpus_count": len(per_corpus),
            "per_corpus": per_corpus,
            "error": "all per-corpus global searches failed",
        }
    return {
        "status": "success",
        "query": query,
        "corpus_count": len(per_corpus),
        "per_corpus": per_corpus,
    }


def _is_uuid(s: str) -> bool:
    try:
        UUID(str(s))
        return True
    except (ValueError, TypeError):
        return False


async def search_web(
    query: str,
    max_results: int,
    tool_context: ToolContext,
) -> dict[str, Any]:
    """执行 Web 搜索获取实时信息。

    使用 Google Custom Search API，内置重试机制。
    优先从 builtin_tools 注册中心读取配置，回退到环境变量/YAML。

    Args:
        query: 搜索查询
        max_results: 最大结果数
        tool_context: 工具上下文（ADK 自动注入）

    Returns:
        搜索结果字典，包含:
        - status: "success" | "failed"
        - query: 原始查询
        - count: 结果数量
        - results: 搜索结果列表
        - source: 搜索提供商标识
    """
    if max_results <= 0:
        return {"status": "failed", "error": "max_results must be positive"}

    limit = min(max_results, _MAX_RESULTS_LIMIT)

    # 优先从 builtin_tools 注册中心读取配置
    search_config = await _resolve_search_config()

    logger.info(
        "web_search_started",
        query=query[:100],
        provider=search_config.provider.value,
        limit=limit,
        config_source="builtin_tools" if _last_config_source == "builtin_tools" else "env_vars",
    )

    # 检查配置
    if not search_config.is_google_configured():
        logger.error("google_search_not_configured")
        return {
            "status": "failed",
            "error": (
                "Google Search API not configured. "
                "Please configure it in Interface > Tools, or set NE_SEARCH_GOOGLE_API_KEY and NE_SEARCH_GOOGLE_CX_ID."
            ),
        }

    try:
        results = await _search_google(
            query=query,
            limit=limit,
            config=search_config,
        )

        logger.info(
            "web_search_completed",
            query=query[:100],
            result_count=len(results),
            provider=search_config.provider.value,
        )

        return {
            "status": "success",
            "query": query,
            "count": len(results),
            "results": results[:limit],
            "source": "google_custom_search",
        }

    except Exception as exc:
        logger.error("web_search_failed", query=query[:100], exc_info=exc)
        return {
            "status": "failed",
            "error": str(exc),
        }


# 配置来源追踪（用于日志标注）
_last_config_source: str = "env_vars"


async def _resolve_search_config() -> SearchSettings:
    """解析搜索配置：优先 builtin_tools 注册中心，回退到环境变量。"""
    global _last_config_source

    try:
        from negentropy.interface.tool_resolver import resolve_tool_config

        tool_config = await resolve_tool_config("google_search")
        if tool_config:
            _last_config_source = "builtin_tools"
            credentials = tool_config.get("credentials", {})
            api_key = credentials.get("api_key")
            return SearchSettings(
                provider=SearchProvider.GOOGLE,
                google_api_key=api_key,
                google_cx_id=tool_config.get("cx_id"),
                max_retries=tool_config.get("max_retries", 3),
                timeout_seconds=tool_config.get("timeout_seconds", 10.0),
                base_backoff_seconds=tool_config.get("base_backoff_seconds", 1.0),
                max_results=tool_config.get("max_results", 10),
            )
    except Exception as exc:
        logger.debug("search_config_registry_fallback", error=str(exc))

    _last_config_source = "env_vars"
    return settings.search


async def _search_google(
    query: str,
    limit: int,
    config: SearchSettings,
) -> list[dict[str, Any]]:
    """使用 Google Custom Search API 搜索。

    Args:
        query: 搜索查询
        limit: 最大结果数
        config: 搜索配置

    Returns:
        搜索结果列表
    """

    async def _do_search():
        api_key = config.google_api_key.get_secret_value()
        params = {
            "key": api_key,
            "cx": config.google_cx_id,
            "q": query,
            "num": min(limit, 10),  # Google API 单次最多返回 10 条
        }

        async with httpx.AsyncClient(timeout=config.timeout_seconds) as client:
            response = await client.get(_GOOGLE_SEARCH_URL, params=params)
            response.raise_for_status()
            return response.json()

    # 使用重试机制
    data = await _call_with_retry(
        _do_search,
        max_retries=config.max_retries,
        base_backoff=config.base_backoff_seconds,
        timeout=config.timeout_seconds,
        context=f"google_search({query[:50]})",
    )

    # 解析结果
    results = []
    for item in data.get("items", []):
        results.append(
            {
                "title": item.get("title", ""),
                "url": item.get("link", ""),
                "snippet": item.get("snippet", ""),
            }
        )

    # 如果需要更多结果，处理分页
    if limit > 10 and len(results) >= 10:
        next_page = data.get("queries", {}).get("nextPage")
        if next_page:
            start_index = next_page[0].get("startIndex", 11)
            remaining = limit - len(results)
            if remaining > 0:
                try:
                    page_results = await _search_google_page(
                        query=query,
                        limit=remaining,
                        config=config,
                        start_index=start_index,
                    )
                    results.extend(page_results)
                except Exception as exc:
                    logger.warning("google_search_page_failed", error=str(exc))

    return results[:limit]


async def _search_google_page(
    query: str,
    limit: int,
    config: SearchSettings,
    start_index: int,
) -> list[dict[str, Any]]:
    """获取 Google Custom Search API 的下一页结果。

    Args:
        query: 搜索查询
        limit: 最大结果数
        config: 搜索配置
        start_index: 起始索引

    Returns:
        搜索结果列表
    """

    async def _do_search():
        api_key = config.google_api_key.get_secret_value()
        params = {
            "key": api_key,
            "cx": config.google_cx_id,
            "q": query,
            "num": min(limit, 10),
            "start": start_index,
        }

        async with httpx.AsyncClient(timeout=config.timeout_seconds) as client:
            response = await client.get(_GOOGLE_SEARCH_URL, params=params)
            response.raise_for_status()
            return response.json()

    data = await _call_with_retry(
        _do_search,
        max_retries=config.max_retries,
        base_backoff=config.base_backoff_seconds,
        timeout=config.timeout_seconds,
        context=f"google_search_page({query[:50]})",
    )

    results = []
    for item in data.get("items", []):
        results.append(
            {
                "title": item.get("title", ""),
                "url": item.get("link", ""),
                "snippet": item.get("snippet", ""),
            }
        )

    return results[:limit]


# ----------------------------------------------------------------------------
# P2-3 G2 · KG 反向推荐工具：基于 ai_paper schema 抽取的实体反查相关论文
# ----------------------------------------------------------------------------


async def search_knowledge_graph_with_papers(
    query: str,
    top_k: int,
    tool_context: ToolContext,
) -> dict[str, Any]:
    """通过知识图谱（ai_paper schema）反查相关论文。

    使用场景：用户在 Home 对话中询问 "有哪些论文讨论 Transformer 架构" / "Reflexion
    路线最相关的论文"等概念性问题。本工具命中 ai_paper schema 抽取的 Concept / Method /
    Author 实体后，通过实体 metadata 反查关联的论文（arxiv_id），并附 IEEE 风格 citation。

    优先于 ``search_knowledge_base`` 调用：
        - 概念级问题 → 本工具（实体优先，召回率更高）
        - chunk 级原文片段 → ``search_knowledge_base``

    Args:
        query: 自然语言查询。
        top_k: 返回 paper 数量上限（≤ 20）。
        tool_context: ADK 工具上下文。

    Returns:
        - 成功且命中：``{"status": "success", "kg_status": "graph_hit",
          "papers": [{"arxiv_id", "title", "source_uri", "formatted_citation",
          "matched_entity", "score"}], "count"}``；
        - KG 空 / 无命中：``{"status": "success", "kg_status": "graph_empty",
          "papers": [], "fallback_hint": "...。建议改调 search_knowledge_base"}``；
        - 失败：``{"status": "failed", "error", "kg_status": "graph_error"}``。

    fail-soft：任何异常都不抛出，统一降级到 ``graph_empty`` / ``graph_error``，让 LLM
    自然回退到 ``search_knowledge_base``。
    """
    if not query or not query.strip():
        return {"status": "failed", "error": "query 不可为空", "kg_status": "graph_error"}
    limit = max(1, min(top_k, _MAX_RESULTS_LIMIT))

    try:
        # 锁定 agent-papers Corpus（与 paper.py PAPER_CORPUS_NAME 同源）
        async with db_session.AsyncSessionLocal() as db:
            stmt = select(Corpus).where(
                Corpus.app_name == settings.app_name,
                Corpus.name == "agent-papers",
            )
            result = await db.execute(stmt)
            corpus = result.scalar_one_or_none()

        if corpus is None:
            return {
                "status": "success",
                "kg_status": "graph_empty",
                "papers": [],
                "count": 0,
                "fallback_hint": "agent-papers Corpus 尚未建立。建议先调用 ingest_paper 入库一些论文。",
            }

        # 嵌入 query（GraphService.search 必需）
        try:
            embedding_fn = build_embedding_fn()
            query_embedding = (
                await embedding_fn(query) if inspect.iscoroutinefunction(embedding_fn) else embedding_fn(query)
            )
        except Exception as exc:
            logger.warning("kg_search_embedding_failed", error=str(exc))
            query_embedding = None

        # 调 GraphService.search 拿相关实体
        from negentropy.knowledge.graph.service import GraphService
        from negentropy.knowledge.types import GraphQueryConfig

        graph_service = GraphService()
        graph_result = await graph_service.search(
            corpus_id=corpus.id,
            app_name=settings.app_name,
            query=query,
            query_embedding=query_embedding,
            config=GraphQueryConfig(limit=limit),
        )

        if not graph_result.entities:
            return {
                "status": "success",
                "kg_status": "graph_empty",
                "papers": [],
                "count": 0,
                "fallback_hint": "知识图谱无相关实体。建议改调 search_knowledge_base 做语义检索。",
            }

        # 实体 → 关联论文（去重 by arxiv_id，保留最高分）
        papers_by_id: dict[str, dict[str, Any]] = {}
        for entity_result in graph_result.entities:
            entity = entity_result.entity
            entity_meta = getattr(entity, "metadata", None) or {}
            arxiv_id = (entity_meta.get("arxiv_id") or "").strip()
            source_uri = entity_meta.get("source_uri")
            title = (entity_meta.get("title") or "").strip()
            if not arxiv_id and not source_uri:
                continue
            key = arxiv_id or source_uri or ""
            score = float(getattr(entity_result, "combined_score", 0.0) or 0.0)
            if key in papers_by_id and papers_by_id[key]["score"] >= score:
                continue
            papers_by_id[key] = {
                "arxiv_id": arxiv_id or None,
                "title": title or None,
                "source_uri": source_uri,
                "matched_entity": getattr(entity, "name", None) or getattr(entity, "id", None),
                "score": round(score, 4),
                "_meta": entity_meta,
            }

        # 注入 IEEE citation
        papers_sorted = sorted(papers_by_id.values(), key=lambda p: p["score"], reverse=True)[:limit]
        for idx, paper in enumerate(papers_sorted, start=1):
            paper["citation_id"] = idx
            paper["formatted_citation"] = _format_citation(
                metadata=paper.pop("_meta", {}),
                source_uri=paper.get("source_uri"),
                idx=idx,
            )

        logger.info(
            "kg_search_with_papers_completed",
            query=query[:80],
            entity_count=len(graph_result.entities),
            paper_count=len(papers_sorted),
        )
        return {
            "status": "success",
            "kg_status": "graph_hit",
            "query": query,
            "count": len(papers_sorted),
            "papers": papers_sorted,
        }

    except Exception as exc:
        logger.warning("kg_search_with_papers_failed", error=str(exc))
        return {
            "status": "success",  # 仍返回 success 让 LLM 平滑降级
            "kg_status": "graph_error",
            "papers": [],
            "count": 0,
            "fallback_hint": f"KG 查询失败（{type(exc).__name__}）。建议改调 search_knowledge_base。",
        }
