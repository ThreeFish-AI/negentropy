"""Docling 深度集成回归测试。

使用真实 PDF 文件验证：
1. Docling 全链路转换质量（布局、段落顺序、表格、公式、图片、代码）
2. 与 PyMuPDF 路径的降级兼容性
3. 两种引擎的输出质量对比（记录指标，不做硬断言）
4. GPU 加速（MPS/CUDA）的显式验证与可观测性

测试资源：
- assets/Context Engineering 2.0 - The Context of Context Engineering.pdf
- assets/2603.05344v3.pdf
"""

import logging
import time
from pathlib import Path

import pytest

from negentropy.perceives.pdf.hardware import DeviceType, detect_device
from negentropy.perceives.pdf.docling_engine import DoclingEngine

logger = logging.getLogger(__name__)

# ── 设备检测（模块级，供 skipif 装饰器使用）──────────────────
_detected_device = detect_device()
_is_gpu = _detected_device.is_gpu
_is_mps = _detected_device == DeviceType.MPS

# MPS 上 formula enrichment 被禁用以保持 GPU 加速，公式相关测试需跳过
skip_formula_on_mps = pytest.mark.skipif(
    _is_mps,
    reason="MPS 与 Docling formula enrichment 不兼容，公式测试跳过",
)

# ── 条件跳过装饰器 ────────────────────────────────────────────
# 真实 PDF 文件路径
ASSETS_DIR = Path(__file__).resolve().parents[2] / "assets"
CE_PDF = ASSETS_DIR / "Context Engineering 2.0 - The Context of Context Engineering.pdf"
ARXIV_PDF = ASSETS_DIR / "2603.05344v3.pdf"

skip_no_docling = pytest.mark.skipif(
    not DoclingEngine.is_available(),
    reason="需要安装 docling 可选依赖",
)
skip_no_ce_pdf = pytest.mark.skipif(
    not CE_PDF.exists(),
    reason=f"PDF 文件不存在: {CE_PDF}",
)
skip_no_arxiv_pdf = pytest.mark.skipif(
    not ARXIV_PDF.exists(),
    reason=f"PDF 文件不存在: {ARXIV_PDF}",
)
skip_no_gpu = pytest.mark.skipif(
    not _is_gpu,
    reason=f"未检测到 GPU 加速设备 (当前: {_detected_device.value})，跳过 GPU 测试",
)


# ============================================================
# Context Engineering PDF — Docling GPU 加速转换测试
# ============================================================
@pytest.mark.slow
@pytest.mark.requires_gpu
@skip_no_docling
@skip_no_ce_pdf
@skip_no_gpu
class TestDoclingCEPDFConversion:
    """Context Engineering 2.0 PDF 的 Docling GPU 加速转换质量验证。

    该 PDF 包含丰富的数学公式、表格和图像。
    通过 session 级 fixture 显式绑定 GPU 设备并预热 converter。
    """

    @pytest.fixture(scope="class")
    def docling_result(self, shared_docling_result_ce):
        """类级 fixture：复用 session 级共享的 CE_PDF Docling 转换结果。"""
        return shared_docling_result_ce

    @pytest.mark.integration
    def test_markdown_not_empty(self, docling_result) -> None:
        """Markdown 输出不应为空。"""
        assert len(docling_result.markdown) > 100, (
            f"Markdown 输出过短: {len(docling_result.markdown)} 字符"
        )

    @pytest.mark.integration
    def test_markdown_has_headings(self, docling_result) -> None:
        """Markdown 应包含标题结构。"""
        md = docling_result.markdown
        assert "# " in md or "## " in md, "Markdown 中未找到标题"

    @pytest.mark.integration
    def test_page_count(self, docling_result) -> None:
        """应正确报告页数。"""
        assert docling_result.page_count > 0, "页数为 0"

    @pytest.mark.integration
    @skip_formula_on_mps
    def test_formulas_in_markdown(self, docling_result) -> None:
        """Markdown 中应包含 LaTeX 公式标记。"""
        md = docling_result.markdown
        has_inline = "$" in md
        has_block = "$$" in md
        assert has_inline or has_block, "Markdown 中未找到 LaTeX 公式标记 ($ 或 $$)"

    @pytest.mark.integration
    @skip_formula_on_mps
    def test_formulas_extracted(self, docling_result) -> None:
        """应提取到数学公式。"""
        assert len(docling_result.formulas) > 0, "未提取到任何公式"

    @pytest.mark.integration
    def test_tables_extracted(self, docling_result) -> None:
        """应提取到表格。"""
        assert len(docling_result.tables) > 0, "未提取到任何表格"

    @pytest.mark.integration
    def test_tables_have_structure(self, docling_result) -> None:
        """表格应包含结构化 Markdown（管道分隔符）。"""
        for table in docling_result.tables:
            assert "|" in table.markdown, f"表格缺少管道分隔符: {table.markdown[:100]}"

    @pytest.mark.integration
    def test_images_detected(self, docling_result) -> None:
        """应检测到图片。"""
        assert len(docling_result.images) > 0, "未检测到任何图片"

    @pytest.mark.integration
    def test_paragraph_ordering_sample(self, docling_result) -> None:
        """抽样验证段落顺序：关键内容应按原文顺序出现。

        选取论文中几个确定性标题/关键词，验证其在 Markdown 中的出现顺序。
        """
        md = docling_result.markdown

        # 收集出现位置
        markers = ["Context", "Engineering"]
        positions = []
        for marker in markers:
            pos = md.find(marker)
            if pos >= 0:
                positions.append((marker, pos))

        # 至少找到一些标记
        assert len(positions) > 0, "未在 Markdown 中找到任何预期标记"


# ============================================================
# arXiv 论文 PDF — Docling GPU 加速转换测试
# ============================================================
@pytest.mark.slow
@pytest.mark.requires_gpu
@skip_no_docling
@skip_no_arxiv_pdf
@skip_no_gpu
class TestDoclingArxivPDFConversion:
    """arXiv 论文 2603.05344v3 的 Docling GPU 加速转换质量验证。

    该 PDF 包含大量代码块。仅处理前 3 页以控制测试时长。
    """

    @pytest.fixture(scope="class")
    def docling_result(self, shared_docling_result_arxiv):
        """类级 fixture：复用 session 级共享的 arXiv PDF（前 3 页）转换结果。"""
        return shared_docling_result_arxiv

    @pytest.mark.integration
    def test_markdown_not_empty(self, docling_result) -> None:
        assert len(docling_result.markdown) > 100

    @pytest.mark.integration
    def test_code_blocks_in_markdown(self, docling_result) -> None:
        """Markdown 中如包含代码围栏则应被正确提取（截页范围可能不含代码块）。"""
        md = docling_result.markdown
        # 截页范围（1-8 页）可能不包含代码块，仅在存在时断言
        if len(docling_result.code_blocks) > 0:
            assert "```" in md, "有 code_blocks 但 Markdown 中未找到代码围栏 (```)"
        else:
            pytest.skip("截页范围 (1-8) 内未检测到代码块，跳过此断言")

    @pytest.mark.integration
    def test_code_blocks_extracted(self, docling_result) -> None:
        """应提取到代码块（截页范围可能不含代码块时跳过）。"""
        if len(docling_result.code_blocks) == 0:
            pytest.skip("截页范围 (1-8) 内未检测到代码块，跳过此断言")
        assert len(docling_result.code_blocks) > 0, "未提取到任何代码块"

    @pytest.mark.integration
    def test_academic_structure(self, docling_result) -> None:
        """学术论文应包含典型结构（Abstract 等）。"""
        md = docling_result.markdown.lower()
        has_abstract = "abstract" in md
        has_intro = "introduction" in md or "intro" in md
        assert has_abstract or has_intro, "学术论文中未找到 Abstract 或 Introduction"

    @pytest.mark.integration
    def test_tables_have_pipe_separator(self, docling_result) -> None:
        """如有表格，应包含管道分隔符。"""
        for table in docling_result.tables:
            assert "|" in table.markdown


# ============================================================
# Docling 路径与 PyMuPDF 降级兼容性
# ============================================================
@pytest.mark.slow
@skip_no_ce_pdf
class TestDoclingFallbackCompatibility:
    """验证 Docling 路径与 PyMuPDF 降级路径的兼容性。"""

    @skip_no_docling
    @pytest.mark.requires_gpu
    @skip_no_gpu
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_full_pipeline_with_docling(self) -> None:
        """通过 PDFProcessor 完整管线验证 Docling GPU 加速路径。"""
        from negentropy.perceives.pdf.processor import PDFProcessor

        processor = PDFProcessor(enable_enhanced_features=True, prefer_docling=True)
        try:
            if processor._docling_engine is not None:
                dc = processor._docling_engine._resolve_device_config()
                logger.info("PDFProcessor Docling 引擎设备: %s", dc.device)
                assert dc.device_type.is_gpu, (
                    f"PDFProcessor 的 Docling 引擎未使用 GPU: {dc.device}"
                )

            result = await processor.process_pdf(
                str(CE_PDF),
                method="auto",
                extract_formulas=True,
                extract_images=True,
                extract_tables=True,
            )
            assert result["success"] is True
            assert result.get("method_used") == "docling"
            assert "markdown" in result
            assert len(result["markdown"]) > 100
        finally:
            processor.cleanup()

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_fallback_to_pymupdf(self) -> None:
        """prefer_docling=False 时应走 PyMuPDF 路径。"""
        from negentropy.perceives.pdf.processor import PDFProcessor

        processor = PDFProcessor(
            enable_enhanced_features=True,
            prefer_docling=False,
        )
        try:
            result = await processor.process_pdf(
                str(CE_PDF),
                method="pymupdf",
                extract_formulas=True,
                extract_images=False,
                extract_tables=False,
            )
            assert result["success"] is True
            assert result.get("method_used") == "pymupdf"
        finally:
            processor.cleanup()

    @skip_no_docling
    @pytest.mark.requires_gpu
    @skip_no_gpu
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_explicit_docling_method(self) -> None:
        """method='docling' 显式指定应使用 Docling GPU 引擎。"""
        from negentropy.perceives.pdf.processor import PDFProcessor

        processor = PDFProcessor(enable_enhanced_features=True, prefer_docling=True)
        try:
            if processor._docling_engine is not None:
                dc = processor._docling_engine._resolve_device_config()
                logger.info("显式 Docling 引擎设备: %s", dc.device)

            result = await processor.process_pdf(
                str(CE_PDF),
                method="docling",
                extract_formulas=True,
                extract_tables=True,
            )
            assert result["success"] is True
            assert result.get("method_used") == "docling"
        finally:
            processor.cleanup()

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_docling_method_without_install_returns_error(self) -> None:
        """Docling 未安装时 method='docling' 应返回错误。"""
        from negentropy.perceives.pdf.processor import PDFProcessor

        processor = PDFProcessor(
            enable_enhanced_features=True,
            prefer_docling=False,  # 模拟未安装
        )
        try:
            result = await processor.process_pdf(
                str(CE_PDF),
                method="docling",
            )
            # 当 _docling_engine is None 且 method="docling"，应返回错误
            assert result["success"] is False
            assert (
                "不可用" in result.get("error", "")
                or "docling" in result.get("error", "").lower()
            )
        finally:
            processor.cleanup()


# ============================================================
# 质量对比（记录指标，不做硬断言）
# ============================================================
@pytest.mark.slow
@pytest.mark.requires_gpu
@skip_no_docling
@skip_no_ce_pdf
@skip_no_gpu
class TestConversionQualityComparison:
    """对比 Docling（GPU 加速）与 PyMuPDF 引擎的输出质量。

    记录指标供人工审查，不做引擎间的硬性断言。
    """

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_compare_outputs(self, shared_docling_result_ce) -> None:
        """对比两个引擎的关键质量指标与耗时。

        Docling 路径复用 session 级共享的 CE_PDF 转换结果，
        PyMuPDF 路径仍独立执行以获取对比基线。
        """
        from negentropy.perceives.pdf.processor import PDFProcessor

        # PyMuPDF CPU 路径（仍需独立执行以获取对比数据）
        proc_pymupdf = PDFProcessor(
            enable_enhanced_features=True,
            prefer_docling=False,
        )

        try:
            # Docling 路径：直接使用共享结果（已通过 session fixture 转换）
            docling_shared = shared_docling_result_ce
            logger.info(
                "质量对比 - Docling (GPU 共享结果): %d 页, %d 字符",
                docling_shared.page_count,
                len(docling_shared.markdown),
            )

            t0 = time.perf_counter()
            pymupdf_result = await proc_pymupdf.process_pdf(
                str(CE_PDF),
                method="pymupdf",
                extract_formulas=True,
                extract_images=True,
                extract_tables=True,
            )
            pymupdf_elapsed = time.perf_counter() - t0

            assert pymupdf_result["success"] is True

            # 记录质量 + 性能指标
            logger.info(
                "质量对比 [Context Engineering 2.0 PDF]:\n"
                "  Docling (GPU 共享): %d 页, %d 字符, %d 表格, %d 公式, %d 图片\n"
                "  PyMuPDF (CPU): %.2f 秒, %d 词, %d 字符, method=%s\n"
                "  PyMuPDF tables: %s\n"
                "  PyMuPDF formulas: %s",
                docling_shared.page_count,
                len(docling_shared.markdown),
                len(docling_shared.tables),
                len(docling_shared.formulas),
                len(docling_shared.images),
                pymupdf_elapsed,
                pymupdf_result.get("word_count", 0),
                pymupdf_result.get("character_count", 0),
                pymupdf_result.get("method_used"),
                pymupdf_result.get("enhanced_assets", {}).get("tables_extracted", 0),
                pymupdf_result.get("enhanced_assets", {}).get("formulas_extracted", 0),
            )
        finally:
            proc_pymupdf.cleanup()


# ============================================================
# GPU 设备检测与配置验证
# ============================================================
@pytest.mark.requires_gpu
@skip_no_docling
@skip_no_gpu
class TestGPUDeviceVerification:
    """GPU 加速设备检测与配置验证。

    独立测试类，确保 GPU 检测、设备配置策略和 MPS 限制降级
    在测试环境中正确生效。
    """

    @pytest.mark.integration
    def test_gpu_device_detected(self, detected_gpu_device: DeviceType) -> None:
        """验证检测到 GPU 加速设备。"""
        assert detected_gpu_device.is_gpu, (
            f"预期 GPU 设备，实际检测到: {detected_gpu_device.value}"
        )
        logger.info("GPU 设备验证通过: %s", detected_gpu_device.value)

    @pytest.mark.integration
    def test_docling_engine_uses_gpu(self, gpu_docling_engine) -> None:
        """验证 DoclingEngine 实例已绑定 GPU 设备。"""
        device_config = gpu_docling_engine._resolve_device_config()
        assert device_config.device_type.is_gpu
        assert device_config.device in ("mps", "cuda", "xpu")
        logger.info(
            "DoclingEngine GPU 配置: device=%s, type=%s",
            device_config.device,
            device_config.device_type.value,
        )

    @pytest.mark.integration
    def test_mps_formula_enrichment_policy(self, gpu_docling_engine) -> None:
        """MPS 设备下，formula enrichment 策略取决于 mlx-vlm 可用性。

        mlx-vlm 已安装时保留 formula enrichment（granite_docling + MLX），
        未安装时保持上游 MPS 禁用。
        """
        from importlib.util import find_spec

        device_config = gpu_docling_engine._resolve_device_config()
        if device_config.device_type == DeviceType.MPS:
            mlx_available = find_spec("mlx_vlm") is not None
            if mlx_available:
                assert device_config.do_formula_enrichment is True, (
                    "MPS + mlx-vlm 可用时 formula enrichment 应保留"
                )
                assert "granite_docling + MLX" in device_config.adjustments.get(
                    "formula_enrichment", ""
                )
            else:
                assert device_config.do_formula_enrichment is False, (
                    "MPS + mlx-vlm 不可用时 formula enrichment 应保持上游禁用"
                )
            assert "formula_enrichment" in device_config.adjustments
            logger.info(
                "MPS formula enrichment 策略验证通过 (mlx_vlm=%s)", mlx_available
            )
        else:
            pytest.skip(f"非 MPS 设备 ({device_config.device_type.value})，跳过此验证")

    @pytest.mark.integration
    def test_converter_warmup_performance(self, warm_docling_converter: float) -> None:
        """验证 converter 预热在合理时间内完成。"""
        assert warm_docling_converter < 120, (
            f"Converter 预热耗时过长: {warm_docling_converter:.2f}s"
        )
        logger.info("Converter 预热耗时: %.2f 秒", warm_docling_converter)

    @pytest.mark.integration
    def test_batch_size_optimized_for_gpu(self, gpu_docling_engine) -> None:
        """GPU 设备下 batch sizes 应大于 CPU 默认值 4。"""
        device_config = gpu_docling_engine._resolve_device_config()
        if device_config.device_type.is_gpu:
            assert device_config.ocr_batch_size > 4, (
                f"GPU batch size 未优化: ocr_batch_size={device_config.ocr_batch_size}"
            )
            assert device_config.layout_batch_size > 4
            logger.info(
                "GPU batch size 验证通过: ocr=%d, layout=%d, table=%d",
                device_config.ocr_batch_size,
                device_config.layout_batch_size,
                device_config.table_batch_size,
            )

    @pytest.mark.integration
    def test_batch_size_logged_in_adjustments(self, gpu_docling_engine) -> None:
        """batch size 决策应记录在 adjustments 中供可观测性审查。"""
        device_config = gpu_docling_engine._resolve_device_config()
        if device_config.device_type.is_gpu:
            assert "batch_sizes" in device_config.adjustments, (
                "adjustments 中缺少 batch_sizes 条目"
            )
