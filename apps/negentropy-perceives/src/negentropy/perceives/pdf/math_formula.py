"""数学公式提取与 LaTeX 还原模块。

提供两条路径：
1. **高保真路径** — Docling CodeFormula 视觉语言模型（需安装可选依赖 ``docling``）
2. **降级路径** — PyMuPDF ``get_text("dict")`` 字体分析 + Unicode→LaTeX 映射

自动选择策略：若 ``docling`` 已安装，优先使用高保真路径；否则降级至 PyMuPDF 字体分析。
"""

import logging
import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 1. Unicode → LaTeX 映射表
# ---------------------------------------------------------------------------

# 关系运算符
_RELATION_MAP: Dict[str, str] = {
    "∈": r"\in",
    "∉": r"\notin",
    "⊂": r"\subset",
    "⊃": r"\supset",
    "⊆": r"\subseteq",
    "⊇": r"\supseteq",
    "≤": r"\leq",
    "≥": r"\geq",
    "≠": r"\neq",
    "≈": r"\approx",
    "≡": r"\equiv",
    "≅": r"\cong",
    "∼": r"\sim",
    "≺": r"\prec",
    "≻": r"\succ",
    "⊏": r"\sqsubset",
    "⊐": r"\sqsupset",
    "⊑": r"\sqsubseteq",
    "⊒": r"\sqsupseteq",
    "∝": r"\propto",
    "≪": r"\ll",
    "≫": r"\gg",
    "∥": r"\parallel",
    "⊥": r"\perp",
    "≐": r"\doteq",
    "⋈": r"\bowtie",
}

# 希腊字母（小写）
_GREEK_LOWER_MAP: Dict[str, str] = {
    "α": r"\alpha",
    "β": r"\beta",
    "γ": r"\gamma",
    "δ": r"\delta",
    "ε": r"\epsilon",
    "ϵ": r"\epsilon",
    "ζ": r"\zeta",
    "η": r"\eta",
    "θ": r"\theta",
    "ϑ": r"\vartheta",
    "ι": r"\iota",
    "κ": r"\kappa",
    "λ": r"\lambda",
    "μ": r"\mu",
    "ν": r"\nu",
    "ξ": r"\xi",
    "π": r"\pi",
    "ρ": r"\rho",
    "ϱ": r"\varrho",
    "σ": r"\sigma",
    "ς": r"\varsigma",
    "τ": r"\tau",
    "υ": r"\upsilon",
    "φ": r"\phi",
    "ϕ": r"\phi",
    "χ": r"\chi",
    "ψ": r"\psi",
    "ω": r"\omega",
}

# 希腊字母（大写）
_GREEK_UPPER_MAP: Dict[str, str] = {
    "Α": r"A",
    "Β": r"B",
    "Γ": r"\Gamma",
    "Δ": r"\Delta",
    "Ε": r"E",
    "Ζ": r"Z",
    "Η": r"H",
    "Θ": r"\Theta",
    "Ι": r"I",
    "Κ": r"K",
    "Λ": r"\Lambda",
    "Μ": r"M",
    "Ν": r"N",
    "Ξ": r"\Xi",
    "Ο": r"O",
    "Π": r"\Pi",
    "Ρ": r"P",
    "Σ": r"\Sigma",
    "Τ": r"T",
    "Υ": r"\Upsilon",
    "Φ": r"\Phi",
    "Χ": r"X",
    "Ψ": r"\Psi",
    "Ω": r"\Omega",
}

# 集合与逻辑运算符
_SET_LOGIC_MAP: Dict[str, str] = {
    "∅": r"\emptyset",
    "∩": r"\cap",
    "∪": r"\cup",
    "⋃": r"\bigcup",
    "⋂": r"\bigcap",
    "∧": r"\wedge",
    "∨": r"\vee",
    "¬": r"\neg",
    "∀": r"\forall",
    "∃": r"\exists",
    "∄": r"\nexists",
    "⊕": r"\oplus",
    "⊗": r"\otimes",
    "⊖": r"\ominus",
    "⊘": r"\oslash",
    "⊙": r"\odot",
    "∖": r"\setminus",
    "△": r"\triangle",
}

# 箭头
_ARROW_MAP: Dict[str, str] = {
    "→": r"\to",
    "←": r"\leftarrow",
    "↔": r"\leftrightarrow",
    "⇒": r"\Rightarrow",
    "⇐": r"\Leftarrow",
    "⇔": r"\Leftrightarrow",
    "↦": r"\mapsto",
    "↗": r"\nearrow",
    "↘": r"\searrow",
    "↙": r"\swarrow",
    "↖": r"\nwarrow",
    "⟶": r"\longrightarrow",
    "⟵": r"\longleftarrow",
    "⟹": r"\Longrightarrow",
    "⟸": r"\Longleftarrow",
    "⟺": r"\Longleftrightarrow",
    "↠": r"\twoheadrightarrow",
    "↣": r"\rightarrowtail",
    "⇀": r"\rightharpoonup",
    "⇁": r"\rightharpoondown",
    "↾": r"\upharpoonright",
    "↿": r"\upharpoonleft",
}

# 运算符
_OPERATOR_MAP: Dict[str, str] = {
    "×": r"\times",
    "÷": r"\div",
    "±": r"\pm",
    "∓": r"\mp",
    "·": r"\cdot",
    "∘": r"\circ",
    "†": r"\dagger",
    "‡": r"\ddagger",
    "⋆": r"\star",
    "★": r"\bigstar",
    "∑": r"\sum",
    "∏": r"\prod",
    "∫": r"\int",
    "∬": r"\iint",
    "∭": r"\iiint",
    "∮": r"\oint",
    "∂": r"\partial",
    "∇": r"\nabla",
    "√": r"\sqrt",
    "∞": r"\infty",
    "⊢": r"\vdash",
    "⊣": r"\dashv",
    "⊨": r"\models",
    "℃": r"{}^{\circ}\text{C}",
}

# 黑板粗体 (Blackboard bold)
_BLACKBOARD_MAP: Dict[str, str] = {
    "ℕ": r"\mathbb{N}",
    "ℤ": r"\mathbb{Z}",
    "ℚ": r"\mathbb{Q}",
    "ℝ": r"\mathbb{R}",
    "ℂ": r"\mathbb{C}",
    "𝔸": r"\mathbb{A}",
    "𝔹": r"\mathbb{B}",
    "𝔻": r"\mathbb{D}",
    "𝔼": r"\mathbb{E}",
    "𝔽": r"\mathbb{F}",
    "𝔾": r"\mathbb{G}",
    "ℍ": r"\mathbb{H}",
    "𝕀": r"\mathbb{I}",
    "𝕁": r"\mathbb{J}",
    "𝕂": r"\mathbb{K}",
    "𝕃": r"\mathbb{L}",
    "𝕄": r"\mathbb{M}",
    "𝕆": r"\mathbb{O}",
    "ℙ": r"\mathbb{P}",
    "𝕊": r"\mathbb{S}",
    "𝕋": r"\mathbb{T}",
    "𝕌": r"\mathbb{U}",
    "𝕍": r"\mathbb{V}",
    "𝕎": r"\mathbb{W}",
    "𝕏": r"\mathbb{X}",
    "𝕐": r"\mathbb{Y}",
}

# 杂项符号
_MISC_MAP: Dict[str, str] = {
    "…": r"\ldots",
    "⋯": r"\cdots",
    "⋮": r"\vdots",
    "⋱": r"\ddots",
    "′": r"'",
    "″": r"''",
    "°": r"^{\circ}",
    "ℓ": r"\ell",
    "ℏ": r"\hbar",
    "ℑ": r"\Im",
    "ℜ": r"\Re",
    "℘": r"\wp",
    "ℵ": r"\aleph",
    "⟨": r"\langle",
    "⟩": r"\rangle",
    "⌈": r"\lceil",
    "⌉": r"\rceil",
    "⌊": r"\lfloor",
    "⌋": r"\rfloor",
}

# Unicode 上标数字/字母 → LaTeX 上标
_SUPERSCRIPT_MAP: Dict[str, str] = {
    "⁰": "^{0}",
    "¹": "^{1}",
    "²": "^{2}",
    "³": "^{3}",
    "⁴": "^{4}",
    "⁵": "^{5}",
    "⁶": "^{6}",
    "⁷": "^{7}",
    "⁸": "^{8}",
    "⁹": "^{9}",
    "ⁿ": "^{n}",
    "ⁱ": "^{i}",
}

# Unicode 下标数字/字母 → LaTeX 下标
_SUBSCRIPT_MAP: Dict[str, str] = {
    "₀": "_{0}",
    "₁": "_{1}",
    "₂": "_{2}",
    "₃": "_{3}",
    "₄": "_{4}",
    "₅": "_{5}",
    "₆": "_{6}",
    "₇": "_{7}",
    "₈": "_{8}",
    "₉": "_{9}",
    "ₙ": "_{n}",
    "ₘ": "_{m}",
    "ₖ": "_{k}",
    "ₐ": "_{a}",
    "ₑ": "_{e}",
    "ₒ": "_{o}",
    "ₓ": "_{x}",
    "ᵢ": "_{i}",
    "ⱼ": "_{j}",
}

# 合并所有 Unicode→LaTeX 映射
UNICODE_TO_LATEX: Dict[str, str] = {}
UNICODE_TO_LATEX.update(_RELATION_MAP)
UNICODE_TO_LATEX.update(_GREEK_LOWER_MAP)
UNICODE_TO_LATEX.update(_GREEK_UPPER_MAP)
UNICODE_TO_LATEX.update(_SET_LOGIC_MAP)
UNICODE_TO_LATEX.update(_ARROW_MAP)
UNICODE_TO_LATEX.update(_OPERATOR_MAP)
UNICODE_TO_LATEX.update(_BLACKBOARD_MAP)
UNICODE_TO_LATEX.update(_MISC_MAP)
UNICODE_TO_LATEX.update(_SUPERSCRIPT_MAP)
UNICODE_TO_LATEX.update(_SUBSCRIPT_MAP)

# 用于快速检测文本中是否含有数学 Unicode 符号的字符集合
_MATH_UNICODE_CHARS = frozenset(UNICODE_TO_LATEX.keys())

# ---------------------------------------------------------------------------
# 2. 数学字体检测
# ---------------------------------------------------------------------------

# 已知的数学字体族正则模式
_MATH_FONT_PATTERNS: List[re.Pattern] = [
    re.compile(r"CM(MI|SY|EX|R)\d*", re.IGNORECASE),  # Computer Modern
    re.compile(r"(MSAM|MSBM)\d*", re.IGNORECASE),  # AMS
    re.compile(r"Euler", re.IGNORECASE),
    re.compile(r"STIX.*Math", re.IGNORECASE),
    re.compile(r"Symbol", re.IGNORECASE),
    re.compile(r"Math(emat)?ica", re.IGNORECASE),
    re.compile(r"Cambria\s*Math", re.IGNORECASE),
    re.compile(r"Latin\s*Modern\s*Math", re.IGNORECASE),
    re.compile(r"XITS\s*Math", re.IGNORECASE),
    re.compile(r"Asana\s*Math", re.IGNORECASE),
    re.compile(r"DejaVu.*Math", re.IGNORECASE),
    re.compile(r"Fira\s*Math", re.IGNORECASE),
    re.compile(r"Libertinus\s*Math", re.IGNORECASE),
    re.compile(r"TeX\s*Gyre.*Math", re.IGNORECASE),
]


def is_math_font(font_name: str) -> bool:
    """判断字体名称是否属于数学字体族。"""
    if not font_name:
        return False
    return any(pattern.search(font_name) for pattern in _MATH_FONT_PATTERNS)


# ---------------------------------------------------------------------------
# 3. 数据结构
# ---------------------------------------------------------------------------


@dataclass
class MathSpan:
    """文本中的一个 span 片段，可能是数学内容。"""

    text: str
    font_name: str = ""
    font_size: float = 0.0
    origin_x: float = 0.0
    origin_y: float = 0.0
    is_math: bool = False
    script_type: str = "normal"  # "normal", "superscript", "subscript"


@dataclass
class MathRegion:
    """页面中检测到的数学区域。"""

    latex: str
    formula_type: str  # "inline" or "block"
    page_number: int = 0
    bbox: Optional[Dict[str, float]] = None
    equation_number: Optional[str] = None
    original_text: str = ""


# ---------------------------------------------------------------------------
# 4. 核心工具函数
# ---------------------------------------------------------------------------


def unicode_to_latex(text: str) -> str:
    """将文本中的 Unicode 数学符号替换为 LaTeX 命令。

    仅替换映射表中存在的字符，不影响其他文本。
    对于 LaTeX 命令后的字母字符，自动添加空格以防止粘连。
    """
    if not text:
        return text

    result: list[str] = []
    for ch in text:
        if ch in UNICODE_TO_LATEX:
            latex_cmd = UNICODE_TO_LATEX[ch]
            # 如果上一个输出是 LaTeX 命令（以反斜杠开头的字母序列），
            # 且当前替换也以反斜杠开头，添加空格分隔
            if (
                result
                and latex_cmd.startswith("\\")
                and not latex_cmd.startswith("\\{")
            ):
                last = result[-1]
                if last and last[-1].isalpha():
                    result.append(" ")
            result.append(latex_cmd)
        else:
            result.append(ch)
    return "".join(result)


def has_math_unicode(text: str) -> bool:
    """快速检测文本中是否包含 Unicode 数学符号。"""
    if not text:
        return False
    return bool(_MATH_UNICODE_CHARS.intersection(text))


def detect_script_type(
    span_size: float,
    span_origin_y: float,
    baseline_y: float,
    normal_size: float,
    size_ratio_threshold: float = 0.75,
    y_offset_threshold: float = 2.0,
) -> str:
    """通过字号比例和 y 偏移判断上下标类型。

    Args:
        span_size: 当前 span 的字号
        span_origin_y: 当前 span 的 y 坐标（PDF 坐标，向下为正）
        baseline_y: 基线 y 坐标
        normal_size: 正常文本字号
        size_ratio_threshold: 字号比例阈值（低于此值视为上下标）
        y_offset_threshold: y 偏移阈值（点）

    Returns:
        "superscript", "subscript", 或 "normal"
    """
    if normal_size <= 0:
        return "normal"

    ratio = span_size / normal_size
    if ratio >= size_ratio_threshold:
        return "normal"

    y_offset = span_origin_y - baseline_y
    if y_offset < -y_offset_threshold:
        return "superscript"
    elif y_offset > y_offset_threshold:
        return "subscript"

    # 字号较小但 y 偏移不显著，默认为上标（常见场景）
    if ratio < 0.65:
        return "superscript"
    return "normal"


# ---------------------------------------------------------------------------
# 5. FormulaReconstructor（降级路径核心）
# ---------------------------------------------------------------------------


class FormulaReconstructor:
    """基于 PyMuPDF ``get_text("dict")`` 的公式重建器。

    分析字体信息和空间位置来检测数学内容，重建为 LaTeX 表示。
    """

    def __init__(self) -> None:
        self.logger = logging.getLogger(__name__)

    def reconstruct_line_formulas(self, line_dict: Dict) -> str:
        """将一行的 spans 分析后重建为含 LaTeX 的文本。

        Args:
            line_dict: PyMuPDF ``get_text("dict")`` 中一行的字典结构，
                       包含 ``spans`` 列表。

        Returns:
            重建后的文本行，数学部分已转为 LaTeX。
        """
        spans = line_dict.get("spans", [])
        if not spans:
            return ""

        # 计算该行的基线和正常字号
        sizes = [s.get("size", 0) for s in spans if s.get("text", "").strip()]
        if not sizes:
            return ""
        normal_size = max(set(sizes), key=sizes.count)  # 众数
        baseline_y = line_dict.get("bbox", [0, 0, 0, 0])[1]

        # 取所有 span 的中位 y 坐标作为基线参考
        y_origins = [
            s.get("origin", (0, 0))[1] for s in spans if s.get("text", "").strip()
        ]
        if y_origins:
            y_origins_sorted = sorted(y_origins)
            baseline_y = y_origins_sorted[len(y_origins_sorted) // 2]

        result_parts: list[str] = []
        in_math = False
        math_buffer: list[str] = []

        for span in spans:
            text = span.get("text", "")
            if not text:
                continue

            font_name = span.get("font", "")
            font_size = span.get("size", normal_size)
            origin = span.get("origin", (0, baseline_y))

            span_is_math = is_math_font(font_name) or has_math_unicode(text)
            script = detect_script_type(font_size, origin[1], baseline_y, normal_size)

            if span_is_math or script != "normal":
                if not in_math:
                    in_math = True
                    math_buffer = []

                converted = unicode_to_latex(text)
                if script == "superscript":
                    converted = f"^{{{converted}}}"
                elif script == "subscript":
                    converted = f"_{{{converted}}}"
                math_buffer.append(converted)
            else:
                if in_math:
                    # 结束数学区域
                    math_content = "".join(math_buffer).strip()
                    if math_content:
                        result_parts.append(f"${math_content}$")
                    in_math = False
                    math_buffer = []

                # 对普通文本中的 Unicode 数学符号也做转换
                if has_math_unicode(text):
                    result_parts.append(f"${unicode_to_latex(text)}$")
                else:
                    result_parts.append(text)

        # 行末仍在数学模式
        if in_math and math_buffer:
            math_content = "".join(math_buffer).strip()
            if math_content:
                result_parts.append(f"${math_content}$")

        return "".join(result_parts)

    def is_block_formula(
        self,
        block_dict: Dict,
        page_width: float,
        center_tolerance: float = 0.15,
    ) -> Tuple[bool, Optional[str]]:
        """判断一个文本块是否为块级公式（居中 + 可能含等式编号）。

        Args:
            block_dict: PyMuPDF block 字典
            page_width: 页面宽度
            center_tolerance: 居中容差（占页面宽度的比例）

        Returns:
            (是否为块级公式, 等式编号或 None)
        """
        bbox = block_dict.get("bbox", [0, 0, page_width, 0])
        x0, x1 = bbox[0], bbox[2]
        block_center = (x0 + x1) / 2
        page_center = page_width / 2

        # 居中判断
        is_centered = abs(block_center - page_center) < page_width * center_tolerance

        # 收集所有文本
        all_text = ""
        has_math_content = False
        for line in block_dict.get("lines", []):
            for span in line.get("spans", []):
                text = span.get("text", "")
                font = span.get("font", "")
                all_text += text
                if is_math_font(font) or has_math_unicode(text):
                    has_math_content = True

        all_text = all_text.strip()
        if not all_text:
            return False, None

        # 等式编号检测: (1), (2), (2.1) 等
        eq_num_match = re.search(r"\((\d+(?:\.\d+)?)\)\s*$", all_text)
        eq_number = eq_num_match.group(1) if eq_num_match else None

        is_block = is_centered and has_math_content
        return is_block, eq_number

    def extract_formulas_from_page(
        self,
        page,
        page_num: int,  # noqa: ANN001 — fitz.Page
    ) -> Tuple[List[str], List[MathRegion]]:
        """从一页 PDF 中提取公式，返回增强文本块和数学区域列表。

        Args:
            page: PyMuPDF Page 对象
            page_num: 页码（0-indexed）

        Returns:
            (enhanced_text_blocks, math_regions)
            - enhanced_text_blocks: 带 LaTeX 标记的文本块列表
            - math_regions: 检测到的数学区域列表
        """
        text_dict = page.get_text("dict")
        page_width = page.rect.width

        enhanced_blocks: List[str] = []
        math_regions: List[MathRegion] = []

        for block in text_dict.get("blocks", []):
            if block.get("type") != 0:  # 跳过非文本块
                continue

            is_block_formula, eq_number = self.is_block_formula(block, page_width)

            block_lines: list[str] = []
            block_has_math = False

            for line in block.get("lines", []):
                reconstructed = self.reconstruct_line_formulas(line)
                if "$" in reconstructed:
                    block_has_math = True
                block_lines.append(reconstructed)

            block_text = " ".join(block_lines).strip()
            if not block_text:
                continue

            if is_block_formula and block_has_math:
                # 提取纯数学内容（去掉等式编号）
                math_content = block_text
                if eq_number:
                    math_content = re.sub(r"\s*\(\d+(?:\.\d+)?\)\s*$", "", math_content)

                # 去除包裹的单层 $ 符号
                inner = math_content.strip()
                if (
                    inner.startswith("$")
                    and inner.endswith("$")
                    and not inner.startswith("$$")
                ):
                    inner = inner[1:-1].strip()

                region = MathRegion(
                    latex=inner,
                    formula_type="block",
                    page_number=page_num,
                    bbox={
                        "x0": block["bbox"][0],
                        "y0": block["bbox"][1],
                        "x1": block["bbox"][2],
                        "y1": block["bbox"][3],
                    },
                    equation_number=eq_number,
                    original_text=block_text,
                )
                math_regions.append(region)

                # 生成块级公式 Markdown
                if eq_number:
                    enhanced_blocks.append(f"$${inner}$$ ({eq_number})")
                else:
                    enhanced_blocks.append(f"$${inner}$$")
            else:
                enhanced_blocks.append(block_text)

                # 检测行内数学区域
                if block_has_math:
                    inline_matches = re.finditer(r"\$([^$]+)\$", block_text)
                    for m in inline_matches:
                        region = MathRegion(
                            latex=m.group(1),
                            formula_type="inline",
                            page_number=page_num,
                            bbox={
                                "x0": block["bbox"][0],
                                "y0": block["bbox"][1],
                                "x1": block["bbox"][2],
                                "y1": block["bbox"][3],
                            },
                            original_text=m.group(0),
                        )
                        math_regions.append(region)

        return enhanced_blocks, math_regions


# ---------------------------------------------------------------------------
# 6. DoclingFormulaEnricher（高保真路径）
# ---------------------------------------------------------------------------


class DoclingFormulaEnricher:
    """基于 Docling CodeFormula 模型的高保真公式提取。

    Docling 使用视觉语言模型 (CodeFormula) 识别 PDF 中的数学公式，
    输出质量高于纯文本分析，但需要额外安装 ``docling`` 包。

    已知问题 (docling#1254)：输出 LaTeX 含空格碎片，需后处理清洗。
    """

    def __init__(self) -> None:
        self._converter = None  # 延迟初始化

    @staticmethod
    def is_available() -> bool:
        """检测 ``docling`` 是否已安装。"""
        try:
            import docling  # noqa: F401

            return True
        except ImportError:
            return False

    def extract_formulas(
        self, pdf_path: str, page_range: Optional[Tuple[int, int]] = None
    ):  # noqa: ANN201
        """调用 Docling 提取公式。

        Args:
            pdf_path: PDF 文件路径
            page_range: 可选的页码范围 (start, end)

        Returns:
            Docling Document 对象
        """
        from docling.document_converter import DocumentConverter, PdfFormatOption  # type: ignore[import-untyped]
        from docling.datamodel.pipeline_options import PdfPipelineOptions  # type: ignore[import-untyped]
        from docling.datamodel.base_models import InputFormat  # type: ignore[import-untyped]
        from docling.datamodel.accelerator_options import (  # type: ignore[import-untyped]
            AcceleratorDevice,
            AcceleratorOptions,
        )
        from .hardware.device_config import resolve_device_config

        device_cfg = resolve_device_config(enable_formula=True)

        pipeline_options = PdfPipelineOptions()
        pipeline_options.do_formula_enrichment = device_cfg.do_formula_enrichment

        accelerator_options = AcceleratorOptions(
            device=AcceleratorDevice(device_cfg.device),
            num_threads=device_cfg.num_threads,
        )
        pipeline_options.accelerator_options = accelerator_options

        converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
            }
        )
        result = converter.convert(pdf_path)
        return result.document

    def get_markdown_with_formulas(self, pdf_path: str) -> str:
        """提取并返回含 LaTeX 公式的 Markdown。"""
        doc = self.extract_formulas(pdf_path)
        raw_md = doc.export_to_markdown()
        return self.postprocess_latex(raw_md)

    @staticmethod
    def postprocess_latex(text: str) -> str:
        """清洗 Docling CodeFormula 输出的已知问题。

        已知问题 (docling#1254):
        - 空格碎片: ``f _ { f i e l d }`` → ``f_{field}``
        - 环境残留: ``\\begin{align}...\\end{align}`` → 纯公式
        - 等式编号碎片: ``(1)`` 被混入公式内部
        """
        if not text:
            return text

        # 1. 压缩 LaTeX 命令内的异常空格
        # "f _ {" → "f_{"
        text = re.sub(r"(\w) _ \{", r"\1_{", text)
        # "f ^ {" → "f^{"
        text = re.sub(r"(\w) \^ \{", r"\1^{", text)
        # "{ f i e l d }" → "{field}"
        text = re.sub(
            r"\{ ([^}]+?) \}",
            lambda m: "{" + m.group(1).replace(" ", "") + "}",
            text,
        )
        # "\ text" → "\text"
        text = re.sub(r"\\ ([a-zA-Z]+)", r"\\\1", text)

        # 1.5 压缩 LaTeX 花括号外裸标识符的空格碎片
        # "C h a r" → "Char", "i m p o r a l" → "imporal"
        # 仅在 $$...$$ 和 $...$ 定界符内操作，且要求至少 3 个连续字母+空格模式
        def _compress_fragmentation(delimited_text: str) -> str:
            def _fix_inline(m: re.Match) -> str:
                body = m.group(1)
                compressed = re.sub(
                    r"\b([a-zA-Z]) ((?:[a-zA-Z] )+[a-zA-Z])\b",
                    lambda inner: inner.group(1) + inner.group(2).replace(" ", ""),
                    body,
                )
                return f"${compressed}$"

            def _fix_block(m: re.Match) -> str:
                body = m.group(1)
                compressed = re.sub(
                    r"\b([a-zA-Z]) ((?:[a-zA-Z] )+[a-zA-Z])\b",
                    lambda inner: inner.group(1) + inner.group(2).replace(" ", ""),
                    body,
                )
                return f"$${compressed}$$"

            # 处理 $$...$$ 块级公式
            delimited_text = re.sub(
                r"\$\$([\s\S]+?)\$\$",
                _fix_block,
                delimited_text,
            )
            # 处理 $...$ 行内公式
            delimited_text = re.sub(
                r"(?<!\$)\$(?!\$)([^$]+?)\$(?!\$)",
                _fix_inline,
                delimited_text,
            )
            return delimited_text

        text = _compress_fragmentation(text)

        # 2. 清理环境包裹（保留内容）
        text = re.sub(r"\\begin\{(align|equation|gather)\*?\}", "", text)
        text = re.sub(r"\\end\{(align|equation|gather)\*?\}", "", text)
        text = re.sub(r"&\s*=", "=", text)  # alignment & 残留

        # 3. 规范化等式编号
        text = re.sub(r"\s*\\tag\{(\d+)\}", r" \\qquad (\1)", text)

        return text.strip()


# ---------------------------------------------------------------------------
# 7. 公式保护工具（供 formatter.py 使用）
# ---------------------------------------------------------------------------

# 匹配所有数学定界符区域
_MATH_DELIMITERS = re.compile(
    r"""
    (?:\$\$[\s\S]+?\$\$)       # $$ ... $$
    |(?:\\\[[\s\S]+?\\\])      # \[ ... \]
    |(?:\\\([\s\S]+?\\\))      # \( ... \)
    |(?<!\$)\$(?!\$)[^$]+?\$   # $ ... $ (排除 $$)
    """,
    re.VERBOSE,
)


def protect_math_content(text: str, process_fn) -> str:  # noqa: ANN001
    """提取数学内容 → 执行处理函数 → 还原数学内容。

    Extract-Process-Restore 模式：保护 LaTeX 数学定界符内的内容
    不被排版修正破坏。

    Args:
        text: 输入文本
        process_fn: 对非数学部分执行的处理函数 ``(str) -> str``

    Returns:
        处理后的文本，数学部分保持不变
    """
    if not text:
        return text

    # 提取所有数学区域，替换为占位符
    placeholders: Dict[str, str] = {}
    counter = 0

    def _replace_with_placeholder(match: re.Match) -> str:
        nonlocal counter
        key = f"\x00MATH_{counter}\x00"
        placeholders[key] = match.group(0)
        counter += 1
        return key

    protected = _MATH_DELIMITERS.sub(_replace_with_placeholder, text)

    # 对非数学部分执行处理
    processed = process_fn(protected)

    # 还原占位符
    for key, original in placeholders.items():
        processed = processed.replace(key, original)

    return processed
