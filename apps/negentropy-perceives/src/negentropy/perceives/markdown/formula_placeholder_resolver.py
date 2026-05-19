"""公式占位符解析模块：将 Markdown 中的 ``<!-- formula-not-decoded -->`` 占位符替换为 LaTeX 公式。

处理两类情况：

1. 有 PyMuPDF 回退数据时：按文档顺序用块级 ``MathRegion.latex`` 替换占位符
2. 无回退数据时：对占位符周围的 Unicode 数学文本进行 ``unicode_to_latex`` 转换
"""

import logging
import re
from typing import Optional, Protocol, Sequence, Tuple, runtime_checkable

logger = logging.getLogger(__name__)

# <!-- formula-not-decoded --> 占位符（Docling CodeFormula 失败时产出）
_FORMULA_PLACEHOLDER_RE = re.compile(r"<!--\s*formula-not-decoded\s*-->")


@runtime_checkable
class FormulaMeta(Protocol):
    """公式元数据协议，``MathRegion`` 与 ``DoclingFormula`` 均满足。"""

    @property
    def latex(self) -> str: ...

    @property
    def formula_type(self) -> str: ...


# ---------------------------------------------------------------------------
# 公开 API
# ---------------------------------------------------------------------------


def has_formula_placeholders(markdown: str) -> bool:
    """快速检测 Markdown 中是否包含 ``<!-- formula-not-decoded -->`` 占位符。"""
    if not markdown:
        return False
    return bool(_FORMULA_PLACEHOLDER_RE.search(markdown))


def resolve_formula_placeholders(
    markdown: str,
    fallback_formulas: Sequence[FormulaMeta] = (),
    *,
    remove_unresolved: bool = False,
) -> str:
    """将 Markdown 中的 ``<!-- formula-not-decoded -->`` 占位符替换为 LaTeX 公式。

    两阶段处理：

    1. 按文档顺序将占位符替换为 *fallback_formulas* 中的块级公式
    2. 对剩余未解析占位符周围的 Unicode 数学文本做 ``unicode_to_latex`` 转换

    Args:
        markdown: 原始 Markdown 文本。
        fallback_formulas: 有序块级公式列表（按文档顺序，通常来自
            PyMuPDF ``FormulaReconstructor``）。
        remove_unresolved: 是否移除无法解析的占位符（默认 ``False``，
            保留原样以便审查）。

    Returns:
        处理后的 Markdown 文本。
    """
    if not markdown:
        return markdown

    if not _FORMULA_PLACEHOLDER_RE.search(markdown):
        return markdown

    # Phase 1: 用回退块级公式替换占位符
    markdown = _replace_with_fallback_formulas(markdown, fallback_formulas)

    # Phase 2: 对剩余占位符周围的 Unicode 数学文本做 LaTeX 转换
    markdown = _salvage_unicode_context(markdown, remove_unresolved=remove_unresolved)

    return markdown


def extract_fallback_formulas(
    pdf_path: str,
    page_range: Optional[Tuple[int, int]] = None,
) -> list:
    """使用 PyMuPDF 字体分析提取块级公式作为回退数据。

    仅在检测到 ``<!-- formula-not-decoded -->`` 占位符时调用，
    按页面/文档顺序返回块级 ``MathRegion`` 列表。

    Args:
        pdf_path: PDF 文件本地路径。
        page_range: 可选的页码范围 ``(start, end)``，0-based start / exclusive end。

    Returns:
        块级 ``MathRegion`` 列表；PyMuPDF 不可用时返回空列表。
    """
    try:
        from ..pdf._imports import import_fitz
        from ..pdf.math_formula import FormulaReconstructor
    except ImportError:
        logger.debug("PyMuPDF 或 math_formula 模块不可用，跳过回退公式提取")
        return []

    fitz = import_fitz()
    if fitz is None:
        return []

    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        logger.warning("PyMuPDF 打开 PDF 失败: %s", e)
        return []

    try:
        total = doc.page_count
        start = page_range[0] if page_range else 0
        end = page_range[1] if page_range else total

        reconstructor = FormulaReconstructor()
        all_regions: list = []

        for page_num in range(start, min(end, total)):
            page = doc[page_num]
            _, regions = reconstructor.extract_formulas_from_page(page, page_num)
            all_regions.extend(r for r in regions if r.formula_type == "block")

        return all_regions
    except Exception as e:
        logger.warning("PyMuPDF 回退公式提取失败: %s", e)
        return []
    finally:
        doc.close()


# ---------------------------------------------------------------------------
# 内部实现
# ---------------------------------------------------------------------------


def _replace_with_fallback_formulas(
    markdown: str,
    fallback_formulas: Sequence[FormulaMeta],
) -> str:
    """按文档顺序将占位符替换为回退块级公式。"""
    placeholders = list(_FORMULA_PLACEHOLDER_RE.finditer(markdown))
    if not placeholders:
        return markdown

    # 仅使用块级公式作为回退候选
    block_formulas = [f for f in fallback_formulas if f.formula_type == "block"]
    if not block_formulas:
        return markdown

    parts: list[str] = []
    last_end = 0

    for idx, match in enumerate(placeholders):
        parts.append(markdown[last_end : match.start()])

        if idx < len(block_formulas):
            latex = block_formulas[idx].latex.strip()
            eq_num = getattr(block_formulas[idx], "equation_number", None)
            if eq_num:
                parts.append(f"$${latex}$$ ({eq_num})")
            else:
                parts.append(f"$${latex}$$")
            logger.debug("占位符 #%d 已替换为回退公式: %s", idx, latex[:60])
        else:
            logger.warning(
                "<!-- formula-not-decoded --> 占位符数量 (%d) 超出回退公式 (%d)，"
                "保留第 %d 个占位符",
                len(placeholders),
                len(block_formulas),
                idx + 1,
            )
            parts.append(match.group(0))

        last_end = match.end()

    parts.append(markdown[last_end:])
    return "".join(parts)


def _salvage_unicode_context(
    markdown: str,
    *,
    remove_unresolved: bool,
) -> str:
    """对剩余未解析占位符周围的 Unicode 数学文本进行 LaTeX 转换。

    若占位符后紧跟含 Unicode 数学符号的文本行，将其中的数学符号
    转为 LaTeX 行内公式。最后根据 *remove_unresolved* 决定是否
    清除残留占位符。
    """
    from ..pdf.math_formula import has_math_unicode

    # 匹配占位符 + 可选空行 + 下一文本行
    pattern = re.compile(
        r"(<!--\s*formula-not-decoded\s*-->)"
        r"(\s*\n)"
        r"([^\n]*)",
    )

    def _replacer(match: re.Match) -> str:
        placeholder = match.group(1)
        spacing = match.group(2)
        next_line = match.group(3)

        # 对下一行中的 Unicode 数学符号做 LaTeX 转换
        if next_line and has_math_unicode(next_line):
            next_line = _convert_unicode_math_in_text(next_line)

        if remove_unresolved:
            # 移除占位符，保留（可能已转换的）后续文本
            return next_line
        else:
            return placeholder + spacing + next_line

    markdown = pattern.sub(_replacer, markdown)

    # 清理独立的残留占位符（后面无文本行的情况）
    if remove_unresolved:
        markdown = _FORMULA_PLACEHOLDER_RE.sub("", markdown)
        # 清理可能产生的连续空行
        markdown = re.sub(r"\n{3,}", "\n\n", markdown)

    return markdown


def _convert_unicode_math_in_text(text: str) -> str:
    """将文本行中的 Unicode 数学符号片段转为行内 LaTeX。

    识别连续的数学符号/变量序列，用 ``$...$`` 包裹。
    非数学部分保持不变。
    """
    from ..pdf.math_formula import has_math_unicode, unicode_to_latex

    if not has_math_unicode(text):
        return text

    # 对整行做 unicode_to_latex 转换
    converted = unicode_to_latex(text)
    if converted == text:
        return text

    # 检测转换后是否已在 LaTeX 定界符内
    if "$" in converted:
        return converted

    # 对含有 LaTeX 命令的片段，用 $...$ 包裹
    # 策略：找出含 \ 命令的片段，扩展到完整数学表达式
    result = _wrap_latex_fragments(converted)
    return result


def _wrap_latex_fragments(text: str) -> str:
    r"""将文本中散落的 LaTeX 命令片段用 ``$...$`` 包裹。

    匹配模式：含 ``\`` 命令的连续数学表达式（含变量、下标、上标、括号）。
    """
    # 匹配含 LaTeX 命令的数学片段（含前后相邻的变量和运算符）
    # 例如: "E_rel \subseteq E" → "$E_{rel} \subseteq E$"
    pattern = re.compile(
        r"(?<!\$)"  # 不在 $ 之后
        r"("
        r"(?:[A-Za-z0-9_{}^]|\s)*"  # 前导变量/下标
        r"\\[a-zA-Z]+"  # LaTeX 命令（必须存在）
        r"(?:[A-Za-z0-9_{}^()\s,.]|\\\w+)*"  # 后续内容
        r")"
        r"(?!\$)"  # 不在 $ 之前
    )

    def _wrap(match: re.Match) -> str:
        fragment = match.group(1).strip()
        if not fragment:
            return match.group(0)
        return f"${fragment}$"

    return pattern.sub(_wrap, text)
