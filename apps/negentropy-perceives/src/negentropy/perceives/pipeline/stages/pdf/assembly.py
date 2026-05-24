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

            # 1a. 预扫描：收集文本块中的表格与公式指纹，用于跨 Stage 去重
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

            # 文本块
            if input_data.text and input_data.text.blocks:
                for block in input_data.text.blocks:
                    elements.append(
                        _ContentElement(
                            reading_order=block.reading_order,
                            page_number=block.page_number,
                            element_type="text",
                            content=_text_block_to_markdown(block),
                            block=block,
                        )
                    )

            # 表格（去重：跳过文本块中已存在的表格）
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

            # 公式（去重：跳过文本块中已存在的公式）
            if input_data.formulas:
                for formula in input_data.formulas.formulas:
                    latex_core = (
                        formula.latex.strip().replace(" ", "") if formula.latex else ""
                    )
                    if len(latex_core) > 10 and latex_core in text_formula_fingerprints:
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

            # 图片：全部加入元素列表，由统一排序决定位置。
            # normalize_image_references 会处理 <!-- image --> 占位符替换。
            if input_data.images and input_data.images.images:
                for image in input_data.images.images:
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


def _text_block_to_markdown(block: TextBlock) -> str:
    """将 TextBlock 转换为 Markdown 文本。"""
    if block.block_type == "heading" and block.heading_level:
        return f"{'#' * block.heading_level} {block.text}"
    return block.text


def _table_to_markdown(table: ExtractedTable) -> str:
    """将表格转换为 Markdown（带可选标题）。"""
    parts: List[str] = []
    if table.caption:
        parts.append(f"**{table.caption}**")
    parts.append(table.markdown)
    return "\n\n".join(parts)


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
