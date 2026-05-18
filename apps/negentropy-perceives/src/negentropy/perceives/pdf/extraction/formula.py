"""PDF 公式提取模块。

负责从 PDF 页面文本中识别和提取数学公式，支持两层检测：
1. **LaTeX 定界符匹配**：``$...$``、``$$...$$``、``\\[...\\]``、``\\(...\\)``
2. **Unicode 数学符号检测**：当无 LaTeX 定界符时自动启用，
   利用 ``math_formula`` 模块的转换能力。
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Dict, List, Optional

from ._shared import generate_asset_id

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 数据类
# ---------------------------------------------------------------------------


@dataclass
class ExtractedFormula:
    """提取的数学公式数据类。"""

    id: str
    latex: str
    formula_type: str  # "inline" or "block"
    page_number: Optional[int] = None
    position: Optional[Dict[str, float]] = None
    description: Optional[str] = None


# ---------------------------------------------------------------------------
# 公式提取函数
# ---------------------------------------------------------------------------


def extract_formulas_from_text(text: str, page_num: int) -> List[ExtractedFormula]:
    """从文本中提取数学公式。

    支持两层检测：
    1. LaTeX 定界符匹配（``$...$``, ``$$...$$``, ``\\\\[...\\\\]``, ``\\\\(...\\\\)``）
    2. Unicode 数学符号检测（当 Layer 1 无结果时自动启用）

    Args:
        text: PDF 页面文本内容。
        page_num: 页码。

    Returns:
        ``ExtractedFormula`` 列表。
    """
    formulas: List[ExtractedFormula] = []

    try:
        # 延迟导入避免循环依赖
        from ..math_formula import unicode_to_latex, has_math_unicode

        # Layer 1: LaTeX 定界符匹配
        patterns = [
            (r"\\\[\s*([^]]+?)\s*\\\]", "block"),
            (r"\$\$\s*([^$]+?)\s*\$\$", "block"),
            (r"\\\(\s*([^)]+?)\s*\\\)", "inline"),
            (r"(?<!\$)\$([^$]+?)\$(?!\$)", "inline"),
        ]

        formula_index = 0
        matched_ranges = set()

        for pattern, formula_type in patterns:
            matches = re.finditer(pattern, text, re.MULTILINE | re.DOTALL)

            for match in matches:
                formula_content = match.group(1).strip()

                if formula_content and len(formula_content) > 1:
                    formula_id = generate_asset_id("formula", page_num, formula_index)

                    extracted_formula = ExtractedFormula(
                        id=formula_id,
                        latex=formula_content,
                        formula_type=formula_type,
                        page_number=page_num,
                        position={
                            "start": match.start(),
                            "end": match.end(),
                        },
                    )

                    formulas.append(extracted_formula)
                    matched_ranges.add((match.start(), match.end()))
                    formula_index += 1

                    logger.info(
                        f"Extracted {formula_type} formula {formula_id} from page {page_num}"
                    )

        # Layer 2: Unicode 数学符号检测
        if not formulas and has_math_unicode(text):
            for line in text.split("\n"):
                line_stripped = line.strip()
                if not line_stripped or not has_math_unicode(line_stripped):
                    continue

                latex_converted = unicode_to_latex(line_stripped)
                if latex_converted != line_stripped:
                    formula_id = generate_asset_id("formula", page_num, formula_index)
                    extracted_formula = ExtractedFormula(
                        id=formula_id,
                        latex=latex_converted,
                        formula_type="inline",
                        page_number=page_num,
                        description="Unicode math symbols detected",
                    )
                    formulas.append(extracted_formula)
                    formula_index += 1

    except Exception as e:
        logger.error(f"Error extracting formulas from page {page_num}: {str(e)}")

    return formulas
