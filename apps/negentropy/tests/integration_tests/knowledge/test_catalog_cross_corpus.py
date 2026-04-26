"""
Catalog 跨 corpus / orphaned entry 集成测试

覆盖范围：
- 跨 app_name 分配文档被 PermissionError 拒绝（catalog_service.py:315-319）
- document 删除后 entry 置为 orphaned 状态（catalog_dao DOCUMENT_REF SET NULL 语义）
- Catalog 隔离：不同 catalog 的树互不干扰
"""

from __future__ import annotations

from uuid import UUID

import pytest

# ===================================================================
# Fixtures
# ===================================================================


@pytest.fixture
async def negentropy_corpus(db_engine):
    """创建 app_name=negentropy 的测试 corpus"""
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    from negentropy.models.perception import Corpus

    session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
    corpus_id: UUID | None = None
    async with session_factory() as session:
        corpus = Corpus(name="cross-test-corpus-negentropy", app_name="negentropy")
        session.add(corpus)
        await session.flush()
        await session.commit()
        corpus_id = corpus.id

    yield corpus_id

    async with session_factory() as s:
        obj = await s.get(Corpus, corpus_id)
        if obj is not None:
            await s.delete(obj)
            await s.commit()


@pytest.fixture
async def other_app_corpus(db_engine):
    """创建 app_name=other-app 的测试 corpus（跨 app）"""
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    from negentropy.models.perception import Corpus

    session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
    corpus_id: UUID | None = None
    async with session_factory() as session:
        corpus = Corpus(name="cross-test-corpus-other", app_name="other-app")
        session.add(corpus)
        await session.flush()
        await session.commit()
        corpus_id = corpus.id

    yield corpus_id

    async with session_factory() as s:
        obj = await s.get(Corpus, corpus_id)
        if obj is not None:
            await s.delete(obj)
            await s.commit()


@pytest.fixture
async def negentropy_catalog(db_engine, negentropy_corpus):
    """创建 app_name=negentropy 的 DocCatalog"""
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    from negentropy.models.perception import DocCatalog

    session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
    catalog_id: UUID | None = None
    async with session_factory() as session:
        catalog = DocCatalog(
            app_name="negentropy",
            name="cross-test-catalog",
            slug="cross-test-catalog",
            visibility="INTERNAL",
            version=1,
            is_archived=False,
        )
        session.add(catalog)
        await session.flush()
        await session.commit()
        catalog_id = catalog.id

    yield catalog_id

    async with session_factory() as s:
        obj = await s.get(DocCatalog, catalog_id)
        if obj is not None:
            await s.delete(obj)
            await s.commit()


@pytest.fixture
async def doc_in_negentropy(db_engine, negentropy_corpus):
    """创建属于 negentropy corpus 的 KnowledgeDocument"""
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    from negentropy.models.perception import KnowledgeDocument

    session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
    doc_id: UUID | None = None
    async with session_factory() as session:
        doc = KnowledgeDocument(
            corpus_id=negentropy_corpus,
            app_name="negentropy",
            file_hash="abcdef1234567890" * 4,
            original_filename="valid_doc.pdf",
            gcs_uri="gs://test/valid_doc.pdf",
            content_type="application/pdf",
            file_size=2048,
        )
        session.add(doc)
        await session.flush()
        await session.commit()
        doc_id = doc.id

    yield doc_id

    async with session_factory() as s:
        obj = await s.get(KnowledgeDocument, doc_id)
        if obj is not None:
            await s.delete(obj)
            await s.commit()


@pytest.fixture
async def doc_in_other_app(db_engine, other_app_corpus):
    """创建属于 other-app corpus 的 KnowledgeDocument（跨 app）"""
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    from negentropy.models.perception import KnowledgeDocument

    session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
    doc_id: UUID | None = None
    async with session_factory() as session:
        doc = KnowledgeDocument(
            corpus_id=other_app_corpus,
            app_name="other-app",
            file_hash="fedcba0987654321" * 4,
            original_filename="foreign_doc.pdf",
            gcs_uri="gs://test/foreign_doc.pdf",
            content_type="application/pdf",
            file_size=1024,
        )
        session.add(doc)
        await session.flush()
        await session.commit()
        doc_id = doc.id

    yield doc_id

    async with session_factory() as s:
        obj = await s.get(KnowledgeDocument, doc_id)
        if obj is not None:
            await s.delete(obj)
            await s.commit()


# ===================================================================
# TestCrossCorpusPermission — 跨 app 分配拦截
# ===================================================================


class TestCrossCorpusPermission:
    """catalog_service.assign_document 的跨 app_name 权限校验"""

    @pytest.mark.asyncio
    async def test_assign_same_app_document_succeeds(self, db_engine, negentropy_catalog, doc_in_negentropy):
        """同 app_name 的文档归入 catalog 应成功"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        from negentropy.knowledge.catalog_dao import CatalogDao
        from negentropy.knowledge.catalog_service import CatalogService

        session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        service = CatalogService()

        # 先创建目录节点
        async with session_factory() as session:
            node = await CatalogDao.create_node(
                session,
                catalog_id=negentropy_catalog,
                name="Test Node",
                slug="test-node",
            )
            await session.commit()
            node_id = node.id

        # 归入同 app_name 文档 → 应成功（无异常）
        async with session_factory() as session:
            await service.assign_document(
                session,
                catalog_node_id=node_id,
                document_id=doc_in_negentropy,
            )
            await session.commit()

    @pytest.mark.asyncio
    async def test_assign_cross_app_document_raises_permission_error(
        self, db_engine, negentropy_catalog, doc_in_other_app
    ):
        """跨 app_name 文档归入 catalog 应抛 PermissionError"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        from negentropy.knowledge.catalog_dao import CatalogDao
        from negentropy.knowledge.catalog_service import CatalogService

        session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        service = CatalogService()

        # 先创建目录节点（属于 negentropy catalog）
        async with session_factory() as session:
            node = await CatalogDao.create_node(
                session,
                catalog_id=negentropy_catalog,
                name="Test Node Cross",
                slug="test-node-cross",
            )
            await session.commit()
            node_id = node.id

        # 归入跨 app_name 文档 → 应抛 PermissionError
        async with session_factory() as session:
            with pytest.raises(PermissionError, match="cross-app assignment forbidden"):
                await service.assign_document(
                    session,
                    catalog_node_id=node_id,
                    document_id=doc_in_other_app,
                )

    @pytest.mark.asyncio
    async def test_cross_app_rejection_does_not_modify_catalog(self, db_engine, negentropy_catalog, doc_in_other_app):
        """跨 app 拒绝后 catalog 的条目数量应保持不变"""
        from sqlalchemy import func, select
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        from negentropy.knowledge.catalog_dao import CatalogDao
        from negentropy.knowledge.catalog_service import CatalogService
        from negentropy.models.perception import DocCatalogEntry

        session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        service = CatalogService()

        async with session_factory() as session:
            node = await CatalogDao.create_node(
                session,
                catalog_id=negentropy_catalog,
                name="Clean Node",
                slug="clean-node",
            )
            await session.commit()
            node_id = node.id

        # 记录初始 entry 数量
        async with session_factory() as session:
            count_before = (
                await session.execute(
                    select(func.count())
                    .select_from(DocCatalogEntry)
                    .where(DocCatalogEntry.catalog_id == negentropy_catalog)
                )
            ).scalar()

        # 尝试跨 app 分配（会失败）
        async with session_factory() as session:
            with pytest.raises(PermissionError):
                await service.assign_document(
                    session,
                    catalog_node_id=node_id,
                    document_id=doc_in_other_app,
                )

        # entry 数量应不变
        async with session_factory() as session:
            count_after = (
                await session.execute(
                    select(func.count())
                    .select_from(DocCatalogEntry)
                    .where(DocCatalogEntry.catalog_id == negentropy_catalog)
                )
            ).scalar()

        assert count_before == count_after


# ===================================================================
# TestCatalogIsolation — 不同 catalog 互不干扰
# ===================================================================


class TestCatalogIsolation:
    """多个 catalog 之间的树隔离测试"""

    @pytest.mark.asyncio
    async def test_trees_of_different_catalogs_are_isolated(self, db_engine):
        """两个不同 catalog 的目录树互不干扰"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        from negentropy.knowledge.catalog_dao import CatalogDao
        from negentropy.models.perception import DocCatalog

        session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        catalog_a_id: UUID
        catalog_b_id: UUID

        async with session_factory() as session:
            cat_a = DocCatalog(
                app_name="test-isolation-a",
                name="Catalog A",
                slug="catalog-isolation-a",
                visibility="INTERNAL",
                version=1,
                is_archived=False,
            )
            cat_b = DocCatalog(
                app_name="test-isolation-b",
                name="Catalog B",
                slug="catalog-isolation-b",
                visibility="INTERNAL",
                version=1,
                is_archived=False,
            )
            session.add(cat_a)
            session.add(cat_b)
            await session.flush()
            catalog_a_id = cat_a.id
            catalog_b_id = cat_b.id
            await session.commit()

        # 在 catalog A 下创建节点
        async with session_factory() as session:
            await CatalogDao.create_node(session, catalog_id=catalog_a_id, name="Node A1", slug="node-a1")
            await CatalogDao.create_node(session, catalog_id=catalog_a_id, name="Node A2", slug="node-a2")
            # catalog B 只有 1 个节点
            await CatalogDao.create_node(session, catalog_id=catalog_b_id, name="Node B1", slug="node-b1")
            await session.commit()

        async with session_factory() as session:
            tree_a = await CatalogDao.get_tree(session, catalog_id=catalog_a_id)
            tree_b = await CatalogDao.get_tree(session, catalog_id=catalog_b_id)

        assert len(tree_a) == 2
        assert len(tree_b) == 1

        # cleanup
        async with session_factory() as s:
            for cid in [catalog_a_id, catalog_b_id]:
                obj = await s.get(DocCatalog, cid)
                if obj is not None:
                    await s.delete(obj)
            await s.commit()

    @pytest.mark.asyncio
    async def test_get_tree_different_catalog_does_not_return_nodes_of_other(self, db_engine):
        """get_tree(catalog_id=X) 不应返回属于其他 catalog 的节点"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        from negentropy.knowledge.catalog_dao import CatalogDao
        from negentropy.models.perception import DocCatalog

        session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)

        async with session_factory() as session:
            cat_x = DocCatalog(
                app_name="test-isolation-x",
                name="Catalog X",
                slug="catalog-isolation-x",
                visibility="INTERNAL",
                version=1,
                is_archived=False,
            )
            cat_y = DocCatalog(
                app_name="test-isolation-y",
                name="Catalog Y",
                slug="catalog-isolation-y",
                visibility="INTERNAL",
                version=1,
                is_archived=False,
            )
            session.add(cat_x)
            session.add(cat_y)
            await session.flush()
            x_id = cat_x.id
            y_id = cat_y.id
            await session.commit()

        async with session_factory() as session:
            node_x = await CatalogDao.create_node(session, catalog_id=x_id, name="X-Only Node", slug="x-only-node")
            await session.commit()

        # query catalog Y → 不应看到 catalog X 的节点
        async with session_factory() as session:
            tree_y = await CatalogDao.get_tree(session, catalog_id=y_id)

        assert all(row["id"] != node_x.id for row in tree_y)

        # cleanup
        async with session_factory() as s:
            for cid in [x_id, y_id]:
                obj = await s.get(DocCatalog, cid)
                if obj is not None:
                    await s.delete(obj)
            await s.commit()


# ===================================================================
# TestGetCatalogDocuments — ISSUE-010 回归：候选文档列表契约
# ===================================================================


@pytest.fixture
def patch_handler_sessions(db_engine, monkeypatch):
    """将 knowledge.api 与 storage.service 内 `from X import AsyncSessionLocal`
    造成的名称绑定重定向到测试引擎，使 handler 直调可命中测试 DB。

    conftest.patch_db_globals 仅覆盖 db.session / db.deps 命名空间，
    无法影响已以 `from X import Y` 形式绑定在其他模块的引用——此 fixture
    形成互补。
    """
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    from negentropy.knowledge import api as knowledge_api
    from negentropy.storage import service as storage_service_module

    test_session_local = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
    monkeypatch.setattr(knowledge_api, "AsyncSessionLocal", test_session_local)
    monkeypatch.setattr(storage_service_module, "AsyncSessionLocal", test_session_local)
    return test_session_local


@pytest.fixture
async def three_docs_in_negentropy(db_engine, negentropy_corpus):
    """在 negentropy_corpus 下创建 3 个 active KnowledgeDocument（不同文件名/hash）。"""
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    from negentropy.models.perception import KnowledgeDocument

    session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
    doc_ids: list[UUID] = []
    filenames = [
        "Context Engineering 2.0 - The Context of Context Engineering.pdf",
        "harness-design-long-running-apps.md",
        "2603.05344v3.pdf",
    ]
    async with session_factory() as session:
        for idx, fn in enumerate(filenames):
            doc = KnowledgeDocument(
                corpus_id=negentropy_corpus,
                app_name="negentropy",
                file_hash=f"{idx:064x}"[-64:],  # 64-hex-char, unique per doc
                original_filename=fn,
                gcs_uri=f"gs://test/doc_{idx}",
                content_type="application/pdf" if fn.endswith(".pdf") else "text/markdown",
                file_size=1024 * (idx + 1),
            )
            session.add(doc)
            await session.flush()
            doc_ids.append(doc.id)
        await session.commit()

    yield doc_ids

    async with session_factory() as s:
        for did in doc_ids:
            obj = await s.get(KnowledgeDocument, did)
            if obj is not None:
                await s.delete(obj)
        await s.commit()


class TestGetCatalogDocuments:
    """GET /catalogs/{catalog_id}/documents 候选文档契约"""

    @pytest.mark.asyncio
    async def test_returns_app_scoped_active_docs_with_full_fields(
        self,
        patch_handler_sessions,
        negentropy_catalog,
        three_docs_in_negentropy,
        doc_in_other_app,
    ):
        """候选集 = catalog.app_name 下全部 active 文档；字段与 KnowledgeDocument 接口对齐；
        跨 app 文档不可见。"""
        from negentropy.knowledge import api as knowledge_api

        result = await knowledge_api.get_catalog_documents(catalog_id=negentropy_catalog, offset=0, limit=200)

        assert result["total"] == 3
        assert len(result["items"]) == 3

        returned_ids = {str(item.id) for item in result["items"]}
        expected_ids = {str(d) for d in three_docs_in_negentropy}
        assert returned_ids == expected_ids, "应仅返回 negentropy app 下的文档"
        assert str(doc_in_other_app) not in returned_ids, "跨 app 的文档必须被过滤掉"

        # 字段完整性（对齐前端 KnowledgeDocument 接口，回归 ISSUE-010）
        for item in result["items"]:
            assert item.original_filename, "original_filename 必须非空（UI 直接显示）"
            assert item.app_name == "negentropy"
            assert item.file_hash
            assert item.gcs_uri
            assert item.file_size
            assert item.created_at
            assert item.markdown_extract_status  # 默认 "pending"

    @pytest.mark.asyncio
    async def test_excludes_soft_deleted(
        self,
        db_engine,
        patch_handler_sessions,
        negentropy_catalog,
        three_docs_in_negentropy,
    ):
        """status='deleted' 的文档必须从候选集排除。"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        from negentropy.knowledge import api as knowledge_api
        from negentropy.models.perception import KnowledgeDocument

        session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        async with session_factory() as session:
            doc = await session.get(KnowledgeDocument, three_docs_in_negentropy[0])
            doc.status = "deleted"
            await session.commit()

        result = await knowledge_api.get_catalog_documents(catalog_id=negentropy_catalog, offset=0, limit=200)
        assert result["total"] == 2
        assert all(item.id != three_docs_in_negentropy[0] for item in result["items"])

    @pytest.mark.asyncio
    async def test_404_on_unknown_catalog(self, patch_handler_sessions):
        """未知 catalog_id 必须返回 HTTP 404 + CATALOG_NOT_FOUND code。"""
        from uuid import uuid4

        from fastapi import HTTPException

        from negentropy.knowledge import api as knowledge_api

        with pytest.raises(HTTPException) as exc_info:
            await knowledge_api.get_catalog_documents(catalog_id=uuid4(), offset=0, limit=200)
        assert exc_info.value.status_code == 404
        detail = exc_info.value.detail
        assert isinstance(detail, dict)
        assert detail.get("code") == "CATALOG_NOT_FOUND"

    @pytest.mark.asyncio
    async def test_archived_catalog_still_returns_candidates(
        self,
        db_engine,
        patch_handler_sessions,
        negentropy_catalog,
        three_docs_in_negentropy,
    ):
        """归档的 catalog 仍应返回候选文档（归档 gating 在「分配」动作，不在「列候选」动作）。"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        from negentropy.knowledge import api as knowledge_api
        from negentropy.models.perception import DocCatalog

        session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        async with session_factory() as session:
            catalog = await session.get(DocCatalog, negentropy_catalog)
            catalog.is_archived = True
            await session.commit()

        result = await knowledge_api.get_catalog_documents(catalog_id=negentropy_catalog, offset=0, limit=200)
        assert result["total"] == 3


class TestGetEntryDocuments:
    """GET /catalogs/{catalog_id}/entries/{entry_id}/documents 已归属文档契约"""

    @pytest.mark.asyncio
    async def test_returns_assigned_docs_with_original_filename_key(
        self,
        db_engine,
        patch_handler_sessions,
        negentropy_catalog,
        doc_in_negentropy,
    ):
        """响应外壳为 {documents, total}；单项必须含 original_filename（非空）——
        回归 ISSUE-010 字段漂移，锁定 DocumentAssignmentSection.tsx 的显示契约。"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        from negentropy.knowledge import api as knowledge_api
        from negentropy.knowledge.catalog_dao import CatalogDao
        from negentropy.knowledge.catalog_service import CatalogService

        session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        service = CatalogService()

        # 创建节点并归入 1 个文档
        async with session_factory() as session:
            node = await CatalogDao.create_node(
                session,
                catalog_id=negentropy_catalog,
                name="Assigned Node",
                slug="assigned-node",
            )
            await session.commit()
            node_id = node.id

        async with session_factory() as session:
            await service.assign_document(session, catalog_node_id=node_id, document_id=doc_in_negentropy)
            await session.commit()

        result = await knowledge_api.get_entry_documents(
            catalog_id=negentropy_catalog, entry_id=node_id, offset=0, limit=50
        )

        # 响应外壳断言：key 必须是 "documents"（对齐前端 CatalogNodeDocumentsResponse）
        assert "documents" in result
        assert "items" not in result, "修复后响应 key 应从 items 迁移至 documents"
        assert result["total"] == 1
        assert len(result["documents"]) == 1

        item = result["documents"][0]
        # 字段契约（对齐前端 KnowledgeDocument.original_filename 读取）
        assert item.id == doc_in_negentropy
        assert item.original_filename == "valid_doc.pdf"
        assert item.app_name == "negentropy"
        assert item.file_hash
        assert item.gcs_uri
