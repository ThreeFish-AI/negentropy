"""Self-editing Memory Tools — Agent 主动管理长期记忆的工具集

设计动机：
我们的 AsyncScheduler 是被动批处理（巩固/清理），与 Agent 的实时认知决策有
天然延迟。借鉴 Letta/MemGPT 的"self-editing tools"<sup>[[1]](#ref1)</sup>，
让 Agent 能在对话中主动 search/write/update/delete 记忆，与 Phase 3
主动召回（Proactive Recall）形成"召回-写回"完整闭环。

5 个工具：
1. ``memory_search`` — 主动检索（主动+被动检索互补）
2. ``memory_write`` — 主动写入（不走巩固管线，直接落库）
3. ``memory_update`` — 主动修订（保留 update_history 审计链）
4. ``memory_delete`` — 软删除（保留可恢复性 + audit_log）
5. ``core_block_replace`` — 重写常驻摘要块（最高优先级语境锚）

安全护栏：
- ``user_id`` + ``app_name`` 必填（多租隔离）
- ``memory_delete`` 软删（不物理删除，metadata.deleted=True）
- 限流：同一 (user × thread × tool) 1 分钟内 ≤ MAX_CALLS_PER_MINUTE
- ``core_block_replace`` 必须传完整新内容（避免片段拼接事故）

理论基础：
[1] C. Packer et al., "MemGPT: Towards LLMs as Operating Systems," arXiv:2310.08560, 2023.
[2] S. Yao et al., "Reflexion: Language agents with verbal reinforcement learning," NeurIPS 2023.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque
from typing import Any

from negentropy.engine.factories.memory import (
    get_core_block_service,
    get_memory_governance_service,
    get_memory_service,
)
from negentropy.engine.governance.memory import VALID_MEMORY_TYPES
from negentropy.logging import get_logger

logger = get_logger("negentropy.engine.tools.memory_tools")

MAX_CALLS_PER_MINUTE = 10
_RATE_LIMITS: dict[tuple[str, str, str], deque[float]] = defaultdict(deque)


def _check_rate_limit(user_id: str, thread_id: str | None, tool: str) -> None:
    """简单滑动窗口限流（进程级，重启后清零）。"""
    key = (user_id, thread_id or "_", tool)
    now = time.time()
    window = _RATE_LIMITS[key]
    while window and now - window[0] > 60:
        window.popleft()
    if len(window) >= MAX_CALLS_PER_MINUTE:
        logger.warning("memory_tool_rate_limited", user_id=user_id, tool=tool, calls=len(window))
        raise PermissionError(f"Rate limit exceeded: {tool} called {MAX_CALLS_PER_MINUTE} times in last 60s")
    window.append(now)


def _validate_required(user_id: str | None, app_name: str | None) -> tuple[str, str]:
    if not user_id or not user_id.strip():
        raise ValueError("user_id is required for memory tools")
    if not app_name or not app_name.strip():
        raise ValueError("app_name is required for memory tools")
    return user_id.strip(), app_name.strip()


async def memory_search(
    *,
    user_id: str,
    app_name: str,
    query: str,
    k: int = 5,
    memory_type: str | None = None,
    thread_id: str | None = None,
) -> dict[str, Any]:
    """主动检索记忆（Agent self-call 工具）。

    Args:
        user_id: 当前 Agent invocation 上下文中的用户 ID（强制）
        app_name: 应用名（强制）
        query: 检索 query 文本
        k: 返回 top-k
        memory_type: 类型过滤（episodic/semantic/procedural/preference/fact）
        thread_id: 线程级限定（可选）

    Returns:
        {"hits": [{"id", "content", "memory_type", "relevance_score", ...}, ...]}
    """
    user_id, app_name = _validate_required(user_id, app_name)
    _check_rate_limit(user_id, thread_id, "memory_search")
    if not query or not query.strip():
        raise ValueError("query must not be empty")
    if memory_type is not None and memory_type not in VALID_MEMORY_TYPES:
        raise ValueError(f"Invalid memory_type. Must be one of {sorted(VALID_MEMORY_TYPES)}")

    service = get_memory_service()
    response = await service.search_memory(
        app_name=app_name,
        user_id=user_id,
        query=query.strip(),
        limit=max(1, min(50, k)),
        memory_type=memory_type,
    )
    hits: list[dict[str, Any]] = []
    for entry in response.memories or []:
        text_parts = []
        try:
            for p in entry.content.parts or []:
                if hasattr(p, "text") and p.text:
                    text_parts.append(p.text)
        except Exception:
            pass
        meta = dict(entry.custom_metadata or {})
        hits.append(
            {
                "id": entry.id,
                "content": "\n".join(text_parts),
                "memory_type": meta.get("memory_type"),
                "relevance_score": float(entry.relevance_score or 0.0),
                "search_level": meta.get("search_level"),
                "metadata": meta,
            }
        )
    logger.info("memory_search_invoked", user_id=user_id, k=len(hits), q=query[:100])
    return {"hits": hits, "count": len(hits)}


async def memory_write(
    *,
    user_id: str,
    app_name: str,
    content: str,
    memory_type: str = "episodic",
    thread_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """主动写入新记忆（不走巩固管线）。

    Args:
        memory_type: 默认 episodic；语义/程序性记忆请显式指定
    """
    user_id, app_name = _validate_required(user_id, app_name)
    _check_rate_limit(user_id, thread_id, "memory_write")

    service = get_memory_service()
    return await service.add_memory_typed(
        user_id=user_id,
        app_name=app_name,
        thread_id=thread_id,
        content=content,
        memory_type=memory_type,
        metadata={"source": "self_edit", **(metadata or {})},
    )


async def memory_update(
    *,
    user_id: str,
    app_name: str,
    memory_id: str,
    new_content: str,
    reason: str | None = None,
    thread_id: str | None = None,
) -> dict[str, Any]:
    """修订已有记忆内容（带 update_history 审计链）。"""
    user_id, app_name = _validate_required(user_id, app_name)
    _check_rate_limit(user_id, thread_id, "memory_update")
    if not memory_id or not memory_id.strip():
        raise ValueError("memory_id is required")

    service = get_memory_service()
    return await service.update_memory_content(
        memory_id=memory_id.strip(),
        user_id=user_id,
        app_name=app_name,
        new_content=new_content,
        reason=reason,
    )


async def memory_delete(
    *,
    user_id: str,
    app_name: str,
    memory_id: str,
    reason: str | None = None,
    thread_id: str | None = None,
) -> dict[str, Any]:
    """软删除记忆（保留行 + audit_log，可恢复）。

    同步在 audit_log 写入 'delete' 决策，便于 UI Audit 页面追溯。
    """
    user_id, app_name = _validate_required(user_id, app_name)
    _check_rate_limit(user_id, thread_id, "memory_delete")
    if not memory_id or not memory_id.strip():
        raise ValueError("memory_id is required")

    service = get_memory_service()
    soft_result = await service.soft_delete_memory(
        memory_id=memory_id.strip(),
        user_id=user_id,
        app_name=app_name,
        reason=reason,
    )

    # 同步写 audit_log（Self-edit 决策可追溯）
    try:
        gov = get_memory_governance_service()
        await gov.audit_memory(
            user_id=user_id,
            app_name=app_name,
            decisions={memory_id.strip(): "delete"},
            note=f"self_edit:{reason or 'agent_initiated'}",
        )
    except Exception as exc:
        logger.debug("memory_delete_audit_skipped", error=str(exc))

    return soft_result


async def core_block_replace(
    *,
    user_id: str,
    app_name: str,
    new_content: str,
    scope: str = "user",
    label: str = "persona",
    thread_id: str | None = None,
    updated_by: str | None = None,
) -> dict[str, Any]:
    """重写 Core Memory Block（常驻摘要块）。

    必须传完整新内容（避免片段拼接事故）。
    每次调用 version+1，便于追溯。
    """
    user_id, app_name = _validate_required(user_id, app_name)
    _check_rate_limit(user_id, thread_id, "core_block_replace")
    if scope == "thread" and not thread_id:
        raise ValueError("scope='thread' requires thread_id")

    service = get_core_block_service()
    return await service.upsert(
        user_id=user_id,
        app_name=app_name,
        scope=scope,
        thread_id=thread_id if scope == "thread" else None,
        label=label,
        content=new_content,
        updated_by=updated_by or "agent_self_edit",
    )


# 工具描述（供 OpenAPI / FunctionTool 注册引用）
MEMORY_TOOLS_OPENAPI: dict[str, dict[str, Any]] = {
    "memory_search": {
        "name": "memory_search",
        "description": "主动检索用户的长期记忆。优先返回与 query 语义最相关的 top-k 记忆，可按类型过滤。",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "k": {"type": "integer", "default": 5},
                "memory_type": {
                    "type": "string",
                    "enum": sorted(VALID_MEMORY_TYPES),
                    "nullable": True,
                },
            },
            "required": ["query"],
        },
    },
    "memory_write": {
        "name": "memory_write",
        "description": "主动写入一条新记忆。memory_type 必须是 episodic/semantic/procedural/preference/fact 之一。",
        "parameters": {
            "type": "object",
            "properties": {
                "content": {"type": "string"},
                "memory_type": {
                    "type": "string",
                    "enum": sorted(VALID_MEMORY_TYPES),
                    "default": "episodic",
                },
            },
            "required": ["content"],
        },
    },
    "memory_update": {
        "name": "memory_update",
        "description": "修订指定记忆 ID 的 content。new_content 必须是完整文本，不可空。",
        "parameters": {
            "type": "object",
            "properties": {
                "memory_id": {"type": "string"},
                "new_content": {"type": "string"},
                "reason": {"type": "string"},
            },
            "required": ["memory_id", "new_content"],
        },
    },
    "memory_delete": {
        "name": "memory_delete",
        "description": "软删除指定记忆。不物理删除，可被恢复。reason 必填以便审计。",
        "parameters": {
            "type": "object",
            "properties": {
                "memory_id": {"type": "string"},
                "reason": {"type": "string"},
            },
            "required": ["memory_id"],
        },
    },
    "core_block_replace": {
        "name": "core_block_replace",
        "description": "重写 Core Memory Block 常驻摘要块。scope=user/app/thread；scope=thread 时 thread_id 必填。",
        "parameters": {
            "type": "object",
            "properties": {
                "new_content": {"type": "string"},
                "scope": {"type": "string", "enum": ["user", "app", "thread"], "default": "user"},
                "label": {"type": "string", "default": "persona"},
            },
            "required": ["new_content"],
        },
    },
}


def get_memory_tools_registry() -> dict[str, Any]:
    """返回 5 个工具的注册映射 {name: callable}，供 ToolRegistry 或 ADK FunctionTool 包装。"""
    return {
        "memory_search": memory_search,
        "memory_write": memory_write,
        "memory_update": memory_update,
        "memory_delete": memory_delete,
        "core_block_replace": core_block_replace,
    }


__all__ = [
    "MAX_CALLS_PER_MINUTE",
    "memory_search",
    "memory_write",
    "memory_update",
    "memory_delete",
    "core_block_replace",
    "get_memory_tools_registry",
    "MEMORY_TOOLS_OPENAPI",
]
