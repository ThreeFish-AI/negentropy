"""PDF 增强资源提取子路径。

将图片、表格、公式三大提取职责正交分解为独立模块，
通过统一导出提供与原 ``EnhancedPDFProcessor`` 兼容的公共 API。

模块结构：

- ``image``：图片提取（``ExtractedImage`` + 提取函数）
- ``table``：表格提取（``ExtractedTable`` + 提取函数）
- ``formula``：公式提取（``ExtractedFormula`` + 提取函数）
- ``_shared``：跨模块共享工具（asset ID 生成、slug 化）
"""

from __future__ import annotations

from .formula import ExtractedFormula, extract_formulas_from_text
from .image import (
    ExtractedImage,
    detect_image_caption,
    extract_images_from_pdf_page,
    extract_images_with_positions,
    generate_image_name,
)
from .table import (
    ExtractedTable,
    build_markdown_from_data,
    convert_to_markdown_table,
    detect_table_caption,
    extract_table_headers,
    extract_tables_from_text,
    extract_tables_with_geometry,
    is_table_row,
    merge_table_columns_and_rows,
)

__all__ = [
    # 数据类
    "ExtractedImage",
    "ExtractedTable",
    "ExtractedFormula",
    # 图片函数
    "detect_image_caption",
    "extract_images_from_pdf_page",
    "extract_images_with_positions",
    "generate_image_name",
    # 表格函数
    "detect_table_caption",
    "extract_tables_with_geometry",
    "extract_tables_from_text",
    "build_markdown_from_data",
    "merge_table_columns_and_rows",
    "convert_to_markdown_table",
    "extract_table_headers",
    "is_table_row",
    # 公式函数
    "extract_formulas_from_text",
]
