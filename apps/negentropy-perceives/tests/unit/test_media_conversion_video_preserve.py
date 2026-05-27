"""原生 <video> 保留行为单元测试。

覆盖：
- <video controls src=mp4> → 仍是 <video controls src=mp4>，不再降级为 [视频] 链接
- <video><source src=mp4></video> → 顶层 src 被合并
- 多 source 时按 mp4 > webm > ogg 排序选择
- 无 src 无 source 但有 poster → 兜底 [视频封面] 链接
- 父 figure 被打上 data-keep 标记
- 同样保留 controls/poster/preload/muted/autoplay/loop/playsinline 属性
"""

from __future__ import annotations

from bs4 import BeautifulSoup

from negentropy.perceives.markdown._media_conversion import convert_media_elements


def test_native_video_src_preserved() -> None:
    """带 src 的 <video> 应保留为 <video src="..." controls>，不降级为链接。"""
    html = (
        '<video controls playsInline muted src="https://cdn.example.com/v.mp4"></video>'
    )
    soup = BeautifulSoup(html, "html.parser")

    convert_media_elements(soup, base_url="https://example.com")

    video = soup.find("video")
    assert video is not None, "video 元素应被保留"
    assert video.get("src") == "https://cdn.example.com/v.mp4"
    assert "controls" in video.attrs
    assert "muted" in video.attrs
    assert "playsinline" in video.attrs
    # 不再生成 <a>[视频] 文本链接
    assert soup.find("a", string="[视频]") is None


def test_video_source_child_merged_to_top_level_src() -> None:
    """<video><source src="..."></video> 的 src 应被上提到 video 顶层。"""
    html = """
    <video controls>
      <source src="https://cdn.example.com/clip.mp4" type="video/mp4">
    </video>
    """
    soup = BeautifulSoup(html, "html.parser")

    convert_media_elements(soup, base_url="https://example.com")

    video = soup.find("video")
    assert video is not None
    assert video.get("src") == "https://cdn.example.com/clip.mp4"
    # 内部 source 已清理
    assert video.find("source") is None


def test_multi_source_prefers_mp4_then_webm() -> None:
    """多个 <source> 时按 mp4 > webm > ogg 优先级挑选。"""
    html = """
    <video controls>
      <source src="https://cdn.example.com/clip.ogg" type="video/ogg">
      <source src="https://cdn.example.com/clip.webm" type="video/webm">
      <source src="https://cdn.example.com/clip.mp4" type="video/mp4">
    </video>
    """
    soup = BeautifulSoup(html, "html.parser")

    convert_media_elements(soup, base_url="https://example.com")

    video = soup.find("video")
    assert video is not None
    assert video.get("src") == "https://cdn.example.com/clip.mp4"


def test_video_without_src_with_poster_falls_back_to_poster_link() -> None:
    """无 src 无 source 但有 poster 时，应留下封面链接而不是 decompose。"""
    html = '<video controls poster="https://cdn.example.com/p.jpg"></video>'
    soup = BeautifulSoup(html, "html.parser")

    convert_media_elements(soup, base_url="https://example.com")

    # video 标签已替换为封面链接
    assert soup.find("video") is None
    a = soup.find("a", string="[视频封面]")
    assert a is not None
    assert a.get("href") == "https://cdn.example.com/p.jpg"


def test_video_in_figure_marks_parent_keep() -> None:
    """video 在 figure 内时，figure 应被打上 data-keep="video" 标记。"""
    html = """
    <figure class="post-video">
      <video controls src="https://cdn.example.com/v.mp4"></video>
    </figure>
    """
    soup = BeautifulSoup(html, "html.parser")

    convert_media_elements(soup, base_url="https://example.com")

    figure = soup.find("figure")
    assert figure is not None
    assert figure.get("data-keep") == "video"
    assert figure.find("video") is not None


def test_video_relative_src_resolved_against_base_url() -> None:
    """相对路径的 src 应被解析为绝对 URL。"""
    html = '<video controls src="/files/clip.mp4"></video>'
    soup = BeautifulSoup(html, "html.parser")

    convert_media_elements(soup, base_url="https://example.com/blog/post")

    video = soup.find("video")
    assert video is not None
    assert video.get("src") == "https://example.com/files/clip.mp4"


def test_video_preserves_dimensions() -> None:
    """width/height 属性应被保留。"""
    html = '<video controls src="https://cdn.example.com/v.mp4" width="1600" height="900"></video>'
    soup = BeautifulSoup(html, "html.parser")

    convert_media_elements(soup, base_url="https://example.com")

    video = soup.find("video")
    assert video is not None
    assert video.get("width") == "1600"
    assert video.get("height") == "900"


def test_video_default_preload_metadata() -> None:
    """未指定 preload 时默认设置为 metadata，避免首屏全量下载。"""
    html = '<video controls src="https://cdn.example.com/v.mp4"></video>'
    soup = BeautifulSoup(html, "html.parser")

    convert_media_elements(soup, base_url="https://example.com")

    video = soup.find("video")
    assert video is not None
    assert video.get("preload") == "metadata"
