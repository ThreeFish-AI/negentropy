"""S6-S9: 并行富元素提取 — 数学公式 / 代码块 / 表格 / 图片。"""

from __future__ import annotations

import asyncio
from typing import Any, Dict

from ....models import StageContext

# Import tools to trigger @register_tool registration
from .code_block import CodeBlockTool, _extract_code_blocks
from .image import ImageTool, _extract_images
from .math_formula import MathFormulaTool, _extract_math_formulas
from .table import TableTool, _extract_tables

# Stage metadata
STAGE_ID = "rich_elements"
STAGE_NAME = "并行富元素提取"

TOOLS: Dict[str, type] = {
    "beautifulsoup_math": MathFormulaTool,
    "beautifulsoup_code": CodeBlockTool,
    "beautifulsoup_table": TableTool,
    "beautifulsoup_image": ImageTool,
}


async def extract_all_rich_elements(ctx: StageContext) -> Dict[str, Any]:
    """并行提取所有富元素，返回聚合统计。

    此函数通过 ``asyncio.gather()`` 并行执行 S6-S9 四个子任务。
    结果直接写入 ``ctx`` 的对应字段。
    """
    results = await asyncio.gather(
        _extract_math_formulas(ctx),
        _extract_code_blocks(ctx),
        _extract_tables(ctx),
        _extract_images(ctx),
        return_exceptions=True,
    )

    stats: Dict[str, Any] = {}

    # S6: 公式
    if isinstance(results[0], list):
        ctx.formulas = results[0]
        stats["formula_count"] = len(results[0])
    else:
        ctx.errors.append(f"数学公式提取异常: {results[0]}")
        stats["formula_count"] = 0

    # S7: 代码块
    if isinstance(results[1], list):
        ctx.code_blocks = results[1]
        stats["code_block_count"] = len(results[1])
    else:
        ctx.errors.append(f"代码块识别异常: {results[1]}")
        stats["code_block_count"] = 0

    # S8: 表格
    if isinstance(results[2], list):
        ctx.tables = results[2]
        stats["table_count"] = len(results[2])
    else:
        ctx.errors.append(f"表格提取异常: {results[2]}")
        stats["table_count"] = 0

    # S9: 图片
    if isinstance(results[3], list):
        ctx.images = results[3]
        stats["image_count"] = len(results[3])
    else:
        ctx.errors.append(f"图片提取异常: {results[3]}")
        stats["image_count"] = 0

    return stats


__all__ = [
    "STAGE_ID",
    "STAGE_NAME",
    "TOOLS",
    "extract_all_rich_elements",
    "MathFormulaTool",
    "CodeBlockTool",
    "TableTool",
    "ImageTool",
]
