"""S8: Markdown 组装 Stage。

将各并行 Stage（文本、表格、公式、图片、代码）的输出合并为最终 Markdown 文档，
并执行格式化与图片引用规范化。

委托关系：
- ``markdown.formatter.MarkdownFormatter`` — Markdown 格式化管线
- ``markdown.image_ref_normalizer.normalize_image_references()`` — 图片引用规范化
"""

from __future__ import annotations

import logging
import re
from typing import Dict, List, Optional, Tuple

from ...base import Stage, StageResult
from ...models import (
    AssemblyInput,
    AssemblyOutput,
    ExtractedCodeBlock,
    ExtractedFormula,
    ExtractedImage,
    ExtractedTable,
    TextBlock,
)
from ...registry import register_tool
from .._base import PDFToolBase

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 工具适配器
# ---------------------------------------------------------------------------


@register_tool("assembly.builtin_assembler")
class BuiltinAssembler(PDFToolBase):
    """内置 Markdown 组装器。

    将各 Stage 结果按阅读顺序合并为 Markdown 文档，
    并委托 ``MarkdownFormatter`` 和 ``normalize_image_references`` 做后处理。
    """

    tool_name = "builtin_assembler"

    def is_available(self) -> bool:
        return True

    async def _run(self, input_data: AssemblyInput) -> StageResult[AssemblyOutput]:
        """组装 Markdown 文档。"""
        try:
            from ....markdown.formatter import MarkdownFormatter
            from ....markdown.image_ref_normalizer import (
                normalize_image_references,
            )

            # 1. 收集所有内容元素
            elements: List[_ContentElement] = []
            _orphan_block_formulas: List[ExtractedFormula] = []

            # 1a. 构建专用 Stage 的空间占用索引（page → bbox 列表），
            #     用于在添加文本块时进行反向去重：当文本块落入公式/表格/图片
            #     区域时，优先保留专用 Stage 的高保真输出，跳过文本块的冗余版本。
            special_regions: Dict[int, List[Tuple[float, float, float, float]]] = {}
            for formula in input_data.formulas.formulas if input_data.formulas else []:
                if formula.bbox:
                    special_regions.setdefault(formula.page_number, []).append(
                        formula.bbox
                    )
            for table in input_data.tables.tables if input_data.tables else []:
                if table.bbox:
                    special_regions.setdefault(table.page_number, []).append(table.bbox)
            for img in input_data.images.images if input_data.images else []:
                if img.bbox:
                    special_regions.setdefault(img.page_number, []).append(img.bbox)

            # 1b. 预扫描：收集文本块中的表格与公式指纹，用于跨 Stage 去重
            text_table_fingerprints: set[str] = set()
            text_formula_fingerprints: set[str] = set()
            if input_data.text and input_data.text.blocks:
                for block in input_data.text.blocks:
                    text = block.text.strip()
                    # 表格指纹：首行非空单元格的拼接（跳过 separator 行）
                    if text.startswith("|"):
                        first_data_row = _extract_table_fingerprint(text)
                        if first_data_row:
                            text_table_fingerprints.add(first_data_row)
                    # 公式指纹：LaTeX 核心内容（去除空白）
                    if "$$" in text:
                        for m in re.finditer(r"\$\$(.*?)\$\$", text, re.DOTALL):
                            core = m.group(1).strip().replace(" ", "")
                            if len(core) > 10:
                                text_formula_fingerprints.add(core)

            # 文本块（反向去重：跳过落入专用 Stage 区域的文本块）
            if input_data.text and input_data.text.blocks:
                for block in input_data.text.blocks:
                    if _block_overlaps_special(
                        block, special_regions, iou_threshold=0.3
                    ):
                        continue
                    elements.append(
                        _ContentElement(
                            reading_order=block.reading_order,
                            page_number=block.page_number,
                            element_type="text",
                            content=_text_block_to_markdown(block),
                            block=block,
                        )
                    )

            # 表格（正向去重：跳过文本块中已存在的表格）
            if input_data.tables:
                for table in input_data.tables.tables:
                    md = table.markdown.strip() if table.markdown else ""
                    fp = _extract_table_fingerprint(md) if md.startswith("|") else ""
                    if fp and fp in text_table_fingerprints:
                        continue
                    elements.append(
                        _ContentElement(
                            reading_order=table.reading_order,
                            page_number=table.page_number,
                            element_type="table",
                            content=_table_to_markdown(table),
                            table=table,
                        )
                    )

            # 公式（有 bbox 的正常插入；无 bbox 的通过文本匹配升级为 LaTeX）
            if input_data.formulas:
                for formula in input_data.formulas.formulas:
                    if formula.bbox:
                        latex_core = (
                            formula.latex.strip().replace(" ", "")
                            if formula.latex
                            else ""
                        )
                        if (
                            len(latex_core) > 10
                            and latex_core in text_formula_fingerprints
                        ):
                            continue
                        elements.append(
                            _ContentElement(
                                reading_order=formula.reading_order,
                                page_number=formula.page_number,
                                element_type="formula",
                                content=_formula_to_markdown(formula),
                                formula=formula,
                            )
                        )
                    elif formula.latex and formula.formula_type == "block":
                        # 无 bbox 的块级公式：尝试在文本块中定位并标记替换
                        # 收集到临时列表，排序后通过文本匹配定位
                        _orphan_block_formulas.append(formula)

            # 代码块
            if input_data.code:
                for code_block in input_data.code.code_blocks:
                    elements.append(
                        _ContentElement(
                            reading_order=code_block.reading_order,
                            page_number=code_block.page_number,
                            element_type="code",
                            content=_code_block_to_markdown(code_block),
                            code_block=code_block,
                        )
                    )

            # 图片：落入表格 bbox 的散落图片（如表格内 logo）应予跳过，
            # 因为表格的 Markdown 版本已包含完整文本内容。
            # 同一页内 bbox 高度重叠的图片视为重复（不同引擎提取同一图），
            # 保留有 caption 的版本。
            table_bboxes: Dict[int, List[Tuple[float, float, float, float]]] = {}
            if input_data.tables:
                for table in input_data.tables.tables:
                    if table.bbox:
                        table_bboxes.setdefault(table.page_number, []).append(
                            table.bbox
                        )
            if input_data.images and input_data.images.images:
                # 先收集所有候选图片（排除落入表格区域的）
                image_candidates: List[ExtractedImage] = []
                for image in input_data.images.images:
                    if image.bbox and image.page_number in table_bboxes:
                        img_cx = (image.bbox[0] + image.bbox[2]) / 2
                        img_cy = (image.bbox[1] + image.bbox[3]) / 2
                        skip = False
                        for tx0, ty0, tx1, ty1 in table_bboxes[image.page_number]:
                            if tx0 <= img_cx <= tx1 and ty0 <= img_cy <= ty1:
                                skip = True
                                break
                        if skip:
                            continue
                    image_candidates.append(image)

                # 空间重叠去重：同页 bbox 中心点包含或 IoU > 0.3 的图片
                # 保留有 caption 的版本（不同引擎提取同一图时 caption 质量不同）
                removed: set[int] = set()
                for i in range(len(image_candidates)):
                    if i in removed:
                        continue
                    img_a = image_candidates[i]
                    if not img_a.bbox:
                        continue
                    for j in range(i + 1, len(image_candidates)):
                        if j in removed:
                            continue
                        img_b = image_candidates[j]
                        if img_a.page_number != img_b.page_number or not img_b.bbox:
                            continue
                        # 中心点包含：A 的中心落在 B 内 或 B 的中心落在 A 内
                        ca_x = (img_a.bbox[0] + img_a.bbox[2]) / 2
                        ca_y = (img_a.bbox[1] + img_a.bbox[3]) / 2
                        cb_x = (img_b.bbox[0] + img_b.bbox[2]) / 2
                        cb_y = (img_b.bbox[1] + img_b.bbox[3]) / 2
                        overlap = (
                            (
                                img_b.bbox[0] <= ca_x <= img_b.bbox[2]
                                and img_b.bbox[1] <= ca_y <= img_b.bbox[3]
                            )
                            or (
                                img_a.bbox[0] <= cb_x <= img_a.bbox[2]
                                and img_a.bbox[1] <= cb_y <= img_a.bbox[3]
                            )
                            or _compute_iou(img_a.bbox, img_b.bbox) > 0.3
                        )
                        if overlap:
                            # 移除没有 caption 的版本，都没有则移除后出现的
                            if img_b.caption and not img_a.caption:
                                removed.add(i)
                                break  # i 已被移除，无需继续比较
                            else:
                                removed.add(j)

                kept_indices = set(range(len(image_candidates))) - removed

                for idx in sorted(kept_indices):
                    image = image_candidates[idx]
                    elements.append(
                        _ContentElement(
                            reading_order=image.reading_order,
                            page_number=image.page_number,
                            element_type="image",
                            content=_image_to_markdown(image),
                            image=image,
                        )
                    )

            # 2. 四级稳定排序：page → y0 → x0 → reading_order
            #    - page：0-based 页码，前序 Stage 已在边界归一化
            #    - y0：bbox 顶部纵坐标（TopLeft 坐标系），缺失时退化到 reading_order * 100
            #    - x0：bbox 左侧横坐标，作为多列布局列序兜底（先左列后右列）
            #    - reading_order：稳定序兜底，保证同坐标元素遵循 Stage 内部序
            #
            #    无 bbox 的孤立元素（如公式提取缺少坐标）排在同页定位内容之后，
            #    避免错误地排到页首。
            def _sort_key(
                elem: _ContentElement,
            ) -> Tuple[int, float, float, int]:
                page = elem.page_number if elem.page_number is not None else 0
                page = max(0, page)  # 防御：避免负页码排到首页之前
                bbox: Optional[Tuple[float, float, float, float]] = None
                if elem.image and elem.image.bbox:
                    bbox = elem.image.bbox
                elif elem.block and elem.block.bbox:
                    bbox = elem.block.bbox
                elif elem.table and elem.table.bbox:
                    bbox = elem.table.bbox
                elif elem.formula and elem.formula.bbox:
                    bbox = elem.formula.bbox
                elif elem.code_block and elem.code_block.bbox:
                    bbox = elem.code_block.bbox
                if bbox is not None:
                    y_pos = float(bbox[1])
                    x_pos = float(bbox[0])
                else:
                    # 孤立元素排在同页定位内容之后（1e6 远大于任何合理的 y0）
                    y_pos = 1_000_000.0 + elem.reading_order
                    x_pos = 0.0
                return (page, y_pos, x_pos, elem.reading_order)

            elements.sort(key=_sort_key)

            # 2.1 标题层级规范化：学术论文中首个 H1 为论文标题，
            #     后续标题应整体下移一级（H1→H2, H2→H3, H3→H4），
            #     避免所有 section 与标题同级。
            _first_h1_seen = False
            for elem in elements:
                content = elem.content.strip()
                if not content.startswith("#"):
                    continue
                level = len(content) - len(content.lstrip("#"))
                if level == 1 and not _first_h1_seen:
                    _first_h1_seen = True
                    continue  # 论文标题保持 H1
                if _first_h1_seen and level >= 1:
                    # 下移一级，最大到 H5
                    new_level = min(level + 1, 5)
                    new_content = "#" * new_level + content[level:]
                    elem.content = new_content

            # 2.2 无 bbox 块级公式：通过公式编号或数学符号在文本块中定位并替换
            #    策略 1：通过公式编号（如 LaTeX 末尾的 \quad (N)）匹配
            #    策略 2：通过数学符号 + 公式特征匹配
            if _orphan_block_formulas:
                _used_formula_indices: set[int] = set()
                for elem in elements:
                    if elem.element_type != "text" or not elem.block:
                        continue
                    text = elem.block.text.strip()
                    if not text or text.startswith("#") or len(text) < 10:
                        continue
                    for fi, formula in enumerate(_orphan_block_formulas):
                        if fi in _used_formula_indices or not formula.latex:
                            continue
                        matched = False
                        # 策略 1：公式编号匹配（最可靠）
                        eq_num = re.search(r"\\quad\s*\(\s*(\d+)\s*\)", formula.latex)
                        if eq_num:
                            num_str = f"({eq_num.group(1)})"
                            if num_str in text:
                                matched = True
                        # 策略 2：数学符号 + LaTeX 关键词匹配
                        if not matched:
                            _math_symbols = [
                                "→",
                                "∑",
                                "∈",
                                "∪",
                                "⊆",
                                "θ",
                                "φ",
                                "≥",
                                "≤",
                                "∧",
                                "…",
                            ]
                            _has_math = any(s in text for s in _math_symbols)
                            latex_ids = re.findall(r"\\[a-zA-Z]+", formula.latex)
                            _latex_names = [
                                n.replace("\\", "")
                                for n in latex_ids
                                if n
                                not in (
                                    "\\quad",
                                    "\\colon",
                                    "\\to",
                                    "\\left",
                                    "\\right",
                                    "\\dots",
                                    "\\text",
                                )
                            ]
                            _name_match = any(
                                n.lower() in text.lower() for n in _latex_names
                            )
                            if _has_math and _name_match:
                                matched = True
                        if matched:
                            formula_md = _formula_to_markdown(formula)
                            elem.content = formula_md
                            elem.element_type = "formula"
                            elem.formula = formula
                            elem.block = None
                            _used_formula_indices.add(fi)
                            break

            # 2.5 去重：移除重复标题与重复 Figure/Table 注释
            #    标题去重：
            #    a) 两个相邻标题归一化后相同 → 移除前者（通常是 TOC 版本）
            #    b) 同一标题文本在不同页重复出现（如 "References"）→ 只保留首次
            #    注释去重：
            #    c) "Table N:" / "Figure N:" 开头的注释文本在不同元素中重复出现
            _seen: set[str] = set()
            _seen_caption: set[str] = set()
            _prev: str | None = None
            _dd: List[_ContentElement] = []
            for elem in elements:
                content = elem.content.strip()
                is_heading = content.startswith("#")
                if is_heading:
                    raw = content.lstrip("#").strip()
                    norm = re.sub(r"[.\s]+", " ", raw.lower())
                    # 场景 a: 紧邻重复标题（前一个也是标题）→ 移除前者
                    if _prev is not None and norm == _prev:
                        if _dd and _dd[-1].content.strip().startswith("#"):
                            _dd.pop()
                    # 场景 b: 非紧邻的重复标题（多页重复如 References）→ 跳过后续
                    elif norm in _seen:
                        _prev = norm
                        continue
                    _seen.add(norm)
                    _prev = norm
                else:
                    _prev = None
                    # 场景 c: 重复 Figure/Table 注释去重
                    # 仅提取 "Table/Figure N: ..." 注释文本部分进行指纹比较，
                    # 而非整个元素内容（表格元素包含完整 Markdown 表格）
                    cap_match = re.search(
                        r"((?:Table|Figure)\s+\d+[:.][^\n]+)",
                        content,
                        re.IGNORECASE,
                    )
                    if cap_match:
                        cap_text = cap_match.group(1)
                        cap_norm = re.sub(r"[-*\s]+", " ", cap_text.lower()).strip()
                        if cap_norm in _seen_caption:
                            continue
                        _seen_caption.add(cap_norm)
                _dd.append(elem)
            elements = _dd

            # 3. 拼接 Markdown
            markdown_parts: List[str] = []
            for elem in elements:
                markdown_parts.append(elem.content)

            markdown = "\n\n".join(markdown_parts)

            # 4. 图片引用规范化
            images: List[ExtractedImage] = []
            if input_data.images:
                images = input_data.images.images

            # 构造 ImageMeta 兼容的适配对象
            class _ImageMetaAdapter:
                def __init__(self, img: ExtractedImage):
                    self._img = img

                @property
                def filename(self) -> Optional[str]:
                    return self._img.filename

                @property
                def caption(self) -> Optional[str]:
                    return self._img.caption

            adapted_images = [_ImageMetaAdapter(img) for img in images]
            markdown = normalize_image_references(markdown, adapted_images)

            # 5. Markdown 格式化
            formatter = MarkdownFormatter()
            markdown = formatter.format(markdown)

            word_count = len(markdown.split())

            output = AssemblyOutput(
                markdown=markdown,
                word_count=word_count,
                metadata={
                    "engine": "builtin_assembler",
                    "text_blocks": (
                        len(input_data.text.blocks) if input_data.text else 0
                    ),
                    "tables": (
                        input_data.tables.total_count if input_data.tables else 0
                    ),
                    "formulas": (
                        len(input_data.formulas.formulas) if input_data.formulas else 0
                    ),
                    "images": (
                        input_data.images.total_count if input_data.images else 0
                    ),
                    "code_blocks": (
                        input_data.code.total_count if input_data.code else 0
                    ),
                },
            )

            return StageResult(
                success=True,
                output=output,
                engine_used=self.tool_name,
            )

        except Exception as e:
            logger.exception("Markdown 组装失败")
            return StageResult(success=False, error=f"Markdown 组装失败: {e}")


# ---------------------------------------------------------------------------
# 辅助数据结构
# ---------------------------------------------------------------------------


class _ContentElement:
    """内容元素包装，用于统一排序。"""

    __slots__ = (
        "reading_order",
        "page_number",
        "element_type",
        "content",
        "block",
        "table",
        "formula",
        "code_block",
        "image",
    )

    def __init__(
        self,
        reading_order: int,
        page_number: int,
        element_type: str,
        content: str,
        block: Optional[TextBlock] = None,
        table: Optional[ExtractedTable] = None,
        formula: Optional[ExtractedFormula] = None,
        code_block: Optional[ExtractedCodeBlock] = None,
        image: Optional[ExtractedImage] = None,
    ) -> None:
        self.reading_order = reading_order
        self.page_number = page_number
        self.element_type = element_type
        self.content = content
        self.block = block
        self.table = table
        self.formula = formula
        self.code_block = code_block
        self.image = image


# ---------------------------------------------------------------------------
# Markdown 转换辅助函数
# ---------------------------------------------------------------------------


def _extract_table_fingerprint(table_text: str) -> str:
    """提取 Markdown 表格的首行数据单元格指纹（用于去重比较）。

    跳过 separator 行（如 ``|---|---|``），取第一个含实际数据的行，
    去除管道符和空白后作为指纹。
    """
    for line in table_text.split("\n"):
        line = line.strip()
        if not line.startswith("|"):
            continue
        # 跳过 separator 行
        if set(line.replace("|", "").replace("-", "").replace(":", "").strip()) <= {
            " ",
        }:
            continue
        cells = [c.strip() for c in line.split("|") if c.strip()]
        if cells:
            return "|".join(cells)
    return ""


def _compute_iou(
    a: Tuple[float, float, float, float],
    b: Tuple[float, float, float, float],
) -> float:
    """计算两个 bbox 的交并比 (IoU)。"""
    x0 = max(a[0], b[0])
    y0 = max(a[1], b[1])
    x1 = min(a[2], b[2])
    y1 = min(a[3], b[3])
    inter = max(0.0, x1 - x0) * max(0.0, y1 - y0)
    if inter <= 0:
        return 0.0
    area_a = (a[2] - a[0]) * (a[3] - a[1])
    area_b = (b[2] - b[0]) * (b[3] - b[1])
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


def _block_overlaps_special(
    block: TextBlock,
    special_regions: Dict[int, List[Tuple[float, float, float, float]]],
    iou_threshold: float = 0.3,
) -> bool:
    """判断文本块是否与专用 Stage 区域存在空间重叠。

    使用两种策略：
    1. 包含检测：文本块中心点落入特殊区域（文本块被大区域包裹）
    2. IoU 检测：文本块与特殊区域面积重叠超过阈值（尺寸接近的元素）
    """
    if not block.bbox:
        return False
    regions = special_regions.get(block.page_number)
    if not regions:
        return False
    bx0, by0, bx1, by1 = block.bbox
    for rx0, ry0, rx1, ry1 in regions:
        # 策略 1: 包含检测 — 文本块中心点落入特殊区域
        cx, cy = (bx0 + bx1) / 2, (by0 + by1) / 2
        if rx0 <= cx <= rx1 and ry0 <= cy <= ry1:
            return True
        # 策略 2: IoU 检测 — 面积重叠
        if _compute_iou(block.bbox, (rx0, ry0, rx1, ry1)) >= iou_threshold:
            return True
    return False


def _text_block_to_markdown(block: TextBlock) -> str:
    """将 TextBlock 转换为 Markdown 文本。"""
    if block.block_type == "heading" and block.heading_level:
        return f"{'#' * block.heading_level} {block.text}"
    return block.text


def _table_to_markdown(table: ExtractedTable) -> str:
    """将表格转换为 Markdown（带可选标题）。

    当 table.markdown 已包含 caption 文本时，不再额外添加，
    避免 table 元素内部出现重复标题。
    """
    md = table.markdown
    if table.caption and table.caption.strip():
        cap_stripped = table.caption.strip()
        # 检查 markdown 首行是否已包含 caption 文本
        first_line = md.split("\n", 1)[0].strip() if md else ""
        if first_line != cap_stripped:
            return f"**{cap_stripped}**\n\n{md}"
    return md


def _formula_to_markdown(formula: ExtractedFormula) -> str:
    """将公式转换为 Markdown LaTeX。"""
    if formula.formula_type == "inline":
        return f"${formula.latex}$"
    return f"$$\n{formula.latex}\n$$"


def _code_block_to_markdown(code_block: ExtractedCodeBlock) -> str:
    """将代码块转换为 Markdown 代码围栏。"""
    lang = code_block.language or ""
    return f"```{lang}\n{code_block.code}\n```"


def _image_to_markdown(image: ExtractedImage) -> str:
    """将图片转换为 Markdown 图片引用。"""
    alt = image.caption or image.filename or "image"
    return f"![{alt}](./images/{image.filename})"


# ---------------------------------------------------------------------------
# Stage 本地工具映射
# ---------------------------------------------------------------------------

_TOOLS: Dict[str, type] = {
    "builtin_assembler": BuiltinAssembler,
}


# ---------------------------------------------------------------------------
# Stage 类
# ---------------------------------------------------------------------------


class AssemblyStage(Stage[AssemblyInput, AssemblyOutput]):
    """S8: Markdown 组装 Stage。"""

    STAGE_ID = "assembly"
    STAGE_NAME = "Markdown 组装"
    TOOLS = _TOOLS

    @property
    def stage_id(self) -> str:
        return self.STAGE_ID

    @property
    def stage_name(self) -> str:
        return self.STAGE_NAME

    async def execute(self, input_data: AssemblyInput) -> StageResult[AssemblyOutput]:
        """执行 Markdown 组装。"""
        for tool_cls in _TOOLS.values():
            tool = tool_cls()
            if tool.is_available():
                return await tool.execute(input_data)
        return StageResult(success=False, error="无可用的组装工具")
