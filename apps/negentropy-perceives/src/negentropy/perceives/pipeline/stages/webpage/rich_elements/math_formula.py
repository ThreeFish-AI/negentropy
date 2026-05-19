"""S6: 数学公式提取（MathJax/KaTeX/MathML -> LaTeX）。"""

from __future__ import annotations

import logging
import re
from typing import List, Optional

from bs4 import BeautifulSoup, Tag

from ....base import StageResult
from ....models import MathFormula, StageContext
from ....registry import register_tool
from ..._base import WebToolBase
from ..._helpers import get_source_html

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 内部辅助函数
# ---------------------------------------------------------------------------


def _extract_latex_annotation(element: Tag) -> Optional[str]:
    """从 MathML/MathJax/KaTeX 容器中提取 LaTeX annotation。"""
    if element is None:
        return None
    for annotation in element.find_all("annotation"):
        encoding = annotation.get("encoding", "")
        if "tex" in encoding.lower() or "latex" in encoding.lower():  # type: ignore[union-attr]
            latex = annotation.string
            if latex:
                return latex.strip()
    return None


# ---------------------------------------------------------------------------
# S6: 数学公式提取
# ---------------------------------------------------------------------------


async def _extract_math_formulas(ctx: StageContext) -> List[MathFormula]:
    """从 HTML 中提取数学公式。

    检测来源：
    - MathJax ``<script type="math/tex">``
    - MathJax 渲染容器 ``.MathJax``
    - KaTeX 容器 ``.katex``
    - MathML ``<math>`` 标签
    - 内联 LaTeX（``$...$`` / ``$$...$$``）
    """
    html = get_source_html(ctx)
    if not html:
        return []

    formulas: List[MathFormula] = []

    try:
        soup = BeautifulSoup(html, "html.parser")

        # 1. MathJax <script type="math/tex">
        for script in soup.find_all("script", type=re.compile(r"math/tex")):
            latex = (script.string or "").strip()
            if not latex:
                continue
            script_type = script.get("type", "")
            is_display = "display" in script_type  # type: ignore[operator]
            formulas.append(
                MathFormula(
                    latex=latex,
                    formula_type="block" if is_display else "inline",
                    original_html=str(script),
                    source_format="mathjax",
                )
            )

        # 2. MathJax 渲染容器
        for container in soup.find_all(class_=re.compile(r"MathJax")):
            latex = _extract_latex_annotation(container)  # type: ignore[assignment]
            if latex:
                classes = container.get("class", [])  # type: ignore[arg-type]
                is_display = any("Display" in c or "display" in c for c in classes)  # type: ignore[union-attr]
                formulas.append(
                    MathFormula(
                        latex=latex,
                        formula_type="block" if is_display else "inline",
                        original_html=str(container)[:500],
                        source_format="mathjax",
                    )
                )

        # 3. KaTeX 容器
        for container in soup.find_all(class_=re.compile(r"katex")):
            latex = _extract_latex_annotation(container)  # type: ignore[assignment]
            if latex:
                classes = container.get("class", [])  # type: ignore[arg-type]
                is_display = any("display" in c for c in classes)  # type: ignore[union-attr]
                formulas.append(
                    MathFormula(
                        latex=latex,
                        formula_type="block" if is_display else "inline",
                        original_html=str(container)[:500],
                        source_format="katex",
                    )
                )

        # 4. MathML <math>
        for math_elem in soup.find_all("math"):
            latex = _extract_latex_annotation(math_elem)  # type: ignore[assignment]
            if latex:
                display = math_elem.get("display", "")
                formulas.append(
                    MathFormula(
                        latex=latex,
                        formula_type="block" if display == "block" else "inline",
                        original_html=str(math_elem)[:500],
                        source_format="mathml",
                    )
                )

    except Exception as e:
        logger.warning("数学公式提取失败: %s", e)

    return formulas


# ---------------------------------------------------------------------------
# 注册工具
# ---------------------------------------------------------------------------


@register_tool("beautifulsoup_math")
class MathFormulaTool(WebToolBase):
    """S6: 数学公式提取工具。"""

    tool_name = "beautifulsoup_math"

    def is_available(self) -> bool:
        try:
            from bs4 import BeautifulSoup  # noqa: F401

            return True
        except ImportError:
            return False

    async def _run(self, ctx: StageContext) -> StageResult:
        """提取数学公式。"""
        try:
            formulas = await _extract_math_formulas(ctx)
            ctx.formulas = formulas
            return StageResult(
                success=True,
                output=ctx,
                engine_used=self.tool_name,
                metadata={"formula_count": len(formulas)},
            )
        except Exception as e:
            ctx.errors.append(f"数学公式提取失败: {e}")
            return StageResult(
                success=True,  # 非致命错误
                output=ctx,
                engine_used=self.tool_name,
                metadata={"formula_count": 0, "error": str(e)},
            )
