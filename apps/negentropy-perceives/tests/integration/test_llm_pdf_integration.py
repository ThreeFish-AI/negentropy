"""LLM 编排多引擎 PDF 转 Markdown 集成测试。

测试策略：
1. 条件跳过：LiteLLM 未安装 / API Key 未配置 / PDF 文件不存在
2. 真实 PDF 端到端测试（使用 assets/ 下的两份 PDF）
3. smart 模式 vs docling 模式质量对比（记录指标，不做硬断言）
4. 降级路径验证（LiteLLM 不可用时自动退回 auto）

测试资源：
- assets/Context Engineering 2.0 - The Context of Context Engineering.pdf （公式、表格、图像）
- assets/2603.05344v3.pdf （代码块、学术结构）
"""

import logging
import os
from pathlib import Path
from unittest.mock import patch

import pytest

from negentropy.perceives.pdf.llm_client import LLMClient

logger = logging.getLogger(__name__)

# 真实 PDF 文件路径
ASSETS_DIR = Path(__file__).resolve().parents[2] / "assets"
CE_PDF = ASSETS_DIR / "Context Engineering 2.0 - The Context of Context Engineering.pdf"
ARXIV_PDF = ASSETS_DIR / "2603.05344v3.pdf"

# 条件跳过装饰器
_litellm_available = LLMClient.is_available()
_has_api_key = bool(
    os.environ.get("OPENAI_API_KEY")
    or os.environ.get("NEGENTROPY_PERCEIVES_LLM_API_KEY")
)

skip_no_litellm = pytest.mark.skipif(
    not _litellm_available,
    reason="需要安装 litellm 可选依赖（uv pip install litellm）",
)
skip_no_api_key = pytest.mark.skipif(
    not _has_api_key,
    reason="需要配置 OPENAI_API_KEY 或 NEGENTROPY_PERCEIVES_LLM_API_KEY 环境变量",
)
skip_no_ce_pdf = pytest.mark.skipif(
    not CE_PDF.exists(),
    reason=f"PDF 文件不存在: {CE_PDF}",
)
skip_no_arxiv_pdf = pytest.mark.skipif(
    not ARXIV_PDF.exists(),
    reason=f"PDF 文件不存在: {ARXIV_PDF}",
)

# 需要 LLM 可用 + API Key + PDF 的组合跳过
requires_llm = pytest.mark.usefixtures()  # 占位，用于逻辑分组


# ============================================================
# 辅助函数
# ============================================================


def _log_quality_signals(label: str, signals: dict) -> None:
    """以表格形式记录质量信号到日志。"""
    logger.info(
        "质量信号 [%s]:\n"
        "  字数: %d | 标题: %d | 表格行: %d\n"
        "  块级公式: %d | 行内公式: %d | 代码块: %d\n"
        "  图片: %d | 列表: %d",
        label,
        signals.get("word_count", 0),
        signals.get("heading_count", 0),
        signals.get("table_lines", 0),
        signals.get("formula_block_count", 0),
        signals.get("formula_inline_count", 0),
        signals.get("code_fence_count", 0),
        signals.get("image_count", 0),
        signals.get("list_count", 0),
    )


# ============================================================
# Smart 模式降级路径验证
# ============================================================
@pytest.mark.slow
class TestSmartModeDegradation:
    """验证 smart 模式在 LLM 不可用时的降级行为。"""

    @pytest.mark.integration
    @pytest.mark.asyncio
    @skip_no_ce_pdf
    async def test_smart_degrades_to_auto_when_litellm_missing(self) -> None:
        """LiteLLM 未安装时，smart 模式应降级到 auto 并成功完成。"""
        from negentropy.perceives.pdf.processor import PDFProcessor

        processor = PDFProcessor(enable_enhanced_features=False)
        try:
            with patch.object(LLMClient, "is_available", return_value=False):
                result = await processor.process_pdf(str(CE_PDF), method="smart")
            assert result["success"] is True
            # 降级后不应是 smart 方法
            assert result.get("method_used") != "smart"
            assert len(result.get("markdown", "")) > 100
        finally:
            processor.cleanup()

    @pytest.mark.integration
    @pytest.mark.asyncio
    @skip_no_ce_pdf
    async def test_smart_degrades_on_orchestration_error(self) -> None:
        """编排过程异常时，smart 模式应降级到 auto。"""
        from negentropy.perceives.pdf.processor import PDFProcessor

        processor = PDFProcessor(enable_enhanced_features=False)
        try:
            # LLMClient.__init__ 抛异常以触发 except 分支降级
            with (
                patch.object(LLMClient, "is_available", return_value=True),
                patch.object(
                    LLMClient,
                    "__init__",
                    side_effect=RuntimeError("模拟 LLM 初始化失败"),
                ),
            ):
                result = await processor.process_pdf(str(CE_PDF), method="smart")
            assert result["success"] is True
            assert result.get("method_used") != "smart"
        finally:
            processor.cleanup()

    @pytest.mark.integration
    def test_smart_in_supported_methods(self) -> None:
        """smart 应在 PDFProcessor 的支持方法列表中。"""
        from negentropy.perceives.pdf.processor import PDFProcessor

        processor = PDFProcessor(enable_enhanced_features=False)
        assert "smart" in processor.supported_methods


# ============================================================
# Context Engineering PDF — Smart 模式端到端
# ============================================================
@pytest.mark.slow
@pytest.mark.requires_llm
@skip_no_litellm
@skip_no_api_key
@skip_no_ce_pdf
class TestSmartModeCEPDF:
    """使用 Context Engineering 2.0 PDF 验证 smart 模式端到端。

    该 PDF 包含丰富的数学公式、表格和图像，是验证多引擎融合的理想资料。
    """

    @pytest.fixture(scope="class")
    async def smart_result(self):
        """类级 fixture：执行一次 smart 模式转换。"""
        from negentropy.perceives.pdf.processor import PDFProcessor

        processor = PDFProcessor(enable_enhanced_features=True)
        try:
            result = await processor.process_pdf(
                str(CE_PDF),
                method="smart",
                extract_formulas=True,
                extract_images=True,
                extract_tables=True,
            )
            return result
        finally:
            processor.cleanup()

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_smart_success(self, smart_result) -> None:
        """smart 模式应成功处理 PDF。"""
        assert smart_result["success"] is True, (
            f"smart 模式失败: {smart_result.get('error')}"
        )

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_smart_method_used(self, smart_result) -> None:
        """应报告 method_used 为 smart。"""
        assert smart_result.get("method_used") == "smart"

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_smart_has_markdown_content(self, smart_result) -> None:
        """输出应包含有意义的 Markdown 内容。"""
        md = smart_result.get("markdown", "")
        assert len(md) > 500, f"Markdown 输出过短: {len(md)} 字符"

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_smart_has_headings(self, smart_result) -> None:
        """Markdown 中应包含标题结构。"""
        md = smart_result.get("markdown", "")
        assert "# " in md or "## " in md, "smart 输出中未找到标题"

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_smart_has_orchestration_info(self, smart_result) -> None:
        """应包含编排元信息。"""
        orch_info = smart_result.get("orchestration_info")
        assert orch_info is not None, "缺少 orchestration_info 字段"
        assert "engines_used" in orch_info
        assert len(orch_info["engines_used"]) > 0
        logger.info(
            "编排信息:\n  引擎: %s\n  融合理由: %s",
            orch_info.get("engines_used"),
            orch_info.get("synthesis_reasoning", "")[:200],
        )

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_smart_page_count(self, smart_result) -> None:
        """应报告正确的页数。"""
        assert smart_result.get("page_count", 0) > 0


# ============================================================
# arXiv 论文 PDF — Smart 模式端到端
# ============================================================
@pytest.mark.slow
@pytest.mark.requires_llm
@skip_no_litellm
@skip_no_api_key
@skip_no_arxiv_pdf
class TestSmartModeArxivPDF:
    """使用 arXiv 论文 2603.05344v3 验证 smart 模式。

    该 PDF 包含大量代码块和学术结构。
    """

    @pytest.fixture(scope="class")
    async def smart_result(self):
        """类级 fixture：执行一次 smart 模式转换。"""
        from negentropy.perceives.pdf.processor import PDFProcessor

        processor = PDFProcessor(enable_enhanced_features=True)
        try:
            result = await processor.process_pdf(
                str(ARXIV_PDF),
                method="smart",
                extract_formulas=True,
                extract_tables=True,
            )
            return result
        finally:
            processor.cleanup()

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_smart_success(self, smart_result) -> None:
        assert smart_result["success"] is True, (
            f"smart 模式失败: {smart_result.get('error')}"
        )

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_smart_has_academic_structure(self, smart_result) -> None:
        """学术论文应包含 Abstract 或 Introduction。"""
        md = smart_result.get("markdown", "").lower()
        assert "abstract" in md or "introduction" in md, (
            "smart 输出中未找到学术论文典型结构"
        )

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_smart_has_code_blocks(self, smart_result) -> None:
        """代码密集的论文应在 smart 输出中包含代码围栏。"""
        md = smart_result.get("markdown", "")
        assert "```" in md, "smart 输出中未找到代码围栏"


# ============================================================
# Smart 模式 vs Docling 模式质量对比
# ============================================================
@pytest.mark.slow
@pytest.mark.requires_llm
@skip_no_litellm
@skip_no_api_key
@skip_no_ce_pdf
class TestSmartVsDoclingComparison:
    """对比 smart 模式与单引擎 docling 模式的输出质量。

    记录指标供人工审查，不做引擎间的硬性断言。
    """

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_compare_smart_vs_docling(self) -> None:
        """对比 smart 与 docling 的关键质量指标。"""
        from negentropy.perceives.pdf.llm_orchestrator import _extract_quality_signals
        from negentropy.perceives.pdf.processor import PDFProcessor

        # Smart 模式
        proc_smart = PDFProcessor(enable_enhanced_features=True)
        # Docling 模式
        proc_docling = PDFProcessor(enable_enhanced_features=True)

        try:
            smart_result = await proc_smart.process_pdf(
                str(CE_PDF),
                method="smart",
                extract_formulas=True,
                extract_images=True,
                extract_tables=True,
            )
            docling_result = await proc_docling.process_pdf(
                str(CE_PDF),
                method="docling",
                extract_formulas=True,
                extract_images=True,
                extract_tables=True,
            )

            # 两种模式都应成功
            assert smart_result["success"] is True, (
                f"smart 失败: {smart_result.get('error')}"
            )
            assert docling_result["success"] is True, (
                f"docling 失败: {docling_result.get('error')}"
            )

            # 提取质量信号并记录对比
            smart_signals = _extract_quality_signals(smart_result.get("markdown", ""))
            docling_signals = _extract_quality_signals(
                docling_result.get("markdown", "")
            )

            _log_quality_signals("smart 模式", smart_signals)
            _log_quality_signals("docling 模式", docling_signals)

            # 记录编排详情
            orch = smart_result.get("orchestration_info", {})
            logger.info(
                "编排对比摘要:\n"
                "  Smart 引擎: %s\n"
                "  Smart 融合策略: %s\n"
                "  Smart 字数: %d vs Docling 字数: %d\n"
                "  Smart 标题: %d vs Docling 标题: %d\n"
                "  Smart 表格行: %d vs Docling 表格行: %d\n"
                "  Smart 公式(块): %d vs Docling 公式(块): %d\n"
                "  Smart 代码块: %d vs Docling 代码块: %d",
                orch.get("engines_used", []),
                orch.get("synthesis_strategy", ""),
                smart_signals.get("word_count", 0),
                docling_signals.get("word_count", 0),
                smart_signals.get("heading_count", 0),
                docling_signals.get("heading_count", 0),
                smart_signals.get("table_lines", 0),
                docling_signals.get("table_lines", 0),
                smart_signals.get("formula_block_count", 0),
                docling_signals.get("formula_block_count", 0),
                smart_signals.get("code_fence_count", 0),
                docling_signals.get("code_fence_count", 0),
            )

            # 基本质量断言（非对比性）
            assert smart_signals["word_count"] > 100, "smart 输出字数过少"
            assert docling_signals["word_count"] > 100, "docling 输出字数过少"

        finally:
            proc_smart.cleanup()
            proc_docling.cleanup()


# ============================================================
# LLM 编排器直接集成测试
# ============================================================
@pytest.mark.slow
@pytest.mark.requires_llm
@skip_no_litellm
@skip_no_api_key
@skip_no_ce_pdf
class TestLLMOrchestratorDirectIntegration:
    """直接测试 LLMOrchestrator 编排流程（绕过 PDFProcessor）。"""

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_orchestrator_full_pipeline(self) -> None:
        """完整三阶段编排流程。"""
        from negentropy.perceives.pdf.llm_orchestrator import (
            LLMOrchestrator,
            OrchestrationResult,
        )

        llm_client = LLMClient()
        orchestrator = LLMOrchestrator(llm_client=llm_client)

        result = await orchestrator.orchestrate(CE_PDF)

        assert isinstance(result, OrchestrationResult)
        assert len(result.content) > 100, f"编排输出过短: {len(result.content)} 字符"
        assert result.method_used == "smart"
        assert len(result.engines_used) > 0

        logger.info(
            "编排器直接测试结果:\n"
            "  引擎: %s\n"
            "  内容长度: %d 字符\n"
            "  融合理由: %s\n"
            "  计划策略: %s",
            result.engines_used,
            len(result.content),
            result.synthesis_reasoning[:200],
            result.plan.synthesis_strategy if result.plan else "N/A",
        )

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_orchestrator_with_page_range(self) -> None:
        """指定页范围时编排应正常工作。"""
        from negentropy.perceives.pdf.llm_orchestrator import LLMOrchestrator

        llm_client = LLMClient()
        orchestrator = LLMOrchestrator(llm_client=llm_client)

        result = await orchestrator.orchestrate(CE_PDF, page_range=(1, 3))

        assert len(result.content) > 50
        assert result.method_used == "smart"
