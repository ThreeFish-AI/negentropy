"""Tab 容器规范化：将 ARIA Tabs 模式（tablist + tabpanel）展平为 figure 序列。

许多现代站点（Next.js / shadcn / Headless UI 等生成的页面）使用 ARIA Tabs 模式
展示并列内容（如多视图截图组）。在静态 HTML 抓取场景下，inactive 的 tabpanel
通常带有 ``aria-hidden="true"``，会被主内容提取阶段（trafilatura/readability）
误判为辅助内容而剔除；外层容器若命中 ``carousel/gallery`` 等类名正则，整组
内容会被一次性删除。

本模块在 HTML 预处理阶段把 Tabs 子树规范化为 ``<figure>`` 序列：

    <figure>
      <img …>
      <figcaption>{tab label}</figcaption>
    </figure>
    <figure>...</figure>
    ...

这样：

1. 所有 panel 内的图片/视频/段落都被保留为正文等价物。
2. tab 标签语义被翻译为 ``figcaption``，与 DOM 排版兼容。
3. ``aria-hidden`` 在被本模块翻译前剥除，下游 stage 不再丢内容。
4. 不再命中 ``unwanted_patterns`` 中 carousel/gallery 正则。

正交保证：本模块仅做结构归一化，不下载资源、不修改 src/srcset，
后续 ``_media_conversion``/``image_extraction`` 完全透明。
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional

from bs4 import BeautifulSoup, NavigableString, Tag

logger = logging.getLogger(__name__)


# WAI-ARIA Authoring Practices 定义的 Tabs 模式角色
_ROLE_TABLIST = "tablist"
_ROLE_TAB = "tab"
_ROLE_TABPANEL = "tabpanel"

# 命中 carousel/gallery 类的祖先容器（与 html_preprocessor.unwanted_patterns 对齐），
# 用于在替换时确保整个 media-carousel 包装一并被 figures 序列替代。
_CAROUSEL_CLASS_HINTS = (
    "carousel",
    "gallery",
    "slider",
    "swiper",
    "slick",
    "tabs",
    "tab-",
)


def _text(el: Optional[Tag]) -> str:
    """提取 tab 按钮的可读 label：剥除前后空白，折叠内部空白。"""
    if el is None:
        return ""
    raw = el.get_text(separator=" ", strip=True)
    return " ".join(raw.split())


def _find_tablists(soup: BeautifulSoup) -> List[Tag]:
    """枚举所有 tablist 容器；缺失显式 role 时按"含 ≥2 个 role=tab 子兄弟"回退。"""
    explicit: List[Tag] = []
    for el in soup.find_all(attrs={"role": _ROLE_TABLIST}):
        if isinstance(el, Tag):
            explicit.append(el)

    # 回退识别：若一组 role="tab" 共享同一父节点 ≥2 个，但父节点缺 role=tablist
    seen_parents: set = set()
    fallback: List[Tag] = []
    for tab in soup.find_all(attrs={"role": _ROLE_TAB}):
        if not isinstance(tab, Tag):
            continue
        parent = tab.parent
        if not isinstance(parent, Tag) or id(parent) in seen_parents:
            continue
        seen_parents.add(id(parent))
        tab_siblings = [
            c
            for c in parent.find_all(attrs={"role": _ROLE_TAB}, recursive=False)
            if isinstance(c, Tag)
        ]
        if len(tab_siblings) >= 2:
            parent_role = parent.get("role", "")
            if parent_role == _ROLE_TABLIST:
                continue  # 已被 explicit 收录
            if parent not in explicit:
                fallback.append(parent)

    # 保留 DOM 顺序：用 list-of-(index, element)，再按文档序排
    all_tablists = explicit + fallback
    return all_tablists


def _collect_tab_labels(tablist: Tag) -> List[tuple[Optional[str], str]]:
    """收集 tablist 内的 tab 按钮 → [(aria-controls, label_text), ...]。"""
    labels: List[tuple[Optional[str], str]] = []
    for tab in tablist.find_all(attrs={"role": _ROLE_TAB}):
        if not isinstance(tab, Tag):
            continue
        controls_raw = tab.get("aria-controls")
        controls = (
            controls_raw
            if isinstance(controls_raw, str) and controls_raw.strip()
            else None
        )
        labels.append((controls, _text(tab)))
    return labels


def _find_panel_root(tablist: Tag) -> Tag:
    """返回查找 tabpanel 的搜索根：优先 tablist 的父节点祖先（最贴近 media 容器）。"""
    parent = tablist.parent
    return parent if isinstance(parent, Tag) else tablist


def _strip_aria_hidden(scope: Tag) -> None:
    """在给定子树内移除 aria-hidden 属性，避免下游误删 inactive panel。"""
    if scope.has_attr("aria-hidden"):
        del scope.attrs["aria-hidden"]
    for el in scope.find_all(attrs={"aria-hidden": True}):
        if isinstance(el, Tag) and "aria-hidden" in el.attrs:
            del el.attrs["aria-hidden"]


def _find_panels(
    panel_root: Tag, controls_ids: List[Optional[str]]
) -> List[Optional[Tag]]:
    """按 controls_ids 列表匹配 panels；缺关联时按 DOM 顺序回退配对。

    返回与 controls_ids 等长的列表，可能含 None（找不到对应 panel）。
    """
    # 索引所有候选 panel
    candidates: List[Tag] = []
    seen: set = set()
    for el in panel_root.find_all(attrs={"role": _ROLE_TABPANEL}):
        if isinstance(el, Tag) and id(el) not in seen:
            candidates.append(el)
            seen.add(id(el))

    by_id: Dict[str, Tag] = {}
    for p in candidates:
        pid_raw = p.get("id")
        if isinstance(pid_raw, str) and pid_raw.strip():
            by_id[pid_raw.strip()] = p

    matched: List[Optional[Tag]] = []
    used: set = set()
    for cid in controls_ids:
        if cid and cid in by_id and id(by_id[cid]) not in used:
            p = by_id[cid]
            matched.append(p)
            used.add(id(p))
        else:
            matched.append(None)

    # 二次按顺序回填：将 matched 中的 None 用尚未使用的 candidates 顺序填充
    leftover = [p for p in candidates if id(p) not in used]
    li = 0
    for i, m in enumerate(matched):
        if m is None and li < len(leftover):
            matched[i] = leftover[li]
            li += 1

    return matched


def _nearest_carousel_ancestor(tablist: Tag) -> Tag:
    """向上查找最近的 carousel/gallery/tabs 容器作为替换目标；找不到则用 tablist 父节点。"""
    cur: Optional[Tag] = tablist.parent if isinstance(tablist.parent, Tag) else None
    fallback: Optional[Tag] = cur
    # 限制向上探查深度，避免吃到 body
    for _ in range(5):
        if not isinstance(cur, Tag):
            break
        if cur.name in ("body", "html"):
            break
        cls = cur.get("class")
        cls_str = (
            " ".join(cls).lower()
            if isinstance(cls, list)
            else (cls.lower() if isinstance(cls, str) else "")
        )
        if any(hint in cls_str for hint in _CAROUSEL_CLASS_HINTS):
            return cur
        cur = cur.parent if isinstance(cur.parent, Tag) else None
    return fallback if isinstance(fallback, Tag) else tablist


def _merge_tab_label_into_caption(
    soup: BeautifulSoup, figcap: Tag, tab_label: str
) -> None:
    """把 tab 按钮文本作为加粗前缀注入到现有 figcaption 内。

    形式：``<strong>{tab_label}</strong> — {existing_text}``。若 figcaption
    本身已含相同前缀则不重复注入。
    """
    if not tab_label:
        return
    existing_text = _text(figcap)
    if existing_text.startswith(tab_label):
        return  # 已经有该前缀，避免重复

    strong = soup.new_tag("strong")
    strong.string = tab_label
    # 先插入分隔符与原始内容之间，再把 strong 放到最前
    separator = NavigableString(" — ") if existing_text else NavigableString("")
    # 把所有现有 children 暂存
    old_children = list(figcap.contents)
    figcap.clear()
    figcap.append(strong)
    if existing_text:
        figcap.append(separator)
    for c in old_children:
        figcap.append(c)


def _wrap_panel_as_figure(soup: BeautifulSoup, panel: Tag, caption_text: str) -> Tag:
    """将 panel 内容包装为 ``<figure>``；若 panel 内已含 figure 则复用并合并标签。

    Tab 标签处理策略：
    - panel 已含 figcaption: 把 tab 标签作为加粗前缀注入，保留原 caption
    - panel 含 figure 无 figcaption: 用 tab 标签新建 figcaption
    - panel 不含 figure: 全量包装并用 tab 标签作为 figcaption

    返回新构造的 figure（已脱离原 panel 引用，可被插入到任意位置）。
    """
    _strip_aria_hidden(panel)

    # 情况 1: panel 内已存在 figure，直接克隆并合并/补 figcaption
    inner_figure = panel.find("figure")
    if isinstance(inner_figure, Tag):
        figure = BeautifulSoup(str(inner_figure), "html.parser").find("figure")
        if isinstance(figure, Tag):
            existing_cap = figure.find("figcaption")
            if isinstance(existing_cap, Tag):
                _merge_tab_label_into_caption(soup, existing_cap, caption_text)
            elif caption_text:
                cap = soup.new_tag("figcaption")
                cap.string = caption_text
                figure.append(cap)
            return figure

    # 情况 2: 普通包装 — 把 panel 的所有子节点搬入新 figure
    figure = soup.new_tag("figure")
    for child in list(panel.contents):
        if isinstance(child, NavigableString) and not str(child).strip():
            continue
        figure.append(
            child.extract() if isinstance(child, Tag) else NavigableString(str(child))
        )

    if caption_text:
        # 若刚刚搬入的内容中已有 figcaption（极少），合并；否则新建
        existing_cap = figure.find("figcaption")
        if isinstance(existing_cap, Tag):
            _merge_tab_label_into_caption(soup, existing_cap, caption_text)
        else:
            cap = soup.new_tag("figcaption")
            cap.string = caption_text
            figure.append(cap)

    return figure


def normalize_tab_containers(soup: BeautifulSoup) -> int:
    """识别并展平 ARIA Tabs 子树为 figure 序列。

    Returns
    -------
    int
        被规范化的 tablist 数量；为 0 表示无 tabs 命中。
    """
    tablists = _find_tablists(soup)
    if not tablists:
        return 0

    normalized = 0
    for tablist in tablists:
        try:
            # 跳过孤立或已被前序处理迁移走的 tablist
            if tablist.parent is None:
                continue

            label_entries = _collect_tab_labels(tablist)
            if not label_entries:
                continue
            controls_ids = [cid for cid, _label in label_entries]
            labels = [lab for _cid, lab in label_entries]

            panel_root = _find_panel_root(tablist)
            panels = _find_panels(panel_root, controls_ids)
            if not any(p is not None for p in panels):
                continue  # 没有任何匹配的 panel

            figures: List[Tag] = []
            for idx, panel in enumerate(panels):
                if panel is None:
                    continue
                caption = labels[idx] if idx < len(labels) else ""
                figures.append(_wrap_panel_as_figure(soup, panel, caption))

            if not figures:
                continue

            # 替换目标：最近的 carousel/gallery 祖先（不存在则用 tablist 父）
            replacement_target = _nearest_carousel_ancestor(tablist)

            # 创建一个轻量 div 容纳所有 figure（保留块级语义），然后用 unwrap 解开
            holder = soup.new_tag("div")
            holder["data-normalized-from"] = "aria-tabs"
            for fig in figures:
                holder.append(fig)

            if replacement_target is tablist or replacement_target.parent is None:
                tablist.replace_with(holder)
            else:
                replacement_target.replace_with(holder)
            holder.unwrap()

            normalized += 1
        except Exception as e:  # noqa: BLE001
            logger.debug("Tab 规范化跳过一个容器: %s", e)
            continue

    return normalized
