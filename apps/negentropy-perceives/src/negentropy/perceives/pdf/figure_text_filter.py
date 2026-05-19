"""图内文字空间过滤工具。

提供基于边界框（bounding box）重叠检测的工具函数，用于识别落在
图片/图表/图形区域内的文本元素，并将其从正文流中排除，防止图内
标注文字（轴标签、图例、注释等）混入正文破坏阅读顺序。
"""

import re
from dataclasses import dataclass
from typing import Any, Callable, List, Optional, Set, Tuple

# ---------------------------------------------------------------------------
# 标题模式（Caption patterns）—— 共享定义
# ---------------------------------------------------------------------------

CAPTION_PATTERNS: List[re.Pattern] = [
    re.compile(
        r"^(Figure|Fig\.?|Image|Diagram|Chart|Graph|Illustration)\s*\d+",
        re.IGNORECASE,
    ),
    re.compile(r"^(图|插图|示意图|架构图|流程图)\s*\d+", re.IGNORECASE),
    re.compile(r"^(Table|表)\s*\d+", re.IGNORECASE),
]


def is_caption_text(text: str) -> bool:
    """判断文本是否为图/表标题（不应被过滤）。

    Args:
        text: 待检测文本。

    Returns:
        True 表示文本匹配标题模式。
    """
    first_line = text.strip().split("\n")[0].strip()
    if not first_line:
        return False
    return any(p.match(first_line) for p in CAPTION_PATTERNS)


# ---------------------------------------------------------------------------
# 图区域数据类
# ---------------------------------------------------------------------------


@dataclass
class FigureRegion:
    """图片/图表/图形在某一页上的边界框。"""

    page_no: int
    bbox: Tuple[float, float, float, float]  # (x0, y0, x1, y1)
    caption: str = ""


# ---------------------------------------------------------------------------
# 空间重叠检测
# ---------------------------------------------------------------------------


def is_text_inside_figure(
    text_bbox: Tuple[float, float, float, float],
    figure_bbox: Tuple[float, float, float, float],
    overlap_threshold: float = 0.6,
) -> bool:
    """判断文本块是否在图区域内。

    使用交集面积与文本面积之比进行判定：当 intersection / text_area
    >= ``overlap_threshold`` 时，认为文本属于图内文字。

    Args:
        text_bbox: (x0, y0, x1, y1) 文本元素的边界框。
        figure_bbox: (x0, y0, x1, y1) 图区域的边界框。
        overlap_threshold: 判定阈值（默认 0.6）。

    Returns:
        True 表示文本块在图区域内。
    """
    tx0, ty0, tx1, ty1 = text_bbox
    fx0, fy0, fx1, fy1 = figure_bbox

    # 计算交集
    ix0 = max(tx0, fx0)
    iy0 = max(ty0, fy0)
    ix1 = min(tx1, fx1)
    iy1 = min(ty1, fy1)

    if ix1 <= ix0 or iy1 <= iy0:
        return False

    intersection_area = (ix1 - ix0) * (iy1 - iy0)
    text_area = (tx1 - tx0) * (ty1 - ty0)

    if text_area <= 0:
        return False

    return (intersection_area / text_area) >= overlap_threshold


# ---------------------------------------------------------------------------
# 批量过滤辅助
# ---------------------------------------------------------------------------


def collect_figure_internal_texts(
    items_with_labels: list,
    figure_regions: List[FigureRegion],
    *,
    get_label: Callable[[Any], Any],
    get_text: Callable[[Any], Any],
    get_page_no: Callable[[Any], Any],
    get_bbox: Callable[[Any], Any],
    body_labels: Optional[Set[str]] = None,
) -> Set[str]:
    """从文档元素列表中识别落在图区域内的文本。

    该函数是通用实现，通过回调函数适配不同的文档模型
    （Docling / PyMuPDF 等）。

    Args:
        items_with_labels: 文档元素列表。
        figure_regions: 图区域列表。
        get_label: 获取元素 label 的回调。
        get_text: 获取元素文本的回调。
        get_page_no: 获取元素页码的回调。
        get_bbox: 获取元素 bbox 的回调，返回 (x0, y0, x1, y1) 或 None。
        body_labels: 视为正文的 label 集合（默认 {"text", "paragraph"}）。

    Returns:
        需要从正文中移除的文本字符串集合。
    """
    if not figure_regions:
        return set()

    if body_labels is None:
        body_labels = {"text", "paragraph"}

    # 按页码分组图区域
    page_figures: dict = {}
    for region in figure_regions:
        page_figures.setdefault(region.page_no, []).append(region)

    texts_to_remove: Set[str] = set()

    for item in items_with_labels:
        label = get_label(item)
        if label not in body_labels:
            continue

        text = get_text(item)
        if not text or not text.strip():
            continue

        # 标题文字不应被过滤
        if is_caption_text(text):
            continue

        page_no = get_page_no(item)
        if page_no not in page_figures:
            continue

        item_bbox = get_bbox(item)
        if not item_bbox:
            continue

        for region in page_figures[page_no]:
            if is_text_inside_figure(item_bbox, region.bbox):
                texts_to_remove.add(text.strip())
                break

    return texts_to_remove


def remove_texts_from_markdown(
    markdown: str,
    texts_to_remove: Set[str],
) -> str:
    """从 Markdown 中按段落级精确匹配移除图内文字。

    按空行分隔的段落进行匹配，避免破坏 Markdown 结构。

    Args:
        markdown: 原始 Markdown 文本。
        texts_to_remove: 需要移除的文本集合。

    Returns:
        过滤后的 Markdown 文本。
    """
    if not texts_to_remove:
        return markdown

    # 按段落（空行分隔）进行匹配
    paragraphs = re.split(r"\n\n+", markdown)
    filtered = []
    removed_count = 0

    for para in paragraphs:
        stripped = para.strip()
        if stripped and stripped in texts_to_remove:
            removed_count += 1
            continue
        filtered.append(para)

    if removed_count == 0:
        return markdown

    result = "\n\n".join(filtered)
    # 清理可能出现的连续空行
    result = re.sub(r"\n{3,}", "\n\n", result)
    return result
