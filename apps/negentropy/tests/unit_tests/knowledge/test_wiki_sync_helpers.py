"""sync_entries_from_catalog 拆分后助手函数的纯函数单测

覆盖 ``WikiPublishingService._build_path_slugs``：
- 正常 root-leaf 链
- parent_id 缺失时停止于自身
- 环检测（self-cycle / parent-cycle）
"""

from __future__ import annotations

from negentropy.knowledge.wiki_service import WikiPublishingService


def _node(node_id: str, slug: str, parent_id: str | None) -> dict:
    return {"id": node_id, "slug": slug, "parent_id": parent_id}


class TestBuildPathSlugs:
    def test_single_root_node(self):
        node = _node("a", "guides", None)
        path, cycle = WikiPublishingService._build_path_slugs(node, {"a": node})
        assert path == ["guides"]
        assert cycle is None

    def test_three_level_chain(self):
        root = _node("r", "docs", None)
        mid = _node("m", "eng", "r")
        leaf = _node("l", "overview", "m")
        node_map = {"r": root, "m": mid, "l": leaf}
        path, cycle = WikiPublishingService._build_path_slugs(leaf, node_map)
        assert path == ["docs", "eng", "overview"]
        assert cycle is None

    def test_self_cycle_detected(self):
        node = _node("a", "x", "a")  # 指向自己
        path, cycle = WikiPublishingService._build_path_slugs(node, {"a": node})
        assert cycle == "a"
        # path 在检测到自环前已含一次 slug 入栈
        assert path == ["x"]

    def test_parent_cycle_detected(self):
        a = _node("a", "x", "b")
        b = _node("b", "y", "a")  # a -> b -> a 循环
        node_map = {"a": a, "b": b}
        path, cycle = WikiPublishingService._build_path_slugs(a, node_map)
        assert cycle in {"a", "b"}

    def test_missing_parent_in_map_stops_walk(self):
        # parent_id 指向不存在的节点：current=None 后 break，无 cycle
        node = _node("a", "leaf", "missing")
        path, cycle = WikiPublishingService._build_path_slugs(node, {"a": node})
        assert path == ["leaf"]
        assert cycle is None
