"""DocumentStorageService 删除/复活路径与 Knowledge chunks 联动的集成测试。

ISSUE-078 Phase 2 验收回归：

  - 硬删：在同一事务内级联清理 chunks（杜绝 FK 意义孤儿）
  - 软删：批量给 chunks 打 ``metadata.archived=true`` + ``is_enabled=false``
    （防 RAG 检索命中已删 doc）
  - reactivation：复活 soft-deleted doc 时直接 hard delete 旧 chunks
    （让重新 ingest 写一份干净的，避免新旧 chunks 叠加）

复用既有 ``patch_db_globals`` autouse fixture 替换的全局 ``AsyncSessionLocal``，
与 ``DocumentStorageService`` 内部使用同一 session factory。受 ``db_engine``
函数级 fixture 与 asyncpg 跨事件循环边界限制，采用「单 test 函数 + 多场景子断言」模式
（与 ``test_corpus_chunk_count_filter.py`` 同范式）。

关键设计取舍：本测试**不**触发真实 GCS 调用——通过 monkeypatch
``DocumentStorageService._get_gcs_client`` 替换为 stub，让硬删路径只校验 DB 行为。
"""

from __future__ import annotations

from uuid import UUID, uuid4

from sqlalchemy import delete, select

from negentropy.db import session as db_session
from negentropy.knowledge import api as knowledge_api
from negentropy.models.perception import Corpus, Knowledge, KnowledgeDocument
from negentropy.storage.service import DocumentStorageService


class _StubGcsClient:
    """记录调用的 GCS stub；不发起真实网络请求。"""

    def __init__(self) -> None:
        self.deleted_uris: list[str] = []
        self.uploaded: list[tuple[str, bytes]] = []

    def delete(self, uri: str) -> None:
        self.deleted_uris.append(uri)

    def upload(self, *, content: bytes, gcs_path: str, content_type: str | None = None) -> str:
        _ = content_type
        self.uploaded.append((gcs_path, content))
        return f"gs://test-bucket/{gcs_path}"

    @staticmethod
    def build_gcs_path(app_name: str, corpus_id: str, filename: str) -> str:
        return f"knowledge/{app_name}/{corpus_id}/{filename}"

    @staticmethod
    def compute_hash(content: bytes) -> str:
        import hashlib

        return hashlib.sha256(content).hexdigest()


def _make_storage_service(stub: _StubGcsClient) -> DocumentStorageService:
    svc = DocumentStorageService()
    svc._gcs = stub  # type: ignore[assignment]
    return svc


async def _create_corpus(*, app_name: str, name: str) -> UUID:
    async with db_session.AsyncSessionLocal() as session:
        corpus = Corpus(name=name, app_name=app_name)
        session.add(corpus)
        await session.flush()
        await session.commit()
        return corpus.id


async def _create_document(
    *,
    corpus_id: UUID,
    app_name: str,
    gcs_uri: str,
    file_hash: str | None = None,
    status: str = "active",
    metadata: dict | None = None,
) -> UUID:
    async with db_session.AsyncSessionLocal() as session:
        doc = KnowledgeDocument(
            corpus_id=corpus_id,
            app_name=app_name,
            file_hash=file_hash or uuid4().hex,
            original_filename=gcs_uri.rsplit("/", 1)[-1],
            gcs_uri=gcs_uri,
            content_type="text/plain",
            file_size=100,
            status=status,
            metadata_=metadata or {},
        )
        session.add(doc)
        await session.flush()
        await session.commit()
        return doc.id


async def _insert_knowledge(
    *,
    corpus_id: UUID,
    app_name: str,
    source_uri: str | None,
    metadata: dict,
    count: int = 1,
) -> None:
    async with db_session.AsyncSessionLocal() as session:
        for idx in range(count):
            session.add(
                Knowledge(
                    corpus_id=corpus_id,
                    app_name=app_name,
                    content=f"chunk-{idx}",
                    source_uri=source_uri,
                    chunk_index=idx,
                    metadata_=metadata,
                )
            )
        await session.commit()


async def _count_knowledge(*, corpus_id: UUID, source_uri: str | None) -> int:
    from sqlalchemy import func

    async with db_session.AsyncSessionLocal() as session:
        if source_uri is None:
            stmt = (
                select(func.count())
                .select_from(Knowledge)
                .where(
                    Knowledge.corpus_id == corpus_id,
                    Knowledge.source_uri.is_(None),
                )
            )
        else:
            stmt = (
                select(func.count())
                .select_from(Knowledge)
                .where(
                    Knowledge.corpus_id == corpus_id,
                    Knowledge.source_uri == source_uri,
                )
            )
        result = await session.execute(stmt)
        return result.scalar() or 0


async def _fetch_knowledge_by_source(
    *,
    corpus_id: UUID,
    source_uri: str,
) -> list[Knowledge]:
    async with db_session.AsyncSessionLocal() as session:
        result = await session.execute(
            select(Knowledge).where(
                Knowledge.corpus_id == corpus_id,
                Knowledge.source_uri == source_uri,
            )
        )
        return list(result.scalars().all())


async def _cleanup(*, app_name: str) -> None:
    async with db_session.AsyncSessionLocal() as session:
        await session.execute(delete(Knowledge).where(Knowledge.app_name == app_name))
        await session.execute(delete(KnowledgeDocument).where(KnowledgeDocument.app_name == app_name))
        await session.execute(delete(Corpus).where(Corpus.app_name == app_name))
        await session.commit()


# ===================================================================
# Scenarios
# ===================================================================


async def _scenario_hard_delete_cascades(app: str, stub: _StubGcsClient) -> None:
    """硬删：在同一事务内删除 chunks 后再删除 doc 行；杜绝孤儿。"""
    corpus_id = await _create_corpus(app_name=app, name="c-hard")
    doc_id = await _create_document(corpus_id=corpus_id, app_name=app, gcs_uri="gs://test/h.pdf")
    # hierarchical 父+子 30 条 + 非 hierarchical leaf 5 条
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri="gs://test/h.pdf",
        metadata={"chunk_role": "parent"},
        count=5,
    )
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri="gs://test/h.pdf",
        metadata={"chunk_role": "child"},
        count=25,
    )
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri="gs://test/h.pdf",
        metadata={"chunk_role": "leaf"},
        count=5,
    )
    # 同 corpus 另一 doc 的 chunks 不应被误删
    other_id = await _create_document(corpus_id=corpus_id, app_name=app, gcs_uri="gs://test/other.pdf")
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri="gs://test/other.pdf",
        metadata={"chunk_role": "parent"},
        count=3,
    )

    assert await _count_knowledge(corpus_id=corpus_id, source_uri="gs://test/h.pdf") == 35

    svc = _make_storage_service(stub)
    deleted = await svc.delete_document(document_id=doc_id, corpus_id=corpus_id, app_name=app, soft_delete=False)
    assert deleted is True

    # 目标 doc 的全部 chunks 已清理
    assert await _count_knowledge(corpus_id=corpus_id, source_uri="gs://test/h.pdf") == 0
    # 邻居 doc 的 chunks 完整保留
    assert await _count_knowledge(corpus_id=corpus_id, source_uri="gs://test/other.pdf") == 3
    # doc 行也已删除（硬删）
    async with db_session.AsyncSessionLocal() as session:
        residual = await session.execute(select(KnowledgeDocument).where(KnowledgeDocument.id == doc_id))
        assert residual.scalar_one_or_none() is None
    # 邻居 doc 仍在
    async with db_session.AsyncSessionLocal() as session:
        neighbor = await session.execute(select(KnowledgeDocument).where(KnowledgeDocument.id == other_id))
        assert neighbor.scalar_one_or_none() is not None


async def _scenario_soft_delete_archives(app: str, stub: _StubGcsClient) -> None:
    """软删：chunks 仍存在，但 metadata.archived=true 与 is_enabled=false。

    对应 corpus chunks API 计数应排除该 doc（与 Phase 1 口径修正联动验证）。
    """
    corpus_id = await _create_corpus(app_name=app, name="c-soft")
    doc_id = await _create_document(corpus_id=corpus_id, app_name=app, gcs_uri="gs://test/s.pdf")
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri="gs://test/s.pdf",
        metadata={"chunk_role": "parent"},
        count=4,
    )
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri="gs://test/s.pdf",
        metadata={"chunk_role": "child"},
        count=12,
    )

    svc = _make_storage_service(stub)
    deleted = await svc.delete_document(document_id=doc_id, corpus_id=corpus_id, app_name=app, soft_delete=True)
    assert deleted is True

    # chunks 物理保留（可恢复）
    items = await _fetch_knowledge_by_source(corpus_id=corpus_id, source_uri="gs://test/s.pdf")
    assert len(items) == 16, "soft delete should keep chunks alive for recovery"
    for item in items:
        assert (item.metadata_ or {}).get("archived") is True, "every chunk must be archived"
        assert item.is_enabled is False, "every chunk must be disabled (extra defense)"

    # doc 行仍在但 status='deleted'
    async with db_session.AsyncSessionLocal() as session:
        result = await session.execute(select(KnowledgeDocument).where(KnowledgeDocument.id == doc_id))
        doc = result.scalar_one_or_none()
        assert doc is not None
        assert doc.status == "deleted"

    # corpus chunks API（Phase 1 口径）应已排除软删 doc 的 chunks
    listed = await knowledge_api.list_corpora(app_name=app)
    assert listed[0].knowledge_count == 0, (
        f"Phase 1 口径联动：软删后 user-facing count 应为 0，got {listed[0].knowledge_count}"
    )


async def _scenario_reactivation_purges_old_chunks(app: str, stub: _StubGcsClient) -> None:
    """复活已软删 doc：旧 chunks 被 hard delete 让重新 ingest 写一份干净的。"""
    corpus_id = await _create_corpus(app_name=app, name="c-reactivate")
    file_hash = uuid4().hex
    doc_id = await _create_document(
        corpus_id=corpus_id,
        app_name=app,
        gcs_uri="gs://test/r.pdf",
        file_hash=file_hash,
        status="active",
    )
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri="gs://test/r.pdf",
        metadata={"chunk_role": "parent"},
        count=3,
    )
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri="gs://test/r.pdf",
        metadata={"chunk_role": "child"},
        count=15,
    )
    assert await _count_knowledge(corpus_id=corpus_id, source_uri="gs://test/r.pdf") == 18

    svc = _make_storage_service(stub)
    # 先软删
    await svc.delete_document(document_id=doc_id, corpus_id=corpus_id, app_name=app, soft_delete=True)
    # 软删后 chunks 仍在但 archived
    assert await _count_knowledge(corpus_id=corpus_id, source_uri="gs://test/r.pdf") == 18

    # 复活：用同 hash 重新上传同一份 doc
    reactivated, is_new = await svc.upload_and_store(
        corpus_id=corpus_id,
        app_name=app,
        content=b"placeholder content",  # 真实 hash 由 stub.compute_hash 计算
        filename="r.pdf",
        content_type="text/plain",
    )
    # 注意：upload_and_store 走 file_hash 去重，这里我们手动构造的 file_hash 不会与
    # 真实 hash 匹配；为模拟「同 hash 重传」语义，本测试直接调内部 _reactivate_document
    # 路径，下面段落改用直接调用。

    # 直接调用 _reactivate_document 模拟「同 hash 重新上传 → 复活」
    async with db_session.AsyncSessionLocal() as session:
        result = await session.execute(select(KnowledgeDocument).where(KnowledgeDocument.id == doc_id))
        existing_doc = result.scalar_one_or_none()
        assert existing_doc is not None

    # _reactivate_document 是 async 内部方法
    await svc._reactivate_document(
        existing_doc=existing_doc,
        app_name=app,
        content=b"new content",
        filename="r-v2.pdf",
        content_type="text/plain",
    )

    # 复活后旧 chunks 应已被 hard delete（让 reingest 写干净的）
    remaining = await _count_knowledge(corpus_id=corpus_id, source_uri="gs://test/r.pdf")
    assert remaining == 0, f"reactivation should purge old chunks for reingest hygiene, got {remaining}"

    # doc 行已切回 active，gcs_uri 已更新
    async with db_session.AsyncSessionLocal() as session:
        result = await session.execute(select(KnowledgeDocument).where(KnowledgeDocument.id == doc_id))
        doc = result.scalar_one_or_none()
        assert doc is not None
        assert doc.status == "active"
        assert doc.original_filename == "r-v2.pdf"


async def _scenario_neighbor_corpus_isolation(app: str, stub: _StubGcsClient) -> None:
    """不同 corpus 即便 source_uri 同名，硬/软删也只影响本 corpus 的 chunks。"""
    corpus_a = await _create_corpus(app_name=app, name="c-iso-a")
    corpus_b = await _create_corpus(app_name=app, name="c-iso-b")
    same_uri = "gs://test/shared-name.pdf"

    doc_a = await _create_document(corpus_id=corpus_a, app_name=app, gcs_uri=same_uri)
    await _create_document(corpus_id=corpus_b, app_name=app, gcs_uri=same_uri)

    await _insert_knowledge(
        corpus_id=corpus_a,
        app_name=app,
        source_uri=same_uri,
        metadata={"chunk_role": "parent"},
        count=4,
    )
    await _insert_knowledge(
        corpus_id=corpus_b,
        app_name=app,
        source_uri=same_uri,
        metadata={"chunk_role": "parent"},
        count=6,
    )

    svc = _make_storage_service(stub)
    await svc.delete_document(document_id=doc_a, corpus_id=corpus_a, app_name=app, soft_delete=False)

    assert await _count_knowledge(corpus_id=corpus_a, source_uri=same_uri) == 0
    assert await _count_knowledge(corpus_id=corpus_b, source_uri=same_uri) == 6, (
        "delete_document must not cascade across corpora even with same source_uri"
    )


async def _scenario_url_doc_resolves_origin_url(app: str, stub: _StubGcsClient) -> None:
    """URL 类文档的 chunks 通过 metadata.origin_url 关联，删除路径需识别。"""
    corpus_id = await _create_corpus(app_name=app, name="c-url")
    origin = "https://example.com/article"
    doc_id = await _create_document(
        corpus_id=corpus_id,
        app_name=app,
        gcs_uri="gs://test/cached.html",  # GCS 缓存
        metadata={"source_type": "url", "origin_url": origin},
    )
    # chunks 的 source_uri 是 origin_url 而非 gcs_uri
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri=origin,
        metadata={"chunk_role": "parent"},
        count=3,
    )

    svc = _make_storage_service(stub)
    await svc.delete_document(document_id=doc_id, corpus_id=corpus_id, app_name=app, soft_delete=False)

    # source_uri 解析正确：origin_url 对应的 chunks 也被清理
    assert await _count_knowledge(corpus_id=corpus_id, source_uri=origin) == 0


# ===================================================================
# 入口测试
# ===================================================================


async def test_delete_document_chunks_cascade_quadrants(monkeypatch):
    """串行执行 5 个删除/复活联动场景，每场景独立 app_name 命名空间。"""
    base = uuid4().hex[:8]
    stub = _StubGcsClient()

    # 用一个共享的 stub 替换 _get_gcs_client，覆盖所有 DocumentStorageService 实例
    monkeypatch.setattr(
        DocumentStorageService,
        "_get_gcs_client",
        lambda self: stub,
    )

    scenarios = [
        ("hard_delete_cascades", _scenario_hard_delete_cascades),
        ("soft_delete_archives", _scenario_soft_delete_archives),
        ("reactivation_purges_old", _scenario_reactivation_purges_old_chunks),
        ("neighbor_corpus_isolation", _scenario_neighbor_corpus_isolation),
        ("url_doc_origin_url", _scenario_url_doc_resolves_origin_url),
    ]
    for tag, scenario in scenarios:
        app = f"test-cascade-{base}-{tag}"
        try:
            await scenario(app, stub)
        finally:
            await _cleanup(app_name=app)
