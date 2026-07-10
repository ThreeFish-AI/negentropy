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
    """flag-off（默认）→ None，调用方回退代码 root_agent。"""
    monkeypatch.delenv("NE_AGENTS_FROM_DB", raising=False)
    assert await build_nodes_from_db() is None
    assert await build_root_agent_from_db() is None


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
