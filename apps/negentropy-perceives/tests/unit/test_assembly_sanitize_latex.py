"""``_sanitize_latex`` 单元测试。

锁定 LaTeX 清洗器对各类 PDF 抽取后失真的兜底处理契约：

1. ``\\text{X}\\quad`` 重复模式截断（Docling/Granite 幻觉）；
2. 连续 ``\\quad`` 溢出截断；
3. 单 token 重复溢出截断；
4. **R9 新增**：非 ``align``/``aligned``/``array``/``matrix`` 环境下裸 ``&``
   分隔符必须被剥离，否则 KaTeX 在 ``$$...$$`` 块中触发
   ``ParseError: Misplaced &``，整公式拒渲染（ISSUE-094 R9 D-5）。
"""

from __future__ import annotations

from negentropy.perceives.pipeline.stages.pdf.assembly import _sanitize_latex


class TestSanitizeLatexStripBareAmpersand:
    """R9 D-5：非对齐环境裸 ``&`` 分隔符剥离，杜绝 KaTeX ``Misplaced &`` ParseError。"""

    def test_strips_bare_ampersand_in_non_align_block(self) -> None:
        """裸 ``&`` 出现在普通 ``$$...$$`` 块且无 ``\\begin{align}`` 等环境时必须剥离。

        Context Engineering 2.0 论文 Eq (2) docling 抽取产物：
        ``C & = \\bigcup _ { e \\in \\mathcal { E } _ { n l } } C h a r ( e ) & ( 2 )``
        — 两个裸 ``&`` 在非对齐环境下 KaTeX 直接 ParseError。
        """
        bad = (
            r"C & = \bigcup _ { e \in \mathcal { E } _ { n l } } C h a r ( e ) & ( 2 )"
        )
        out = _sanitize_latex(bad)
        assert "&" not in out, f"裸 & 未剥离: {out!r}"
        # 保留主要内容
        assert "\\bigcup" in out
        assert "C h a r" in out
        assert "( 2 )" in out

    def test_keeps_ampersand_in_align_environment(self) -> None:
        """``\\begin{align}...\\end{align}`` 内部的 ``&`` 是合法对齐符，不可剥离。"""
        good = r"\begin{align} x &= 1 \\ y &= 2 \end{align}"
        out = _sanitize_latex(good)
        assert "&=" in out, f"对齐符被误剥: {out!r}"

    def test_keeps_ampersand_in_aligned_environment(self) -> None:
        """``\\begin{aligned}...\\end{aligned}`` 同理保留。"""
        good = r"\begin{aligned} a &= b \\ c &= d \end{aligned}"
        out = _sanitize_latex(good)
        assert out.count("&") == 2

    def test_keeps_ampersand_in_array_environment(self) -> None:
        """``\\begin{array}{cc}...\\end{array}`` 同理保留（cc 是列对齐说明符）。"""
        good = r"\begin{array}{cc} 1 & 2 \\ 3 & 4 \end{array}"
        out = _sanitize_latex(good)
        assert out.count("&") == 2

    def test_keeps_ampersand_in_matrix_environment(self) -> None:
        """``\\begin{matrix}...\\end{matrix}`` / ``pmatrix`` / ``bmatrix`` 同理保留。"""
        for env in ("matrix", "pmatrix", "bmatrix", "vmatrix", "Bmatrix", "Vmatrix"):
            src = r"\begin{" + env + r"} 1 & 2 \\ 3 & 4 \end{" + env + r"}"
            out = _sanitize_latex(src)
            assert out.count("&") == 2, f"{env} 环境内 & 被误剥: {out!r}"

    def test_keeps_ampersand_in_cases_environment(self) -> None:
        """``\\begin{cases}...\\end{cases}`` 同理保留（分段函数对齐符）。"""
        good = r"f(x) = \begin{cases} 1 & x > 0 \\ 0 & x \leq 0 \end{cases}"
        out = _sanitize_latex(good)
        assert out.count("&") == 2

    def test_escaped_ampersand_is_preserved(self) -> None:
        """``\\&``（转义符）不是裸 ``&``，必须保留。"""
        good = r"P\&L = revenue - cost"
        out = _sanitize_latex(good)
        assert r"\&" in out

    def test_handles_mixed_environment_with_outer_bare_ampersand(self) -> None:
        """局部 ``\\begin{aligned}`` 内含 ``&``，但环境外仍有裸 ``&``：仅剥离外部。"""
        src = r"x = \begin{aligned} a &= 1 \\ b &= 2 \end{aligned} & \quad \text{(end)}"
        out = _sanitize_latex(src)
        # aligned 内 2 个 & 必须保留；外部裸 & 必须剥离
        assert out.count("&") == 2
        assert r"\begin{aligned}" in out
        assert r"\end{aligned}" in out

    def test_empty_and_none_pass_through(self) -> None:
        """空字符串 / 仅空白不应抛错；保持原样。"""
        assert _sanitize_latex("") == ""
        assert _sanitize_latex(None) is None  # type: ignore[arg-type]
