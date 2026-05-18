"""`PipelineOrchestrator` YAML 声明式输入路由单元测试。

覆盖场景：
1. 无 `input_from`/`input_builder` → 链式语义（向后兼容，webpage 行为保护）；
2. `input_from: <prev>` → 正确从指定前序 Stage 取 output；
3. `input_from: <missing>` → 结构化错误，不抛 AttributeError，管线终止但可观测；
4. `input_builder: <key>` → 调用注册构造器，传入完整 stage_results + initial_input；
5. `input_builder: not_registered` → 结构化错误；
6. 并行组多 Stage 各自 resolve，不再共用同一 current_input。
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict

import pytest

from negentropy.perceives.pipeline.base import StageResult
from negentropy.perceives.pipeline.orchestrator import PipelineOrchestrator
from negentropy.perceives.pipeline.registry import (
    _TOOL_REGISTRY,  # type: ignore[attr-defined]
    register_tool,
)


# ---------------------------------------------------------------------------
# 测试桩工具：把输入原样作为 output 返回，便于断言输入路由是否正确
# ---------------------------------------------------------------------------


class _EchoTool:
    """回显工具：将 input_data 直接作为 output 返回。"""

    name = "echo"

    def __init__(self, label: str = "echo") -> None:
        self._label = label

    def is_available(self) -> bool:
        return True

    async def execute(self, input_data: Any) -> StageResult:
        return StageResult(
            success=True,
            output={"label": self._label, "received": input_data},
            engine_used=self._label,
        )


@pytest.fixture(autouse=True)
def _register_echo_tools():
    """为每个测试独立注册桩工具，退出时清理注册表防污染其它用例。"""
    snapshot = dict(_TOOL_REGISTRY)
    # 以不同名字注册多个 echo 实例，模拟不同 Stage 的工具
    for label in ("a", "b", "c", "d"):
        name = f"echo_{label}"

        def _factory(lbl: str = label):
            class _Bound(_EchoTool):
                def __init__(self) -> None:
                    super().__init__(label=lbl)

            return _Bound

        register_tool(name)(_factory())
    yield
    _TOOL_REGISTRY.clear()
    _TOOL_REGISTRY.update(snapshot)


def _stage(
    name: str,
    tool: str,
    *,
    input_from: str | None = None,
    input_builder: str | None = None,
) -> Dict[str, Any]:
    """构造最小合法的 Stage 配置。"""
    cfg: Dict[str, Any] = {
        "name": name,
        "tools": [{"name": tool, "rank": 1, "enabled": True}],
        "competition_mode": False,
    }
    if input_from is not None:
        cfg["input_from"] = input_from
    if input_builder is not None:
        cfg["input_builder"] = input_builder
    return cfg


# ---------------------------------------------------------------------------
# 测试 1：向后兼容 — 未声明 input_from/input_builder 时沿用链式语义
# ---------------------------------------------------------------------------


def test_chain_semantics_when_no_routing_declared():
    """未声明路由时，下一 Stage 的输入 = 上一 Stage 的 output（向后兼容）。"""
    stages = [
        _stage("s0", "echo_a"),
        _stage("s1", "echo_b"),
    ]
    orch = PipelineOrchestrator(stages_config=stages)
    results = asyncio.run(orch.run(initial_input="INIT"))

    assert results["s0"].success
    assert results["s0"].output == {"label": "a", "received": "INIT"}
    # s1 没有 input_from，应拿到 s0 的 output（链式）
    assert results["s1"].success
    assert results["s1"].output["received"] == {"label": "a", "received": "INIT"}


# ---------------------------------------------------------------------------
# 测试 2：input_from 指向已执行的前序 Stage，取其 output
# ---------------------------------------------------------------------------


def test_input_from_picks_specified_prev_stage():
    """input_from 跳过紧邻前驱，显式指向更早的 Stage。"""
    stages = [
        _stage("s0", "echo_a"),
        _stage("s1", "echo_b"),
        # s2 显式从 s0 取输入，而不是链式接 s1
        _stage("s2", "echo_c", input_from="s0"),
    ]
    orch = PipelineOrchestrator(stages_config=stages)
    results = asyncio.run(orch.run(initial_input="INIT"))

    assert results["s2"].success
    # s2.received 应该是 s0.output，而不是 s1.output
    assert results["s2"].output["received"] == results["s0"].output


# ---------------------------------------------------------------------------
# 测试 3：input_from 指向不存在的 Stage → 结构化错误，不抛 AttributeError
# ---------------------------------------------------------------------------


def test_input_from_missing_returns_structured_error():
    stages = [
        _stage("s0", "echo_a"),
        _stage("s1", "echo_b", input_from="does_not_exist"),
    ]
    orch = PipelineOrchestrator(stages_config=stages)
    results = asyncio.run(orch.run(initial_input="INIT"))

    assert results["s0"].success
    assert "s1" in results
    assert results["s1"].success is False
    assert "does_not_exist" in (results["s1"].error or "")


# ---------------------------------------------------------------------------
# 测试 4：input_builder 调用注册构造器，聚合多个前序 Stage 输出
# ---------------------------------------------------------------------------


def test_input_builder_aggregates_previous_results():
    captured: Dict[str, Any] = {}

    def _composite_builder(
        results: Dict[str, StageResult], initial_input: Any
    ) -> Dict[str, Any]:
        captured["keys"] = sorted(results.keys())
        captured["initial"] = initial_input
        return {
            "from_s0": results["s0"].output,
            "from_s1": results["s1"].output,
            "initial": initial_input,
        }

    stages = [
        _stage("s0", "echo_a"),
        _stage("s1", "echo_b"),
        _stage("s2", "echo_c", input_builder="composite"),
    ]
    orch = PipelineOrchestrator(
        stages_config=stages,
        input_builders={"composite": _composite_builder},
    )
    results = asyncio.run(orch.run(initial_input="INIT"))

    assert results["s2"].success
    received = results["s2"].output["received"]
    assert received["from_s0"] == results["s0"].output
    assert received["from_s1"] == results["s1"].output
    assert received["initial"] == "INIT"
    assert captured["keys"] == ["s0", "s1"]
    assert captured["initial"] == "INIT"


# ---------------------------------------------------------------------------
# 测试 5：未注册的 input_builder → 结构化错误
# ---------------------------------------------------------------------------


def test_input_builder_not_registered_returns_structured_error():
    stages = [
        _stage("s0", "echo_a"),
        _stage("s1", "echo_b", input_builder="never_registered"),
    ]
    orch = PipelineOrchestrator(stages_config=stages, input_builders={})
    results = asyncio.run(orch.run(initial_input="INIT"))

    assert results["s1"].success is False
    assert "never_registered" in (results["s1"].error or "")


# ---------------------------------------------------------------------------
# 测试 6：并行组内多个 Stage 各自 resolve，input_from 互不干扰
# ---------------------------------------------------------------------------


def test_parallel_group_resolves_inputs_independently():
    """并行组：3 个 Stage 分别声明 input_from，各取各的前序 output。"""
    stages = [
        _stage("s0", "echo_a"),
        _stage("s1", "echo_b"),
        # p1/p2/p3 均并行且都 input_from=s0，但不共用同一 current_input
        _stage("p1", "echo_c", input_from="s0"),
        _stage("p2", "echo_c", input_from="s1"),
        _stage("p3", "echo_c", input_from="s0"),
    ]
    orch = PipelineOrchestrator(stages_config=stages)
    results = asyncio.run(
        orch.run(initial_input="INIT", parallel_stages=["p1", "p2", "p3"])
    )

    assert all(results[n].success for n in ("p1", "p2", "p3"))
    assert results["p1"].output["received"] == results["s0"].output
    assert results["p2"].output["received"] == results["s1"].output
    assert results["p3"].output["received"] == results["s0"].output


def test_parallel_group_isolated_input_errors():
    """并行组内单 Stage 输入解析失败不影响其它 Stage。"""
    stages = [
        _stage("s0", "echo_a"),
        _stage("p1", "echo_b", input_from="s0"),
        _stage("p2", "echo_c", input_from="missing_stage"),
        _stage("p3", "echo_d", input_from="s0"),
    ]
    orch = PipelineOrchestrator(stages_config=stages)
    results = asyncio.run(
        orch.run(initial_input="INIT", parallel_stages=["p1", "p2", "p3"])
    )

    assert results["p1"].success
    assert results["p3"].success
    assert results["p2"].success is False
    assert "missing_stage" in (results["p2"].error or "")


# ---------------------------------------------------------------------------
# 测试 7：_resolve_input 静态行为（输入解析优先级与错误语义）
# ---------------------------------------------------------------------------


class TestResolveInputBehavior:
    """直接测试 `_resolve_input` 的优先级语义，免 schedule 层噪声。"""

    def _make(self, builders: Dict[str, Any] | None = None) -> PipelineOrchestrator:
        return PipelineOrchestrator(stages_config=[], input_builders=builders)

    def test_builder_takes_precedence_over_input_from(self):
        orch = self._make({"b": lambda results, init: {"built": True}})
        cfg = {"name": "s", "input_from": "anything", "input_builder": "b"}
        resolved, err = orch._resolve_input(cfg, {}, "init", "chain")
        assert err is None
        assert resolved == {"built": True}

    def test_input_from_takes_precedence_over_chain(self):
        orch = self._make()
        cfg = {"name": "s", "input_from": "prev"}
        prev_result: StageResult = StageResult(success=True, output="PREV_OUTPUT")
        resolved, err = orch._resolve_input(cfg, {"prev": prev_result}, "init", "chain")
        assert err is None
        assert resolved == "PREV_OUTPUT"

    def test_missing_input_from_returns_error(self):
        orch = self._make()
        cfg = {"name": "s", "input_from": "missing"}
        resolved, err = orch._resolve_input(cfg, {}, "init", "chain")
        assert resolved is None
        assert err is not None and "missing" in err

    def test_failed_input_from_returns_error(self):
        orch = self._make()
        cfg = {"name": "s", "input_from": "bad"}
        failed = StageResult(success=False, error="boom")
        resolved, err = orch._resolve_input(cfg, {"bad": failed}, "init", "chain")
        assert resolved is None
        assert err is not None and "bad" in err

    def test_no_routing_falls_back_to_chain(self):
        orch = self._make()
        cfg = {"name": "s"}
        resolved, err = orch._resolve_input(cfg, {}, "init", "CHAIN")
        assert err is None
        assert resolved == "CHAIN"

    def test_builder_raises_returns_structured_error(self):
        def _boom(results: Dict[str, StageResult], init: Any) -> Any:
            raise RuntimeError("kaboom")

        orch = self._make({"b": _boom})
        cfg = {"name": "s", "input_builder": "b"}
        resolved, err = orch._resolve_input(cfg, {}, "init", "chain")
        assert resolved is None
        assert err is not None and "kaboom" in err
