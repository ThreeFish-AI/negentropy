"""S8: 表格提取（``<table>`` -> TableData）。"""

from __future__ import annotations

import logging
from typing import List

from bs4 import BeautifulSoup

from ....base import StageResult
from ....models import StageContext, TableData
from ....registry import register_tool
from ..._base import WebToolBase
from ..._helpers import get_best_html

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# S8: 表格提取
# ---------------------------------------------------------------------------


async def _extract_tables(ctx: StageContext) -> List[TableData]:
    """从 HTML 中提取表格结构。"""
    html = get_best_html(ctx)
    if not html:
        return []

    tables: List[TableData] = []

    try:
        soup = BeautifulSoup(html, "html.parser")

        for table_tag in soup.find_all("table"):
            rows_data: List[List[str]] = []
            for tr in table_tag.find_all("tr"):
                cells = []
                for cell in tr.find_all(["th", "td"]):
                    cell_text = cell.get_text(strip=True).replace("|", "\\|")
                    cells.append(cell_text)
                if cells:
                    rows_data.append(cells)

            if len(rows_data) < 1:
                continue

            # 规范化列数
            max_cols = max(len(row) for row in rows_data) if rows_data else 0
            for row in rows_data:
                while len(row) < max_cols:
                    row.append("")

            # 构建 Markdown 表格
            md_lines = []
            if rows_data:
                md_lines.append("| " + " | ".join(rows_data[0]) + " |")
                md_lines.append("| " + " | ".join(["---"] * max_cols) + " |")
                for row in rows_data[1:]:
                    md_lines.append("| " + " | ".join(row) + " |")

            markdown = "\n".join(md_lines)

            # 尝试提取 caption
            caption_tag = table_tag.find("caption")
            caption = caption_tag.get_text(strip=True) if caption_tag else None

            # 表头
            headers = rows_data[0] if rows_data else None

            tables.append(
                TableData(
                    markdown=markdown,
                    rows=len(rows_data),
                    columns=max_cols,
                    headers=headers,
                    caption=caption,
                    original_html=str(table_tag)[:2000],
                )
            )

    except Exception as e:
        logger.warning("表格提取失败: %s", e)

    return tables


# ---------------------------------------------------------------------------
# 注册工具
# ---------------------------------------------------------------------------


@register_tool("beautifulsoup_table")
class TableTool(WebToolBase):
    """S8: 表格提取工具。"""

    tool_name = "beautifulsoup_table"

    def is_available(self) -> bool:
        try:
            from bs4 import BeautifulSoup  # noqa: F401

            return True
        except ImportError:
            return False

    async def _run(self, ctx: StageContext) -> StageResult:
        """提取表格数据。"""
        try:
            tables = await _extract_tables(ctx)
            ctx.tables = tables
            return StageResult(
                success=True,
                output=ctx,
                engine_used=self.tool_name,
                metadata={"table_count": len(tables)},
            )
        except Exception as e:
            ctx.errors.append(f"表格提取失败: {e}")
            return StageResult(
                success=True,
                output=ctx,
                engine_used=self.tool_name,
                metadata={"table_count": 0, "error": str(e)},
            )
