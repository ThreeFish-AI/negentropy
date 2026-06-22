"""DocumentStorageService.update_document_display_name 的 chunk 回填单测。

mock ``AsyncSessionLocal`` 边界（不连真实库），验证：
- 设置 display_name 时：同事务对 ``negentropy.knowledge`` 做附加式 ``jsonb_set`` 回填
  （写 ``metadata.display_name``），参数化绑定用户文本（防注入），并记录 rowcount；
- 清空 display_name 时：走 ``metadata - 'display_name'`` 删键分支；
- 文档不存在时返回 None 且不触发回填；
- 库文档（corpus_id=None）路径同样走回填（匹配 0 行由 DB 决定，不影响逻辑）。
"""

from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import TextClause

from negentropy.storage.service import DocumentStorageService


class _FakeResult:
    def __init__(self, scalar=None, rowcount=0):
        self._scalar = scalar
        self.rowcount = rowcount

    def scalar_one_or_none(self):
        return self._scalar


class _FakeSession:
    """记录 execute / commit / refresh 调用的假会话。"""

    def __init__(self, scalar, rowcount=3):
        self._scalar = scalar
        self._rowcount = rowcount
        self.executes: list[tuple[object, dict | None]] = []
        self.committed = False
        self.refreshed = False

    async def execute(self, stmt, params=None):
        self.executes.append((stmt, params))
        if isinstance(stmt, TextClause):
            return _FakeResult(rowcount=self._rowcount)
        return _FakeResult(scalar=self._scalar)

    async def commit(self):
        self.committed = True

    async def refresh(self, obj):
        self.refreshed = True


class _FakeSessionCM:
    def __init__(self, session):
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, *exc):
        return False


def _make_doc(**overrides):
    base = {
        "id": uuid4(),
        "display_name": None,
        "corpus_id": None,
        "app_name": "negentropy",
        "metadata_": {},
    }
    base.update(overrides)
    return SimpleNamespace(**base)


@pytest.mark.asyncio
async def test_set_display_name_backfills_chunks_with_parameterized_jsonb_set():
    doc = _make_doc()
    session = _FakeSession(scalar=doc, rowcount=7)
    cm = _FakeSessionCM(session)

    with patch("negentropy.storage.service.AsyncSessionLocal", return_value=cm):
        svc = DocumentStorageService()
        result = await svc.update_document_display_name(document_id=doc.id, display_name="我的新名称")

    assert result is doc
    assert doc.display_name == "我的新名称"
    assert session.committed and session.refreshed

    # 两次 execute：select(KnowledgeDocument) + 回填 TextClause
    assert len(session.executes) == 2
    assert not isinstance(session.executes[0][0], TextClause)  # 首次是 select，非 text
    backfill_stmt, params = session.executes[1]
    assert isinstance(backfill_stmt, TextClause)
    sql = backfill_stmt.text
    assert "jsonb_set" in sql
    assert "{display_name}" in sql
    assert "metadata->>'document_id'" in sql
    # 参数化绑定（而非字符串拼接）——防注入与转义
    assert params == {"document_id": str(doc.id), "display_name_json": json.dumps("我的新名称")}

    # 回归守护：两个命名参数都必须被 asyncpg 方言编译为位置占位符（$N）。
    # 曾因 ``:display_name_json::jsonb`` 的 ``::cast`` 紧贴参数，SQLAlchemy 解析器
    # 未识别该参数 → asyncpg 收到字面 ``:`` → ``PostgresSyntaxError``（生产 500）。
    # 必须用 ``CAST(:param AS jsonb)`` 让参数被绑定。
    from sqlalchemy.dialects import postgresql

    compiled = str(backfill_stmt.compile(dialect=postgresql.asyncpg.dialect()))
    assert ":display_name_json" not in compiled  # 不得残留字面 ':name'
    assert ":document_id" not in compiled
    assert "$1" in compiled and "$2" in compiled  # 两者都被绑定为位置参数


@pytest.mark.asyncio
async def test_clear_display_name_uses_jsonb_delete_key_branch():
    doc = _make_doc(display_name="旧名称")
    session = _FakeSession(scalar=doc, rowcount=2)
    cm = _FakeSessionCM(session)

    with patch("negentropy.storage.service.AsyncSessionLocal", return_value=cm):
        svc = DocumentStorageService()
        result = await svc.update_document_display_name(document_id=doc.id, display_name="   ")

    assert result is doc
    assert doc.display_name is None  # 空白归一化为 None
    backfill_stmt, params = session.executes[1]
    sql = backfill_stmt.text
    assert "- 'display_name'" in sql  # 删键分支
    assert "jsonb_set" not in sql
    # 清空分支只需 document_id
    assert params == {"document_id": str(doc.id)}


@pytest.mark.asyncio
async def test_missing_document_returns_none_and_skips_backfill():
    session = _FakeSession(scalar=None)
    cm = _FakeSessionCM(session)

    with patch("negentropy.storage.service.AsyncSessionLocal", return_value=cm):
        svc = DocumentStorageService()
        result = await svc.update_document_display_name(document_id=uuid4(), display_name="x")

    assert result is None
    # 仅 select，不触发回填、不提交
    assert len(session.executes) == 1
    assert not session.committed


@pytest.mark.asyncio
async def test_library_document_still_runs_backfill_statement():
    """库文档（corpus_id=None）在逻辑上同样执行回填语句；匹配 0 行由 DB 决定。"""
    doc = _make_doc(corpus_id=None)
    session = _FakeSession(scalar=doc, rowcount=0)
    cm = _FakeSessionCM(session)

    with patch("negentropy.storage.service.AsyncSessionLocal", return_value=cm):
        svc = DocumentStorageService()
        await svc.update_document_display_name(document_id=doc.id, display_name="Library Doc")

    assert len(session.executes) == 2  # select + backfill（rowcount=0 但语句仍执行）
    assert session.committed
