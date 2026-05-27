"""``MarkdownFormatter`` Unicode 残留过滤（U+200B 零宽空格 + UTF-8 双编码 mojibake）。

R10-D17/D18 沉淀：Agentic AI Survey (Springer Nature 期刊) PDF 包含两类
此前样本未触发的 Unicode 失真：

- D17 零宽空格 U+200B 注入：Springer 期刊在引用 URL 中每个 ASCII 字符之间插入
  U+200B 作为软换行 hint，Agentic AI Survey 37 页 References 累计注入 1304 处，
  渲染时不可见但破坏文本拷贝 / 全文检索 / URL 可点击性。

- D18 UTF-8 → CP1252 双编码 mojibake：PDF 中 em-dash ``—`` (U+2014, UTF-8
  ``E2 80 94``) 在 PyMuPDF 抽取路径上一些情况会被 CP1252 解码为
  ``â € "`` (U+00E2 U+20AC U+201D) 三字符序列再以 UTF-8 重新编码，最终在
  Markdown 中显示为 ``â€"``。同类失真也覆盖 en-dash / 引号 / 省略号。
"""

from __future__ import annotations

from negentropy.perceives.markdown.formatter import MarkdownFormatter


class TestZeroWidthSpaceStrip:
    """U+200B 零宽空格应被无条件清除（不可见字符不应进入 markdown）。"""

    def setup_method(self) -> None:
        self.formatter = MarkdownFormatter()

    def test_zwsp_in_url_stripped(self) -> None:
        """Springer 期刊在 URL 每字符间注入的 ZWSP 应被剥离。"""
        md = "See reference: ​h​t​t​p​s​:​/​/​d​o​i​.​o​r​g​/​1​0​.​1​/​abc"
        result = self.formatter._apply_typography_fixes(md)
        assert "​" not in result
        assert "https://doi.org/10.1/abc" in result

    def test_zwsp_in_body_text_stripped(self) -> None:
        """正文中的零宽空格（如分词 hint）应被剥离。"""
        md = "Hello​world and good​bye."
        result = self.formatter._apply_typography_fixes(md)
        assert "​" not in result
        assert "Helloworld" in result

    def test_zwj_preserved(self) -> None:
        """零宽连接符 U+200D（用于 emoji / 印度系文字连写）不应被剥离。"""
        md = "Family emoji 👨‍👩‍👧 should stay."
        result = self.formatter._apply_typography_fixes(md)
        assert "‍" in result


class TestMojibakeFix:
    """UTF-8 → CP1252 → UTF-8 双编码 mojibake 应被还原。"""

    def setup_method(self) -> None:
        self.formatter = MarkdownFormatter()

    def test_em_dash_mojibake_restored(self) -> None:
        """em-dash ``—`` 的三字符 mojibake ``â€"`` 应被还原。"""
        md = "Agentic AI: complex goalsâ€”A comprehensive survey of architectures"
        result = self.formatter._apply_typography_fixes(md)
        assert "goals—A" in result
        assert "â€" not in result

    def test_en_dash_mojibake_restored(self) -> None:
        """en-dash ``–`` 的 mojibake ``â€"`` 应被还原。"""
        md = "Pages 2018â€“2025 of the analysis"
        result = self.formatter._apply_typography_fixes(md)
        assert "2018–2025" in result

    def test_right_single_quote_mojibake_restored(self) -> None:
        """right single quote ``'`` 的 mojibake ``â€™`` 应被还原。"""
        md = "Agentic AIâ€™s dual lineages"
        result = self.formatter._apply_typography_fixes(md)
        assert "Agentic AI’s" in result

    def test_legitimate_em_dash_preserved(self) -> None:
        """合法 em-dash 不应被改动。"""
        md = "This is a sentence — with an em-dash."
        result = self.formatter._apply_typography_fixes(md)
        assert "—" in result

    def test_text_without_mojibake_unchanged(self) -> None:
        """普通文本（无任何 mojibake / ZWSP）经过此规则应无变化。"""
        md = "Plain ASCII text without artifacts."
        result = self.formatter._apply_typography_fixes(md)
        # 末尾可能因其他规则影响，但 mojibake / ZWSP 维度应无变化
        assert "Plain ASCII text without artifacts." in result
