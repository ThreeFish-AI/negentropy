"""NegentropyToolset 单测 — WS1 tools 运行时回源（纯逻辑，无真实 DB）。

覆盖：
- **flag-off 零回归**（默认）：``get_tools`` 恒返回 ``default_names``，与硬编码逐字节等价；
- flag-on 回源：DB 子集 → 仅返回子集；白名单挡跨翼高危工具；别名归一；
- fail-soft：``_resolve_names`` 异常 → 回退 default；
- 序列化 ``configured_tool_names`` 稳定（供 sync 落库）。

flag-on 路径用 monkeypatch ``_resolve_names`` 模拟 DB 返回（绕过 frozen settings 的 flag 检查），
聚焦白名单 / mandatory / 别名过滤逻辑（安全关键）。
"""

from __future__ import annotations

from google.adk.tools.base_toolset import BaseToolset

from negentropy.agents._dynamic_tools import NegentropyToolset
from negentropy.agents.faculties import action_agent, perception_agent


def _toolset_of(agent) -> NegentropyToolset:
    return [t for t in agent.tools if isinstance(t, BaseToolset)][0]


def _names(tools) -> list[str]:
    return sorted(t.name for t in tools)


async def test_flag_off_returns_default_zero_regression():
    """开关默认关 → faculty 自身 toolset 返回 default_names（mandatory 在常量位不在此处）。"""
    ts = _toolset_of(perception_agent)
    tools = await ts.get_tools(None)
    assert _names(tools) == sorted(
        [
            "search_knowledge_base",
            "search_knowledge_graph_global",
            "search_knowledge_graph_with_papers",
            "search_web",
            "search_papers",
        ]
    )
    # mandatory（log_activity / load_memory）在常量位挂载，toolset 不重复产出
    assert "log_activity" not in _names(tools)
    assert "load_memory" not in _names(tools)


async def test_flag_on_db_subset(monkeypatch):
    """flag-on + DB 返回子集 → 仅返回子集（经白名单）。"""
    ts = NegentropyToolset(
        agent_name="PerceptionFaculty",
        default_names=["search_knowledge_base", "search_web", "search_papers"],
        mandatory_names=["log_activity", "load_memory"],
    )

    async def fake_resolve():
        return ["search_web"]  # DB 仅配 search_web

    monkeypatch.setattr(ts, "_resolve_names", fake_resolve)
    assert _names(await ts.get_tools(None)) == ["search_web"]


async def test_flag_on_disallowed_high_risk_dropped(monkeypatch):
    """DB 给 Perception 配 invoke_claude_code（跨翼高危）→ 白名单丢弃 + warn。"""
    ts = NegentropyToolset(
        agent_name="PerceptionFaculty",
        default_names=["search_web"],
        mandatory_names=["log_activity"],
    )

    async def fake_resolve():
        return ["search_web", "invoke_claude_code"]

    monkeypatch.setattr(ts, "_resolve_names", fake_resolve)
    names = _names(await ts.get_tools(None))
    assert "search_web" in names
    assert "invoke_claude_code" not in names  # 被白名单挡


async def test_flag_on_alias_resolved(monkeypatch):
    """DB 存别名 ``claude_code`` → 归一为 ``invoke_claude_code``（Action 允许）。"""
    ts = NegentropyToolset(
        agent_name="ActionFaculty",
        default_names=["execute_code", "invoke_claude_code"],
        mandatory_names=["log_activity"],
    )

    async def fake_resolve():
        return ["claude_code"]  # DB 用 BuiltinTool 命名

    monkeypatch.setattr(ts, "_resolve_names", fake_resolve)
    assert _names(await ts.get_tools(None)) == ["invoke_claude_code"]


async def test_flag_on_mandatory_dropped_even_if_in_db(monkeypatch):
    """DB 误列 mandatory（log_activity）→ toolset 不重复产出（已在常量位）。"""
    ts = NegentropyToolset(
        agent_name="PerceptionFaculty",
        default_names=["search_web"],
        mandatory_names=["log_activity", "load_memory"],
    )

    async def fake_resolve():
        return ["search_web", "log_activity", "load_memory"]

    monkeypatch.setattr(ts, "_resolve_names", fake_resolve)
    assert _names(await ts.get_tools(None)) == ["search_web"]


async def test_resolve_failure_falls_back_to_default(monkeypatch):
    """_resolve_names 异常 → get_tools 回退 default（永不阻塞）。"""
    ts = NegentropyToolset(
        agent_name="PerceptionFaculty",
        default_names=["search_web", "search_papers"],
        mandatory_names=["log_activity"],
    )

    async def boom():
        raise RuntimeError("db down")

    monkeypatch.setattr(ts, "_resolve_names", boom)
    assert _names(await ts.get_tools(None)) == ["search_papers", "search_web"]


def test_configured_tool_names_stable_for_sync():
    """``configured_tool_names`` 返回「mandatory + default」保序去重，供 sync 落库。"""
    ts = NegentropyToolset(
        agent_name="PerceptionFaculty",
        default_names=["search_web", "search_papers"],
        mandatory_names=["log_activity", "load_memory"],
    )
    assert ts.configured_tool_names() == ["log_activity", "load_memory", "search_web", "search_papers"]


async def test_action_faculty_flag_off_keeps_invoke_claude_code():
    """flag-off 时 Action 保留 invoke_claude_code（别名 bug 回归锚：claude_code 不再被误删）。"""
    ts = _toolset_of(action_agent)
    names = _names(await ts.get_tools(None))
    assert "invoke_claude_code" in names
    assert "execute_code" in names
