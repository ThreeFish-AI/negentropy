"""Agent 工厂 — 单元测试。

覆盖：
1. ``_validate``：agent 规格必须含 name + agent_type（缺 → 422）；
2. ``build_nodes_from_db`` flag-off → None（代码兜底）；
3. ``build_nodes_from_db`` flag-on → 从 DB 构造 faculty/pipeline 节点 dict；
4. ``build_root_agent_from_db`` flag-on → 返回 root（sub_agents 非空）；flag-off → None。

flag-on 用例依赖 conftest ``upgrade head``（迁移 0099 已播种 9 个 agent 规格）+ 可 import 的
agent 栈（``create_*`` 工厂仅构造对象，不发起 LLM 调用）。
"""

from __future__ import annotations

import pytest

from negentropy.agents.definitions import DefinitionParseError, parse_definition
from negentropy.agents.definitions.agent_factory import (
    build_nodes_from_db,
    build_root_agent_from_db,
)


def test_validate_requires_agent_type():
    meta = parse_definition("agent", "yaml", "name: Foo\nagent_type: llm_agent\nkind: agent\nmodel: x")
    assert meta.get("name") == "Foo"
    assert meta.get("agent_type") == "llm_agent"
    with pytest.raises(DefinitionParseError):
        parse_definition("agent", "yaml", "name: Foo\nkind: agent")  # no agent_type


@pytest.mark.asyncio
async def test_build_nodes_flag_off_returns_none(monkeypatch):
    """显式 flag-off（NE_AGENTS_FROM_DB=0）→ None，调用方回退代码 root_agent。

    注：default-on 后「未设 / 空值」视为开启，故 off 用例须显式设 falsy 值。
    """
    monkeypatch.setenv("NE_AGENTS_FROM_DB", "0")
    assert await build_nodes_from_db() is None
    assert await build_root_agent_from_db() is None


@pytest.mark.asyncio
async def test_default_on_when_env_unset(monkeypatch):
    """default-on：未设环境变量即开启（完整启用语义）。"""
    monkeypatch.delenv("NE_AGENTS_FROM_DB", raising=False)
    root = await build_root_agent_from_db()
    assert root is not None
    assert root.name == "NegentropyEngine"


@pytest.mark.asyncio
async def test_build_nodes_flag_on_constructs_faculties(monkeypatch):
    """flag-on → 从 DB 构造 faculty/pipeline 节点。"""
    monkeypatch.setenv("NE_AGENTS_FROM_DB", "1")
    nodes = await build_nodes_from_db()
    assert nodes is not None
    # 5 faculties + 3 pipelines（root 不在 nodes 中，由 _assemble_root 单独处理）
    for name in (
        "PerceptionFaculty",
        "InternalizationFaculty",
        "ContemplationFaculty",
        "ActionFaculty",
        "InfluenceFaculty",
        "KnowledgeAcquisitionPipeline",
        "ProblemSolvingPipeline",
        "ValueDeliveryPipeline",
    ):
        assert name in nodes, f"missing node: {name}"


@pytest.mark.asyncio
async def test_build_root_flag_on_assembles_graph(monkeypatch):
    """flag-on → root 按 DB sub_agents 拓扑组装，sub_agents 非空。"""
    monkeypatch.setenv("NE_AGENTS_FROM_DB", "1")
    root = await build_root_agent_from_db()
    assert root is not None
    assert root.name == "NegentropyEngine"
    sub_names = [s.name for s in (getattr(root, "sub_agents", None) or [])]
    # DB root 规格列了 8 个 sub_agents（5 faculties + 3 pipelines）
    assert "PerceptionFaculty" in sub_names
    assert "KnowledgeAcquisitionPipeline" in sub_names
    assert len(sub_names) == 8


def _tool_names(agent):
    return sorted(getattr(t, "name", getattr(t, "__name__", "?")) for t in (getattr(agent, "tools", None) or []))


def _node_snapshot(agent):
    """节点行为快照（用于 DB↔代码等价性断言）。"""
    return {
        "name": agent.name,
        "mode": getattr(agent, "mode", None),
        "model": getattr(getattr(agent, "model", None), "model", None),
        "output_key": getattr(agent, "output_key", None),
        "tools": _tool_names(agent),
        "disallow_parent": getattr(agent, "disallow_transfer_to_parent", None),
        "disallow_peers": getattr(agent, "disallow_transfer_to_peers", None),
        "sub_agents": [s.name for s in (getattr(agent, "sub_agents", None) or [])],
    }


@pytest.mark.asyncio
async def test_db_root_is_behaviorally_equivalent_to_code_root(monkeypatch):
    """核心守卫：DB 构造 root 与代码 root **逐节点行为等价**（完整启用的前提）。

    防两类静默漂移回归：
    1. 顶层 faculty 丢失 ``mode='single_turn'``（降级为 ADK 默认 ``chat``，改调度语义）；
    2. root ``tools`` 因 sub_agents 二次派生导致 faculty transfer 工具重复。
    """
    monkeypatch.setenv("NE_AGENTS_FROM_DB", "1")
    from negentropy.agents.agent import root_agent as code_root

    db_root = await build_root_agent_from_db()
    assert db_root is not None

    # root 本体等价（含 tools 名单——无重复）
    assert _node_snapshot(db_root) == _node_snapshot(code_root)

    # 每个顶层 sub_agent 等价（mode / tools / output_key / disallow flags / 拓扑）
    code_sub = {s.name: s for s in code_root.sub_agents}
    db_sub = {s.name: s for s in db_root.sub_agents}
    assert set(code_sub) == set(db_sub)
    for name in code_sub:
        assert _node_snapshot(db_sub[name]) == _node_snapshot(code_sub[name]), f"node drift: {name}"

    # pipeline 内部 sub_agents（output_key）等价
    for name, code_node in code_sub.items():
        if "Pipeline" in name:
            code_internals = [_node_snapshot(s) for s in code_node.sub_agents]
            db_internals = [_node_snapshot(s) for s in db_sub[name].sub_agents]
            assert code_internals == db_internals, f"pipeline internals drift: {name}"
