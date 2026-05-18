"""MinerU engine unit tests.

测试策略：
- 当 MinerU 未安装时：验证 is_available() 返回 False，convert() 返回 None
- 当 MinerU 已安装时：使用 mock 验证 Python API / CLI 降级转换流程
- 数据类完整性验证
- 设备感知后端解析
- content_list.json 输出归一化
- 结构化元素提取（表格、公式、图片）
- PDFProcessor 的 mineru/marker 方法调度
"""

import json
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

from negentropy.perceives.pdf.mineru_engine import (
    MinerUConversionResult,
    MinerUEngine,
    MinerUFormula,
    MinerUImage,
    MinerUTable,
)


# ============================================================
# 数据类完整性
# ============================================================
class TestMinerUDataClasses:
    """验证 MinerU 标准化数据类的字段与默认值。"""

    def test_conversion_result_defaults(self) -> None:
        result = MinerUConversionResult(markdown="# Test")
        assert result.markdown == "# Test"
        assert result.tables == []
        assert result.images == []
        assert result.formulas == []
        assert result.code_blocks == []
        assert result.metadata == {}
        assert result.page_count == 0

    def test_conversion_result_full(self) -> None:
        result = MinerUConversionResult(
            markdown="# Full",
            tables=[MinerUTable(markdown="| A |", rows=1, columns=1)],
            images=[MinerUImage(page_number=0, caption="Fig 1")],
            formulas=[MinerUFormula(latex=r"\alpha", formula_type="inline")],
            code_blocks=[],
            metadata={"title": "Test Doc"},
            page_count=5,
        )
        assert result.page_count == 5
        assert len(result.tables) == 1
        assert len(result.images) == 1
        assert len(result.formulas) == 1
        assert len(result.code_blocks) == 0  # MinerU 不支持代码块

    def test_mineru_table_defaults(self) -> None:
        table = MinerUTable(markdown="| A | B |")
        assert table.rows == 0
        assert table.columns == 0
        assert table.page_number is None
        assert table.caption is None
        assert table.bbox is None
        assert table.html is None

    def test_mineru_table_with_html(self) -> None:
        table = MinerUTable(
            markdown="",
            html="<table><tr><td>Cell</td></tr></table>",
            rows=1,
            columns=1,
        )
        assert table.html == "<table><tr><td>Cell</td></tr></table>"
        assert table.markdown == ""

    def test_mineru_image_defaults(self) -> None:
        img = MinerUImage()
        assert img.page_number is None
        assert img.caption is None
        assert img.bbox is None
        assert img.filename is None
        assert img.local_path is None
        assert img.width is None
        assert img.height is None
        assert img.mime_type == "image/png"
        assert img.base64_data is None

    def test_mineru_image_with_all_fields(self) -> None:
        img = MinerUImage(
            page_number=1,
            caption="Figure 1",
            filename="img_0.png",
            local_path="/tmp/img_0.png",
            width=800,
            height=600,
            base64_data="abc123",
        )
        assert img.filename == "img_0.png"
        assert img.local_path == "/tmp/img_0.png"
        assert img.width == 800
        assert img.height == 600
        assert img.base64_data == "abc123"

    def test_mineru_formula_defaults(self) -> None:
        formula = MinerUFormula(latex=r"\sum")
        assert formula.formula_type == "block"
        assert formula.page_number is None
        assert formula.original_text == ""

    def test_mineru_formula_inline(self) -> None:
        formula = MinerUFormula(
            latex=r"\alpha + \beta",
            formula_type="inline",
            page_number=3,
            original_text="α+β",
        )
        assert formula.formula_type == "inline"
        assert formula.page_number == 3


# ============================================================
# 可用性检测
# ============================================================
class TestMinerUEngineAvailability:
    """测试 MinerU 可用性检测。"""

    def test_is_available_returns_bool(self) -> None:
        """返回值应为布尔类型。"""
        result = MinerUEngine.is_available()
        assert isinstance(result, bool)

    def test_convert_returns_none_when_unavailable(self) -> None:
        """MinerU 不可用时 convert() 应安全返回 None。"""
        engine = MinerUEngine()
        with patch.object(MinerUEngine, "is_available", return_value=False):
            result = engine.convert("/fake/path.pdf")
            assert result is None


# ============================================================
# 配置签名与设备后端
# ============================================================
class TestMinerUEngineConfigKey:
    """验证 MinerU 配置签名和设备后端解析。"""

    def test_default_config_key_includes_backend(self) -> None:
        engine = MinerUEngine()
        key = engine._config_key()
        assert "backend=" in key
        assert "device=" in key

    def test_explicit_backend_overrides(self) -> None:
        """用户显式指定 backend 应覆盖自动检测（合法值透传）。"""
        engine = MinerUEngine(backend="hybrid-auto-engine")
        backend = engine._resolve_device()
        assert backend == "hybrid-auto-engine"

    def test_mps_device_with_mlx_available_picks_vlm_auto(self) -> None:
        """MPS + mlx_vlm 可用 → vlm-auto-engine（MinerU 内部命中 mlx-engine）。"""
        engine = MinerUEngine(device="mps")
        with patch.object(
            MinerUEngine, "_probe_mlx_engine_eligibility", return_value=True
        ):
            backend = engine._resolve_device()
        assert backend == "vlm-auto-engine"

    def test_mps_device_without_mlx_degrades_to_pipeline(self) -> None:
        """MPS 但 mlx_vlm 不满足 → pipeline，避免 vlm-auto-engine 回退 transformers。"""
        engine = MinerUEngine(device="mps")
        with patch.object(
            MinerUEngine, "_probe_mlx_engine_eligibility", return_value=False
        ):
            backend = engine._resolve_device()
        assert backend == "pipeline"

    def test_mps_backend_pref_overrides_probe(self) -> None:
        """settings.mineru_mps_backend != 'auto' 时绕过 mlx 探测直接采用。"""
        engine = MinerUEngine(device="mps")
        with patch.object(
            MinerUEngine, "_read_mps_backend_pref", return_value="pipeline"
        ):
            with patch.object(
                MinerUEngine, "_probe_mlx_engine_eligibility", return_value=True
            ):
                backend = engine._resolve_device()
        assert backend == "pipeline"

    def test_cuda_device_maps_to_pipeline(self) -> None:
        """CUDA 设备应映射到 pipeline 后端。"""
        engine = MinerUEngine(device="cuda")
        backend = engine._resolve_device()
        assert backend == "pipeline"

    def test_cpu_device_maps_to_pipeline(self) -> None:
        """CPU 设备应映射到 pipeline 后端。"""
        engine = MinerUEngine(device="cpu")
        backend = engine._resolve_device()
        assert backend == "pipeline"

    def test_auto_device_detection_apple_with_mlx(self) -> None:
        """auto 设备 + Apple Silicon + mlx_vlm 可用 → vlm-auto-engine。"""
        engine = MinerUEngine(device="auto")
        with patch.object(MinerUEngine, "_is_apple_silicon", return_value=True):
            with patch.object(
                MinerUEngine, "_probe_mlx_engine_eligibility", return_value=True
            ):
                backend = engine._resolve_device()
        assert backend == "vlm-auto-engine"

    def test_auto_device_detection_non_apple(self) -> None:
        """auto 设备 + 非 Apple → pipeline。"""
        engine = MinerUEngine(device="auto")
        with patch.object(MinerUEngine, "_is_apple_silicon", return_value=False):
            backend = engine._resolve_device()
        assert backend == "pipeline"

    def test_is_apple_silicon_returns_bool(self) -> None:
        result = MinerUEngine._is_apple_silicon()
        assert isinstance(result, bool)

    @patch(
        "negentropy.perceives.pdf.engines.mineru.platform.system", return_value="Darwin"
    )
    @patch(
        "negentropy.perceives.pdf.engines.mineru.platform.machine", return_value="arm64"
    )
    def test_apple_silicon_detected(
        self, _mock_machine: object, _mock_system: object
    ) -> None:
        assert MinerUEngine._is_apple_silicon() is True

    @patch(
        "negentropy.perceives.pdf.engines.mineru.platform.system", return_value="Linux"
    )
    @patch(
        "negentropy.perceives.pdf.engines.mineru.platform.machine",
        return_value="x86_64",
    )
    def test_not_apple_silicon(
        self, _mock_machine: object, _mock_system: object
    ) -> None:
        assert MinerUEngine._is_apple_silicon() is False

    def test_different_configs_produce_different_keys(self) -> None:
        e1 = MinerUEngine(device="cpu")
        e2 = MinerUEngine(device="mps")
        assert e1._config_key() != e2._config_key()

    def test_resolved_backend_cached(self) -> None:
        """多次调用 _resolve_device 应返回相同的缓存结果。"""
        engine = MinerUEngine(backend="pipeline")
        first = engine._resolve_device()
        second = engine._resolve_device()
        assert first == second == "pipeline"


# ============================================================
# 输出目录管理
# ============================================================
class TestMinerUOutputDir:
    """验证输出目录自动创建逻辑。"""

    def test_ensure_output_dir_creates_temp(self) -> None:
        """未指定 output_dir 时应自动创建临时目录。"""
        engine = MinerUEngine()
        output_dir = engine._ensure_output_dir()
        assert output_dir.exists()
        assert output_dir.is_dir()

    def test_ensure_output_dir_uses_specified(self, tmp_path: Path) -> None:
        """指定 output_dir 时应使用该目录。"""
        engine = MinerUEngine(output_dir=str(tmp_path / "mineru_out"))
        output_dir = engine._ensure_output_dir()
        assert output_dir == tmp_path / "mineru_out"
        assert output_dir.exists()


# ============================================================
# content_list.json 输出归一化
# ============================================================
class TestMinerUNormalizeOutput:
    """验证 MinerU 输出归一化逻辑。"""

    def _make_content_list(self, tmp_path: Path) -> Path:
        """在输出目录中创建 content_list.json。"""
        content_list = [
            {"type": "text", "text": "Hello world", "page_no": 0},
            {
                "type": "table",
                "markdown": "| A | B |\n|---|---|\n| 1 | 2 |",
                "page_no": 0,
                "bbox": [10.0, 20.0, 300.0, 100.0],
            },
            {
                "type": "equation",
                "latex": r"E = mc^2",
                "format": "block",
                "page_no": 1,
            },
            {
                "type": "image",
                "img_path": "images/fig1.png",
                "text": "Figure 1",
                "page_no": 1,
            },
        ]
        content_list_path = tmp_path / "content_list.json"
        content_list_path.write_text(json.dumps(content_list), encoding="utf-8")
        return content_list_path

    def test_normalize_output_success(self, tmp_path: Path) -> None:
        """正常 content_list.json 应被正确解析。"""
        self._make_content_list(tmp_path)
        engine = MinerUEngine()
        result = engine._normalize_output(tmp_path, str(tmp_path / "test.pdf"))
        assert result is not None
        assert isinstance(result, MinerUConversionResult)
        assert "Hello world" in result.markdown
        assert len(result.tables) == 1
        assert result.tables[0].rows == 2  # header + 1 data row
        assert result.tables[0].columns == 2
        assert len(result.formulas) >= 1
        assert len(result.images) >= 1

    def test_normalize_output_missing_content_list(self, tmp_path: Path) -> None:
        """缺少 content_list.json 时应返回 None。"""
        engine = MinerUEngine()
        result = engine._normalize_output(tmp_path, str(tmp_path / "test.pdf"))
        assert result is None

    def test_normalize_output_invalid_json(self, tmp_path: Path) -> None:
        """无效 JSON 应返回 None。"""
        (tmp_path / "content_list.json").write_text("not json", encoding="utf-8")
        engine = MinerUEngine()
        result = engine._normalize_output(tmp_path, str(tmp_path / "test.pdf"))
        assert result is None

    def test_normalize_output_non_array_json(self, tmp_path: Path) -> None:
        """非数组 JSON 应返回 None。"""
        (tmp_path / "content_list.json").write_text(
            '{"key": "value"}', encoding="utf-8"
        )
        engine = MinerUEngine()
        result = engine._normalize_output(tmp_path, str(tmp_path / "test.pdf"))
        assert result is None


# ============================================================
# Markdown 文件读取
# ============================================================
class TestMinerUMarkdownRead:
    """验证 Markdown 文件读取与 content_list 拼接降级。"""

    def test_read_markdown_from_auto_dir(self, tmp_path: Path) -> None:
        """auto/ 目录下的 .md 文件应被正确读取。"""
        auto_dir = tmp_path / "auto"
        auto_dir.mkdir()
        (auto_dir / "test.md").write_text("# Title\n\nContent", encoding="utf-8")
        engine = MinerUEngine()
        result = engine._read_markdown_output(tmp_path)
        assert "# Title" in result

    def test_read_markdown_recursive(self, tmp_path: Path) -> None:
        """auto/ 不存在时应递归搜索 .md 文件。"""
        sub = tmp_path / "subdir"
        sub.mkdir()
        (sub / "output.md").write_text("Recursive content", encoding="utf-8")
        engine = MinerUEngine()
        result = engine._read_markdown_output(tmp_path)
        assert "Recursive content" in result

    def test_read_markdown_empty_dir(self, tmp_path: Path) -> None:
        """空目录应返回空字符串。"""
        engine = MinerUEngine()
        result = engine._read_markdown_output(tmp_path)
        assert result == ""

    def test_assemble_from_content_list(self) -> None:
        """content_list 拼接应生成 Markdown。"""
        content_list = [
            {"type": "text", "text": "Hello"},
            {"type": "equation", "latex": r"x^2"},
            {"type": "image", "img_path": "fig.png", "text": "Fig"},
            {"type": "table", "markdown": "| A |"},
        ]
        engine = MinerUEngine()
        result = engine._assemble_markdown_from_content_list(content_list)
        assert "Hello" in result
        assert "$$" in result
        assert "fig.png" in result
        assert "| A |" in result


# ============================================================
# 结构化元素提取
# ============================================================
class TestMinerUStructuredExtraction:
    """验证表格、公式、图片、代码块提取。"""

    def test_extract_tables(self) -> None:
        content_list = [
            {
                "type": "table",
                "markdown": "| A | B |\n|---|---|\n| 1 | 2 |",
                "page_no": 0,
                "text": "Table caption",
            },
        ]
        engine = MinerUEngine()
        tables = engine._extract_tables(content_list)
        assert len(tables) == 1
        assert tables[0].rows == 2  # header + 1 data row
        assert tables[0].columns == 2
        assert tables[0].caption == "Table caption"
        assert tables[0].page_number == 0

    def test_extract_tables_html_fallback(self) -> None:
        content_list = [
            {
                "type": "table",
                "html": "<table><tr><td>A</td><td>B</td></tr></table>",
                "page_no": 1,
            },
        ]
        engine = MinerUEngine()
        tables = engine._extract_tables(content_list)
        assert len(tables) == 1
        assert tables[0].html is not None

    def test_extract_formulas_from_content_list(self) -> None:
        content_list = [
            {
                "type": "equation",
                "latex": r"\sum_i x_i",
                "format": "block",
                "page_no": 0,
            },
            {"type": "equation", "latex": r"\alpha", "format": "inline", "page_no": 0},
        ]
        engine = MinerUEngine()
        formulas = engine._extract_formulas(content_list, "")
        assert len(formulas) >= 2
        block_formulas = [f for f in formulas if f.formula_type == "block"]
        inline_formulas = [f for f in formulas if f.formula_type == "inline"]
        assert len(block_formulas) >= 1
        assert len(inline_formulas) >= 1

    def test_extract_formulas_from_markdown(self) -> None:
        md = r"Inline $x^2$ and block: $$E = mc^2$$"
        engine = MinerUEngine()
        formulas = engine._extract_formulas([], md)
        assert len(formulas) == 2

    def test_extract_formulas_deduplication(self) -> None:
        """content_list 和 Markdown 中的相同公式应去重。"""
        content_list = [
            {"type": "equation", "latex": r"E=mc^2", "format": "block", "page_no": 0},
        ]
        md = r"$$E=mc^2$$"
        engine = MinerUEngine()
        formulas = engine._extract_formulas(content_list, md)
        latex_values = [f.latex for f in formulas]
        assert latex_values.count("E=mc^2") == 1

    def test_extract_images(self, tmp_path: Path) -> None:
        content_list = [
            {
                "type": "image",
                "img_path": "images/fig1.png",
                "text": "Figure 1",
                "page_no": 0,
                "bbox": [10, 20, 100, 200],
            },
        ]
        engine = MinerUEngine()
        images = engine._extract_images(content_list, tmp_path)
        assert len(images) == 1
        assert images[0].caption == "Figure 1"
        assert images[0].page_number == 0
        assert images[0].filename == "fig1.png"

    def test_extract_images_empty_list(self, tmp_path: Path) -> None:
        engine = MinerUEngine()
        images = engine._extract_images([], tmp_path)
        assert images == []

    def test_extract_code_blocks_always_empty(self) -> None:
        """MinerU 不支持代码块检测，始终返回空列表。"""
        engine = MinerUEngine()
        assert engine._extract_code_blocks([{"type": "text"}]) == []
        assert engine._extract_code_blocks([]) == []

    def test_extract_metadata(self, tmp_path: Path) -> None:
        """元数据应包含 source、filename 等字段。"""
        pdf_path = str(tmp_path / "test.pdf")
        # 创建测试 PDF 文件
        Path(pdf_path).write_bytes(b"%PDF-1.4 fake")
        content_list = [
            {"type": "text", "text": "Hello", "page_no": 0},
            {"type": "text", "text": "World", "page_no": 3},
        ]
        engine = MinerUEngine()
        meta = engine._extract_metadata(content_list, pdf_path)
        assert meta["source"] == "mineru"
        assert meta["filename"] == "test.pdf"
        assert meta["first_page"] == 0
        assert meta["last_page"] == 3
        assert meta["file_size"] > 0

    def test_extract_page_count(self) -> None:
        content_list = [
            {"type": "text", "page_no": 0},
            {"type": "text", "page_no": 4},
        ]
        engine = MinerUEngine()
        count = engine._extract_page_count(content_list)
        assert count == 5  # max(0, 4) + 1

    def test_extract_page_count_empty(self) -> None:
        engine = MinerUEngine()
        assert engine._extract_page_count([]) == 0


# ============================================================
# bbox 提取
# ============================================================
class TestMinerUBbox:
    """验证 bbox 提取逻辑。"""

    def test_list_bbox(self) -> None:
        item = {"bbox": [10.0, 20.0, 300.0, 100.0]}
        result = MinerUEngine._extract_bbox_from_item(item)
        assert result == (10.0, 20.0, 300.0, 100.0)

    def test_dict_bbox(self) -> None:
        item = {"bbox": {"x0": 1, "y0": 2, "x1": 3, "y1": 4}}
        result = MinerUEngine._extract_bbox_from_item(item)
        assert result == (1.0, 2.0, 3.0, 4.0)

    def test_dict_bbox_alt_keys(self) -> None:
        item = {"bbox": {"left": 5, "top": 10, "right": 50, "bottom": 100}}
        result = MinerUEngine._extract_bbox_from_item(item)
        assert result == (5.0, 10.0, 50.0, 100.0)

    def test_no_bbox(self) -> None:
        assert MinerUEngine._extract_bbox_from_item({}) is None

    def test_invalid_bbox(self) -> None:
        assert MinerUEngine._extract_bbox_from_item({"bbox": "invalid"}) is None


# ============================================================
# 表格维度解析
# ============================================================
class TestMinerUTableDimensions:
    """验证 Markdown / HTML 表格维度解析。"""

    def test_markdown_table_dimensions(self) -> None:
        content = "| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |"
        engine = MinerUEngine()
        rows, cols = engine._parse_table_dimensions(content)
        assert rows == 3  # header + 2 data rows
        assert cols == 2

    def test_html_table_dimensions(self) -> None:
        content = (
            "<table><tr><td>A</td><td>B</td></tr><tr><td>1</td><td>2</td></tr></table>"
        )
        engine = MinerUEngine()
        rows, cols = engine._parse_table_dimensions(content, is_html=True)
        assert rows == 2
        assert cols == 2  # 4 cells / 2 rows = 2 cols


# ============================================================
# convert() 转换流程（mock）
# ============================================================
class TestMinerUEngineConvert:
    """验证 convert() 的 Python API / CLI 降级流程。"""

    def test_convert_returns_none_when_unavailable(self) -> None:
        engine = MinerUEngine()
        with patch.object(MinerUEngine, "is_available", return_value=False):
            assert engine.convert("/fake/path.pdf") is None

    def test_convert_via_python_api_success(self, tmp_path: Path) -> None:
        """Python API 成功时应直接返回结果。"""
        engine = MinerUEngine(output_dir=str(tmp_path))

        # 创建 content_list.json 以让 _normalize_output 成功
        content_list = [
            {"type": "text", "text": "Hello from API", "page_no": 0},
        ]
        (tmp_path / "content_list.json").write_text(
            json.dumps(content_list), encoding="utf-8"
        )

        mock_result = MinerUConversionResult(markdown="Hello from API", page_count=1)

        with (
            patch.object(MinerUEngine, "is_available", return_value=True),
            patch.object(engine, "_convert_via_python_api", return_value=mock_result),
        ):
            result = engine.convert(str(tmp_path / "test.pdf"))
            assert result is not None
            assert result.markdown == "Hello from API"

    def test_convert_fallback_to_cli(self, tmp_path: Path) -> None:
        """Python API 返回 None 时应降级到 CLI。"""
        engine = MinerUEngine(output_dir=str(tmp_path))

        cli_result = MinerUConversionResult(markdown="CLI output", page_count=1)

        with (
            patch.object(MinerUEngine, "is_available", return_value=True),
            patch.object(engine, "_convert_via_python_api", return_value=None),
            patch.object(engine, "_convert_via_cli", return_value=cli_result),
        ):
            result = engine.convert(str(tmp_path / "test.pdf"))
            assert result is not None
            assert result.markdown == "CLI output"

    def test_convert_both_fail(self, tmp_path: Path) -> None:
        """Python API 和 CLI 都失败时应返回 None。"""
        engine = MinerUEngine(output_dir=str(tmp_path))

        with (
            patch.object(MinerUEngine, "is_available", return_value=True),
            patch.object(engine, "_convert_via_python_api", return_value=None),
            patch.object(engine, "_convert_via_cli", return_value=None),
        ):
            result = engine.convert(str(tmp_path / "test.pdf"))
            assert result is None


# ============================================================
# PDFProcessor MinerU/Marker 方法调度
# ============================================================
class TestPDFProcessorMinerUIntegration:
    """验证 PDFProcessor 的 mineru/marker 调度逻辑。"""

    def test_supported_methods_includes_mineru(self) -> None:
        """supported_methods 应包含 'mineru'。"""
        from negentropy.perceives.pdf.processor import PDFProcessor

        proc = PDFProcessor(enable_enhanced_features=False)
        assert "mineru" in proc.supported_methods
        proc.cleanup()

    def test_supported_methods_includes_marker(self) -> None:
        """supported_methods 应包含 'marker'。"""
        from negentropy.perceives.pdf.processor import PDFProcessor

        proc = PDFProcessor(enable_enhanced_features=False)
        assert "marker" in proc.supported_methods
        proc.cleanup()

    @pytest.mark.asyncio
    async def test_mineru_method_unavailable_returns_error(self) -> None:
        """mineru 方法在引擎不可用时应返回错误。"""
        from negentropy.perceives.pdf.processor import PDFProcessor

        proc = PDFProcessor(enable_enhanced_features=False, prefer_docling=False)
        try:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
                f.write(b"%PDF-1.4 fake")
                pdf_path = f.name

            with patch(
                "negentropy.perceives.pdf.engines.mineru.MinerUEngine.is_available",
                return_value=False,
            ):
                result = await proc.process_pdf(pdf_path, method="mineru")
                assert result["success"] is False
        finally:
            proc.cleanup()
            Path(pdf_path).unlink(missing_ok=True)

    @pytest.mark.asyncio
    async def test_marker_method_unavailable_returns_error(self) -> None:
        """marker 方法在引擎不可用时应返回错误。"""
        from negentropy.perceives.pdf.processor import PDFProcessor

        proc = PDFProcessor(enable_enhanced_features=False, prefer_docling=False)
        try:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
                f.write(b"%PDF-1.4 fake")
                pdf_path = f.name

            with patch(
                "negentropy.perceives.pdf.marker_engine.MarkerEngine.is_available",
                return_value=False,
            ):
                result = await proc.process_pdf(pdf_path, method="marker")
                assert result["success"] is False
        finally:
            proc.cleanup()
            Path(pdf_path).unlink(missing_ok=True)


# ============================================================
# 缓存管理
# ============================================================
class TestMinerUEngineCacheManagement:
    """测试 converter 缓存管理。"""

    def test_reset_cache(self) -> None:
        MinerUEngine._converters["test_key"] = "dummy"
        MinerUEngine.reset_cache()
        assert len(MinerUEngine._converters) == 0
