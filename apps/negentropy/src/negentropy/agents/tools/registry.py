"""
六翼工具注册表 — 「工具名 → callable / BaseTool」单一事实源。

WS1（tools 运行时回源）的名解析基座：``NegentropyToolset.get_tools`` 从 DB 读到的
``agents.tools``（``list[str]``）经本表映射回真实 ADK 工具对象。

设计约束（遵循 AGENTS.md「单一事实源」「最小干预」）：
- **命名单源**：``tool_name(tool)`` 是工具名的唯一权威口径；``interface/agent_presets`` 的
  序列化（sync 落库 ``agents.tools``）与本表的键都由它产生，从根源消除正 / 反向命名漂移。
- **fail-soft**：``resolve_tool_names`` 对未知名 log warning 后丢弃，绝不抛（缺工具 ≠ 崩请求）。
- **别名兼容**：``tools/available``（BuiltinTool 表，迁移 0039）的历史命名（如 ``claude_code``）
  经 ``_ALIASES`` 归一到 callable 的真实符号名（``invoke_claude_code``）。
"""

from __future__ import annotations

from typing import Any

from negentropy.logging import get_logger

_logger = get_logger("negentropy.agents.tools.registry")


def tool_name(tool: Any) -> str:
    """工具名的唯一权威口径（与 sync 序列化同源）。

    取值优先级：``.name`` 属性（ADK ``BaseTool``）→ ``__name__``（裸函数）→ 类名。
    ``interface/agent_presets._tool_name`` 委派到本函数，保证 sync 落库的 ``agents.tools``
    与本注册表键逐字一致。
    """
    name = getattr(tool, "name", None)
    if isinstance(name, str) and name:
        return name
    func_name = getattr(tool, "__name__", None)
    if isinstance(func_name, str) and func_name:
        return func_name
    return tool.__class__.__name__


def _build_registry() -> dict[str, Any]:
    """登记六翼可能用到的全部工具符号。

    延迟在函数体内 import，避免模块级 import 顺序耦合（各工具模块彼此、与 faculties 的加载序）。
    键由 ``tool_name`` 统一生成；命名碰撞（两个不同工具同名）在导入期即抛，绝不静默覆盖。
    """
    from google.adk.tools import load_memory

    from .action import execute_code, read_file, write_file
    from .claude_code import invoke_claude_code
    from .common import log_activity
    from .contemplation import analyze_context, create_plan
    from .influence import publish_content, send_notification
    from .ingest import ingest_to_corpus
    from .internalization import save_to_memory, update_knowledge_graph
    from .memory import preload_memory_tool
    from .paper import ingest_paper, search_papers
    from .perception import (
        search_knowledge_base,
        search_knowledge_graph_global,
        search_knowledge_graph_with_papers,
        search_web,
    )

    symbols: list[Any] = [
        # 通用（审计）
        log_activity,
        # 感知（慧眼）
        search_knowledge_base,
        search_web,
        search_knowledge_graph_global,
        search_knowledge_graph_with_papers,
        search_papers,
        # 内化（本心）
        save_to_memory,
        update_knowledge_graph,
        ingest_paper,
        ingest_to_corpus,
        # 沉思（元神）
        analyze_context,
        create_plan,
        # 行动（妙手）
        execute_code,
        read_file,
        write_file,
        invoke_claude_code,
        # 影响（喉舌）
        publish_content,
        send_notification,
        # 记忆（ADK 原生 + 预载）
        load_memory,
        preload_memory_tool,
    ]

    registry: dict[str, Any] = {}
    for sym in symbols:
        key = tool_name(sym)
        existing = registry.get(key)
        if existing is not None and existing is not sym:
            # 命名碰撞是设计事故：必须在导入期暴露，而非运行时静默覆盖某个工具。
            raise RuntimeError(f"tool registry name collision on {key!r}")
        registry[key] = sym
    return registry


TOOL_REGISTRY: dict[str, Any] = _build_registry()


# 历史命名别名 → 注册表主键（callable 的真实符号名）。
# ``claude_code``：BuiltinTool 种子行名（迁移 0039），callable 实为 ``invoke_claude_code``。
_ALIASES: dict[str, str] = {
    "claude_code": "invoke_claude_code",
}


def canonicalize_tool_name(name: str) -> str:
    """把工具名归一到注册表主键（应用历史别名，如 ``claude_code`` → ``invoke_claude_code``）。

    调用方（如 ``NegentropyToolset`` 的白名单 / mandatory 过滤）必须先归一再比对，否则 DB 里
    存的别名（``claude_code``）会被误判为「不在白名单」而错误丢弃已许可的工具。
    """
    return _ALIASES.get(name, name)


def resolve_tool_names(names: list[str] | None) -> list[Any]:
    """把工具名列表解析为 ADK 工具 / callable 列表；未知名 log warning 后丢弃（fail-soft）。"""
    resolved: list[Any] = []
    for raw in names or []:
        key = canonicalize_tool_name(raw)
        tool = TOOL_REGISTRY.get(key)
        if tool is None:
            _logger.warning("tool_registry_unknown_name", name=raw)
            continue
        resolved.append(tool)
    return resolved
