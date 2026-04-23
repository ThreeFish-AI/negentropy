"""
CatalogDao 单元测试

使用 FakeAsyncSession 模式验证 CatalogDao 各静态方法的行为，
不依赖真实数据库连接。通过内联的 FakeAsyncSessionForCatalog
跟踪 add / delete / flush 调用，并预配置 execute() 返回值。
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest
import sqlalchemy.orm

from negentropy.knowledge.catalog_dao import CatalogDao

# ---------------------------------------------------------------------------
# 修复 KnowledgeDocument <-> DocSource 双向 FK 的 AmbiguousForeignKeysError
# ---------------------------------------------------------------------------
# 迁移 h2i3j4k5l6m7 新增了 knowledge_documents.source_id → doc_sources FK，
# 与已有的 DocSource.document_id → knowledge_documents 形成双向 FK，
# 导致 SQLAlchemy 无法自动推断关系 join 条件。
# 必须在首次触发 ORM 编译之前显式修补两侧 relationship。
try:
    from negentropy.models import perception as _models

    _models.KnowledgeDocument.source = sqlalchemy.orm.relationship(
        _models.DocSource,
        foreign_keys=[_models.KnowledgeDocument.source_id],
        lazy="selectin",
        viewonly=True,
    )
    _models.DocSource.document = sqlalchemy.orm.relationship(
        _models.KnowledgeDocument,
        foreign_keys=[_models.DocSource.document_id],
        lazy="selectin",
        viewonly=True,
    )
except Exception:
    pass


# ---------------------------------------------------------------------------
# FakeAsyncSessionForCatalog — 模拟 AsyncSession 用于 CatalogDao 单测
# ---------------------------------------------------------------------------


class _FakeResult:
    """模拟 db.execute() 返回的结果对象。

    支持 scalar_one_or_none() 和 all() 两种消费方式。
    """

    def __init__(self, rows: list | None = None, scalar_value: Any = None) -> None:
        self._rows = rows if rows is not None else []
        self._scalar_value = scalar_value

    def scalar_one_or_none(self) -> Any:
        return self._scalar_value

    def all(self):
        return self._rows

    def scalar(self) -> Any:
        return self._scalar_value if self._scalar_value is not None else 0

    def scalars(self):
        """支持 result.scalars().all() 链式调用（get_node_documents / get_document_nodes）。"""
        return self


class FakeAsyncSessionForCatalog:
    """参数化模拟 AsyncSession，用于 CatalogDao 单测。

    特性：
    - 追踪 added / deleted 对象与 flush 次数
    - execute() 通过 _execute_responses 队列返回预配置结果
    - 支持 scalar_one_or_none() 返回 None 或 mock 对象
    """

    def __init__(
        self,
        *,
        execute_responses: list[_FakeResult] | None = None,
    ) -> None:
        self.added: list[Any] = []
        self.deleted: list[Any] = []
        self.flush_count: int = 0
        self._execute_responses = list(execute_responses or [])

    # -- session 协议 --
    # 注：真实 AsyncSession.add() 是同步方法，但 delete() 在本服务代码中通过 await 调用，
    #      因此 add 保持同步、delete 保持异步以匹配调用方式。

    def add(self, obj: Any) -> None:
        """同步方法，匹配真实 AsyncSession.add() 签名（服务代码以 db.add(obj) 无 await 调用）。"""
        self.added.append(obj)

    async def delete(self, obj: Any) -> None:
        """异步方法，匹配服务代码中 await db.delete(obj) 的调用方式。"""
        self.deleted.append(obj)

    async def flush(self) -> None:
        self.flush_count += 1

    async def commit(self) -> None:
        pass

    async def refresh(self, obj: Any) -> None:
        pass

    async def execute(self, stmt: Any) -> _FakeResult:
        """从预配置队列中弹出下一个结果。

        若队列为空则返回空结果（避免 IndexError）。
        """
        if self._execute_responses:
            return self._execute_responses.pop(0)
        return _FakeResult()


def _make_node(**overrides: Any) -> SimpleNamespace:
    """快速构建 DocCatalogNode 的 SimpleNamespace 替身。"""
    defaults: dict[str, Any] = {
        "id": uuid4(),
        "corpus_id": uuid4(),
        "name": "Test Node",
        "slug": "test-node",
        "parent_id": None,
        "node_type": "category",
        "description": None,
        "sort_order": 0,
        "config": {},
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def _make_membership(**overrides: Any) -> SimpleNamespace:
    """快速构建 DocCatalogMembership 的 SimpleNamespace 替身。"""
    defaults: dict[str, Any] = {
        "id": uuid4(),
        "catalog_node_id": uuid4(),
        "document_id": uuid4(),
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


# ===================================================================
# TestCatalogNodeCrud — 节点 CRUD 操作单测 (8 cases)
# ===================================================================


class TestCatalogNodeCrud:
    """CatalogDao 节点 CRUD 方法的单元测试"""

    @pytest.mark.asyncio
    async def test_create_node_logs_with_non_reserved_extra_keys(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """create_node 日志应避免覆写 LogRecord 保留字段。"""
        corpus_id = uuid4()
        session = FakeAsyncSessionForCatalog()
        captured: dict[str, Any] = {}

        def fake_info(event: str, *, extra: dict[str, Any]) -> None:
            captured["event"] = event
            captured["extra"] = extra

        monkeypatch.setattr("negentropy.knowledge.catalog_dao.logger.info", fake_info)

        await CatalogDao.create_node(
            session,
            corpus_id=corpus_id,
            name="Root Category",
            slug="root-category",
        )

        assert captured["event"] == "catalog_node_created"
        assert captured["extra"]["node_name"] == "Root Category"
        assert "name" not in captured["extra"]

    @pytest.mark.asyncio
    async def test_create_node_adds_to_session_and_flushes(self) -> None:
        """create_node 应调用 db.add + db.flush，且节点字段正确设置"""
        corpus_id = uuid4()
        session = FakeAsyncSessionForCatalog()

        node = await CatalogDao.create_node(
            session,
            corpus_id=corpus_id,
            name="Root Category",
            slug="root-category",
            parent_id=None,
            node_type="category",
            description="Top level category",
            sort_order=1,
            config={"theme": "dark"},
        )

        assert len(session.added) == 1
        assert session.flush_count == 1
        created = session.added[0]
        assert created.corpus_id == corpus_id
        assert created.name == "Root Category"
        assert created.slug == "root-category"
        assert created.parent_id is None
        assert created.node_type == "category"
        assert created.description == "Top level category"
        assert created.sort_order == 1
        assert created.config == {"theme": "dark"}
        assert node is created

    @pytest.mark.asyncio
    async def test_create_node_default_values(self) -> None:
        """create_node 未传可选字段时应使用默认值：node_type=category, sort_order=0, config={}"""
        corpus_id = uuid4()
        session = FakeAsyncSessionForCatalog()

        await CatalogDao.create_node(
            session,
            corpus_id=corpus_id,
            name="Default Node",
            slug="default-node",
        )

        created = session.added[0]
        assert created.node_type == "category"
        assert created.sort_order == 0
        assert created.config == {}

    @pytest.mark.asyncio
    async def test_get_node_executes_select_by_id(self) -> None:
        """get_node 应执行 select(DocCatalogNode).where(id == node_id)"""
        target_id = uuid4()
        expected_node = _make_node(id=target_id)
        session = FakeAsyncSessionForCatalog(
            execute_responses=[
                _FakeResult(scalar_value=expected_node),
            ]
        )

        result = await CatalogDao.get_node(session, target_id)

        assert result is expected_node
        assert result.id == target_id

    @pytest.mark.asyncio
    async def test_get_node_by_slug_executes_select(self) -> None:
        """get_node_by_slug 应按 corpus_id + slug 执行 select"""
        corpus_id = uuid4()
        slug = "my-slug"
        expected_node = _make_node(corpus_id=corpus_id, slug=slug)
        session = FakeAsyncSessionForCatalog(
            execute_responses=[
                _FakeResult(scalar_value=expected_node),
            ]
        )

        result = await CatalogDao.get_node_by_slug(session, corpus_id, slug)

        assert result is expected_node
        assert result.corpus_id == corpus_id
        assert result.slug == slug

    @pytest.mark.asyncio
    async def test_update_node_only_updates_non_none_fields(self) -> None:
        """update_node 仅对非 None 的 kwargs 执行 setattr 更新"""
        node_id = uuid4()
        original = _make_node(
            id=node_id,
            name="Old Name",
            slug="old-slug",
            sort_order=0,
            description=None,
        )
        session = FakeAsyncSessionForCatalog(
            execute_responses=[
                # get_node 内部查询返回原始节点
                _FakeResult(scalar_value=original),
            ]
        )

        updated = await CatalogDao.update_node(
            session,
            node_id=node_id,
            name="New Name",  # 应更新
            sort_order=10,  # 应更新
            description="Desc",  # 应更新
            # slug 未传入 → 不更新
            # parent_id 未传入 → 不更新
            # node_type 未传入 → 不更新
            # config 未传入 → 不更新
        )

        assert updated is original
        assert updated.name == "New Name"
        assert updated.sort_order == 10
        assert updated.description == "Desc"
        # 未传入的字段保持原值
        assert updated.slug == "old-slug"

    @pytest.mark.asyncio
    async def test_update_node_returns_none_for_missing(self) -> None:
        """update_node 在节点不存在时应返回 None"""
        missing_id = uuid4()
        session = FakeAsyncSessionForCatalog(
            execute_responses=[
                # get_node 返回 None
                _FakeResult(scalar_value=None),
            ]
        )

        result = await CatalogDao.update_node(
            session,
            node_id=missing_id,
            name="Ghost",
        )

        assert result is None
        assert session.flush_count == 0  # 不应触发 flush

    @pytest.mark.asyncio
    async def test_delete_node_deletes_and_flushes(self) -> None:
        """delete_node 应调用 db.delete + db.flush 并返回 True"""
        node_id = uuid4()
        existing = _make_node(id=node_id)
        session = FakeAsyncSessionForCatalog(
            execute_responses=[
                _FakeResult(scalar_value=existing),
            ]
        )

        result = await CatalogDao.delete_node(session, node_id)

        assert result is True
        assert len(session.deleted) == 1
        assert session.deleted[0] is existing
        assert session.flush_count == 1

    @pytest.mark.asyncio
    async def test_delete_node_returns_false_for_missing(self) -> None:
        """delete_node 在节点不存在时应返回 False 且不调用 delete/flush"""
        missing_id = uuid4()
        session = FakeAsyncSessionForCatalog(
            execute_responses=[
                _FakeResult(scalar_value=None),
            ]
        )

        result = await CatalogDao.delete_node(session, missing_id)

        assert result is False
        assert len(session.deleted) == 0
        assert session.flush_count == 0


# ===================================================================
# TestCatalogMembership — 文档归属管理单测 (6 cases)
# ===================================================================


class TestCatalogMembership:
    """CatalogDao 文档归属管理方法的单元测试"""

    @pytest.mark.asyncio
    async def test_assign_document_creates_membership(self) -> None:
        """assign_document 应创建新的 DocCatalogMembership 并 flush"""
        catalog_node_id = uuid4()
        document_id = uuid4()
        session = FakeAsyncSessionForCatalog(
            execute_responses=[
                # 查询已存在记录 → 无
                _FakeResult(scalar_value=None),
            ]
        )

        membership = await CatalogDao.assign_document(
            session,
            catalog_node_id=catalog_node_id,
            document_id=document_id,
        )

        assert len(session.added) == 1
        assert session.flush_count == 1
        created = session.added[0]
        assert created.catalog_node_id == catalog_node_id
        assert created.document_id == document_id
        assert membership is created

    @pytest.mark.asyncio
    async def test_assign_document_idempotent_returns_existing(self) -> None:
        """assign_document 幂等性：已存在记录时直接返回，不重复创建"""
        catalog_node_id = uuid4()
        document_id = uuid4()
        existing = _make_membership(
            catalog_node_id=catalog_node_id,
            document_id=document_id,
        )
        session = FakeAsyncSessionForCatalog(
            execute_responses=[
                # 查询已存在记录 → 有
                _FakeResult(scalar_value=existing),
            ]
        )

        membership = await CatalogDao.assign_document(
            session,
            catalog_node_id=catalog_node_id,
            document_id=document_id,
        )

        assert membership is existing
        assert len(session.added) == 0  # 不应新增
        assert session.flush_count == 0  # 不应 flush

    @pytest.mark.asyncio
    async def test_unassign_document_deletes_membership(self) -> None:
        """unassign_document 应删除已有 membership 并返回 True"""
        catalog_node_id = uuid4()
        document_id = uuid4()
        membership = _make_membership(
            catalog_node_id=catalog_node_id,
            document_id=document_id,
        )
        session = FakeAsyncSessionForCatalog(
            execute_responses=[
                _FakeResult(scalar_value=membership),
            ]
        )

        result = await CatalogDao.unassign_document(
            session,
            catalog_node_id=catalog_node_id,
            document_id=document_id,
        )

        assert result is True
        assert len(session.deleted) == 1
        assert session.deleted[0] is membership
        assert session.flush_count == 1

    @pytest.mark.asyncio
    async def test_unassign_document_returns_false_when_missing(self) -> None:
        """unassign_document 在记录不存在时应返回 False"""
        catalog_node_id = uuid4()
        document_id = uuid4()
        session = FakeAsyncSessionForCatalog(
            execute_responses=[
                _FakeResult(scalar_value=None),
            ]
        )

        result = await CatalogDao.unassign_document(
            session,
            catalog_node_id=catalog_node_id,
            document_id=document_id,
        )

        assert result is False
        assert len(session.deleted) == 0
        assert session.flush_count == 0

    @pytest.mark.asyncio
    async def test_get_node_documents_returns_tuple(self) -> None:
        """get_node_documents 应返回 (docs_list, total_count) 元组"""
        catalog_node_id = uuid4()
        doc1 = SimpleNamespace(id=uuid4(), title="Doc A")
        doc2 = SimpleNamespace(id=uuid4(), title="Doc B")
        session = FakeAsyncSessionForCatalog(
            execute_responses=[
                # count_query → scalar 返回总数
                _FakeResult(scalar_value=2),
                # docs query → scalars().all() 返回文档列表
                _FakeResult(rows=[doc1, doc2]),
            ]
        )
        # 让 all() 返回列表、scalars().all() 也返回列表
        session._execute_responses[-1]._rows = [doc1, doc2]

        documents, total = await CatalogDao.get_node_documents(
            session,
            catalog_node_id=catalog_node_id,
        )

        assert isinstance(documents, list)
        assert isinstance(total, int)
        assert total == 2
        assert len(documents) == 2

    @pytest.mark.asyncio
    async def test_get_document_nodes_returns_node_list(self) -> None:
        """get_document_nodes 应返回 DocCatalogNode 列表"""
        document_id = uuid4()
        node1 = _make_node(name="Cat A")
        node2 = _make_node(name="Cat B")
        session = FakeAsyncSessionForCatalog(
            execute_responses=[
                _FakeResult(rows=[node1, node2]),
            ]
        )

        nodes = await CatalogDao.get_document_nodes(session, document_id)

        assert isinstance(nodes, list)
        assert len(nodes) == 2
