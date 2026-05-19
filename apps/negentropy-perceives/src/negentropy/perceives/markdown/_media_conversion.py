"""媒体元素转换：video/audio/iframe/img 归一化与 URL 解析。"""

from __future__ import annotations

import logging
import re
from typing import Optional
from urllib.parse import parse_qs, unquote, urljoin, urlparse

from bs4 import BeautifulSoup

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


def convert_media_elements(soup: BeautifulSoup, base_url: Optional[str] = None) -> None:
    """将非 Markdown 友好的媒体元素转换为可转换的等价形式。

    必须在 unwanted_tags/unwanted_patterns 移除之前调用，
    否则媒体元素可能因父容器被删除而丢失。
    """
    # ── 1. <video> → <a> 链接 ──
    for video in soup.find_all("video"):
        video_url: Optional[str] = video.get("src")  # type: ignore[assignment]
        if not video_url:
            source_tag = video.find("source")
            if source_tag:
                video_url = source_tag.get("src")  # type: ignore[assignment]
        if not video_url or not isinstance(video_url, str):
            video.decompose()
            continue

        if base_url and not video_url.startswith(("http://", "https://")):
            video_url = urljoin(base_url, video_url)

        parts: list[str] = []
        poster = video.get("poster")  # type: ignore[assignment]
        if (
            poster
            and isinstance(poster, str)
            and base_url
            and not poster.startswith(("http://", "https://", "data:"))
        ):
            poster = urljoin(base_url, poster)
        if poster and isinstance(poster, str):
            poster_img = soup.new_tag("img", src=poster, alt="[视频封面]")
            parts.append(str(poster_img))

        link = soup.new_tag("a", href=video_url)
        link.string = "[视频]"
        parts.append(str(link))

        video.replace_with(BeautifulSoup(" ".join(parts), "html.parser"))

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

    # ── 6. <img> 归一化：懒加载 + srcset + Next.js 代理解析 ──
    _LAZY_SRC_ATTRS = (
        "data-src",
        "data-original",
        "data-lazy-src",
        "data-url",
        "data-srcset",
    )
    for img in soup.find_all("img"):
        if is_placeholder_src(img.get("src")):
            for attr in _LAZY_SRC_ATTRS:
                lazy = img.get(attr)
                if isinstance(lazy, str) and lazy.strip():
                    if attr == "data-srcset":
                        best_lazy = pick_best_srcset_url(lazy)
                        if best_lazy:
                            img["src"] = best_lazy
                            break
                    else:
                        img["src"] = lazy.strip()
                        break

        if is_placeholder_src(img.get("src")):
            srcset_val = img.get("srcset", "")
            if isinstance(srcset_val, str) and srcset_val:
                best = pick_best_srcset_url(srcset_val)
                if best:
                    img["src"] = best

        src = img.get("src", "")  # type: ignore[assignment]
        if src and isinstance(src, str) and _NEXTJS_IMAGE_RE.search(src):
            img["src"] = resolve_nextjs_image_url(src, base_url)

        srcset = img.get("srcset", "")  # type: ignore[assignment]
        if srcset and isinstance(srcset, str) and _NEXTJS_IMAGE_RE.search(srcset):
            best = pick_best_srcset_url(srcset)
            if best:
                img["src"] = resolve_nextjs_image_url(best, base_url)

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
