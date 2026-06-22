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

from negentropy.knowledge.lifecycle.wiki_service import WikiPublishingService
from negentropy.knowledge.lifecycle_schemas import (
    WIKI_PUBLISH_TARGET_SITE_URL,
    WikiPublishActionResponse,
    WikiPublishTarget,
)

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

        monkeypatch.setattr("negentropy.knowledge.lifecycle.wiki_dao.logger.info", fake_info)

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


# ---------------------------------------------------------------------------
# publish(target=...) 双目标路由
# ---------------------------------------------------------------------------


def _fake_published_pub() -> SimpleNamespace:
    """publish() 内部访问的最小 pub 形状（LIVE 模式，跳过 _freeze_snapshot）。"""
    return SimpleNamespace(
        id=uuid4(),
        slug="demo",
        app_name="negentropy",
        publish_mode="LIVE",
    )


class TestWikiPublishTargetRouting:
    """publish(target=...) 按目标路由 fire-and-forget spawn 部署脚本。

    锁定「双目标发布」契约：
      - 缺省 / ``LOCAL`` → ``_spawn_local_wiki_rebuild``（测试环境，:3092）。
      - ``PRODUCTION`` → ``_spawn_pages_publish``（生产 threefish-ai.github.io master）。
    """

    async def _publish_with_target(
        self,
        monkeypatch,
        *,
        target: WikiPublishTarget | None,
        spawned: list[str],
    ) -> None:
        service = WikiPublishingService()
        session = _FakeAsyncSession()
        fake_pub = _fake_published_pub()

        async def fake_dao_publish(db, pub_id):
            _ = (db, pub_id)
            return fake_pub

        async def fake_redeploy(**kwargs):
            _ = kwargs
            return "dispatched"

        monkeypatch.setattr("negentropy.knowledge.lifecycle.wiki_service.WikiDao.publish", fake_dao_publish)
        monkeypatch.setattr("negentropy.knowledge.lifecycle.wiki_service.trigger_wiki_redeploy", fake_redeploy)
        monkeypatch.setattr(
            "negentropy.knowledge.lifecycle.wiki_service._spawn_local_wiki_rebuild",
            lambda: spawned.append("local"),
        )
        monkeypatch.setattr(
            "negentropy.knowledge.lifecycle.wiki_service._spawn_pages_publish",
            lambda: spawned.append("production"),
        )

        kwargs: dict[str, object] = {}
        if target is not None:
            kwargs["target"] = target
        pub, revalidation = await service.publish(session, pub_id=fake_pub.id, **kwargs)
        assert pub is fake_pub
        assert revalidation == "dispatched"

    @pytest.mark.asyncio
    async def test_default_target_routes_to_local_rebuild(self, monkeypatch):
        spawned: list[str] = []
        await self._publish_with_target(monkeypatch, target=None, spawned=spawned)
        assert spawned == ["local"]

    @pytest.mark.asyncio
    async def test_explicit_local_target_routes_to_local_rebuild(self, monkeypatch):
        spawned: list[str] = []
        await self._publish_with_target(monkeypatch, target=WikiPublishTarget.LOCAL, spawned=spawned)
        assert spawned == ["local"]

    @pytest.mark.asyncio
    async def test_production_target_routes_to_pages_publish(self, monkeypatch):
        spawned: list[str] = []
        await self._publish_with_target(monkeypatch, target=WikiPublishTarget.PRODUCTION, spawned=spawned)
        assert spawned == ["production"]


class TestWikiPublishDeploySpawn:
    """``_spawn_wiki_deploy_script`` 的脚本解析与 Popen 派发（不实际执行脚本）。"""

    def test_invokes_bash_with_resolved_script(self, monkeypatch):
        captured: dict[str, object] = {}

        class _FakePopen:
            def __init__(self, cmd, **kwargs):
                captured["cmd"] = cmd
                captured["cwd"] = kwargs.get("cwd")
                captured["start_new_session"] = kwargs.get("start_new_session")

        # _spawn_wiki_deploy_script 内部 `import subprocess` 后调用 subprocess.Popen，
        # 直接 patch subprocess 模块属性即可生效。
        import negentropy.knowledge.lifecycle.wiki_service as svc

        monkeypatch.setattr("subprocess.Popen", _FakePopen)

        svc._spawn_wiki_deploy_script(
            "scripts/build-wiki-local.sh",
            spawn_log_key="wiki_local_rebuild_spawned",
        )

        cmd = captured["cmd"]
        assert cmd[0] == "bash"
        assert str(cmd[1]).endswith("scripts/build-wiki-local.sh")
        assert captured["start_new_session"] is True

    def test_missing_script_skips_popen(self, monkeypatch):
        popen_called: list[bool] = []

        class _FakePopen:
            def __init__(self, *a, **k):
                popen_called.append(True)

        import negentropy.knowledge.lifecycle.wiki_service as svc

        monkeypatch.setattr("subprocess.Popen", _FakePopen)

        svc._spawn_wiki_deploy_script(
            "scripts/__definitely_missing__.sh",
            spawn_log_key="wiki_missing_spawned",
        )
        assert popen_called == []  # 脚本缺失时仅 WARN，不 Popen


def test_publish_action_response_carries_target_and_site_url():
    """WikiPublishActionResponse 透传 target / site_url（供前端「查看站点」）。"""
    resp = WikiPublishActionResponse(
        publication_id=uuid4(),
        status="published",
        version=2,
        published_at=None,
        entries_count=3,
        message="ok",
        target=WikiPublishTarget.PRODUCTION.value,
        site_url=WIKI_PUBLISH_TARGET_SITE_URL[WikiPublishTarget.PRODUCTION],
    )
    assert resp.target == "production"
    assert resp.site_url == "https://threefish-ai.github.io"

    # 缺省：target=local、site_url=None
    default_resp = WikiPublishActionResponse(
        publication_id=uuid4(),
        status="published",
        version=1,
        published_at=None,
        entries_count=0,
        message="ok",
    )
    assert default_resp.target == "local"
    assert default_resp.site_url is None


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

        async def fake_get_node_document_refs(db, catalog_entry_id):
            _ = db
            assert catalog_entry_id == root_node_id
            doc = SimpleNamespace(
                id=doc_id,
                original_filename="System Design.pdf",
                markdown_extract_status="completed",
                markdown_content="# System Design",
                metadata_={},
            )
            return [(doc, 0)]

        async def fake_upsert_entry(db, **kwargs):
            _ = db
            captured.update(kwargs)

        async def fake_upsert_container_entry(db, **kwargs):
            _ = (db, kwargs)  # 容器条目写入路径在 0011 后已加入；本用例只断言 DOCUMENT 行为，不捕获

        async def fake_remove_stale_entries(db, publication_id, keep_document_ids, keep_container_node_ids=None):
            _ = (db, publication_id, keep_document_ids, keep_container_node_ids)
            return 0

        monkeypatch.setattr("negentropy.knowledge.lifecycle.catalog_dao.CatalogDao.get_subtree", fake_get_subtree)
        monkeypatch.setattr(
            "negentropy.knowledge.lifecycle.catalog_dao.CatalogDao.get_node_documents", fake_get_node_documents
        )
        monkeypatch.setattr(
            "negentropy.knowledge.lifecycle.catalog_assignment_dao.CatalogAssignmentDao.get_node_document_refs",
            fake_get_node_document_refs,
        )
        monkeypatch.setattr("negentropy.knowledge.lifecycle.wiki_service.WikiDao.upsert_entry", fake_upsert_entry)
        monkeypatch.setattr(
            "negentropy.knowledge.lifecycle.wiki_service.WikiDao.upsert_container_entry", fake_upsert_container_entry
        )
        monkeypatch.setattr(
            "negentropy.knowledge.lifecycle.wiki_service.WikiDao.remove_stale_entries", fake_remove_stale_entries
        )

        result = await service.sync_entries_from_catalog(
            fake_db,
            publication_id=publication_id,
            catalog_node_ids=[root_node_id],
        )

        assert result["synced_count"] == 1
        assert captured["document_id"] == doc_id
        assert captured["entry_slug"].endswith("system-design-pdf")
        assert captured["entry_title"] == "System Design.pdf"

    @pytest.mark.asyncio
    async def test_sync_dedup_shares_slug_namespace_across_kinds(self, monkeypatch):
        """CONTAINER 与 DOCUMENT 的 entry_slug 共享同一全局唯一空间。

        回归：当 FOLDER ``eng``（CONTAINER slug=``parent/eng``）与 ``parent`` 下
        slugify 后等于 ``eng`` 的兄弟文档同时存在时，DOCUMENT 端必须复用 CONTAINER
        已登记的 ``seen_slugs`` 走 ``-2`` 后缀兜底，否则 IntegrityError 命中
        ``uq_wiki_entry_pub_slug``、整次同步事务回滚。
        """
        service = WikiPublishingService()
        publication_id = uuid4()
        parent_id = uuid4()
        eng_folder_id = uuid4()
        doc_id = uuid4()
        fake_db = _FakeAsyncSession()

        document_writes: list[dict[str, object]] = []
        container_writes: list[dict[str, object]] = []

        async def fake_get_subtree(db, node_id):
            _ = db
            assert node_id == parent_id
            return [
                {"id": parent_id, "parent_id": None, "slug": "parent", "name": "Parent", "node_type": "folder"},
                {
                    "id": eng_folder_id,
                    "parent_id": parent_id,
                    "slug": "eng",
                    "name": "Engineering",
                    "node_type": "folder",
                },
            ]

        async def fake_get_node_documents(db, catalog_node_id, limit=500):
            _ = (db, limit)
            if catalog_node_id == parent_id:
                # 兄弟文档 "eng" — slugify 后与 FOLDER `eng` 的 slug 撞车。
                doc = SimpleNamespace(
                    id=doc_id,
                    original_filename="eng",
                    markdown_extract_status="completed",
                    markdown_content="# Eng",
                    metadata_={},
                )
                return [doc], 1
            return [], 0

        async def fake_get_node_document_refs(db, catalog_entry_id):
            _ = db
            if catalog_entry_id == parent_id:
                doc = SimpleNamespace(
                    id=doc_id,
                    original_filename="eng",
                    markdown_extract_status="completed",
                    markdown_content="# Eng",
                    metadata_={},
                )
                return [(doc, 0)]
            return []

        async def fake_upsert_entry(db, **kwargs):
            _ = db
            document_writes.append(kwargs)

        async def fake_upsert_container_entry(db, **kwargs):
            _ = db
            container_writes.append(kwargs)

        async def fake_remove_stale_entries(db, publication_id, keep_document_ids, keep_container_node_ids=None):
            _ = (db, publication_id, keep_document_ids, keep_container_node_ids)
            return 0

        monkeypatch.setattr("negentropy.knowledge.lifecycle.catalog_dao.CatalogDao.get_subtree", fake_get_subtree)
        monkeypatch.setattr(
            "negentropy.knowledge.lifecycle.catalog_dao.CatalogDao.get_node_documents", fake_get_node_documents
        )
        monkeypatch.setattr(
            "negentropy.knowledge.lifecycle.catalog_assignment_dao.CatalogAssignmentDao.get_node_document_refs",
            fake_get_node_document_refs,
        )
        monkeypatch.setattr("negentropy.knowledge.lifecycle.wiki_service.WikiDao.upsert_entry", fake_upsert_entry)
        monkeypatch.setattr(
            "negentropy.knowledge.lifecycle.wiki_service.WikiDao.upsert_container_entry", fake_upsert_container_entry
        )
        monkeypatch.setattr(
            "negentropy.knowledge.lifecycle.wiki_service.WikiDao.remove_stale_entries", fake_remove_stale_entries
        )

        result = await service.sync_entries_from_catalog(
            fake_db,
            publication_id=publication_id,
            catalog_node_ids=[parent_id],
        )

        # CONTAINER 写入两条：parent / parent/eng
        container_slugs = sorted(c["entry_slug"] for c in container_writes)
        assert container_slugs == ["parent", "parent/eng"], container_slugs

        # DOCUMENT 写入应被 dedup 为 parent/eng-2（CONTAINER 已占用 parent/eng）
        assert len(document_writes) == 1
        assert document_writes[0]["entry_slug"] == "parent/eng-2", document_writes[0]
        assert document_writes[0]["document_id"] == doc_id

        # 错误流应记录 renamed 标记，便于运营可观测
        renamed_events = [e for e in result["errors"] if e.startswith("renamed:")]
        assert any(f"{doc_id}" in e and "parent/eng->" in e for e in renamed_events), result["errors"]

    @pytest.mark.asyncio
    async def test_sync_passes_node_description_to_container_entry(self, monkeypatch):
        """Catalog 节点 description 应随同步落库到 CONTAINER 条目。

        回归首页「内容主题」卡片描述缺失缺陷：此前 ``_apply_container_mappings`` 仅传
        ``entry_title`` 而丢弃 ``description``，致节点描述无法经「导航树 → API → SSG」
        抵达首页卡片。锁定描述自 ``node['description']`` 透传至 ``entry_description``。
        """
        service = WikiPublishingService()
        publication_id = uuid4()
        root_node_id = uuid4()
        fake_db = _FakeAsyncSession()
        container_writes: list[dict[str, object]] = []

        async def fake_get_subtree(db, node_id):
            _ = db
            assert node_id == root_node_id
            return [
                {
                    "id": root_node_id,
                    "parent_id": None,
                    "slug": "harness-engineering",
                    "name": "Harness Engineering",
                    "description": "智能体工程化综述",
                    "node_type": "folder",
                }
            ]

        async def fake_get_node_documents(db, catalog_node_id, limit=500):
            _ = (db, catalog_node_id, limit)
            return [], 0

        async def fake_get_node_document_refs(db, catalog_entry_id):
            _ = (db, catalog_entry_id)
            return []

        async def fake_upsert_container_entry(db, **kwargs):
            _ = db
            container_writes.append(kwargs)

        async def fake_remove_stale_entries(db, publication_id, keep_document_ids, keep_container_node_ids=None):
            _ = (db, publication_id, keep_document_ids, keep_container_node_ids)
            return 0

        monkeypatch.setattr("negentropy.knowledge.lifecycle.catalog_dao.CatalogDao.get_subtree", fake_get_subtree)
        monkeypatch.setattr(
            "negentropy.knowledge.lifecycle.catalog_dao.CatalogDao.get_node_documents", fake_get_node_documents
        )
        monkeypatch.setattr(
            "negentropy.knowledge.lifecycle.catalog_assignment_dao.CatalogAssignmentDao.get_node_document_refs",
            fake_get_node_document_refs,
        )
        monkeypatch.setattr(
            "negentropy.knowledge.lifecycle.wiki_service.WikiDao.upsert_container_entry", fake_upsert_container_entry
        )
        monkeypatch.setattr(
            "negentropy.knowledge.lifecycle.wiki_service.WikiDao.remove_stale_entries", fake_remove_stale_entries
        )

        await service.sync_entries_from_catalog(
            fake_db,
            publication_id=publication_id,
            catalog_node_ids=[root_node_id],
        )

        assert len(container_writes) == 1
        assert container_writes[0]["entry_title"] == "Harness Engineering"
        assert container_writes[0]["entry_description"] == "智能体工程化综述"


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
