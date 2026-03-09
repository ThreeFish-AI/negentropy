"""SubAgent 预设测试：确保 UI 同步源与代码定义一致。"""

from negentropy.agents.faculties import (
    action_agent,
    contemplation_agent,
    influence_agent,
    internalization_agent,
    perception_agent,
)
from negentropy.model_names import canonicalize_model_name
from negentropy.plugins.subagent_presets import (
    NEGENTROPY_SUBAGENT_NAMES,
    build_negentropy_subagent_payloads,
)


def _tool_names(agent) -> list[str]:
    names: list[str] = []
    for tool in agent.tools or []:
        name = getattr(tool, "name", None) or getattr(tool, "__name__", None) or tool.__class__.__name__
        names.append(name)
    return names


def test_builtin_payload_count_and_order():
    payloads = build_negentropy_subagent_payloads()
    assert len(payloads) == 5
    assert [payload["name"] for payload in payloads] == NEGENTROPY_SUBAGENT_NAMES


def test_builtin_payload_matches_faculty_definition():
    payloads = {payload["name"]: payload for payload in build_negentropy_subagent_payloads()}
    for faculty in [perception_agent, internalization_agent, contemplation_agent, action_agent, influence_agent]:
        payload = payloads[faculty.name]
        adk_config = payload["adk_config"]
        assert payload["description"] == faculty.description
        assert payload["system_prompt"] == faculty.instruction
        assert payload["agent_type"] == "llm_agent"
        assert payload["tools"] == _tool_names(faculty)
        expected_model = canonicalize_model_name(getattr(faculty.model, "model", str(faculty.model)))
        assert payload["model"] == expected_model
        assert adk_config["name"] == faculty.name
        assert adk_config["instruction"] == faculty.instruction
        assert adk_config["tools"] == _tool_names(faculty)
        assert adk_config["model"] == expected_model
        assert "include_contents" in adk_config
        assert "input_schema" in adk_config
        assert "output_schema" in adk_config
        assert "generate_content_config" in adk_config
        assert "planner" in adk_config


def test_builtin_payloads_are_serialized_without_name_error_regression():
    payloads = build_negentropy_subagent_payloads()

    assert payloads
    for payload in payloads:
        assert isinstance(payload["adk_config"], dict)
