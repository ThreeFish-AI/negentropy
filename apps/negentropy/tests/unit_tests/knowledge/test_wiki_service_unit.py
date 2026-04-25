"""WikiPublishingService 单元测试

验证 Wiki 发布服务层的核心逻辑：
- create_publication 的参数校验 (theme/slug)
- update_publication 的 theme 校验
- 同步链路助手函数（_build_path_slugs / _apply_entry_mappings）

注：``slugify`` 工具的纯函数单测迁移到独立 ``test_slug.py``（slug.py 模块抽取后的 SSOT）。
"""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest
import sqlalchemy.orm

from negentropy.knowledge.wiki_service import WikiPublishingService

# ---------------------------------------------------------------------------
# 修复 KnowledgeDocument <-> DocSource 双向 FK 的 AmbiguousForeignKeysError
# ---------------------------------------------------------------------------
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
# create_publication 参数校验
# ---------------------------------------------------------------------------


class TestWikiCreatePublicationValidation:
    """create_publication 参数校验"""

    @pytest.mark.asyncio
    async def test_reject_invalid_theme(self):
        service = WikiPublishingService()
        with pytest.raises(ValueError, match="Invalid theme"):
            await service.create_publication(
                _FakeAsyncSession(),
                catalog_id=uuid4(),
                app_name="negentropy",
                name="Test",
                theme="invalid-theme",
            )

    @pytest.mark.asyncio
    async def test_reject_invalid_slug_format(self):
        service = WikiPublishingService()
        with pytest.raises(ValueError, match="Invalid slug format"):
            await service.create_publication(
                _FakeAsyncSession(),
                catalog_id=uuid4(),
                app_name="negentropy",
                name="Test",
                slug="Invalid Slug!",
            )

    @pytest.mark.asyncio
    async def test_auto_slugify_when_not_provided(self):
        """未传 slug 时应自动从 name 生成"""
        service = WikiPublishingService()
        session = _FakeAsyncSession()
        # 不抛异常即视为成功（内部会调用 WikiDao.create_publication）
        await service.create_publication(
            session,
            catalog_id=uuid4(),
            app_name="negentropy",
            name="My Wiki Publication",
        )
        assert session.flush_count >= 1

    @pytest.mark.asyncio
    async def test_create_publication_logs_with_non_reserved_extra_keys(self, monkeypatch):
        """wiki publication 创建日志不应覆写 LogRecord 保留字段。"""
        service = WikiPublishingService()
        session = _FakeAsyncSession()
        captured: dict[str, object] = {}

        def fake_info(event: str, *, extra: dict[str, object]) -> None:
            captured["event"] = event
            captured["extra"] = extra

        monkeypatch.setattr("negentropy.knowledge.wiki_dao.logger.info", fake_info)

        await service.create_publication(
            session,
            catalog_id=uuid4(),
            app_name="negentropy",
            name="Architecture Wiki",
        )

        assert captured["event"] == "wiki_publication_created"
        assert captured["extra"]["publication_name"] == "Architecture Wiki"
        assert "name" not in captured["extra"]


# ---------------------------------------------------------------------------
# update_publication theme 校验
# ---------------------------------------------------------------------------


class TestWikiUpdatePublicationThemeValidation:
    """update_publication 的 theme 校验"""

    @pytest.mark.asyncio
    async def test_reject_invalid_theme_on_update(self):
        service = WikiPublishingService()
        with pytest.raises(ValueError, match="Invalid theme"):
            await service.update_publication(
                _FakeAsyncSession(),
                pub_id=uuid4(),
                theme="neon",
            )


# ---------------------------------------------------------------------------
# 委托方法 — 验证正确的 DAO 转发行为
# ---------------------------------------------------------------------------


class TestWikiDelegationMethods:
    """publish / unpublish / archive / delete 等委托方法的转发验证"""

    @pytest.mark.asyncio
    async def test_publish_delegates_to_dao(self):
        service = WikiPublishingService()
        session = _FakeAsyncSession()
        pub, revalidation = await service.publish(session, pub_id=uuid4())
        assert pub is None
        assert revalidation == "not_configured"

    @pytest.mark.asyncio
    async def test_unpublish_delegates_to_dao(self):
        service = WikiPublishingService()
        session = _FakeAsyncSession()
        pub, revalidation = await service.unpublish(session, pub_id=uuid4())
        assert pub is None
        assert revalidation == "not_configured"

    @pytest.mark.asyncio
    async def test_archive_delegates_to_dao(self):
        service = WikiPublishingService()
        session = _FakeAsyncSession()
        result = await service.archive(session, pub_id=uuid4())
        assert result is None

    @pytest.mark.asyncio
    async def test_delete_publication_delegates_to_dao(self):
        service = WikiPublishingService()
        session = _FakeAsyncSession()
        result = await service.delete_publication(session, pub_id=uuid4())
        assert result is False  # FakeAsyncSession.execute 返回 None → 删除失败


class TestWikiCatalogSync:
    """sync_entries_from_catalog 的字段映射回归。"""

    @pytest.mark.asyncio
    async def test_sync_entries_from_catalog_uses_original_filename(self, monkeypatch):
        service = WikiPublishingService()
        publication_id = uuid4()
        root_node_id = uuid4()
        doc_id = uuid4()
        fake_db = _FakeAsyncSession()
        captured: dict[str, object] = {}

        async def fake_get_subtree(db, node_id):
            _ = db
            assert node_id == root_node_id
            return [{"id": root_node_id, "parent_id": None, "slug": "root"}]

        async def fake_get_node_documents(db, catalog_node_id, limit=500):
            _ = (db, limit)
            assert catalog_node_id == root_node_id
            doc = SimpleNamespace(
                id=doc_id,
                original_filename="System Design.pdf",
                markdown_extract_status="completed",
                markdown_content="# System Design",
                metadata_={},
            )
            return [doc], 1

        async def fake_upsert_entry(db, **kwargs):
            _ = db
            captured.update(kwargs)

        async def fake_remove_stale_entries(db, publication_id, keep_document_ids):
            _ = (db, publication_id, keep_document_ids)
            return 0

        monkeypatch.setattr("negentropy.knowledge.catalog_dao.CatalogDao.get_subtree", fake_get_subtree)
        monkeypatch.setattr("negentropy.knowledge.catalog_dao.CatalogDao.get_node_documents", fake_get_node_documents)
        monkeypatch.setattr("negentropy.knowledge.wiki_service.WikiDao.upsert_entry", fake_upsert_entry)
        monkeypatch.setattr("negentropy.knowledge.wiki_service.WikiDao.remove_stale_entries", fake_remove_stale_entries)

        result = await service.sync_entries_from_catalog(
            fake_db,
            publication_id=publication_id,
            catalog_node_ids=[root_node_id],
        )

        assert result["synced_count"] == 1
        assert captured["document_id"] == doc_id
        assert captured["entry_slug"].endswith("system-design-pdf")
        assert captured["entry_title"] == "System Design.pdf"


# ---------------------------------------------------------------------------
# 最小 FakeAsyncSession — 仅支持 add / flush 协议
# ---------------------------------------------------------------------------


class _FakeAsyncSession:
    def __init__(self):
        self.added: list[object] = []
        self.flush_count = 0

    def add(self, obj: object) -> None:
        self.added.append(obj)

    async def flush(self) -> None:
        self.flush_count += 1

    async def execute(self, stmt: object):
        """返回空结果模拟查询"""

        class _EmptyResult:
            def scalar_one_or_none(self):
                return None

            def rowcount(self):
                return 0

        return _EmptyResult()

    async def commit(self) -> None: ...

    async def refresh(self, obj: object) -> None: ...
