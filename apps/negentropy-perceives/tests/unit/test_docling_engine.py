"""Docling 引擎封装模块的单元测试。

测试策略：
- 当 Docling 未安装时：验证 is_available() 返回 False，convert() 返回 None
- 当 Docling 已安装时：使用 mock 验证 pipeline 配置和转换流程
- 数据类完整性验证
- 图片保存到磁盘验证
- Caption 提取多层降级验证
"""

import logging
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from negentropy.perceives.pdf.docling_engine import (
    DoclingCodeBlock,
    DoclingConversionResult,
    DoclingEngine,
    DoclingFormula,
    DoclingImage,
    DoclingTable,
)


# ============================================================
# 数据类完整性
# ============================================================
class TestDoclingDataClasses:
    """验证标准化数据类的字段与默认值。"""

    def test_conversion_result_defaults(self) -> None:
        result = DoclingConversionResult(markdown="# Test")
        assert result.markdown == "# Test"
        assert result.tables == []
        assert result.images == []
        assert result.formulas == []
        assert result.code_blocks == []
        assert result.metadata == {}
        assert result.page_count == 0

    def test_conversion_result_full(self) -> None:
        result = DoclingConversionResult(
            markdown="# Full",
            tables=[DoclingTable(markdown="| A |", rows=1, columns=1)],
            images=[DoclingImage(page_number=0, caption="Fig 1")],
            formulas=[DoclingFormula(latex=r"\alpha", formula_type="inline")],
            code_blocks=[DoclingCodeBlock(code="print(1)", language="python")],
            metadata={"title": "Test Doc"},
            page_count=5,
        )
        assert result.page_count == 5
        assert len(result.tables) == 1
        assert len(result.images) == 1
        assert len(result.formulas) == 1
        assert len(result.code_blocks) == 1

    def test_docling_table_defaults(self) -> None:
        table = DoclingTable(markdown="| A | B |")
        assert table.rows == 0
        assert table.columns == 0
        assert table.page_number is None
        assert table.caption is None

    def test_docling_image_defaults(self) -> None:
        img = DoclingImage()
        assert img.page_number is None
        assert img.caption is None
        assert img.classification is None

    def test_docling_image_extended_fields_defaults(self) -> None:
        """验证 DoclingImage 新增字段的默认值。"""
        img = DoclingImage()
        assert img.filename is None
        assert img.local_path is None
        assert img.width is None
        assert img.height is None
        assert img.mime_type == "image/png"
        assert img.base64_data is None

    def test_docling_image_with_extended_fields(self) -> None:
        """验证 DoclingImage 新增字段可正常赋值。"""
        img = DoclingImage(
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

    def test_docling_formula_defaults(self) -> None:
        formula = DoclingFormula(latex=r"\sum")
        assert formula.formula_type == "block"
        assert formula.page_number is None

    def test_docling_code_block_defaults(self) -> None:
        cb = DoclingCodeBlock(code="x = 1")
        assert cb.language is None
        assert cb.page_number is None


# ============================================================
# 可用性检测
# ============================================================
class TestDoclingEngineAvailability:
    """测试 Docling 可用性检测。"""

    def test_is_available_returns_bool(self) -> None:
        """返回值应为布尔类型。"""
        result = DoclingEngine.is_available()
        assert isinstance(result, bool)

    def test_convert_returns_none_when_unavailable(self) -> None:
        """Docling 不可用时 convert() 应安全返回 None。"""
        engine = DoclingEngine()
        with patch.object(DoclingEngine, "is_available", return_value=False):
            result = engine.convert("/fake/path.pdf")
            assert result is None


# ============================================================
# 配置签名
# ============================================================
class TestDoclingEngineConfigKey:
    """验证配置签名生成。"""

    @patch(
        "negentropy.perceives.pdf.hardware.device_config.get_device_for_docling",
        return_value="cpu",
    )
    def test_default_config_key(self, _mock: object) -> None:
        engine = DoclingEngine(device="cpu")
        key = engine._config_key()
        assert "tbl=True:accurate" in key
        assert "code=True" in key
        assert "formula=True" in key
        assert "dev=cpu" in key

    @patch(
        "negentropy.perceives.pdf.hardware.device_config.get_device_for_docling",
        return_value="cpu",
    )
    def test_custom_config_key(self, _mock: object) -> None:
        engine = DoclingEngine(
            enable_table_structure=False,
            table_mode="fast",
            enable_code_enrichment=False,
            device="cpu",
        )
        key = engine._config_key()
        assert "tbl=False:fast" in key
        assert "code=False" in key

    @patch(
        "negentropy.perceives.pdf.hardware.device_config.get_device_for_docling",
        return_value="cpu",
    )
    def test_different_configs_produce_different_keys(self, _mock: object) -> None:
        e1 = DoclingEngine(table_mode="accurate", device="cpu")
        e2 = DoclingEngine(table_mode="fast", device="cpu")
        assert e1._config_key() != e2._config_key()

    @patch(
        "negentropy.perceives.pdf.hardware.device_config.get_device_for_docling",
        return_value="cpu",
    )
    def test_config_key_includes_device(self, _mock: object) -> None:
        """配置签名应包含设备信息。"""
        engine = DoclingEngine(device="cpu")
        key = engine._config_key()
        assert "dev=cpu" in key
        assert "threads=" in key

    @patch(
        "negentropy.perceives.pdf.hardware.device_config.get_device_for_docling",
        side_effect=lambda d: d if d and d != "auto" else "cpu",
    )
    def test_different_devices_produce_different_cache_keys(
        self, _mock: object
    ) -> None:
        """不同设备的引擎应产生不同缓存键。"""
        e_cpu = DoclingEngine(device="cpu")
        e_mps = DoclingEngine(device="mps")
        assert e_cpu._config_key() != e_mps._config_key()


# ============================================================
# Apple Silicon MPS code/formula enrichment 策略
# ============================================================
class TestDoclingMpsEnrichmentPolicy:
    """验证 MPS 下 Docling code/formula 子模型不再静默回 CPU。"""

    def test_mps_granite_mlx_restores_formula_enrichment(self) -> None:
        """MPS + mlx_vlm 可用时 device_config 层已保留 formula enrichment。"""
        fake_cfg = SimpleNamespace(
            device="mps",
            do_formula_enrichment=True,
            adjustments={
                "formula_enrichment": (
                    "MPS + mlx_vlm 可用，formula enrichment 保留；"
                    "将由 DoclingEngine 使用 granite_docling + MLX 承载"
                ),
            },
            cache_key_segment="dev=mps",
            ocr_batch_size=8,
            layout_batch_size=8,
            table_batch_size=4,
        )
        engine = DoclingEngine(device="mps", enable_formula_enrichment=True)

        with (
            patch(
                "negentropy.perceives.pdf.hardware.device_config.resolve_device_config",
                return_value=fake_cfg,
            ),
        ):
            cfg = engine._resolve_device_config()

        assert cfg.do_formula_enrichment is True
        assert engine._enable_formula_enrichment is True
        assert "mlx_vlm" in cfg.adjustments["formula_enrichment"]

    def test_mps_granite_mlx_without_mlx_vlm_keeps_disabled(self) -> None:
        """device_config 层 mlx_vlm 不可用时已禁用，engine 层保持禁用状态。"""
        fake_cfg = SimpleNamespace(
            device="mps",
            do_formula_enrichment=False,
            adjustments={
                "formula_enrichment": (
                    "MPS 与 formula enrichment 不兼容且 mlx_vlm 未安装，"
                    "已禁用以保持 GPU 加速"
                ),
            },
            cache_key_segment="dev=mps",
            ocr_batch_size=8,
            layout_batch_size=8,
            table_batch_size=4,
        )
        engine = DoclingEngine(device="mps", enable_formula_enrichment=True)

        with (
            patch(
                "negentropy.perceives.pdf.hardware.device_config.resolve_device_config",
                return_value=fake_cfg,
            ),
        ):
            cfg = engine._resolve_device_config()

        assert cfg.do_formula_enrichment is False
        assert engine._enable_formula_enrichment is False
        assert "mlx_vlm" in cfg.adjustments["formula_enrichment"]

    def test_mps_disable_policy_turns_off_code_formula(self) -> None:
        """disable 策略应关闭 Docling code/formula enrichment。"""
        engine = DoclingEngine(device="mps")
        pipeline_options = MagicMock()
        pipeline_options.do_code_enrichment = True
        pipeline_options.do_formula_enrichment = True

        with patch.object(engine, "_mps_enrichment_policy", return_value="disable"):
            preset, runtime = engine._configure_mps_code_formula_options(
                pipeline_options
            )

        assert (preset, runtime) == ("disabled", "none")
        assert pipeline_options.do_code_enrichment is False
        assert pipeline_options.do_formula_enrichment is False

    def test_mps_granite_mlx_requires_mlx_vlm(self) -> None:
        """缺少 mlx-vlm 时应优雅禁用 code/formula enrichment 而非硬失败。"""
        engine = DoclingEngine(device="mps")
        pipeline_options = MagicMock()

        with (
            patch.object(engine, "_mps_enrichment_policy", return_value="granite_mlx"),
            patch(
                "negentropy.perceives.pdf.engines.docling.find_spec",
                return_value=None,
            ),
        ):
            preset, engine_name = engine._configure_mps_code_formula_options(
                pipeline_options
            )
            assert preset == "disabled"
            assert engine_name == "none"
            assert pipeline_options.do_code_enrichment is False
            assert pipeline_options.do_formula_enrichment is False

    def test_mps_granite_mlx_sets_docling_options(self) -> None:
        """granite_mlx 策略应设置 Granite Docling preset 与 MLX engine。"""
        engine = DoclingEngine(device="mps")
        pipeline_options = MagicMock()

        with (
            patch.object(engine, "_mps_enrichment_policy", return_value="granite_mlx"),
            patch(
                "negentropy.perceives.pdf.engines.docling.find_spec",
                return_value=object(),
            ),
            patch(
                "docling.datamodel.vlm_engine_options.MlxVlmEngineOptions",
                return_value="mlx-options",
            ) as mock_mlx_options,
            patch(
                "docling.datamodel.pipeline_options.CodeFormulaVlmOptions.from_preset",
                return_value="code-formula-options",
            ) as mock_from_preset,
        ):
            preset, runtime = engine._configure_mps_code_formula_options(
                pipeline_options
            )

        assert (preset, runtime) == ("granite_docling", "mlx")
        mock_mlx_options.assert_called_once_with()
        mock_from_preset.assert_called_once_with(
            "granite_docling",
            engine_options="mlx-options",
        )
        assert pipeline_options.code_formula_options == "code-formula-options"


# ============================================================
# Caption 提取
# ============================================================
class TestSafeCaption:
    """测试 _safe_caption 多层降级逻辑。"""

    def test_caption_text_preferred(self) -> None:
        """应优先使用 caption_text(doc)。"""
        mock_item = MagicMock()
        mock_item.caption_text.return_value = "Figure 1: Architecture"
        mock_doc = MagicMock()

        result = DoclingEngine._safe_caption(mock_item, mock_doc)
        assert result == "Figure 1: Architecture"
        mock_item.caption_text.assert_called_once_with(mock_doc)

    def test_caption_text_empty_falls_through(self) -> None:
        """caption_text 返回空字符串时应降级到 captions 列表。"""
        mock_caption = MagicMock()
        mock_caption.text = "Table 1"

        mock_item = MagicMock()
        mock_item.caption_text.return_value = ""
        mock_item.captions = [mock_caption]
        mock_doc = MagicMock()

        result = DoclingEngine._safe_caption(mock_item, mock_doc)
        assert result == "Table 1"

    def test_fallback_to_captions_text(self) -> None:
        """caption_text 不可用时应降级为 captions[0].text。"""
        mock_caption = MagicMock()
        mock_caption.text = "Table 1: Results"

        mock_item = MagicMock(spec=[])
        mock_item.captions = [mock_caption]

        result = DoclingEngine._safe_caption(mock_item, None)
        assert result == "Table 1: Results"

    def test_fallback_to_ref_resolve(self) -> None:
        """captions[0] 为 RefItem 时应通过 resolve(doc) 解析。"""
        mock_resolved = MagicMock()
        mock_resolved.text = "Resolved caption"

        mock_ref = MagicMock(spec=[])
        mock_ref.text = None  # RefItem 没有 .text
        mock_ref.resolve = MagicMock(return_value=mock_resolved)

        mock_item = MagicMock(spec=[])
        mock_item.captions = [mock_ref]
        mock_doc = MagicMock()

        result = DoclingEngine._safe_caption(mock_item, mock_doc)
        assert result == "Resolved caption"

    def test_empty_captions_returns_empty(self) -> None:
        """captions 为空列表时应返回空字符串。"""
        mock_item = MagicMock(spec=[])
        mock_item.captions = []

        result = DoclingEngine._safe_caption(mock_item, None)
        assert result == ""

    def test_no_doc_skips_caption_text(self) -> None:
        """doc 为 None 时不应调用 caption_text。"""
        mock_caption = MagicMock()
        mock_caption.text = "Direct text"

        mock_item = MagicMock()
        mock_item.captions = [mock_caption]

        result = DoclingEngine._safe_caption(mock_item, None)
        assert result == "Direct text"
        # caption_text 不应被调用
        mock_item.caption_text.assert_not_called()


# ============================================================
# 结构化数据提取（使用 mock）
# ============================================================
class TestDoclingResultExtraction:
    """测试从 mock DoclingDocument 中提取结构化数据。"""

    def test_extract_tables(self) -> None:
        """应从 DoclingDocument.tables 中提取表格。"""
        mock_table = MagicMock()
        mock_table.export_to_markdown.return_value = "| A | B |\n|---|---|\n| 1 | 2 |"
        mock_table.data.num_rows = 1
        mock_table.data.num_cols = 2
        mock_table.captions = []
        mock_table.prov = []

        engine = DoclingEngine()
        mock_doc = MagicMock()
        mock_doc.tables = [mock_table]

        tables = engine._extract_tables(mock_doc)
        assert len(tables) == 1
        assert tables[0].rows == 1
        assert tables[0].columns == 2
        assert "|" in tables[0].markdown

    def test_extract_tables_with_caption(self) -> None:
        """应通过 caption_text(doc) 提取表格标题。"""
        mock_table = MagicMock()
        mock_table.export_to_markdown.return_value = "| X |"
        mock_table.data.num_rows = 1
        mock_table.data.num_cols = 1
        mock_table.caption_text.return_value = "Table 1: Results"
        mock_table.prov = []

        engine = DoclingEngine()
        mock_doc = MagicMock()
        mock_doc.tables = [mock_table]

        tables = engine._extract_tables(mock_doc)
        assert tables[0].caption == "Table 1: Results"

    def test_extract_tables_no_tables_attr(self) -> None:
        """DoclingDocument 无 tables 属性时应返回空列表。"""
        engine = DoclingEngine()
        mock_doc = MagicMock(spec=[])  # 无任何属性
        tables = engine._extract_tables(mock_doc)
        assert tables == []

    def test_extract_images_saves_to_disk(self, tmp_path: Path) -> None:
        """应从 DoclingDocument.pictures 中提取图片并保存到磁盘。"""
        from PIL import Image

        mock_pil_image = Image.new("RGB", (100, 50), "red")

        mock_pic = MagicMock()
        mock_pic.captions = []
        mock_pic.classification = "chart"
        mock_pic.prov = []
        mock_pic.image = None
        mock_pic.get_image.return_value = mock_pil_image

        engine = DoclingEngine(output_dir=str(tmp_path))
        mock_doc = MagicMock()
        mock_doc.pictures = [mock_pic]

        images = engine._extract_images(mock_doc)
        assert len(images) == 1
        assert images[0].classification == "chart"
        assert images[0].width == 100
        assert images[0].height == 50
        assert images[0].filename is not None
        assert images[0].local_path is not None
        assert Path(images[0].local_path).exists()
        assert images[0].base64_data is not None

    def test_extract_images_get_image_failure_graceful(self, tmp_path: Path) -> None:
        """get_image 失败时应降级为仅记录元数据。"""
        mock_pic = MagicMock()
        mock_pic.captions = []
        mock_pic.classification = "photo"
        mock_pic.prov = []
        mock_pic.image = None
        mock_pic.get_image.side_effect = RuntimeError("No image data")

        engine = DoclingEngine(output_dir=str(tmp_path))
        mock_doc = MagicMock()
        mock_doc.pictures = [mock_pic]

        images = engine._extract_images(mock_doc)
        assert len(images) == 1
        assert images[0].classification == "photo"
        assert images[0].filename is None
        assert images[0].local_path is None
        assert images[0].width is None

    def test_extract_images_no_pictures_attr(self) -> None:
        """DoclingDocument 无 pictures 属性时应返回空列表。"""
        engine = DoclingEngine()
        mock_doc = MagicMock(spec=[])
        images = engine._extract_images(mock_doc)
        assert images == []

    def test_extract_images_creates_output_dir(self) -> None:
        """output_dir 为 None 时应自动创建临时目录。"""
        mock_pic = MagicMock()
        mock_pic.captions = []
        mock_pic.classification = None
        mock_pic.prov = []
        mock_pic.image = None
        mock_pic.get_image.return_value = None  # 无图片数据

        engine = DoclingEngine(output_dir=None)
        mock_doc = MagicMock()
        mock_doc.pictures = [mock_pic]

        images = engine._extract_images(mock_doc)
        assert len(images) == 1
        # output_dir 应已被设置
        assert engine._output_dir is not None

    def test_extract_formulas_from_markdown(self) -> None:
        """应从 Markdown 文本中提取公式。"""
        engine = DoclingEngine()
        md = r"Given $\alpha + \beta$ and $$E = mc^2$$ done."

        formulas = engine._extract_formulas(MagicMock(), md)
        block = [f for f in formulas if f.formula_type == "block"]
        inline = [f for f in formulas if f.formula_type == "inline"]

        assert len(block) == 1
        assert "mc^2" in block[0].latex
        assert len(inline) == 1
        assert r"\alpha" in inline[0].latex

    def test_extract_code_blocks(self) -> None:
        """应从 DoclingDocument 中提取代码块。"""
        mock_item = MagicMock()
        mock_item.label = "code"
        mock_item.text = "def hello():\n    print('world')"
        mock_item.code_language = "python"
        mock_item.prov = []

        engine = DoclingEngine()
        mock_doc = MagicMock()
        mock_doc.iterate_items.return_value = [(mock_item, 0)]

        code_blocks = engine._extract_code_blocks(mock_doc)
        assert len(code_blocks) == 1
        assert code_blocks[0].language == "python"
        assert "def hello" in code_blocks[0].code

    def test_extract_code_blocks_no_iterate(self) -> None:
        """DoclingDocument 无 iterate_items 时应返回空列表。"""
        engine = DoclingEngine()
        mock_doc = MagicMock(spec=[])
        code_blocks = engine._extract_code_blocks(mock_doc)
        assert code_blocks == []

    def test_extract_metadata(self) -> None:
        """应提取文档元数据。"""
        engine = DoclingEngine()
        mock_doc = MagicMock()
        mock_doc.name = "Test Document"
        mock_doc.origin.filename = "test.pdf"
        mock_doc.origin.mimetype = "application/pdf"

        metadata = engine._extract_metadata(mock_doc)
        assert metadata["title"] == "Test Document"
        assert metadata["filename"] == "test.pdf"

    def test_get_page_number_with_prov(self) -> None:
        """应从 prov 中获取并归一化为 0-based 页码。

        Docling 上报 1-based ``page_no``，项目内部统一 0-based，
        因此 ``page_no=3`` 应转换为 ``2``。
        """
        mock_prov = MagicMock()
        mock_prov.page_no = 3
        mock_item = MagicMock()
        mock_item.prov = [mock_prov]

        assert DoclingEngine._get_page_number(mock_item) == 2

    def test_get_page_number_no_prov(self) -> None:
        """无 prov 时应返回 None。"""
        mock_item = MagicMock()
        mock_item.prov = []
        assert DoclingEngine._get_page_number(mock_item) is None

    def test_normalize_docling_page_no_first_page(self) -> None:
        """Docling 1-based page_no=1 应归一化为 0-based 的 0。"""
        assert DoclingEngine._normalize_docling_page_no(1) == 0

    def test_normalize_docling_page_no_none(self) -> None:
        """None 输入应原样返回 None。"""
        assert DoclingEngine._normalize_docling_page_no(None) is None

    def test_normalize_docling_page_no_invalid(self) -> None:
        """无法解析的输入应返回 None。"""
        assert DoclingEngine._normalize_docling_page_no("abc") is None  # type: ignore[arg-type]

    def test_normalize_docling_page_no_clamps_below_zero(self) -> None:
        """异常的 page_no=0 不应产出负数页码。"""
        assert DoclingEngine._normalize_docling_page_no(0) == 0

    def test_to_topleft_bbox_bottomleft_returns_canonical_topleft(self) -> None:
        """BOTTOMLEFT 输入应翻转为标准 TopLeft 元组（``y0 < y1``）。

        ``_extract_bbox_tuple`` 始终按 ``(l, t, r, b)`` 解包；BOTTOMLEFT 下
        ``t > b``，转换后 ``y0`` 必须是「上边距页顶」（小），``y1`` 必须是
        「下边距页顶」（大），否则 ``figure_text_filter.is_text_inside_figure``
        的相交判定会全部失效。
        """
        bbox_obj = MagicMock(
            spec=["l", "t", "r", "b", "coord_origin"],
            l=10.0,
            t=750.0,  # BL: 上边距页底，靠近页顶
            r=200.0,
            b=700.0,  # BL: 下边距页底，仍靠近页顶但小于 t
            coord_origin="CoordOrigin.BOTTOMLEFT",
        )
        page_obj = MagicMock(spec=["size"])
        page_obj.size = MagicMock(spec=["height"], height=800.0)
        doc = MagicMock(spec=["pages"])
        doc.pages = {1: page_obj}

        result = DoclingEngine._to_topleft_bbox(bbox_obj, doc, raw_page_no=1)
        assert result is not None
        x0, y0, x1, y1 = result
        assert (x0, x1) == (10.0, 200.0)
        # 上边在 TopLeft 中靠近 0；下边稍下；y0 必须 < y1
        assert y0 < y1, f"BOTTOMLEFT 应翻转为 y0 < y1，实际 ({y0}, {y1})"
        assert y0 == pytest.approx(50.0)  # page_h - t = 800 - 750
        assert y1 == pytest.approx(100.0)  # page_h - b = 800 - 700

    def test_to_topleft_bbox_topleft_passthrough(self) -> None:
        """TOPLEFT 输入应原样返回（``y0 < y1`` 已成立）。"""
        bbox_obj = MagicMock(
            spec=["l", "t", "r", "b", "coord_origin"],
            l=10.0,
            t=50.0,
            r=200.0,
            b=100.0,
            coord_origin="CoordOrigin.TOPLEFT",
        )
        result = DoclingEngine._to_topleft_bbox(bbox_obj, doc=None, raw_page_no=1)
        assert result == (10.0, 50.0, 200.0, 100.0)

    def test_extract_text_blocks_excludes_caption_label(self) -> None:
        """``caption`` 不应进入 ``text_blocks``，避免与表格/图标题双倍渲染。"""
        engine = DoclingEngine()

        caption_item = MagicMock()
        caption_item.label = "caption"
        caption_item.text = "Figure 1: 实验结果对比"
        caption_item.prov = []

        paragraph_item = MagicMock()
        paragraph_item.label = "paragraph"
        paragraph_item.text = "正文段落 A。"
        paragraph_item.prov = []

        mock_doc = MagicMock()
        mock_doc.iterate_items.return_value = [
            (caption_item, 0),
            (paragraph_item, 0),
        ]
        mock_doc.pictures = []

        blocks = engine._extract_text_blocks(mock_doc)
        labels = {b.label for b in blocks}
        assert "caption" not in labels
        assert any(b.text == "正文段落 A。" for b in blocks)

    def test_extract_text_blocks_filters_figure_internal_text(self) -> None:
        """落在图区域内的 ``text``/``paragraph`` 应被剔除（图内文字）。"""
        from negentropy.perceives.pdf.figure_text_filter import FigureRegion

        engine = DoclingEngine()

        # 图内文字：bbox 完全在 figure region (50,50)-(300,300) 内
        inside_item = MagicMock()
        inside_item.label = "text"
        inside_item.text = "x-axis label"
        inside_prov = MagicMock()
        inside_prov.page_no = 1
        inside_bbox = MagicMock(
            spec=["l", "t", "r", "b"], l=100.0, t=120.0, r=180.0, b=140.0
        )
        inside_prov.bbox = inside_bbox
        inside_item.prov = [inside_prov]

        # 正文段落：完全在图区域外
        outside_item = MagicMock()
        outside_item.label = "paragraph"
        outside_item.text = "正文段落 B。"
        outside_prov = MagicMock()
        outside_prov.page_no = 1
        outside_bbox = MagicMock(
            spec=["l", "t", "r", "b"], l=400.0, t=400.0, r=500.0, b=420.0
        )
        outside_prov.bbox = outside_bbox
        outside_item.prov = [outside_prov]

        # 显式标题：即使坐标落在图区域内也保留（兜底 Docling 漏标）
        caption_like_item = MagicMock()
        caption_like_item.label = "paragraph"
        caption_like_item.text = "Figure 1: caption located inside region"
        cl_prov = MagicMock()
        cl_prov.page_no = 1
        cl_bbox = MagicMock(
            spec=["l", "t", "r", "b"], l=120.0, t=200.0, r=280.0, b=220.0
        )
        cl_prov.bbox = cl_bbox
        caption_like_item.prov = [cl_prov]

        mock_doc = MagicMock()
        mock_doc.iterate_items.return_value = [
            (inside_item, 0),
            (outside_item, 0),
            (caption_like_item, 0),
        ]

        figure_regions = [FigureRegion(page_no=0, bbox=(50.0, 50.0, 300.0, 300.0))]

        blocks = engine._extract_text_blocks(mock_doc, figure_regions=figure_regions)
        texts = {b.text for b in blocks}
        assert "x-axis label" not in texts, "图内文字应被剔除"
        assert "正文段落 B。" in texts, "图区域外的正文应保留"
        assert any("Figure 1" in t for t in texts), "显式标题应兜底保留"


# ============================================================
# page_range 透传
# ============================================================
class TestDoclingEnginePageRange:
    """验证 page_range 正确透传至 Docling DocumentConverter。"""

    def _make_mock_converter(self) -> MagicMock:
        """构造 mock converter，其 convert() 返回有效的 ConversionResult。"""
        mock_doc = MagicMock()
        mock_doc.export_to_markdown.return_value = "# Mock"
        mock_doc.tables = []
        mock_doc.pictures = []
        mock_doc.pages = []
        mock_doc.name = "mock"
        mock_doc.origin = None

        mock_result = MagicMock()
        mock_result.document = mock_doc
        mock_converter = MagicMock()
        mock_converter.convert.return_value = mock_result
        return mock_converter

    @patch(
        "negentropy.perceives.pdf.hardware.device_config.get_device_for_docling",
        return_value="cpu",
    )
    def test_page_range_passed_to_converter(self, _mock_device: object) -> None:
        """page_range=(80, 82) 应转换为 Docling 1-based (81, 82) 并传递。"""
        engine = DoclingEngine(device="cpu")
        mock_converter = self._make_mock_converter()

        with patch.object(engine, "_get_converter", return_value=mock_converter):
            engine.convert("/fake.pdf", page_range=(80, 82))

        mock_converter.convert.assert_called_once()
        call_kwargs = mock_converter.convert.call_args
        assert call_kwargs.kwargs["page_range"] == (81, 82)

    @patch(
        "negentropy.perceives.pdf.hardware.device_config.get_device_for_docling",
        return_value="cpu",
    )
    def test_no_page_range_omits_kwarg(self, _mock_device: object) -> None:
        """page_range=None 时不应传递 page_range 给 converter。"""
        engine = DoclingEngine(device="cpu")
        mock_converter = self._make_mock_converter()

        with patch.object(engine, "_get_converter", return_value=mock_converter):
            engine.convert("/fake.pdf")

        call_kwargs = mock_converter.convert.call_args
        assert "page_range" not in call_kwargs.kwargs

    @patch(
        "negentropy.perceives.pdf.hardware.device_config.get_device_for_docling",
        return_value="cpu",
    )
    def test_single_page_range(self, _mock_device: object) -> None:
        """page_range=(0, 1) 应转换为 Docling (1, 1)（单页）。"""
        engine = DoclingEngine(device="cpu")
        mock_converter = self._make_mock_converter()

        with patch.object(engine, "_get_converter", return_value=mock_converter):
            engine.convert("/fake.pdf", page_range=(0, 1))

        call_kwargs = mock_converter.convert.call_args
        assert call_kwargs.kwargs["page_range"] == (1, 1)


# ============================================================
# 缓存管理
# ============================================================
class TestDoclingEngineCacheManagement:
    """测试 converter 缓存管理。"""

    def test_reset_cache(self) -> None:
        """reset_cache() 应清空 _converters 字典。"""
        DoclingEngine._converters["test_key"] = "dummy"
        DoclingEngine.reset_cache()
        assert len(DoclingEngine._converters) == 0


# ============================================================
# 故障边界
# ============================================================
class TestDoclingEngineFailureModes:
    """验证 Docling 初始化/转换故障的 fail-fast 与降级边界。"""

    def test_converter_init_runtime_error_returns_none_for_engine_fallback_mlx(
        self,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        """MLX 依赖缺失现在通过 _configure_mps_code_formula_options 优雅降级，
        convert() 不再抛出 DoclingMpsMlxUnavailableError，而是返回 None 交由上层引擎降级。"""
        engine = DoclingEngine(device="mps")

        with (
            patch.object(DoclingEngine, "is_available", return_value=True),
            patch.object(
                engine,
                "_get_converter",
                side_effect=RuntimeError("mlx-vlm 相关初始化失败"),
            ),
        ):
            result = engine.convert("/fake.pdf")
            assert result is None

    def test_converter_init_runtime_error_returns_none_for_engine_fallback(
        self,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        """非策略性 converter 初始化异常应保留历史容错，交由上层引擎降级。"""
        engine = DoclingEngine(device="cpu")

        with (
            patch.object(DoclingEngine, "is_available", return_value=True),
            patch.object(
                engine,
                "_get_converter",
                side_effect=RuntimeError("pickle failed"),
            ),
            caplog.at_level(logging.WARNING),
        ):
            result = engine.convert("/fake.pdf")

        assert result is None
        assert "Docling 转换失败" in caplog.text
        assert "pickle failed" in caplog.text


# ============================================================
# PDFProcessor Docling 集成（单元层面）
# ============================================================
class TestPDFProcessorDoclingIntegration:
    """验证 PDFProcessor 的 Docling 集成逻辑。"""

    def test_prefer_docling_default(self) -> None:
        """prefer_docling 默认为 True。"""
        from negentropy.perceives.pdf.processor import PDFProcessor

        proc = PDFProcessor(enable_enhanced_features=False)
        assert proc.prefer_docling is True
        proc.cleanup()

    def test_prefer_docling_false(self) -> None:
        """prefer_docling=False 时不初始化 Docling 引擎。"""
        from negentropy.perceives.pdf.processor import PDFProcessor

        proc = PDFProcessor(enable_enhanced_features=False, prefer_docling=False)
        assert proc._docling_engine is None
        proc.cleanup()

    def test_supported_methods_includes_docling(self) -> None:
        """supported_methods 应包含 'docling'。"""
        from negentropy.perceives.pdf.processor import PDFProcessor

        proc = PDFProcessor(enable_enhanced_features=False)
        assert "docling" in proc.supported_methods
        proc.cleanup()

    def test_build_result_from_engine(self) -> None:
        """_build_result_from_engine 应生成标准输出格式。"""
        from negentropy.perceives.pdf.processor import PDFProcessor

        proc = PDFProcessor(enable_enhanced_features=False, prefer_docling=False)
        try:
            docling_result = DoclingConversionResult(
                markdown="# Test\n\nContent here.",
                tables=[DoclingTable(markdown="| A |", rows=1, columns=1)],
                images=[DoclingImage(page_number=0, caption="Fig 1")],
                formulas=[DoclingFormula(latex=r"\alpha", formula_type="inline")],
                code_blocks=[DoclingCodeBlock(code="x=1", language="python")],
                metadata={"title": "Test"},
                page_count=3,
            )

            result = proc._build_result_from_engine(
                docling_result,
                engine_name="docling",
                pdf_source="/tmp/test.pdf",
                include_metadata=True,
                output_format="markdown",
            )

            assert result["success"] is True
            assert result["method_used"] == "docling"
            assert result["pages_processed"] == 3
            assert result["word_count"] > 0
            assert "markdown" in result
            assert result["enhanced_assets"]["tables"]["count"] == 1
            assert result["enhanced_assets"]["images"]["count"] == 1
            assert result["enhanced_assets"]["formulas"]["count"] == 1
            assert result["enhanced_assets"]["code_blocks"]["count"] == 1
            assert "python" in result["enhanced_assets"]["code_blocks"]["languages"]
            assert result["metadata"]["title"] == "Test"
        finally:
            proc.cleanup()

    def test_build_result_includes_image_details(self) -> None:
        """enhanced_assets.images 应包含文件路径和尺寸信息。"""
        from negentropy.perceives.pdf.processor import PDFProcessor

        proc = PDFProcessor(enable_enhanced_features=False, prefer_docling=False)
        try:
            docling_result = DoclingConversionResult(
                markdown="# Test",
                images=[
                    DoclingImage(
                        page_number=0,
                        caption="Fig 1",
                        filename="img_p0_0.png",
                        local_path="/tmp/img_p0_0.png",
                        width=800,
                        height=600,
                    )
                ],
                page_count=1,
            )
            result = proc._build_result_from_engine(
                docling_result,
                engine_name="docling",
                pdf_source="/tmp/test.pdf",
                include_metadata=True,
                output_format="markdown",
            )
            img_item = result["enhanced_assets"]["images"]["items"][0]
            assert img_item["filename"] == "img_p0_0.png"
            assert img_item["local_path"] == "/tmp/img_p0_0.png"
            assert img_item["width"] == 800
            assert img_item["height"] == 600
            assert img_item["mime_type"] == "image/png"
            # files 列表
            assert "img_p0_0.png" in result["enhanced_assets"]["images"]["files"]
        finally:
            proc.cleanup()

    def test_build_result_includes_table_markdown(self) -> None:
        """enhanced_assets.tables items 应包含 markdown 内容。"""
        from negentropy.perceives.pdf.processor import PDFProcessor

        proc = PDFProcessor(enable_enhanced_features=False, prefer_docling=False)
        try:
            docling_result = DoclingConversionResult(
                markdown="# Test",
                tables=[
                    DoclingTable(
                        markdown="| A | B |\n|---|---|\n| 1 | 2 |",
                        rows=1,
                        columns=2,
                        caption="Table 1",
                    )
                ],
                page_count=1,
            )
            result = proc._build_result_from_engine(
                docling_result,
                engine_name="docling",
                pdf_source="/tmp/test.pdf",
                include_metadata=True,
                output_format="markdown",
            )
            table_item = result["enhanced_assets"]["tables"]["items"][0]
            assert "markdown" in table_item
            assert "| A | B |" in table_item["markdown"]
            assert table_item["caption"] == "Table 1"
        finally:
            proc.cleanup()

    def test_build_result_text_format(self) -> None:
        """output_format='text' 时不应包含 markdown 键。"""
        from negentropy.perceives.pdf.processor import PDFProcessor

        proc = PDFProcessor(enable_enhanced_features=False, prefer_docling=False)
        try:
            docling_result = DoclingConversionResult(
                markdown="Content",
                page_count=1,
            )
            result = proc._build_result_from_engine(
                docling_result,
                engine_name="docling",
                pdf_source="/tmp/test.pdf",
                include_metadata=False,
                output_format="text",
            )
            assert "markdown" not in result
            assert "metadata" not in result
            assert result["text"] == "Content"
        finally:
            proc.cleanup()
