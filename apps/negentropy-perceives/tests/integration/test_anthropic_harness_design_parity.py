"""Anthropic Harness Design 文章解析回归测试。

围绕 Anthropic 工程博客 ``harness-design-long-running-apps`` 一文构建端到端
1:1 还原回归。文章关键特征：
- 9 张 ``<img>`` (Next.js Image 代理 + srcSet 形式)
- 2 段 ``<video controls src>`` (Sanity CDN 直链 MP4)
- 多组 ARIA Tabs (Opening screen / Sprite editor / Game play 等)
- 8 个 ``role="tabpanel"``

测试默认使用离线 fixture ``tests/fixtures/webpage/anthropic_harness_design.html``
以保证 CI 稳定；可通过环境变量 ``RUN_NETWORK_TESTS=1`` 启用网络版 smoke test。
"""

from __future__ import annotations

import asyncio
import os
import re
from pathlib import Path

import pytest


FIXTURE_PATH = (
    Path(__file__).parent.parent
    / "fixtures"
    / "webpage"
    / "anthropic_harness_design.html"
)
TARGET_URL = "https://www.anthropic.com/engineering/harness-design-long-running-apps"


def _count_pattern(text: str, pattern: str) -> int:
    return len(re.findall(pattern, text, re.IGNORECASE))


@pytest.fixture
def raw_html() -> str:
    assert FIXTURE_PATH.exists(), f"fixture 缺失: {FIXTURE_PATH}"
    return FIXTURE_PATH.read_text(encoding="utf-8")


def test_fixture_baseline_counts(raw_html: str) -> None:
    """fixture 静态计数与设计依据一致 (img≥9 / video≥2 / tabpanel≥6)。"""
    assert _count_pattern(raw_html, r"<img\b") >= 9
    assert _count_pattern(raw_html, r"<video\b") >= 2
    assert _count_pattern(raw_html, r'role="tabpanel"') >= 6


def test_preprocess_raw_html_preserves_tab_images(raw_html: str) -> None:
    """raw_html 经过 _preprocess_raw_for_extraction 后所有 tab 图片应保留。"""
    from negentropy.perceives.pipeline.stages.webpage.main_content_extraction import (
        _preprocess_raw_for_extraction,
    )

    processed = _preprocess_raw_for_extraction(raw_html)

    # 所有 9 张 <img> 都应仍在
    assert _count_pattern(processed, r"<img\b") >= 9
    # MediaCarousel 容器应已被 figure 序列替代（不再剩 carousel 类名 div）
    # 注：仅检查不存在 role="tabpanel" 残留即可
    assert _count_pattern(processed, r'role="tabpanel"') == 0
    # 三个 tab label 应被翻译为 figcaption
    for label in ("Opening screen", "Sprite editor", "Game play"):
        assert label in processed, f"figcaption 文本缺失: {label}"
    # aria-hidden 已剥除
    assert _count_pattern(processed, r'aria-hidden="true"') == 0


def test_native_video_tag_preserved_after_preprocess(raw_html: str) -> None:
    """经过媒体转换后 <video> 标签应保留，不应降级为 [视频] 文本链接。"""
    from negentropy.perceives.markdown.html_preprocessor import preprocess_html

    cleaned = preprocess_html(raw_html, base_url=TARGET_URL)

    # video 标签计数应 ≥ 2（原页面 2 处）
    assert _count_pattern(cleaned, r"<video\b") >= 2
    # 不应再出现降级文本
    assert "[视频]" not in cleaned


def test_imgs_have_resolved_cdn_urls_after_preprocess(raw_html: str) -> None:
    """所有 img 的 src 经过预处理应解析为绝对 CDN URL（Next.js 代理已展开）。"""
    from bs4 import BeautifulSoup

    from negentropy.perceives.markdown.html_preprocessor import preprocess_html

    cleaned = preprocess_html(raw_html, base_url=TARGET_URL)
    soup = BeautifulSoup(cleaned, "html.parser")

    img_srcs = [img.get("src", "") for img in soup.find_all("img") if img.get("src")]

    # 至少 9 张图，且 src 都不应是 placeholder
    assert len(img_srcs) >= 9
    for s in img_srcs:
        assert s.startswith(("http://", "https://", "data:")), f"未解析的 src: {s}"
        assert "/_next/image" not in s, f"Next.js 代理 URL 未展开: {s}"


@pytest.mark.skipif(
    os.getenv("RUN_NETWORK_TESTS") != "1",
    reason="需要 RUN_NETWORK_TESTS=1 才跑网络抓取版本",
)
def test_end_to_end_network_smoke() -> None:
    """网络版 smoke test：调用 parse_webpage_to_markdown 完整 pipeline。"""
    from negentropy.perceives.ops.markdown import parse_webpage_to_markdown

    out = asyncio.run(parse_webpage_to_markdown(url=TARGET_URL))

    assert out.get("success") is True, f"parse 失败: {out.get('error')}"
    md = out.get("markdown_content", "")
    assert md, "markdown_content 为空"

    img_count = _count_pattern(md, r"<img\b") + _count_pattern(md, r"!\[")
    video_count = _count_pattern(md, r"<video\b")
    assert img_count >= 9, f"img_count={img_count} < 9"
    assert video_count >= 2, f"video_count={video_count} < 2"
    for label in ("Opening screen", "Sprite editor", "Game play"):
        assert label in md, f"figcaption/label 缺失: {label}"


def test_markdown_conversion_end_to_end_from_fixture(raw_html: str) -> None:
    """直接用 fixture HTML 跑 MarkdownConverter，断言关键元素全部保留。

    跳过 page_fetching stage，从 S4 之后的逻辑级联到 markdown 转换，
    模拟"网络已抓回 raw_html，剩余 pipeline 应交付 1:1 Markdown"。
    """
    from negentropy.perceives.markdown.converter import MarkdownConverter

    converter = MarkdownConverter()
    md = converter.html_to_markdown(raw_html, base_url=TARGET_URL)
    assert md, "markdown 输出为空"

    # 关键元素都应保留
    assert _count_pattern(md, r"<video\b") >= 2, "video 标签丢失"
    img_count = _count_pattern(md, r"<img\b") + _count_pattern(md, r"!\[")
    assert img_count >= 9, f"img/markdown image 计数={img_count} < 9"

    # tab 标签翻译为 figcaption（或正文文本，至少出现）
    for label in ("Opening screen", "Sprite editor", "Game play"):
        assert label in md, f"tab label 缺失: {label}"


def test_video_url_resolved_in_markdown(raw_html: str) -> None:
    """两段 Sanity CDN 视频 URL 应原样出现在 markdown 输出中。"""
    from negentropy.perceives.markdown.converter import MarkdownConverter

    converter = MarkdownConverter()
    md = converter.html_to_markdown(raw_html, base_url=TARGET_URL)

    # Anthropic 文章中两段视频的 sanity.io CDN host 应至少出现 2 次
    sanity_hits = md.count("cdn.sanity.io/files")
    assert sanity_hits >= 2, f"sanity CDN URL 命中次数={sanity_hits} < 2"
