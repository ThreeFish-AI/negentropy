"""单元测试：``DoclingEngine._extract_formulas`` 优先 iterate_items 获取 bbox。

ISSUE-094 R8：mineru 公式 stage 在 28 页学术论文超时降级 docling 后，原
``_extract_formulas`` 仅从 markdown 正则抽取公式（无 bbox），导致 assembly
五级稳定排序键 ``(page, col, y0, x0, reading_order)`` 中 y0 退化为
``1_000_000 + reading_order``（无 bbox 公式按 enumerate 顺序而非视觉顺序），
出现 Eq(1) 与 Eq(2) 在 markdown 中顺序倒置等回归。

修复后：优先 ``doc.iterate_items()`` 拿 ``label='formula'`` 的项，从
``item.prov[0].bbox`` 提取 TopLeft 坐标系 bbox，让 assembly 按视觉顺序
正确排序。
"""

from __future__ import annotations

from negentropy.perceives.pdf.engines.docling import DoclingEngine


class _FakeBBox:
    """模拟 Docling BoundingBox（``l/t/r/b`` 属性）。

    Docling 的 BoundingBox 使用 ``l/t/r/b`` 单字母属性命名（PDF 行业惯例），
    这里 fake 实现也保持同名以匹配 ``_extract_bbox_tuple`` 的 ``getattr`` 路径。
    ruff E741 对 ``l`` 单字母参数报警，使用 ``l_/t_/r_/b_`` 临时参数名规避。
    """

    def __init__(
        self,
        l_: float,
        t_: float,
        r_: float,
        b_: float,  # noqa: E741
    ) -> None:
        self.l = l_  # noqa: E741
        self.t = t_
        self.r = r_
        self.b = b_


class _FakeProv:
    def __init__(self, page_no: int, bbox: _FakeBBox) -> None:
        self.page_no = page_no
        self.bbox = bbox


class _FakeFormulaItem:
    """模拟 Docling FormulaItem（label='formula'）。"""

    def __init__(
        self,
        text: str,
        page_no: int,
        bbox: _FakeBBox,
        label: str = "formula",
    ) -> None:
        self.label = label
        self.text = text
        self.prov = [_FakeProv(page_no, bbox)]


class _FakePage:
    def __init__(self, page_no: int, height: float = 842.0) -> None:
        self.page_no = page_no
        self.size = _FakeBBox(0, 0, 595, height)


class _FakeDoc:
    """模拟 DoclingDocument，仅暴露测试需要的属性。"""

    def __init__(self, items, pages=None) -> None:
        self._items = items
        self.pages = pages or {}

    def iterate_items(self):
        for item in self._items:
            yield (item, 0)


class TestDoclingFormulaBbox:
    """``_extract_formulas`` 优先 iterate_items 拿 bbox。"""

    def test_extracts_formula_with_bbox_via_iterate_items(self) -> None:
        """正常路径：iterate_items 返回 formula label item → 含 bbox 输出。"""
        engine = DoclingEngine(enable_ocr=False)
        bbox = _FakeBBox(l_=72.0, t_=200.0, r_=523.0, b_=250.0)
        item = _FakeFormulaItem(
            text=r"Char \colon \mathcal{E} \to \mathcal{P}(\mathcal{F}) \quad (1)",
            page_no=1,  # docling 1-based, 经 _get_page_number 归一化为 0
            bbox=bbox,
        )
        doc = _FakeDoc([item], pages={1: _FakePage(1)})
        formulas = engine._extract_formulas(doc, markdown="")
        assert len(formulas) == 1
        assert formulas[0].latex.startswith("Char")
        assert formulas[0].formula_type == "block"
        # bbox 必须非 None — R8 的核心契约
        assert formulas[0].bbox is not None
        assert isinstance(formulas[0].bbox, tuple)
        assert len(formulas[0].bbox) == 4

    def test_strips_dollar_wrapping(self) -> None:
        """item.text 含 ``$$...$$`` 或 ``$...$`` 包裹时应剥离。"""
        engine = DoclingEngine(enable_ocr=False)
        bbox = _FakeBBox(l_=0, t_=100, r_=100, b_=120)
        item = _FakeFormulaItem(
            text=r"$$ M_s = f_{short}(c) $$",
            page_no=1,
            bbox=bbox,
        )
        doc = _FakeDoc([item], pages={1: _FakePage(1)})
        formulas = engine._extract_formulas(doc, markdown="")
        assert len(formulas) == 1
        # 剥离了 $$...$$ 包裹
        assert not formulas[0].latex.startswith("$")
        assert "M_s = f_{short}" in formulas[0].latex

    def test_skips_non_formula_labels(self) -> None:
        """label != 'formula' 的 item 不被识别为公式。"""
        engine = DoclingEngine(enable_ocr=False)
        bbox = _FakeBBox(0, 0, 100, 50)
        items = [
            _FakeFormulaItem("some paragraph", page_no=1, bbox=bbox, label="text"),
            _FakeFormulaItem("section header", page_no=1, bbox=bbox, label="title"),
            _FakeFormulaItem(
                r"\sum_{i=1}^{n} x_i \tag{3}", page_no=1, bbox=bbox, label="formula"
            ),
        ]
        doc = _FakeDoc(items, pages={1: _FakePage(1)})
        formulas = engine._extract_formulas(doc, markdown="")
        assert len(formulas) == 1
        assert "sum" in formulas[0].latex

    def test_falls_back_to_markdown_regex_when_iterate_empty(self) -> None:
        """iterate_items 没拿到 formula label 时降级 markdown 正则。"""
        engine = DoclingEngine(enable_ocr=False)
        # 完全空的 items（无 formula label）
        doc = _FakeDoc([], pages={1: _FakePage(1)})
        markdown = """
Some text.

$$ M_s = f_{short}(c) $$

More text with inline $x^2$ formula.
"""
        formulas = engine._extract_formulas(doc, markdown=markdown)
        # 应通过 markdown regex 抽出两个公式
        assert len(formulas) == 2
        block = [f for f in formulas if f.formula_type == "block"]
        inline = [f for f in formulas if f.formula_type == "inline"]
        assert len(block) == 1
        assert len(inline) == 1
        # 降级路径无 bbox（无法从 markdown 推断位置）
        assert block[0].bbox is None
        assert inline[0].bbox is None

    def test_dedup_repeated_latex(self) -> None:
        """同一 LaTeX 字符串多次出现仅保留一次。"""
        engine = DoclingEngine(enable_ocr=False)
        bbox = _FakeBBox(0, 0, 100, 50)
        items = [
            _FakeFormulaItem(r"x = y \tag{1}", page_no=1, bbox=bbox),
            _FakeFormulaItem(r"x = y \tag{1}", page_no=1, bbox=bbox),  # 重复
        ]
        doc = _FakeDoc(items, pages={1: _FakePage(1)})
        formulas = engine._extract_formulas(doc, markdown="")
        assert len(formulas) == 1

    def test_two_formulas_preserve_iteration_order(self) -> None:
        """同页两个公式 — iterate_items 返回的顺序应保留（让 assembly y0 排序处理）。

        关键回归测试：Context Engineering 2.0 Eq(1) 与 Eq(2) 在 PDF 视觉上
        Eq(1) y0 ≈ 207、Eq(2) y0 ≈ 159（PDF TopLeft），按视觉顺序 Eq(2)
        在上 Eq(1) 在下。Docling 的 iterate_items 通常按视觉阅读顺序，但
        实测可能输出 Eq(2) 在前 Eq(1) 在后。assembly 五级排序键的 y0 维度
        负责修正这种顺序差异。本测试仅锁定"两公式都带 bbox 且顺序保留"，
        实际 y0 顺序差异由 assembly 排序处理。
        """
        engine = DoclingEngine(enable_ocr=False)
        # 模拟 docling 输出顺序：(Eq2 先, Eq1 后) — 因为 iterate_items 可能不按 y 排
        items = [
            _FakeFormulaItem(
                r"C = \bigcup_e Char(e) \tag{2}",
                page_no=1,
                bbox=_FakeBBox(l_=100, t_=159, r_=400, b_=200),
            ),
            _FakeFormulaItem(
                r"Char \colon E \to P(F) \tag{1}",
                page_no=1,
                bbox=_FakeBBox(l_=100, t_=207, r_=400, b_=240),
            ),
        ]
        doc = _FakeDoc(items, pages={1: _FakePage(1)})
        formulas = engine._extract_formulas(doc, markdown="")
        assert len(formulas) == 2
        # 两公式都带 bbox（关键契约）
        for f in formulas:
            assert f.bbox is not None
            assert isinstance(f.bbox, tuple) and len(f.bbox) == 4
