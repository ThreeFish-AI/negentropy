"""``negentropy.knowledge.wiki_tree.build_nav_tree`` 纯函数测试

覆盖 wiki_dao.get_nav_tree 抽离后的树构建逻辑：
- 平铺 entries → 嵌套树
- 容器节点合成（``entry_id=None`` / ``document_id=None``）
- entry_path 取值多形态归一（``list[str]`` / JSON 字符串 / None）
- 单段路径回退为根节点
"""

from __future__ import annotations

import json
from types import SimpleNamespace
from uuid import uuid4

from negentropy.knowledge.wiki_tree import build_nav_tree


def _entry(
    *,
    entry_slug: str,
    entry_path: object,
    entry_title: str | None = None,
    is_index_page: bool = False,
) -> SimpleNamespace:
    """生成测试用 entry-like 对象（支持鸭子类型）。"""
    return SimpleNamespace(
        id=uuid4(),
        document_id=uuid4(),
        entry_slug=entry_slug,
        entry_title=entry_title or entry_slug,
        is_index_page=is_index_page,
        entry_path=entry_path,
    )


class TestBuildNavTree:
    def test_empty_input_returns_empty_list(self):
        assert build_nav_tree([]) == []

    def test_single_root_entry(self):
        e = _entry(entry_slug="overview", entry_path=["overview"])
        tree = build_nav_tree([e])
        assert len(tree) == 1
        assert tree[0]["entry_slug"] == "overview"
        assert tree[0]["entry_id"] == str(e.id)
        assert tree[0]["children"] == []

    def test_two_segment_path_creates_container(self):
        leaf = _entry(entry_slug="docs/install", entry_path=["docs", "install"])
        tree = build_nav_tree([leaf])
        assert len(tree) == 1
        container = tree[0]
        assert container["entry_id"] is None  # 容器节点
        assert container["document_id"] is None
        assert container["entry_slug"] == "docs"
        assert container["entry_title"] == "docs"
        assert len(container["children"]) == 1
        assert container["children"][0]["entry_slug"] == "docs/install"

    def test_three_segment_path_chains_containers(self):
        leaf = _entry(
            entry_slug="docs/eng/overview",
            entry_path=["docs", "eng", "overview"],
        )
        tree = build_nav_tree([leaf])
        assert len(tree) == 1
        lvl1 = tree[0]
        assert lvl1["entry_slug"] == "docs"
        assert len(lvl1["children"]) == 1
        lvl2 = lvl1["children"][0]
        assert lvl2["entry_slug"] == "docs/eng"
        assert lvl2["entry_id"] is None
        assert len(lvl2["children"]) == 1
        assert lvl2["children"][0]["entry_slug"] == "docs/eng/overview"

    def test_siblings_share_container(self):
        a = _entry(entry_slug="docs/a", entry_path=["docs", "a"])
        b = _entry(entry_slug="docs/b", entry_path=["docs", "b"])
        tree = build_nav_tree([a, b])
        assert len(tree) == 1
        container = tree[0]
        assert {c["entry_slug"] for c in container["children"]} == {"docs/a", "docs/b"}

    def test_path_as_json_string_is_parsed(self):
        # 兼容旧/外部数据：entry_path 可能是 JSON 字符串
        e = _entry(
            entry_slug="docs/install",
            entry_path=json.dumps(["docs", "install"]),
        )
        tree = build_nav_tree([e])
        assert tree[0]["entry_slug"] == "docs"
        assert tree[0]["children"][0]["entry_slug"] == "docs/install"

    def test_path_invalid_json_falls_back_to_slug(self):
        e = _entry(entry_slug="solo", entry_path="<<not json>>")
        tree = build_nav_tree([e])
        assert len(tree) == 1
        assert tree[0]["entry_slug"] == "solo"

    def test_path_none_falls_back_to_slug(self):
        e = _entry(entry_slug="solo", entry_path=None)
        tree = build_nav_tree([e])
        assert len(tree) == 1
        assert tree[0]["entry_slug"] == "solo"

    def test_internal_path_field_is_stripped(self):
        e = _entry(entry_slug="docs/x", entry_path=["docs", "x"])
        tree = build_nav_tree([e])

        # 容器与叶节点都不应残留 _path 字段（仅构建期内部使用）
        def assert_no_internal(items):
            for it in items:
                assert "_path" not in it
                assert_no_internal(it.get("children", []))

        assert_no_internal(tree)

    def test_entry_title_falls_back_to_slug(self):
        e = _entry(
            entry_slug="solo",
            entry_path=["solo"],
            entry_title=None,
        )
        tree = build_nav_tree([e])
        assert tree[0]["entry_title"] == "solo"

    def test_is_index_page_preserved(self):
        e = _entry(
            entry_slug="home",
            entry_path=["home"],
            is_index_page=True,
        )
        tree = build_nav_tree([e])
        assert tree[0]["is_index_page"] is True
