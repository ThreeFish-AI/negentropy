"""
Perception Faculty Tools - 感知系部专用工具

提供知识检索、Web 搜索等信息获取能力。
"""

from __future__ import annotations

import inspect
import json
import urllib.parse
import urllib.request
from typing import Any

from google.adk.tools import ToolContext
from sqlalchemy import select

import negentropy.db.session as db_session
from negentropy.config import settings
from negentropy.logging import get_logger
from negentropy.models.perception import Corpus, Knowledge

logger = get_logger("negentropy.tools.perception")

_MAX_SNIPPET_CHARS = 500
_MAX_RESULTS_LIMIT = 20


async def search_knowledge_base(query: str, top_k: int, tool_context: ToolContext) -> dict[str, Any]:
    """在知识库中检索相关信息。

    Args:
        query: 搜索查询文本
        top_k: 返回结果数量

    Returns:
        包含检索结果的字典
    """
    if top_k <= 0:
        return {"status": "failed", "error": "top_k must be positive"}
    limit = min(top_k, _MAX_RESULTS_LIMIT)
    try:
        async with db_session.AsyncSessionLocal() as db:
            stmt = (
                select(Knowledge, Corpus.name)
                .join(Corpus, Knowledge.corpus_id == Corpus.id)
                .where(Knowledge.app_name == settings.app_name)
                .where(Knowledge.content.ilike(f"%{query}%"))
                .order_by(Knowledge.created_at.desc())
                .limit(limit)
            )
            result = await db.execute(stmt)
            rows = result.all()

        results = []
        for knowledge, corpus_name in rows:
            content = knowledge.content
            truncated = len(content) > _MAX_SNIPPET_CHARS
            snippet = content[:_MAX_SNIPPET_CHARS] if truncated else content
            results.append(
                {
                    "id": str(knowledge.id),
                    "corpus": corpus_name,
                    "source_uri": knowledge.source_uri,
                    "chunk_index": knowledge.chunk_index,
                    "snippet": snippet,
                    "truncated": truncated,
                    "metadata": knowledge.metadata_ or {},
                }
            )

        if results or not (tool_context and hasattr(tool_context, "search_memory")):
            return {
                "status": "success",
                "query": query,
                "count": len(results),
                "results": results,
            }
        # Fallback to ADK MemoryService search when knowledge base is empty
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
                    "source_uri": None,
                    "chunk_index": 0,
                    "snippet": text[:_MAX_SNIPPET_CHARS],
                    "truncated": len(text) > _MAX_SNIPPET_CHARS,
                    "metadata": getattr(entry, "custom_metadata", {}) if hasattr(entry, "custom_metadata") else {},
                }
            )
        return {
            "status": "success",
            "query": query,
            "count": len(fallback),
            "results": fallback,
        }
    except Exception as exc:
        logger.error("knowledge base search failed", exc_info=exc)
        return {"status": "failed", "error": str(exc)}


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
