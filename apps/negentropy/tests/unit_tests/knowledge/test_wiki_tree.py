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
    entry_kind: str = "DOCUMENT",
    catalog_node_id: object | None = None,
) -> SimpleNamespace:
    """生成测试用 entry-like 对象（DOCUMENT 默认；指定 entry_kind=CONTAINER 时切换语义）。"""
    return SimpleNamespace(
        id=uuid4(),
        document_id=uuid4() if entry_kind == "DOCUMENT" else None,
        catalog_node_id=catalog_node_id
        if catalog_node_id is not None
        else (None if entry_kind == "DOCUMENT" else uuid4()),
        entry_slug=entry_slug,
        entry_title=entry_title or entry_slug,
        is_index_page=is_index_page,
        entry_path=entry_path,
        entry_kind=entry_kind,
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


class TestBuildNavTreeContainerEntries:
    """0011 引入 CONTAINER 类型条目后的导航树合成行为锁定。"""

    def test_explicit_container_entry_replaces_synthetic(self):
        """CONTAINER 条目存在时应承载真实 entry_id 与 entry_title（而非 slug 段）。"""
        container = _entry(
            entry_slug="docs",
            entry_title="官方文档",
            entry_path=["docs"],
            entry_kind="CONTAINER",
        )
        leaf = _entry(entry_slug="docs/install", entry_path=["docs", "install"])

        tree = build_nav_tree([container, leaf])

        assert len(tree) == 1
        c = tree[0]
        assert c["entry_kind"] == "CONTAINER"
        assert c["entry_id"] == str(container.id), "CONTAINER 条目 entry_id 应非 None"
        assert c["entry_title"] == "官方文档", "应使用 Catalog 节点 name 而非 slug 段"
        assert c["catalog_node_id"] == str(container.catalog_node_id)
        assert len(c["children"]) == 1
        assert c["children"][0]["entry_kind"] == "DOCUMENT"

    def test_empty_container_subtree_remains_visible(self):
        """无后代文档的 CONTAINER 子树仍出现在导航树中（消除"空容器消失"问题）。"""
        c1 = _entry(entry_slug="root", entry_path=["root"], entry_kind="CONTAINER", entry_title="根目录")
        c2 = _entry(entry_slug="root/empty", entry_path=["root", "empty"], entry_kind="CONTAINER", entry_title="空集")

        tree = build_nav_tree([c1, c2])
        assert len(tree) == 1
        assert tree[0]["entry_title"] == "根目录"
        assert len(tree[0]["children"]) == 1
        assert tree[0]["children"][0]["entry_title"] == "空集"
        assert tree[0]["children"][0]["children"] == []

    def test_synthetic_fallback_when_container_missing(self):
        """历史数据无 CONTAINER 条目时应降级合成（兼容性）。"""
        leaf = _entry(entry_slug="legacy/doc", entry_path=["legacy", "doc"])
        tree = build_nav_tree([leaf])
        assert len(tree) == 1
        c = tree[0]
        assert c["entry_id"] is None, "缺 CONTAINER 时合成节点 entry_id 应为 None"
        assert c["entry_kind"] == "CONTAINER"
        assert c["entry_title"] == "legacy"

    def test_container_and_documents_kept_in_correct_order(self):
        """同层 CONTAINER 与 DOCUMENT 共存时，CONTAINER 节点先注册（保证父在子前）。"""
        container = _entry(
            entry_slug="docs/eng",
            entry_path=["docs", "eng"],
            entry_kind="CONTAINER",
            entry_title="工程",
        )
        leaf = _entry(entry_slug="docs/eng/intro", entry_path=["docs", "eng", "intro"])

        tree = build_nav_tree([leaf, container])  # 故意乱序输入

        # docs（合成）→ eng（CONTAINER 真实）→ intro（DOCUMENT）
        assert tree[0]["entry_slug"] == "docs"
        eng = tree[0]["children"][0]
        assert eng["entry_kind"] == "CONTAINER"
        assert eng["entry_id"] == str(container.id)
        assert eng["entry_title"] == "工程"
        assert eng["children"][0]["entry_slug"] == "docs/eng/intro"

    def test_synthetic_marker_stripped_from_output(self):
        """合成的 _synthetic 标记应在最终输出前清理。"""
        leaf = _entry(entry_slug="a/b", entry_path=["a", "b"])
        tree = build_nav_tree([leaf])

        def _walk(items):
            for it in items:
                assert "_synthetic" not in it
                _walk(it.get("children", []))

        _walk(tree)
