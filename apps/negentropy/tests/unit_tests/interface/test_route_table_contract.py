"""Interface 路由表契约 — 注册序 + 方法 + 路径 + 处理器名快照 + 遮蔽 lint。

目的：
1. 防漂移：interface 域路由的任何增删/改序/改名在此显式失败，迫使变更有意识更新快照。
2. 防遮蔽：固化「字面量段注册在参数段之后被吞没」这一类缺陷
   （历史事故：PATCH /interface/{mcp/servers,tools,skills}/reorder 被 {id} 路由遮蔽返回 422）。
"""

from __future__ import annotations

import re

import pytest

from negentropy.interface.api import router

_PARAM_RE = re.compile(r"^\{.+\}$")

# (method, path, endpoint) × 注册序 —— 与 interface/api.py 拆分后的聚合序一致
EXPECTED_ROUTE_TABLE: list[tuple[str, str, str]] = [
    ("GET", "/interface/stats", "get_stats"),
    ("GET", "/interface/mcp/servers", "list_mcp_servers"),
    ("POST", "/interface/mcp/servers", "create_mcp_server"),
    ("GET", "/interface/mcp/servers/{server_id}", "get_mcp_server"),
    ("PATCH", "/interface/mcp/servers/{server_id}", "update_mcp_server"),
    ("DELETE", "/interface/mcp/servers/{server_id}", "delete_mcp_server"),
    ("PATCH", "/interface/mcp/servers/reorder", "reorder_mcp_servers"),
    ("POST", "/interface/mcp/servers/{server_id}/tools:load", "load_mcp_server_tools"),
    ("GET", "/interface/mcp/servers/{server_id}/tools", "list_mcp_server_tools"),
    ("GET", "/interface/mcp/servers/{server_id}/resource-templates", "list_mcp_server_resource_templates"),
    ("PATCH", "/interface/mcp/servers/{server_id}/tools/{tool_id}", "update_mcp_tool"),
    ("POST", "/interface/mcp/servers/{server_id}/trial-assets", "upload_mcp_trial_asset"),
    ("POST", "/interface/mcp/servers/{server_id}/tools:execute", "execute_mcp_tool"),
    ("GET", "/interface/mcp/servers/{server_id}/runs", "list_mcp_tool_runs"),
    ("GET", "/interface/mcp/runs/{run_id}", "get_mcp_tool_run"),
    ("GET", "/interface/tools/available", "list_available_tools"),
    ("GET", "/interface/tools", "list_builtin_tools"),
    ("POST", "/interface/tools", "create_builtin_tool"),
    ("GET", "/interface/tools/{tool_id}", "get_builtin_tool"),
    ("PATCH", "/interface/tools/{tool_id}", "update_builtin_tool"),
    ("DELETE", "/interface/tools/{tool_id}", "delete_builtin_tool"),
    ("PATCH", "/interface/tools/reorder", "reorder_builtin_tools"),
    ("POST", "/interface/tools/{tool_id}:test", "test_builtin_tool"),
    ("GET", "/interface/skills", "list_skills"),
    ("POST", "/interface/skills", "create_skill"),
    ("GET", "/interface/skills/templates", "list_skill_templates"),
    ("POST", "/interface/skills/from-template", "create_skill_from_template"),
    ("GET", "/interface/skills/{skill_id}", "get_skill"),
    ("PATCH", "/interface/skills/{skill_id}", "update_skill"),
    ("GET", "/interface/skills/{skill_id}/versions", "list_skill_versions"),
    ("POST", "/interface/skills/{skill_id}/versions", "create_skill_version"),
    ("GET", "/interface/skills/{skill_id}/schedules", "list_skill_schedules"),
    ("POST", "/interface/skills/{skill_id}/schedules", "create_skill_schedule"),
    ("DELETE", "/interface/skills/{skill_id}/schedules/{schedule_id}", "delete_skill_schedule"),
    ("POST", "/interface/skills/{skill_id}/schedules/{schedule_id}/run", "run_skill_schedule"),
    ("DELETE", "/interface/skills/{skill_id}", "delete_skill"),
    ("PATCH", "/interface/skills/reorder", "reorder_skills"),
    ("POST", "/interface/skills/{skill_id}/invoke", "invoke_skill"),
    ("GET", "/interface/agents", "list_agents"),
    ("PATCH", "/interface/agents/reorder", "reorder_agents"),
    ("GET", "/interface/agents/templates/negentropy", "list_negentropy_agent_templates"),
    ("POST", "/interface/agents/sync/negentropy", "sync_negentropy_agents"),
    ("POST", "/interface/agents", "create_agent"),
    ("GET", "/interface/agents/{agent_id}", "get_agent"),
    ("PATCH", "/interface/agents/{agent_id}", "update_agent"),
    ("DELETE", "/interface/agents/{agent_id}", "delete_agent"),
    ("GET", "/interface/{plugin_type}/{plugin_id}/permissions", "list_permissions"),
    ("POST", "/interface/{plugin_type}/{plugin_id}/permissions", "grant_permission"),
    ("DELETE", "/interface/{plugin_type}/{plugin_id}/permissions/{user_id}", "revoke_permission"),
]


def _route_table() -> list[tuple[str, str, str]]:
    rows: list[tuple[str, str, str]] = []
    for r in router.routes:
        methods = sorted(m for m in (getattr(r, "methods", None) or ()) if m not in ("HEAD", "OPTIONS"))
        for m in methods:
            rows.append((m, r.path, getattr(r.endpoint, "__name__", "?")))
    return rows


def test_route_table_snapshot() -> None:
    """50 路由四元组（注册序）与快照逐一相等。"""
    assert _route_table() == EXPECTED_ROUTE_TABLE


@pytest.mark.parametrize(
    ("index",),
    [(i,) for i in range(len(EXPECTED_ROUTE_TABLE))],
)
def test_route_shadowing_static_analysis(index: int) -> None:
    """遮蔽 lint：对每对「同方法同段数」路由，若前路由各段均可兼容匹配后路由的字面量请求，
    且至少一处是「前参数段 vs 后字面量段」，则后路由存在不可达请求——失败。"""
    routes = [(m, p.split("/")) for m, p, _ in EXPECTED_ROUTE_TABLE]
    m_b, seg_b = routes[index]
    for j in range(index):
        m_a, seg_a = routes[j]
        if m_a != m_b or len(seg_a) != len(seg_b):
            continue
        shadowed = False
        reachable_gap = False
        for x, y in zip(seg_a, seg_b, strict=True):
            if x == y:
                continue
            x_param, y_param = bool(_PARAM_RE.match(x)), bool(_PARAM_RE.match(y))
            if x_param and not y_param:
                shadowed = True  # 前参数段可吞掉后字面量段
            else:
                reachable_gap = True  # 前段限定更窄，后路由仍有可达请求
        if shadowed and not reachable_gap:
            pytest.fail(
                f"路由遮蔽：注册序 {index} 的 {m_b} {'/'.join(seg_b)} "
                f"会被更早注册（序 {j}）的 {m_a} {'/'.join(seg_a)} 吞没其全部请求"
            )
