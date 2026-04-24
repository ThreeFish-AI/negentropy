"""
Wiki 发布模式集成测试

覆盖范围：
- Live 模式（默认）：Publication 创建、发布、取消发布、状态流转
- Snapshot 概念验证：状态字段存在；未来快照功能的 fixture 准备
- 发布版本递增语义
- 归档（archived）状态
"""

from __future__ import annotations

from uuid import UUID

import pytest

# ===================================================================
# Fixtures
# ===================================================================


@pytest.fixture
async def wiki_corpus(db_engine):
    """创建测试用语料库"""
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    from negentropy.models.perception import Corpus

    session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
    corpus_id: UUID | None = None
    async with session_factory() as session:
        corpus = Corpus(name="wiki-publish-test-corpus", app_name="negentropy")
        session.add(corpus)
        await session.flush()
        await session.commit()
        corpus_id = corpus.id

    yield corpus_id

    async with session_factory() as s:
        from negentropy.models.perception import Corpus as C

        obj = await s.get(C, corpus_id)
        if obj is not None:
            await s.delete(obj)
            await s.commit()


@pytest.fixture
async def wiki_catalog(db_engine, wiki_corpus):
    """创建测试用 DocCatalog"""
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    from negentropy.models.perception import DocCatalog

    session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
    catalog_id: UUID | None = None
    async with session_factory() as session:
        catalog = DocCatalog(
            app_name="negentropy",
            name="wiki-publish-test-catalog",
            slug="wiki-publish-test-catalog",
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


# ===================================================================
# TestWikiPublicationLifecycle — Publication 生命周期
# ===================================================================


class TestWikiPublicationLifecycle:
    """WikiPublishingService 的创建、发布、取消发布生命周期测试"""

    @pytest.mark.asyncio
    async def test_create_publication_defaults_to_draft(self, db_engine, wiki_catalog):
        """新建 Publication 默认处于 draft 状态"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        from negentropy.knowledge.wiki_service import WikiPublishingService

        session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        service = WikiPublishingService()

        async with session_factory() as session:
            pub = await service.create_publication(
                session,
                catalog_id=wiki_catalog,
                app_name="negentropy",
                name="Test Publication",
                slug="test-pub-draft",
            )
            await session.commit()

        assert pub.status == "draft"
        assert pub.version == 0
        assert pub.catalog_id == wiki_catalog

    @pytest.mark.asyncio
    async def test_publish_changes_status_to_published(self, db_engine, wiki_catalog):
        """publish() 使 Publication 从 draft 进入 published 状态"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        from negentropy.knowledge.wiki_service import WikiPublishingService

        session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        service = WikiPublishingService()

        async with session_factory() as session:
            pub = await service.create_publication(
                session,
                catalog_id=wiki_catalog,
                app_name="negentropy",
                name="Test Publication Publish",
                slug="test-pub-publish",
            )
            await session.commit()
            pub_id = pub.id

        async with session_factory() as session:
            published = await service.publish(session, pub_id)
            await session.commit()

        assert published is not None
        assert published.status == "published"
        assert published.version >= 1

    @pytest.mark.asyncio
    async def test_publish_increments_version(self, db_engine, wiki_catalog):
        """多次发布应递增 version"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        from negentropy.knowledge.wiki_service import WikiPublishingService

        session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        service = WikiPublishingService()

        async with session_factory() as session:
            pub = await service.create_publication(
                session,
                catalog_id=wiki_catalog,
                app_name="negentropy",
                name="Test Pub Version",
                slug="test-pub-version",
            )
            await session.commit()
            pub_id = pub.id

        # 第 1 次发布
        async with session_factory() as session:
            v1 = await service.publish(session, pub_id)
            await session.commit()
        version_1 = v1.version

        # 第 2 次发布（重新发布）
        async with session_factory() as session:
            v2 = await service.publish(session, pub_id)
            await session.commit()
        version_2 = v2.version

        assert version_2 > version_1

    @pytest.mark.asyncio
    async def test_unpublish_returns_to_draft(self, db_engine, wiki_catalog):
        """unpublish() 将 published → draft"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        from negentropy.knowledge.wiki_service import WikiPublishingService

        session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        service = WikiPublishingService()

        async with session_factory() as session:
            pub = await service.create_publication(
                session,
                catalog_id=wiki_catalog,
                app_name="negentropy",
                name="Test Pub Unpublish",
                slug="test-pub-unpublish",
            )
            await session.commit()
            pub_id = pub.id

        async with session_factory() as session:
            await service.publish(session, pub_id)
            await session.commit()

        async with session_factory() as session:
            unpublished = await service.unpublish(session, pub_id)
            await session.commit()

        assert unpublished is not None
        assert unpublished.status == "draft"

    @pytest.mark.asyncio
    async def test_archive_publication(self, db_engine, wiki_catalog):
        """archive() 将 Publication 置为 archived 状态"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        from negentropy.knowledge.wiki_service import WikiPublishingService

        session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        service = WikiPublishingService()

        async with session_factory() as session:
            pub = await service.create_publication(
                session,
                catalog_id=wiki_catalog,
                app_name="negentropy",
                name="Test Pub Archive",
                slug="test-pub-archive",
            )
            await session.commit()
            pub_id = pub.id

        async with session_factory() as session:
            archived = await service.archive(session, pub_id)
            await session.commit()

        assert archived is not None
        assert archived.status == "archived"

    @pytest.mark.asyncio
    async def test_delete_publication_removes_record(self, db_engine, wiki_catalog):
        """delete_publication() 后 get_publication 应返回 None"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        from negentropy.knowledge.wiki_service import WikiPublishingService

        session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        service = WikiPublishingService()

        async with session_factory() as session:
            pub = await service.create_publication(
                session,
                catalog_id=wiki_catalog,
                app_name="negentropy",
                name="Test Pub Delete",
                slug="test-pub-delete",
            )
            await session.commit()
            pub_id = pub.id

        async with session_factory() as session:
            deleted = await service.delete_publication(session, pub_id)
            await session.commit()

        assert deleted is True

        async with session_factory() as session:
            gone = await service.get_publication(session, pub_id)

        assert gone is None


# ===================================================================
# TestWikiPublicationCatalogBinding — catalog_id 绑定语义
# ===================================================================


class TestWikiPublicationCatalogBinding:
    """Publication 与 Catalog 的绑定关系测试"""

    @pytest.mark.asyncio
    async def test_list_publications_filtered_by_catalog(self, db_engine, wiki_catalog):
        """list_publications(catalog_id=X) 只返回该 catalog 下的发布"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        from negentropy.knowledge.wiki_service import WikiPublishingService
        from negentropy.models.perception import DocCatalog

        session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        service = WikiPublishingService()

        # 创建第二个 catalog
        async with session_factory() as session:
            other = DocCatalog(
                app_name="negentropy",
                name="other-catalog-list",
                slug="other-catalog-list",
                visibility="INTERNAL",
                version=1,
                is_archived=False,
            )
            session.add(other)
            await session.flush()
            await session.commit()
            other_catalog_id = other.id

        # 在 wiki_catalog 下创建 2 个 publication
        async with session_factory() as session:
            await service.create_publication(
                session, catalog_id=wiki_catalog, app_name="negentropy", name="Pub A", slug="pub-a-list"
            )
            await service.create_publication(
                session, catalog_id=wiki_catalog, app_name="negentropy", name="Pub B", slug="pub-b-list"
            )
            # 在 other catalog 下创建 1 个
            await service.create_publication(
                session, catalog_id=other_catalog_id, app_name="negentropy", name="Pub C Other", slug="pub-c-other-list"
            )
            await session.commit()

        # 按 wiki_catalog 过滤
        async with session_factory() as session:
            pubs, total = await service.list_publications(session, catalog_id=wiki_catalog)

        assert total >= 2
        assert all(p.catalog_id == wiki_catalog for p in pubs)

        # cleanup other catalog
        async with session_factory() as s:
            obj = await s.get(DocCatalog, other_catalog_id)
            if obj is not None:
                await s.delete(obj)
            await s.commit()

    @pytest.mark.asyncio
    async def test_create_publication_slug_validation(self, db_engine, wiki_catalog):
        """非法 slug 格式应抛 ValueError"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        from negentropy.knowledge.wiki_service import WikiPublishingService

        session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        service = WikiPublishingService()

        async with session_factory() as session:
            with pytest.raises(ValueError, match="Invalid slug format"):
                await service.create_publication(
                    session,
                    catalog_id=wiki_catalog,
                    app_name="negentropy",
                    name="Bad Slug Pub",
                    slug="UPPER_CASE_SLUG",
                )

    @pytest.mark.asyncio
    async def test_create_publication_invalid_theme_raises(self, db_engine, wiki_catalog):
        """非法 theme 应抛 ValueError"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        from negentropy.knowledge.wiki_service import WikiPublishingService

        session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        service = WikiPublishingService()

        async with session_factory() as session:
            with pytest.raises(ValueError, match="Invalid theme"):
                await service.create_publication(
                    session,
                    catalog_id=wiki_catalog,
                    app_name="negentropy",
                    name="Bad Theme Pub",
                    slug="bad-theme-pub",
                    theme="unknown-theme",
                )
