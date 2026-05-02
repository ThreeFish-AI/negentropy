"""catalog_dao Façade 兼容性测试

锁定 PR-2 拆分契约：
  - 历史导入 ``from negentropy.knowledge.lifecycle.catalog_dao import CatalogDao``、
    ``_NODE_TYPE_TO_ENUM``、``_ENUM_TO_NODE_TYPE``、``MAX_TREE_DEPTH``、
    ``_compute_slug`` 仍可用；
  - ``CatalogDao`` 类含 Catalog 顶层 + 节点 + 归属三类共 13+ 个方法（多继承）；
  - 子类 ``CatalogNodeDao`` / ``CatalogAssignmentDao`` 可独立导入与调用。
"""

from __future__ import annotations

import inspect


def test_import_facade_keeps_legacy_symbols() -> None:
    from negentropy.knowledge.lifecycle.catalog_dao import (
        _ENUM_TO_NODE_TYPE,
        _NODE_TYPE_TO_ENUM,
        MAX_TREE_DEPTH,
        CatalogAssignmentDao,
        CatalogDao,
        CatalogNodeDao,
        _compute_slug,
    )

    assert MAX_TREE_DEPTH > 0
    assert callable(_compute_slug)
    assert _NODE_TYPE_TO_ENUM["folder"] == "FOLDER"
    assert _ENUM_TO_NODE_TYPE["FOLDER"] == "folder"
    assert "folder" in _ENUM_TO_NODE_TYPE.values()
    # 类对象本身可解析
    assert CatalogDao is not None
    assert CatalogNodeDao is not None
    assert CatalogAssignmentDao is not None


def test_facade_inherits_node_methods() -> None:
    from negentropy.knowledge.lifecycle.catalog_dao import CatalogDao, CatalogNodeDao

    for method_name in [
        "create_node",
        "get_node",
        "get_node_by_slug",
        "update_node",
        "delete_node",
        "get_tree",
        "get_subtree",
    ]:
        assert hasattr(CatalogDao, method_name), f"CatalogDao 应继承 {method_name}"
        assert hasattr(CatalogNodeDao, method_name), f"CatalogNodeDao 应直接定义 {method_name}"
        # 方法可调用
        assert inspect.iscoroutinefunction(getattr(CatalogDao, method_name)) or callable(
            getattr(CatalogDao, method_name)
        )


def test_facade_inherits_assignment_methods() -> None:
    from negentropy.knowledge.lifecycle.catalog_dao import CatalogAssignmentDao, CatalogDao

    for method_name in [
        "assign_document",
        "unassign_document",
        "get_node_documents",
        "get_document_nodes",
    ]:
        assert hasattr(CatalogDao, method_name)
        assert hasattr(CatalogAssignmentDao, method_name)


def test_facade_inherits_top_level_catalog_methods() -> None:
    from negentropy.knowledge.lifecycle.catalog_dao import CatalogDao

    for method_name in [
        "create_catalog",
        "get_catalog",
        "get_catalog_by_slug",
        "list_catalogs",
        "update_catalog",
        "archive_catalog",
        "delete_catalog",
    ]:
        assert hasattr(CatalogDao, method_name)


def test_method_count_at_least_expected() -> None:
    from negentropy.knowledge.lifecycle.catalog_dao import CatalogDao

    # Catalog 顶层(7) + 节点(7) + 归属(4) = 18 个公开方法（不含私有/dunder）
    public_methods = [m for m in dir(CatalogDao) if not m.startswith("_") and callable(getattr(CatalogDao, m))]
    assert len(public_methods) >= 18, f"Façade 应聚合至少 18 个方法，当前 {len(public_methods)}"
