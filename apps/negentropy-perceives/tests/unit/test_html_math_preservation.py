"""src/negentropy/perceives/markdown/html_preprocessor.py 数学元素保护的单元测试。"""

from negentropy.perceives.markdown.html_preprocessor import (
    _extract_latex_from_annotation,
    _preserve_math_elements,
    preprocess_html,
)
from bs4 import BeautifulSoup


# ============================================================
# TestExtractLatexFromAnnotation
# ============================================================
class TestExtractLatexFromAnnotation:
    """从 annotation 元素提取 LaTeX 的测试。"""

    def test_extract_from_tex_annotation(self) -> None:
        html = '<math><annotation encoding="application/x-tex">x^2</annotation></math>'
        soup = BeautifulSoup(html, "html.parser")
        math_elem = soup.find("math")
        assert _extract_latex_from_annotation(math_elem) == "x^2"

    def test_extract_from_latex_annotation(self) -> None:
        html = '<math><annotation encoding="application/x-latex">\\alpha + \\beta</annotation></math>'
        soup = BeautifulSoup(html, "html.parser")
        math_elem = soup.find("math")
        assert _extract_latex_from_annotation(math_elem) == "\\alpha + \\beta"

    def test_no_annotation_returns_none(self) -> None:
        html = "<math><mi>x</mi></math>"
        soup = BeautifulSoup(html, "html.parser")
        math_elem = soup.find("math")
        assert _extract_latex_from_annotation(math_elem) is None

    def test_none_element_returns_none(self) -> None:
        assert _extract_latex_from_annotation(None) is None


# ============================================================
# TestPreserveMathElements
# ============================================================
class TestPreserveMathElements:
    """数学元素保护函数的测试。"""

    def test_mathjax_script_inline(self) -> None:
        """MathJax <script type="math/tex"> 应被转为行内 LaTeX。"""
        html = '<p>Text <script type="math/tex">x^2 + y^2</script> more</p>'
        soup = BeautifulSoup(html, "html.parser")
        _preserve_math_elements(soup)
        result = str(soup)
        assert "$x^2 + y^2$" in result
        assert "<script" not in result

    def test_mathjax_script_display(self) -> None:
        """MathJax display 模式应被转为块级 LaTeX。"""
        html = '<p><script type="math/tex; mode=display">\\sum_{i=1}^n x_i</script></p>'
        soup = BeautifulSoup(html, "html.parser")
        _preserve_math_elements(soup)
        result = str(soup)
        assert "$$\\sum_{i=1}^n x_i$$" in result

    def test_mathjax_rendered_container(self) -> None:
        """MathJax 渲染容器应从 annotation 提取 LaTeX。"""
        html = """
        <span class="MathJax">
            <math><annotation encoding="application/x-tex">E = mc^2</annotation></math>
        </span>
        """
        soup = BeautifulSoup(html, "html.parser")
        _preserve_math_elements(soup)
        result = str(soup)
        assert "$E = mc^2$" in result

    def test_mathjax_display_container(self) -> None:
        """MathJax Display 容器应产生块级公式。"""
        html = """
        <div class="MathJax_Display">
            <math><annotation encoding="application/x-tex">x = y</annotation></math>
        </div>
        """
        soup = BeautifulSoup(html, "html.parser")
        _preserve_math_elements(soup)
        result = str(soup)
        assert "$$x = y$$" in result

    def test_katex_inline(self) -> None:
        """KaTeX 行内容器。"""
        html = """
        <span class="katex">
            <annotation encoding="application/x-tex">\\alpha</annotation>
        </span>
        """
        soup = BeautifulSoup(html, "html.parser")
        _preserve_math_elements(soup)
        result = str(soup)
        assert "$\\alpha$" in result

    def test_katex_display(self) -> None:
        """KaTeX display 容器。"""
        html = """
        <span class="katex-display">
            <annotation encoding="application/x-tex">\\int_0^1 f(x) dx</annotation>
        </span>
        """
        soup = BeautifulSoup(html, "html.parser")
        _preserve_math_elements(soup)
        result = str(soup)
        assert "$$\\int_0^1 f(x) dx$$" in result

    def test_mathml_with_annotation(self) -> None:
        """MathML <math> 标签含 annotation。"""
        html = """
        <math display="block">
            <mi>x</mi><mo>=</mo><mn>1</mn>
            <annotation encoding="application/x-tex">x = 1</annotation>
        </math>
        """
        soup = BeautifulSoup(html, "html.parser")
        _preserve_math_elements(soup)
        result = str(soup)
        assert "$$x = 1$$" in result

    def test_mathml_inline(self) -> None:
        """MathML 行内模式。"""
        html = """
        <math>
            <annotation encoding="application/x-tex">y^2</annotation>
        </math>
        """
        soup = BeautifulSoup(html, "html.parser")
        _preserve_math_elements(soup)
        result = str(soup)
        assert "$y^2$" in result

    def test_no_math_elements_unchanged(self) -> None:
        """无数学元素时不修改 HTML。"""
        html = "<p>Hello world</p>"
        soup = BeautifulSoup(html, "html.parser")
        original = str(soup)
        _preserve_math_elements(soup)
        assert str(soup) == original


# ============================================================
# TestPreprocessHtmlWithMath
# ============================================================
class TestPreprocessHtmlWithMath:
    """preprocess_html 集成测试：确保数学元素在预处理后被保留。"""

    def test_mathjax_survives_preprocessing(self) -> None:
        html = """
        <html><body>
        <p>Formula: <script type="math/tex">x^2</script></p>
        <nav>Navigation</nav>
        </body></html>
        """
        result = preprocess_html(html)
        assert "$x^2$" in result
        assert "Navigation" not in result  # nav 被移除

    def test_katex_survives_preprocessing(self) -> None:
        html = """
        <html><body>
        <p>Result: <span class="katex"><annotation encoding="application/x-tex">\\beta</annotation></span></p>
        <footer>Footer</footer>
        </body></html>
        """
        result = preprocess_html(html)
        assert "$\\beta$" in result
        assert "Footer" not in result  # footer 被移除
