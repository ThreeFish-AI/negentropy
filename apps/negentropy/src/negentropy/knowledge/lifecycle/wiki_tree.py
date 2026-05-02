"""Wiki 导航树构建器（纯函数）

将平铺的 ``WikiPublicationEntry`` 列表按 ``entry_path``（Materialized Path /
JSON 数组）合成嵌套的导航树。

设计动机（Orthogonal Decomposition）：
  - DAO 层（``wiki_dao.WikiDao``）只承担"查询"职责，不再承载嵌套树逻辑。
  - 树构建是纯函数 + 可独立单测，不依赖 ``AsyncSession``。

自 0011（Wiki entry_kind 双轨）起：
  - 历史"用 slug 字符串合成虚拟容器"的回退路径已退出主流程；
  - ``CONTAINER`` 条目作为正式容器节点（携带真实 ``entry_id`` /
    ``catalog_node_id`` / ``entry_title`` 等元数据）；
  - 同步链路（``wiki_service.sync_entries_from_catalog``）保证每个出现在
    DOCUMENT 路径前缀中的容器都有对应 CONTAINER 条目；
  - 仅在历史数据缺 CONTAINER 时降级为合成（兼容路径，仅用 slug 段当 title）。

输入约定：
  - ``entries``：列表中每个对象需具备 ``id``、``entry_slug``、``entry_title``、
    ``is_index_page``、``document_id``、``catalog_node_id``、``entry_kind``、
    ``entry_path`` 属性（ORM 实例或鸭子等价物）。

输出约定：
  - 返回 ``list[NavTreeItem]``，每个节点形如
    ``{entry_id, entry_slug, entry_title, is_index_page, document_id,
       catalog_node_id, entry_kind, children}``；
  - 合成型容器节点（仅在缺 CONTAINER 时回退）``entry_id`` / ``document_id`` /
    ``catalog_node_id`` 为 ``None``，``entry_kind=CONTAINER``。
"""

from __future__ import annotations

import json
from collections.abc import Iterable
from typing import Any

__all__ = ["build_nav_tree"]


def _parse_path(raw: Any, fallback_slug: str) -> list[str]:
    """容忍多种 ``entry_path`` 实际类型，归一化为 ``list[str]``。"""
    if raw is None:
        return [fallback_slug]
    if isinstance(raw, list):
        return [str(seg) for seg in raw if seg]
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return [fallback_slug]
        if isinstance(parsed, list):
            return [str(seg) for seg in parsed if seg]
    return [fallback_slug]


def _entry_to_item(entry: Any) -> dict:
    """将 ORM/duck 对象映射为导航 item dict。"""
    entry_id = getattr(entry, "id", None)
    document_id = getattr(entry, "document_id", None)
    catalog_node_id = getattr(entry, "catalog_node_id", None)
    entry_kind = getattr(entry, "entry_kind", None) or ("DOCUMENT" if document_id else "CONTAINER")
    return {
        "entry_id": str(entry_id) if entry_id else None,
        "entry_slug": entry.entry_slug,
        "entry_title": entry.entry_title or entry.entry_slug,
        "is_index_page": bool(getattr(entry, "is_index_page", False)),
        "document_id": str(document_id) if document_id else None,
        "catalog_node_id": str(catalog_node_id) if catalog_node_id else None,
        "entry_kind": entry_kind,
        "children": [],
    }


def _make_synthetic_container(slug_path: str, title_segment: str) -> dict:
    """缺 CONTAINER 兜底：仅用 slug 段当 title，``entry_id`` 为 None。"""
    return {
        "entry_id": None,
        "entry_slug": slug_path,
        "entry_title": title_segment,
        "is_index_page": False,
        "document_id": None,
        "catalog_node_id": None,
        "entry_kind": "CONTAINER",
        "children": [],
        "_path": slug_path,
        "_synthetic": True,
    }


def build_nav_tree(entries: Iterable[Any]) -> list[dict]:
    """将平铺 entries 合成嵌套导航树。

    算法：
      1. 将所有条目按 path 长度升序处理，先注册 CONTAINER 容器再挂载 DOCUMENT，
         保证父节点先就位。
      2. 维护 ``container_index: dict[str, dict]``（key = "/".join(path)）；
         CONTAINER 条目直接登记；DOCUMENT 条目先回溯祖先路径，缺失时合成回退。
      3. ``entry_path`` 长度 == 1 的条目作为根；> 1 时挂到对应 parent container。

    回退合成（``_synthetic=True`` / ``entry_id=None``）仅在历史数据缺 CONTAINER
    或同步未覆盖某中间层时出现，前端可据此显示为不可点击的灰色容器。
    """
    roots: list[dict] = []
    container_index: dict[str, dict] = {}

    # 按 (path_len, entry_kind 优先级) 排序：CONTAINER < DOCUMENT 同级时容器先注册。
    def _sort_key(entry: Any) -> tuple[int, int, str]:
        path = _parse_path(getattr(entry, "entry_path", None), getattr(entry, "entry_slug", ""))
        kind = getattr(entry, "entry_kind", None) or (
            "DOCUMENT" if getattr(entry, "document_id", None) else "CONTAINER"
        )
        kind_order = 0 if kind == "CONTAINER" else 1
        return (len(path), kind_order, getattr(entry, "entry_slug", ""))

    sorted_entries = sorted(entries, key=_sort_key)

    for entry in sorted_entries:
        path = _parse_path(getattr(entry, "entry_path", None), entry.entry_slug)
        item = _entry_to_item(entry)

        if len(path) <= 1:
            # 根级：直接挂载
            full_key = "/".join(path) if path else entry.entry_slug
            if item["entry_kind"] == "CONTAINER":
                container_index[full_key] = item
            roots.append(item)
            continue

        # 非根：先确保父路径有容器
        parent_path = path[:-1]
        parent_container = _ensure_container_chain(roots, container_index, parent_path)
        parent_container.setdefault("children", []).append(item)

        # CONTAINER 条目本身也注册供后代回溯
        full_key = "/".join(path)
        if item["entry_kind"] == "CONTAINER":
            container_index[full_key] = item

    _strip_internal(roots)
    return roots


def _ensure_container_chain(
    roots: list[dict],
    container_index: dict[str, dict],
    parent_path: list[str],
) -> dict:
    """沿 ``parent_path`` 自顶向下查找/合成容器，返回最深处容器。

    优先复用 ``container_index`` 中已注册的真实 CONTAINER；缺失时合成回退。
    """
    parent: dict | None = None
    cursor = roots
    for depth, segment in enumerate(parent_path, start=1):
        path_at_depth = "/".join(parent_path[:depth])
        match = container_index.get(path_at_depth)
        if match is None:
            # 当前层未在 cursor 中找到，再线性查找一次（兼容根层 CONTAINER 已挂 roots 但未登记的边角）
            match = next((c for c in cursor if c.get("entry_slug") == path_at_depth), None)
        if match is None:
            match = _make_synthetic_container(path_at_depth, segment)
            cursor.append(match)
            container_index[path_at_depth] = match
        parent = match
        cursor = match.setdefault("children", [])
    assert parent is not None
    return parent


def _strip_internal(items: list[dict]) -> None:
    for item in items:
        item.pop("_path", None)
        item.pop("_synthetic", None)
        children = item.get("children")
        if children:
            _strip_internal(children)
