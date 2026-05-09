"""用户面 chunks 计数口径正交回归测试（集成测试，依赖真实 Postgres）。

验证 ``list_corpora`` / ``get_corpus`` / ``get_dashboard`` 三处端点对 ``Knowledge``
表的计数遵循统一口径：

  - chunk_role='child' 的 hierarchical 子分片不计（与文档详情口径一致）
  - 软删除（``KnowledgeDocument.status='deleted'``）文档对应的 chunks 不计
  - source_uri 找不到任何 doc 的孤儿 chunks 不计
  - source_uri IS NULL 的 KG 类直连知识照常计

为规避现有 conftest 中 ``db_engine`` 函数级 fixture 与 asyncpg 连接池跨事件循环
的已知边界（同文件多个 ``async def test_*`` 串跑会触发 "Future attached to a
different loop"），本文件采用「单测试函数 + 多场景子断言」模式：每个场景独立
``app_name`` 命名空间隔离，所有断言共享同一事件循环。

参考实现：``apps/negentropy/src/negentropy/knowledge/api.py``
``_user_facing_chunk_filter_clauses`` / ``_user_facing_chunk_count_subquery``。
"""

from __future__ import annotations

from uuid import UUID, uuid4

from sqlalchemy import delete

from negentropy.db import session as db_session
from negentropy.knowledge import api as knowledge_api
from negentropy.models.perception import Corpus, Knowledge, KnowledgeDocument


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
    status: str = "active",
    metadata: dict | None = None,
) -> UUID:
    async with db_session.AsyncSessionLocal() as session:
        doc = KnowledgeDocument(
            corpus_id=corpus_id,
            app_name=app_name,
            file_hash=uuid4().hex,
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


async def _cleanup(*, app_name: str) -> None:
    async with db_session.AsyncSessionLocal() as session:
        await session.execute(delete(Knowledge).where(Knowledge.app_name == app_name))
        await session.execute(delete(KnowledgeDocument).where(KnowledgeDocument.app_name == app_name))
        await session.execute(delete(Corpus).where(Corpus.app_name == app_name))
        await session.commit()


async def _scenario_hierarchical_only_parents(app: str) -> None:
    """场景 1：hierarchical 5 父 + 25 子 → 用户面 5（child 不计入）。"""
    corpus_id = await _create_corpus(app_name=app, name="c1")
    await _create_document(corpus_id=corpus_id, app_name=app, gcs_uri="gs://test/doc1.pdf")
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri="gs://test/doc1.pdf",
        metadata={"chunk_role": "parent"},
        count=5,
    )
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri="gs://test/doc1.pdf",
        metadata={"chunk_role": "child"},
        count=25,
    )

    listed = await knowledge_api.list_corpora(app_name=app)
    assert len(listed) == 1
    assert listed[0].knowledge_count == 5, (
        f"[scenario 1] hierarchical parent-only should be 5, got {listed[0].knowledge_count}"
    )
    detail = await knowledge_api.get_corpus(corpus_id=corpus_id, app_name=app)
    assert detail.knowledge_count == 5, "[scenario 1] get_corpus mismatch"
    dashboard = await knowledge_api.get_dashboard(app_name=app)
    assert dashboard.knowledge_count == 5, "[scenario 1] dashboard mismatch"


async def _scenario_non_hierarchical_all_leaf(app: str) -> None:
    """场景 2：非 hierarchical 10 leaf → 全部计入。"""
    corpus_id = await _create_corpus(app_name=app, name="c2")
    await _create_document(corpus_id=corpus_id, app_name=app, gcs_uri="gs://test/doc2.pdf")
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri="gs://test/doc2.pdf",
        metadata={},
        count=10,
    )

    listed = await knowledge_api.list_corpora(app_name=app)
    assert listed[0].knowledge_count == 10, (
        f"[scenario 2] non-hierarchical (no chunk_role) should all count, got {listed[0].knowledge_count}"
    )


async def _scenario_soft_deleted_doc_excluded(app: str) -> None:
    """场景 3（关键复刻）：active 3 父 + 软删 7 父 + 软删 35 子 → 用户面 3。

    完整复刻 Harness Engineering 「chunks: 849 vs 14」 真实根因。
    """
    corpus_id = await _create_corpus(app_name=app, name="c3")
    await _create_document(
        corpus_id=corpus_id,
        app_name=app,
        gcs_uri="gs://test/active.pdf",
        status="active",
    )
    await _create_document(
        corpus_id=corpus_id,
        app_name=app,
        gcs_uri="gs://test/deleted.pdf",
        status="deleted",
    )
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri="gs://test/active.pdf",
        metadata={"chunk_role": "parent"},
        count=3,
    )
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri="gs://test/deleted.pdf",
        metadata={"chunk_role": "parent"},
        count=7,
    )
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri="gs://test/deleted.pdf",
        metadata={"chunk_role": "child"},
        count=35,
    )

    listed = await knowledge_api.list_corpora(app_name=app)
    assert listed[0].knowledge_count == 3, (
        f"[scenario 3] only active doc parents should count, got {listed[0].knowledge_count}"
    )
    dashboard = await knowledge_api.get_dashboard(app_name=app)
    assert dashboard.knowledge_count == 3, "[scenario 3] dashboard mismatch"


async def _scenario_orphan_excluded(app: str) -> None:
    """场景 4：active 2 父 + 孤儿 20 父（source_uri 找不到任何 doc）→ 用户面 2。"""
    corpus_id = await _create_corpus(app_name=app, name="c4")
    await _create_document(corpus_id=corpus_id, app_name=app, gcs_uri="gs://test/exists.pdf")
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri="gs://test/exists.pdf",
        metadata={"chunk_role": "parent"},
        count=2,
    )
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri="gs://test/missing.pdf",
        metadata={"chunk_role": "parent"},
        count=20,
    )

    listed = await knowledge_api.list_corpora(app_name=app)
    assert listed[0].knowledge_count == 2, (
        f"[scenario 4] orphan chunks should be excluded, got {listed[0].knowledge_count}"
    )


async def _scenario_kg_null_source_included(app: str) -> None:
    """场景 5：source_uri IS NULL 的 KG 类合法直连知识照常计入。"""
    corpus_id = await _create_corpus(app_name=app, name="c5")
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri=None,
        metadata={"chunk_role": "leaf"},
        count=4,
    )

    listed = await knowledge_api.list_corpora(app_name=app)
    assert listed[0].knowledge_count == 4, (
        f"[scenario 5] KG NULL source_uri should count, got {listed[0].knowledge_count}"
    )


async def _scenario_combined_quadrants(app: str) -> None:
    """场景 6：active(3 父+18 子) + 软删(5 父+25 子) + 孤儿 7 父 + KG 2 leaf
    → 物理 60 → 用户面 5（active 父 3 + KG 2）。"""
    corpus_id = await _create_corpus(app_name=app, name="c6")
    await _create_document(
        corpus_id=corpus_id,
        app_name=app,
        gcs_uri="gs://test/active.pdf",
        status="active",
    )
    await _create_document(
        corpus_id=corpus_id,
        app_name=app,
        gcs_uri="gs://test/old.pdf",
        status="deleted",
    )
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri="gs://test/active.pdf",
        metadata={"chunk_role": "parent"},
        count=3,
    )
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri="gs://test/active.pdf",
        metadata={"chunk_role": "child"},
        count=18,
    )
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri="gs://test/old.pdf",
        metadata={"chunk_role": "parent"},
        count=5,
    )
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri="gs://test/old.pdf",
        metadata={"chunk_role": "child"},
        count=25,
    )
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri="gs://test/orphan-from-hard-delete.pdf",
        metadata={"chunk_role": "parent"},
        count=7,
    )
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri=None,
        metadata={"chunk_role": "leaf"},
        count=2,
    )

    listed = await knowledge_api.list_corpora(app_name=app)
    assert listed[0].knowledge_count == 5, (
        f"[scenario 6] expected 3 (active parents) + 2 (KG) = 5 of 60 physical rows, got {listed[0].knowledge_count}"
    )
    detail = await knowledge_api.get_corpus(corpus_id=corpus_id, app_name=app)
    assert detail.knowledge_count == 5, "[scenario 6] get_corpus mismatch"
    dashboard = await knowledge_api.get_dashboard(app_name=app)
    assert dashboard.knowledge_count == 5, "[scenario 6] dashboard mismatch"


async def test_user_facing_chunk_count_filter_quadrants():
    """串行执行 6 个场景，每个独立 app_name 命名空间，覆盖 chunks 计数全象限。"""
    base = uuid4().hex[:8]
    scenarios = [
        ("hierarchical_parents_only", _scenario_hierarchical_only_parents),
        ("non_hierarchical_leaf", _scenario_non_hierarchical_all_leaf),
        ("soft_deleted_doc_excluded", _scenario_soft_deleted_doc_excluded),
        ("orphan_excluded", _scenario_orphan_excluded),
        ("kg_null_source_included", _scenario_kg_null_source_included),
        ("combined_quadrants", _scenario_combined_quadrants),
    ]
    for tag, scenario in scenarios:
        app = f"test-cnt-{base}-{tag}"
        try:
            await scenario(app)
        finally:
            await _cleanup(app_name=app)
