"""
Paper Hunter Faculty Tool — 拉取 arXiv 最新 AI Agent 论文

为 ADK agent 提供 ``fetch_papers(query, top_n, days_back, categories)`` 工具：
基于 arXiv API（``https://export.arxiv.org/api/query``）按关键词与发表时间窗
检索论文，返回结构化 metadata 列表，便于 LLM 后续 ``save_to_memory`` 与
``update_knowledge_graph``。

设计准则：
- **arXiv 速率政策**：默认每次 API 调用间隔 ≥ 3 秒（本工具单次调用即一次请求，由
  调用方天然分摊；topN 上限 20 防止 LLM 失控）；
- **fail-soft**：网络/解析异常返回 ``{"status": "failed", "papers": [], "error": ...}``；
- **不直接写入 KG/Memory**：仅返回原始 metadata，由 LLM 显式选择 ``save_to_memory``
  与 ``update_knowledge_graph`` 完成内化。

参考文献：
[1] arXiv API Help, "API Basics," https://info.arxiv.org/help/api/index.html.
[2] D. Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP
    Tasks," *Proc. NeurIPS*, 2020. — 论文采集是典型 RAG 内化场景。
"""

from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta
from typing import Any
from xml.etree import ElementTree as ET

import httpx
from google.adk.tools import ToolContext

from negentropy.logging import get_logger

_logger = get_logger("negentropy.tools.paper_hunter")

ARXIV_API_URL = "https://export.arxiv.org/api/query"
ATOM_NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "arxiv": "http://arxiv.org/schemas/atom",
}

# arXiv categories preset for AI Agent papers
DEFAULT_CATEGORIES = ("cs.AI", "cs.CL", "cs.LG", "cs.MA")

_TOPN_HARD_LIMIT = 20


def _build_search_query(query: str, categories: list[str] | None, days_back: int) -> str:
    """构造 arXiv 搜索 query（仅基于关键词与分类，不在 query 内做日期过滤）。

    日期过滤通过 fetch 后客户端 published 字段比对实现，避免 arXiv API 对
    submittedDate 范围的解析差异。
    """
    cats = list(categories) if categories else list(DEFAULT_CATEGORIES)
    keyword_part = f'(all:"{query}")' if query else ""
    cat_part = " OR ".join(f"cat:{c}" for c in cats)
    if keyword_part and cat_part:
        return f"{keyword_part} AND ({cat_part})"
    return keyword_part or cat_part or "cat:cs.AI"


def _parse_atom_feed(xml_text: str, *, since: datetime) -> list[dict[str, Any]]:
    """解析 arXiv Atom feed → 论文 metadata 列表。"""
    out: list[dict[str, Any]] = []
    root = ET.fromstring(xml_text)
    entries = root.findall("atom:entry", ATOM_NS)
    for entry in entries:
        published_text = (entry.findtext("atom:published", default="", namespaces=ATOM_NS) or "").strip()
        try:
            published_dt = datetime.fromisoformat(published_text.replace("Z", "+00:00"))
        except ValueError:
            published_dt = None
        if published_dt is not None and published_dt < since:
            continue

        title_raw = (entry.findtext("atom:title", default="", namespaces=ATOM_NS) or "").strip()
        title = re.sub(r"\s+", " ", title_raw)
        summary = re.sub(
            r"\s+",
            " ",
            (entry.findtext("atom:summary", default="", namespaces=ATOM_NS) or "").strip(),
        )
        arxiv_id_url = (entry.findtext("atom:id", default="", namespaces=ATOM_NS) or "").strip()
        # arxiv_id_url e.g. http://arxiv.org/abs/2401.12345v2 → 提取 abs 后段
        arxiv_id = arxiv_id_url.split("/abs/")[-1] if "/abs/" in arxiv_id_url else arxiv_id_url

        authors: list[str] = []
        for author in entry.findall("atom:author", ATOM_NS):
            name = (author.findtext("atom:name", default="", namespaces=ATOM_NS) or "").strip()
            if name:
                authors.append(name)

        pdf_url = ""
        for link in entry.findall("atom:link", ATOM_NS):
            if link.attrib.get("title") == "pdf":
                pdf_url = link.attrib.get("href", "")
                break
        if not pdf_url and arxiv_id:
            pdf_url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"

        primary = entry.find("arxiv:primary_category", ATOM_NS)
        primary_category = primary.attrib.get("term") if primary is not None else None

        out.append(
            {
                "arxiv_id": arxiv_id,
                "title": title,
                "abstract": summary,
                "authors": authors,
                "pdf_url": pdf_url,
                "published": published_text,
                "primary_category": primary_category,
            }
        )
    return out


async def fetch_papers(
    query: str,
    tool_context: ToolContext,
    top_n: int = 5,
    days_back: int = 30,
    categories: list[str] | None = None,
) -> dict[str, Any]:
    """从 arXiv 检索最新论文。

    Args:
        query: 关键词（如 ``"ReAct agent reasoning"``），可空（则按分类拉取近期）。
        top_n: 返回篇数，1-20。超过 20 自动截断。
        days_back: 仅保留近 N 天发表的论文，默认 30。
        categories: arXiv 分类列表，默认 ``["cs.AI", "cs.CL", "cs.LG", "cs.MA"]``。

    Returns:
        ``{"status": "success", "query": ..., "count": N, "papers": [...]}``
        或 ``{"status": "failed", "error": "...", "papers": []}``。
    """
    if top_n is None or top_n < 1:
        top_n = 5
    top_n = min(int(top_n), _TOPN_HARD_LIMIT)
    days_back = max(int(days_back or 0), 1)

    since = datetime.now(UTC) - timedelta(days=days_back)
    search_query = _build_search_query(query or "", categories, days_back)

    params = {
        "search_query": search_query,
        "start": "0",
        "max_results": str(top_n * 2),  # 拉双倍便于客户端日期过滤后还能凑够 top_n
        "sortBy": "submittedDate",
        "sortOrder": "descending",
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(ARXIV_API_URL, params=params)
            resp.raise_for_status()
            xml_text = resp.text
    except Exception as exc:
        _logger.warning("fetch_papers_http_failed", error=str(exc), query=query)
        return {"status": "failed", "error": str(exc), "papers": []}

    try:
        papers = _parse_atom_feed(xml_text, since=since)
    except ET.ParseError as exc:
        _logger.warning("fetch_papers_parse_failed", error=str(exc))
        return {"status": "failed", "error": f"parse error: {exc}", "papers": []}

    papers = papers[:top_n]
    return {
        "status": "success",
        "query": query or "",
        "count": len(papers),
        "papers": papers,
    }
