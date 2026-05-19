"""Marker engine unit tests.

测试策略：
- 当 Marker 未安装时：验证 is_available() 返回 False，convert() 返回 None
- 当 Marker 已安装时：使用 mock 验证 PdfConverter 调用和转换流程
- 数据类完整性验证
- TORCH_DEVICE 强制 CPU 设置
- 结构化元素提取（表格、公式、图片、代码块）
- LLM 增强模式降级
"""

import os
from pathlib import Path
from unittest.mock import MagicMock, patch


from negentropy.perceives.pdf.marker_engine import (
    MarkerCodeBlock,
    MarkerConversionResult,
    MarkerEngine,
    MarkerFormula,
    MarkerImage,
    MarkerTable,
)


# ============================================================
# 数据类完整性
# ============================================================
class TestMarkerDataClasses:
    """验证 Marker 标准化数据类的字段与默认值。"""

    def test_conversion_result_defaults(self) -> None:
        result = MarkerConversionResult(markdown="# Test")
        assert result.markdown == "# Test"
        assert result.tables == []
        assert result.images == []
        assert result.formulas == []
        assert result.code_blocks == []
        assert result.metadata == {}
        assert result.page_count == 0

    def test_conversion_result_full(self) -> None:
        result = MarkerConversionResult(
            markdown="# Full",
            tables=[MarkerTable(markdown="| A |", rows=1, columns=1)],
            images=[MarkerImage(page_number=0, caption="Fig 1")],
            formulas=[MarkerFormula(latex=r"\alpha", formula_type="inline")],
            code_blocks=[MarkerCodeBlock(code="print(1)", language="python")],
            metadata={"title": "Test Doc"},
            page_count=5,
        )
        assert result.page_count == 5
        assert len(result.tables) == 1
        assert len(result.images) == 1
        assert len(result.formulas) == 1
        assert len(result.code_blocks) == 1

    def test_marker_table_defaults(self) -> None:
        table = MarkerTable(markdown="| A | B |")
        assert table.rows == 0
        assert table.columns == 0
        assert table.page_number is None
        assert table.caption is None

    def test_marker_image_defaults(self) -> None:
        img = MarkerImage()
        assert img.page_number is None
        assert img.caption is None
        assert img.filename is None
        assert img.local_path is None
        assert img.width is None
        assert img.height is None
        assert img.mime_type == "image/png"
        assert img.base64_data is None

    def test_marker_image_with_all_fields(self) -> None:
        img = MarkerImage(
            page_number=1,
            caption="Figure 1",
            filename="img_p1_0.png",
            local_path="/tmp/img_p1_0.png",
            width=800,
            height=600,
            base64_data="abc123",
        )
        assert img.filename == "img_p1_0.png"
        assert img.local_path == "/tmp/img_p1_0.png"
        assert img.width == 800
        assert img.height == 600
        assert img.base64_data == "abc123"

    def test_marker_formula_defaults(self) -> None:
        formula = MarkerFormula(latex=r"\sum")
        assert formula.formula_type == "block"
        assert formula.page_number is None
        assert formula.original_text == ""

    def test_marker_code_block_defaults(self) -> None:
        cb = MarkerCodeBlock(code="x = 1")
        assert cb.language is None
        assert cb.page_number is None


# ============================================================
# 可用性检测
# ============================================================
class TestMarkerEngineAvailability:
    """测试 Marker 可用性检测。"""

    def test_is_available_returns_bool(self) -> None:
        """返回值应为布尔类型。"""
        result = MarkerEngine.is_available()
        assert isinstance(result, bool)

    def test_convert_returns_none_when_unavailable(self) -> None:
        """Marker 不可用时 convert() 应安全返回 None。"""
        engine = MarkerEngine()
        with patch.object(MarkerEngine, "is_available", return_value=False):
            result = engine.convert("/fake/path.pdf")
            assert result is None

    def test_is_available_checks_marker_pdf_first(self) -> None:
        """应优先检测 marker_pdf 包。"""
        with patch.dict("sys.modules", {"marker_pdf": MagicMock()}):
            assert MarkerEngine.is_available() is True

    def test_is_available_fallback_to_marker(self) -> None:
        """marker_pdf 不可用时应回退检测 marker 包。"""
        import builtins

        original_import = builtins.__import__

        def mock_import(name, *args, **kwargs):
            if name == "marker_pdf":
                raise ImportError("no marker_pdf")
            if name == "marker":
                return MagicMock()
            return original_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=mock_import):
            assert MarkerEngine.is_available() is True

    def test_is_available_false_when_neither_installed(self) -> None:
        """两个包都不可用时应返回 False。"""
        import builtins

        original_import = builtins.__import__

        def mock_import(name, *args, **kwargs):
            if name in ("marker_pdf", "marker"):
                raise ImportError("not installed")
            return original_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=mock_import):
            assert MarkerEngine.is_available() is False


# ============================================================
# TORCH_DEVICE 强制 CPU
# ============================================================
class TestMarkerTorchDevice:
    """验证 TORCH_DEVICE 环境变量强制设置。"""

    def test_ensure_cpu_device_sets_env(self) -> None:
        """_ensure_cpu_device 应设置 TORCH_DEVICE=cpu。"""
        # 重置状态
        MarkerEngine._torch_device_set = False
        old_value = os.environ.pop("TORCH_DEVICE", None)
        try:
            MarkerEngine._ensure_cpu_device()
            assert os.environ.get("TORCH_DEVICE") == "cpu"
        finally:
            MarkerEngine._torch_device_set = False
            if old_value is not None:
                os.environ["TORCH_DEVICE"] = old_value
            else:
                os.environ.pop("TORCH_DEVICE", None)

    def test_ensure_cpu_device_only_sets_once(self) -> None:
        """同设备多次调用幂等：第二次不再覆写已被外部修改的 env。"""
        MarkerEngine._torch_device_set = False
        MarkerEngine._last_torch_device_value = None
        os.environ.pop("TORCH_DEVICE", None)
        try:
            MarkerEngine._ensure_cpu_device()
            os.environ["TORCH_DEVICE"] = "cuda"  # 外部修改
            MarkerEngine._ensure_cpu_device()  # 同 target=cpu，不应覆写
            assert os.environ.get("TORCH_DEVICE") == "cuda"
        finally:
            MarkerEngine._torch_device_set = False
            MarkerEngine._last_torch_device_value = None
            os.environ.pop("TORCH_DEVICE", None)

    def test_ensure_torch_device_mps_opt_in(self) -> None:
        """device='mps' 应透传到 TORCH_DEVICE 环境变量。"""
        MarkerEngine._torch_device_set = False
        MarkerEngine._last_torch_device_value = None
        os.environ.pop("TORCH_DEVICE", None)
        try:
            MarkerEngine._ensure_torch_device("mps")
            assert os.environ.get("TORCH_DEVICE") == "mps"
        finally:
            MarkerEngine._torch_device_set = False
            MarkerEngine._last_torch_device_value = None
            os.environ.pop("TORCH_DEVICE", None)

    def test_ensure_torch_device_inference_ram(self) -> None:
        """inference_ram_gb > 0 应写入 INFERENCE_RAM。"""
        MarkerEngine._torch_device_set = False
        MarkerEngine._last_torch_device_value = None
        os.environ.pop("INFERENCE_RAM", None)
        os.environ.pop("TORCH_DEVICE", None)
        try:
            MarkerEngine._ensure_torch_device("mps", inference_ram_gb=18)
            assert os.environ.get("INFERENCE_RAM") == "18"
        finally:
            MarkerEngine._torch_device_set = False
            MarkerEngine._last_torch_device_value = None
            os.environ.pop("INFERENCE_RAM", None)
            os.environ.pop("TORCH_DEVICE", None)

    def test_ensure_torch_device_num_workers(self) -> None:
        """num_workers > 0 应写入 NUM_WORKERS。"""
        MarkerEngine._torch_device_set = False
        MarkerEngine._last_torch_device_value = None
        os.environ.pop("NUM_WORKERS", None)
        try:
            MarkerEngine._ensure_torch_device("mps", num_workers=4)
            assert os.environ.get("NUM_WORKERS") == "4"
        finally:
            MarkerEngine._torch_device_set = False
            MarkerEngine._last_torch_device_value = None
            os.environ.pop("NUM_WORKERS", None)
            os.environ.pop("TORCH_DEVICE", None)

    def test_ensure_torch_device_zero_inference_ram_skipped(self) -> None:
        """inference_ram_gb=0 不应写入 INFERENCE_RAM。"""
        MarkerEngine._torch_device_set = False
        MarkerEngine._last_torch_device_value = None
        os.environ.pop("INFERENCE_RAM", None)
        try:
            MarkerEngine._ensure_torch_device("mps", inference_ram_gb=0)
            assert "INFERENCE_RAM" not in os.environ
        finally:
            MarkerEngine._torch_device_set = False
            MarkerEngine._last_torch_device_value = None
            os.environ.pop("TORCH_DEVICE", None)

    def test_config_key_includes_device_dimensions(self) -> None:
        """缓存键应覆盖 device / inference_ram / num_workers / half_precision 维度。"""
        e1 = MarkerEngine()
        e2 = MarkerEngine(device="mps")
        e3 = MarkerEngine(device="mps", half_precision=True)
        e4 = MarkerEngine(device="mps", inference_ram_gb=16)
        keys = {e1._config_key(), e2._config_key(), e3._config_key(), e4._config_key()}
        # 四种配置应产出不同缓存键
        assert len(keys) == 4


# ============================================================
# 配置签名
# ============================================================
class TestMarkerEngineConfigKey:
    """验证 Marker 配置签名生成。"""

    def test_default_config_key(self) -> None:
        engine = MarkerEngine()
        key = engine._config_key()
        assert "llm=False" in key

    def test_llm_enhanced_config_key(self) -> None:
        engine = MarkerEngine(llm_enhanced=True)
        key = engine._config_key()
        assert "llm=True" in key

    def test_different_configs_produce_different_keys(self) -> None:
        e1 = MarkerEngine(llm_enhanced=False)
        e2 = MarkerEngine(llm_enhanced=True)
        assert e1._config_key() != e2._config_key()


# ============================================================
# 结构化元素提取
# ============================================================
class TestMarkerStructuredExtraction:
    """验证表格、公式、代码块提取。"""

    def test_extract_tables(self) -> None:
        md = "# Title\n\n| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\n"
        engine = MarkerEngine()
        mock_rendered = MagicMock()
        mock_rendered.children = []
        tables = engine._extract_tables(mock_rendered, md)
        assert len(tables) == 1
        assert tables[0].rows == 2  # 2 data rows (header + separator excluded)
        assert tables[0].columns == 2

    def test_extract_tables_empty(self) -> None:
        engine = MarkerEngine()
        mock_rendered = MagicMock()
        mock_rendered.children = []
        tables = engine._extract_tables(mock_rendered, "No tables here")
        assert tables == []

    def test_extract_formulas(self) -> None:
        md = r"Inline $x^2$ and block:\n$$E = mc^2$$"
        engine = MarkerEngine()
        formulas = engine._extract_formulas(md)
        block = [f for f in formulas if f.formula_type == "block"]
        inline = [f for f in formulas if f.formula_type == "inline"]
        assert len(block) == 1
        assert len(inline) == 1

    def test_extract_code_blocks(self) -> None:
        md = "```python\nprint('hello')\n```\n\n```js\nconsole.log('hi')\n```"
        engine = MarkerEngine()
        code_blocks = engine._extract_code_blocks(md)
        assert len(code_blocks) == 2
        assert code_blocks[0].language == "python"
        assert "print('hello')" in code_blocks[0].code

    def test_extract_code_blocks_empty(self) -> None:
        engine = MarkerEngine()
        code_blocks = engine._extract_code_blocks("No code here")
        assert code_blocks == []

    def test_extract_images_with_pil(self, tmp_path: Path) -> None:
        """应从 PIL Image 字典中提取图片并保存到磁盘。"""
        from PIL import Image

        pil_image = Image.new("RGB", (100, 50), "red")
        images_dict = {"fig1": pil_image}

        engine = MarkerEngine(output_dir=str(tmp_path))
        images = engine._extract_images(images_dict)
        assert len(images) == 1
        assert images[0].width == 100
        assert images[0].height == 50
        assert images[0].filename is not None
        assert images[0].local_path is not None

    def test_extract_images_empty(self) -> None:
        engine = MarkerEngine()
        images = engine._extract_images({})
        assert images == []

    def test_extract_images_none_input(self) -> None:
        engine = MarkerEngine()
        images = engine._extract_images(None)
        assert images == []


# ============================================================
# 辅助方法
# ============================================================
class TestMarkerHelpers:
    """验证 Marker 辅助方法。"""

    def test_extract_metadata_with_dict(self) -> None:
        mock_rendered = MagicMock()
        mock_rendered.metadata = {"title": "Test", "author": "Author"}
        engine = MarkerEngine()
        meta = engine._extract_metadata(mock_rendered)
        assert meta["title"] == "Test"
        assert meta["author"] == "Author"
        assert meta["engine"] == "marker"

    def test_extract_metadata_no_metadata(self) -> None:
        mock_rendered = MagicMock(spec=[])
        engine = MarkerEngine()
        meta = engine._extract_metadata(mock_rendered)
        assert meta["engine"] == "marker"

    def test_extract_page_count_from_metadata(self) -> None:
        mock_rendered = MagicMock()
        mock_rendered.metadata = {"pages": 10}
        engine = MarkerEngine()
        assert engine._extract_page_count(mock_rendered) == 10

    def test_extract_page_count_from_children(self) -> None:
        mock_block = MagicMock()
        mock_block.page = 5
        mock_rendered = MagicMock()
        mock_rendered.metadata = {}
        mock_rendered.children = [mock_block]
        engine = MarkerEngine()
        assert engine._extract_page_count(mock_rendered) == 5

    def test_extract_page_count_default_zero(self) -> None:
        mock_rendered = MagicMock(spec=[])
        engine = MarkerEngine()
        assert engine._extract_page_count(mock_rendered) == 0

    def test_get_block_page_number_from_page(self) -> None:
        mock_block = MagicMock()
        mock_block.page = 3
        assert MarkerEngine._get_block_page_number(mock_block) == 3

    def test_get_block_page_number_from_polygon(self) -> None:
        mock_block = MagicMock(spec=["polygon"])
        mock_block.page = None
        mock_block.polygon = MagicMock()
        mock_block.polygon.page = 7
        assert MarkerEngine._get_block_page_number(mock_block) == 7

    def test_get_block_page_number_none(self) -> None:
        mock_block = MagicMock(spec=[])
        assert MarkerEngine._get_block_page_number(mock_block) is None

    def test_get_block_caption_direct(self) -> None:
        mock_block = MagicMock()
        mock_block.caption = "Table 1: Results"
        assert MarkerEngine._get_block_caption(mock_block) == "Table 1: Results"

    def test_get_block_caption_from_html(self) -> None:
        mock_block = MagicMock(spec=["html"])
        mock_block.caption = None
        mock_block.html = "<table><caption>Fig Caption</caption></table>"
        assert MarkerEngine._get_block_caption(mock_block) == "Fig Caption"

    def test_get_block_caption_none(self) -> None:
        mock_block = MagicMock(spec=[])
        assert MarkerEngine._get_block_caption(mock_block) is None

    def test_embed_images_in_markdown(self) -> None:
        md = "![alt](img.png)"
        images = [
            MarkerImage(
                filename="img.png",
                base64_data="dGVzdA==",
                mime_type="image/png",
            )
        ]
        result = MarkerEngine._embed_images_in_markdown(md, images)
        assert "data:image/png;base64,dGVzdA==" in result


# ============================================================
# convert() 转换流程（mock）
# ============================================================
class TestMarkerEngineConvert:
    """验证 convert() 的完整转换流程。"""

    def test_convert_returns_none_when_unavailable(self) -> None:
        engine = MarkerEngine()
        with patch.object(MarkerEngine, "is_available", return_value=False):
            assert engine.convert("/fake/path.pdf") is None

    def test_convert_success(self, tmp_path: Path) -> None:
        """Mock 成功转换应返回 MarkerConversionResult。"""
        engine = MarkerEngine(output_dir=str(tmp_path))

        mock_rendered = MagicMock()
        mock_rendered.markdown = "# Test Document\n\nContent here."
        mock_rendered.metadata = {"pages": 2}
        mock_rendered.children = []

        mock_tfr = MagicMock(return_value=("# Test Document\n\nContent here.", {}, {}))

        with (
            patch.object(MarkerEngine, "is_available", return_value=True),
            patch.object(engine, "_get_converter") as mock_get_converter,
            patch(
                "negentropy.perceives.pdf.math_formula.DoclingFormulaEnricher.postprocess_latex",
                side_effect=lambda x: x,
            ),
            patch.dict(
                "sys.modules", {"marker.output": MagicMock(text_from_rendered=mock_tfr)}
            ),
            patch(
                "negentropy.perceives.markdown.image_ref_normalizer.normalize_image_references",
                side_effect=lambda md, imgs, **kw: md,
            ),
        ):
            # Mock converter
            mock_converter = MagicMock()
            mock_converter.return_value = mock_rendered
            mock_get_converter.return_value = mock_converter

            result = engine.convert(str(tmp_path / "test.pdf"))
            assert result is not None
            assert isinstance(result, MarkerConversionResult)
            assert "Test Document" in result.markdown

    def test_convert_failure_returns_none(self, tmp_path: Path) -> None:
        """转换异常时应返回 None。"""
        engine = MarkerEngine(output_dir=str(tmp_path))

        with patch.object(MarkerEngine, "is_available", return_value=True):
            with patch.object(
                engine, "_get_converter", side_effect=RuntimeError("model error")
            ):
                result = engine.convert(str(tmp_path / "test.pdf"))
                assert result is None


# ============================================================
# 缓存管理
# ============================================================
class TestMarkerEngineCacheManagement:
    """测试 converter 缓存管理。"""

    def test_reset_cache(self) -> None:
        MarkerEngine._converters["test_key"] = "dummy"
        MarkerEngine.reset_cache()
        assert len(MarkerEngine._converters) == 0
