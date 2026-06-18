"""知识库检索 MCP 端点 — 供 Routine 的 Claude Code 经 streamable-HTTP 接入。

架构决策（程序化注入，不落库）：
- **宿主**：常驻 FastAPI 引擎进程内挂载（``/mcp/knowledge``），复用进程内
  KnowledgeService 单例 / DB 连接池 / embedding 配置 —— 零冷启动；DB 凭证等
  secret 不出引擎进程，Claude Code 仅持低权限只读 bearer token。
- **注册**：HTTP entry 含运行期端口 + 每进程随机 token，本质不可序列化进 DB
  （落库即 Split-Brain）；由 ``engine/routine/orchestrator._build_config`` 在派发时
  程序化注入 ``mcp_config``，工具可用性与引擎版本绑定。
- **工具面**：仅两个只读检索工具（``kb_search`` / ``kg_search_global``），核心逻辑
  复用 ``knowledge/retrieval/citation_search``（与 ADK perception 工具单一事实源），
  返回结构携带 citation 元数据（citation_id / formatted_citation / source_uri /
  snippet 原文），供 Claude Code 在产出中按 ``[N]`` 标注引用来源与原文摘录。
- **不做 memory fallback**：Routine 派发时已经 ``_retrieve_memory_context`` 把记忆
  注入 prompt（双通道冗余）；且 fallback 依赖 ADK ToolContext，MCP 场景没有。

参考文献:
[1] Anthropic, "Model Context Protocol," https://modelcontextprotocol.io, 2024.
[2] A. Asai et al., "Self-RAG: Learning to Retrieve, Generate, and Critique through
    Self-Reflection," arXiv:2310.11511, 2023.
"""

from __future__ import annotations

import secrets
from typing import TYPE_CHECKING, Any, Literal

from negentropy.config import settings
from negentropy.logging import get_logger

if TYPE_CHECKING:
    from mcp.server.fastmcp import FastMCP
    from mcp.server.streamable_http_manager import StreamableHTTPSessionManager

logger = get_logger("negentropy.knowledge.mcp_server")

# mcp_config 中的 server key → Claude Code 侧工具名 mcp__knowledge__<tool>，
# 白名单通配 "mcp__knowledge"（与 mcp__playwright 同构）。
KB_MCP_SERVER_KEY = "knowledge"
KB_MCP_MOUNT_PATH = "/mcp/knowledge"

_NO_RESULT_NOTE = "知识库无匹配结果。请在产出中如实说明「知识库无相关记录」，严禁虚构来源或引用编号。"

_mcp_instance: FastMCP | None = None
_auth_token: str | None = None


def get_kb_mcp_token() -> str:
    """解析 MCP bearer token：settings 静态值优先，否则每进程随机生成（重启轮换）。

    随机 token 与 ``build_kb_mcp_config_entry`` 注入同进程生成，天然一致；
    仅授权两个只读检索工具，无写面。
    """
    global _auth_token
    if _auth_token is None:
        configured = settings.knowledge.mcp.auth_token
        if configured is not None and configured.get_secret_value():
            _auth_token = configured.get_secret_value()
        else:
            _auth_token = secrets.token_urlsafe(32)
    return _auth_token


def resolve_self_base_url() -> str | None:
    """引擎自身可达地址（``negentropy serve`` 启动时经 env 推导，见 cli.py）。"""
    base = settings.knowledge.mcp.self_base_url
    return base.rstrip("/") if base else None


def kb_mcp_available() -> bool:
    """MCP 端点是否可用：开关开启且自身地址可解析（非 serve 启动时优雅 no-op）。"""
    return bool(settings.knowledge.mcp.enabled and resolve_self_base_url())


def build_kb_mcp_config_entry() -> dict[str, Any] | None:
    """构造注入 Claude Code ``mcp_config`` 的 HTTP server 条目；不可用时返回 None。"""
    base = resolve_self_base_url()
    if not settings.knowledge.mcp.enabled or not base:
        return None
    return {
        "type": "http",
        "url": f"{base}{KB_MCP_MOUNT_PATH}",
        "headers": {"Authorization": f"Bearer {get_kb_mcp_token()}"},
    }


def kb_mcp_meta_entry() -> dict[str, Any]:
    """迭代详情 MCP 面板的静态目录条目（程序化注入，不落 mcp_servers 表）。"""
    return {
        "name": KB_MCP_SERVER_KEY,
        "display_name": "Knowledge Base Retrieval",
        "description": "引擎内置知识库/知识图谱检索（带引用元数据），供 Routine 产出标注来源。",
        "transport_type": "http",
        "source": "builtin",
        "tools": [
            {
                "name": "kb_search",
                "description": "知识库混合检索（语义+关键词），返回带 citation 的原文片段",
            },
            {
                "name": "kg_search_global",
                "description": "知识图谱全局摘要检索（GraphRAG 社区摘要 Map-Reduce）",
            },
        ],
    }


async def _kb_search_impl(
    query: str,
    top_k: int = 5,
    corpus_filter: list[str] | None = None,
    search_mode: Literal["semantic", "keyword", "hybrid"] = "hybrid",
) -> dict[str, Any]:
    """``kb_search`` 工具体：作用域解析 + 共享检索核心（与 ADK 工具单一事实源）。"""
    from negentropy.knowledge._shared import _get_service
    from negentropy.knowledge.retrieval.citation_search import (
        resolve_corpus_scope,
        search_kb_with_citations,
    )

    if not query or not query.strip():
        return {"status": "failed", "error": "query must not be empty"}

    corpora = await resolve_corpus_scope(app_name=settings.app_name, filters=corpus_filter)
    if not corpora:
        return {
            "status": "success",
            "query": query,
            "count": 0,
            "results": [],
            "search_mode": search_mode,
            "note": _NO_RESULT_NOTE,
        }

    payload = await search_kb_with_citations(
        query=query,
        top_k=top_k,
        service=_get_service(),
        corpora=corpora,
        app_name=settings.app_name,
        search_mode=search_mode,
    )
    if not payload["count"]:
        payload["note"] = _NO_RESULT_NOTE
    return payload


async def _kg_search_global_impl(
    query: str,
    corpus_filter: list[str] | None = None,
    max_communities: int = 5,
) -> dict[str, Any]:
    """``kg_search_global`` 工具体：作用域解析 + 共享 GraphRAG 全局检索核心。"""
    from negentropy.knowledge.retrieval.citation_search import (
        kg_global_search_with_citations,
        resolve_corpus_scope,
    )

    if not query or not query.strip():
        return {"status": "failed", "error": "query must not be empty"}

    corpora = await resolve_corpus_scope(app_name=settings.app_name, filters=corpus_filter)
    if not corpora:
        return {
            "status": "success",
            "query": query,
            "corpus_count": 0,
            "per_corpus": [],
            "note": _NO_RESULT_NOTE,
        }

    return await kg_global_search_with_citations(
        query=query,
        corpus_ids=[c.id for c in corpora],
        app_name=settings.app_name,
        max_communities=max_communities,
    )


def get_kb_mcp() -> FastMCP:
    """惰性单例：构造 FastMCP 实例并注册两个只读检索工具。

    ``stateless_http=True``：每请求独立会话，无服务端会话状态 —— 检索工具天然无状态，
    且免去 Claude Code 重连时的 session 协商。DNS rebinding 防护关闭：端点为回环地址
    且自带 bearer 强校验（见 ``create_kb_mcp_asgi_app``）。
    """
    global _mcp_instance
    if _mcp_instance is None:
        from mcp.server.fastmcp import FastMCP
        from mcp.server.transport_security import TransportSecuritySettings

        mcp = FastMCP(
            "negentropy-knowledge",
            instructions=(
                "引擎内置知识库/知识图谱检索。结果携带 citation_id / formatted_citation / "
                "source_uri / snippet（原文片段）——在产出中引用时以 [N] 标注并附原文摘录。"
            ),
            stateless_http=True,
            json_response=True,
            streamable_http_path="/",
            transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
        )

        mcp.tool(
            name="kb_search",
            description=(
                "在系统知识库中混合检索（语义+关键词）。返回带引用元数据的原文片段："
                "每条结果含 citation_id（行内 [N] 标号用）、formatted_citation（参考文献条目）、"
                "source_uri（来源地址）、snippet（≤500 字原文）、corpus_label（语料库来源）。"
                "参数：query 查询文本；top_k 返回条数（默认 5，上限 20）；"
                "corpus_filter 可选语料库名称/UUID 列表（缺省检索全部）；"
                "search_mode 检索模式 semantic/keyword/hybrid（默认 hybrid）。"
            ),
        )(_kb_search_impl)
        mcp.tool(
            name="kg_search_global",
            description=(
                "知识图谱全局摘要检索（GraphRAG 社区摘要 Map-Reduce）。适用于「主题概览/"
                "整体趋势/核心观点」类问题。返回 per_corpus 列表，每项含 corpus_label 来源徽章、"
                "answer 摘要与 evidence 证据。参数：query 查询；corpus_filter 可选语料库过滤；"
                "max_communities 每语料库参与汇总的社区数（默认 5）。"
            ),
        )(_kg_search_global_impl)

        _mcp_instance = mcp
    return _mcp_instance


def create_kb_mcp_asgi_app() -> tuple[Any, StreamableHTTPSessionManager]:
    """构造可 mount 的 ASGI app（外包 bearer 校验）与待运行的 session manager。

    Returns:
        ``(asgi_app, session_manager)``：前者由 bootstrap mount 到
        ``KB_MCP_MOUNT_PATH``；后者需在 lifespan 中 ``session_manager.run()``。
    """
    mcp = get_kb_mcp()
    inner_app = mcp.streamable_http_app()
    expected = f"Bearer {get_kb_mcp_token()}"

    async def _guarded_app(scope: dict[str, Any], receive: Any, send: Any) -> None:
        # 仅 http scope 校验（lifespan 等透传给内层 app）
        if scope.get("type") == "http":
            headers = dict(scope.get("headers") or [])
            auth = headers.get(b"authorization", b"").decode("latin-1")
            if not secrets.compare_digest(auth, expected):
                await send(
                    {
                        "type": "http.response.start",
                        "status": 401,
                        "headers": [(b"content-type", b"application/json")],
                    }
                )
                await send(
                    {
                        "type": "http.response.body",
                        "body": b'{"error": "unauthorized"}',
                    }
                )
                return
        await inner_app(scope, receive, send)

    return _guarded_app, mcp.session_manager


def reset_kb_mcp_for_tests() -> None:
    """重置模块级单例（仅测试用）。"""
    global _mcp_instance, _auth_token
    _mcp_instance = None
    _auth_token = None


__all__ = [
    "KB_MCP_MOUNT_PATH",
    "KB_MCP_SERVER_KEY",
    "build_kb_mcp_config_entry",
    "create_kb_mcp_asgi_app",
    "get_kb_mcp",
    "get_kb_mcp_token",
    "kb_mcp_available",
    "kb_mcp_meta_entry",
    "reset_kb_mcp_for_tests",
    "resolve_self_base_url",
]
