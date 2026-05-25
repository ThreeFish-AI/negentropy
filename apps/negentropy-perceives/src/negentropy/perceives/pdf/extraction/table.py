"""PDF 表格提取模块。

负责从 PDF 页面中提取表格，支持几何检测（PyMuPDF find_tables）与
纯文本模式匹配两种策略，并将结果统一封装为 ``ExtractedTable`` 数据类。
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from ..figure_text_filter import CAPTION_PATTERNS as _CAPTION_PATTERNS
from ._shared import generate_asset_id

# 质量过滤阈值沿用 settings 的默认值；在测试中可通过 monkeypatch 覆盖
# 模块级常量的方式切换行为，避免测试环境硬耦合到 pydantic settings。
try:
    from negentropy.perceives.config import settings as _settings

    _QF_ENABLED = bool(_settings.pdf_table_quality_filter_enabled)
    _QF_MIN_OCCUPANCY = float(_settings.pdf_table_quality_min_occupancy)
    _QF_MAX_WEAK_COLS_RATIO = float(_settings.pdf_table_quality_max_weak_cols_ratio)
    _QF_MIN_UNIQUE_CELLS = int(_settings.pdf_table_quality_min_unique_cells)
    _QF_PROSE_ROWS_THRESHOLD = int(_settings.pdf_table_quality_prose_rows_threshold)
    _QF_PROSE_COLS_MAX = int(_settings.pdf_table_quality_prose_cols_max)
    _QF_PROSE_FRAGMENT_RATIO = float(_settings.pdf_table_quality_prose_fragment_ratio)
    _QF_BYPASS_WITH_TITLE = bool(_settings.pdf_table_quality_bypass_with_title)
except Exception:  # noqa: BLE001 - 配置系统未就绪时走保守默认，不阻塞导入
    _QF_ENABLED = True
    _QF_MIN_OCCUPANCY = 0.40
    _QF_MAX_WEAK_COLS_RATIO = 0.5
    _QF_MIN_UNIQUE_CELLS = 3
    _QF_PROSE_ROWS_THRESHOLD = 50
    _QF_PROSE_COLS_MAX = 3
    _QF_PROSE_FRAGMENT_RATIO = 0.5
    _QF_BYPASS_WITH_TITLE = True

# 「Table N:」标题正则；在散文检测旁路时复用
_TABLE_TITLE_BYPASS_RE = re.compile(r"^\s*(Table|表)\s*\d", re.IGNORECASE)

# PyMuPDF imports for PDF processing
try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 数据类
# ---------------------------------------------------------------------------


@dataclass
class ExtractedTable:
    """Data class for extracted table information."""

    id: str
    markdown: str
    rows: int
    columns: int
    page_number: Optional[int] = None
    position: Optional[Dict[str, float]] = None
    caption: Optional[str] = None
    headers: Optional[List[str]] = None
    bbox: Optional[Tuple[float, float, float, float]] = None  # (x0, y0, x1, y1)


# ---------------------------------------------------------------------------
# 表格标题检测
# ---------------------------------------------------------------------------


def detect_table_caption(
    text_blocks: list,
    table_bbox: Tuple[float, float, float, float],
    tolerance: float = 30.0,
) -> Optional[str]:
    """Detect caption text near a table (above or below).

    Checks both above and below the table bounding box because table
    captions can appear in either position.

    Args:
        text_blocks: Text-only blocks (block[6] == 0)
        table_bbox: (x0, y0, x1, y1) of the table
        tolerance: Max vertical distance to search

    Returns:
        Caption string if found, else None
    """
    tx0, ty0, tx1, ty1 = table_bbox
    best_caption = None
    best_distance = tolerance + 1

    for block in text_blocks:
        if block[6] != 0:
            continue
        block_text = block[4].strip() if block[4] else ""
        if not block_text:
            continue

        block_y0, block_y1 = block[1], block[3]
        block_x0, block_x1 = block[0], block[2]

        # Check horizontal overlap
        overlap = min(block_x1, tx1) - max(block_x0, tx0)
        if overlap <= 0:
            continue

        # Check above table (caption like "Table 9: ...")
        dist_above = ty0 - block_y1
        # Check below table
        dist_below = block_y0 - ty1

        distance = min(
            dist_above if dist_above >= -5 else tolerance + 1,
            dist_below if dist_below >= -5 else tolerance + 1,
        )

        if distance > tolerance:
            continue

        first_line = block_text.split("\n")[0].strip()
        for pattern in _CAPTION_PATTERNS:
            if pattern.match(first_line):
                if distance < best_distance:
                    best_distance = distance
                    best_caption = re.sub(r"\n+", " ", block_text).strip()
                    if len(best_caption) > 120:
                        best_caption = best_caption[:120]
                break

    return best_caption


# ---------------------------------------------------------------------------
# 几何表格提取（PyMuPDF find_tables）
# ---------------------------------------------------------------------------


def extract_tables_with_geometry(
    pdf_document,
    page_num: int,
    text_blocks: list,
) -> Tuple[
    Dict[Tuple[float, float, float, float], ExtractedTable],
    List[ExtractedTable],
]:
    """Extract tables using PyMuPDF's geometric table detection.

    Uses a two-phase approach:
    1. Detect table title positions ("Table N:") to create clip regions
    2. Run page.find_tables() on each clip region for precise extraction
    3. Post-process: merge continuation columns/rows, clean cell text

    Falls back to full-page detection when no table titles are found.

    Args:
        pdf_document: PyMuPDF document object
        page_num: Page number (0-indexed)
        text_blocks: All blocks from page.get_text("blocks")

    Returns:
        Tuple of:
        - Dict mapping table bbox -> ExtractedTable (for inline placement)
        - List of all ExtractedTable objects
    """
    bbox_to_table: Dict[Tuple[float, float, float, float], ExtractedTable] = {}
    all_tables: List[ExtractedTable] = []

    try:
        if fitz is None:
            raise ImportError("PyMuPDF (fitz) is not available")

        page = pdf_document[page_num]
        text_only_blocks = [b for b in text_blocks if b[6] == 0]
        page_rect = page.rect

        # Phase 1: Detect table title positions for clip-based extraction
        title_regions = _find_table_title_regions(
            page,
            text_only_blocks,
            page_rect,
        )

        if title_regions:
            # Extract each table using its clip region
            for table_idx, (title, clip_rect, title_rect) in enumerate(title_regions):
                table = _extract_single_table(
                    page,
                    clip_rect,
                    title,
                    title_rect,
                    text_only_blocks,
                    page_num,
                    table_idx,
                )
                if table:
                    bbox_to_table[table.bbox] = table  # type: ignore[index]
                    all_tables.append(table)
        else:
            # Phase 2: Full-page fallback with both strategies
            found_tables = _find_tables_fullpage(page)

            for table_idx, table in enumerate(found_tables):
                extracted = _process_found_table(
                    table,
                    text_only_blocks,
                    page_num,
                    table_idx,
                )
                if extracted:
                    bbox_to_table[extracted.bbox] = extracted  # type: ignore[index]
                    all_tables.append(extracted)

    except ImportError:
        logger.error("PyMuPDF (fitz) is required for geometric table extraction")
    except Exception as e:
        logger.error(f"Error in geometric table extraction for page {page_num}: {e}")

    return bbox_to_table, all_tables


def _find_table_title_regions(
    page,
    text_blocks: list,
    page_rect,
) -> List[Tuple[str, Any, Any]]:
    """Find table titles and compute clip rectangles for each table.

    Returns list of (title_text, clip_rect, title_rect) tuples.
    """
    table_title_pattern = re.compile(r"^(Table|表)\s*\d+", re.IGNORECASE)

    # Collect title positions
    titles = []
    for block in sorted(text_blocks, key=lambda b: b[1]):
        if block[6] != 0:
            continue
        text = block[4].strip() if block[4] else ""
        first_line = text.split("\n")[0].strip()
        if table_title_pattern.match(first_line):
            title_text = re.sub(r"\n+", " ", text).strip()
            if len(title_text) > 120:
                title_text = title_text[:120]
            title_rect = fitz.Rect(block[0], block[1], block[2], block[3])
            titles.append((title_text, title_rect))

    if not titles:
        return []

    # Create clip regions: from title bottom to next title top (or page bottom)
    regions = []
    margin_x = 20
    for i, (title_text, title_rect) in enumerate(titles):
        clip_top = title_rect.y1 + 2
        if i + 1 < len(titles):
            clip_bottom = titles[i + 1][1].y0 - 5
        else:
            clip_bottom = page_rect.height - 40

        clip = fitz.Rect(
            max(page_rect.x0, title_rect.x0 - margin_x),
            clip_top,
            min(page_rect.x1, page_rect.x1 - margin_x),
            clip_bottom,
        )
        regions.append((title_text, clip, title_rect))

    return regions


def _table_quality_score(
    data: List[List[Any]],
    title: Optional[str] = None,
) -> Tuple[bool, Dict[str, Any]]:
    """启发式表格质量评分。

    返回 ``(是否通过, 诊断指标)``。不依赖 PyMuPDF 的 ``row_count/col_count``，
    而是直接基于 ``table.extract()`` 返回的二维矩阵做三项结构统计 + 一项
    散文检测：

    * ``occupancy``：非空单元格占比，低于
      ``pdf_table_quality_min_occupancy`` 视为空白率过高；
    * ``weak_cols``：每列非空率 < 40% 的列视为"弱列"，弱列数超过
      ``total_cols × pdf_table_quality_max_weak_cols_ratio`` 视为伪表格；
    * ``unique_cells``：去重后单元格种类数，≤
      ``pdf_table_quality_min_unique_cells`` 视为页眉/重复行；
    * ``prose_like_cells``：信号 a（行多列少）+ 信号 b（单词断裂率）
      联合判定，但当 ``title`` 命中 "Table N:" 模式且
      ``pdf_table_quality_bypass_with_title`` 为真时**仅旁路 prose 信号**，
      其余结构信号仍生效。

    该函数只负责判别，不修改输入；诊断指标由调用侧决定是否记录到
    ``metadata.discarded_tables`` 以便事后排查。

    Args:
        data: ``table.extract()`` / ``merge_table_columns_and_rows`` 产物。
        title: 候选表格上方/下方探测到的标题文本（如 ``"Table 3: ..."``）；
            若命中 ``Table N`` 模式则跳过 prose 检测信号。

    Returns:
        ``(通过标记, 诊断字典)``；配置关闭时恒通过，诊断字典仍填充。
    """
    if not data:
        return False, {"reason": "empty"}
    rows = len(data)
    if rows < 2:
        return False, {"reason": "too_few_rows", "rows": rows}
    cols = max(len(r) for r in data)
    if cols < 2:
        # 单列表格：经过 merge_table_columns_and_rows 合并后仅剩 1 列，
        # 通常为多列 PyMuPDF 原始表中只有一列标题非空的情况。
        # 只要行数足够（>= 3）且内容有意义（unique_cells > 3），
        # 视为有效的列表/目录/编号内容保留。
        if cols == 1 and rows >= 3:
            non_empty_1 = sum(
                1 for r in data if r and r[0] is not None and str(r[0]).strip()
            )
            unique_1 = len(
                {
                    str(r[0]).strip()
                    for r in data
                    if r and r[0] is not None and str(r[0]).strip()
                }
            )
            if non_empty_1 >= 3 and unique_1 > 3:
                return True, {
                    "reason": "pass",
                    "single_col_bypass": True,
                    "rows": rows,
                    "non_empty": non_empty_1,
                    "unique": unique_1,
                }
        return False, {"reason": "too_few_cols", "cols": cols}

    total_cells = rows * cols
    non_empty = sum(1 for r in data for c in r if c is not None and str(c).strip())
    occupancy = non_empty / total_cells if total_cells else 0.0

    col_fill: List[float] = []
    for ci in range(cols):
        filled = 0
        for r in data:
            if len(r) > ci:
                cell = r[ci]
                if cell is not None and str(cell).strip():
                    filled += 1
        col_fill.append(filled / rows if rows else 0.0)
    weak_cols = sum(1 for f in col_fill if f < 0.4)

    unique_cells = len(
        {str(c).strip() for r in data for c in r if c is not None and str(c).strip()}
    )

    diag: Dict[str, Any] = {
        "rows": rows,
        "cols": cols,
        "occupancy": round(occupancy, 3),
        "weak_cols": weak_cols,
        "unique_cells": unique_cells,
    }

    if not _QF_ENABLED:
        diag["reason"] = "disabled"
        return True, diag

    if occupancy < _QF_MIN_OCCUPANCY:
        diag["reason"] = "low_occupancy"
        return False, diag
    if weak_cols > int(cols * _QF_MAX_WEAK_COLS_RATIO):
        diag["reason"] = "too_many_weak_cols"
        return False, diag
    if unique_cells <= _QF_MIN_UNIQUE_CELLS - 1:
        # 注意：默认 _QF_MIN_UNIQUE_CELLS=3 时命中条件是 unique_cells<=2，
        # 即"全表只有 ≤ 2 种不同字符串"，典型为页眉复制 / 同值填充伪表。
        diag["reason"] = "low_uniqueness"
        return False, diag

    # 散文检测：判断表格是否为两端对齐段落被几何启发式误识别的产物。
    # 当候选位于 "Table N:" 标题附近时（典型为学术论文真实表格），跳过该检测以
    # 避免行多列少型数据表（参数对比、消融实验、配置清单）被信号 a 误杀。
    has_table_title = bool(title and _TABLE_TITLE_BYPASS_RE.match(title))
    if _QF_BYPASS_WITH_TITLE and has_table_title:
        diag["prose_bypass"] = "table_title"
        diag["reason"] = "pass"
        return True, diag

    # 综合两个信号：(a) 高行列表比 + 少列 → 多行文本行；
    # (b) 相邻单元格间存在单词断裂（如 "Scaffoldi" | "ng"）。
    is_prose = False
    # 信号 a：行数远大于列数且列数极少（学术真实长表多在 4+ 列）。
    # 阈值由配置驱动：默认 rows>50 + cols∈[2,3]，对正文段落仍敏感而不误杀长表。
    if rows > _QF_PROSE_ROWS_THRESHOLD and cols >= 2 and cols <= _QF_PROSE_COLS_MAX:
        is_prose = True
        diag["prose_signal"] = "a_rows_cols"

    if not is_prose and cols >= 2:
        # 信号 b：相邻单元格对中单词断裂的比例。
        # 正常表格中单元格边界通常在词边界；误识别段落的边界在词中间。
        adj_pairs = 0
        frag_pairs = 0
        for r in data:
            clean = [str(c).strip() for c in r if c is not None]
            for ci in range(len(clean) - 1):
                left, right = clean[ci], clean[ci + 1]
                if not left or not right:
                    continue
                adj_pairs += 1
                if left[-1].isalpha() and right[0].islower():
                    frag_pairs += 1
        if adj_pairs > 0 and frag_pairs / adj_pairs > _QF_PROSE_FRAGMENT_RATIO:
            is_prose = True
            diag["prose_signal"] = "b_fragment_ratio"
            diag["fragment_ratio"] = round(frag_pairs / adj_pairs, 3)

    if is_prose:
        diag["reason"] = "prose_like_cells"
        return False, diag

    diag["reason"] = "pass"
    return True, diag


def _extract_single_table(
    page,
    clip_rect,
    title: str,
    title_rect,
    text_blocks: list,
    page_num: int,
    table_idx: int,
) -> Optional[ExtractedTable]:
    """Extract a single table from a clipped page region."""
    try:
        # Try text strategy (works for borderless tables)
        tabs = page.find_tables(clip=clip_rect, strategy="text")
        found = list(tabs.tables) if tabs else []

        # Fallback to lines strategy
        if not found:
            tabs = page.find_tables(clip=clip_rect)
            found = list(tabs.tables) if tabs else []

        if not found:
            return None

        table = found[0]  # Use the first/largest table in the clip
        if table.row_count < 2 or table.col_count < 2:
            return None

        extracted_data = table.extract()
        if not extracted_data:
            return None

        # Post-process: merge continuation columns and rows
        merged_data = merge_table_columns_and_rows(extracted_data)
        if not merged_data or len(merged_data) < 2:
            return None

        passed, diag = _table_quality_score(merged_data, title=title)
        if not passed:
            logger.info(
                "表格质量过滤丢弃 title=%s page=%d diag=%s",
                title,
                page_num,
                diag,
            )
            return None

        # Build markdown from merged data
        markdown_str = build_markdown_from_data(merged_data)
        if not markdown_str:
            return None

        # Use the title region + table body as the overall bbox
        bbox = (
            clip_rect.x0,
            title_rect.y0,
            clip_rect.x1,
            min(float(table.bbox[3]) + 5, float(clip_rect.y1)),
        )

        table_id = generate_asset_id("table", page_num, table_idx)

        return ExtractedTable(
            id=table_id,
            markdown=markdown_str,
            rows=len(merged_data) - 1,  # Exclude header
            columns=len(merged_data[0]),
            page_number=page_num,
            position={
                "x0": bbox[0],
                "y0": bbox[1],
                "x1": bbox[2],
                "y1": bbox[3],
            },
            caption=title,
            headers=merged_data[0] if merged_data else None,
            bbox=bbox,
        )

    except Exception as e:
        logger.warning(f"Failed to extract table '{title}' on page {page_num}: {e}")
        return None


def _find_tables_fullpage(page) -> list:
    """Find tables on a full page using both strategies."""
    # Try lines first
    tabs = page.find_tables()
    found = list(tabs.tables) if tabs else []
    if found:
        return found

    # Fallback to text strategy
    try:
        tabs = page.find_tables(strategy="text")
        return list(tabs.tables) if tabs else []
    except Exception:
        return []


def _process_found_table(
    table,
    text_blocks: list,
    page_num: int,
    table_idx: int,
) -> Optional[ExtractedTable]:
    """Process a single found table into an ExtractedTable."""
    try:
        if table.row_count < 2 or table.col_count < 2:
            return None

        extracted_data = table.extract()
        if not extracted_data:
            return None

        # Post-process if there are empty header columns
        merged_data = merge_table_columns_and_rows(extracted_data)
        if not merged_data or len(merged_data) < 2:
            return None

        # 优先探测 caption，使含 "Table N:" 标题的真实学术表格能旁路 prose 检测。
        # caption 检测仅依赖 bbox + 邻近文本块，不读取 merged_data，故顺序无依赖。
        bbox = tuple(table.bbox)
        caption = detect_table_caption(text_blocks, bbox, tolerance=30.0)

        passed, diag = _table_quality_score(merged_data, title=caption)
        if not passed:
            logger.info(
                "表格质量过滤丢弃 caption=%s page=%d idx=%d diag=%s",
                caption,
                page_num,
                table_idx,
                diag,
            )
            return None

        markdown_str = build_markdown_from_data(merged_data)
        if not markdown_str:
            return None

        table_id = generate_asset_id("table", page_num, table_idx)

        return ExtractedTable(
            id=table_id,
            markdown=markdown_str,
            rows=len(merged_data) - 1,
            columns=len(merged_data[0]),
            page_number=page_num,
            position={
                "x0": bbox[0],
                "y0": bbox[1],
                "x1": bbox[2],
                "y1": bbox[3],
            },
            caption=caption,
            headers=merged_data[0] if merged_data else None,
            bbox=bbox,
        )

    except Exception as e:
        logger.warning(f"Failed to process table {table_idx} on page {page_num}: {e}")
        return None


# ---------------------------------------------------------------------------
# 表格后处理
# ---------------------------------------------------------------------------


def merge_table_columns_and_rows(
    data: List[List[Optional[str]]],
) -> List[List[str]]:
    """Merge continuation columns (empty headers) and continuation rows.

    Handles two common PDF table extraction artifacts:
    1. Extra columns where the header cell is empty (text overflow)
    2. Continuation rows where leading cells are empty (wrapped text)
    """
    if not data:
        return []

    header = data[0]

    # Find columns with non-empty headers
    content_cols = [i for i, h in enumerate(header) if h and h.strip()]

    # If all headers are populated, no column merging needed
    if len(content_cols) == len(header):
        content_cols = list(range(len(header)))

    if not content_cols:
        return []

    # Merge columns based on content column boundaries
    merged_rows = []
    for row in data:
        merged = []
        for ci, col_idx in enumerate(content_cols):
            next_col = (
                content_cols[ci + 1] if ci + 1 < len(content_cols) else len(header)
            )
            parts = []
            for j in range(col_idx, next_col):
                cell = row[j] if j < len(row) and row[j] else ""
                # Clean up <br> tags from PyMuPDF
                cell = re.sub(r"<br>\s*", " ", cell).strip()  # type: ignore[arg-type]
                if cell:
                    parts.append(cell)
            merged.append(" ".join(parts))
        merged_rows.append(merged)

    # Merge continuation rows (leading cells empty = wrapped text)
    # 区分两种场景：
    #   a) 换行文本续行：首格为空，大部分格也为空（PDF 换行拆分）→ 合并到前一行
    #   b) 多行表头续行：首格为空，但填充率高（>60%）→ 保留为独立行
    final_rows: List[List[str]] = []
    for row in merged_rows:  # type: ignore[assignment]
        if row[0].strip():  # type: ignore[union-attr]  # New data row
            # Clean hyphen-broken words in each cell
            final_rows.append([re.sub(r"(\w)- (\w)", r"\1\2", c) for c in row])  # type: ignore[arg-type]
        elif final_rows:  # Continuation row
            non_empty = sum(1 for c in row if c and c.strip())  # type: ignore[union-attr]
            fill_rate = non_empty / len(row) if row else 0  # type: ignore[arg-type]
            if fill_rate > 0.6:
                # Likely a multi-row header — preserve as separate row
                final_rows.append([re.sub(r"(\w)- (\w)", r"\1\2", c) for c in row])  # type: ignore[arg-type]
            else:
                # Wrapped text continuation — merge into previous row
                for ci in range(len(row)):
                    if row[ci].strip():  # type: ignore[union-attr]
                        text = re.sub(r"(\w)- (\w)", r"\1\2", row[ci])  # type: ignore[arg-type]
                        sep = " " if final_rows[-1][ci] else ""
                        final_rows[-1][ci] += sep + text

    return final_rows


def build_markdown_from_data(data: List[List[str]]) -> str:
    """Build a GFM markdown table from processed cell data."""
    if not data or len(data) < 2:
        return ""

    num_cols = len(data[0])
    lines = []

    # Header
    lines.append("| " + " | ".join(data[0]) + " |")
    # Separator
    lines.append("| " + " | ".join(["---"] * num_cols) + " |")
    # Data rows
    for row in data[1:]:
        # Pad/trim to match column count
        padded = row[:num_cols] + [""] * max(0, num_cols - len(row))
        # Escape pipe chars in cell content
        escaped = [c.replace("|", "\\|") for c in padded]
        lines.append("| " + " | ".join(escaped) + " |")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 纯文本表格提取
# ---------------------------------------------------------------------------


def extract_tables_from_text(text: str, page_num: int) -> List[ExtractedTable]:
    """Extract tables from plain text using pattern recognition.

    Args:
        text: Text content from PDF page
        page_num: Page number

    Returns:
        List of ExtractedTable objects
    """
    tables: List[ExtractedTable] = []

    try:
        # Split text into lines
        lines = text.split("\n")

        # Look for table patterns
        i = 0
        while i < len(lines):
            line = lines[i].strip()

            # Check if this looks like a table row (contains multiple separators)
            if is_table_row(line):
                table_lines = []

                # Collect consecutive table rows
                while i < len(lines) and is_table_row(lines[i].strip()):
                    table_lines.append(lines[i].strip())
                    i += 1

                # Convert to Markdown table
                if len(table_lines) >= 2:  # At least header and one data row
                    # Column consistency check: real tables have consistent column counts
                    if not _check_column_consistency(table_lines):
                        continue

                    # Quality gate: parse lines into cells and apply quality filter
                    cell_data = _parse_table_lines_to_cells(table_lines)
                    if cell_data:
                        passed, diag = _table_quality_score(cell_data)
                        if not passed:
                            logger.info(
                                "文本表格质量过滤丢弃 page=%d diag=%s",
                                page_num,
                                diag,
                            )
                            continue

                    table_id = generate_asset_id("table", page_num, len(tables))
                    markdown_table = convert_to_markdown_table(table_lines)

                    if markdown_table:
                        # Calculate actual rows and columns
                        if "|" in table_lines[0]:
                            columns = len(
                                [
                                    cell.strip()
                                    for cell in table_lines[0].split("|")
                                    if cell.strip()
                                ]
                            )
                            # Count the number of actual data rows (non-separator)
                            data_rows = len(
                                [
                                    line
                                    for line in table_lines
                                    if not re.match(r"^[\s\|\-]+$", line.strip())
                                ]
                            )
                            # Count actual content rows (exclude markdown separator)
                            total_rows = data_rows
                        else:
                            columns = len(table_lines[0].split("\t"))
                            total_rows = len(table_lines)

                        extracted_table = ExtractedTable(
                            id=table_id,
                            markdown=markdown_table,
                            rows=total_rows,
                            columns=columns,
                            page_number=page_num,
                            headers=extract_table_headers(table_lines[0])
                            if table_lines
                            else None,
                        )

                        tables.append(extracted_table)
                        logger.info(f"Extracted table {table_id} from page {page_num}")

            i += 1

    except Exception as e:
        logger.error(f"Error extracting tables from page {page_num}: {str(e)}")

    return tables


# ---------------------------------------------------------------------------
# 辅助判断函数
# ---------------------------------------------------------------------------


def _parse_table_lines_to_cells(table_lines: List[str]) -> List[List[str]]:
    """将原始表格文本行转换为二维单元格数组，供质量评分使用。"""
    if not table_lines:
        return []
    rows: List[List[str]] = []
    for line in table_lines:
        stripped = line.strip()
        if not stripped:
            continue
        if re.match(r"^[\s|\-]+$", stripped):
            continue
        if "|" in stripped:
            cells = [c.strip() for c in stripped.split("|") if c.strip()]
        elif "\t" in stripped:
            cells = [c.strip() for c in stripped.split("\t") if c.strip()]
        else:
            cells = [c.strip() for c in re.split(r" {2,}", stripped) if c.strip()]
        if cells:
            rows.append(cells)
    return rows


def _check_column_consistency(table_lines: List[str]) -> bool:
    """检查连续表格行的列数是否一致。

    真实表格的列数在行间基本一致；两端对齐文本被错误分割后列数往往不规则。
    允许最多 30% 的行偏离众数列数。
    """
    if not table_lines:
        return False
    col_counts: List[int] = []
    for line in table_lines:
        stripped = line.strip()
        if not stripped or re.match(r"^[\s|\-]+$", stripped):
            continue
        if "|" in stripped:
            count = len([c for c in stripped.split("|") if c.strip()])
        elif "\t" in stripped:
            count = len(stripped.split("\t"))
        else:
            count = len([s for s in re.split(r" {2,}", stripped) if s.strip()])
        col_counts.append(count)

    if not col_counts:
        return False

    from collections import Counter

    most_common = Counter(col_counts).most_common(1)[0][0]
    inconsistent = sum(1 for c in col_counts if c != most_common)
    return inconsistent <= max(1, len(col_counts) * 0.3)


def is_table_row(line: str) -> bool:
    """Check if a line looks like a table row."""
    line_stripped = line.strip()

    # Check for tab-separated or pipe-separated values
    tab_count = line_stripped.count("\t")
    pipe_count = line_stripped.count("|")

    # Multiple separators suggest a table row
    # For tabs: need at least 2 tabs (3 columns)
    # For pipes: need at least 2 pipes (3 columns if properly formatted)
    if tab_count >= 2 or pipe_count >= 2:
        return True

    # For space-separated, check for multiple spaces in original line
    return _has_multiple_space_separators(line_stripped)


def _has_multiple_space_separators(line: str) -> bool:
    """Check if a line has multiple space separators (more than 2 spaces between words).

    Rejects justified prose via three heuristics:
    1. ≥3 non-empty segments with no single segment > 60% of total chars
    2. Low stop-word density (prose has >25% function words, tabular data rarely does)
    """
    if not re.search(r" {2,}", line):
        return False
    segments = [s.strip() for s in re.split(r" {2,}", line.strip()) if s.strip()]
    if len(segments) < 3:
        return False
    total_len = sum(len(s) for s in segments)
    if total_len == 0:
        return False
    max_ratio = max(len(s) for s in segments) / total_len
    if max_ratio > 0.65:
        return False

    # Stop-word density check: prose contains many function words (the, of, in…),
    # whereas real table cells contain domain terms, values, or short labels.
    words = line.lower().split()
    if words:
        stop_count = sum(1 for w in words if w in _STOP_WORDS)
        if stop_count / len(words) > 0.25:
            return False
    return True


_STOP_WORDS = frozenset(
    {
        # English
        "the",
        "a",
        "an",
        "of",
        "in",
        "to",
        "for",
        "with",
        "on",
        "at",
        "by",
        "from",
        "is",
        "are",
        "was",
        "were",
        "be",
        "been",
        "being",
        "have",
        "has",
        "had",
        "do",
        "does",
        "did",
        "will",
        "would",
        "could",
        "should",
        "may",
        "might",
        "can",
        "shall",
        "that",
        "this",
        "these",
        "those",
        "it",
        "its",
        "and",
        "or",
        "but",
        "not",
        "no",
        "nor",
        "as",
        "if",
        "than",
        "then",
        "when",
        "where",
        "how",
        "what",
        "which",
        "who",
        "whom",
        "whose",
        # Chinese
        "的",
        "是",
        "在",
        "和",
        "了",
        "与",
        "等",
        "中",
        "对",
        "为",
        "以",
        "及",
        "或",
        "其",
        "被",
        "从",
        "把",
        "比",
        "让",
        "向",
        "也",
        "都",
        "而",
        "将",
        "于",
        "之",
        "不",
        "有",
        "这",
        "那",
    }
)


def convert_to_markdown_table(table_lines: List[str]) -> str:
    """Convert table lines to Markdown format."""
    if not table_lines:
        return ""

    try:
        # Determine separator type
        first_line = table_lines[0]

        if "|" in first_line:
            # Pipe-separated table
            rows = []
            for line in table_lines:
                # Check if this is already a separator line (contains only dashes and pipes)
                if re.match(r"^[\s\|\-]+$", line.strip()):
                    continue  # Skip existing separator lines

                # Clean up pipe separators
                cleaned = (
                    "| "
                    + " | ".join(
                        [cell.strip() for cell in line.split("|") if cell.strip()]
                    )
                    + " |"
                )
                rows.append(cleaned)

            # Add header separator after first row
            if len(rows) >= 2:
                header_cols = len(rows[0].split("|")) - 2
                separator = "| " + " | ".join(["---"] * header_cols) + " |"
                rows.insert(1, separator)

            return "\n".join(rows)

        elif "\t" in first_line:
            # Tab-separated table - convert to pipe
            rows = []
            for line in table_lines:
                cells = [cell.strip() for cell in line.split("\t")]
                markdown_row = "| " + " | ".join(cells) + " |"
                rows.append(markdown_row)

            # Add header separator
            if len(rows) >= 2:
                header_cols = len(rows[0].split("|")) - 2
                separator = "| " + " | ".join(["---"] * header_cols) + " |"
                rows.insert(1, separator)

            return "\n".join(rows)
        else:
            # Space-separated table
            rows = []
            for line in table_lines:
                # Split by multiple spaces
                cells = re.split(r"\s{2,}", line.strip())
                if len(cells) > 1:
                    markdown_row = "| " + " | ".join(cells) + " |"
                    rows.append(markdown_row)

            # Add header separator
            if len(rows) >= 2:
                header_cols = len(rows[0].split("|")) - 2
                separator = "| " + " | ".join(["---"] * header_cols) + " |"
                rows.insert(1, separator)

            return "\n".join(rows)

    except Exception as e:
        logger.error(f"Error converting table to Markdown: {str(e)}")
        return ""


def extract_table_headers(header_line: str) -> List[str]:
    """Extract headers from table header line."""
    try:
        if "|" in header_line:
            return [cell.strip() for cell in header_line.split("|") if cell.strip()]
        elif "\t" in header_line:
            return [cell.strip() for cell in header_line.split("\t")]
        else:
            return re.split(r"\s{2,}", header_line.strip())
    except Exception:
        return []
