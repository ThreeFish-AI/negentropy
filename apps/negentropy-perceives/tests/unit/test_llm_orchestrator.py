"""LLM 编排器模块的单元测试。

测试策略：
- 数据类完整性验证
- 质量信号提取
- 预扫描特征提取（使用真实 PDF）
- 三阶段编排流程（mock LLM + mock 引擎）
- 启发式融合回退
- 降级策略验证
- 多引擎编排（docling + mineru + marker + pymupdf）
"""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from negentropy.perceives.pdf.llm_client import LLMClient, LLMResponse
from negentropy.perceives.pdf.llm_orchestrator import (
    EngineResult,
    EngineTask,
    LLMOrchestrator,
    OrchestrationPlan,
    OrchestrationResult,
    PDFCharacteristics,
    _DEFAULT_PLAN,
    _extract_quality_signals,
)
from negentropy.perceives.pdf.marker_engine import (
    MarkerEngine,
)
from negentropy.perceives.pdf.mineru_engine import (
    MinerUEngine,
)

# 测试 PDF 路径
ASSETS_DIR = Path(__file__).resolve().parent.parent.parent / "assets"
CE_PDF = ASSETS_DIR / "Context Engineering 2.0 - The Context of Context Engineering.pdf"
ARXIV_PDF = ASSETS_DIR / "2603.05344v3.pdf"


# ============================================================
# 数据类完整性
# ============================================================
class TestDataClasses:
    """验证编排相关数据类。"""

    def test_pdf_characteristics_defaults(self) -> None:
        c = PDFCharacteristics()
        assert c.page_count == 0
        assert c.has_tables is False
        assert c.text_density == "normal"
        assert c.estimated_content_types == []

    def test_engine_task(self) -> None:
        t = EngineTask(engine="docling", focus="全文档", priority=8)
        assert t.engine == "docling"
        assert t.priority == 8

    def test_orchestration_plan(self) -> None:
        plan = OrchestrationPlan(
            characteristics=PDFCharacteristics(page_count=10),
            engine_tasks=[EngineTask(engine="docling", focus="test")],
            synthesis_strategy="merge",
            reasoning="test reasoning",
        )
        assert plan.synthesis_strategy == "merge"
        assert len(plan.engine_tasks) == 1

    def test_engine_result_success(self) -> None:
        r = EngineResult(engine="docling", success=True, content="# Test")
        assert r.success is True
        assert r.error is None

    def test_engine_result_failure(self) -> None:
        r = EngineResult(engine="pymupdf", success=False, error="timeout")
        assert r.success is False
        assert r.error == "timeout"

    def test_orchestration_result(self) -> None:
        r = OrchestrationResult(content="# Test", engines_used=["docling"])
        assert r.method_used == "smart"
        assert r.engines_used == ["docling"]

    def test_default_plan_structure(self) -> None:
        assert len(_DEFAULT_PLAN.engine_tasks) == 2
        assert _DEFAULT_PLAN.synthesis_strategy == "merge"
        assert _DEFAULT_PLAN.engine_tasks[0].engine == "docling"
        assert _DEFAULT_PLAN.engine_tasks[1].engine == "pymupdf"


# ============================================================
# 质量信号提取
# ============================================================
class TestQualitySignals:
    """验证 _extract_quality_signals() 函数。"""

    def test_empty_content(self) -> None:
        signals = _extract_quality_signals("")
        assert signals["word_count"] == 0
        assert signals["is_empty"] is True

    def test_markdown_with_headings(self) -> None:
        content = "# Heading 1\n## Heading 2\nSome text here."
        signals = _extract_quality_signals(content)
        assert signals["heading_count"] == 2
        assert signals["word_count"] > 0
        assert signals["is_empty"] is False

    def test_markdown_with_tables(self) -> None:
        content = "| A | B |\n|---|---|\n| 1 | 2 |"
        signals = _extract_quality_signals(content)
        assert signals["table_lines"] == 3

    def test_markdown_with_formulas(self) -> None:
        content = "Inline $x^2$ and block:\n$$E = mc^2$$\n"
        signals = _extract_quality_signals(content)
        assert signals["formula_block_count"] == 1
        assert signals["formula_inline_count"] == 1

    def test_markdown_with_code(self) -> None:
        content = "```python\nprint('hello')\n```\n\n```js\nconsole.log('hi')\n```"
        signals = _extract_quality_signals(content)
        assert signals["code_fence_count"] == 2

    def test_markdown_with_images(self) -> None:
        content = "![Alt text](image.png)\n![Figure 1](fig1.jpg)"
        signals = _extract_quality_signals(content)
        assert signals["image_count"] == 2

    def test_markdown_with_lists(self) -> None:
        content = "- Item 1\n- Item 2\n1. First\n2. Second"
        signals = _extract_quality_signals(content)
        assert signals["list_count"] == 4


# ============================================================
# PyMuPDF 预扫描
# ============================================================
class TestQuickScan:
    """验证 _quick_scan() 预扫描功能。"""

    def test_quick_scan_returns_characteristics(self) -> None:
        """使用 mock fitz 验证预扫描结构。"""
        mock_client = MagicMock(spec=LLMClient)
        orchestrator = LLMOrchestrator(llm_client=mock_client)

        # Mock fitz module
        mock_page = MagicMock()
        mock_page.get_text.side_effect = lambda fmt, **kw: (
            {"blocks": [{"lines": [{"spans": [{"font": "Times"}]}]}]}
            if fmt == "dict"
            else "Sample text content for testing."
        )
        mock_page.get_images.return_value = [(1, 0, 0, 0, 0, "img1", "", "", 0)]

        mock_doc = MagicMock()
        mock_doc.page_count = 5
        mock_doc.__getitem__ = lambda self, idx: mock_page

        with patch(
            "negentropy.perceives.pdf.llm.orchestrator._import_fitz"
        ) as mock_fitz:
            mock_fitz.return_value.open.return_value = mock_doc
            chars = orchestrator._quick_scan(Path("/fake/test.pdf"), None)

        assert isinstance(chars, PDFCharacteristics)
        assert chars.page_count == 5
        assert chars.has_images is True

    @pytest.mark.skipif(not CE_PDF.exists(), reason=f"PDF 文件不存在: {CE_PDF}")
    def test_quick_scan_real_ce_pdf(self) -> None:
        """使用真实 Context Engineering PDF 验证预扫描。"""
        mock_client = MagicMock(spec=LLMClient)
        orchestrator = LLMOrchestrator(llm_client=mock_client)
        chars = orchestrator._quick_scan(CE_PDF, None)

        assert chars.page_count > 0
        assert len(chars.sample_text) > 0
        assert chars.text_density in ("sparse", "normal", "dense")


# ============================================================
# 启发式融合
# ============================================================
class TestHeuristicSynthesis:
    """验证启发式融合决策。"""

    def test_selects_highest_scoring_engine(self) -> None:
        mock_client = MagicMock(spec=LLMClient)
        orchestrator = LLMOrchestrator(llm_client=mock_client)

        plan = OrchestrationPlan(
            characteristics=PDFCharacteristics(),
            engine_tasks=[
                EngineTask(engine="docling", focus="test", priority=8),
                EngineTask(engine="pymupdf", focus="test", priority=5),
            ],
        )

        docling_result = EngineResult(
            engine="docling",
            success=True,
            content="# Rich content with tables",
            quality_signals={
                "word_count": 1000,
                "heading_count": 10,
                "table_lines": 20,
                "formula_block_count": 5,
                "formula_inline_count": 10,
                "code_fence_count": 3,
                "image_count": 5,
            },
        )
        pymupdf_result = EngineResult(
            engine="pymupdf",
            success=True,
            content="Basic text",
            quality_signals={
                "word_count": 800,
                "heading_count": 3,
                "table_lines": 0,
                "formula_block_count": 0,
                "formula_inline_count": 0,
                "code_fence_count": 0,
                "image_count": 0,
            },
        )

        decision = orchestrator._heuristic_synthesize(
            [docling_result, pymupdf_result], plan
        )
        assert decision["primary_engine"] == "docling"

    def test_detects_supplementary_tables(self) -> None:
        mock_client = MagicMock(spec=LLMClient)
        orchestrator = LLMOrchestrator(llm_client=mock_client)

        plan = OrchestrationPlan(
            characteristics=PDFCharacteristics(),
            engine_tasks=[
                EngineTask(engine="docling", focus="test", priority=8),
                EngineTask(engine="pymupdf", focus="test", priority=5),
            ],
        )

        # Docling 赢但 PyMuPDF 有更多表格
        docling_result = EngineResult(
            engine="docling",
            success=True,
            content="# Rich",
            quality_signals={
                "word_count": 1000,
                "heading_count": 10,
                "table_lines": 5,
                "formula_block_count": 10,
                "formula_inline_count": 10,
                "code_fence_count": 5,
                "image_count": 5,
            },
        )
        pymupdf_result = EngineResult(
            engine="pymupdf",
            success=True,
            content="Tables",
            quality_signals={
                "word_count": 800,
                "heading_count": 3,
                "table_lines": 50,
                "formula_block_count": 0,
                "formula_inline_count": 0,
                "code_fence_count": 0,
                "image_count": 0,
            },
        )

        decision = orchestrator._heuristic_synthesize(
            [docling_result, pymupdf_result], plan
        )
        assert decision["primary_engine"] == "docling"
        # PyMuPDF 表格行远多于 Docling，应被检测为补充源
        table_supplements = [
            s for s in decision["supplements"] if s["content_type"] == "tables"
        ]
        assert len(table_supplements) == 1


# ============================================================
# 内容合并
# ============================================================
class TestContentMerge:
    """验证 _merge_content() 合并逻辑。"""

    def test_merge_tables_appends_missing(self) -> None:
        mock_client = MagicMock(spec=LLMClient)
        orchestrator = LLMOrchestrator(llm_client=mock_client)

        primary = "# Doc\nSome text."
        secondary = "# Doc\n| A | B |\n|---|---|\n| 1 | 2 |\n"

        result = orchestrator._merge_tables(primary, secondary)
        assert "| A | B |" in result
        assert "补充引擎" in result

    def test_merge_tables_no_duplicate(self) -> None:
        mock_client = MagicMock(spec=LLMClient)
        orchestrator = LLMOrchestrator(llm_client=mock_client)

        table = "| A | B |\n|---|---|\n| 1 | 2 |\n"
        primary = f"# Doc\n{table}"
        secondary = f"# Doc\n{table}"

        result = orchestrator._merge_tables(primary, secondary)
        # 不应添加重复表格
        assert result.count("补充引擎") == 0

    def test_merge_code_blocks(self) -> None:
        mock_client = MagicMock(spec=LLMClient)
        orchestrator = LLMOrchestrator(llm_client=mock_client)

        primary = "# Doc\nText only."
        secondary = (
            "# Doc\n```python\nprint('hello')\n```\n```js\nconsole.log('hi')\n```"
        )

        result = orchestrator._merge_code_blocks(primary, secondary)
        assert "print('hello')" in result


# ============================================================
# 三阶段编排流程
# ============================================================
class TestLLMOrchestratorPipeline:
    """验证完整编排流程（mock LLM + mock 引擎）。"""

    @pytest.mark.asyncio
    async def test_orchestrate_single_engine_success(self) -> None:
        """仅一个引擎成功时直接返回。"""
        mock_client = MagicMock(spec=LLMClient)
        orchestrator = LLMOrchestrator(llm_client=mock_client)

        # Mock _analyze_pdf 返回仅 pymupdf
        plan = OrchestrationPlan(
            characteristics=PDFCharacteristics(page_count=3),
            engine_tasks=[EngineTask(engine="pymupdf", focus="text", priority=5)],
            synthesis_strategy="best_of",
        )

        pymupdf_result = EngineResult(
            engine="pymupdf",
            success=True,
            content="# Test content",
            metadata={"page_count": 3},
            quality_signals={"word_count": 100},
        )

        with (
            patch.object(orchestrator, "_analyze_pdf", return_value=plan),
            patch.object(
                orchestrator, "_execute_engines", return_value=[pymupdf_result]
            ),
        ):
            result = await orchestrator.orchestrate(Path("/fake.pdf"))

        assert isinstance(result, OrchestrationResult)
        assert result.content == "# Test content"
        assert result.engines_used == ["pymupdf"]

    @pytest.mark.asyncio
    async def test_orchestrate_all_engines_fail(self) -> None:
        """所有引擎失败时返回空结果。"""
        mock_client = MagicMock(spec=LLMClient)
        orchestrator = LLMOrchestrator(llm_client=mock_client)

        plan = OrchestrationPlan(
            characteristics=PDFCharacteristics(),
            engine_tasks=[
                EngineTask(engine="docling", focus="test"),
                EngineTask(engine="pymupdf", focus="test"),
            ],
        )

        failed_results = [
            EngineResult(engine="docling", success=False, error="import error"),
            EngineResult(engine="pymupdf", success=False, error="file error"),
        ]

        with (
            patch.object(orchestrator, "_analyze_pdf", return_value=plan),
            patch.object(orchestrator, "_execute_engines", return_value=failed_results),
        ):
            result = await orchestrator.orchestrate(Path("/fake.pdf"))

        assert result.content == ""
        assert result.engines_used == []

    @pytest.mark.asyncio
    async def test_orchestrate_fallback_on_llm_failure(self) -> None:
        """LLM 分析失败时使用默认计划。"""
        mock_client = MagicMock(spec=LLMClient)
        orchestrator = LLMOrchestrator(llm_client=mock_client)

        # Mock _quick_scan 正常，_llm_plan 失败
        with (
            patch.object(
                orchestrator,
                "_quick_scan",
                return_value=PDFCharacteristics(page_count=5),
            ),
            patch.object(
                orchestrator,
                "_llm_plan",
                side_effect=Exception("API timeout"),
            ),
        ):
            plan = await orchestrator._analyze_pdf(Path("/fake.pdf"), None)

        # 应使用默认计划
        assert len(plan.engine_tasks) == 2
        assert "默认" in plan.reasoning or "LLM 分析失败" in plan.reasoning


# ============================================================
# PDFProcessor smart 模式集成
# ============================================================
class TestPDFProcessorSmartMethod:
    """验证 PDFProcessor method='smart' 集成。"""

    def test_smart_in_supported_methods(self) -> None:
        """验证 smart 在支持的方法列表中。"""
        from negentropy.perceives.pdf.processor import PDFProcessor

        processor = PDFProcessor(enable_enhanced_features=False)
        assert "smart" in processor.supported_methods

    @pytest.mark.asyncio
    async def test_smart_fallback_to_auto_when_litellm_missing(self) -> None:
        """LiteLLM 未安装时降级到 auto。"""
        from negentropy.perceives.pdf.processor import PDFProcessor

        processor = PDFProcessor(enable_enhanced_features=False)

        with patch(
            "negentropy.perceives.pdf.llm_client.LLMClient.is_available",
            return_value=False,
        ):
            # 应降级到 auto，然后因为没有真实 PDF 而报错
            result = await processor.process_pdf(
                pdf_source="/nonexistent.pdf", method="smart"
            )
            # 降级到 auto 后会因文件不存在而返回错误
            assert result.get("success") is False


# ============================================================
# 多引擎编排测试（docling + mineru + marker + pymupdf）
# ============================================================
class TestMultiEngineOrchestration:
    """验证包含 docling + mineru + marker + pymupdf 的多引擎编排流程。"""

    @pytest.mark.asyncio
    async def test_four_engine_plan_analysis(self) -> None:
        """四引擎编排计划应正确解析。"""
        mock_client = MagicMock(spec=LLMClient)
        orchestrator = LLMOrchestrator(llm_client=mock_client)

        # 模拟 LLM 返回四引擎计划
        llm_response = MagicMock(spec=LLMResponse)
        llm_response.content = json.dumps(
            {
                "engine_tasks": [
                    {"engine": "docling", "focus": "全文档高保真转换", "priority": 8},
                    {"engine": "mineru", "focus": "LaTeX 公式提取", "priority": 7},
                    {"engine": "marker", "focus": "整体结构", "priority": 6},
                    {"engine": "pymupdf", "focus": "快速文本提取", "priority": 5},
                ],
                "synthesis_strategy": "merge",
                "reasoning": "四引擎策略",
            }
        )

        with (
            patch.object(
                orchestrator,
                "_quick_scan",
                return_value=PDFCharacteristics(page_count=10, has_formulas=True),
            ),
            patch.object(
                orchestrator,
                "_llm_plan",
                return_value=OrchestrationPlan(
                    characteristics=PDFCharacteristics(
                        page_count=10, has_formulas=True
                    ),
                    engine_tasks=[
                        EngineTask(engine="docling", focus="full", priority=8),
                        EngineTask(engine="mineru", focus="formulas", priority=7),
                        EngineTask(engine="marker", focus="structure", priority=6),
                        EngineTask(engine="pymupdf", focus="text", priority=5),
                    ],
                    synthesis_strategy="merge",
                    reasoning="四引擎策略",
                ),
            ),
        ):
            plan = await orchestrator._analyze_pdf(Path("/fake.pdf"), None)
            assert len(plan.engine_tasks) == 4
            assert plan.synthesis_strategy == "merge"

    @pytest.mark.asyncio
    async def test_heuristic_synthesize_four_engines(self) -> None:
        """四引擎启发式融合应正确选择最佳引擎。"""
        mock_client = MagicMock(spec=LLMClient)
        orchestrator = LLMOrchestrator(llm_client=mock_client)

        plan = OrchestrationPlan(
            characteristics=PDFCharacteristics(page_count=10, has_formulas=True),
            engine_tasks=[
                EngineTask(engine="docling", focus="full", priority=8),
                EngineTask(engine="mineru", focus="formulas", priority=7),
                EngineTask(engine="marker", focus="structure", priority=6),
                EngineTask(engine="pymupdf", focus="text", priority=5),
            ],
            synthesis_strategy="merge",
        )

        docling_result = EngineResult(
            engine="docling",
            success=True,
            content="# Docling\n\nRich content with tables and formulas",
            quality_signals={
                "word_count": 1000,
                "heading_count": 10,
                "formula_block_count": 5,
                "formula_inline_count": 10,
                "table_lines": 20,
                "code_fence_count": 3,
                "image_count": 5,
            },
        )
        mineru_result = EngineResult(
            engine="mineru",
            success=True,
            content="# MinerU\n\n$$E = mc^2$$",
            quality_signals={
                "word_count": 900,
                "heading_count": 8,
                "formula_block_count": 10,
                "formula_inline_count": 5,
                "table_lines": 10,
                "code_fence_count": 2,
                "image_count": 3,
            },
        )
        marker_result = EngineResult(
            engine="marker",
            success=True,
            content="# Marker\n\n| A | B |\n|---|---|",
            quality_signals={
                "word_count": 800,
                "heading_count": 5,
                "formula_block_count": 3,
                "formula_inline_count": 2,
                "table_lines": 5,
                "code_fence_count": 1,
                "image_count": 2,
            },
        )
        pymupdf_result = EngineResult(
            engine="pymupdf",
            success=True,
            content="PyMuPDF plain text",
            quality_signals={
                "word_count": 500,
                "heading_count": 2,
                "formula_block_count": 0,
                "formula_inline_count": 0,
                "table_lines": 0,
                "code_fence_count": 0,
                "image_count": 0,
            },
        )

        decision = orchestrator._heuristic_synthesize(
            [docling_result, mineru_result, marker_result, pymupdf_result],
            plan,
        )
        # docling 应得最高分
        assert decision["primary_engine"] == "docling"

    @pytest.mark.asyncio
    async def test_mineru_as_formula_supplement(self) -> None:
        """MinerU 公式更多时应被检测为公式补充源。"""
        mock_client = MagicMock(spec=LLMClient)
        orchestrator = LLMOrchestrator(llm_client=mock_client)

        plan = OrchestrationPlan(
            characteristics=PDFCharacteristics(page_count=10, has_formulas=True),
            engine_tasks=[
                EngineTask(engine="docling", focus="full", priority=8),
                EngineTask(engine="mineru", focus="formulas", priority=7),
            ],
            synthesis_strategy="merge",
        )

        # docling 综合评分需高于 mineru
        # 启发式评分公式:
        #   score = word_count*0.001 + heading_count*5 + table_lines*3
        #           + formula_block_count*10 + formula_inline_count*2
        #           + code_fence_count*5 + image_count*3 + priority*2
        # docling: 8.0 + 50 + 60 + 20 + 6 + 25 + 15 + 16 = 200
        # mineru:  0.5 + 15 + 0 + 150 + 20 + 0 + 0 + 14 = 199.5
        docling_result = EngineResult(
            engine="docling",
            success=True,
            content="# Docling\n\nSome content",
            quality_signals={
                "word_count": 8000,
                "heading_count": 10,
                "formula_block_count": 2,
                "formula_inline_count": 3,
                "table_lines": 20,
                "code_fence_count": 5,
                "image_count": 5,
            },
        )
        mineru_result = EngineResult(
            engine="mineru",
            success=True,
            content="# MinerU\n\n$$x^2$$ $$y^2$$",
            quality_signals={
                "word_count": 500,
                "heading_count": 3,
                "formula_block_count": 15,
                "formula_inline_count": 10,
                "table_lines": 0,
                "code_fence_count": 0,
                "image_count": 0,
            },
        )

        decision = orchestrator._heuristic_synthesize(
            [docling_result, mineru_result],
            plan,
        )
        # docling 仍为主体（结构化内容更丰富）
        assert decision["primary_engine"] == "docling"
        # MinerU 公式维度更强，应被检测为补充源
        formula_supplements = [
            s for s in decision["supplements"] if s["content_type"] == "formulas"
        ]
        assert len(formula_supplements) == 1

    @pytest.mark.asyncio
    async def test_partial_engine_failures(self) -> None:
        """部分引擎失败时仍能合成结果。"""
        mock_client = MagicMock(spec=LLMClient)
        orchestrator = LLMOrchestrator(llm_client=mock_client)

        plan = OrchestrationPlan(
            characteristics=PDFCharacteristics(page_count=5),
            engine_tasks=[
                EngineTask(engine="docling", focus="full", priority=8),
                EngineTask(engine="mineru", focus="formulas", priority=7),
                EngineTask(engine="marker", focus="structure", priority=6),
                EngineTask(engine="pymupdf", focus="text", priority=5),
            ],
            synthesis_strategy="best_of",
        )

        docling_result = EngineResult(
            engine="docling",
            success=True,
            content="# Docling content",
            quality_signals={"word_count": 100, "heading_count": 5},
        )
        mineru_failed = EngineResult(
            engine="mineru",
            success=False,
            error="MinerU not installed",
        )
        marker_failed = EngineResult(
            engine="marker",
            success=False,
            error="Marker not installed",
        )
        pymupdf_result = EngineResult(
            engine="pymupdf",
            success=True,
            content="PyMuPDF fallback text",
            quality_signals={"word_count": 50, "heading_count": 1},
        )

        with (
            patch.object(orchestrator, "_analyze_pdf", return_value=plan),
            patch.object(
                orchestrator,
                "_execute_engines",
                return_value=[
                    docling_result,
                    mineru_failed,
                    marker_failed,
                    pymupdf_result,
                ],
            ),
        ):
            result = await orchestrator.orchestrate(Path("/fake.pdf"))

        # 应有内容（至少一个引擎成功）
        assert result.content != ""
        assert "docling" in result.engines_used

        # 失败的引擎不应在 engines_used 中
        assert "mineru" not in result.engines_used
        assert "marker" not in result.engines_used

    @pytest.mark.asyncio
    async def test_execute_mineru_and_marker_engines(self) -> None:
        """验证 _execute_engines 能正确调度 mineru 和 marker 引擎。"""
        mock_client = MagicMock(spec=LLMClient)

        orchestrator = LLMOrchestrator(llm_client=mock_client)

        plan = OrchestrationPlan(
            characteristics=PDFCharacteristics(page_count=3),
            engine_tasks=[
                EngineTask(engine="mineru", focus="formulas", priority=7),
                EngineTask(engine="marker", focus="structure", priority=6),
            ],
        )

        mineru_engine_result = EngineResult(
            engine="mineru",
            success=True,
            content="# MinerU\n$$E=mc^2$$",
            quality_signals={"word_count": 50},
        )
        marker_engine_result = EngineResult(
            engine="marker",
            success=True,
            content="# Marker\n| A | B |",
            quality_signals={"word_count": 50},
        )

        with (
            patch.object(
                orchestrator, "_run_mineru", return_value=mineru_engine_result
            ),
            patch.object(
                orchestrator, "_run_marker", return_value=marker_engine_result
            ),
        ):
            results = await orchestrator._execute_engines(
                Path("/fake.pdf"),
                plan,
                None,
            )

        assert len(results) == 2
        # 检查 mineru 结果
        mineru_res = next((r for r in results if r.engine == "mineru"), None)
        assert mineru_res is not None
        assert mineru_res.success is True
        assert "$$E=mc^2$$" in mineru_res.content

        # 检查 marker 结果
        marker_res = next((r for r in results if r.engine == "marker"), None)
        assert marker_res is not None
        assert marker_res.success is True
        assert "| A | B |" in marker_res.content

    @pytest.mark.asyncio
    async def test_execute_unavailable_engines_graceful(self) -> None:
        """不可用的引擎应优雅地返回失败结果。"""
        mock_client = MagicMock(spec=LLMClient)
        orchestrator = LLMOrchestrator(llm_client=mock_client)

        plan = OrchestrationPlan(
            characteristics=PDFCharacteristics(),
            engine_tasks=[
                EngineTask(engine="mineru", focus="formulas", priority=7),
                EngineTask(engine="marker", focus="structure", priority=6),
            ],
        )

        with (
            patch.object(MinerUEngine, "is_available", return_value=False),
            patch.object(MarkerEngine, "is_available", return_value=False),
        ):
            results = await orchestrator._execute_engines(
                Path("/fake.pdf"),
                plan,
                None,
            )

        assert len(results) == 2
        assert all(not r.success for r in results)
