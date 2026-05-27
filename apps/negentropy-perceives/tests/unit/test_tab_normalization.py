"""Tab 容器规范化单元测试。

覆盖：
- 标准 tablist + tabpanel + img → figure + figcaption 序列
- aria-hidden 在 panel 内被剥除
- carousel/gallery 外层容器被一并替换
- 缺 role=tablist 但有兄弟 role=tab 时回退识别
- panel 内含 video 时与媒体规范化协同
"""

from __future__ import annotations

from bs4 import BeautifulSoup

from negentropy.perceives.markdown._tab_normalization import normalize_tab_containers


def _figcap_texts(soup: BeautifulSoup) -> list[str]:
    return [
        " ".join(fc.get_text(separator=" ", strip=True).split())
        for fc in soup.find_all("figcaption")
    ]


def test_standard_tabs_flattened_with_captions() -> None:
    """三个 tab 应展平为三个 figure + figcaption，且全部 img 保留。"""
    html = """
    <div class="media-carousel">
      <div role="tablist">
        <button role="tab" aria-selected="true" aria-controls="p-0">Opening screen</button>
        <button role="tab" aria-selected="false" aria-controls="p-1">Sprite editor</button>
        <button role="tab" aria-selected="false" aria-controls="p-2">Game play</button>
      </div>
      <div role="tabpanel" id="p-0" aria-hidden="false">
        <img src="https://cdn.example.com/img1.png" alt="screen-1">
      </div>
      <div role="tabpanel" id="p-1" aria-hidden="true">
        <img src="https://cdn.example.com/img2.png" alt="screen-2">
      </div>
      <div role="tabpanel" id="p-2" aria-hidden="true">
        <img src="https://cdn.example.com/img3.png" alt="screen-3">
      </div>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")

    n = normalize_tab_containers(soup)

    assert n == 1
    figures = soup.find_all("figure")
    assert len(figures) == 3
    img_srcs = [img.get("src") for img in soup.find_all("img")]
    assert img_srcs == [
        "https://cdn.example.com/img1.png",
        "https://cdn.example.com/img2.png",
        "https://cdn.example.com/img3.png",
    ]
    assert _figcap_texts(soup) == ["Opening screen", "Sprite editor", "Game play"]
    # MediaCarousel 容器已被替换
    assert not soup.find(class_="media-carousel")
    # aria-hidden 已剥除
    assert not soup.find(attrs={"aria-hidden": True})


def test_falls_back_when_role_tablist_missing() -> None:
    """父节点缺 role=tablist 但兄弟含 role=tab，应回退识别。"""
    html = """
    <div class="tabs-wrapper">
      <div class="tab-row">
        <button role="tab" aria-controls="x-0">Alpha</button>
        <button role="tab" aria-controls="x-1">Beta</button>
      </div>
      <section role="tabpanel" id="x-0"><img src="a.png"></section>
      <section role="tabpanel" id="x-1"><img src="b.png"></section>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")

    n = normalize_tab_containers(soup)

    assert n == 1
    figures = soup.find_all("figure")
    assert len(figures) == 2
    assert _figcap_texts(soup) == ["Alpha", "Beta"]


def test_aria_hidden_inside_panel_is_stripped() -> None:
    """panel 内部嵌套 aria-hidden=true 的节点应被剥属性，不被丢弃。"""
    html = """
    <div role="tablist">
      <button role="tab" aria-controls="p-0">Tab A</button>
    </div>
    <div role="tabpanel" id="p-0" aria-hidden="true">
      <div aria-hidden="true">
        <img src="https://cdn.example.com/inner.png" alt="inner">
      </div>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")

    n = normalize_tab_containers(soup)

    assert n == 1
    assert soup.find("img", {"src": "https://cdn.example.com/inner.png"}) is not None
    assert not soup.find(attrs={"aria-hidden": True})


def test_panel_with_existing_figure_reuses_caption() -> None:
    """panel 内已有 <figure>+<figcaption> 时应复用，不重复注入。"""
    html = """
    <div role="tablist">
      <button role="tab" aria-controls="p-0">Tab A</button>
    </div>
    <div role="tabpanel" id="p-0">
      <figure>
        <img src="x.png">
        <figcaption>Existing caption</figcaption>
      </figure>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")

    n = normalize_tab_containers(soup)

    assert n == 1
    figcaps = _figcap_texts(soup)
    # 已存在的 caption 应被保留；不被新 label "Tab A" 覆盖
    assert "Existing caption" in figcaps


def test_panel_with_video_preserved() -> None:
    """panel 内含 video 时，video 标签应原样保留在 figure 内。"""
    html = """
    <div role="tablist">
      <button role="tab" aria-controls="p-0">Demo</button>
    </div>
    <div role="tabpanel" id="p-0">
      <video controls src="https://cdn.example.com/clip.mp4"></video>
    </div>
    """
    soup = BeautifulSoup(html, "html.parser")

    n = normalize_tab_containers(soup)

    assert n == 1
    video = soup.find("video")
    assert video is not None
    assert video.get("src") == "https://cdn.example.com/clip.mp4"
    figure = soup.find("figure")
    assert figure is not None
    assert figure.find("video") is not None


def test_idempotent_on_html_without_tabs() -> None:
    """没有 ARIA Tabs 的 HTML 不应被规范化，结构内容应保留。"""
    html = "<article><p>Plain text</p><img src='a.png'></article>"
    soup = BeautifulSoup(html, "html.parser")

    n = normalize_tab_containers(soup)

    assert n == 0
    # 内容等价：仍有原段落与图片，且没有新增 figure/figcaption
    assert soup.find("p", string="Plain text") is not None
    assert soup.find("img", {"src": "a.png"}) is not None
    assert soup.find("figure") is None
    assert soup.find("figcaption") is None
