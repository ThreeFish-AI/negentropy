"""sync_entries_from_catalog 拆分后助手函数的纯函数单测

覆盖 ``WikiPublishingService._build_path_slugs``：
- 正常 root-leaf 链
- parent_id 缺失时停止于自身
- 环检测（self-cycle / parent-cycle）

覆盖 ``WikiPublishingService._collect_subtree_plans`` 的最小覆盖根集去重：
- 父子并选 / 三层链全选 / 无关树并选 / 同一 ID 重复
"""

from __future__ import annotations

import pytest

from negentropy.knowledge.lifecycle.wiki_service import WikiPublishingService


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


# ---------------------------------------------------------------------------
# _collect_subtree_plans 最小覆盖根集去重
# ---------------------------------------------------------------------------


def _patch_catalog_dao(
    monkeypatch,
    *,
    subtrees: dict[str, list[dict]],
    docs_by_node: dict[str, list] | None = None,
) -> None:
    """打桩 ``CatalogDao.get_subtree`` 与 ``get_node_documents``。

    ``subtrees`` 以根节点 ID 为键，返回该子树的扁平节点列表（包含根自身及其后代）。
    ``docs_by_node`` 以节点 ID 为键，返回该节点下文档列表；缺省为空。
    """
    docs_by_node = docs_by_node or {}

    async def fake_get_subtree(db, node_id):
        _ = db
        return list(subtrees.get(str(node_id), []))

    async def fake_get_node_documents(db, catalog_node_id, limit=500):
        _ = (db, limit)
        return list(docs_by_node.get(str(catalog_node_id), [])), len(docs_by_node.get(str(catalog_node_id), []))

    monkeypatch.setattr("negentropy.knowledge.lifecycle.catalog_dao.CatalogDao.get_subtree", fake_get_subtree)
    monkeypatch.setattr(
        "negentropy.knowledge.lifecycle.catalog_dao.CatalogDao.get_node_documents", fake_get_node_documents
    )


class TestCollectSubtreePlansMinimalRoots:
    """父子并选时应丢弃后代根，只保留祖先作为遍历入口。"""

    @pytest.mark.asyncio
    async def test_parent_and_child_both_selected_collapse_to_parent(self, monkeypatch):
        """图 1/图 2 复现：选中 ``Harness-Engineering`` 与子目录 ``Paper`` 时
        Paper 应作为 Harness 的子节点同步，而非另一棵根树。
        """
        # Catalog 形态：harness 为根，paper 为其子
        harness = _node("harness-id", "harness-engineering", None)
        paper = _node("paper-id", "paper", "harness-id")
        # get_subtree(harness) 返回完整两节点；get_subtree(paper) 仅含 paper
        _patch_catalog_dao(
            monkeypatch,
            subtrees={
                "harness-id": [harness, paper],
                "paper-id": [paper],
            },
        )

        service = WikiPublishingService()
        container_plans, document_plans, errors = await service._collect_subtree_plans(
            db=object(),
            catalog_node_ids=["harness-id", "paper-id"],  # type: ignore[list-item]
        )

        # 容器计划应该只来自 harness 子树：harness + paper 各一条
        plan_paths = sorted(tuple(p) for p, _ in container_plans)
        assert plan_paths == [("harness-engineering",), ("harness-engineering", "paper")], plan_paths

        # 文档计划为空（本用例未提供文档）
        assert document_plans == []

        # paper 应被作为 harness 的后代被丢弃，并打上溯源 errors
        assert any(e == "node:paper-id:descendant_of:harness-id" for e in errors), errors

    @pytest.mark.asyncio
    async def test_three_level_chain_collapse_to_top_root(self, monkeypatch):
        """三层链 A → A.B → A.B.C 全选 → 仅 A 作为遍历根。"""
        a = _node("a", "a", None)
        b = _node("b", "b", "a")
        c = _node("c", "c", "b")
        _patch_catalog_dao(
            monkeypatch,
            subtrees={
                "a": [a, b, c],
                "b": [b, c],
                "c": [c],
            },
        )

        service = WikiPublishingService()
        container_plans, _, errors = await service._collect_subtree_plans(
            db=object(),
            catalog_node_ids=["a", "b", "c"],  # type: ignore[list-item]
        )

        plan_paths = sorted(tuple(p) for p, _ in container_plans)
        assert plan_paths == [("a",), ("a", "b"), ("a", "b", "c")], plan_paths

        # 应有 b、c 各自的 descendant_of 记录
        descendant_errors = sorted(e for e in errors if ":descendant_of:" in e)
        assert descendant_errors == [
            "node:b:descendant_of:a",
            "node:c:descendant_of:a",
        ], descendant_errors

    @pytest.mark.asyncio
    async def test_two_unrelated_trees_both_kept(self, monkeypatch):
        """两棵无关树并选互相独立，皆作为遍历根。"""
        x = _node("x", "x", None)
        y = _node("y", "y", None)
        _patch_catalog_dao(
            monkeypatch,
            subtrees={
                "x": [x],
                "y": [y],
            },
        )

        service = WikiPublishingService()
        container_plans, _, errors = await service._collect_subtree_plans(
            db=object(),
            catalog_node_ids=["x", "y"],  # type: ignore[list-item]
        )

        plan_paths = sorted(tuple(p) for p, _ in container_plans)
        assert plan_paths == [("x",), ("y",)], plan_paths
        # 不应触发任何 descendant_of 标记
        assert not any(":descendant_of:" in e for e in errors), errors

    @pytest.mark.asyncio
    async def test_duplicate_id_collapses_in_subtree_cache(self, monkeypatch):
        """同一 ID 在入参中重复出现时应自然去重（dict 键收敛）。"""
        a = _node("a", "a", None)
        _patch_catalog_dao(monkeypatch, subtrees={"a": [a]})

        service = WikiPublishingService()
        container_plans, _, errors = await service._collect_subtree_plans(
            db=object(),
            catalog_node_ids=["a", "a", "a"],  # type: ignore[list-item]
        )

        # 应只产出一条容器计划，不应触发 descendant_of
        assert [tuple(p) for p, _ in container_plans] == [("a",)]
        assert not any(":descendant_of:" in e for e in errors), errors

    @pytest.mark.asyncio
    async def test_empty_subtree_logs_error(self, monkeypatch):
        """``get_subtree`` 返回空时应仍记录 ``empty_subtree`` 错误，不抛异常。"""
        _patch_catalog_dao(monkeypatch, subtrees={"a": []})

        service = WikiPublishingService()
        container_plans, document_plans, errors = await service._collect_subtree_plans(
            db=object(),
            catalog_node_ids=["a"],  # type: ignore[list-item]
        )

        assert container_plans == []
        assert document_plans == []
        assert any("empty_subtree" in e for e in errors), errors
