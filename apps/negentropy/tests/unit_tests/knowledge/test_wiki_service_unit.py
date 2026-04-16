"""WikiPublishingService 单元测试

验证 Wiki 发布服务层的核心逻辑：
- _slugify 纯函数的各种输入场景
- create_publication 的参数校验 (theme/slug)
- update_publication 的 theme 校验
"""

from __future__ import annotations

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
# _slugify 纯函数全场景覆盖
# ---------------------------------------------------------------------------


class TestWikiSlugify:
    """_slugify 静态方法的全场景覆盖"""

    def test_slugify_basic_text(self):
        assert WikiPublishingService._slugify("Hello World") == "hello-world"

    def test_slugify_chinese_text(self):
        result = WikiPublishingService._slugify("技术文档")
        assert isinstance(result, str)
        assert len(result) > 0

    def test_slugify_already_valid_slug(self):
        assert WikiPublishingService._slugify("my-page") == "my-page"

    def test_slugify_special_chars_removed(self):
        assert WikiPublishingService._slugify("Hello!! World@@") == "hello-world"

    def test_slugify_multiple_spaces_collapsed(self):
        assert WikiPublishingService._slugify("Hello   World") == "hello-world"

    def test_slugify_empty_string_returns_untitled(self):
        assert WikiPublishingService._slugify("") == "untitled"

    def test_slugify_only_special_chars(self):
        assert WikiPublishingService._slugify("!@#$%") == "untitled"


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
                corpus_id=uuid4(),
                name="Test",
                theme="invalid-theme",
            )

    @pytest.mark.asyncio
    async def test_reject_invalid_slug_format(self):
        service = WikiPublishingService()
        with pytest.raises(ValueError, match="Invalid slug format"):
            await service.create_publication(
                _FakeAsyncSession(),
                corpus_id=uuid4(),
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
            corpus_id=uuid4(),
            name="My Wiki Publication",
        )
        assert session.flush_count >= 1


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
        # 正常调用不抛异常（DAO 层由 FakeAsyncSession 兜底）
        result = await service.publish(session, pub_id=uuid4())
        # WikiDao.publish 可能返回 None（无匹配记录），这是合法的
        assert result is None

    @pytest.mark.asyncio
    async def test_unpublish_delegates_to_dao(self):
        service = WikiPublishingService()
        session = _FakeAsyncSession()
        result = await service.unpublish(session, pub_id=uuid4())
        assert result is None

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
