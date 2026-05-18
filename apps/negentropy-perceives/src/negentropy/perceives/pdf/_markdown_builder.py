"""PDF 文本到 Markdown 的转换逻辑。

从 PDFProcessor 中提取的纯文本操作函数，不依赖任何实例状态。
"""

from __future__ import annotations

import logging
import re
import uuid as _uuid

from ..markdown.algorithm_detector import (
    _compute_algorithm_score,
    detect_algorithm_regions,
    is_algorithm_block,
    wrap_as_code_fence,
)

logger = logging.getLogger(__name__)


def convert_to_markdown(text: str) -> str:
    """将提取的 PDF 文本转换为 Markdown 格式。"""
    try:
        from ..markdown.converter import MarkdownConverter

        converter = MarkdownConverter()

        text = merge_algorithm_regions(text)

        algo_placeholders: dict = {}
        paragraphs = text.split("\n\n")
        html_parts = []
        for p in paragraphs:
            p = p.strip()
            if not p:
                continue
            if p.startswith("<!--"):
                html_parts.append(p)
            elif p.startswith("!["):
                html_parts.append(p)
            elif p.startswith("|") or (p.startswith("**") and "\n|" in p):
                html_parts.append(p)
            elif p.startswith("```algorithm\n"):
                placeholder = f"ALGOPH{_uuid.uuid4().hex[:16]}"
                algo_placeholders[placeholder] = p
                html_parts.append(f"<p>{placeholder}</p>")
            elif is_algorithm_block(p) and _compute_algorithm_score(p) >= 7:
                fence = wrap_as_code_fence(p)
                placeholder = f"ALGOPH{_uuid.uuid4().hex[:16]}"
                algo_placeholders[placeholder] = fence
                html_parts.append(f"<p>{placeholder}</p>")
            else:
                p_clean = p.replace("\n", " ")
                html_parts.append(f"<p>{p_clean}</p>")

        html_content = f"<html><body><div>{''.join(html_parts)}</div></body></html>"

        result = converter.html_to_markdown(html_content)

        for placeholder, fence in algo_placeholders.items():
            result = result.replace(placeholder, fence)

        if not has_markdown_structure(result):
            logger.info(
                "MarkdownConverter didn't add structure, using simple conversion"
            )
            return simple_markdown_conversion(text)

        return result

    except Exception as e:
        logger.warning(
            f"Failed to use MarkdownConverter, falling back to simple conversion: {str(e)}"
        )
        return simple_markdown_conversion(text)


def merge_algorithm_regions(text: str) -> str:
    """检测并合并跨段落的算法区域为代码围栏。

    PDF 提取中，一个算法块可能被拆分为多个段落（标题、Require/Ensure、编号行），
    此方法将它们合并为单个代码围栏。
    """
    regions = detect_algorithm_regions(text)
    if not regions:
        return text

    paragraphs = text.split("\n\n")
    merged_indices: set = set()
    insertions: dict = {}

    for region in regions:
        for idx in range(region.start_idx, region.end_idx):
            merged_indices.add(idx)
        region_paragraphs = []
        for idx in range(region.start_idx, region.end_idx):
            if idx < len(paragraphs):
                p = paragraphs[idx].strip()
                if p and not p.startswith("<!--"):
                    region_paragraphs.append(p)
        if region_paragraphs:
            merged_content = "\n".join(region_paragraphs)
            insertions[region.start_idx] = wrap_as_code_fence(merged_content)

    result_parts = []
    for i, p in enumerate(paragraphs):
        if i in insertions:
            result_parts.append(insertions[i])
        elif i not in merged_indices:
            result_parts.append(p)

    return "\n\n".join(result_parts)


def simple_markdown_conversion(text: str) -> str:
    """简单回退 Markdown 转换，含段落分组。"""
    paragraphs = text.split("\n\n")
    result_paragraphs = []

    for paragraph in paragraphs:
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        if paragraph.startswith("<!--"):
            continue

        if paragraph.startswith("!["):
            result_paragraphs.append(paragraph)
            continue

        if paragraph.startswith("|") or (
            paragraph.startswith("**") and "\n|" in paragraph
        ):
            result_paragraphs.append(paragraph)
            continue

        lines = [line.strip() for line in paragraph.split("\n") if line.strip()]
        if not lines:
            continue

        if len(lines) == 1:
            line = lines[0]
            if line.isupper() and len(line.split()) <= 5:
                result_paragraphs.append(f"# {line}")
            elif line.endswith(":") and len(line.split()) <= 8:
                result_paragraphs.append(f"## {line}")
            elif looks_like_title(line):
                result_paragraphs.append(f"# {line}")
            else:
                result_paragraphs.append(line)
        else:
            raw_text = "\n".join(lines)
            if is_algorithm_block(raw_text) and _compute_algorithm_score(raw_text) >= 7:
                result_paragraphs.append(wrap_as_code_fence(raw_text))
            else:
                merged = " ".join(lines)
                result_paragraphs.append(merged)

    return "\n\n".join(result_paragraphs)


def looks_like_title(line: str) -> bool:
    """判断一行是否看起来像标题。"""
    words = line.split()
    if len(words) > 8:
        return False

    capitalized_count = sum(1 for word in words if word and word[0].isupper())
    return capitalized_count > len(words) * 0.6


def normalize_paragraphs(text: str) -> str:
    """规范化原始提取文本的段落分隔。

    当文本缺少双换行段落分隔符时（如来自 pypdf），
    使用启发式方法检测段落边界并插入空行。
    """
    if "\n\n" in text:
        return text

    if is_algorithm_block(text):
        return text

    lines = text.split("\n")
    if len(lines) <= 1:
        return text

    result_lines = []
    for i, line in enumerate(lines):
        result_lines.append(line)
        if i >= len(lines) - 1:
            continue
        current = line.strip()
        next_line = lines[i + 1].strip()
        if not current or not next_line:
            continue
        if current[-1] in ".?!:" and next_line[0].isupper():
            result_lines.append("")

    return "\n".join(result_lines)


def has_markdown_structure(text: str) -> bool:
    """检查文本是否有正确的 Markdown 结构。"""
    has_headers = bool(re.search(r"^#{1,6}\s+", text, re.MULTILINE))
    has_lists = bool(re.search(r"^[\s]*[-*+]\s+", text, re.MULTILINE))
    has_bold = "**" in text or "__" in text
    has_italic = "*" in text or "_" in text
    has_links = "[" in text and "](" in text
    has_code = "`" in text

    structure_count = sum(
        [has_headers, has_lists, has_bold, has_italic, has_links, has_code]
    )

    return has_headers or structure_count >= 2
