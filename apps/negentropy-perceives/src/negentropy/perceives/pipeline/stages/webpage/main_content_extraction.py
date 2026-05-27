"""S4: 主内容区域识别 — 从完整 HTML 中提取文章正文区域（竞争模式）。

三个工具互为竞争：
1. ``trafilatura`` — 调用 ``trafilatura.extract()``（可选依赖）
2. ``readability`` — 调用 ``readability.Document().summary()``（可选依赖）
3. ``beautifulsoup_heuristic`` — 使用现有 ``html_preprocessor.extract_content_area()``

从 ``ctx.raw_html`` 中提取主内容区域，设置 ``ctx.metadata["main_content_html"]``。
"""

from __future__ import annotations

import logging
import re
from html import escape as html_escape
from typing import Dict, Optional

from ...base import StageResult
from ...models import StageContext
from ...registry import register_tool
from .._base import WebToolBase

logger = logging.getLogger(__name__)


_IMG_TAG_RE = re.compile(r"<img\b", re.IGNORECASE)
_H1_TAG_RE = re.compile(r"<h1\b", re.IGNORECASE)
_H2_TAG_RE = re.compile(r"<h2\b", re.IGNORECASE)
_H3_TAG_RE = re.compile(r"<h3\b", re.IGNORECASE)


def _ensure_h1_title(html: str, title: str) -> str:
    """若 main_html 缺失 H1，则将 page title 注入为 H1 置顶。

    readability 等正文提取器常把 H1（页面主标题）抽走作为 title，
    返回的 summary 中不含 H1，这导致 Markdown 输出失去主标题。

    注入位置必须在 ``<body>`` 内（若存在）；放到 ``<html>`` 之前会让
    MarkItDown 等 HTML→MD 转换器把 H1 视为文档之外的噪声并丢弃。
    """
    if not html or not title:
        return html
    if _H1_TAG_RE.search(html):
        return html
    safe = html_escape(title)
    h1_html = f"<h1>{safe}</h1>"

    # 优先注入到 <body> 开头
    body_match = re.search(r"<body\b[^>]*>", html, re.IGNORECASE)
    if body_match:
        idx = body_match.end()
        return html[:idx] + "\n" + h1_html + html[idx:]

    # 没有 <body> 时注入到 <html> 内的开头
    html_match = re.search(r"<html\b[^>]*>", html, re.IGNORECASE)
    if html_match:
        idx = html_match.end()
        return html[:idx] + "\n" + h1_html + html[idx:]

    # 都没有：作为纯片段，放在最前面（后续会被 markitdown 包到 body 内）
    return f"{h1_html}\n{html}"


# 触发“图片丢失”兜底的阈值：原始 HTML 至少有这么多 <img>，
# 但主内容区的 <img> 为 0 时，视为 trafilatura 提取失败。
# 调低到 1：哪怕原文仅有 1 张正文图片，trafilatura 丢失也应触发兜底
# （Anthropic 等 Next.js Image 代理站点上 trafilatura 常完全丢弃 <img>）。
_MIN_RAW_IMAGES_FOR_LOSS_GUARD = 1

# 触发“结构退化”兜底的阈值：原始 HTML 含足够多的 H2/H3，但 trafilatura
# 输出的 H2+H3 总数 ≤ 1 时，视为正文结构被严重压平。
# trafilatura 对部分静态生成站点（Next.js 等）会丢失多数 heading；
# 让 readability/bs_heuristic 兜底通常输出质量更好。
_MIN_RAW_HEADINGS_FOR_LOSS_GUARD = 3
_MAX_MAIN_HEADINGS_FOR_LOSS_GUARD = 1


def _inject_after_h1(html: str, fragment: str) -> str:
    """把 ``fragment`` 注入到 ``html`` 中第一个 ``</h1>`` 之后。

    若 ``html`` 中找不到 H1，则注入到 ``<body>`` 开头；都没有时直接前置。
    """
    if not html or not fragment:
        return html
    h1_close = re.search(r"</h1>", html, re.IGNORECASE)
    if h1_close:
        idx = h1_close.end()
        return html[:idx] + "\n" + fragment + html[idx:]
    body_match = re.search(r"<body\b[^>]*>", html, re.IGNORECASE)
    if body_match:
        idx = body_match.end()
        return html[:idx] + "\n" + fragment + html[idx:]
    return f"{fragment}\n{html}"


def _apply_common_post_processing(
    main_html: str,
    raw_html: str,
    title: str,
) -> str:
    """对所有主内容提取引擎统一的后续处理：标题注入 + hero 元数据注入。

    统一封装 H1 标题注入、hero 元数据（lead 段落、发布日期、品牌图片）
    提取与注入、OG 元数据后备、标题清洗等步骤，确保无论哪个引擎胜出
    都能获得一致的元数据保真度。

    去重保护：如果 ``main_html`` 已包含 hero 段落的文本内容，
    则跳过该段的注入，避免重复。
    """
    # 1. 标题清洗
    og_meta = _extract_og_metadata(raw_html)
    og_title = og_meta.get("title") if og_meta else None
    clean_title = _clean_title(title, og_title)

    # 2. H1 注入
    main_html = _ensure_h1_title(main_html, clean_title)

    # 3. Hero 元数据提取
    hero_html = _extract_hero_metadata(raw_html)

    # 4. OG 后备：当 hero 启发式未匹配时，从 meta 标签构建 hero 片段
    if not hero_html and og_meta:
        parts = []
        if og_meta.get("image"):
            parts.append(f'<img src="{html_escape(og_meta["image"])}" alt="">')
        if og_meta.get("description"):
            parts.append(f"<p>{html_escape(og_meta['description'])}</p>")
        if og_meta.get("published_time"):
            from datetime import datetime

            try:
                dt = datetime.fromisoformat(
                    og_meta["published_time"].replace("Z", "+00:00")
                )
                formatted = dt.strftime("%b %d, %Y")
            except (ValueError, TypeError):
                formatted = og_meta["published_time"]
            parts.append(f"<p>Published {html_escape(formatted)}</p>")
        if parts:
            hero_html = "\n".join(parts)

    # 5. 去重后注入 hero 片段
    if hero_html:
        try:
            from bs4 import BeautifulSoup

            main_soup = BeautifulSoup(main_html, "html.parser")
            existing_texts = {
                p.get_text(strip=True)
                for p in main_soup.find_all("p")
                if p.get_text(strip=True)
            }
            hero_soup = BeautifulSoup(hero_html, "html.parser")
            deduped_parts = []
            for child in hero_soup.children:
                if hasattr(child, "name") and child.name == "p":
                    text = child.get_text(strip=True)
                    if text and text in existing_texts:
                        continue
                deduped_parts.append(str(child))
            hero_html = "\n".join(deduped_parts) if deduped_parts else None
        except Exception:
            logger.debug(
                "Hero deduplication failed, keeping original hero_html", exc_info=True
            )
        if hero_html:
            main_html = _inject_after_h1(main_html, hero_html)

    return main_html


def _extract_hero_metadata(raw_html: str) -> Optional[str]:
    """从原始 HTML 中提取 hero/header 区域的元数据段（lead + 发布日期 + 图片）。

    现代 blog/news 站点（Anthropic / Next.js 站点）常把文章 lead 段与
    发布日期放在 ``<section>`` / ``hero`` / ``metadata`` 容器中，
    与正文 body 分离。readability/trafilatura 把这些视为 page chrome
    并排除掉，导致 Markdown 输出失去文章简介与发布日期。

    本函数用启发式规则识别这类 hero 容器：
      1. 优先匹配 class/data-attr 含 ``hero``/``metadata``/``summary``
         /``lead``/``date``/``published``/``byline``/``intro``/``dek`` 关键字的容器；
      2. 提取容器内的 ``<p>``、``<img>``、``<time>`` 元素（按文档顺序）；
      3. 限制文本长度防误抓整页（仅计算 ``<p>`` 文本，图片不计入）。

    返回 HTML 片段（含 ``<p>``、``<img>``、``<p><time>``），或 None。
    """
    if not raw_html:
        return None
    try:
        from bs4 import BeautifulSoup, Tag

        soup = BeautifulSoup(raw_html, "html.parser")
        hero_keywords = re.compile(
            r"hero|metadata|summary|lead|published|article-(?:header|meta)"
            r"|byline|intro|dek|abstract",
            re.IGNORECASE,
        )

        def _is_hero_container(tag) -> bool:
            if not isinstance(tag, Tag) or tag.name not in ("section", "header", "div"):
                return False
            raw_class = tag.get("class") or [""]
            class_attr = (
                " ".join(raw_class) if isinstance(raw_class, list) else str(raw_class)
            )
            raw_dc = tag.get("data-component", "") or ""
            data_component = str(raw_dc)
            raw_id = tag.get("id", "") or ""
            id_attr = str(raw_id)
            return bool(
                hero_keywords.search(class_attr)
                or hero_keywords.search(data_component)
                or hero_keywords.search(id_attr)
            )

        candidates = soup.find_all(_is_hero_container)
        if not candidates:
            return None

        for c in candidates:
            ps = c.find_all("p", recursive=True)
            if not ps:
                continue
            # 仅 <p> 文本计入长度限制
            total_text = "\n".join(
                p.get_text(strip=True) for p in ps if p.get_text(strip=True)
            )
            if not total_text or len(total_text) > 1500:
                continue
            # 收集所有感兴趣元素并按文档顺序排列
            elements = []
            for child in c.descendants:
                if not isinstance(child, Tag):
                    continue
                if child.name == "img":
                    elements.append(("img", child))
                elif child.name == "time":
                    elements.append(("time", child))
                elif child.name == "p":
                    elements.append(("p", child))
            # 去重：一个 <p> 内的子 <img> 不应同时作为 <img> 和 <p> 出现
            seen_ids: set = set()
            unique_elements = []
            for kind, el in elements:
                el_id = id(el)
                if el_id in seen_ids:
                    continue
                # 跳过已被其他 <p> 包含的 <img>（避免重复）
                if kind == "img":
                    parent = el.parent
                    while parent:
                        if parent.name == "p" and id(parent) in seen_ids:
                            break
                        parent = parent.parent
                    else:
                        seen_ids.add(el_id)
                        unique_elements.append((kind, el))
                    continue
                seen_ids.add(el_id)
                unique_elements.append((kind, el))
            # 构建 HTML 片段
            fragments = []
            for kind, el in unique_elements:
                if kind == "p":
                    txt = el.get_text(strip=True)
                    if txt:
                        fragments.append(f"<p>{el.decode_contents()}</p>")
                elif kind == "img":
                    src = el.get("src", "")
                    if src:
                        fragments.append(str(el))
                elif kind == "time":
                    txt = el.get_text(strip=True)
                    if txt:
                        time_str = str(el)
                        fragments.append(f"<p>{time_str}</p>")
            if fragments:
                return "\n".join(fragments)
        return None
    except Exception:
        logger.debug("hero metadata 提取失败", exc_info=True)
        return None


def _extract_og_metadata(raw_html: str) -> Optional[Dict[str, str]]:
    """从 ``<meta>`` 标签提取 Open Graph / Article 结构化元数据。

    当 :func:`_extract_hero_metadata` 启发式匹配失败时（例如站点使用
    非标准 class 命名），此函数从 ``og:*`` 和 ``article:*`` meta 标签
    中提取标题、描述、图片和发布时间作为后备数据源。

    返回含已找到字段的 dict，或 None（未找到任何有用字段时）。
    """
    if not raw_html:
        return None
    try:
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(raw_html[:50000], "html.parser")
        result: Dict[str, str] = {}
        og_fields = {
            "og:title": "title",
            "og:description": "description",
            "og:image": "image",
            "article:published_time": "published_time",
        }
        for prop, key in og_fields.items():
            tag = soup.find("meta", attrs={"property": prop}) or soup.find(
                "meta", attrs={"name": prop}
            )
            if tag:
                content = tag.get("content", "")
                if content and isinstance(content, str):
                    result[key] = content.strip()
        return result if result else None
    except Exception:
        logger.debug("OG metadata 提取失败", exc_info=True)
        return None


def _clean_title(raw_title: str, og_title: Optional[str] = None) -> str:
    """清洗 ``<title>`` 标签中可能附带的站点名。

    许多站点的 ``<title>`` 格式为 ``"文章标题 | 站点名"`` 或
    ``"站点名 — 文章标题"``，导致 H1 注入时带入多余文本。
    优先使用 OG title（通常更干净），否则按常见分隔符拆分取最长段。
    """
    if og_title and og_title.strip():
        return og_title.strip()
    if not raw_title:
        return raw_title
    # 按优先级尝试常见分隔符
    for sep in (" | ", " — ", " – ", " - ", " ‣ ", " • ", " :: "):
        if sep in raw_title:
            parts = [p.strip() for p in raw_title.split(sep)]
            if len(parts) == 2:
                # 两段式：长度相近时优先取第一段（CMS 通常 Title | Site 格式）
                shorter, longer = sorted(parts, key=len)
                if len(shorter) * 2 >= len(longer):
                    return parts[0]
            return max(parts, key=len)
    return raw_title


def _normalize_redirect_urls(html: str) -> str:
    """规范化形如 ``<host>/redirect/<tracking-id>`` 的 anchor href。

    某些站点（如 Anthropic 自家 blog）把外链经过自己的 redirect 服务
    包装为形如 ``http(s)://<domain>/redirect/<tracking-id>`` 的 URL，
    导致 anchor href 失去真实目标可读性，且 anchor 文本与 href 域名
    语义错位。本函数：当 anchor 文本看起来像一个域名时，把 href 替换
    为 ``https://<anchor-text>/``。其余 anchor 原样保留。"""
    if not html or "/redirect/" not in html:
        return html

    anchor_re = re.compile(
        r'<a(?P<attrs1>[^>]*)\shref="(?P<href>https?://[^"/]+/redirect/[^"]*)"(?P<attrs2>[^>]*)>(?P<text>[^<]*?)</a>',
        re.IGNORECASE,
    )

    def _sub(m: re.Match) -> str:
        text = m.group("text").strip()
        if re.fullmatch(r"[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", text):
            return f'<a{m.group("attrs1")} href="https://{text}/"{m.group("attrs2")}>{m.group("text")}</a>'
        return m.group(0)

    try:
        return anchor_re.sub(_sub, html)
    except Exception:
        logger.debug("redirect URL 规范化失败", exc_info=True)
        return html


def _rehydrate_trafilatura_graphics(html: str) -> str:
    """将 trafilatura 输出的 ``<graphic>`` (TEI) 还原为标准 ``<img>``。

    trafilatura 以 ``output_format='html'`` 输出时，图片会被降级为 TEI 的
    ``<graphic>``，导致下游的 MarkItDown / html2text / Next.js 代理 URL
    解析全部失效。这里用 BS4 将其标签名改回 ``img``，保留全部属性。
    """
    if not html or "<graphic" not in html:
        return html
    try:
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "html.parser")
        for g in soup.find_all("graphic"):
            g.name = "img"
        return str(soup)
    except Exception:
        return html


@register_tool("trafilatura")
class TrafilaturaTool(WebToolBase):
    """基于 trafilatura 的主内容提取工具。

    trafilatura 是一个专门用于网页正文提取的库，在学术网页和新闻站点
    上具备优异的提取精度。
    """

    tool_name = "trafilatura"

    def is_available(self) -> bool:
        try:
            import trafilatura  # noqa: F401

            return True
        except ImportError:
            return False

    async def _run(self, ctx: StageContext) -> StageResult[StageContext]:
        """使用 trafilatura 提取主内容。"""
        try:
            import trafilatura
        except ImportError:
            return StageResult(
                success=False,
                error="trafilatura 未安装",
                engine_used=self.tool_name,
            )

        raw_html = ctx.raw_html
        if not raw_html:
            return StageResult(
                success=False,
                error="raw_html 为空，无法提取主内容",
                engine_used=self.tool_name,
            )

        try:
            # trafilatura 支持直接返回 HTML 格式的主内容
            main_html = trafilatura.extract(
                raw_html,
                output_format="html",
                include_tables=True,
                include_images=True,
                include_links=True,
                include_formatting=True,
                url=ctx.url,
            )

            if not main_html:
                return StageResult(
                    success=False,
                    error="trafilatura 未能提取到主内容",
                    engine_used=self.tool_name,
                )

            # trafilatura HTML 输出会将 <img> 降级为 TEI <graphic>，
            # 在此还原为标准 <img>，让下游 S5/S9/S10 能正常识别图片。
            main_html = _rehydrate_trafilatura_graphics(main_html)

            # 图片丢失兜底：若原始 HTML 中存在图片但 trafilatura
            # 输出为 0，说明本页结构使 trafilatura 整体丢弃了图片
            # （常见于 Next.js 图像代理 / 复杂 figure 嵌套）。此时主动
            # 标记失败，交由 S4 竞争模式降级到 readability 或启发式兜底。
            raw_img_count = len(_IMG_TAG_RE.findall(raw_html))
            main_img_count = len(_IMG_TAG_RE.findall(main_html))
            if raw_img_count >= _MIN_RAW_IMAGES_FOR_LOSS_GUARD and main_img_count == 0:
                logger.warning(
                    "trafilatura 丢弃了全部图片 (raw=%d, main=0)，触发图片丢失兜底",
                    raw_img_count,
                )
                return StageResult(
                    success=False,
                    error=(
                        f"trafilatura 丢弃了全部图片 (raw_html 含 {raw_img_count} "
                        "张)，触发兜底以让其他工具接管"
                    ),
                    engine_used=self.tool_name,
                )

            # 结构退化兜底：若原始 HTML 含足够多的 H2/H3 但 trafilatura
            # 输出的 H2+H3 ≤ 1，说明正文结构被严重压平。此时主动失败，
            # 让 readability / bs_heuristic 接管以保留章节层级。
            raw_heading_count = len(_H2_TAG_RE.findall(raw_html)) + len(
                _H3_TAG_RE.findall(raw_html)
            )
            main_heading_count = len(_H2_TAG_RE.findall(main_html)) + len(
                _H3_TAG_RE.findall(main_html)
            )
            if (
                raw_heading_count >= _MIN_RAW_HEADINGS_FOR_LOSS_GUARD
                and main_heading_count <= _MAX_MAIN_HEADINGS_FOR_LOSS_GUARD
            ):
                logger.warning(
                    "trafilatura 压平了文档结构 (raw_h2+h3=%d, main_h2+h3=%d)，触发结构退化兜底",
                    raw_heading_count,
                    main_heading_count,
                )
                return StageResult(
                    success=False,
                    error=(
                        f"trafilatura 压平了文档结构 (raw_html 含 {raw_heading_count} "
                        f"个 H2/H3，但输出仅剩 {main_heading_count} 个)，触发兜底"
                    ),
                    engine_used=self.tool_name,
                )

            # 统一后续处理：标题清洗 + H1 注入 + hero 元数据注入
            main_html = _apply_common_post_processing(
                main_html, raw_html, ctx.title or ""
            )

            # 规范化站内跟踪 redirect URL
            main_html = _normalize_redirect_urls(main_html)

            ctx.metadata["main_content_html"] = main_html

            return StageResult(
                success=True,
                output=ctx,
                engine_used=self.tool_name,
                metadata={
                    "content_length": len(main_html),
                    "img_count": main_img_count,
                    "raw_img_count": raw_img_count,
                },
            )
        except Exception as e:
            logger.warning("trafilatura 提取失败: %s", e)
            return StageResult(
                success=False,
                error=f"trafilatura 提取失败: {e}",
                engine_used=self.tool_name,
            )


@register_tool("readability")
class ReadabilityTool(WebToolBase):
    """基于 readability-lxml 的主内容提取工具。

    readability-lxml 是 Mozilla Readability 算法的 Python 实现，
    适用于标准文章类页面。
    """

    tool_name = "readability"

    def is_available(self) -> bool:
        try:
            from readability import Document  # noqa: F401

            return True
        except ImportError:
            return False

    async def _run(self, ctx: StageContext) -> StageResult[StageContext]:
        """使用 readability-lxml 提取主内容。"""
        try:
            from readability import Document
        except ImportError:
            return StageResult(
                success=False,
                error="readability-lxml 未安装",
                engine_used=self.tool_name,
            )

        raw_html = ctx.raw_html
        if not raw_html:
            return StageResult(
                success=False,
                error="raw_html 为空，无法提取主内容",
                engine_used=self.tool_name,
            )

        try:
            doc = Document(raw_html, url=ctx.url)
            main_html = doc.summary()
            short_title = doc.short_title()

            if not main_html:
                return StageResult(
                    success=False,
                    error="readability 未能提取到主内容",
                    engine_used=self.tool_name,
                )

            # readability 的标题提取通常更精确
            if short_title and not ctx.title:
                ctx.title = short_title

            # 统一后续处理：标题清洗 + H1 注入 + hero 元数据注入
            main_html = _apply_common_post_processing(
                main_html, raw_html, ctx.title or short_title or ""
            )

            # 规范化站内跟踪 redirect URL（anchor 文本是域名时）
            main_html = _normalize_redirect_urls(main_html)

            ctx.metadata["main_content_html"] = main_html

            return StageResult(
                success=True,
                output=ctx,
                engine_used=self.tool_name,
                metadata={"content_length": len(main_html)},
            )
        except Exception as e:
            logger.warning("readability 提取失败: %s", e)
            return StageResult(
                success=False,
                error=f"readability 提取失败: {e}",
                engine_used=self.tool_name,
            )


@register_tool("beautifulsoup_heuristic")
class BeautifulSoupHeuristicTool(WebToolBase):
    """基于 BeautifulSoup 启发式规则的主内容提取工具。

    委托给现有 ``html_preprocessor.extract_content_area()``。
    """

    tool_name = "beautifulsoup_heuristic"

    def is_available(self) -> bool:
        try:
            from bs4 import BeautifulSoup  # noqa: F401

            return True
        except ImportError:
            return False

    async def _run(self, ctx: StageContext) -> StageResult[StageContext]:
        """使用 BeautifulSoup 启发式规则提取主内容区域。"""
        from ....markdown.html_preprocessor import extract_content_area

        raw_html = ctx.raw_html
        if not raw_html:
            return StageResult(
                success=False,
                error="raw_html 为空，无法提取主内容",
                engine_used=self.tool_name,
            )

        try:
            main_html = extract_content_area(raw_html)

            if not main_html or len(main_html.strip()) < 50:
                return StageResult(
                    success=False,
                    error="BeautifulSoup 启发式未提取到有效主内容",
                    engine_used=self.tool_name,
                )

            # 统一后续处理：标题清洗 + H1 注入 + hero 元数据注入
            main_html = _apply_common_post_processing(
                main_html, raw_html, ctx.title or ""
            )

            # 规范化站内跟踪 redirect URL
            main_html = _normalize_redirect_urls(main_html)

            ctx.metadata["main_content_html"] = main_html

            return StageResult(
                success=True,
                output=ctx,
                engine_used=self.tool_name,
                metadata={"content_length": len(main_html)},
            )
        except Exception as e:
            logger.warning("BeautifulSoup 启发式提取失败: %s", e)
            return StageResult(
                success=False,
                error=f"BeautifulSoup 启发式提取失败: {e}",
                engine_used=self.tool_name,
            )


# Stage 本地工具映射
TOOLS: Dict[str, type] = {
    "trafilatura": TrafilaturaTool,
    "readability": ReadabilityTool,
    "beautifulsoup_heuristic": BeautifulSoupHeuristicTool,
}

STAGE_ID = "main_content_extraction"
STAGE_NAME = "主内容区域识别"
