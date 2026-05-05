"""
Semantic Scholar Faculty Tool — Paper Hunter v0.2 引文图增强

为 ADK agent 提供 ``fetch_paper_citations(arxiv_ids, top_n, depth)`` 工具：把 arXiv
论文 ID 通过 Semantic Scholar Graph API（``https://api.semanticscholar.org/graph/v1``）
解析为 paperId，再批量拉取每篇论文的引用列表（最多 ``top_n`` 篇 / 每论文），形成
1 度引文图。LLM 后续把每对 (source, citation) 写入 KG（``relation=cites``）。

设计准则：
- **公共 API 默认无 key**：免费配额 ~100 req/5min；遇 429 由 ``perception._call_with_retry``
  指数退避；可通过 ``S2_API_KEY`` env 提升配额；
- **不递归深拉**：Phase 3 仅支持 ``depth=1``（一跳引文）；将来扩 ``depth>=2`` 需要
  Graph 工程级压测；
- **fail-soft**：网络/解析失败不抛错，返回 ``{"status": "failed", ...}``；
- **不直接写 KG / Memory**：仅返回结构化 metadata 列表。

参考文献：
[1] Semantic Scholar API Documentation — https://api.semanticscholar.org/api-docs/
[2] J. Tang et al., "ArnetMiner: Extraction and Mining of Academic Social Networks,"
    *Proc. KDD*, 2008. — 引文图基础范式。
[3] D. Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP
    Tasks," *Proc. NeurIPS*, 2020.
"""

from __future__ import annotations

import os
from typing import Any

import httpx
from google.adk.tools import ToolContext

from negentropy.agents.tools.perception import _call_with_retry
from negentropy.logging import get_logger

_logger = get_logger("negentropy.tools.semantic_scholar")

S2_BASE = "https://api.semanticscholar.org/graph/v1"
_BATCH_LOOKUP_PATH = "/paper/batch"
_PAPER_CITATIONS_PATH_TEMPLATE = "/paper/{paper_id}/citations"

# 文档约定：单次工具调用上限 ~30 req（lookup 批量 + 每 paper 一次 citations）。
_TOPN_HARD_LIMIT = 10
_DEPTH_HARD_LIMIT = 1
_HTTP_TIMEOUT = 20.0


def _api_key_header() -> dict[str, str]:
    """如设置 ``S2_API_KEY`` env 则带上 header（提高配额，否则匿名调用）。"""
    key = os.environ.get("S2_API_KEY", "").strip()
    return {"x-api-key": key} if key else {}


async def _post_batch_lookup(arxiv_ids: list[str]) -> list[dict[str, Any]]:
    """用 S2 Graph API batch 端点把 ``ARXIV:{id}`` → paperId + 基本字段。

    https://api.semanticscholar.org/graph/v1/paper/batch
    body: {"ids": ["ARXIV:2401.12345", ...]}
    """
    ids = [f"ARXIV:{a}" for a in arxiv_ids if a]
    if not ids:
        return []

    async def _do() -> list[dict[str, Any]]:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT, headers=_api_key_header()) as client:
            resp = await client.post(
                f"{S2_BASE}{_BATCH_LOOKUP_PATH}",
                params={"fields": "paperId,title,year,authors,externalIds"},
                json={"ids": ids},
            )
            resp.raise_for_status()
            data = resp.json()
            return data if isinstance(data, list) else []

    return await _call_with_retry(
        _do,
        max_retries=3,
        base_backoff=2.0,
        timeout=_HTTP_TIMEOUT + 5,
        context="s2_batch_lookup",
    )


async def _get_paper_citations(paper_id: str, top_n: int) -> list[dict[str, Any]]:
    """拉取单篇论文的引用方列表（即"谁引用了这篇"）。"""

    async def _do() -> list[dict[str, Any]]:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT, headers=_api_key_header()) as client:
            resp = await client.get(
                f"{S2_BASE}{_PAPER_CITATIONS_PATH_TEMPLATE.format(paper_id=paper_id)}",
                params={
                    "fields": "title,year,authors,externalIds",
                    "limit": str(min(top_n, _TOPN_HARD_LIMIT)),
                },
            )
            resp.raise_for_status()
            data = resp.json() or {}
            return data.get("data", []) if isinstance(data, dict) else []

    return await _call_with_retry(
        _do,
        max_retries=3,
        base_backoff=2.0,
        timeout=_HTTP_TIMEOUT + 5,
        context=f"s2_paper_citations:{paper_id}",
    )


async def fetch_paper_citations(
    arxiv_ids: list[str],
    tool_context: ToolContext,
    top_n: int = 5,
    depth: int = 1,
) -> dict[str, Any]:
    """对 arxiv_ids 数组中的每个论文，拉取其被引用方（一跳）。

    Args:
        arxiv_ids: 一组 arXiv ID（如 ``["2401.12345", "2403.99999"]``）。
        top_n: 每篇论文返回的引用方上限，1-10。
        depth: 引文递归深度；Phase 3 仅支持 1。

    Returns:
        ``{"status": "success", "edges": [{"source": "2401.12345",
        "target": "ARXIV:..."} | {"source": ..., "target_paperId": "...",
        "target_title": "..."}], "papers": [{...batch lookup metadata}]}``
        或 ``{"status": "failed", "error": "..."}``。
    """
    if not isinstance(arxiv_ids, list) or not arxiv_ids:
        return {"status": "failed", "error": "arxiv_ids is required and must be a non-empty list", "edges": []}
    if depth not in (1, _DEPTH_HARD_LIMIT):
        depth = _DEPTH_HARD_LIMIT
    if top_n is None or top_n < 1:
        top_n = 5
    top_n = min(int(top_n), _TOPN_HARD_LIMIT)

    cleaned = [str(a).strip() for a in arxiv_ids if str(a).strip()][:_TOPN_HARD_LIMIT]
    if not cleaned:
        return {"status": "failed", "error": "no valid arxiv_ids provided", "edges": []}

    try:
        papers = await _post_batch_lookup(cleaned)
    except Exception as exc:
        _logger.warning("s2_batch_lookup_failed", error=str(exc), arxiv_ids=cleaned)
        return {"status": "failed", "error": f"batch lookup failed: {exc}", "edges": [], "papers": []}

    edges: list[dict[str, Any]] = []
    for paper in papers:
        if not paper:
            continue
        paper_id = paper.get("paperId")
        external = paper.get("externalIds") or {}
        source_arxiv = external.get("ArXiv") or ""
        if not paper_id:
            continue
        try:
            citations = await _get_paper_citations(paper_id, top_n)
        except Exception as exc:
            _logger.warning("s2_paper_citations_failed", paper_id=paper_id, error=str(exc))
            continue
        for c in citations:
            citing = c.get("citingPaper") or {}
            citing_external = citing.get("externalIds") or {}
            edges.append(
                {
                    "source_arxiv": source_arxiv,
                    "source_paperId": paper_id,
                    "target_paperId": citing.get("paperId"),
                    "target_arxiv": citing_external.get("ArXiv"),
                    "target_title": citing.get("title"),
                    "target_year": citing.get("year"),
                    "target_authors": [a.get("name", "") for a in (citing.get("authors") or [])],
                }
            )

    return {
        "status": "success",
        "depth": depth,
        "papers": papers,
        "edges": edges,
        "edge_count": len(edges),
    }
