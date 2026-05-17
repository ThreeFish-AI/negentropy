"""Wiki Knowledge Graph 切片服务集成测试

覆盖 :mod:`negentropy.knowledge.lifecycle.wiki_graph_service` 的核心 SQL
反查链路：

- ``wiki_publication_entries → document_id → kg_entity_mentions → entity_id``
- 节点数截断（``max_nodes`` + ``importance_score`` 排序）
- 边过滤（两端都在节点集合内）
- 空 publication / 无 KG 兜底（``status='empty'``）
- 单 entry 局部图（``get_entry_graph``）

所有测试使用真实 PostgreSQL；fixtures 在测试结束时彻底回滚（DELETE 树
形依赖避免污染下游测试）。
"""

from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

# ===================================================================
# Fixtures
#
# 说明：DocCatalog 上有 `uq_doc_catalogs_app_singleton` 唯一约束（每
# app_name 仅 1 条目录），故每个测试用唯一 app_name 隔离，避免与
# 既有数据 / 其它测试相互影响。
# ===================================================================


@pytest.fixture
def graph_app_name() -> str:
    """每个测试独立 app_name，规避 catalog 单例约束。"""
    return f"wg-test-{uuid4().hex[:12]}"


@pytest.fixture
async def graph_corpus(db_engine, graph_app_name):
    """测试用 Corpus。"""
    from negentropy.models.perception import Corpus

    factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as s:
        c = Corpus(name=f"wg-corpus-{uuid4().hex[:8]}", app_name=graph_app_name)
        s.add(c)
        await s.commit()
        cid = c.id
    yield cid
    async with factory() as s:
        obj = await s.get(Corpus, cid)
        if obj is not None:
            await s.delete(obj)
            await s.commit()


@pytest.fixture
async def graph_corpus_2(db_engine, graph_app_name):
    """第二个 Corpus（用于跨 corpus 测试）。"""
    from negentropy.models.perception import Corpus

    factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as s:
        c = Corpus(name=f"wg-corpus2-{uuid4().hex[:8]}", app_name=graph_app_name)
        s.add(c)
        await s.commit()
        cid = c.id
    yield cid
    async with factory() as s:
        obj = await s.get(Corpus, cid)
        if obj is not None:
            await s.delete(obj)
            await s.commit()


@pytest.fixture
async def graph_catalog(db_engine, graph_app_name):
    """测试用 DocCatalog。"""
    from negentropy.models.perception import DocCatalog, WikiPublication

    factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as s:
        cat = DocCatalog(
            app_name=graph_app_name,
            name=f"wg-cat-{uuid4().hex[:8]}",
            slug=f"wg-cat-{uuid4().hex[:8]}",
            visibility="INTERNAL",
            version=1,
            is_archived=False,
        )
        s.add(cat)
        await s.commit()
        cat_id = cat.id
    yield cat_id
    async with factory() as s:
        await s.execute(WikiPublication.__table__.delete().where(WikiPublication.catalog_id == cat_id))
        await s.commit()
        cat = await s.get(DocCatalog, cat_id)
        if cat is not None:
            await s.delete(cat)
            await s.commit()


@pytest.fixture
async def graph_world(db_engine, graph_corpus, graph_catalog, graph_app_name):
    """构造完整测试场景：

    Publication（published）→ 3 个 DOCUMENT entries → 3 个 documents
    → 6 个 KgEntity（其中 5 个被 mention，1 个独立）→ 6 条 KgRelation
    （其中 1 条的端点不在 mention 集合内，应被切片剔除）。
    """
    from negentropy.models.perception import (
        KgEntity,
        KgEntityMention,
        KgRelation,
        KnowledgeDocument,
        WikiPublication,
        WikiPublicationEntry,
    )

    factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
    ctx: dict[str, object] = {}

    async with factory() as s:
        # 1. Wiki Publication（published）
        pub = WikiPublication(
            catalog_id=graph_catalog,
            app_name=graph_app_name,
            name="WG Test Pub",
            slug="wg-test-pub",
            status="published",
            theme="default",
            version=2,
            publish_mode="LIVE",
            visibility="INTERNAL",
        )
        s.add(pub)
        await s.flush()
        ctx["pub_id"] = pub.id

        # 2. 三个 KnowledgeDocument（无需 DocSource：本测试聚焦 KG 切片，不走文档摄取链路）
        documents = []
        for i in range(3):
            doc = KnowledgeDocument(
                corpus_id=graph_corpus,
                app_name=graph_app_name,
                file_hash=f"{i:064d}",  # 64-char hex 占位
                original_filename=f"wg-doc-{i}.md",
                gcs_uri=f"gs://test/wg-doc-{i}.md",
                content_type="text/markdown",
                file_size=100,
                status="active",
            )
            s.add(doc)
            await s.flush()
            documents.append(doc)
        ctx["document_ids"] = [d.id for d in documents]

        # 3. WikiPublicationEntry × 3（DOCUMENT 类型）
        entries = []
        for i, doc in enumerate(documents):
            e = WikiPublicationEntry(
                publication_id=pub.id,
                document_id=doc.id,
                entry_kind="DOCUMENT",
                entry_slug=f"wg-entry-{i}",
                entry_title=f"WG Entry {i}",
                entry_path="[]",
            )
            s.add(e)
            await s.flush()
            entries.append(e)
        ctx["entry_ids"] = [e.id for e in entries]

        # 4. 6 个 KgEntity；index 0-3 与 documents 关联；4 与本 pub 无 mention；
        #    5 仅作为关系另一端（被切片剔除）。
        entities = []
        for i in range(6):
            ent = KgEntity(
                corpus_id=graph_corpus,
                app_name=graph_app_name,
                name=f"WG Entity {i}",
                canonical_name=f"wg-entity-{i}",
                entity_type=["concept", "person", "concept", "organization", "concept", "concept"][i],
                confidence=1.0,
                mention_count=i + 1,
                source_count=1,
                importance_score=0.9 - i * 0.1,  # 0.9, 0.8, 0.7, 0.6, 0.5, 0.4
                community_id=i % 3,
                is_active=True,
            )
            s.add(ent)
            await s.flush()
            entities.append(ent)
        ctx["entity_ids"] = [e.id for e in entities]

        # 5. mentions：实体 0/1/2/3 落在 documents 内；实体 4 是 "orphan"（无 mention）；
        #    实体 5 完全不与 publication 内文档关联（仅作为悬挂边的另一端）。
        for ent_idx, doc_idx in [(0, 0), (1, 0), (2, 1), (3, 2), (0, 1)]:
            m = KgEntityMention(
                entity_id=entities[ent_idx].id,
                corpus_id=graph_corpus,
                document_id=documents[doc_idx].id,
                extraction_method="llm",
                extraction_confidence=1.0,
            )
            s.add(m)

        # 6. relations：
        #    (0→1), (1→2), (2→3), (0→3)：两端都在 mention 集合内（保留）
        #    (3→4)：4 不在 mention 集合内（剔除）
        #    (3→5)：5 不在 mention 集合内（剔除）
        for src_idx, tgt_idx in [(0, 1), (1, 2), (2, 3), (0, 3), (3, 4), (3, 5)]:
            r = KgRelation(
                source_id=entities[src_idx].id,
                target_id=entities[tgt_idx].id,
                corpus_id=graph_corpus,
                app_name=graph_app_name,
                relation_type="RELATED_TO",
                weight=1.0,
                confidence=1.0,
                is_active=True,
            )
            s.add(r)

        await s.commit()

    yield ctx

    # Teardown：依赖 ondelete CASCADE 即可，但显式 DELETE 更可控。
    async with factory() as s:
        await s.execute(KgRelation.__table__.delete().where(KgRelation.corpus_id == graph_corpus))
        await s.execute(KgEntityMention.__table__.delete().where(KgEntityMention.corpus_id == graph_corpus))
        await s.execute(KgEntity.__table__.delete().where(KgEntity.corpus_id == graph_corpus))
        await s.execute(
            WikiPublicationEntry.__table__.delete().where(WikiPublicationEntry.publication_id == ctx["pub_id"])
        )
        await s.execute(WikiPublication.__table__.delete().where(WikiPublication.id == ctx["pub_id"]))
        await s.execute(KnowledgeDocument.__table__.delete().where(KnowledgeDocument.corpus_id == graph_corpus))
        await s.commit()


# ===================================================================
# 测试用例
# ===================================================================


class TestWikiGraphPublicationSlice:
    """get_publication_graph 切片正确性"""

    @pytest.mark.asyncio
    async def test_returns_none_for_unknown_publication(self, db_engine):
        from negentropy.knowledge.lifecycle import wiki_graph_service

        factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        async with factory() as s:
            result = await wiki_graph_service.get_publication_graph(s, pub_id=uuid4())
        assert result is None

    @pytest.mark.asyncio
    async def test_empty_publication_returns_empty_status(self, db_engine, graph_catalog, graph_app_name):
        """无 entries 的 publication 返回 status='empty'"""
        from negentropy.knowledge.lifecycle import wiki_graph_service
        from negentropy.models.perception import WikiPublication

        factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        async with factory() as s:
            pub = WikiPublication(
                catalog_id=graph_catalog,
                app_name=graph_app_name,
                name="Empty Pub",
                slug="empty-pub",
                status="published",
                theme="default",
                publish_mode="LIVE",
                visibility="INTERNAL",
            )
            s.add(pub)
            await s.commit()
            pid = pub.id

        async with factory() as s:
            result = await wiki_graph_service.get_publication_graph(s, pub_id=pid)
        assert result is not None
        assert result["status"] == "empty"
        assert result["nodes"] == []
        assert result["edges"] == []

    @pytest.mark.asyncio
    async def test_slice_includes_mentioned_entities_only(self, db_engine, graph_world):
        """节点集合 = 被 publication 文档 mention 的实体；entity 4/5 应被排除"""
        from negentropy.knowledge.lifecycle import wiki_graph_service

        pub_id = graph_world["pub_id"]
        entity_ids = graph_world["entity_ids"]

        factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        async with factory() as s:
            payload = await wiki_graph_service.get_publication_graph(s, pub_id=pub_id)

        assert payload is not None
        assert payload["status"] == "ok"

        node_ids = {n["id"] for n in payload["nodes"]}
        # 实体 0/1/2/3 应被 mention 且通过边连通；4/5 应被排除
        assert str(entity_ids[0]) in node_ids
        assert str(entity_ids[1]) in node_ids
        assert str(entity_ids[2]) in node_ids
        assert str(entity_ids[3]) in node_ids
        assert str(entity_ids[4]) not in node_ids
        assert str(entity_ids[5]) not in node_ids

    @pytest.mark.asyncio
    async def test_dangling_edges_are_filtered(self, db_engine, graph_world):
        """两端不全在节点集合内的边必须被剔除"""
        from negentropy.knowledge.lifecycle import wiki_graph_service

        pub_id = graph_world["pub_id"]
        entity_ids = graph_world["entity_ids"]

        factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        async with factory() as s:
            payload = await wiki_graph_service.get_publication_graph(s, pub_id=pub_id)

        node_ids = {n["id"] for n in payload["nodes"]}
        for e in payload["edges"]:
            assert e["source"] in node_ids, f"悬挂边 source={e['source']}"
            assert e["target"] in node_ids, f"悬挂边 target={e['target']}"

        # 4 条预期保留：(0→1) (1→2) (2→3) (0→3)
        # 2 条预期剔除：(3→4) (3→5)
        edge_pairs = {(e["source"], e["target"]) for e in payload["edges"]}
        for src_idx, tgt_idx in [(0, 1), (1, 2), (2, 3), (0, 3)]:
            assert (str(entity_ids[src_idx]), str(entity_ids[tgt_idx])) in edge_pairs
        for src_idx, tgt_idx in [(3, 4), (3, 5)]:
            assert (str(entity_ids[src_idx]), str(entity_ids[tgt_idx])) not in edge_pairs

    @pytest.mark.asyncio
    async def test_truncation_keeps_top_by_importance(self, db_engine, graph_world):
        """max_nodes 截断按 importance_score DESC + 剔除悬挂边后保留连通节点"""
        from negentropy.knowledge.lifecycle import wiki_graph_service

        pub_id = graph_world["pub_id"]
        entity_ids = graph_world["entity_ids"]

        factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        async with factory() as s:
            payload = await wiki_graph_service.get_publication_graph(s, pub_id=pub_id, max_nodes=2)

        assert payload is not None
        assert payload["truncated"] is True
        assert payload["total_entities"] == 4  # mention 集合大小（不算 4/5）

        # importance 排序：实体 0(0.9) > 1(0.8) > 2(0.7) > 3(0.6)
        # 截断到 2：保留 0/1
        node_ids = {n["id"] for n in payload["nodes"]}
        assert str(entity_ids[0]) in node_ids
        assert str(entity_ids[1]) in node_ids
        # 节点截断后，0→1 的边应仍保留；其它涉及被截断节点的边应消失
        edge_pairs = {(e["source"], e["target"]) for e in payload["edges"]}
        assert (str(entity_ids[0]), str(entity_ids[1])) in edge_pairs
        for src_idx, tgt_idx in [(1, 2), (2, 3), (0, 3)]:
            assert (
                str(entity_ids[src_idx]),
                str(entity_ids[tgt_idx]),
            ) not in edge_pairs

    @pytest.mark.asyncio
    async def test_entry_slugs_attached_to_node(self, db_engine, graph_world):
        """每节点 entry_slugs 应包含其被 mention 所在的 entry slug"""
        from negentropy.knowledge.lifecycle import wiki_graph_service

        pub_id = graph_world["pub_id"]
        entity_ids = graph_world["entity_ids"]

        factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        async with factory() as s:
            payload = await wiki_graph_service.get_publication_graph(s, pub_id=pub_id)

        # 实体 0 在 doc 0 + doc 1 中被 mention（即 entry 0 + entry 1）
        node_0 = next(n for n in payload["nodes"] if n["id"] == str(entity_ids[0]))
        assert set(node_0["entry_slugs"]) == {"wg-entry-0", "wg-entry-1"}
        assert node_0["mention_count_in_pub"] == 2

        # 实体 1 仅在 doc 0 中
        node_1 = next(n for n in payload["nodes"] if n["id"] == str(entity_ids[1]))
        assert node_1["entry_slugs"] == ["wg-entry-0"]
        assert node_1["mention_count_in_pub"] == 1


class TestWikiGraphEntityDetail:
    """get_publication_entity_detail 详情返回"""

    @pytest.mark.asyncio
    async def test_returns_neighbors_within_publication(self, db_engine, graph_world):
        from negentropy.knowledge.lifecycle import wiki_graph_service

        pub_id = graph_world["pub_id"]
        entity_ids = graph_world["entity_ids"]

        factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        async with factory() as s:
            payload = await wiki_graph_service.get_publication_entity_detail(s, pub_id=pub_id, entity_id=entity_ids[0])

        assert payload is not None
        assert payload["entity"]["id"] == str(entity_ids[0])
        # 实体 0 的边：0→1, 0→3，方向均为 outgoing
        neighbor_ids = {n["id"] for n in payload["neighbors"]}
        assert str(entity_ids[1]) in neighbor_ids
        assert str(entity_ids[3]) in neighbor_ids

    @pytest.mark.asyncio
    async def test_orphan_entity_returns_none(self, db_engine, graph_world):
        """实体 4 没有任何 mention → 不在 publication 范围内"""
        from negentropy.knowledge.lifecycle import wiki_graph_service

        pub_id = graph_world["pub_id"]
        entity_ids = graph_world["entity_ids"]

        factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        async with factory() as s:
            payload = await wiki_graph_service.get_publication_entity_detail(s, pub_id=pub_id, entity_id=entity_ids[4])
        assert payload is None


class TestWikiEntryGraph:
    """get_entry_graph 单 entry 局部图"""

    @pytest.mark.asyncio
    async def test_center_entities_match_entry_mentions(self, db_engine, graph_world):
        from negentropy.knowledge.lifecycle import wiki_graph_service

        entry_ids = graph_world["entry_ids"]
        entity_ids = graph_world["entity_ids"]

        # entry 0 → doc 0；doc 0 mentions 实体 0, 1
        factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        async with factory() as s:
            payload = await wiki_graph_service.get_entry_graph(s, entry_id=entry_ids[0])

        assert payload is not None
        assert payload["status"] == "ok"
        center = set(payload["center_entity_ids"])
        assert str(entity_ids[0]) in center
        assert str(entity_ids[1]) in center

    @pytest.mark.asyncio
    async def test_entry_graph_returns_empty_for_no_mention(self, db_engine, graph_world, graph_corpus, graph_app_name):
        """未被 mention 的文档关联的 entry 应返回 status='empty'"""
        from negentropy.knowledge.lifecycle import wiki_graph_service
        from negentropy.models.perception import (
            KnowledgeDocument,
            WikiPublicationEntry,
        )

        pub_id = graph_world["pub_id"]

        factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        async with factory() as s:
            doc = KnowledgeDocument(
                corpus_id=graph_corpus,
                app_name=graph_app_name,
                file_hash=f"{99:064d}",
                original_filename="no-mention.md",
                gcs_uri="gs://test/no-mention.md",
                content_type="text/markdown",
                file_size=100,
                status="active",
            )
            s.add(doc)
            await s.flush()
            entry = WikiPublicationEntry(
                publication_id=pub_id,
                document_id=doc.id,
                entry_kind="DOCUMENT",
                entry_slug="no-mention-entry",
                entry_title="No mention",
                entry_path="[]",
            )
            s.add(entry)
            await s.commit()
            entry_id = entry.id
            doc_id = doc.id

        async with factory() as s:
            payload = await wiki_graph_service.get_entry_graph(s, entry_id=entry_id)

        assert payload is not None
        assert payload["status"] == "empty"
        assert payload["nodes"] == []

        # Cleanup
        async with factory() as s:
            await s.execute(WikiPublicationEntry.__table__.delete().where(WikiPublicationEntry.id == entry_id))
            await s.execute(KnowledgeDocument.__table__.delete().where(KnowledgeDocument.id == doc_id))
            await s.commit()
