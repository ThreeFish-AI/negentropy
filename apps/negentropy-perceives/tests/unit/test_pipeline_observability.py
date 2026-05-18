"""Pipeline 观测层与 Bug 修复回归测试 (PR #164)。

覆盖项目:
    - A1: ``_get_engine_gates()`` 补全 ``opendataloader``
    - A2: ``_serialize_stage_result()`` 透出 ``elapsed_ms`` / ``selector_decision``
    - A4: ``DoclingCodeDetector`` 在 mlx_vlm 不可用时主动失败
    - A5: ``MarkerTextExtractor`` 已注册且 ``_TOOLS`` 字典包含 marker
"""

from __future__ import annotations

from unittest.mock import patch

import pytest


# ============================================================
# A1: engine_gates 补全
# ============================================================
class TestEngineGatesCoverage:
    def test_gates_include_opendataloader(self) -> None:
        from negentropy.perceives.pipeline.convenience import _get_engine_gates

        gates = _get_engine_gates()
        assert "opendataloader" in gates, (
            "PR #164 起 _get_engine_gates 必须覆盖 opendataloader, "
            "否则 settings.opendataloader_enabled=False 不会被尊重"
        )
        # docling/mineru/marker 仍需在(回归保护)
        for required in ("docling", "mineru", "marker"):
            assert required in gates

    def test_gates_respect_opendataloader_disabled(self) -> None:
        from negentropy.perceives.pipeline.convenience import _get_engine_gates

        with patch(
            "negentropy.perceives.pipeline.convenience.settings"
        ) as mock_settings:
            mock_settings.docling_enabled = True
            mock_settings.mineru_enabled = True
            mock_settings.marker_enabled = True
            mock_settings.opendataloader_enabled = False
            gates = _get_engine_gates()
            assert gates["opendataloader"] is False
            assert gates["docling"] is True

    def test_gates_omit_pymupdf_and_pypdf(self) -> None:
        """pymupdf / pypdf 视为强制兜底引擎, 不暴露 gate 以防被用户误关。"""
        from negentropy.perceives.pipeline.convenience import _get_engine_gates

        gates = _get_engine_gates()
        assert "pymupdf" not in gates
        assert "pypdf" not in gates


# ============================================================
# A2: PipelineResult.stage_results 序列化
# ============================================================
class TestStageResultSerialization:
    def test_serialize_exposes_elapsed_ms_and_decision(self) -> None:
        from negentropy.perceives.pipeline.base import StageResult
        from negentropy.perceives.pipeline.convenience import _serialize_stage_result

        r = StageResult(
            success=True,
            engine_used="docling",
            elapsed_ms=1234.567,
            metadata={
                "selector_decision": "profile:complex_non_scanned",
                "selector_skipped": False,
            },
        )
        d = _serialize_stage_result(r)
        assert d["success"] is True
        assert d["engine"] == "docling"
        assert d["elapsed_ms"] == 1234.57  # round to 2 decimals
        assert d["selector_decision"] == "profile:complex_non_scanned"
        assert d["selector_skipped"] is False
        assert d["error"] is None

    def test_serialize_handles_skipped_stage(self) -> None:
        """selector_skipped=True 的 stage 仍应正确序列化。"""
        from negentropy.perceives.pipeline.base import StageResult
        from negentropy.perceives.pipeline.convenience import _serialize_stage_result

        r = StageResult(
            success=True,
            engine_used="skipped:profile:no_has_tables",
            elapsed_ms=0.0,
            metadata={
                "selector_decision": "profile:no_has_tables",
                "selector_skipped": True,
            },
        )
        d = _serialize_stage_result(r)
        assert d["selector_skipped"] is True
        assert d["elapsed_ms"] == 0.0
        assert d["engine"].startswith("skipped:")

    def test_serialize_tolerates_missing_metadata(self) -> None:
        """metadata=None / 缺失字段不应抛异常。"""
        from negentropy.perceives.pipeline.base import StageResult
        from negentropy.perceives.pipeline.convenience import _serialize_stage_result

        r = StageResult(success=False, error="boom")
        d = _serialize_stage_result(r)
        assert d["success"] is False
        assert d["error"] == "boom"
        assert d["elapsed_ms"] == 0.0
        assert d["selector_decision"] is None
        assert d["selector_skipped"] is False


# ============================================================
# A4: DoclingCodeDetector mlx_vlm 不可用降级
# ============================================================
class TestDoclingCodeDetectorMlxFallback:
    def test_disabled_when_mps_and_no_mlx_vlm(self) -> None:
        """Mock 必须用 ``DeviceType`` 枚举忠实模拟 ``detect_device`` 的真实返回类型,
        避免裸字符串 fixture 掩盖 ``str``-mixin Enum 的 ``__str__`` 陷阱
        (Python 3.13 上 ``str(DeviceType.MPS)`` 仍是 ``'DeviceType.MPS'`` 而非
        ``'mps'``, 一旦源码改回 ``str(detect_device())`` 这一类形态本测试就该挂)。
        """
        from negentropy.perceives.pdf.hardware.detection import DeviceType
        from negentropy.perceives.pipeline.stages.pdf.code_detection import (
            _docling_code_enrichment_disabled,
        )

        with (
            patch(
                "negentropy.perceives.pipeline.stages.pdf.code_detection.find_spec"
            ) as mock_find,
            patch(
                "negentropy.perceives.pdf.hardware.detection.detect_device",
                return_value=DeviceType.MPS,
            ),
        ):
            mock_find.return_value = None  # mlx_vlm 不可用
            assert _docling_code_enrichment_disabled() is True

    def test_enabled_when_mps_with_mlx_vlm(self) -> None:
        from negentropy.perceives.pdf.hardware.detection import DeviceType
        from negentropy.perceives.pipeline.stages.pdf.code_detection import (
            _docling_code_enrichment_disabled,
        )

        with (
            patch(
                "negentropy.perceives.pipeline.stages.pdf.code_detection.find_spec"
            ) as mock_find,
            patch(
                "negentropy.perceives.pdf.hardware.detection.detect_device",
                return_value=DeviceType.MPS,
            ),
        ):
            mock_find.return_value = object()  # mlx_vlm 可用
            assert _docling_code_enrichment_disabled() is False

    def test_enabled_when_cpu_regardless_of_mlx_vlm(self) -> None:
        """非 mps 设备走 default preset, 不依赖 mlx_vlm。"""
        from negentropy.perceives.pdf.hardware.detection import DeviceType
        from negentropy.perceives.pipeline.stages.pdf.code_detection import (
            _docling_code_enrichment_disabled,
        )

        with (
            patch(
                "negentropy.perceives.pipeline.stages.pdf.code_detection.find_spec",
                return_value=None,
            ),
            patch(
                "negentropy.perceives.pdf.hardware.detection.detect_device",
                return_value=DeviceType.CPU,
            ),
        ):
            assert _docling_code_enrichment_disabled() is False

    @pytest.mark.asyncio
    async def test_run_returns_failure_when_disabled(self) -> None:
        """early-return 路径: 当 enrichment 被静默禁用时, _run 返回 success=False。

        这是 scheduler 降级到 ``algorithm_detector`` 的触发条件。
        """
        from pathlib import Path

        from negentropy.perceives.pipeline.models import (
            DocumentCharacteristics,
            PreprocessingOutput,
        )
        from negentropy.perceives.pipeline.stages.pdf.code_detection import (
            DoclingCodeDetector,
        )

        with patch(
            "negentropy.perceives.pipeline.stages.pdf.code_detection."
            "_docling_code_enrichment_disabled",
            return_value=True,
        ):
            detector = DoclingCodeDetector()
            input_data = PreprocessingOutput(
                local_path=Path("/tmp/fake.pdf"),
                page_count=1,
                characteristics=DocumentCharacteristics(),
            )
            result = await detector._run(input_data)
            assert result.success is False
            assert (
                "降级" in (result.error or "")
                or "disabled" in (result.error or "").lower()
            )


# ============================================================
# A5: MarkerTextExtractor 注册
# ============================================================
class TestMarkerTextExtractorRegistered:
    def test_marker_in_text_extraction_tools(self) -> None:
        from negentropy.perceives.pipeline.stages.pdf.text_extraction import (
            MarkerTextExtractor,
            _TOOLS,
        )

        assert "marker" in _TOOLS, (
            "PR #164 起 text_extraction._TOOLS 必须含 marker 适配器, "
            "否则 ProfileAwareSelector._select_text_extraction 扫描版偏好的 "
            "'marker' rank=1 是死引用"
        )
        assert _TOOLS["marker"] is MarkerTextExtractor

    def test_marker_text_extractor_tool_name(self) -> None:
        from negentropy.perceives.pipeline.stages.pdf.text_extraction import (
            MarkerTextExtractor,
        )

        extractor = MarkerTextExtractor()
        assert extractor.tool_name == "marker"

    def test_marker_registered_in_tool_registry(self) -> None:
        """``@register_tool("text_extraction.marker")`` 应在 registry 中创建项。"""
        from negentropy.perceives.pipeline.registry import get_tool

        # registry.get_tool 直接返回工具实例
        instance = get_tool("text_extraction.marker")
        assert instance is not None
        assert instance.tool_name == "marker"


# ============================================================
# Phase C: ProfileAwareSelector 新子规则与 complex_layout 兜底
# ============================================================
class TestProfileAwareSelectorPhaseC:
    def test_complex_layout_overrides_no_tables_skip(self) -> None:
        """quick_scan 启发式误判 has_tables=False 但 complex_layout=True
        时, table_extraction 应回退到 YAML 顺序而非短路跳过。"""
        from negentropy.perceives.pipeline.engine_selector import (
            ProfileAwareSelector,
            SelectionContext,
        )
        from negentropy.perceives.pipeline.models import DocumentCharacteristics

        s = ProfileAwareSelector()
        chars = DocumentCharacteristics(
            has_tables=False,
            has_complex_layout=True,
        )
        d = s.select(
            "table_extraction",
            [{"name": "docling"}, {"name": "pymupdf"}],
            SelectionContext(characteristics=chars),
        )
        assert d.skip is False, (
            "complex_layout=True 应阻止误判驱动的短路跳过, 保护 word_count 完整性"
        )
        assert "complex_layout" in d.reason

    def test_complex_layout_overrides_no_code_skip(self) -> None:
        from negentropy.perceives.pipeline.engine_selector import (
            ProfileAwareSelector,
            SelectionContext,
        )
        from negentropy.perceives.pipeline.models import DocumentCharacteristics

        s = ProfileAwareSelector()
        chars = DocumentCharacteristics(
            has_code_blocks=False,
            has_complex_layout=True,
        )
        d = s.select(
            "code_detection",
            [{"name": "docling"}, {"name": "algorithm_detector"}],
            SelectionContext(characteristics=chars),
        )
        assert d.skip is False
        assert "complex_layout" in d.reason

    def test_no_formulas_still_skips_even_complex(self) -> None:
        """formula_extraction 不在 complex_layout 兜底白名单, 应正常跳过。"""
        from negentropy.perceives.pipeline.engine_selector import (
            ProfileAwareSelector,
            SelectionContext,
        )
        from negentropy.perceives.pipeline.models import DocumentCharacteristics

        s = ProfileAwareSelector()
        chars = DocumentCharacteristics(
            has_formulas=False,
            has_complex_layout=True,
        )
        d = s.select(
            "formula_extraction",
            [{"name": "docling"}, {"name": "mineru"}],
            SelectionContext(characteristics=chars),
        )
        assert d.skip is True
        assert "no_has_formulas" in d.reason

    def test_formula_extraction_prefers_mineru_on_mps(self) -> None:
        """mps + has_formulas 时, mineru 应被重排到 rank=1
        (vlm-auto-engine 命中 mlx-engine)。"""
        from negentropy.perceives.pipeline.engine_selector import (
            ProfileAwareSelector,
            SelectionContext,
        )
        from negentropy.perceives.pipeline.models import DocumentCharacteristics

        s = ProfileAwareSelector()
        chars = DocumentCharacteristics(has_formulas=True)
        tools = [
            {"name": "docling", "rank": 1},
            {"name": "mineru", "rank": 2},
            {"name": "marker", "rank": 3},
        ]
        d = s.select(
            "formula_extraction",
            tools,
            SelectionContext(characteristics=chars, device="mps"),
        )
        assert d.skip is False
        assert d.tools[0]["name"] == "mineru"
        assert d.reason == "profile:formula_mps_mineru"

    def test_formula_extraction_default_on_cpu(self) -> None:
        from negentropy.perceives.pipeline.engine_selector import (
            ProfileAwareSelector,
            SelectionContext,
        )
        from negentropy.perceives.pipeline.models import DocumentCharacteristics

        s = ProfileAwareSelector()
        chars = DocumentCharacteristics(has_formulas=True)
        tools = [
            {"name": "docling", "rank": 1},
            {"name": "mineru", "rank": 2},
        ]
        d = s.select(
            "formula_extraction",
            tools,
            SelectionContext(characteristics=chars, device="cpu"),
        )
        assert d.skip is False
        # cpu 走 YAML 默认: docling rank=1
        assert d.tools[0]["name"] == "docling"
        assert d.reason == "profile:formula_default"

    def test_code_detection_skips_docling_when_mps_no_mlx_vlm(self) -> None:
        """mps + 无 mlx_vlm 时, code_detection 候选剔除 docling。"""
        from unittest.mock import patch

        from negentropy.perceives.pipeline.engine_selector import (
            ProfileAwareSelector,
            SelectionContext,
        )
        from negentropy.perceives.pipeline.models import DocumentCharacteristics

        s = ProfileAwareSelector()
        chars = DocumentCharacteristics(has_code_blocks=True)
        tools = [
            {"name": "docling", "rank": 1},
            {"name": "algorithm_detector", "rank": 2},
            {"name": "marker", "rank": 3},
        ]

        with patch("importlib.util.find_spec", return_value=None):
            d = s.select(
                "code_detection",
                tools,
                SelectionContext(characteristics=chars, device="mps"),
            )
            assert d.skip is False
            assert all(t["name"] != "docling" for t in d.tools)
            assert "no_mlx_vlm" in d.reason

    def test_table_extraction_emits_reason_for_complex_layout(self) -> None:
        from negentropy.perceives.pipeline.engine_selector import (
            ProfileAwareSelector,
            SelectionContext,
        )
        from negentropy.perceives.pipeline.models import DocumentCharacteristics

        s = ProfileAwareSelector()
        chars = DocumentCharacteristics(has_tables=True, has_complex_layout=True)
        tools = [{"name": "docling", "rank": 1}, {"name": "camelot", "rank": 3}]
        d = s.select(
            "table_extraction",
            tools,
            SelectionContext(characteristics=chars),
        )
        assert d.skip is False
        assert d.reason == "profile:table_complex_docling"
        # 不重排, 保持 YAML 顺序
        assert d.tools[0]["name"] == "docling"
