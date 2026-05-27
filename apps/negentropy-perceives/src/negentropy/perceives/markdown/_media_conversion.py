"""媒体元素转换：video/audio/iframe/img 归一化与 URL 解析。"""

from __future__ import annotations

import logging
import re
from typing import Optional
from urllib.parse import parse_qs, unquote, urljoin, urlparse

from bs4 import BeautifulSoup, Tag

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# iframe 嵌入视频平台 URL 匹配模式
# ---------------------------------------------------------------------------

_IFRAME_VIDEO_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (
        re.compile(r"https?://(?:www\.)?youtube\.com/embed/([A-Za-z0-9_-]{11})", re.I),
        "https://www.youtube.com/watch?v={id}",
    ),
    (
        re.compile(r"https?://(?:www\.)?youtube\.com/shorts/([A-Za-z0-9_-]{11})", re.I),
        "https://www.youtube.com/watch?v={id}",
    ),
    (
        re.compile(r"https?://youtu\.be/([A-Za-z0-9_-]{11})", re.I),
        "https://www.youtube.com/watch?v={id}",
    ),
    (
        re.compile(r"https?://player\.vimeo\.com/video/(\d+)", re.I),
        "https://vimeo.com/{id}",
    ),
    (
        re.compile(
            r"https?://player\.bilibili\.com/player\.html\?.*bvid=(BV[A-Za-z0-9]+)",
            re.I,
        ),
        "https://www.bilibili.com/video/{id}",
    ),
    (
        re.compile(
            r"https?://player\.bilibili\.com/player\.html\?.*aid=(\d+)",
            re.I,
        ),
        "https://www.bilibili.com/video/av{id}",
    ),
    (
        re.compile(r"https?://(?:www\.)?bilibili\.com/video/(BV[A-Za-z0-9]+)", re.I),
        "https://www.bilibili.com/video/{id}",
    ),
    (
        re.compile(r"https?://(?:www\.)?bilibili\.com/video/av(\d+)", re.I),
        "https://www.bilibili.com/video/av{id}",
    ),
]

_NEXTJS_IMAGE_RE = re.compile(r"/_next/image\b")

_PLACEHOLDER_SRC_RE = re.compile(
    r"^(data:image/(?:gif|svg\+xml);base64,|data:image/svg\+xml,|about:blank)",
    re.IGNORECASE,
)


def is_placeholder_src(src: object) -> bool:
    """判断 img src 是否为占位符/缺失（触发懒加载属性兜底）。"""
    if src is None:
        return True
    if not isinstance(src, str):
        return False
    s = src.strip()
    if not s:
        return True
    return bool(_PLACEHOLDER_SRC_RE.match(s))


def resolve_iframe_video_url(src: str) -> Optional[str]:
    """识别 iframe 嵌入的视频平台 URL，返回可访问的播放页链接。"""
    for pattern, template in _IFRAME_VIDEO_PATTERNS:
        match = pattern.search(src)
        if match:
            return template.format(id=match.group(1))
    return None


def resolve_nextjs_image_url(url: str, base_url: Optional[str] = None) -> str:
    """将 Next.js 图片优化代理 URL 解析为真实 CDN URL。"""
    if not _NEXTJS_IMAGE_RE.search(url):
        return url

    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    real_url = qs.get("url", [None])[0]
    if not real_url:
        return url

    real_url = unquote(real_url)

    if base_url and not real_url.startswith(("http://", "https://", "data:")):
        real_url = urljoin(base_url, real_url)

    return real_url


def pick_best_srcset_url(srcset: str) -> Optional[str]:
    """从 srcset 属性值中选取最高分辨率的图片 URL。"""
    if not srcset:
        return None

    best_url: Optional[str] = None
    best_density: float = 0

    for entry in srcset.split(","):
        entry = entry.strip()
        if not entry:
            continue
        parts = entry.split()
        if not parts:
            continue

        url = parts[0]
        descriptor = parts[1] if len(parts) > 1 else "1x"

        try:
            if descriptor.endswith("x"):
                density = float(descriptor.rstrip("x"))
            elif descriptor.endswith("w"):
                density = float(descriptor.rstrip("w")) / 1000.0
            else:
                density = 1.0
        except (ValueError, TypeError):
            density = 1.0

        if density >= best_density:
            best_density = density
            best_url = url

    return best_url


_VIDEO_PRESERVED_ATTRS = (
    "controls",
    "poster",
    "src",
    "width",
    "height",
    "preload",
    "loop",
    "muted",
    "autoplay",
    "playsinline",
)

# HTML5 video 容器内多 <source> 优先级：MIME 优先，回退按扩展名
_VIDEO_SOURCE_PRIORITY = (
    "video/mp4",
    "video/webm",
    "video/ogg",
    ".mp4",
    ".webm",
    ".ogg",
)


def _pick_best_video_source(video: Tag, base_url: Optional[str]) -> Optional[str]:
    """从 <video> 内部多 <source> 选最佳 src：mp4 > webm > ogg > 首个。"""
    sources = [
        s for s in video.find_all("source", recursive=False) if isinstance(s, Tag)
    ]
    if not sources:
        return None

    def _score(s: Tag) -> int:
        src = s.get("src", "") or ""
        if not isinstance(src, str):
            return 99
        stype_raw = s.get("type", "") or ""
        stype = stype_raw.lower() if isinstance(stype_raw, str) else ""
        src_lower = src.lower()
        for i, hint in enumerate(_VIDEO_SOURCE_PRIORITY):
            if hint.startswith("video/") and stype == hint:
                return i
            if not hint.startswith("video/") and src_lower.endswith(hint):
                return i
        return 50

    sources_sorted = sorted(sources, key=_score)
    best_src = sources_sorted[0].get("src")
    if not isinstance(best_src, str) or not best_src.strip():
        return None
    if base_url and not best_src.startswith(("http://", "https://", "data:")):
        best_src = urljoin(base_url, best_src)
    return best_src


def _flag_parent_figure(video: Tag) -> None:
    """在 <video> 的最近 <figure> 祖先上打 data-keep 标记。

    防止 trafilatura/readability 把"看似只含 video 的 figure"判定为空而剔除。
    """
    cur: Optional[Tag] = video.parent if isinstance(video.parent, Tag) else None
    for _ in range(3):
        if not isinstance(cur, Tag):
            break
        if cur.name == "figure":
            cur["data-keep"] = "video"
            return
        cur = cur.parent if isinstance(cur.parent, Tag) else None


def convert_media_elements(
    soup: BeautifulSoup,
    base_url: Optional[str] = None,
    *,
    video_registry: object = None,  # 实际类型 VideoRegistry；用 object 避免循环 import
) -> None:
    """将非 Markdown 友好的媒体元素转换为可转换的等价形式。

    必须在 unwanted_tags/unwanted_patterns 移除之前调用，
    否则媒体元素可能因父容器被删除而丢失。

    若提供 ``video_registry``，规范化后的 ``<video>`` 会被替换为 sentinel 文本节点，
    避免 MarkItDown 在 HTML→Markdown 阶段静默丢弃 video 标签；
    后续由 ``MarkdownFormatter._restore_video_placeholders`` 还原。
    """
    # ── 1. <video>：保留原生标签（前端 sanitize 已放行），降级仅作兜底 ──
    for video in soup.find_all("video"):
        # 解析 src：优先顶层属性，回退到 <source>
        video_url_raw = video.get("src")
        video_url: Optional[str] = (
            video_url_raw
            if isinstance(video_url_raw, str) and video_url_raw.strip()
            else None
        )
        if not video_url:
            video_url = _pick_best_video_source(video, base_url)

        # 解析 poster：相对 → 绝对
        poster_raw = video.get("poster")
        poster: Optional[str] = (
            poster_raw if isinstance(poster_raw, str) and poster_raw.strip() else None
        )
        if (
            poster
            and base_url
            and not poster.startswith(("http://", "https://", "data:"))
        ):
            poster = urljoin(base_url, poster)

        # 完全无 src 可解析：保留 poster 兜底链接，绝不直接 decompose
        if not video_url:
            if poster:
                a_tag = soup.new_tag("a", href=poster)
                a_tag.string = "[视频封面]"
                video.replace_with(a_tag)
            else:
                video.decompose()
            continue

        if base_url and not video_url.startswith(("http://", "https://", "data:")):
            video_url = urljoin(base_url, video_url)

        # 规范化属性：清空后按白名单回填
        new_attrs: dict = {"src": video_url, "controls": ""}
        for key in _VIDEO_PRESERVED_ATTRS:
            if key in ("src", "controls"):
                continue
            val = video.get(key)
            if val is None:
                continue
            if key in ("muted", "autoplay", "loop", "playsinline"):
                new_attrs[key] = ""
            elif isinstance(val, str):
                new_attrs[key] = val
            elif isinstance(val, list):
                new_attrs[key] = " ".join(str(v) for v in val)

        if poster:
            new_attrs["poster"] = poster

        new_attrs.setdefault("preload", "metadata")

        # 清理内部 <source>/<track> 子节点（src 已上提到顶层）
        for child in list(video.find_all(["source", "track"])):
            if isinstance(child, Tag):
                child.decompose()

        # 清空文本节点（仅保留属性与空内容）
        video.clear()
        video.attrs = new_attrs

        # 在最近的 figure 祖先打标记，防止 trafilatura/readability 判空丢失
        _flag_parent_figure(video)

        # 若提供 video_registry：把规范化好的 <video> 替换为 sentinel 文本节点，
        # 避免 MarkItDown 在 HTML→Markdown 阶段把 <video> 静默丢弃。
        # postprocess 阶段会将 sentinel 还原为内嵌 HTML。
        if video_registry is not None:
            try:
                from bs4 import NavigableString

                html_str = str(video)
                sentinel = video_registry.issue(html_str)  # type: ignore[attr-defined]
                video.replace_with(NavigableString(sentinel))
            except Exception:
                # 注册失败时保留原 video 标签（MarkItDown 会丢，但前端 sanitize 安全）
                logger.debug("video sentinel 注册失败，保留原标签", exc_info=True)

    # ── 2. <audio> → <a> 链接 ──
    for audio in soup.find_all("audio"):
        audio_url = audio.get("src")  # type: ignore[assignment]
        if not audio_url:
            source_tag = audio.find("source")
            if source_tag:
                audio_url = source_tag.get("src")  # type: ignore[assignment]
        if not audio_url or not isinstance(audio_url, str):
            audio.decompose()
            continue

        if base_url and not audio_url.startswith(("http://", "https://")):
            audio_url = urljoin(base_url, audio_url)

        link = soup.new_tag("a", href=audio_url)
        link.string = "[音频]"
        audio.replace_with(link)

    # ── 3. <iframe> 视频 → <a> 链接 ──
    for iframe in soup.find_all("iframe"):
        src = iframe.get("src", "")  # type: ignore[assignment]
        if not src or not isinstance(src, str):
            iframe.decompose()
            continue

        watch_url = resolve_iframe_video_url(src)
        if watch_url:
            link = soup.new_tag("a", href=watch_url)
            link.string = "[视频]"
            iframe.replace_with(link)

    # ── 4. <embed> 视频 → <a> 链接 ──
    for embed in soup.find_all("embed"):
        embed_src = embed.get("src", "")  # type: ignore[assignment]
        embed_type = embed.get("type", "")  # type: ignore[assignment]
        if not embed_src or not isinstance(embed_src, str):
            embed.decompose()
            continue
        etype = embed_type.lower() if isinstance(embed_type, str) else ""
        if "video/" in etype or embed_src.endswith(
            (".mp4", ".webm", ".ogg", ".avi", ".mov")
        ):
            if base_url and not embed_src.startswith(("http://", "https://")):
                embed_src = urljoin(base_url, embed_src)
            link = soup.new_tag("a", href=embed_src)
            link.string = "[视频]"
            embed.replace_with(link)

    # ── 5. <object> 视频 → <a> 链接 ──
    for obj in soup.find_all("object"):
        data_url = obj.get("data", "")  # type: ignore[assignment]
        obj_type = obj.get("type", "")  # type: ignore[assignment]
        if not data_url or not isinstance(data_url, str):
            obj.decompose()
            continue
        otype = obj_type.lower() if isinstance(obj_type, str) else ""
        if "video/" in otype or data_url.endswith(
            (".mp4", ".webm", ".ogg", ".avi", ".mov")
        ):
            if base_url and not data_url.startswith(("http://", "https://")):
                data_url = urljoin(base_url, data_url)
            link = soup.new_tag("a", href=data_url)
            link.string = "[视频]"
            obj.replace_with(link)

    # ── 6. <img> 归一化：懒加载 + srcset/srcSet + Next.js 代理解析 ──
    _LAZY_SRC_ATTRS = (
        "data-src",
        "data-original",
        "data-lazy-src",
        "data-url",
        "data-srcset",
        "data-srcSet",
        "srcset",
        "srcSet",  # Next.js JSX 输出形式（大小写敏感的解析器会保留）
    )
    _SRCSET_ATTRS = {"data-srcset", "data-srcSet", "srcset", "srcSet"}
    for img in soup.find_all("img"):
        # 没有 src 属性或 src 是占位符时，依次尝试懒加载与 srcset 兜底
        if is_placeholder_src(img.get("src")):
            for attr in _LAZY_SRC_ATTRS:
                lazy = img.get(attr)
                if isinstance(lazy, str) and lazy.strip():
                    if attr in _SRCSET_ATTRS:
                        best_lazy = pick_best_srcset_url(lazy)
                        if best_lazy:
                            img["src"] = best_lazy
                            break
                    else:
                        img["src"] = lazy.strip()
                        break

        # Next.js 代理 URL 展开为真实 CDN URL（对 src）
        src = img.get("src", "")  # type: ignore[assignment]
        if src and isinstance(src, str) and _NEXTJS_IMAGE_RE.search(src):
            img["src"] = resolve_nextjs_image_url(src, base_url)

        # 当 srcset/srcSet 中走 Next.js 代理时，挑最佳并展开
        for sk in ("srcset", "srcSet"):
            srcset_val = img.get(sk, "")  # type: ignore[assignment]
            if (
                srcset_val
                and isinstance(srcset_val, str)
                and _NEXTJS_IMAGE_RE.search(srcset_val)
            ):
                best = pick_best_srcset_url(srcset_val)
                if best:
                    img["src"] = resolve_nextjs_image_url(best, base_url)
                break

    # ── 7. <picture> 元素展平 ──
    for picture in soup.find_all("picture"):
        best_url: Optional[str] = None

        for source in picture.find_all("source"):
            srcset = source.get("srcset", "")  # type: ignore[assignment]
            if srcset and isinstance(srcset, str):
                best_url = pick_best_srcset_url(srcset)
                if best_url:
                    break
            src = source.get("src", "")  # type: ignore[assignment]
            if src and isinstance(src, str) and not best_url:
                best_url = src

        child_img = picture.find("img")
        if child_img:
            if best_url:
                child_img["src"] = best_url
            picture.replace_with(child_img)
        elif best_url:
            replacement = soup.new_tag("img", src=best_url)
            picture.replace_with(replacement)
