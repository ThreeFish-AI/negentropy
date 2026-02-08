"""
Perception Faculty Tools - 感知系部专用工具

提供知识检索、Web 搜索等信息获取能力。

基于研究文档 [034-knowledge-base.md](https://github.com/ThreeFish-AI/agentic-ai-cognizes/blob/master/docs/research/034-knowledge-base.md)
和 [030-the-perception.md](https://github.com/ThreeFish-AI/agentic-ai-cognizes/blob/master/docs/engine/030-the-perception.md)，
本工具集成混合检索 (Hybrid Search) 能力，支持语义、关键词和混合三种检索模式。

参考文献:
[1] P. Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks,"
    *Adv. Neural Inf. Process. Syst.*, vol. 33, pp. 9459-9474, 2020.
"""

from __future__ import annotations

import inspect
import json
import urllib.parse
import urllib.request
from typing import Any, Literal

from google.adk.tools import ToolContext
from sqlalchemy import select

import negentropy.db.session as db_session
from negentropy.config import settings
from negentropy.knowledge.constants import (
    DEFAULT_KEYWORD_WEIGHT,
    DEFAULT_SEARCH_LIMIT,
    DEFAULT_SEMANTIC_WEIGHT,
)
from negentropy.knowledge.embedding import build_batch_embedding_fn, build_embedding_fn
from negentropy.knowledge.service import KnowledgeService
from negentropy.knowledge.types import SearchConfig
from negentropy.logging import get_logger
from negentropy.models.perception import Corpus, Knowledge

logger = get_logger("negentropy.tools.perception")

_MAX_SNIPPET_CHARS = 500
_MAX_RESULTS_LIMIT = 20

# 全局 KnowledgeService 单例，避免重复初始化
_knowledge_service: KnowledgeService | None = None


def _get_knowledge_service() -> KnowledgeService:
    """获取 KnowledgeService 单例

    遵循 AGENTS.md 的复用驱动原则，复用已初始化的服务实例。
    """
    global _knowledge_service
    if _knowledge_service is None:
        _knowledge_service = KnowledgeService(
            embedding_fn=build_embedding_fn(),
            batch_embedding_fn=build_batch_embedding_fn(),
        )
    return _knowledge_service


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

    logger.info(
        "knowledge_search_started",
        query=query[:100],
        mode=search_mode,
        limit=limit,
        semantic_weight=semantic_weight,
        keyword_weight=keyword_weight,
    )

    try:
        # 获取所有可用的语料库
        async with db_session.AsyncSessionLocal() as db:
            stmt = select(Corpus).where(Corpus.app_name == settings.app_name)
            result = await db.execute(stmt)
            corpora = result.scalars().all()

        if not corpora:
            logger.warning("no_corpora_found", app_name=settings.app_name)
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


async def _fallback_to_memory_search(
    query: str, limit: int, tool_context: ToolContext
) -> dict[str, Any]:
    """回退到 ADK MemoryService 搜索

    当知识库为空或检索失败时，使用 MemoryService 作为回退方案。
    遵循研究文档中的 Fallback 模式。
    """
    if not (tool_context and hasattr(tool_context, "search_memory")):
        return {
            "status": "success",
            "query": query,
            "count": 0,
            "results": [],
            "search_mode": "memory_fallback",
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
                "metadata": (
                    getattr(entry, "custom_metadata", {}) if hasattr(entry, "custom_metadata") else {}
                ),
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
    }


def search_web(query: str, max_results: int, tool_context: ToolContext) -> dict[str, Any]:
    """执行 Web 搜索获取实时信息。

    Args:
        query: 搜索查询
        max_results: 最大结果数

    Returns:
        搜索结果
    """
    if max_results <= 0:
        return {"status": "failed", "error": "max_results must be positive"}

    limit = min(max_results, _MAX_RESULTS_LIMIT)
    url = "https://api.duckduckgo.com/?" + urllib.parse.urlencode(
        {
            "q": query,
            "format": "json",
            "no_html": 1,
            "no_redirect": 1,
        }
    )
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Negentropy/0.1"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            payload = json.loads(resp.read().decode("utf-8"))

        results = []
        related = payload.get("RelatedTopics", []) or []
        for item in related:
            if "Text" in item and "FirstURL" in item:
                results.append({"title": item["Text"], "url": item["FirstURL"]})
            elif "Topics" in item:
                for sub in item["Topics"]:
                    if "Text" in sub and "FirstURL" in sub:
                        results.append({"title": sub["Text"], "url": sub["FirstURL"]})
            if len(results) >= limit:
                break

        return {
            "status": "success",
            "query": query,
            "count": len(results),
            "results": results[:limit],
            "source": "duckduckgo_instant_answer",
        }
    except Exception as exc:
        logger.error("web search failed", exc_info=exc)
        return {"status": "failed", "error": str(exc)}
