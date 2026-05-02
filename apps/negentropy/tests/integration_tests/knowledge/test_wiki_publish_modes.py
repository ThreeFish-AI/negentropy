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
        from negentropy.models.perception import WikiPublication

        pubs = (
            await s.execute(WikiPublication.__table__.select().where(WikiPublication.catalog_id == catalog_id))
        ).fetchall()
        if pubs:
            await s.execute(WikiPublication.__table__.delete().where(WikiPublication.catalog_id == catalog_id))
            await s.flush()
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

        from negentropy.knowledge.lifecycle.wiki_service import WikiPublishingService

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
        assert pub.version == 1
        assert pub.catalog_id == wiki_catalog

    @pytest.mark.asyncio
    async def test_publish_changes_status_to_published(self, db_engine, wiki_catalog):
        """publish() 使 Publication 从 draft 进入 published 状态"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        from negentropy.knowledge.lifecycle.wiki_service import WikiPublishingService

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
            published, _ = await service.publish(session, pub_id)
            await session.commit()

        assert published is not None
        assert published.status == "published"
        assert published.version >= 1

    @pytest.mark.asyncio
    async def test_publish_increments_version(self, db_engine, wiki_catalog):
        """多次发布应递增 version"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        from negentropy.knowledge.lifecycle.wiki_service import WikiPublishingService

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
            v1, _ = await service.publish(session, pub_id)
            await session.commit()
        version_1 = v1.version

        # 第 2 次发布（重新发布）
        async with session_factory() as session:
            v2, _ = await service.publish(session, pub_id)
            await session.commit()
        version_2 = v2.version

        assert version_2 > version_1

    @pytest.mark.asyncio
    async def test_unpublish_returns_to_draft(self, db_engine, wiki_catalog):
        """unpublish() 将 published → draft"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        from negentropy.knowledge.lifecycle.wiki_service import WikiPublishingService

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
            unpublished, _ = await service.unpublish(session, pub_id)
            await session.commit()

        assert unpublished is not None
        assert unpublished.status == "draft"

    @pytest.mark.asyncio
    async def test_archive_publication(self, db_engine, wiki_catalog):
        """archive() 将 Publication 置为 archived 状态"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        from negentropy.knowledge.lifecycle.wiki_service import WikiPublishingService

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

        from negentropy.knowledge.lifecycle.wiki_service import WikiPublishingService

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

        from negentropy.knowledge.lifecycle.wiki_service import WikiPublishingService
        from negentropy.models.perception import DocCatalog

        session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        service = WikiPublishingService()

        # 创建第二个 catalog（使用不同 app_name 规避 singleton 约束）
        async with session_factory() as session:
            other = DocCatalog(
                app_name="test-other-app",
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

        # 每个 catalog 仅允许 1 个 LIVE publication（uq_wiki_pub_catalog_active 约束）
        async with session_factory() as session:
            await service.create_publication(
                session, catalog_id=wiki_catalog, app_name="negentropy", name="Pub A", slug="pub-a-list"
            )
            # 在 other catalog 下创建 1 个
            await service.create_publication(
                session,
                catalog_id=other_catalog_id,
                app_name="test-other-app",
                name="Pub C Other",
                slug="pub-c-other-list",
            )
            await session.commit()

        # 按 wiki_catalog 过滤：仅返回 wiki_catalog 下的 publication（不含 other catalog 的）
        async with session_factory() as session:
            pubs, total = await service.list_publications(session, catalog_id=wiki_catalog)

        assert total >= 1
        assert all(p.catalog_id == wiki_catalog for p in pubs)
        assert any(p.slug == "pub-a-list" for p in pubs)
        assert not any(p.slug == "pub-c-other-list" for p in pubs)

        # cleanup other catalog（先清空对应 publication 以避免 NOT NULL 约束）
        async with session_factory() as s:
            from negentropy.models.perception import WikiPublication

            await s.execute(WikiPublication.__table__.delete().where(WikiPublication.catalog_id == other_catalog_id))
            await s.flush()
            obj = await s.get(DocCatalog, other_catalog_id)
            if obj is not None:
                await s.delete(obj)
            await s.commit()

    @pytest.mark.asyncio
    async def test_create_publication_slug_validation(self, db_engine, wiki_catalog):
        """非法 slug 格式应抛 ValueError"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        from negentropy.knowledge.lifecycle.wiki_service import WikiPublishingService

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

        from negentropy.knowledge.lifecycle.wiki_service import WikiPublishingService

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


# ===================================================================
# TestWikiPublicationEntriesEagerLoading — entries 关系 eager-load 回归
# ===================================================================


class TestWikiPublicationEntriesEagerLoading:
    """回归 ISSUE-010 三阶问题：async SQLAlchemy 中 pub.entries 必须 eager-load。

    若 DAO 查询不挂 selectinload(WikiPublication.entries)，handler 在
    `len(pub.entries)` 处会以 sqlalchemy.exc.MissingGreenlet 失败 → 500。
    """

    @pytest.mark.asyncio
    async def test_list_publications_entries_accessible_after_query(self, db_engine, wiki_corpus, wiki_catalog):
        """list_publications 返回的对象必须可直接读取 entries（已 eager-loaded）"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        from negentropy.knowledge.lifecycle.wiki_dao import WikiDao
        from negentropy.knowledge.lifecycle.wiki_service import WikiPublishingService
        from negentropy.models.perception import KnowledgeDocument

        session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        service = WikiPublishingService()

        # 准备：corpus + document + publication + entry
        async with session_factory() as session:
            doc = KnowledgeDocument(
                corpus_id=wiki_corpus,
                app_name="negentropy",
                file_hash="entries-eager-load-hash",
                original_filename="entries-eager-load.md",
                gcs_uri="gs://test/entries-eager-load.md",
                file_size=42,
            )
            session.add(doc)
            await session.flush()
            doc_id = doc.id

            pub = await service.create_publication(
                session,
                catalog_id=wiki_catalog,
                app_name="negentropy",
                name="Pub With Entries",
                slug="pub-with-entries-eager",
            )
            await session.flush()
            await WikiDao.upsert_entry(
                session,
                publication_id=pub.id,
                document_id=doc_id,
                entry_slug="entry-1",
                entry_title="Entry 1",
            )
            await session.commit()
            pub_id = pub.id

        # 核心断言：list 返回后访问 entries 不抛 MissingGreenlet，且计数正确
        async with session_factory() as session:
            pubs, total = await service.list_publications(session, catalog_id=wiki_catalog)

        assert total >= 1
        target = next((p for p in pubs if p.id == pub_id), None)
        assert target is not None
        # 修复前此处会抛 sqlalchemy.exc.MissingGreenlet
        assert len(target.entries) == 1
        assert target.entries[0].entry_slug == "entry-1"

    @pytest.mark.asyncio
    async def test_get_publication_entries_accessible_after_query(self, db_engine, wiki_corpus, wiki_catalog):
        """get_publication 返回的对象必须可直接读取 entries（已 eager-loaded）"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        from negentropy.knowledge.lifecycle.wiki_dao import WikiDao
        from negentropy.knowledge.lifecycle.wiki_service import WikiPublishingService
        from negentropy.models.perception import KnowledgeDocument

        session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        service = WikiPublishingService()

        async with session_factory() as session:
            doc = KnowledgeDocument(
                corpus_id=wiki_corpus,
                app_name="negentropy",
                file_hash="get-pub-eager-hash",
                original_filename="get-pub-eager.md",
                gcs_uri="gs://test/get-pub-eager.md",
                file_size=42,
            )
            session.add(doc)
            await session.flush()
            doc_id = doc.id

            pub = await service.create_publication(
                session,
                catalog_id=wiki_catalog,
                app_name="negentropy",
                name="Pub Get Eager",
                slug="pub-get-eager",
            )
            await session.flush()
            await WikiDao.upsert_entry(
                session,
                publication_id=pub.id,
                document_id=doc_id,
                entry_slug="entry-x",
            )
            await session.commit()
            pub_id = pub.id

        async with session_factory() as session:
            fetched = await service.get_publication(session, pub_id)

        assert fetched is not None
        assert len(fetched.entries) == 1


# ===================================================================
# TestCreateWikiPublicationApiConflict — POST /wiki/publications 409 转换
# ===================================================================


@pytest.fixture
def patch_knowledge_api_session(db_engine, monkeypatch):
    """将 knowledge.api 内 `from db.session import AsyncSessionLocal` 重定向到测试引擎。

    conftest.patch_db_globals 仅覆盖 db.session/db.deps 命名空间，不影响已通过
    `from X import Y` 形式静态绑定到其他模块的引用——本 fixture 形成互补，
    与 test_catalog_cross_corpus.patch_handler_sessions 同源。
    """
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    from negentropy.knowledge import api as knowledge_api

    test_session_local = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
    monkeypatch.setattr(knowledge_api, "AsyncSessionLocal", test_session_local)
    return test_session_local


@pytest.fixture
async def isolated_wiki_catalog(db_engine):
    """使用唯一 app_name 的隔离 DocCatalog，规避 uq_doc_catalogs_app_singleton 约束。

    `wiki_catalog` 固定 app_name='negentropy'，在共享 dev DB 上会与既有 catalog 冲突；
    本 fixture 用 ``test-wiki-pub-conflict-<uuid>`` 派生独立 app_name。
    """
    from uuid import uuid4

    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    from negentropy.models.perception import DocCatalog, WikiPublication

    unique_app = f"test-wiki-pub-conflict-{uuid4().hex[:8]}"
    session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
    catalog_id: UUID | None = None
    async with session_factory() as session:
        catalog = DocCatalog(
            app_name=unique_app,
            name=f"{unique_app}-catalog",
            slug=unique_app,
            visibility="INTERNAL",
            version=1,
            is_archived=False,
        )
        session.add(catalog)
        await session.flush()
        await session.commit()
        catalog_id = catalog.id

    yield catalog_id, unique_app

    async with session_factory() as s:
        await s.execute(WikiPublication.__table__.delete().where(WikiPublication.catalog_id == catalog_id))
        await s.flush()
        obj = await s.get(DocCatalog, catalog_id)
        if obj is not None:
            await s.delete(obj)
        await s.commit()


class TestCreateWikiPublicationApiConflict:
    """POST /knowledge/wiki/publications 409 路径回归

    覆盖 ISSUE-024 修复：原本 `uq_wiki_pub_catalog_active` /
    `uq_wiki_pub_catalog_slug` 唯一约束触发后会以 500 InternalServerError 抛
    出（IntegrityError 漏出），现按业务前置检查 + IntegrityError 兜底改为
    `409 Conflict` + `{code, message, details}` 结构化响应。
    """

    @pytest.mark.asyncio
    async def test_second_live_publication_on_same_catalog_returns_409(
        self, patch_knowledge_api_session, isolated_wiki_catalog
    ):
        """同一 catalog 第二次创建发布 → 409 + WIKI_PUB_CATALOG_LIVE_CONFLICT"""
        from fastapi import HTTPException

        from negentropy.knowledge.api import create_wiki_publication
        from negentropy.knowledge.lifecycle_schemas import WikiPublicationCreateRequest

        catalog_id, _app_name = isolated_wiki_catalog

        # 先建一个 LIVE 发布
        first_resp = await create_wiki_publication(
            WikiPublicationCreateRequest(
                catalog_id=catalog_id,
                name="First Pub",
                slug="first-live-pub",
            )
        )
        assert first_resp.id is not None

        # 第二次创建 → 命中 LIVE singleton 约束
        with pytest.raises(HTTPException) as exc_info:
            await create_wiki_publication(
                WikiPublicationCreateRequest(
                    catalog_id=catalog_id,
                    name="Second Pub",
                    slug="second-live-pub",
                )
            )

        exc = exc_info.value
        assert exc.status_code == 409
        assert isinstance(exc.detail, dict)
        assert exc.detail.get("code") == "WIKI_PUB_CATALOG_LIVE_CONFLICT"
        assert "生效中" in exc.detail.get("message", "")
        details = exc.detail.get("details") or {}
        assert details.get("catalog_id") == str(catalog_id)
        assert details.get("existing_publication_id") == str(first_resp.id)

    @pytest.mark.asyncio
    async def test_duplicate_slug_on_same_catalog_returns_409(
        self, patch_knowledge_api_session, db_engine, isolated_wiki_catalog
    ):
        """同 catalog 下 slug 重复 → 409 + WIKI_PUB_SLUG_CONFLICT

        构造场景：先建 LIVE 发布 + 改 publish_mode 为 SNAPSHOT 让出 LIVE 槽位，
        再用同 slug 二次创建——此时 LIVE 检查不命中，slug 唯一约束命中。
        """
        from fastapi import HTTPException
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        from negentropy.knowledge.api import create_wiki_publication
        from negentropy.knowledge.lifecycle_schemas import WikiPublicationCreateRequest
        from negentropy.models.perception import WikiPublication

        catalog_id, _app_name = isolated_wiki_catalog

        first_resp = await create_wiki_publication(
            WikiPublicationCreateRequest(
                catalog_id=catalog_id,
                name="Slug Conflict Pub",
                slug="dup-slug-pub",
            )
        )

        # 把第一个发布改成 SNAPSHOT 模式，让出 uq_wiki_pub_catalog_active 槽位
        session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        async with session_factory() as session:
            obj = await session.get(WikiPublication, first_resp.id)
            assert obj is not None
            obj.publish_mode = "SNAPSHOT"
            await session.commit()

        with pytest.raises(HTTPException) as exc_info:
            await create_wiki_publication(
                WikiPublicationCreateRequest(
                    catalog_id=catalog_id,
                    name="Another Same Slug",
                    slug="dup-slug-pub",
                )
            )

        exc = exc_info.value
        assert exc.status_code == 409
        assert isinstance(exc.detail, dict)
        assert exc.detail.get("code") == "WIKI_PUB_SLUG_CONFLICT"
        details = exc.detail.get("details") or {}
        assert details.get("slug") == "dup-slug-pub"
        assert details.get("existing_publication_id") == str(first_resp.id)

    @pytest.mark.asyncio
    async def test_invalid_catalog_returns_404(self, patch_knowledge_api_session):
        """catalog_id 不存在 → 404 CATALOG_NOT_FOUND（回归未损）"""
        from uuid import uuid4

        from fastapi import HTTPException

        from negentropy.knowledge.api import create_wiki_publication
        from negentropy.knowledge.lifecycle_schemas import WikiPublicationCreateRequest

        with pytest.raises(HTTPException) as exc_info:
            await create_wiki_publication(
                WikiPublicationCreateRequest(
                    catalog_id=uuid4(),
                    name="Ghost Catalog Pub",
                    slug="ghost-catalog-pub",
                )
            )

        exc = exc_info.value
        assert exc.status_code == 404
        assert isinstance(exc.detail, dict)
        assert exc.detail.get("code") == "CATALOG_NOT_FOUND"
