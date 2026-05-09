"""Phase 3 集成测试：FK CASCADE + 写入路径 + CLI 回填/清理。

ISSUE-078 Phase 3 验收回归：

  - DB 层 FK ``ON DELETE CASCADE``：直接 DELETE knowledge_documents 行时
    Knowledge 自动级联清理（即便 bypass 应用层 storage_service）
  - ORM 字段 ``Knowledge.document_id`` 可读写
  - CLI ``cleanup_orphan_knowledge``：dry-run 不落库 / commit 落库 / scope 过滤
  - count_orphan_knowledge 观测函数返回正确 per-corpus 计数

采用「单 test 函数 + 多场景子断言」模式（与 Phase 1 / Phase 2 同范式）。
"""

from __future__ import annotations

from uuid import UUID, uuid4

from sqlalchemy import delete, select, text

from negentropy.db import session as db_session
from negentropy.models.perception import Corpus, Knowledge, KnowledgeDocument
from negentropy.scripts.cleanup_orphan_knowledge import (
    _run as cleanup_run,
)
from negentropy.scripts.cleanup_orphan_knowledge import (
    count_orphan_knowledge,
)


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
            status="active",
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
    document_id: UUID | None = None,
    metadata: dict | None = None,
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
                    document_id=document_id,
                    metadata_=metadata or {},
                )
            )
        await session.commit()


async def _count(
    *,
    corpus_id: UUID,
    document_id: UUID | None = None,
    has_document_id: bool | None = None,
) -> int:
    from sqlalchemy import func

    async with db_session.AsyncSessionLocal() as session:
        stmt = select(func.count()).select_from(Knowledge).where(Knowledge.corpus_id == corpus_id)
        if document_id is not None:
            stmt = stmt.where(Knowledge.document_id == document_id)
        if has_document_id is True:
            stmt = stmt.where(Knowledge.document_id.is_not(None))
        elif has_document_id is False:
            stmt = stmt.where(Knowledge.document_id.is_(None))
        result = await session.execute(stmt)
        return result.scalar() or 0


async def _cleanup(*, app_name: str) -> None:
    async with db_session.AsyncSessionLocal() as session:
        await session.execute(delete(Knowledge).where(Knowledge.app_name == app_name))
        await session.execute(delete(KnowledgeDocument).where(KnowledgeDocument.app_name == app_name))
        await session.execute(delete(Corpus).where(Corpus.app_name == app_name))
        await session.commit()


async def _scenario_orm_field_roundtrip(app: str) -> None:
    """场景 1：ORM Knowledge.document_id 读写正确，nullable 接受 None。"""
    corpus_id = await _create_corpus(app_name=app, name="c-orm")
    doc_id = await _create_document(corpus_id=corpus_id, app_name=app, gcs_uri="gs://test/orm.pdf")

    # 显式带 document_id
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri="gs://test/orm.pdf",
        document_id=doc_id,
        metadata={"chunk_role": "parent"},
        count=2,
    )
    # 不带 document_id（KG 类）
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri=None,
        document_id=None,
        metadata={"chunk_role": "leaf"},
        count=3,
    )

    assert await _count(corpus_id=corpus_id, has_document_id=True) == 2
    assert await _count(corpus_id=corpus_id, has_document_id=False) == 3
    assert await _count(corpus_id=corpus_id, document_id=doc_id) == 2


async def _scenario_fk_cascade_db_level(app: str) -> None:
    """场景 2（核心）：DB 层 FK CASCADE — 直接 DELETE knowledge_documents 行
    会自动清理对应 Knowledge 行（无需应用层介入）。"""
    corpus_id = await _create_corpus(app_name=app, name="c-fk")
    doc_id = await _create_document(corpus_id=corpus_id, app_name=app, gcs_uri="gs://test/fk.pdf")
    other_doc_id = await _create_document(corpus_id=corpus_id, app_name=app, gcs_uri="gs://test/other.pdf")

    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri="gs://test/fk.pdf",
        document_id=doc_id,
        metadata={"chunk_role": "parent"},
        count=4,
    )
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri="gs://test/fk.pdf",
        document_id=doc_id,
        metadata={"chunk_role": "child"},
        count=20,
    )
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri="gs://test/other.pdf",
        document_id=other_doc_id,
        metadata={"chunk_role": "parent"},
        count=5,
    )

    # bypass 应用层，直接 DB 删 doc 行
    async with db_session.AsyncSessionLocal() as session:
        await session.execute(delete(KnowledgeDocument).where(KnowledgeDocument.id == doc_id))
        await session.commit()

    # 目标 doc 的 chunks 全部 CASCADE 清零
    assert await _count(corpus_id=corpus_id, document_id=doc_id) == 0
    # 邻居 doc 的 chunks 完整保留
    assert await _count(corpus_id=corpus_id, document_id=other_doc_id) == 5


async def _scenario_cli_dry_run_no_persist(app: str) -> None:
    """场景 3：dry-run 不落库——回填的 document_id 在事务回滚后消失。"""
    corpus_id = await _create_corpus(app_name=app, name="c-dry")
    # 创建 doc（仅需建立 source_uri ↔ doc 的回填映射，不需 doc_id 引用）
    await _create_document(corpus_id=corpus_id, app_name=app, gcs_uri="gs://test/dry.pdf")
    # 模拟历史孤儿：source_uri 匹配但 document_id 为 NULL
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri="gs://test/dry.pdf",
        document_id=None,
        metadata={"chunk_role": "parent"},
        count=3,
    )
    assert await _count(corpus_id=corpus_id, has_document_id=False) == 3

    report = await cleanup_run(commit=False, corpus_id=str(corpus_id), app_name=app)
    assert report["mode"] == "dry-run"
    assert report["backfilled"] == 3
    assert report["deleted"] == 0
    # 关键：dry-run 后 DB 状态未变
    assert await _count(corpus_id=corpus_id, has_document_id=False) == 3
    assert await _count(corpus_id=corpus_id, has_document_id=True) == 0


async def _scenario_cli_commit_persists(app: str) -> None:
    """场景 4：commit 落库——回填 + 删孤儿 都生效。"""
    corpus_id = await _create_corpus(app_name=app, name="c-commit")
    # 创建 doc 仅为建立回填映射
    await _create_document(corpus_id=corpus_id, app_name=app, gcs_uri="gs://test/c.pdf")
    # 可回填的（source_uri 匹配 doc，仅缺 document_id）
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri="gs://test/c.pdf",
        document_id=None,
        metadata={"chunk_role": "parent"},
        count=2,
    )
    # 真孤儿：source_uri 找不到 doc 且形态白名单
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri="gs://test/missing.pdf",
        document_id=None,
        metadata={"chunk_role": "parent"},
        count=4,
    )
    # KG 类：source_uri NULL，应保留
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri=None,
        document_id=None,
        metadata={"chunk_role": "leaf"},
        count=2,
    )

    report = await cleanup_run(commit=True, corpus_id=str(corpus_id), app_name=app)
    assert report["mode"] == "commit"
    assert report["backfilled"] == 2, f"应回填 2 条，实际 {report['backfilled']}"
    assert report["deleted"] == 4, f"应删 4 条孤儿，实际 {report['deleted']}"

    # 落库验证
    assert await _count(corpus_id=corpus_id, has_document_id=True) == 2  # 回填的
    assert await _count(corpus_id=corpus_id, has_document_id=False) == 2  # KG 类保留


async def _scenario_orphan_excludes_kg_null_source(app: str) -> None:
    """场景 5：source_uri IS NULL 的 KG 类直连知识永不被清理。"""
    corpus_id = await _create_corpus(app_name=app, name="c-kg")
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri=None,
        document_id=None,
        metadata={"chunk_role": "leaf"},
        count=5,
    )

    report = await cleanup_run(commit=True, corpus_id=str(corpus_id), app_name=app)
    assert report["deleted"] == 0, "KG 类（source_uri NULL）必须保留"
    assert await _count(corpus_id=corpus_id) == 5


async def _scenario_orphan_excludes_unknown_uri_form(app: str) -> None:
    """场景 6：source_uri 非 gs:// / http(s):// 形态不删（白名单防误伤）。"""
    corpus_id = await _create_corpus(app_name=app, name="c-weird")
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri="weird-internal-id-12345",
        document_id=None,
        metadata={},
        count=3,
    )

    report = await cleanup_run(commit=True, corpus_id=str(corpus_id), app_name=app)
    assert report["deleted"] == 0, "非白名单 source_uri 形态必须保留"
    assert await _count(corpus_id=corpus_id) == 3


async def _scenario_count_orphan_observation(app: str) -> None:
    """场景 7：count_orphan_knowledge 观测函数返回 per-corpus 计数。"""
    corpus_id = await _create_corpus(app_name=app, name="c-obs")
    # 2 条孤儿
    await _insert_knowledge(
        corpus_id=corpus_id,
        app_name=app,
        source_uri="gs://test/orphan.pdf",
        document_id=None,
        metadata={},
        count=2,
    )

    obs = await count_orphan_knowledge(app_name=app)
    assert obs["total_orphans"] == 2
    assert len(obs["per_corpus"]) == 1
    assert obs["per_corpus"][0]["orphans"] == 2
    assert obs["per_corpus"][0]["corpus_name"] == "c-obs"


async def test_phase3_fk_cli_observation_quadrants():
    """串行执行 Phase 3 全部场景，每场景独立 app_name 命名空间。"""
    base = uuid4().hex[:8]
    scenarios = [
        ("orm_field_roundtrip", _scenario_orm_field_roundtrip),
        ("fk_cascade_db_level", _scenario_fk_cascade_db_level),
        ("cli_dry_run_no_persist", _scenario_cli_dry_run_no_persist),
        ("cli_commit_persists", _scenario_cli_commit_persists),
        ("kg_null_source_preserved", _scenario_orphan_excludes_kg_null_source),
        ("unknown_uri_form_preserved", _scenario_orphan_excludes_unknown_uri_form),
        ("count_orphan_observation", _scenario_count_orphan_observation),
    ]
    for tag, scenario in scenarios:
        app = f"test-phase3-{base}-{tag}"
        try:
            await scenario(app)
        finally:
            await _cleanup(app_name=app)


async def test_migration_round_trip_safe(db_engine):
    """场景 8：alembic 0030 已 apply（前置条件）；验证 column / FK / index 都存在。"""
    async with db_engine.connect() as conn:
        col = await conn.execute(
            text(
                "SELECT column_name, is_nullable, data_type FROM information_schema.columns "
                "WHERE table_schema='negentropy' AND table_name='knowledge' AND column_name='document_id'"
            )
        )
        rows = col.fetchall()
        assert len(rows) == 1
        assert rows[0][1] == "YES", "document_id must be nullable"
        assert rows[0][2] == "uuid"

        fk = await conn.execute(
            text(
                "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint "
                "WHERE conname = 'fk_knowledge_document_id'"
            )
        )
        fk_rows = fk.fetchall()
        assert len(fk_rows) == 1
        assert "ON DELETE CASCADE" in fk_rows[0][1]
        assert "knowledge_documents(id)" in fk_rows[0][1]

        idx = await conn.execute(
            text(
                "SELECT indexname FROM pg_indexes WHERE schemaname='negentropy' "
                "AND indexname='ix_knowledge_document_id'"
            )
        )
        assert idx.fetchall(), "expected partial index ix_knowledge_document_id"
