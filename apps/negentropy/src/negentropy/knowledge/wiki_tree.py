"""Wiki 导航树构建器（纯函数）

将平铺的 ``WikiPublicationEntry`` 列表按 ``entry_path``（历史名 ``entry_order``，
Materialized Path / JSON 数组）合成嵌套的导航树。

设计动机（Orthogonal Decomposition）：
- DAO 层（``wiki_dao.WikiDao``）只承担"查询"职责，不再承载嵌套树逻辑。
- 树构建是纯函数 + 可独立单测，不依赖 ``AsyncSession``，迁移到此处后
  ``test_wiki_tree_builder.py`` 可在毫秒级断言树形输出。

输入约定：
- ``entries`` 列表中每个对象需具备 ``id``、``entry_slug``、``entry_title``、
  ``is_index_page``、``document_id``、``entry_path`` 属性（ORM 实例或鸭子等价物）。
- ``entry_path`` 取值可为 ``list[str]`` 已解析的 path，或 JSON 字符串，或 ``None``
  （回退为单段 ``[entry_slug]``）。

输出约定：
- 返回 ``list[NavTreeItem]``，每个节点形如 ``{entry_id, entry_slug, entry_title,
  is_index_page, document_id, children}``。容器节点（仅为层级合成）的
  ``entry_id`` / ``document_id`` 为 ``None``。
"""

from __future__ import annotations

import json
from collections.abc import Iterable
from typing import Any


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


def _ensure_container(roots: list[dict], parent_path: list[str]) -> dict:
    """沿 ``parent_path`` 自顶向下创建/查找容器节点，返回最深处的容器。"""
    container_key = "/".join(parent_path)
    cursor = roots
    parent: dict | None = None
    for depth, segment in enumerate(parent_path, start=1):
        path_at_depth = "/".join(parent_path[:depth])
        match = next((c for c in cursor if c.get("_path") == path_at_depth), None)
        if match is None:
            match = {
                "entry_id": None,
                "entry_slug": path_at_depth,
                "entry_title": segment,
                "is_index_page": False,
                "document_id": None,
                "_path": path_at_depth,
                "children": [],
            }
            cursor.append(match)
        parent = match
        cursor = match.setdefault("children", [])
    assert parent is not None and parent.get("_path") == container_key
    return parent


def _strip_internal(items: list[dict]) -> None:
    for item in items:
        item.pop("_path", None)
        children = item.get("children")
        if children:
            _strip_internal(children)


def build_nav_tree(entries: Iterable[Any]) -> list[dict]:
    """将平铺 entries 合成嵌套导航树。

    ``entry_path`` 长度 <= 1 的条目作为根节点；> 1 时沿父路径合成中间容器节点。
    输出的容器节点 ``entry_id`` / ``document_id`` 为 ``None``，便于前端跳过点击交互。
    """
    roots: list[dict] = []
    for entry in entries:
        path = _parse_path(getattr(entry, "entry_path", None), entry.entry_slug)
        item = {
            "entry_id": str(entry.id),
            "entry_slug": entry.entry_slug,
            "entry_title": entry.entry_title or entry.entry_slug,
            "is_index_page": bool(entry.is_index_page),
            "document_id": str(entry.document_id),
            "children": [],
        }
        if len(path) > 1:
            parent = _ensure_container(roots, path[:-1])
            parent.setdefault("children", []).append(item)
        else:
            roots.append(item)
    _strip_internal(roots)
    return roots
