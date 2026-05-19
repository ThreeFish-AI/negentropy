"""增强 PDF 处理模块（向后兼容层）。

原始实现已正交分解至 ``extraction/`` 子路径：
- ``extraction.image``：图片提取
- ``extraction.table``：表格提取
- ``extraction.formula``：公式提取
- ``extraction._shared``：共享工具函数

本文件保留 ``EnhancedPDFProcessor`` 类作为外观（Facade），
内部委托至子模块函数，确保所有现有调用方无需修改。
"""

from __future__ import annotations

import logging
import os
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# 从子路径重新导出数据类，保持向后兼容
from .extraction import (
    ExtractedFormula,
    ExtractedImage,
    ExtractedTable,
)
from .extraction.formula import extract_formulas_from_text
from .extraction.image import (
    detect_image_caption,
    extract_images_from_pdf_page,
    extract_images_with_positions,
    generate_image_name,
)
from .extraction.table import (
    build_markdown_from_data,
    convert_to_markdown_table,
    detect_table_caption,
    extract_table_headers,
    extract_tables_from_text,
    extract_tables_with_geometry,
    is_table_row,
    merge_table_columns_and_rows,
)

logger = logging.getLogger(__name__)


class EnhancedPDFProcessor:
    """增强 PDF 处理器（Facade），委托至 extraction 子模块。

    保持与原始 ``EnhancedPDFProcessor`` 完全相同的公共 API，
    内部实现委托至 ``extraction`` 子路径的独立函数。
    """

    def __init__(self, output_dir: Optional[str] = None):
        """初始化增强 PDF 处理器。

        Args:
            output_dir: 提取资产的保存目录。
        """
        self.logger = logging.getLogger(__name__)

        if output_dir:
            self.output_dir = Path(output_dir)
            self.output_dir.mkdir(parents=True, exist_ok=True)
        else:
            self.output_dir = Path(tempfile.mkdtemp(prefix="enhanced_pdf_"))

        self.images: List[ExtractedImage] = []
        self.tables: List[ExtractedTable] = []
        self.formulas: List[ExtractedFormula] = []

        self.extract_images = True
        self.extract_tables = True
        self.extract_formulas = True

    # ------------------------------------------------------------------
    # 向后兼容的类方法 → 委托至子模块独立函数
    # ------------------------------------------------------------------

    @staticmethod
    def _generate_asset_id(asset_type: str, page_num: int, index: int) -> str:
        from .extraction._shared import generate_asset_id as _gen

        return _gen(asset_type, page_num, index)

    @staticmethod
    def _slugify(text: str, max_length: int = 60) -> str:
        from .extraction._shared import slugify

        return slugify(text, max_length)

    @staticmethod
    def _detect_caption(
        text_blocks: list,
        img_y1: float,
        img_x0: float,
        img_x1: float,
        tolerance: float = 30.0,
    ) -> Optional[str]:
        return detect_image_caption(text_blocks, img_y1, img_x0, img_x1, tolerance)

    @staticmethod
    def _generate_image_name(
        page_num: int,
        img_index: int,
        xref_name: str = "",
        caption: Optional[str] = None,
        nearby_text: str = "",
        pdf_name: str = "",
    ) -> str:
        return generate_image_name(
            page_num, img_index, xref_name, caption, nearby_text, pdf_name
        )

    async def extract_images_from_pdf_page(
        self, pdf_document, page_num: int, image_format: str = "png"
    ) -> List[ExtractedImage]:  # type: ignore[override]
        result = await extract_images_from_pdf_page(
            pdf_document, page_num, self.output_dir, image_format
        )
        self.images.extend(result)
        return result

    async def extract_images_with_positions(
        self,
        pdf_document,
        page_num: int,
        text_blocks: list,
        output_dir: Path,
        collected_images: List[ExtractedImage],
        image_format: str = "png",
        pdf_name: str = "",
    ) -> Dict[int, ExtractedImage]:
        result = await extract_images_with_positions(
            pdf_document,
            page_num,
            text_blocks,
            output_dir,
            collected_images,
            image_format,
            pdf_name,
        )
        self.images.extend(img for img in collected_images if img not in self.images)
        return result

    def _detect_table_caption(
        self,
        text_blocks: list,
        table_bbox: Tuple[float, float, float, float],
        tolerance: float = 30.0,
    ) -> Optional[str]:
        return detect_table_caption(text_blocks, table_bbox, tolerance)

    def extract_tables_with_geometry(
        self,
        pdf_document,
        page_num: int,
        text_blocks: list,
    ) -> Tuple[
        Dict[Tuple[float, float, float, float], ExtractedTable], List[ExtractedTable]
    ]:
        bbox_map, all_tables = extract_tables_with_geometry(
            pdf_document,
            page_num,
            text_blocks,
        )
        self.tables.extend(all_tables)
        return bbox_map, all_tables

    def _find_table_title_regions(self, page, text_blocks, page_rect):
        from .extraction.table import _find_table_title_regions

        return _find_table_title_regions(page, text_blocks, page_rect)

    def _extract_single_table(
        self, page, clip_rect, title, title_rect, text_blocks, page_num, table_idx
    ):
        from .extraction.table import _extract_single_table

        return _extract_single_table(
            page, clip_rect, title, title_rect, text_blocks, page_num, table_idx
        )

    def _find_tables_fullpage(self, page):
        from .extraction.table import _find_tables_fullpage

        return _find_tables_fullpage(page)

    def _process_found_table(self, table, text_blocks, page_num, table_idx):
        from .extraction.table import _process_found_table

        return _process_found_table(table, text_blocks, page_num, table_idx)

    @staticmethod
    def _merge_table_columns_and_rows(data):
        return merge_table_columns_and_rows(data)

    @staticmethod
    def _build_markdown_from_data(data):
        return build_markdown_from_data(data)

    def extract_tables_from_text(
        self, text: str, page_num: int
    ) -> List[ExtractedTable]:
        result = extract_tables_from_text(text, page_num)
        self.tables.extend(result)
        return result

    def extract_formulas_from_text(
        self, text: str, page_num: int
    ) -> List[ExtractedFormula]:
        result = extract_formulas_from_text(text, page_num)
        self.formulas.extend(result)
        return result

    def _is_table_row(self, line: str) -> bool:
        return is_table_row(line)

    def _has_multiple_space_separators(self, line: str) -> bool:
        from .extraction.table import _has_multiple_space_separators

        return _has_multiple_space_separators(line)

    def _convert_to_markdown_table(self, table_lines: List[str]) -> str:
        return convert_to_markdown_table(table_lines)

    def _extract_table_headers(self, header_line: str) -> List[str]:
        return extract_table_headers(header_line)

    def enhance_markdown_with_assets(
        self,
        original_markdown: str,
        embed_images: bool = False,
        image_size: Optional[Tuple[int, int]] = None,
    ) -> str:
        """增强 Markdown 内容，附加提取的图片、表格、公式。

        已内联插入的资产（文件名出现在 markdown 中）会被跳过，
        仅追加未放置的资产作为兜底。

        Args:
            original_markdown: 原始 Markdown 内容。
            embed_images: 是否以 base64 嵌入图片。
            image_size: 可选的图片缩放尺寸。

        Returns:
            增强后的 Markdown 内容。
        """
        enhanced_content = original_markdown

        try:
            unplaced_images = [
                img for img in self.images if img.filename not in original_markdown
            ]

            if unplaced_images:
                enhanced_content += "\n\n## Extracted Images\n\n"
                for img in unplaced_images:
                    if embed_images and img.base64_data:
                        enhanced_content += (
                            f"![{img.caption or img.filename}]"
                            f"(data:{img.mime_type};base64,{img.base64_data})\n\n"
                        )
                    else:
                        enhanced_content += (
                            f"![{img.caption or img.filename}]({img.filename})\n\n"
                        )

                    if img.width and img.height:
                        enhanced_content += (
                            f"*Dimensions: {img.width}\u00d7{img.height}px*\n"
                        )
                    if img.page_number is not None:
                        enhanced_content += f"*Source: Page {img.page_number + 1}*\n"
                    enhanced_content += "\n"

            if self.tables:
                unplaced_tables = []
                for table in self.tables:
                    first_row = (
                        table.markdown.split("\n")[0].strip() if table.markdown else ""
                    )
                    if first_row and first_row in enhanced_content:
                        continue
                    unplaced_tables.append(table)

                if unplaced_tables:
                    enhanced_content += "\n## Extracted Tables\n\n"
                    for table in unplaced_tables:
                        if table.caption:
                            enhanced_content += f"**{table.caption}**\n\n"
                        enhanced_content += table.markdown + "\n\n"
                        enhanced_content += (
                            f"*Table: {table.rows} rows \u00d7 "
                            f"{table.columns} columns*\n"
                        )
                        if table.page_number is not None:
                            enhanced_content += (
                                f"*Source: Page {table.page_number + 1}*\n"
                            )
                        enhanced_content += "\n"

            if self.formulas:
                enhanced_content += "\n## Mathematical Formulas\n\n"
                for formula in self.formulas:
                    if formula.formula_type == "block":
                        enhanced_content += f"\n$$\n{formula.latex}\n$$\n\n"
                    else:
                        enhanced_content += f"${formula.latex}$\n\n"
                    if formula.description:
                        enhanced_content += f"*{formula.description}*\n"
                    if formula.page_number is not None:
                        enhanced_content += (
                            f"*Source: Page {formula.page_number + 1}*\n"
                        )
                    enhanced_content += "\n"

        except Exception as e:
            self.logger.error(f"Error enhancing Markdown with assets: {str(e)}")

        return enhanced_content

    def get_extraction_summary(self) -> Dict[str, Any]:
        """获取所有提取内容的摘要。"""
        return {
            "images": {
                "count": len(self.images),
                "files": [img.filename for img in self.images],
                "total_size_mb": sum(
                    os.path.getsize(img.local_path)
                    for img in self.images
                    if os.path.exists(img.local_path)
                )
                / (1024 * 1024),
            },
            "tables": {
                "count": len(self.tables),
                "total_rows": sum(t.rows for t in self.tables),
                "total_columns": sum(t.columns for t in self.tables),
            },
            "formulas": {
                "count": len(self.formulas),
                "inline_count": len(
                    [f for f in self.formulas if f.formula_type == "inline"]
                ),
                "block_count": len(
                    [f for f in self.formulas if f.formula_type == "block"]
                ),
            },
            "output_directory": str(self.output_dir),
        }

    def cleanup(self):
        """清理临时文件并重置处理器状态。"""
        try:
            self.images.clear()
            self.tables.clear()
            self.formulas.clear()
        except Exception as e:
            self.logger.error(f"Error during cleanup: {str(e)}")
