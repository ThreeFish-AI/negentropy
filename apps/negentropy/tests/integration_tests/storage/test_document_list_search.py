"""DocumentStorageService.list_documents 的 search 过滤 DB 集成测试。

覆盖新增的「名称 + 作者」模糊搜索（service.py）：
- 名称命中 ``original_filename`` / ``display_name``（直接 ILIKE，大小写不敏感）；
- 作者命中：``created_by`` 存的是 user_id，须经 ``user_states.state.profile.name``
  参数化 JSONB 子查询反解为 user_id 集合再过滤（本次改动的核心新逻辑）；
- 空 search 保留无过滤的既有语义（向后兼容）；
- count 与 items 在过滤下保持一致（共享 conditions 列表）。

隔离策略：使用唯一 ``app_name`` 避免测试库跨 session 累积干扰（见 test-db-accumulates）；
显式 patch ``negentropy.storage.service.AsyncSessionLocal``——service 模块 import 期即绑定该名，
conftest 仅 patch ``db_session.AsyncSessionLocal`` 无法覆盖（见 service-asyncsessionlocal-ci-cross-loop）。
"""

from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from negentropy.models.perception import KnowledgeDocument
from negentropy.models.state import UserState
from negentropy.storage.service import DocumentStorageService


def _make_doc(
    app_name: str, *, original_filename: str, created_by: str | None = None, display_name: str | None = None
) -> KnowledgeDocument:
    """构建满足 NOT NULL 约束的库文档（corpus_id=None）ORM 行。"""
    return KnowledgeDocument(
        corpus_id=None,
        app_name=app_name,
        file_hash=uuid4().hex,
        original_filename=original_filename,
        display_name=display_name,
        content_uri=f"pgblob://test/{uuid4().hex}",
        content_type="application/pdf",
        file_size=1024,
        status="active",
        created_by=created_by,
        markdown_extract_status="completed",
    )


@pytest.fixture
async def seeded_docs(db_engine, monkeypatch):
    """播种唯一 app_name 下的文档 + 用户状态，并将 service 的 AsyncSessionLocal 指向测试引擎。

    产出 (app_name, session_factory)；teardown 清理本 app_name 的全部文档与用户状态。
    """
    app_name = f"search-it-{uuid4().hex[:8]}"
    session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)

    # service.py 于 import 期 `from ...session import AsyncSessionLocal` 绑定本地名，
    # 须直接 patch service 模块属性（conftest 的 db_session patch 不覆盖此本地引用）。
    monkeypatch.setattr("negentropy.storage.service.AsyncSessionLocal", session_factory)

    author_user_id = f"user-{uuid4().hex[:8]}"
    docs = [
        _make_doc(app_name, original_filename="Attention Is All You Need.pdf"),
        _make_doc(app_name, original_filename="loop-engineering.pdf", display_name="Loop Engineering IEEE"),
        _make_doc(app_name, original_filename="misc-notes.pdf", created_by=author_user_id),
    ]
    async with session_factory() as s:
        # 作者显示名：user_states.state.profile.name（供作者维度反解命中）。
        s.add(UserState(user_id=author_user_id, app_name=app_name, state={"profile": {"name": "Chao Ming Huang"}}))
        for d in docs:
            s.add(d)
        await s.commit()

    yield app_name, author_user_id

    async with session_factory() as s:
        from sqlalchemy import delete

        await s.execute(delete(KnowledgeDocument).where(KnowledgeDocument.app_name == app_name))
        await s.execute(delete(UserState).where(UserState.app_name == app_name))
        await s.commit()


@pytest.mark.asyncio
async def test_search_matches_original_filename(seeded_docs):
    """名称维度：按 original_filename 子串大小写不敏感命中。"""
    app_name, _ = seeded_docs
    svc = DocumentStorageService()

    docs, total = await svc.list_documents(app_name=app_name, search="attention")

    assert total == 1
    assert len(docs) == 1
    assert docs[0].original_filename == "Attention Is All You Need.pdf"


@pytest.mark.asyncio
async def test_search_matches_display_name(seeded_docs):
    """名称维度：按用户改名后的 display_name 命中。"""
    app_name, _ = seeded_docs
    svc = DocumentStorageService()

    docs, total = await svc.list_documents(app_name=app_name, search="loop engineering")

    assert total == 1
    assert docs[0].display_name == "Loop Engineering IEEE"


@pytest.mark.asyncio
async def test_search_matches_author_name_via_user_states(seeded_docs):
    """作者维度（核心新逻辑）：按 user_states 显示名反解命中 created_by 文档。"""
    app_name, author_user_id = seeded_docs
    svc = DocumentStorageService()

    docs, total = await svc.list_documents(app_name=app_name, search="chao ming")

    assert total == 1
    assert docs[0].created_by == author_user_id
    assert docs[0].original_filename == "misc-notes.pdf"


@pytest.mark.asyncio
async def test_empty_search_returns_all(seeded_docs):
    """空 search 等价无过滤：返回该 app 下全部三条（向后兼容）。"""
    app_name, _ = seeded_docs
    svc = DocumentStorageService()

    docs, total = await svc.list_documents(app_name=app_name, search="")

    assert total == 3
    assert len(docs) == 3


@pytest.mark.asyncio
async def test_search_no_match_returns_empty(seeded_docs):
    """无命中：count 与 items 一致地归零（共享 conditions）。"""
    app_name, _ = seeded_docs
    svc = DocumentStorageService()

    docs, total = await svc.list_documents(app_name=app_name, search="zzz-nonexistent-zzz")

    assert total == 0
    assert docs == []
