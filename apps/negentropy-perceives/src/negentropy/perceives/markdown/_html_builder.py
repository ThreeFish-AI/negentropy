"""HTML 构建工具：内容区域提取、回退转换、表格/段落处理。"""

from __future__ import annotations

import logging
from typing import Dict, Optional

from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


def extract_content_area(html_content: str) -> str:
    """提取 HTML 中的主要内容区域，移除导航、广告等。"""
    try:
        soup = BeautifulSoup(html_content, "html.parser")

        content_selectors = [
            "main",
            '[role="main"]',
            "article",
            ".content",
            ".post",
            ".entry",
            ".article",
            "#content",
            "#main",
            ".main-content",
            ".post-content",
            ".entry-content",
            ".article-content",
        ]

        main_content = None
        for selector in content_selectors:
            elements = soup.select(selector)
            if elements:
                for element in elements:
                    text_length = len(element.get_text(strip=True))
                    if text_length > 10:
                        main_content = element
                        break
                if main_content:
                    break

        if not main_content:
            main_content = soup.find("body") or soup

        return str(main_content)

    except Exception as e:
        logger.warning(f"Error extracting content area: {str(e)}")
        return html_content


def fallback_html_conversion(html_content: str) -> str:
    """当 MarkItDown 失败时的回退 HTML 转换。

    保留表格结构，在剥离 HTML 标签之前将其转换为 Markdown。
    """
    try:
        soup = BeautifulSoup(html_content, "html.parser")

        for tag in soup.find_all(["script", "style", "nav", "header", "footer"]):
            tag.decompose()

        for table_tag in soup.find_all("table"):
            md_table = html_table_to_markdown(table_tag)
            if md_table:
                table_tag.replace_with(f"\n\n{md_table}\n\n")

        text_content = soup.get_text()

        lines = text_content.split("\n")
        markdown_lines = []

        for line in lines:
            line = line.strip()
            if line:
                markdown_lines.append(line)

        return "\n\n".join(markdown_lines)

    except Exception as e:
        logger.warning(f"Fallback conversion failed: {str(e)}")
        return f"Conversion failed: {str(e)}"


def html_table_to_markdown(table_tag) -> Optional[str]:
    """将 BeautifulSoup ``<table>`` 元素转换为 Markdown 表格格式。"""
    try:
        rows = []
        for tr in table_tag.find_all("tr"):
            cells = []
            for cell in tr.find_all(["th", "td"]):
                cell_text = cell.get_text(strip=True).replace("|", "\\|")
                cells.append(cell_text)
            if cells:
                rows.append(cells)

        if len(rows) < 2:
            return None

        max_cols = max(len(row) for row in rows)
        for row in rows:
            while len(row) < max_cols:
                row.append("")

        md_lines = []
        md_lines.append("| " + " | ".join(rows[0]) + " |")
        md_lines.append("| " + " | ".join(["---"] * max_cols) + " |")
        for row in rows[1:]:
            md_lines.append("| " + " | ".join(row) + " |")

        return "\n".join(md_lines)

    except Exception:
        return None


def heuristic_split_paragraphs(text: str) -> list:
    """当文本缺少双换行时，使用启发式方法拆分段落。"""
    lines = text.split("\n")
    paragraphs = []
    current: list[str] = []

    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            if current:
                paragraphs.append(" ".join(current))
                current = []
            continue

        current.append(stripped)

        if i < len(lines) - 1:
            next_stripped = lines[i + 1].strip()
            if next_stripped and stripped[-1] in ".?!:" and next_stripped[0].isupper():
                paragraphs.append(" ".join(current))
                current = []

    if current:
        paragraphs.append(" ".join(current))

    return paragraphs if len(paragraphs) > 1 else [text.strip()]


def match_image_to_paragraph(paragraph: str, img_alt: str) -> bool:
    """通过 alt 文本检查图片是否与段落上下文相关。"""
    if not img_alt or not paragraph:
        return False
    alt_lower = img_alt.lower().strip()
    para_lower = paragraph.lower()
    if alt_lower in ("", "image", "img", "photo", "picture", "icon", "logo"):
        return False
    return alt_lower in para_lower


def build_html_from_text(text_content: str, title: str, content_data: Dict) -> str:
    """从文本内容构建基本 HTML 结构。

    图片按比例分布在段落之间，近似原始文档布局。
    """
    try:
        html_parts = ["<html><head>"]
        if title:
            html_parts.append(f"<title>{title}</title>")
        html_parts.append("</head><body>")

        html_parts.append("<div class='main-content'>")

        paragraphs = [p.strip() for p in text_content.split("\n\n") if p.strip()]

        if len(paragraphs) <= 1 and len(text_content) > 200:
            paragraphs = heuristic_split_paragraphs(text_content)

        images = content_data.get("images", [])[:20]
        num_images = len(images)
        num_paragraphs = len(paragraphs)

        alt_matched: dict = {}
        matched_img_indices: set = set()
        if images and paragraphs:
            for img_idx, img in enumerate(images):
                img_alt = img.get("alt", "")
                for para_idx, paragraph in enumerate(paragraphs):
                    if match_image_to_paragraph(paragraph, img_alt):
                        alt_matched[img_idx] = para_idx
                        matched_img_indices.add(img_idx)
                        break

        unmatched_images = [
            i for i in range(num_images) if i not in matched_img_indices
        ]
        proportional: dict = {}
        if unmatched_images and num_paragraphs > 0:
            for seq, img_idx in enumerate(unmatched_images):
                para_idx = min(
                    (seq + 1) * num_paragraphs // (len(unmatched_images) + 1),
                    num_paragraphs - 1,
                )
                proportional.setdefault(para_idx, []).append(img_idx)

        placement: dict = {}
        for img_idx, para_idx in alt_matched.items():
            placement.setdefault(para_idx, []).append(img_idx)
        for para_idx, img_indices in proportional.items():
            placement.setdefault(para_idx, []).extend(img_indices)

        for i, paragraph in enumerate(paragraphs):
            if paragraph:
                html_parts.append(f"<p>{paragraph}</p>")
            if i in placement:
                for img_idx in placement[i]:
                    img = images[img_idx]
                    img_src = img.get("src", "")
                    img_alt = img.get("alt", "")
                    html_parts.append(f"<img src='{img_src}' alt='{img_alt}'>")

        if images and not paragraphs:
            for img in images:
                img_src = img.get("src", "")
                img_alt = img.get("alt", "")
                html_parts.append(f"<img src='{img_src}' alt='{img_alt}'>")

        html_parts.append("</div>")

        links = content_data.get("links", [])
        if links:
            html_parts.append("<div class='links'>")
            for link in links[:50]:
                link_url = link.get("url", "")
                link_text = link.get("text", link_url)
                html_parts.append(f"<a href='{link_url}'>{link_text}</a><br>")
            html_parts.append("</div>")

        html_parts.append("</body></html>")
        return "\n".join(html_parts)

    except Exception as e:
        logger.warning(f"Error building HTML from text: {str(e)}")
        return f"<html><body><p>{text_content}</p></body></html>"
