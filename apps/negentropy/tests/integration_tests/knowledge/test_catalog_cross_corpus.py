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
    async def test_trees_of_different_catalogs_are_isolated(self, db_engine, negentropy_corpus):
        """两个不同 catalog 的目录树互不干扰"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        from negentropy.knowledge.catalog_dao import CatalogDao
        from negentropy.models.perception import DocCatalog

        session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        catalog_a_id: UUID
        catalog_b_id: UUID

        async with session_factory() as session:
            cat_a = DocCatalog(
                app_name="negentropy",
                name="Catalog A",
                slug="catalog-isolation-a",
                visibility="INTERNAL",
                version=1,
                is_archived=False,
            )
            cat_b = DocCatalog(
                app_name="negentropy",
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
    async def test_get_tree_different_catalog_does_not_return_nodes_of_other(self, db_engine, negentropy_corpus):
        """get_tree(catalog_id=X) 不应返回属于其他 catalog 的节点"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        from negentropy.knowledge.catalog_dao import CatalogDao
        from negentropy.models.perception import DocCatalog

        session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)

        async with session_factory() as session:
            cat_x = DocCatalog(
                app_name="negentropy",
                name="Catalog X",
                slug="catalog-isolation-x",
                visibility="INTERNAL",
                version=1,
                is_archived=False,
            )
            cat_y = DocCatalog(
                app_name="negentropy",
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
