"""SubAgent 预设测试：确保 UI 同步源与代码定义一致。"""

from negentropy.agents.agent import root_agent
from negentropy.agents.faculties import (
    action_agent,
    contemplation_agent,
    influence_agent,
    internalization_agent,
    perception_agent,
)
from negentropy.interface.subagent_presets import (
    KIND_ROOT,
    KIND_SUBAGENT,
    NEGENTROPY_SUBAGENT_NAMES,
    build_negentropy_subagent_payloads,
)
from negentropy.model_names import canonicalize_model_name


def _tool_names(agent) -> list[str]:
    names: list[str] = []
    for tool in agent.tools or []:
        name = getattr(tool, "name", None) or getattr(tool, "__name__", None) or tool.__class__.__name__
        names.append(name)
    return names


def test_builtin_payload_count_and_order():
    payloads = build_negentropy_subagent_payloads()
    # root + 5 subagents
    assert len(payloads) == 6
    assert [payload["name"] for payload in payloads] == NEGENTROPY_SUBAGENT_NAMES
    # root 在首项
    assert payloads[0]["name"] == "NegentropyEngine"
    assert payloads[0]["adk_config"]["kind"] == KIND_ROOT
    # 子 Agent 均为 subagent
    for p in payloads[1:]:
        assert p["adk_config"]["kind"] == KIND_SUBAGENT


def test_root_agent_payload():
    payloads = {p["name"]: p for p in build_negentropy_subagent_payloads()}
    root_payload = payloads["NegentropyEngine"]
    assert root_payload["description"] == root_agent.description
    assert root_payload["agent_type"] == "llm_agent"
    assert root_payload["adk_config"]["kind"] == KIND_ROOT
    assert isinstance(root_payload["system_prompt"], str) and len(root_payload["system_prompt"]) > 100
    expected_model = canonicalize_model_name(getattr(root_agent.model, "model", str(root_agent.model)))
    assert root_payload["model"] == expected_model


def test_builtin_payload_matches_faculty_definition():
    payloads = {payload["name"]: payload for payload in build_negentropy_subagent_payloads()}
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
        assert adk_config["kind"] == KIND_SUBAGENT


def test_builtin_payloads_are_serialized_without_name_error_regression():
    payloads = build_negentropy_subagent_payloads()

    assert payloads
    for payload in payloads:
        assert isinstance(payload["adk_config"], dict)
