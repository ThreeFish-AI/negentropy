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

import asyncio
import inspect
from collections.abc import Awaitable, Callable
from typing import Any, Literal

import httpx
from google.adk.tools import ToolContext
from sqlalchemy import select

import negentropy.db.session as db_session
from negentropy.config import settings
from negentropy.config.search import SearchSettings
from negentropy.knowledge.constants import (
    DEFAULT_KEYWORD_WEIGHT,
    DEFAULT_SEMANTIC_WEIGHT,
)
from negentropy.knowledge.embedding import build_batch_embedding_fn, build_embedding_fn
from negentropy.knowledge.service import KnowledgeService
from negentropy.knowledge.types import SearchConfig
from negentropy.logging import get_logger
from negentropy.models.perception import Corpus

logger = get_logger("negentropy.tools.perception")

_MAX_SNIPPET_CHARS = 500
_MAX_RESULTS_LIMIT = 20
_GOOGLE_SEARCH_URL = "https://www.googleapis.com/customsearch/v1"

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


async def _fallback_to_memory_search(query: str, limit: int, tool_context: ToolContext) -> dict[str, Any]:
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
    }


async def search_web(
    query: str,
    max_results: int,
    tool_context: ToolContext,
) -> dict[str, Any]:
    """执行 Web 搜索获取实时信息。

    使用 Google Custom Search API，内置重试机制。

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
    search_config = settings.search

    logger.info(
        "web_search_started",
        query=query[:100],
        provider=search_config.provider.value,
        limit=limit,
    )

    # 检查配置
    if not search_config.is_google_configured():
        logger.error("google_search_not_configured")
        return {
            "status": "failed",
            "error": (
                "Google Search API not configured. "
                "Please set NE_SEARCH_GOOGLE_API_KEY and NE_SEARCH_GOOGLE_CX_ID."
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
        results.append({
            "title": item.get("title", ""),
            "url": item.get("link", ""),
            "snippet": item.get("snippet", ""),
        })

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
        results.append({
            "title": item.get("title", ""),
            "url": item.get("link", ""),
            "snippet": item.get("snippet", ""),
        })

    return results[:limit]
