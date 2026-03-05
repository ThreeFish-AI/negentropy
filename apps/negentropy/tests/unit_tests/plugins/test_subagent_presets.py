"""SubAgent 预设测试：确保 UI 同步源与代码定义一致。"""

from negentropy.agents.faculties import (
    action_agent,
    contemplation_agent,
    influence_agent,
    internalization_agent,
    perception_agent,
)
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
        assert payload["description"] == faculty.description
        assert payload["system_prompt"] == faculty.instruction
        assert payload["agent_type"] == "llm_agent"
        assert payload["tools"] == _tool_names(faculty)
        assert payload["adk_config"]["name"] == faculty.name
        assert payload["adk_config"]["instruction"] == faculty.instruction
        assert payload["adk_config"]["tools"] == _tool_names(faculty)
