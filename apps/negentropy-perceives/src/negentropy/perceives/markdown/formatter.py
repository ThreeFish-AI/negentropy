"""Markdown 格式化管线：将原始 Markdown 内容增强为高质量输出。"""

from __future__ import annotations

import html
import logging
import os
import re
import uuid
from enum import Enum, auto
from typing import TYPE_CHECKING, Dict, List, Optional, Tuple

if TYPE_CHECKING:
    from .html_preprocessor import ImgDimensionRegistry

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 行类型分类：用于段落间距归一化
# ---------------------------------------------------------------------------


class _LineType(Enum):
    """Markdown 行级元素类型。"""

    EMPTY = auto()
    HEADING = auto()
    LIST_ITEM = auto()
    TABLE_ROW = auto()
    BLOCKQUOTE = auto()
    CODE_FENCE = auto()
    HR = auto()
    CODEBLOCK_PLACEHOLDER = auto()
    PLAIN_TEXT = auto()


_LINE_PATTERNS: List[Tuple[re.Pattern, _LineType]] = [
    (re.compile(r"^\s*$"), _LineType.EMPTY),
    (re.compile(r"^#{1,6}\s"), _LineType.HEADING),
    (re.compile(r"^\s*[-*+]\s"), _LineType.LIST_ITEM),
    (re.compile(r"^\s*\d+\.\s"), _LineType.LIST_ITEM),
    (re.compile(r"^\s*\|.*\|\s*$"), _LineType.TABLE_ROW),
    (re.compile(r"^\s*>"), _LineType.BLOCKQUOTE),
    (re.compile(r"^```"), _LineType.CODE_FENCE),
    (re.compile(r"^---+\s*$|^\*\*\*+\s*$|^___+\s*$"), _LineType.HR),
    (re.compile(r"^%%CODEBLOCK_"), _LineType.CODEBLOCK_PLACEHOLDER),
]

# 同构序列：这些行类型相邻时保持单个 \n
_HOMOGENEOUS_PAIRS = frozenset(
    {
        (_LineType.LIST_ITEM, _LineType.LIST_ITEM),
        (_LineType.TABLE_ROW, _LineType.TABLE_ROW),
        (_LineType.BLOCKQUOTE, _LineType.BLOCKQUOTE),
    }
)


def _classify_line(line: str) -> _LineType:
    """将 Markdown 行分类为对应的块级元素类型。"""
    for pattern, line_type in _LINE_PATTERNS:
        if pattern.match(line):
            return line_type
    return _LineType.PLAIN_TEXT


def _is_list_continuation(line: str) -> bool:
    """判断行是否为列表项的缩进续行（非新列表标记的缩进文本）。"""
    if not line or not line[0].isspace():
        return False
    stripped = line.lstrip()
    # 本身是新列表标记则不算续行
    if re.match(r"^[-*+]\s", stripped) or re.match(r"^\d+\.\s", stripped):
        return False
    return True


# Default formatting options
DEFAULT_FORMATTING_OPTIONS: Dict[str, bool] = {
    "format_tables": True,
    "enhance_images": True,
    "optimize_links": True,
    "format_lists": True,
    "format_headings": True,
    "apply_typography": True,
    "smart_quotes": True,
    "em_dashes": True,
    "fix_spacing": True,
    # 保留源 HTML <img> 的 width/height 尺寸到最终 Markdown（输出为内嵌 HTML）。
    # 默认开启；关闭后所有图片走标准 ![alt](src) 形式（旧行为）。
    "preserve_image_dimensions": True,
}

# 响应式样式：在保留源尺寸的同时允许窄屏自适应（W3C 推荐 pattern）。
_IMG_RESPONSIVE_STYLE = "max-width:100%;height:auto;"


class MarkdownFormatter:
    """Markdown formatting pipeline for enhancing raw Markdown output."""

    def __init__(self, options: Optional[Dict[str, bool]] = None) -> None:
        self.options = dict(DEFAULT_FORMATTING_OPTIONS)
        if options:
            self.options.update(options)

    def format(
        self,
        markdown_content: str,
        *,
        img_registry: Optional["ImgDimensionRegistry"] = None,
    ) -> str:
        """
        Apply the full formatting pipeline to Markdown content.

        Args:
            markdown_content: Raw Markdown content
            img_registry: 由 ``preprocess_html`` 填充的图片尺寸登记簿。若提供
                且 ``preserve_image_dimensions`` 开关开启，则在管线末尾把
                sentinel 占位符还原为内嵌 HTML ``<img>`` 标签。

        Returns:
            Enhanced and cleaned up Markdown content
        """
        try:
            # 保护代码块内容不被格式化 pass 修改
            markdown_content, protected = self._protect_code_blocks(markdown_content)

            if self.options.get("format_tables", True):
                markdown_content = self._format_tables(markdown_content)

            if self.options.get("enhance_images", True):
                markdown_content = self._format_images(markdown_content)

            if self.options.get("optimize_links", True):
                markdown_content = self._format_links(markdown_content)

            if self.options.get("format_lists", True):
                markdown_content = self._format_lists(markdown_content)

            if self.options.get("format_headings", True):
                markdown_content = self._format_headings(markdown_content)

            # Code block and quote formatting always applied
            markdown_content = self._format_code_blocks(markdown_content)
            markdown_content = self._format_quotes(markdown_content)

            if self.options.get("apply_typography", True):
                markdown_content = self._apply_typography_fixes(markdown_content)

            if self.options.get("fix_spacing", True):
                markdown_content = self._normalize_paragraph_breaks(markdown_content)

            markdown_content = self._basic_cleanup(markdown_content)

            # 还原带尺寸的图片：必须在 _basic_cleanup 之后执行，否则其中的
            # `style="..."` 会被 cleanup 第二段 re.sub 误清除。
            if (
                img_registry is not None
                and self.options.get("preserve_image_dimensions", True)
                and img_registry.placeholders
            ):
                markdown_content = self._restore_image_placeholders(
                    markdown_content, img_registry
                )

            # 还原被保护的代码块
            markdown_content = self._restore_code_blocks(markdown_content, protected)

            return markdown_content

        except Exception as e:
            logger.warning(f"Error post-processing Markdown: {str(e)}")
            return markdown_content

    def _protect_code_blocks(self, markdown_content: str) -> Tuple[str, Dict[str, str]]:
        """提取已标注语言的代码块并替换为占位符，防止格式化管线修改其内容。

        仅保护已有语言标签的代码块（如 ```python, ```algorithm），
        未标注语言的代码块留给 _format_code_blocks 进行语言检测。
        """
        protected: Dict[str, str] = {}

        def _replacer(match: re.Match) -> str:
            placeholder = f"%%CODEBLOCK_{uuid.uuid4().hex[:12]}%%"
            protected[placeholder] = match.group(0)
            return placeholder

        # 仅匹配带语言标签的代码块（```后紧跟字母）
        result = re.sub(
            r"^```[a-zA-Z][^\n]*\n.*?^```\s*$",
            _replacer,
            markdown_content,
            flags=re.MULTILINE | re.DOTALL,
        )
        return result, protected

    def _restore_code_blocks(
        self, markdown_content: str, protected: Dict[str, str]
    ) -> str:
        """将占位符还原为原始代码块内容。"""
        for placeholder, original in protected.items():
            markdown_content = markdown_content.replace(placeholder, original)
        return markdown_content

    def _format_tables(self, markdown_content: str) -> str:
        """Format and align Markdown tables."""
        try:
            lines = markdown_content.split("\n")
            formatted_lines = []

            for i, line in enumerate(lines):
                if (
                    "|" in line
                    and line.strip().startswith("|")
                    and line.strip().endswith("|")
                ):
                    cells = [cell.strip() for cell in line.split("|")[1:-1]]

                    if i + 1 < len(lines) and re.match(
                        r"^\s*\|[\s\-:]+\|\s*$", lines[i + 1]
                    ):
                        formatted_line = "| " + " | ".join(cells) + " |"
                        formatted_lines.append(formatted_line)
                    elif re.match(r"^\s*\|[\s\-:]+\|\s*$", line):
                        separator_cells = []
                        for cell in cells:
                            if ":" in cell:
                                if cell.startswith(":") and cell.endswith(":"):
                                    separator_cells.append(":---:")
                                elif cell.endswith(":"):
                                    separator_cells.append("---:")
                                else:
                                    separator_cells.append(":---")
                            else:
                                separator_cells.append("---")
                        formatted_line = "| " + " | ".join(separator_cells) + " |"
                        formatted_lines.append(formatted_line)
                    else:
                        formatted_line = "| " + " | ".join(cells) + " |"
                        formatted_lines.append(formatted_line)
                else:
                    formatted_lines.append(line)

            return "\n".join(formatted_lines)
        except Exception as e:
            logger.warning(f"Error formatting tables: {str(e)}")
            return markdown_content

    def _format_images(self, markdown_content: str) -> str:
        """Enhance image formatting with better alt text."""
        try:

            def improve_image_alt(match):
                alt_text = match.group(1)
                image_url = match.group(2)

                if not alt_text or alt_text in ["", "image", "img", "photo", "picture"]:
                    filename = os.path.basename(image_url).split(".")[0]
                    alt_text = filename.replace("-", " ").replace("_", " ").title()

                return f"![{alt_text}]({image_url})"

            markdown_content = re.sub(
                r"!\[(.*?)\]\((.*?)\)", improve_image_alt, markdown_content
            )

            # Add proper spacing around images
            markdown_content = re.sub(r"(!\[.*?\]\(.*?\))", r"\n\1\n", markdown_content)

            return markdown_content
        except Exception as e:
            logger.warning(f"Error formatting images: {str(e)}")
            return markdown_content

    def _format_links(self, markdown_content: str) -> str:
        """Optimize link formatting."""
        try:
            markdown_content = re.sub(
                r"\[([^\]]+)\]\s*\(\s*([^\s\)]+)\s*\)", r"[\1](\2)", markdown_content
            )

            markdown_content = re.sub(
                r"\[([^\]]+)\]\s*\n\s*\(([^\)]+)\)", r"[\1](\2)", markdown_content
            )

            return markdown_content
        except Exception as e:
            logger.warning(f"Error formatting links: {str(e)}")
            return markdown_content

    def _format_code_blocks(self, markdown_content: str) -> str:
        """Enhance code block formatting with language detection."""
        try:
            code_patterns = {
                r"(?m)^(\s*)```\s*\n((?:(?!```).)*?def\s+\w+(?:(?!```).)*?)^\1```": r"\1```python\n\2\1```",
                r"(?m)^(\s*)```\s*\n((?:(?!```).)*?function\s+\w+(?:(?!```).)*?)^\1```": r"\1```javascript\n\2\1```",
                r"(?m)^(\s*)```\s*\n((?:(?!```).)*?class\s+\w+(?:(?!```).)*?)^\1```": r"\1```python\n\2\1```",
                r"(?m)^(\s*)```\s*\n((?:(?!```).)*?import\s+(?:(?!```).)*?)^\1```": r"\1```python\n\2\1```",
                r"(?m)^(\s*)```\s*\n((?:(?!```).)*?<\?php(?:(?!```).)*?)^\1```": r"\1```php\n\2\1```",
                r"(?m)^(\s*)```\s*\n((?:(?!```).)*?<html(?:(?!```).)*?)^\1```": r"\1```html\n\2\1```",
                r"(?m)^(\s*)```\s*\n((?:(?!```).)*?SELECT\s+(?:(?!```).)*?)^\1```": r"\1```sql\n\2\1```",
            }

            for pattern, replacement in code_patterns.items():
                markdown_content = re.sub(
                    pattern,
                    replacement,
                    markdown_content,
                    flags=re.DOTALL | re.IGNORECASE,
                )

            markdown_content = re.sub(
                r"(```[a-z]*\n.*?\n```)", r"\n\1\n", markdown_content, flags=re.DOTALL
            )

            return markdown_content
        except Exception as e:
            logger.warning(f"Error formatting code blocks: {str(e)}")
            return markdown_content

    def _format_quotes(self, markdown_content: str) -> str:
        """Improve blockquote formatting."""
        try:
            markdown_content = re.sub(
                r"^(\s*)>\s*(.+)$", r"\1> \2", markdown_content, flags=re.MULTILINE
            )

            markdown_content = re.sub(
                r"(^>.+$)", r"\n\1\n", markdown_content, flags=re.MULTILINE
            )

            return markdown_content
        except Exception as e:
            logger.warning(f"Error formatting quotes: {str(e)}")
            return markdown_content

    def _format_lists(self, markdown_content: str) -> str:
        """Improve list formatting and nesting."""
        try:
            lines = markdown_content.split("\n")
            formatted_lines = []

            for line in lines:
                line = re.sub(r"^(\s*)([-\*\+])\s*(.+)$", r"\1- \3", line)
                line = re.sub(r"^(\s*)(\d+)[\.\)]\s*(.+)$", r"\1\2. \3", line)
                formatted_lines.append(line)

            markdown_content = "\n".join(formatted_lines)
            markdown_content = re.sub(r"\n[-*+]\s*\n(?=\n)", "\n", markdown_content)

            return markdown_content
        except Exception as e:
            logger.warning(f"Error formatting lists: {str(e)}")
            return markdown_content

    def _format_headings(self, markdown_content: str) -> str:
        """Improve heading formatting and hierarchy."""
        try:
            lines = markdown_content.split("\n")
            formatted_lines = []

            for i, line in enumerate(lines):
                if re.match(r"^#{1,6}\s", line):
                    heading = line.strip()

                    if (
                        i > 0
                        and lines[i - 1].strip() != ""
                        and not re.match(r"^#{1,6}\s", lines[i - 1])
                    ):
                        formatted_lines.append("")

                    formatted_lines.append(heading)

                    if i < len(lines) - 1 and lines[i + 1].strip() != "":
                        formatted_lines.append("")
                else:
                    formatted_lines.append(line)

            return "\n".join(formatted_lines)
        except Exception as e:
            logger.warning(f"Error formatting headings: {str(e)}")
            return markdown_content

    def _apply_typography_fixes(self, markdown_content: str) -> str:
        """Apply typography improvements.

        使用 extract-process-restore 模式保护 LaTeX 数学内容，
        防止排版修正破坏公式中的空格和标点。
        """
        try:
            from ..pdf.math_formula import protect_math_content

            def _typography_inner(text: str) -> str:
                text = re.sub(r"(?<!\-)\-\-(?!\-)", "\u2014", text)

                # \u5f15\u7528\u7f16\u53f7\u7a7a\u683c\u538b\u7f29\uff1a"[ 103 ]" \u2192 "[103]"\uff0c"[ 95, 99, 105 ]" \u2192 "[95, 99, 105]"
                text = re.sub(r"\[\s+(\d+(?:\s*,\s*\d+)*)\s+\]", r"[\1]", text)

                lines = text.split("\n")
                fixed_lines = []
                for line in lines:
                    line = re.sub(r" {2,}", " ", line)
                    fixed_lines.append(line)
                text = "\n".join(fixed_lines)

                text = re.sub(r"[^\S\n]+([.!?:;,])", r"\1", text)
                text = re.sub(r"([.!?])[^\S\n]*([A-Z])", r"\1 \2", text)

                return text

            return protect_math_content(markdown_content, _typography_inner)
        except Exception as e:
            logger.warning(f"Error applying typography fixes: {str(e)}")
            return markdown_content

    def _normalize_paragraph_breaks(self, markdown_content: str) -> str:
        """归一化段落间距：确保块级元素间以 ``\\n\\n`` 分隔。

        Web 页面依赖 CSS 控制段内折行，因此 MarkItDown 产出的连续纯文本行
        代表独立段落，应以 ``\\n\\n`` 分隔。同构序列（列表项、表格行、引用行）
        内部保持单个 ``\\n``，代码块内容完全不修改。
        """
        lines = markdown_content.split("\n")
        if len(lines) <= 1:
            return markdown_content

        result: List[str] = [lines[0]]
        inside_code_fence = lines[0].strip().startswith("```")

        for i in range(1, len(lines)):
            prev_line = lines[i - 1]
            curr_line = lines[i]
            curr_stripped = curr_line.strip()

            # 代码围栏状态切换
            if curr_stripped.startswith("```"):
                if inside_code_fence:
                    # 关闭代码围栏
                    result.append(curr_line)
                    inside_code_fence = False
                    continue
                else:
                    # 打开代码围栏：确保前方有空行
                    prev_type = _classify_line(prev_line)
                    if (
                        prev_type != _LineType.EMPTY
                        and result
                        and result[-1].strip() != ""
                    ):
                        result.append("")
                    inside_code_fence = True
                    result.append(curr_line)
                    continue

            # 代码块内部：原样保留
            if inside_code_fence:
                result.append(curr_line)
                continue

            prev_type = _classify_line(prev_line)
            curr_type = _classify_line(curr_line)

            # 空行直接追加，无需插入
            if prev_type == _LineType.EMPTY or curr_type == _LineType.EMPTY:
                result.append(curr_line)
                continue

            # 列表项缩进续行：保持紧凑
            if prev_type == _LineType.LIST_ITEM and _is_list_continuation(curr_line):
                result.append(curr_line)
                continue

            # 列表续行后紧跟新列表项：属于同一列表，保持紧凑
            if _is_list_continuation(prev_line) and curr_type == _LineType.LIST_ITEM:
                result.append(curr_line)
                continue

            # 同构序列：保持单个 \n
            if (prev_type, curr_type) in _HOMOGENEOUS_PAIRS:
                result.append(curr_line)
                continue

            # 其他情况：确保 \n\n 分隔（仅在前一行非空时插入空行）
            if result and result[-1].strip() != "":
                result.append("")
            result.append(curr_line)

        return "\n".join(result)

    def _basic_cleanup(self, markdown_content: str) -> str:
        """Apply basic cleanup operations."""
        try:
            lines = []
            for line in markdown_content.split("\n"):
                cleaned_line = line.rstrip()
                lines.append(cleaned_line)

            markdown_content = "\n".join(lines)
            markdown_content = re.sub(r"\n{3,}", "\n\n", markdown_content)

            # 清除泄漏的原始 HTML 标签（防御性后处理）
            markdown_content = re.sub(
                r"</?(table|tbody|thead|tfoot|tr|td|th)\b[^>]*>", "", markdown_content
            )
            markdown_content = re.sub(
                r"</?(div|span|svg|path|use|g|video|audio|picture|source|iframe|embed|object)\b[^>]*>",
                "",
                markdown_content,
            )
            # 清除孤立的 HTML 属性
            markdown_content = re.sub(r'\s+class="[^"]*"', "", markdown_content)
            markdown_content = re.sub(r'\s+style="[^"]*"', "", markdown_content)
            markdown_content = re.sub(r'\s+aria-\w+="[^"]*"', "", markdown_content)

            markdown_content = markdown_content.strip()

            return markdown_content

        except Exception as e:
            logger.warning(f"Error in basic cleanup: {str(e)}")
            return markdown_content

    def _restore_image_placeholders(
        self,
        markdown_content: str,
        registry: "ImgDimensionRegistry",
    ) -> str:
        """将 ``preprocess_html`` 注入的 sentinel 占位符还原为内嵌 HTML ``<img>``。

        生成模板：
            ``<img src="…" alt="…"[ title="…"][ width="X"][ height="Y"] style="max-width:100%;height:auto;" />``

        - 仅在尺寸非空时输出 ``width``/``height``
        - 仅在 ``title`` 非空时输出 ``title``
        - ``src``/``alt``/``title`` 均经 ``html.escape(quote=True)`` 实体化，
          防止源 HTML 中的特殊字符破坏 Markdown 后续渲染
        - ``style`` 始终输出，保证窄屏自适应
        """
        if not registry.placeholders:
            return markdown_content

        try:
            for sentinel, meta in registry.placeholders.items():
                src = html.escape(meta.get("src") or "", quote=True)
                alt = html.escape(meta.get("alt") or "", quote=True)
                title = meta.get("title") or ""
                width = meta.get("width")
                height = meta.get("height")

                parts: List[str] = [f'<img src="{src}"', f'alt="{alt}"']
                if title:
                    parts.append(f'title="{html.escape(title, quote=True)}"')
                if width:
                    parts.append(f'width="{width}"')
                if height:
                    parts.append(f'height="{height}"')
                parts.append(f'style="{_IMG_RESPONSIVE_STYLE}"')
                img_tag = " ".join(parts) + " />"

                markdown_content = markdown_content.replace(sentinel, img_tag)

            # 防御：登记簿与输出失配（如管线中途丢失/裂变 sentinel）时，
            # 既要避免裸 sentinel 泄漏给用户，也要在日志中暴露以便定位回归。
            from .html_preprocessor import SENTINEL_RE

            orphans = SENTINEL_RE.findall(markdown_content)
            if orphans:
                logger.warning(
                    "Detected %d orphan image sentinel(s) after restore; stripping.",
                    len(orphans),
                )
                markdown_content = SENTINEL_RE.sub("", markdown_content)

            return markdown_content
        except Exception as e:
            logger.warning(f"Error restoring image placeholders: {str(e)}")
            return markdown_content


def markdown_to_text(markdown_content: str) -> str:
    """Convert markdown to plain text by removing formatting."""
    try:
        text = re.sub(r"!\[.*?\]\(.*?\)", "", markdown_content)  # Images
        text = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", text)  # Links
        text = re.sub(r"[*_]{1,2}([^*_]+)[*_]{1,2}", r"\1", text)  # Bold/italic
        text = re.sub(r"`([^`]+)`", r"\1", text)  # Inline code
        text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)  # Headers
        text = re.sub(r"^>\s+", "", text, flags=re.MULTILINE)  # Blockquotes
        text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.MULTILINE)  # Lists
        text = re.sub(r"^\s*\d+\.\s+", "", text, flags=re.MULTILINE)  # Numbered lists

        return text.strip()
    except Exception as e:
        logger.warning(f"Error converting markdown to text: {str(e)}")
        return markdown_content
