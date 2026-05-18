"""``PipelineOrchestrator`` × ``EngineSelector`` 集成测试。

聚焦三类场景：
1. ``IdentitySelector`` 不影响既有路由行为；
2. ``ProfileAwareSelector`` 在 ``has_tables=False`` 时短路 ``table_extraction``，
   不调用 scheduler，返回成功的空输出；
3. ``selector_decision`` 写入 ``StageResult.metadata`` 用于审计。
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict

import pytest

from negentropy.perceives.pipeline.base import StageResult
from negentropy.perceives.pipeline.engine_selector import (
    IdentitySelector,
    ProfileAwareSelector,
)
from negentropy.perceives.pipeline.models import (
    DocumentCharacteristics,
    PreprocessingOutput,
    TableExtractionOutput,
)
from negentropy.perceives.pipeline.orchestrator import PipelineOrchestrator
from negentropy.perceives.pipeline.registry import (
    _TOOL_REGISTRY,  # type: ignore[attr-defined]
    register_tool,
)


class _RecordingTool:
    """记录调用次数的桩工具，便于断言短路是否生效。"""

    name = "recorder"
    invoked: int = 0

    def is_available(self) -> bool:
        return True

    async def execute(self, input_data: Any) -> StageResult:
        type(self).invoked += 1
        return StageResult(
            success=True,
            output=TableExtractionOutput(tables=[], total_count=0),
            engine_used="recorder",
        )


@pytest.fixture(autouse=True)
def _register_recorder():
    snapshot = dict(_TOOL_REGISTRY)
    _RecordingTool.invoked = 0
    register_tool("recorder")(_RecordingTool)
    yield
    _TOOL_REGISTRY.clear()
    _TOOL_REGISTRY.update(snapshot)


def _make_quick_scan_result(**chars_kwargs: Any) -> StageResult:
    """构造一个 ``quick_scan`` 成功结果，输出 DocumentCharacteristics。"""
    return StageResult(
        success=True,
        output=DocumentCharacteristics(**chars_kwargs),
        engine_used="pymupdf",
    )


def _make_stage_config() -> Dict[str, Any]:
    """构造 table_extraction 最小合法 stage 配置。"""
    return {
        "name": "table_extraction",
        "tools": [{"name": "recorder", "rank": 1, "enabled": True}],
        "competition_mode": False,
    }


# ============================================================
# 1. IdentitySelector 不影响调度（基线行为）
# ============================================================
def test_identity_selector_invokes_tool() -> None:
    orch = PipelineOrchestrator(
        stages_config=[_make_stage_config()],
        selector=IdentitySelector(),
    )
    results = asyncio.run(orch.run(initial_input="data"))
    assert results["table_extraction"].success
    assert _RecordingTool.invoked == 1


# ============================================================
# 2. ProfileAwareSelector 短路：has_tables=False 时不调用 scheduler
# ============================================================
def test_profile_aware_skips_when_no_tables() -> None:
    orch = PipelineOrchestrator(
        stages_config=[_make_stage_config()],
        selector=ProfileAwareSelector(),
    )
    # 直接将 quick_scan 结果塞进 orchestrator 的执行链：通过加一个 quick_scan
    # 桩 stage 模拟，比 mock 简单。

    # 通过 run() 传入 initial_input 不够，需要 selector 拿到 characteristics。
    # 采用 results-injection 方式：直接调用 _execute_stage 即可绕过 run()。
    results: Dict[str, StageResult] = {
        "quick_scan": _make_quick_scan_result(has_tables=False, has_formulas=True)
    }
    stage_cfg = _make_stage_config()
    result = asyncio.run(orch._execute_stage(stage_cfg, "data", results))
    assert result.success is True
    assert _RecordingTool.invoked == 0  # tool 未被调用
    assert result.engine_used.startswith("skipped:")
    assert "no_has_tables" in result.engine_used
    assert isinstance(result.output, TableExtractionOutput)
    assert result.output.metadata.get("skipped") is True
    assert result.metadata.get("selector_skipped") is True


# ============================================================
# 3. ProfileAwareSelector 不短路时透传 selector_decision 到 metadata
# ============================================================
def test_profile_aware_writes_decision_metadata() -> None:
    orch = PipelineOrchestrator(
        stages_config=[_make_stage_config()],
        selector=ProfileAwareSelector(),
    )
    results: Dict[str, StageResult] = {
        "quick_scan": _make_quick_scan_result(has_tables=True)
    }
    stage_cfg = _make_stage_config()
    result = asyncio.run(orch._execute_stage(stage_cfg, "data", results))
    assert result.success is True
    assert _RecordingTool.invoked == 1
    assert "selector_decision" in result.metadata


# ============================================================
# 4. 缺失 quick_scan 时回退默认（不短路）
# ============================================================
def test_missing_quick_scan_falls_back_to_default() -> None:
    orch = PipelineOrchestrator(
        stages_config=[_make_stage_config()],
        selector=ProfileAwareSelector(),
    )
    # results 为空 → SelectionContext.characteristics = None
    result = asyncio.run(orch._execute_stage(_make_stage_config(), "data", {}))
    assert result.success is True
    assert _RecordingTool.invoked == 1
    assert "missing_characteristics" in result.metadata.get("selector_decision", "")


# ============================================================
# 5. characteristics 可从 preprocessing 输出中提取（不依赖 quick_scan）
# ============================================================
def test_characteristics_picked_from_preprocessing_when_quick_scan_absent(
    tmp_path,
) -> None:
    orch = PipelineOrchestrator(
        stages_config=[_make_stage_config()],
        selector=ProfileAwareSelector(),
    )
    pdf_path = tmp_path / "dummy.pdf"
    pdf_path.write_bytes(b"%PDF-1.4")
    pre_out = PreprocessingOutput(
        local_path=pdf_path,
        page_count=10,
        characteristics=DocumentCharacteristics(page_count=10, has_tables=False),
    )
    pre_result = StageResult(success=True, output=pre_out, engine_used="pymupdf")
    results: Dict[str, StageResult] = {"preprocessing": pre_result}
    result = asyncio.run(orch._execute_stage(_make_stage_config(), pre_out, results))
    assert result.success is True
    # has_tables=False → 应被 selector 短路
    assert _RecordingTool.invoked == 0
    assert "no_has_tables" in result.engine_used
