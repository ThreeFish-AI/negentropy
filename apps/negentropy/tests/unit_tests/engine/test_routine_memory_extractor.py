"""Tests for IterationMemoryExtractor — Routine 迭代经验记忆提炼器。

覆盖：Prompt 构建、JSON 解析、类型映射、衰减率覆盖、终止批量提取。
参照 ``test_llm_fact_extractor.py`` 的 mock 模式。"""

from __future__ import annotations

import json
from dataclasses import dataclass
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from negentropy.engine.routine.memory_extractor import (
    IterationMemoryExtractor,
    compute_decay_override,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@dataclass
class _FakeRoutine:
    goal: str = "优化 negentropy-ui 的 Routine 列表页渲染性能"
    acceptance_criteria: str = "首屏加载 < 2s，无多余 re-render"
    key: str = "perf-opt-001"
    id: str = "00000000-0000-0000-0000-000000000001"
    owner_id: str = "negentropy_engine"
    status: str = "running"
    termination_reason: str | None = None


@dataclass
class _FakeIteration:
    summary: str = "通过 React.memo 优化了 RoutineCard 组件，减少了 60% 的不必要 re-render"
    score: int = 85
    verdict: str = "progressing"
    reflection: str = "性能有显著提升但仍需优化列表虚拟化"
    seq: int = 3
    exec_status: str = "success"
    gate_exit_code: int | None = 0


@dataclass
class _FakeEvent:
    event_type: str = "tool_use"
    tool_name: str = "read_file"
    title: str = "Read routine-list.tsx"


def _make_llm_response(content: str, cost: float = 0.001) -> MagicMock:
    response = MagicMock()
    response.choices = [MagicMock()]
    response.choices[0].message.content = content
    response._hidden_params = {"response_cost": cost}
    return response


@pytest.fixture
def extractor():
    ext = IterationMemoryExtractor()
    ext._resolve_model = AsyncMock(  # type: ignore[method-assign]
        side_effect=lambda: _set_model(ext)
    )
    return ext


def _set_model(instance):
    instance._model = "test-model"
    instance._model_kwargs = {}


# ---------------------------------------------------------------------------
# compute_decay_override
# ---------------------------------------------------------------------------


class TestComputeDecayOverride:
    def test_pass_procedural_near_core(self):
        assert compute_decay_override("pass", "procedural") == 0.003

    def test_pass_semantic_near_core(self):
        assert compute_decay_override("pass", "semantic") == 0.003

    def test_pass_fact_semantic_rate(self):
        assert compute_decay_override("pass", "fact") == 0.005

    def test_pass_episodic_moderate(self):
        assert compute_decay_override("pass", "episodic") == 0.02

    def test_progressing_procedural_moderate(self):
        assert compute_decay_override("progressing", "procedural") == 0.02

    def test_regressed_episodic_avoidance(self):
        """失败经验的情景记忆衰减率较低（避险学习价值）。"""
        assert compute_decay_override("regressed", "episodic") == 0.02

    def test_stalled_fallback(self):
        assert compute_decay_override("stalled", "procedural") == 0.03

    def test_unknown_verdict_default(self):
        assert compute_decay_override("unknown_verdict", "episodic") == 0.05

    def test_none_verdict_default(self):
        assert compute_decay_override(None, "episodic") == 0.05


# ---------------------------------------------------------------------------
# extract — 单迭代提取
# ---------------------------------------------------------------------------


class TestExtract:
    async def test_extract_valid_json(self, extractor):
        content = json.dumps(
            {
                "memories": [
                    {
                        "content": "React.memo 可有效减少 RoutineCard 的不必要 re-render",
                        "type": "procedural",
                        "rationale": "经验证有效的优化方法",
                    },
                    {
                        "content": "negentropy-ui Routine 列表页使用非虚拟化列表渲染",
                        "type": "fact",
                        "rationale": "架构事实",
                    },
                ]
            }
        )
        with patch("negentropy.engine.routine.memory_extractor.litellm") as mock_litellm:
            mock_litellm.acompletion = AsyncMock(return_value=_make_llm_response(content))
            result = await extractor.extract(_FakeRoutine(), _FakeIteration())

        assert len(result.memories) == 2
        assert result.memories[0].memory_type == "procedural"
        assert result.memories[1].memory_type == "fact"
        assert "React.memo" in result.memories[0].content
        assert result.cost_usd == 0.001
        assert result.model_used == "test-model"

    async def test_extract_unknown_type_fallback_episodic(self, extractor):
        content = json.dumps(
            {
                "memories": [
                    {
                        "content": "测试内容",
                        "type": "unknown_type",
                        "rationale": "测试",
                    },
                ]
            }
        )
        with patch("negentropy.engine.routine.memory_extractor.litellm") as mock_litellm:
            mock_litellm.acompletion = AsyncMock(return_value=_make_llm_response(content))
            result = await extractor.extract(_FakeRoutine(), _FakeIteration())

        assert len(result.memories) == 1
        assert result.memories[0].memory_type == "episodic"

    async def test_extract_empty_content_skipped(self, extractor):
        content = json.dumps(
            {
                "memories": [
                    {"content": "", "type": "procedural", "rationale": "空内容"},
                    {"content": "有效内容", "type": "semantic", "rationale": "有效"},
                ]
            }
        )
        with patch("negentropy.engine.routine.memory_extractor.litellm") as mock_litellm:
            mock_litellm.acompletion = AsyncMock(return_value=_make_llm_response(content))
            result = await extractor.extract(_FakeRoutine(), _FakeIteration())

        assert len(result.memories) == 1
        assert result.memories[0].content == "有效内容"

    async def test_extract_malformed_json(self, extractor):
        with patch("negentropy.engine.routine.memory_extractor.litellm") as mock_litellm:
            mock_litellm.acompletion = AsyncMock(return_value=_make_llm_response("not json"))
            result = await extractor.extract(_FakeRoutine(), _FakeIteration())

        assert result.memories == []
        assert result.cost_usd == 0.001

    async def test_extract_llm_exception(self, extractor):
        with patch("negentropy.engine.routine.memory_extractor.litellm") as mock_litellm:
            mock_litellm.acompletion = AsyncMock(side_effect=Exception("API error"))
            result = await extractor.extract(_FakeRoutine(), _FakeIteration())

        assert result.memories == []
        assert result.cost_usd == 0.0

    async def test_extract_with_events(self, extractor):
        """验证事件列表被压缩为摘要形态传入 prompt。"""
        events = [
            _FakeEvent(event_type="tool_use", tool_name="read_file", title="Read routine-list.tsx"),
            _FakeEvent(event_type="tool_use", tool_name="edit_file", title="Edit RoutineCard.tsx"),
            _FakeEvent(event_type="assistant", tool_name=None, title="分析渲染瓶颈"),
        ]
        content = json.dumps({"memories": []})
        with patch("negentropy.engine.routine.memory_extractor.litellm") as mock_litellm:
            mock_litellm.acompletion = AsyncMock(return_value=_make_llm_response(content))
            result = await extractor.extract(_FakeRoutine(), _FakeIteration(), events=events)

        assert result.memories == []
        # 验证 prompt 中包含事件信息
        call_args = mock_litellm.acompletion.call_args
        prompt = call_args.kwargs.get("messages", call_args[0][1] if call_args[0] else [{}])[0]["content"]
        assert "read_file" in prompt
        assert "edit_file" in prompt

    async def test_extract_no_gate(self, extractor):
        """无命令门控时 prompt 中不包含 gate section。"""
        iteration = _FakeIteration(gate_exit_code=None)
        content = json.dumps({"memories": []})
        with patch("negentropy.engine.routine.memory_extractor.litellm") as mock_litellm:
            mock_litellm.acompletion = AsyncMock(return_value=_make_llm_response(content))
            await extractor.extract(_FakeRoutine(), iteration)

        call_args = mock_litellm.acompletion.call_args
        prompt = call_args.kwargs["messages"][0]["content"]
        assert "命令门控" not in prompt


# ---------------------------------------------------------------------------
# extract_on_termination — 终止批量提取
# ---------------------------------------------------------------------------


class TestExtractOnTermination:
    async def test_termination_extract_valid(self, extractor):
        routine = _FakeRoutine(status="succeeded", termination_reason="success")
        history = [
            _FakeIteration(seq=1, score=40, verdict="regressed", reflection="方法 A 失败"),
            _FakeIteration(seq=2, score=70, verdict="progressing", reflection="方法 B 有进展"),
            _FakeIteration(seq=3, score=90, verdict="pass", reflection="方法 B 成功"),
        ]
        content = json.dumps(
            {
                "memories": [
                    {
                        "content": "方案 A（直接 memo）失败，方案 B（虚拟化列表）成功",
                        "type": "episodic",
                        "rationale": "跨迭代模式认知",
                    },
                ]
            }
        )
        with patch("negentropy.engine.routine.memory_extractor.litellm") as mock_litellm:
            mock_litellm.acompletion = AsyncMock(return_value=_make_llm_response(content))
            result = await extractor.extract_on_termination(routine, history)

        assert len(result.memories) == 1
        assert "方案 A" in result.memories[0].content

    async def test_termination_empty_history(self, extractor):
        routine = _FakeRoutine(status="failed", termination_reason="max_iterations")
        content = json.dumps({"memories": []})
        with patch("negentropy.engine.routine.memory_extractor.litellm") as mock_litellm:
            mock_litellm.acompletion = AsyncMock(return_value=_make_llm_response(content))
            result = await extractor.extract_on_termination(routine, [])

        assert result.memories == []


# ---------------------------------------------------------------------------
# Prompt 构建
# ---------------------------------------------------------------------------


class TestBuildPrompt:
    def test_prompt_contains_all_sections(self, extractor):
        prompt = IterationMemoryExtractor._build_prompt(
            _FakeRoutine(),
            _FakeIteration(),
        )
        assert "任务目标" in prompt
        assert "验收标准" in prompt
        assert "执行摘要" in prompt
        assert "评估结果" in prompt
        assert "判定: progressing" in prompt
        assert "反思" in prompt
        assert "动作序列" in prompt

    def test_prompt_gate_section_present(self, extractor):
        iteration = _FakeIteration(gate_exit_code=0)
        prompt = IterationMemoryExtractor._build_prompt(_FakeRoutine(), iteration)
        assert "命令门控" in prompt
        assert "退出码: 0" in prompt

    def test_prompt_gate_section_absent(self, extractor):
        iteration = _FakeIteration(gate_exit_code=None)
        prompt = IterationMemoryExtractor._build_prompt(_FakeRoutine(), iteration)
        assert "命令门控" not in prompt


class TestBuildTerminationPrompt:
    def test_termination_prompt_contains_timeline(self, extractor):
        routine = _FakeRoutine(status="succeeded", termination_reason="success")
        history = [
            _FakeIteration(seq=1, score=40, verdict="regressed"),
            _FakeIteration(seq=2, score=90, verdict="pass"),
        ]
        prompt = IterationMemoryExtractor._build_termination_prompt(routine, history)
        assert "迭代 #1" in prompt
        assert "迭代 #2" in prompt
        assert "succeeded" in prompt
        assert "success" in prompt
