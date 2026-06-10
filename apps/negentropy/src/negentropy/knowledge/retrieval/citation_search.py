"""带引用元数据的知识检索核心 — 脱离 ADK ToolContext 的单一事实源。

正交分解动机：``agents/tools/perception.py`` 的 ADK 工具与 ``knowledge/mcp_server.py``
的 MCP 工具（Routine 的 Claude Code 检索入口）需要**同一套**「检索 → snippet 截断 →
排序截顶 → citation 注入」逻辑。本模块承载该核心，调用方只做各自的上下文适配
（ToolContext 的 corpus scope / memory fallback 归 ADK 层；bearer 鉴权归 MCP 层）。

依赖约定：
- DB 会话经 ``negentropy.db.session`` 模块属性晚绑定（``db_session.AsyncSessionLocal()``），
  保持与既有单测的 patch 目标兼容；
- ``KnowledgeService`` 实例由调用方注入（各层维护自己的单例），本模块不持有全局状态。

参考文献:
[1] P. Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks,"
    *Adv. Neural Inf. Process. Syst.*, vol. 33, pp. 9459-9474, 2020.
[2] A. Asai et al., "Self-RAG: Learning to Retrieve, Generate, and Critique through
    Self-Reflection," arXiv:2310.11511, 2023.
"""

from __future__ import annotations

import asyncio
import inspect
from collections.abc import Sequence
from typing import TYPE_CHECKING, Any, Literal
from uuid import UUID

from sqlalchemy import select

import negentropy.db.session as db_session
from negentropy.knowledge.constants import (
    DEFAULT_KEYWORD_WEIGHT,
    DEFAULT_SEMANTIC_WEIGHT,
)
from negentropy.knowledge.types import SearchConfig
from negentropy.logging import get_logger
from negentropy.models.perception import Corpus

if TYPE_CHECKING:
    from negentropy.knowledge.service import KnowledgeService

logger = get_logger("negentropy.knowledge.citation_search")

MAX_SNIPPET_CHARS = 500
MAX_RESULTS_LIMIT = 20


def format_citation(
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


def resolve_corpus_label(corpus_name: str | None, corpus_id: str | None) -> str:
    """生成 citation 中的 Corpus 来源徽章文本"""
    if corpus_name:
        return str(corpus_name)
    if corpus_id:
        return f"corpus:{corpus_id[:8]}"
    return "unknown"


async def resolve_corpus_scope(
    *,
    app_name: str,
    filters: Sequence[str] | None = None,
) -> list[Corpus]:
    """解析检索作用域：``app_name`` 下全部 Corpus，可选按名称/UUID 混合过滤。

    Args:
        app_name: 应用名（Corpus 表分区键）。
        filters: Corpus 名称或 UUID 字符串的混合列表；为空时返回全部。

    Returns:
        命中的 Corpus ORM 对象列表（无命中返回空列表，由调用方决定降级策略）。
    """
    async with db_session.AsyncSessionLocal() as db:
        stmt = select(Corpus).where(Corpus.app_name == app_name)
        result = await db.execute(stmt)
        corpora = list(result.scalars().all())

    if not filters:
        return corpora

    wanted_ids: set[str] = set()
    wanted_names: set[str] = set()
    for f in filters:
        text = str(f).strip()
        if not text:
            continue
        try:
            wanted_ids.add(str(UUID(text)))
        except (ValueError, TypeError):
            wanted_names.add(text)

    return [c for c in corpora if str(c.id) in wanted_ids or c.name in wanted_names]


async def search_kb_with_citations(
    *,
    query: str,
    top_k: int,
    service: KnowledgeService,
    corpora: Sequence[Corpus],
    app_name: str,
    search_mode: Literal["semantic", "keyword", "hybrid"] = "hybrid",
    semantic_weight: float = DEFAULT_SEMANTIC_WEIGHT,
    keyword_weight: float = DEFAULT_KEYWORD_WEIGHT,
) -> dict[str, Any]:
    """多 Corpus 混合检索 + citation 注入（legacy 主干，自 perception 工具平移）。

    流程：逐 Corpus 调 ``service.search``（单库失败不中断）→ snippet 截断
    （``MAX_SNIPPET_CHARS``）→ 按 ``combined_score`` 降序截 ``top_k`` → 按最终
    顺序注入 ``citation_id`` + ``formatted_citation`` + ``corpus_label``。

    Returns:
        ``{status, query, count, results, search_mode}``；``count=0`` 不在本层做
        fallback（memory 回退等策略归调用方）。
    """
    limit = min(max(top_k, 1), MAX_RESULTS_LIMIT)
    config = SearchConfig(
        mode=search_mode,
        limit=limit,
        semantic_weight=semantic_weight,
        keyword_weight=keyword_weight,
    )

    all_results: list[dict[str, Any]] = []
    for corpus in corpora:
        try:
            matches = await service.search(
                corpus_id=corpus.id,
                app_name=app_name,
                query=query,
                config=config,
            )
            for match in matches:
                content = match.content
                truncated = len(content) > MAX_SNIPPET_CHARS
                snippet = content[:MAX_SNIPPET_CHARS] if truncated else content
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
        result["formatted_citation"] = format_citation(
            metadata=result.get("metadata"),
            source_uri=result.get("source_uri"),
            idx=idx,
        )
        result["corpus_label"] = resolve_corpus_label(result.get("corpus"), result.get("corpus_id"))

    return {
        "status": "success",
        "query": query,
        "count": len(all_results),
        "results": all_results,
        "search_mode": search_mode,
    }


async def kg_global_search_with_citations(
    *,
    query: str,
    corpus_ids: Sequence[UUID],
    app_name: str,
    max_communities: int = 5,
) -> dict[str, Any]:
    """GraphRAG 全局检索（社区摘要 Map-Reduce），逐 Corpus 聚合 + 来源徽章注入。

    自 perception 工具的 ``search_knowledge_graph_global`` 主干平移：embedding
    best-effort（失败 → None，由 GlobalSearchService 按 entity_count fallback）、
    逐 corpus ``asyncio.gather`` 并行、单 corpus 失败降级为 failed 条目。

    Returns:
        ``{status, query, corpus_count, per_corpus: [{corpus_id, corpus_label,
        answer, evidence, ...}, ...]}``
    """
    from dataclasses import asdict

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
        from negentropy.knowledge.ingestion.embedding import build_embedding_fn

        embedding_fn = build_embedding_fn()
        query_embedding = (
            await embedding_fn(query) if inspect.iscoroutinefunction(embedding_fn) else embedding_fn(query)
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("global_search_embedding_failed", error=str(exc))
        query_embedding = None

    # 解析 corpus 显示名（用于来源徽章）—— 单次调用内拉一次
    valid_ids = list(corpus_ids)
    async with db_session.AsyncSessionLocal() as db:
        rows = (
            (
                await db.execute(
                    select(Corpus).where(
                        Corpus.app_name == app_name,
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
                    "corpus_label": resolve_corpus_label(corpus_name_by_id.get(str(corpus_id)), str(corpus_id)),
                    "status": "failed",
                    "error": str(exc),
                }
        payload = asdict(result)
        payload["corpus_id"] = str(corpus_id)
        payload["corpus_label"] = resolve_corpus_label(corpus_name_by_id.get(str(corpus_id)), str(corpus_id))
        payload["status"] = "success"
        return payload

    per_corpus = await asyncio.gather(*[_one(cid) for cid in valid_ids])
    succeeded = [p for p in per_corpus if p.get("status") == "success"]
    if not succeeded:
        return {
            "status": "failed",
            "query": query,
            "corpus_count": len(per_corpus),
            "per_corpus": list(per_corpus),
            "error": "all per-corpus global searches failed",
        }
    return {
        "status": "success",
        "query": query,
        "corpus_count": len(per_corpus),
        "per_corpus": list(per_corpus),
    }


__all__ = [
    "MAX_RESULTS_LIMIT",
    "MAX_SNIPPET_CHARS",
    "format_citation",
    "kg_global_search_with_citations",
    "resolve_corpus_label",
    "resolve_corpus_scope",
    "search_kb_with_citations",
]
