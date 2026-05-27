"""HTML 预处理模块：清理、内容区域提取、URL 归一化。

本模块作为外观层（Facade），将具体实现委托至正交分解后的子模块：
- ``_media_conversion``: video/audio/iframe/img 归一化与 URL 解析
- ``_math_preservation``: MathJax/KaTeX/MathML → LaTeX 保留
- ``_html_builder``: 内容区域提取、回退转换、HTML 构建
"""

import logging
import re
import uuid
from dataclasses import dataclass, field
from typing import Dict, Optional, Tuple
from urllib.parse import urljoin

from bs4 import BeautifulSoup, Comment, NavigableString, Tag

# 从子模块重新导出公共 API，保持向后兼容
from ._media_conversion import (  # noqa: F401
    convert_media_elements as _convert_media_elements,
    is_placeholder_src as _is_placeholder_src,
)
from ._math_preservation import (  # noqa: F401
    preserve_math_elements as _preserve_math_elements,
    extract_latex_from_annotation as _extract_latex_from_annotation,
)
from ._tab_normalization import (  # noqa: F401
    normalize_tab_containers as _normalize_tab_containers,
)
from ._html_builder import (  # noqa: F401
    extract_content_area,
    fallback_html_conversion,
    build_html_from_text,
    html_table_to_markdown as _html_table_to_markdown,
    heuristic_split_paragraphs as _heuristic_split_paragraphs,
    match_image_to_paragraph as _match_image_to_paragraph,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 图片尺寸占位符登记簿
# ---------------------------------------------------------------------------

SENTINEL_PREFIX = "XIMGPLACEHOLDER"
SENTINEL_SUFFIX = "ENDX"
SENTINEL_RE = re.compile(rf"{SENTINEL_PREFIX}[0-9a-f]{{32}}{SENTINEL_SUFFIX}")

# Video sentinel：与 IMG 同一族但前缀不同，便于在 formatter 中分别还原
VIDEO_SENTINEL_PREFIX = "XVIDEOPLACEHOLDER"
VIDEO_SENTINEL_SUFFIX = "ENDX"
VIDEO_SENTINEL_RE = re.compile(
    rf"{VIDEO_SENTINEL_PREFIX}[0-9a-f]{{32}}{VIDEO_SENTINEL_SUFFIX}"
)


@dataclass
class ImgDimensionRegistry:
    """图片占位符登记簿：sentinel → 原始 <img> 元信息。"""

    placeholders: Dict[str, Dict[str, Optional[str]]] = field(default_factory=dict)

    def issue(
        self,
        *,
        src: str,
        alt: str,
        width: Optional[str],
        height: Optional[str],
        title: str = "",
    ) -> str:
        """登记一条图片元信息并返回 sentinel 字符串。"""
        sentinel = f"{SENTINEL_PREFIX}{uuid.uuid4().hex}{SENTINEL_SUFFIX}"
        self.placeholders[sentinel] = {
            "src": src,
            "alt": alt,
            "width": width,
            "height": height,
            "title": title,
        }
        return sentinel


@dataclass
class VideoRegistry:
    """视频占位符登记簿：sentinel → 内嵌 HTML <video> 标签字符串。

    MarkItDown 在 HTML→Markdown 转换时会静默丢弃 ``<video>`` 标签。
    本登记簿在 preprocess 阶段把 ``<video>`` 标签替换为 sentinel 文本节点，
    让 MarkItDown 当成普通文字保留下来；postprocess 阶段再把 sentinel 还原
    为内嵌 HTML 字符串，由前端 ``rehype-raw + rehype-sanitize`` 解析为
    可播放的 ``<video>`` 节点。
    """

    placeholders: Dict[str, str] = field(default_factory=dict)

    def issue(self, html_str: str) -> str:
        """登记一段 <video> HTML 并返回 sentinel 字符串。"""
        sentinel = f"{VIDEO_SENTINEL_PREFIX}{uuid.uuid4().hex}{VIDEO_SENTINEL_SUFFIX}"
        self.placeholders[sentinel] = html_str
        return sentinel


# 尺寸解析正则
_PURE_NUM_RE = re.compile(r"^\s*(\d+(?:\.\d+)?)\s*$")
_PX_VALUE_RE = re.compile(r"(\d+(?:\.\d+)?)\s*px\b", re.IGNORECASE)
_STYLE_WIDTH_RE = re.compile(r"(?:^|;)\s*width\s*:\s*([^;]+)", re.IGNORECASE)
_STYLE_HEIGHT_RE = re.compile(r"(?:^|;)\s*height\s*:\s*([^;]+)", re.IGNORECASE)


def _parse_dim(value: Optional[str]) -> Optional[str]:
    """解析单一尺寸值，返回整数像素字符串或 None。"""
    if not value or not isinstance(value, str):
        return None
    raw = value.strip()
    if not raw or raw.lower() in ("auto", "0", "inherit", "initial", "unset"):
        return None
    if raw.endswith("%"):
        return None
    m = _PURE_NUM_RE.match(raw)
    if m:
        n = float(m.group(1))
        return str(int(n)) if n > 0 else None
    m = _PX_VALUE_RE.search(raw)
    if m:
        n = float(m.group(1))
        return str(int(n)) if n > 0 else None
    return None


def _extract_img_dimensions(img: Tag) -> Tuple[Optional[str], Optional[str]]:
    """从 ``<img>`` 标签提取 width/height。"""
    style = img.get("style", "")
    style_w = style_h = None
    if isinstance(style, str) and style:
        sw_match = _STYLE_WIDTH_RE.search(style)
        if sw_match:
            style_w = _parse_dim(sw_match.group(1))
        sh_match = _STYLE_HEIGHT_RE.search(style)
        if sh_match:
            style_h = _parse_dim(sh_match.group(1))
    attr_w_val = img.get("width")
    attr_h_val = img.get("height")
    attr_w = _parse_dim(attr_w_val if isinstance(attr_w_val, str) else None)
    attr_h = _parse_dim(attr_h_val if isinstance(attr_h_val, str) else None)
    return (style_w or attr_w, style_h or attr_h)


def _match_computed_size(
    src_val: str, computed_image_sizes: Dict[str, Dict[str, int]]
) -> Optional[Dict[str, int]]:
    """尝试多种策略匹配 computed_image_sizes 中的尺寸。

    匹配优先级：
    1. 精确 URL 匹配
    2. URL 路径末段匹配（处理 Next.js Image 等代理 URL）
    """
    # 1. 精确匹配
    if src_val in computed_image_sizes:
        return computed_image_sizes[src_val]

    # 2. 从代理 URL 中提取原始 URL 进行匹配
    #    例如 Next.js: /_next/image?url=<encoded_url>&w=3840&q=75
    from urllib.parse import parse_qs, urlparse

    src_path = urlparse(src_val).path
    for key, dims in computed_image_sizes.items():
        key_path = urlparse(key).path
        # 检查 key 是否为代理 URL 且包含 src_val 的原始路径
        if "/_next/image" in key_path:
            qs = parse_qs(urlparse(key).query)
            orig_url = qs.get("url", [None])[0]
            if orig_url and orig_url == src_val:
                return dims
        # 路径末段匹配（如 xxx-1920x1080.gif）
        if src_path and key_path and src_path.split("?")[0] == key_path.split("?")[0]:
            return dims

    return None


def _register_img_placeholders(
    soup: BeautifulSoup,
    registry: ImgDimensionRegistry,
    computed_image_sizes: Optional[Dict[str, Dict[str, int]]] = None,
) -> None:
    """遍历 ``<img>``：对带尺寸的图片登记 sentinel 并替换原节点。

    当 computed_image_sizes 可用时（来自 Selenium 浏览器渲染），优先使用
    CSS 计算尺寸替代 HTML 属性固有尺寸，使输出更贴近原站实际布局。
    """
    for img in list(soup.find_all("img")):
        src_val = img.get("src", "")
        if not isinstance(src_val, str) or not src_val.strip():
            continue
        if _is_placeholder_src(src_val):
            continue
        width, height = _extract_img_dimensions(img)
        # 优先使用 Selenium 捕获的计算尺寸
        if computed_image_sizes:
            matched_dims = _match_computed_size(src_val, computed_image_sizes)
            if matched_dims:
                cw = matched_dims.get("width")
                ch = matched_dims.get("height")
                if cw and cw > 0:
                    width = str(cw)
                if ch and ch > 0:
                    height = str(ch)
        if not width and not height:
            continue
        alt_val = img.get("alt", "")
        title_val = img.get("title", "")
        sentinel = registry.issue(
            src=src_val,
            alt=alt_val if isinstance(alt_val, str) else "",
            width=width,
            height=height,
            title=title_val if isinstance(title_val, str) else "",
        )
        img.replace_with(NavigableString(sentinel))


def preprocess_html(
    html_content: str,
    base_url: Optional[str] = None,
    *,
    img_registry: Optional[ImgDimensionRegistry] = None,
    video_registry: Optional[VideoRegistry] = None,
    computed_image_sizes: Optional[Dict[str, Dict[str, int]]] = None,
) -> str:
    """预处理 HTML 内容，为 MarkItDown 转换做准备。"""
    try:
        soup = BeautifulSoup(html_content, "html.parser")

        # 收集 <pre>/<code>/<samp> 元素及其所有后代的引用
        protected_ids: set = set()
        for pre in soup.find_all(["pre", "code", "samp"]):
            protected_ids.add(id(pre))
            for descendant in pre.descendants:
                protected_ids.add(id(descendant))

        # Remove comments
        comments = soup.find_all(string=lambda text: isinstance(text, Comment))
        for comment in comments:
            comment.extract()

        # Preserve math elements (MathJax, KaTeX, MathML) BEFORE removing scripts
        _preserve_math_elements(soup)

        # 将非 Markdown 友好的媒体元素转换为可转换形式
        _convert_media_elements(soup, base_url, video_registry=video_registry)

        # 规范化 ARIA Tabs 子树为 figure 序列（必须在 unwanted_patterns
        # 删除前执行，否则外层 media-carousel 容器会被一并剔除）
        try:
            _normalize_tab_containers(soup)
        except Exception as e:  # noqa: BLE001
            logger.debug("Tabs 规范化跳过: %s", e)

        # 登记带尺寸的 <img>
        if img_registry is not None:
            _register_img_placeholders(
                soup, img_registry, computed_image_sizes=computed_image_sizes
            )

        # Remove unwanted elements
        unwanted_tags = [
            "script",
            "style",
            "nav",
            "header",
            "footer",
            "aside",
            "advertisement",
            "ads",
        ]
        for tag in unwanted_tags:
            for element in soup.find_all(tag):
                if id(element) not in protected_ids:
                    element.decompose()

        # Remove elements with specific classes/ids
        unwanted_patterns = [
            re.compile(
                r"(?<![a-zA-Z0-9])"
                r"(?:ad(?:s)?|advertisement|sidebar|nav|menu)"
                r"(?![a-zA-Z0-9])",
                re.I,
            ),
            re.compile(
                r".*(newsletter|subscribe|subscription|signup|sign-up|mailing-list).*",
                re.I,
            ),
            re.compile(r".*(social|share|sharing-widget|share-buttons).*", re.I),
            re.compile(r".*(cookie|consent|gdpr|cookie-banner).*", re.I),
            re.compile(r".*(copy-button|copy-btn|clipboard|code-toolbar).*", re.I),
            re.compile(r".*(carousel|slider|gallery|swiper|slick).*", re.I),
            re.compile(r".*(tooltip|popover|modal|dialog|overlay|toast).*", re.I),
        ]

        def _has_content_media(el) -> bool:
            try:
                return bool(el.find(["img", "figure", "picture", "video", "audio"]))
            except Exception:
                return False

        for pattern in unwanted_patterns:
            for element in soup.find_all(class_=pattern):
                if id(element) in protected_ids:
                    continue
                if _has_content_media(element):
                    continue
                element.decompose()

        for pattern in unwanted_patterns:
            for element in soup.find_all(id=pattern):
                if id(element) in protected_ids:
                    continue
                if _has_content_media(element):
                    continue
                element.decompose()

        # 移除无内容价值的交互元素
        for element in soup.find_all(["button", "noscript"]):
            if id(element) not in protected_ids:
                element.decompose()

        # 移除不含 <text> 的内联 SVG 图标（保留含文字的 SVG 图表）
        for svg in soup.find_all("svg"):
            if id(svg) not in protected_ids and not svg.find("text"):
                svg.decompose()

        # 剥离所有剩余元素的 class 和 style 属性
        for element in soup.find_all(True):
            if id(element) not in protected_ids:
                element.attrs.pop("class", None)
                element.attrs.pop("style", None)

        _ensure_block_whitespace(soup)

        # Convert relative URLs to absolute if base_url is provided
        if base_url:
            for link in soup.find_all("a", href=True):
                href = link.get("href", "")
                if isinstance(href, str) and not href.startswith(
                    ("http://", "https://")
                ):
                    link["href"] = urljoin(base_url, href)

            for img in soup.find_all("img", src=True):
                src = img.get("src", "")
                if isinstance(src, str) and not src.startswith(("http://", "https://")):
                    img["src"] = urljoin(base_url, src)

        return str(soup)

    except Exception as e:
        logger.warning(f"Error preprocessing HTML: {str(e)}")
        return html_content


_BLOCK_TAGS = frozenset(
    [
        "p",
        "div",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "blockquote",
        "pre",
        "ul",
        "ol",
        "table",
        "hr",
        "section",
        "article",
        "figure",
        "figcaption",
        "details",
    ]
)


def _ensure_block_whitespace(soup: BeautifulSoup) -> None:
    """在块级元素之间插入换行符，确保 MarkItDown 能正确识别段落边界。

    MarkItDown 在处理 ``<p>A</p><p>B</p>`` 这种无空白分隔的 HTML 时，
    会将内容合并为 ``A B``（单行）。通过在块级闭合标签后插入 ``\\n``，
    使其输出为独立段落。
    """
    for tag_name in _BLOCK_TAGS:
        for element in soup.find_all(tag_name):
            next_sib = element.next_sibling
            if next_sib is None:
                continue
            if isinstance(next_sib, str) and next_sib.strip() == "":
                continue
            element.insert_after("\n")
