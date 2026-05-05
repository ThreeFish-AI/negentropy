"""节点类型收敛回归测试（migration 0010）

锁定 ``FOLDER`` 是唯一用户可创建类型的契约：
  - ``CatalogService.create_node`` 拒绝 ``document_ref``；
  - ``CatalogNodeCreateRequest`` Pydantic 校验拒绝 ``document_ref``、接受历史 ``category`` / ``collection``；
  - ``CatalogService.update_node`` 静默忽略 ``node_type`` 字段（类型不可变）；
  - DAO 层 ``_NODE_TYPE_TO_ENUM`` 将历史输入归一为 ``FOLDER``。
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest
from pydantic import ValidationError

from negentropy.knowledge.lifecycle.catalog_dao import _ENUM_TO_NODE_TYPE, _NODE_TYPE_TO_ENUM
from negentropy.knowledge.lifecycle.catalog_service import CatalogService
from negentropy.knowledge.lifecycle_schemas import CatalogNodeCreateRequest

# ---------------------------------------------------------------------------
# Pydantic schema 边界
# ---------------------------------------------------------------------------


class TestCatalogNodeCreateRequestSchema:
    def test_default_node_type_is_folder(self) -> None:
        req = CatalogNodeCreateRequest(name="N")
        assert req.node_type == "folder"

    def test_accepts_legacy_category(self) -> None:
        req = CatalogNodeCreateRequest(name="N", node_type="category")
        assert req.node_type == "category"  # 字段值保留；DAO 层归一

    def test_accepts_legacy_collection(self) -> None:
        req = CatalogNodeCreateRequest(name="N", node_type="collection")
        assert req.node_type == "collection"

    def test_rejects_document_ref(self) -> None:
        with pytest.raises(ValidationError) as exc:
            CatalogNodeCreateRequest(name="N", node_type="document_ref")
        assert "document_ref" in str(exc.value)
        assert "assign_document" in str(exc.value)

    def test_rejects_unknown_type(self) -> None:
        with pytest.raises(ValidationError):
            CatalogNodeCreateRequest(name="N", node_type="unknown")


# ---------------------------------------------------------------------------
# Service 层校验
# ---------------------------------------------------------------------------


class _FakeDao:
    """最小桩：仅提供 `get_catalog`、`get_node`、`create_node`、`update_node`。"""

    def __init__(self, catalog: Any | None = None, parent: Any | None = None) -> None:
        self._catalog = catalog
        self._parent = parent
        self.create_calls: list[dict[str, Any]] = []
        self.update_calls: list[dict[str, Any]] = []

    async def get_catalog(self, db: Any, catalog_id: Any) -> Any:
        return self._catalog

    async def get_node(self, db: Any, node_id: Any) -> Any:
        if self._parent is not None and node_id == self._parent.id:
            return self._parent
        return SimpleNamespace(id=node_id, node_type="FOLDER")

    async def create_node(self, db: Any, **kwargs: Any) -> Any:
        self.create_calls.append(kwargs)
        return SimpleNamespace(**{**kwargs, "id": uuid4(), "node_type": "FOLDER"})

    async def update_node(self, db: Any, node_id: Any, **kwargs: Any) -> Any:
        self.update_calls.append({"node_id": node_id, **kwargs})
        return SimpleNamespace(id=node_id, **kwargs)


@pytest.mark.asyncio
async def test_create_node_rejects_document_ref(monkeypatch: pytest.MonkeyPatch) -> None:
    catalog_id = uuid4()
    fake_catalog = SimpleNamespace(id=catalog_id, is_archived=False, app_name="aurelius")
    fake_dao = _FakeDao(catalog=fake_catalog)
    monkeypatch.setattr("negentropy.knowledge.lifecycle.catalog_service.CatalogDao", fake_dao)

    svc = CatalogService()
    with pytest.raises(ValueError) as exc:
        await svc.create_node(
            db=None,
            catalog_id=catalog_id,
            name="must fail",
            slug="must-fail",
            node_type="document_ref",
        )
    assert "document_ref" in str(exc.value)
    assert "assign_document" in str(exc.value)
    assert fake_dao.create_calls == []


@pytest.mark.asyncio
async def test_create_node_default_is_folder(monkeypatch: pytest.MonkeyPatch) -> None:
    catalog_id = uuid4()
    fake_catalog = SimpleNamespace(id=catalog_id, is_archived=False, app_name="aurelius")
    fake_dao = _FakeDao(catalog=fake_catalog)
    monkeypatch.setattr("negentropy.knowledge.lifecycle.catalog_service.CatalogDao", fake_dao)

    svc = CatalogService()
    await svc.create_node(
        db=None,
        catalog_id=catalog_id,
        name="My Folder",
        slug="my-folder",
        # 不传 node_type
    )
    assert fake_dao.create_calls[0]["node_type"] == "folder"


@pytest.mark.asyncio
async def test_update_node_silently_drops_node_type(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_dao = _FakeDao()
    monkeypatch.setattr("negentropy.knowledge.lifecycle.catalog_service.CatalogDao", fake_dao)

    svc = CatalogService()
    node_id = uuid4()
    await svc.update_node(db=None, node_id=node_id, name="renamed", node_type="document_ref")

    assert len(fake_dao.update_calls) == 1
    update_kwargs = fake_dao.update_calls[0]
    assert update_kwargs["name"] == "renamed"
    assert "node_type" not in update_kwargs, "update_node 应静默忽略 node_type"


# ---------------------------------------------------------------------------
# DAO 映射归一
# ---------------------------------------------------------------------------


class TestNodeTypeMappings:
    def test_folder_round_trip(self) -> None:
        assert _NODE_TYPE_TO_ENUM["folder"] == "FOLDER"
        assert _ENUM_TO_NODE_TYPE["FOLDER"] == "folder"

    def test_document_ref_round_trip(self) -> None:
        assert _NODE_TYPE_TO_ENUM["document_ref"] == "DOCUMENT_REF"
        assert _ENUM_TO_NODE_TYPE["DOCUMENT_REF"] == "document_ref"

    def test_legacy_inputs_map_to_folder(self) -> None:
        assert _NODE_TYPE_TO_ENUM["category"] == "FOLDER"
        assert _NODE_TYPE_TO_ENUM["collection"] == "FOLDER"

    def test_legacy_enum_values_map_to_folder_on_read(self) -> None:
        # 兼容输出：旧数据未迁移时的回退（应在 0010 后不再出现，但保留兜底）
        assert _ENUM_TO_NODE_TYPE["CATEGORY"] == "folder"
        assert _ENUM_TO_NODE_TYPE["COLLECTION"] == "folder"
