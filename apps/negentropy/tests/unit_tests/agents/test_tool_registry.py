"""工具注册表单测 — 命名单源、别名归一、fail-soft（纯逻辑，无 DB）。

覆盖 WS1 的名解析基座：
- 正/反映射同口径（``tool_name(sym) == key``），消除 sync 落库与运行时解析的命名漂移；
- ``claude_code`` 别名归一到 ``invoke_claude_code``（BuiltinTool 历史命名兼容）；
- 未知名 fail-soft（log warning 后丢弃，绝不抛）。
"""

from __future__ import annotations

from negentropy.agents.tools.registry import (
    TOOL_REGISTRY,
    canonicalize_tool_name,
    resolve_tool_names,
    tool_name,
)


def test_registry_self_consistent_naming():
    """每个注册表键 = ``tool_name(符号)``：正/反映射同口径，消除漂移。"""
    for key, sym in TOOL_REGISTRY.items():
        assert tool_name(sym) == key, f"naming drift: key={key!r} tool_name={tool_name(sym)!r}"


def test_registry_covers_six_faculty_tools():
    """六翼所需工具全部登记（含 mandatory 与各翼可摘工具）。"""
    expected = {
        # 通用 / 记忆
        "log_activity",
        "load_memory",
        "preload_memory",
        # 感知
        "search_knowledge_base",
        "search_web",
        "search_knowledge_graph_global",
        "search_knowledge_graph_with_papers",
        "search_papers",
        # 内化
        "save_to_memory",
        "update_knowledge_graph",
        "ingest_paper",
        "ingest_to_corpus",
        # 沉思
        "analyze_context",
        "create_plan",
        # 行动
        "execute_code",
        "read_file",
        "write_file",
        "invoke_claude_code",
        # 影响
        "publish_content",
        "send_notification",
    }
    assert expected <= set(TOOL_REGISTRY), f"missing: {expected - set(TOOL_REGISTRY)}"


def test_alias_canonicalization():
    assert canonicalize_tool_name("claude_code") == "invoke_claude_code"
    # 已规范名原样返回
    assert canonicalize_tool_name("invoke_claude_code") == "invoke_claude_code"
    assert canonicalize_tool_name("search_web") == "search_web"


def test_resolve_alias_returns_real_callable():
    """别名 ``claude_code`` 解析为 ``invoke_claude_code`` 的真实 callable。"""
    resolved = resolve_tool_names(["claude_code"])
    assert len(resolved) == 1
    assert tool_name(resolved[0]) == "invoke_claude_code"


def test_resolve_unknown_skipped_fail_soft():
    """未知名 log warning 后丢弃，绝不抛；合法名仍解析。"""
    resolved = resolve_tool_names(["__nonexistent__", "search_web", "another_bogus"])
    assert len(resolved) == 1
    assert tool_name(resolved[0]) == "search_web"


def test_resolve_none_and_empty():
    assert resolve_tool_names(None) == []
    assert resolve_tool_names([]) == []
