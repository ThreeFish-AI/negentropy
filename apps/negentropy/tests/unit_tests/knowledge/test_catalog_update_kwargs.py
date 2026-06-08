"""PATCH 更新 kwargs 构建的边界回归测试。

锁定 ``_build_update_kwargs`` 的核心不变量：以「请求中显式出现的字段」为 SSOT，
显式传入的 ``parent_id=None``（提升为根节点）**必须保留**，不得被任何 falsy 过滤
吞掉——否则 Wiki「拖拽到顶层」会静默丢失父指针更新，刷新后回退为子节点。
"""

from __future__ import annotations

from uuid import uuid4

from negentropy.knowledge.lifecycle_schemas import CatalogNodeUpdateRequest
from negentropy.knowledge.routes.catalog import _build_update_kwargs


class TestBuildUpdateKwargs:
    def test_explicit_none_parent_id_is_preserved(self) -> None:
        """显式 parent_id=None（移动到顶层）必须出现在 kwargs 中。"""
        body = CatalogNodeUpdateRequest(parent_id=None, sort_order=10)
        kwargs = _build_update_kwargs(body)
        assert kwargs == {"parent_id": None, "sort_order": 10}

    def test_explicit_parent_id_uuid_is_preserved(self) -> None:
        """显式传入的父节点 UUID 应原样保留。"""
        parent_id = uuid4()
        body = CatalogNodeUpdateRequest(parent_id=parent_id)
        kwargs = _build_update_kwargs(body)
        assert kwargs == {"parent_id": parent_id}

    def test_unset_parent_id_absent_from_kwargs(self) -> None:
        """未传 parent_id 时不得出现在 kwargs（DAO 据此保持原父指针不变）。"""
        body = CatalogNodeUpdateRequest(name="Renamed")
        kwargs = _build_update_kwargs(body)
        assert kwargs == {"name": "Renamed"}
        assert "parent_id" not in kwargs

    def test_empty_request_yields_empty_kwargs(self) -> None:
        """未设置任何字段的请求产出空 kwargs（路由据此返回 400 空值守卫）。"""
        body = CatalogNodeUpdateRequest()
        assert _build_update_kwargs(body) == {}
