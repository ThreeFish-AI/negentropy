"""Agent 预设测试：确保 UI 同步源与代码定义一致。"""

from negentropy.agents.agent import root_agent
from negentropy.agents.faculties import (
    action_agent,
    contemplation_agent,
    influence_agent,
    internalization_agent,
    perception_agent,
)
from negentropy.interface.agent_presets import (
    KIND_AGENT,
    KIND_ROOT,
    NEGENTROPY_AGENT_NAMES,
    build_negentropy_agent_payloads,
)
from negentropy.model_names import canonicalize_model_name


def _tool_names(agent) -> list[str]:
    names: list[str] = []
    for tool in agent.tools or []:
        name = getattr(tool, "name", None) or getattr(tool, "__name__", None) or tool.__class__.__name__
        names.append(name)
    return names


def test_builtin_payload_count_and_order():
    payloads = build_negentropy_agent_payloads()
    # root + 5 agents
    assert len(payloads) == 6
    assert [payload["name"] for payload in payloads] == NEGENTROPY_AGENT_NAMES
    # root 在首项
    assert payloads[0]["name"] == "NegentropyEngine"
    assert payloads[0]["adk_config"]["kind"] == KIND_ROOT
    # 子 Agent 均为 agent
    for p in payloads[1:]:
        assert p["adk_config"]["kind"] == KIND_AGENT


def test_root_agent_payload():
    payloads = {p["name"]: p for p in build_negentropy_agent_payloads()}
    root_payload = payloads["NegentropyEngine"]
    assert root_payload["description"] == root_agent.description
    assert root_payload["agent_type"] == "llm_agent"
    assert root_payload["adk_config"]["kind"] == KIND_ROOT
    assert isinstance(root_payload["system_prompt"], str) and len(root_payload["system_prompt"]) > 100
    expected_model = canonicalize_model_name(getattr(root_agent.model, "model", str(root_agent.model)))
    assert root_payload["model"] == expected_model


def test_builtin_payload_matches_faculty_definition():
    payloads = {payload["name"]: payload for payload in build_negentropy_agent_payloads()}
    for faculty in [perception_agent, internalization_agent, contemplation_agent, action_agent, influence_agent]:
        payload = payloads[faculty.name]
        adk_config = payload["adk_config"]
        assert payload["description"] == faculty.description
        # instruction 已接入 InstructionProvider (callable)，payload 中为 fallback 文本
        assert isinstance(payload["system_prompt"], str) and len(payload["system_prompt"]) > 50
        assert payload["agent_type"] == "llm_agent"
        assert payload["tools"] == _tool_names(faculty)
        expected_model = canonicalize_model_name(getattr(faculty.model, "model", str(faculty.model)))
        assert payload["model"] == expected_model
        assert adk_config["name"] == faculty.name
        assert isinstance(adk_config["instruction"], str) and len(adk_config["instruction"]) > 50
        assert adk_config["tools"] == _tool_names(faculty)
        assert adk_config["model"] == expected_model
        assert "include_contents" in adk_config
        assert "input_schema" in adk_config
        assert "output_schema" in adk_config
        assert "generate_content_config" in adk_config
        assert "planner" in adk_config
        # kind 字段
        assert adk_config["kind"] == KIND_AGENT


def test_builtin_payloads_are_serialized_without_name_error_regression():
    payloads = build_negentropy_agent_payloads()

    assert payloads
    for payload in payloads:
        assert isinstance(payload["adk_config"], dict)


def test_influence_faculty_payload_carries_translate_skill_and_tool():
    """InfluenceFaculty 装配：document-translate 技能 + invoke_claude_code 工具。

    Sync 用本 payload 覆盖 DB 行（_AGENT_SKILLS 是精准挂载技能的单一事实源），
    技能丢失会导致翻译链路的 Progressive Disclosure 失效。
    """
    payloads = {p["name"]: p for p in build_negentropy_agent_payloads()}
    influence_payload = payloads["InfluenceFaculty"]
    assert influence_payload["skills"] == ["document-translate"]
    assert "invoke_claude_code" in influence_payload["tools"]
    # 其余 Agent 不受映射影响
    for name, payload in payloads.items():
        if name != "InfluenceFaculty":
            assert payload["skills"] == []
