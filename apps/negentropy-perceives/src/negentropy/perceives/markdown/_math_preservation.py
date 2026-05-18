"""数学元素保留：MathJax/KaTeX/MathML → LaTeX 文本转换。"""

from __future__ import annotations

import re
from typing import Optional

from bs4 import BeautifulSoup


def preserve_math_elements(soup: BeautifulSoup) -> None:
    """保护 HTML 中的数学元素，将其转换为 LaTeX 文本以避免被清理掉。

    支持：
    - MathJax: ``<script type="math/tex">`` → 提取 LaTeX 源码
    - MathJax 渲染输出: ``.MathJax`` 容器 → 从 annotation 提取 LaTeX
    - KaTeX: ``.katex`` 容器 → 从 annotation 提取 LaTeX
    - MathML: ``<math>`` 标签 → 从 annotation 提取 LaTeX，否则保留
    """
    # 1. MathJax <script type="math/tex"> 或 <script type="math/tex; mode=display">
    for script in soup.find_all("script", type=re.compile(r"math/tex")):
        latex = script.string or ""
        latex = latex.strip()
        if not latex:
            continue
        script_type = script.get("type", "")
        if "display" in script_type:  # type: ignore[operator]
            replacement = soup.new_tag("span")
            replacement.string = f"$${latex}$$"
        else:
            replacement = soup.new_tag("span")
            replacement.string = f"${latex}$"
        script.replace_with(replacement)

    # 2. MathJax 渲染容器 (.MathJax, .MathJax_Display, .MathJax_Preview)
    for container in soup.find_all(class_=re.compile(r"MathJax")):
        latex = extract_latex_from_annotation(container)  # type: ignore[assignment]
        if latex:
            replacement = soup.new_tag("span")
            classes = container.get("class", [])  # type: ignore[arg-type]
            is_display = any("Display" in c or "display" in c for c in classes)  # type: ignore[union-attr]
            if is_display:
                replacement.string = f"$${latex}$$"
            else:
                replacement.string = f"${latex}$"
            container.replace_with(replacement)

    # 3. KaTeX 容器 (.katex, .katex-display)
    for container in soup.find_all(class_=re.compile(r"katex")):
        latex = extract_latex_from_annotation(container)  # type: ignore[assignment]
        if latex:
            replacement = soup.new_tag("span")
            classes = container.get("class", [])  # type: ignore[arg-type]
            is_display = any("display" in c for c in classes)  # type: ignore[union-attr]
            if is_display:
                replacement.string = f"$${latex}$$"
            else:
                replacement.string = f"${latex}$"
            container.replace_with(replacement)

    # 4. MathML <math> 标签
    for math_elem in soup.find_all("math"):
        latex = extract_latex_from_annotation(math_elem)  # type: ignore[assignment]
        if latex:
            replacement = soup.new_tag("span")
            display = math_elem.get("display", "")  # type: ignore[assignment]
            if display == "block":
                replacement.string = f"$${latex}$$"
            else:
                replacement.string = f"${latex}$"
            math_elem.replace_with(replacement)


def extract_latex_from_annotation(element) -> Optional[str]:  # noqa: ANN001
    """从 MathML/MathJax/KaTeX 容器中提取 LaTeX annotation。"""
    if element is None:
        return None

    for annotation in element.find_all("annotation"):
        encoding = annotation.get("encoding", "")
        if "tex" in encoding.lower() or "latex" in encoding.lower():
            latex = annotation.string
            if latex:
                return latex.strip()

    return None
