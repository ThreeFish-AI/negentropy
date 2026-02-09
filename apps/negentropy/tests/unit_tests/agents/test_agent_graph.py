"""
Agent Graph Structure Tests — 反馈闭环 (Feedback Loop)

纯内存结构断言，零外部依赖（无 DB、无 LLM 调用），秒级执行。
验证「一核五翼」Agent 图的结构完整性，防止配置性静默失败。

遵循 AGENTS.md：反馈闭环 + 系统完整性。
"""

from google.adk.agents import SequentialAgent

from negentropy.agents.agent import root_agent
from negentropy.agents.faculties import (
    action_agent,
    contemplation_agent,
    create_action_agent,
    create_contemplation_agent,
    create_influence_agent,
    create_internalization_agent,
    create_perception_agent,
    influence_agent,
    internalization_agent,
    perception_agent,
)
from negentropy.agents.pipelines.standard import (
    create_knowledge_acquisition_pipeline,
    create_problem_solving_pipeline,
    create_value_delivery_pipeline,
)
from negentropy.agents.tools.common import log_activity

# ---------------------------------------------------------------------------
# 1. Root Agent 结构
# ---------------------------------------------------------------------------


def test_root_agent_name():
    """NegentropyEngine 是系统的「本我」"""
    assert root_agent.name == "NegentropyEngine"


def test_root_agent_has_8_sub_agents():
    """5 个 Faculty 单例 + 3 个 Pipeline = 8 个子 agent"""
    assert len(root_agent.sub_agents) == 8


def test_root_agent_tools():
    """root_agent 仅绑定 log_activity（不直接执行原子任务）"""
    tool_names = [t.__name__ if callable(t) else getattr(t, "name", str(t)) for t in root_agent.tools]
    assert "log_activity" in tool_names
    assert len(root_agent.tools) == 1


# ---------------------------------------------------------------------------
# 2. Faculty 单例是 root_agent 的直接子 agent
# ---------------------------------------------------------------------------


def test_faculty_singletons_are_root_sub_agents():
    """5 个模块级单例确实注册在 root_agent.sub_agents 中"""
    expected_ids = {
        id(perception_agent),
        id(internalization_agent),
        id(contemplation_agent),
        id(action_agent),
        id(influence_agent),
    }
    actual_ids = {id(a) for a in root_agent.sub_agents}
    assert expected_ids.issubset(actual_ids), "某些 Faculty 单例未注册为 root_agent 的子 agent"


# ---------------------------------------------------------------------------
# 3. 工厂函数创建独立实例（ADK 单亲规则）
# ---------------------------------------------------------------------------


def test_factory_creates_independent_instances():
    """每次工厂调用返回不同 id() 的实例，确保单亲规则不被违反"""
    factories = [
        create_perception_agent,
        create_internalization_agent,
        create_contemplation_agent,
        create_action_agent,
        create_influence_agent,
    ]
    for factory in factories:
        a = factory()
        b = factory()
        assert id(a) != id(b), f"{factory.__name__} 应返回独立实例"


# ---------------------------------------------------------------------------
# 4. Pipeline 结构与 output_key
# ---------------------------------------------------------------------------


def _assert_pipeline_structure(pipeline: SequentialAgent, expected_names: list[str], expected_keys: list[str]):
    """通用 pipeline 结构断言"""
    agents = pipeline.sub_agents
    assert len(agents) == len(expected_names), f"Pipeline {pipeline.name}: 预期 {len(expected_names)} 步, 实际 {len(agents)} 步"
    for i, (agent, name, key) in enumerate(zip(agents, expected_names, expected_keys)):
        assert agent.name == name, f"步骤 {i}: 预期 {name}, 实际 {agent.name}"
        assert agent.output_key == key, f"步骤 {i} ({name}): 预期 output_key={key!r}, 实际 {agent.output_key!r}"


def test_knowledge_pipeline_structure():
    """知识获取流水线：感知 → 内化"""
    pipeline = create_knowledge_acquisition_pipeline()
    _assert_pipeline_structure(
        pipeline,
        expected_names=["PerceptionFaculty", "InternalizationFaculty"],
        expected_keys=["perception_output", "internalization_output"],
    )


def test_problem_solving_pipeline_structure():
    """问题解决流水线：感知 → 沉思 → 行动 → 内化"""
    pipeline = create_problem_solving_pipeline()
    _assert_pipeline_structure(
        pipeline,
        expected_names=["PerceptionFaculty", "ContemplationFaculty", "ActionFaculty", "InternalizationFaculty"],
        expected_keys=["perception_output", "contemplation_output", "action_output", "internalization_output"],
    )


def test_value_delivery_pipeline_structure():
    """价值交付流水线：感知 → 沉思 → 影响"""
    pipeline = create_value_delivery_pipeline()
    _assert_pipeline_structure(
        pipeline,
        expected_names=["PerceptionFaculty", "ContemplationFaculty", "InfluenceFaculty"],
        expected_keys=["perception_output", "contemplation_output", "influence_output"],
    )


# ---------------------------------------------------------------------------
# 5. Pipeline Agent 的 transfer 边界管控
# ---------------------------------------------------------------------------


def test_pipeline_agents_disallow_transfer():
    """Pipeline 内的 agent 应禁止 transfer（边界管理原则）"""
    pipeline = create_problem_solving_pipeline()
    for agent in pipeline.sub_agents:
        assert agent.disallow_transfer_to_parent is True, (
            f"{agent.name}: disallow_transfer_to_parent 应为 True"
        )
        assert agent.disallow_transfer_to_peers is True, (
            f"{agent.name}: disallow_transfer_to_peers 应为 True"
        )


def test_singleton_agents_allow_transfer():
    """root_agent 直接委派的单例 agent 应允许 transfer（默认行为）"""
    singletons = [perception_agent, internalization_agent, contemplation_agent, action_agent, influence_agent]
    for agent in singletons:
        assert agent.disallow_transfer_to_parent is False, (
            f"{agent.name}: 单例应允许 transfer_to_parent"
        )
        assert agent.disallow_transfer_to_peers is False, (
            f"{agent.name}: 单例应允许 transfer_to_peers"
        )


# ---------------------------------------------------------------------------
# 6. Agent 名称唯一性（防止路由歧义）
# ---------------------------------------------------------------------------


def test_all_direct_sub_agent_names_unique():
    """root_agent.sub_agents 中无重名（否则 transfer_to_agent 路由歧义）"""
    names = [a.name for a in root_agent.sub_agents]
    assert len(names) == len(set(names)), f"重名 agent: {[n for n in names if names.count(n) > 1]}"


# ---------------------------------------------------------------------------
# 7. Pipeline 名称常量一致性
# ---------------------------------------------------------------------------


def test_pipeline_names_match_constants():
    """Pipeline 实例名称与常量定义一致"""
    from negentropy.agents.pipelines.standard import (
        KNOWLEDGE_ACQUISITION_PIPELINE_NAME,
        PROBLEM_SOLVING_PIPELINE_NAME,
        VALUE_DELIVERY_PIPELINE_NAME,
    )

    assert create_knowledge_acquisition_pipeline().name == KNOWLEDGE_ACQUISITION_PIPELINE_NAME
    assert create_problem_solving_pipeline().name == PROBLEM_SOLVING_PIPELINE_NAME
    assert create_value_delivery_pipeline().name == VALUE_DELIVERY_PIPELINE_NAME
