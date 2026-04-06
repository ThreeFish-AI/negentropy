"""
CatalogDao 集成测试

使用真实 PostgreSQL 数据库（通过 root conftest 的 db_engine fixture）
验证 CatalogDao 的 Recursive CTE 树查询、CRUD 操作与文档归属管理。

覆盖范围：
- TestCatalogTreeCte (7 cases): 完整目录树 CTE 查询
- TestCatalogSubtreeCte (5 cases): 子树 CTE 查询
- TestCatalogCrudIntegration (5 cases): 节点 CRUD 端到端
- TestCatalogMembershipIntegration (5 cases): 文档归属生命周期
"""

from __future__ import annotations

from uuid import UUID, uuid4

import pytest

from negentropy.knowledge.catalog_dao import CatalogDao


# ===================================================================
# Fixtures — 测试数据构建
# ===================================================================


@pytest.fixture
async def sample_corpus(db_engine):
    """创建测试用语料库。"""
    from negentropy.models.perception import Corpus
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    session_factory = async_sessionmaker(
        bind=db_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        corpus = Corpus(name="test-catalog-corpus", app_name="negentropy")
        session.add(corpus)
        await session.flush()
        await session.commit()
        yield corpus
        # cleanup
        async with session_factory() as s:
            await s.delete(corpus)
            await s.commit()


@pytest.fixture
async def catalog_tree(db_engine, sample_corpus):
    """构建 3 层目录树用于 CTE 测试。

    结构::

      Root (depth=0)
      ├── Category A (depth=1)
      │   ├── SubCategory A1 (depth=2)
      │   └── SubCategory A2 (depth=2)
      └── Category B (depth=1)
    """
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    session_factory = async_sessionmaker(
        bind=db_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        root = await CatalogDao.create_node(
            session,
            corpus_id=sample_corpus.id,
            name="Root",
            slug="root",
        )
        cat_a = await CatalogDao.create_node(
            session,
            corpus_id=sample_corpus.id,
            name="Category A",
            slug="cat-a",
            parent_id=root.id,
        )
        cat_b = await CatalogDao.create_node(
            session,
            corpus_id=sample_corpus.id,
            name="Category B",
            slug="cat-b",
            parent_id=root.id,
        )
        sub_a1 = await CatalogDao.create_node(
            session,
            corpus_id=sample_corpus.id,
            name="SubCategory A1",
            slug="sub-a1",
            parent_id=cat_a.id,
        )
        sub_a2 = await CatalogDao.create_node(
            session,
            corpus_id=sample_corpus.id,
            name="SubCategory A2",
            slug="sub-a2",
            parent_id=cat_a.id,
        )
        await session.commit()

        return {
            "corpus_id": sample_corpus.id,
            "root": root,
            "cat_a": cat_a,
            "cat_b": cat_b,
            "sub_a1": sub_a1,
            "sub_a2": sub_a2,
            "session": session_factory,
        }


@pytest.fixture
async def sample_documents(db_engine, sample_corpus):
    """创建若干测试用 KnowledgeDocument 记录。"""
    from negentropy.models.perception import KnowledgeDocument
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    session_factory = async_sessionmaker(
        bind=db_engine, class_=AsyncSession, expire_on_commit=False
    )
    docs: list[KnowledgeDocument] = []
    async with session_factory() as session:
        for i in range(3):
            doc = KnowledgeDocument(
                corpus_id=sample_corpus.id,
                app_name="negentropy",
                file_hash=f"hash_{i}" * 8,
                original_filename=f"doc_{i}.pdf",
                gcs_uri=f"gs://test/doc_{i}.pdf",
                content_type="application/pdf",
                file_size=1024 * (i + 1),
            )
            session.add(doc)
            await session.flush()
            docs.append(doc)
        await session.commit()

    yield docs

    # cleanup
    async with session_factory() as s:
        for doc in docs:
            await s.delete(doc)
        await s.commit()


# ===================================================================
# TestCatalogTreeCte — 完整目录树 CTE 查询 (7 cases)
# ===================================================================


class TestCatalogTreeCte:
    """get_tree() Recursive CTE 查询的集成测试"""

    @pytest.mark.asyncio
    async def test_get_tree_flat_structure_single_root(self, db_engine, sample_corpus):
        """单根节点：depth=0，path=[root_id]"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        session_factory = async_sessionmaker(
            bind=db_engine, class_=AsyncSession, expire_on_commit=False
        )
        async with session_factory() as session:
            root = await CatalogDao.create_node(
                session,
                corpus_id=sample_corpus.id,
                name="Solo Root",
                slug="solo-root",
            )
            await session.commit()

            tree = await CatalogDao.get_tree(session, corpus_id=sample_corpus.id)

        assert len(tree) == 1
        assert tree[0]["id"] == root.id
        assert tree[0]["name"] == "Solo Root"
        assert tree[0]["slug"] == "solo-root"
        assert tree[0]["depth"] == 0
        assert tree[0]["path"] == [root.id]

    @pytest.mark.asyncio
    async def test_get_tree_two_level_hierarchy(self, db_engine, sample_corpus):
        """两层层级结构：根 depth=0，子节点 depth=1，path 累积正确"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        session_factory = async_sessionmaker(
            bind=db_engine, class_=AsyncSession, expire_on_commit=False
        )
        async with session_factory() as session:
            root = await CatalogDao.create_node(
                session,
                corpus_id=sample_corpus.id,
                name="Root",
                slug="root-2l",
            )
            child = await CatalogDao.create_node(
                session,
                corpus_id=sample_corpus.id,
                name="Child",
                slug="child-2l",
                parent_id=root.id,
            )
            await session.commit()

            tree = await CatalogDao.get_tree(session, corpus_id=sample_corpus.id)

        assert len(tree) == 2
        # 按 depth 排序：先根后子
        depths = [row["depth"] for row in tree]
        assert depths == [0, 1]

        root_row = [r for r in tree if r["depth"] == 0][0]
        child_row = [r for r in tree if r["depth"] == 1][0]

        assert root_row["id"] == root.id
        assert root_row["path"] == [root.id]

        assert child_row["id"] == child.id
        assert child_row["parent_id"] == root.id
        assert child_row["path"] == [root.id, child.id]

    @pytest.mark.asyncio
    async def test_get_tree_three_level_deep_hierarchy(self, catalog_tree):
        """三层深度树：depth/path 正确性验证"""
        from sqlalchemy.ext.asyncio import AsyncSession

        session_factory = catalog_tree["session"]
        async with session_factory() as session:
            tree = await CatalogDao.get_tree(
                session, corpus_id=catalog_tree["corpus_id"]
            )

        # 应返回全部 5 个节点
        assert len(tree) == 5

        ids_in_tree = {row["id"] for row in tree}
        expected_ids = {
            catalog_tree["root"].id,
            catalog_tree["cat_a"].id,
            catalog_tree["cat_b"].id,
            catalog_tree["sub_a1"].id,
            catalog_tree["sub_a2"].id,
        }
        assert ids_in_tree == expected_ids

        # 验证各层 depth
        by_depth: dict[int, list] = {}
        for row in tree:
            by_depth.setdefault(row["depth"], []).append(row)

        assert len(by_depth.get(0, [])) == 1  # Root
        assert len(by_depth.get(1, [])) == 2  # Category A, B
        assert len(by_depth.get(2, [])) == 2  # SubCategory A1, A2

        # 验证 path 累积
        sub_a1_row = [r for r in tree if r["id"] == catalog_tree["sub_a1"].id][0]
        assert sub_a1_row["depth"] == 2
        assert sub_a1_row["path"] == [
            catalog_tree["root"].id,
            catalog_tree["cat_a"].id,
            catalog_tree["sub_a1"].id,
        ]

    @pytest.mark.asyncio
    async def test_get_tree_multiple_roots(self, db_engine, sample_corpus):
        """多个根节点（parent_id=None）应全部出现在结果中"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        session_factory = async_sessionmaker(
            bind=db_engine, class_=AsyncSession, expire_on_commit=False
        )
        async with session_factory() as session:
            r1 = await CatalogDao.create_node(
                session,
                corpus_id=sample_corpus.id,
                name="Root Alpha",
                slug="root-alpha",
            )
            r2 = await CatalogDao.create_node(
                session,
                corpus_id=sample_corpus.id,
                name="Root Beta",
                slug="root-beta",
            )
            await session.commit()

            tree = await CatalogDao.get_tree(session, corpus_id=sample_corpus.id)

        assert len(tree) == 2
        root_ids = {row["id"] for row in tree if row["depth"] == 0}
        assert root_ids == {r1.id, r2.id}

    @pytest.mark.asyncio
    async def test_get_tree_empty_corpus_returns_empty_list(self, db_engine, sample_corpus):
        """空语料库（无任何节点）应返回空列表"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        session_factory = async_sessionmaker(
            bind=db_engine, class_=AsyncSession, expire_on_commit=False
        )
        async with session_factory() as session:
            tree = await CatalogDao.get_tree(session, corpus_id=sample_corpus.id)

        assert tree == []

    @pytest.mark.asyncio
    async def test_get_tree_respects_max_depth(self, catalog_tree):
        """max_depth=1 应仅返回根和第一层子节点，排除第二层"""
        from sqlalchemy.ext.asyncio import AsyncSession

        session_factory = catalog_tree["session"]
        async with session_factory() as session:
            tree = await CatalogDao.get_tree(
                session,
                corpus_id=catalog_tree["corpus_id"],
                max_depth=1,
            )

        # 仅 Root(0) + CatA(1) + CatB(1)，排除 SubA1/SubA2(depth=2)
        assert len(tree) == 3
        depths = {row["depth"] for row in tree}
        assert depths == {0, 1}

    @pytest.mark.asyncio
    async def test_get_tree_ordering_by_depth_then_sort_order(self, catalog_tree):
        """排序规则：先按 depth 升序，再按 sort_order 升序，最后按 name 升序"""
        from sqlalchemy.ext.asyncio import AsyncSession

        session_factory = catalog_tree["session"]
        async with session_factory() as session:
            tree = await CatalogDao.get_tree(
                session, corpus_id=catalog_tree["corpus_id"]
        )

        # 提取排序键用于断言
        order_keys = [(row["depth"], row["sort_order"], row["name"]) for row in tree]
        # 验证列表已按此顺序排列
        assert order_keys == sorted(order_keys)


# ===================================================================
# TestCatalogSubtreeCte — 子树 CTE 查询 (5 cases)
# ===================================================================


class TestCatalogSubtreeCte:
    """get_subtree() 子树查询的集成测试"""

    @pytest.mark.asyncio
    async def test_get_subtree_single_node(self, catalog_tree):
        """叶子节点作为锚点：仅返回自身，depth=0"""
        from sqlalchemy.ext.asyncio import AsyncSession

        session_factory = catalog_tree["session"]
        leaf_id = catalog_tree["sub_a1"].id
        async with session_factory() as session:
            subtree = await CatalogDao.get_subtree(session, node_id=leaf_id)

        assert len(subtree) == 1
        assert subtree[0]["id"] == leaf_id
        assert subtree[0]["depth"] == 0
        assert subtree[0]["path"] == [leaf_id]

    @pytest.mark.asyncio
    async def test_get_subtree_with_children(self, catalog_tree):
        """带子节点的锚点：anchor depth=0，children depth=1"""
        from sqlalchemy.ext.asyncio import AsyncSession

        session_factory = catalog_tree["session"]
        anchor_id = catalog_tree["cat_a"].id
        async with session_factory() as session:
            subtree = await CatalogDao.get_subtree(session, node_id=anchor_id)

        # CatA + SubA1 + SubA2
        assert len(subtree) == 3

        anchor_row = [r for r in subtree if r["id"] == anchor_id][0]
        assert anchor_row["depth"] == 0

        children_rows = [r for r in subtree if r["depth"] == 1]
        assert len(children_rows) == 2
        child_ids = {r["id"] for r in children_rows}
        assert child_ids == {
            catalog_tree["sub_a1"].id,
            catalog_tree["sub_a2"].id,
        }

    @pytest.mark.asyncio
    async def test_get_subtree_excludes_siblings(self, catalog_tree):
        """子树查询应排除兄弟节点（如 CatB 不在 CatA 的子树中）"""
        from sqlalchemy.ext.asyncio import AsyncSession

        session_factory = catalog_tree["session"]
        anchor_id = catalog_tree["cat_a"].id
        async with session_factory() as session:
            subtree = await CatalogDao.get_subtree(session, node_id=anchor_id)

        subtree_ids = {row["id"] for row in subtree}
        # CatB 是兄弟节点，不应出现
        assert catalog_tree["cat_b"].id not in subtree_ids
        # Root 是父节点，也不应在子树中
        assert catalog_tree["root"].id not in subtree_ids

    @pytest.mark.asyncio
    async def test_get_subtree_max_depth_limitation(self, catalog_tree):
        """max_depth 应限制子树返回深度"""
        from sqlalchemy.ext.asyncio import AsyncSession

        session_factory = catalog_tree["session"]
        anchor_id = catalog_tree["cat_a"].id
        async with session_factory() as session:
            subtree = await CatalogDao.get_subtree(
                session, node_id=anchor_id, max_depth=0
            )

        # max_depth=0 → 仅锚点自身
        assert len(subtree) == 1
        assert subtree[0]["id"] == anchor_id
        assert subtree[0]["depth"] == 0

    @pytest.mark.asyncio
    async def test_get_subtree_nonexistent_node_returns_empty(self, db_engine, sample_corpus):
        """不存在的节点 ID 应返回空列表"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        session_factory = async_sessionmaker(
            bind=db_engine, class_=AsyncSession, expire_on_commit=False
        )
        fake_id = uuid4()
        async with session_factory() as session:
            subtree = await CatalogDao.get_subtree(session, node_id=fake_id)

        assert subtree == []


# ===================================================================
# TestCatalogCrudIntegration — 节点 CRUD 端到端 (5 cases)
# ===================================================================


class TestCatalogCrudIntegration:
    """CatalogDao 节点 CRUD 操作的端到端集成测试"""

    @pytest.mark.asyncio
    async def test_create_and_retrieve_node_roundtrip(self, db_engine, sample_corpus):
        """创建节点后通过 get_node 取回，字段一致"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        session_factory = async_sessionmaker(
            bind=db_engine, class_=AsyncSession, expire_on_commit=False
        )
        async with session_factory() as session:
            created = await CatalogDao.create_node(
                session,
                corpus_id=sample_corpus.id,
                name="Roundtrip Node",
                slug="roundtrip-node",
                parent_id=None,
                node_type="collection",
                description="Test description",
                sort_order=42,
                config={"key": "value"},
            )
            await session.commit()

        # 新开 session 验证持久化
        async with session_factory() as session:
            fetched = await CatalogDao.get_node(session, created.id)

        assert fetched is not None
        assert fetched.id == created.id
        assert fetched.name == "Roundtrip Node"
        assert fetched.slug == "roundtrip-node"
        assert fetched.node_type == "collection"
        assert fetched.description == "Test description"
        assert fetched.sort_order == 42
        assert fetched.config == {"key": "value"}

    @pytest.mark.asyncio
    async def test_update_node_partial_update(self, db_engine, sample_corpus):
        """update_node 仅修改指定字段，未指定字段保持不变"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        session_factory = async_sessionmaker(
            bind=db_engine, class_=AsyncSession, expire_on_commit=False
        )
        async with session_factory() as session:
            node = await CatalogDao.create_node(
                session,
                corpus_id=sample_corpus.id,
                name="Original Name",
                slug="original-slug",
                sort_order=5,
            )
            await session.commit()

        async with session_factory() as session:
            updated = await CatalogDao.update_node(
                session,
                node_id=node.id,
                name="Updated Name",
                sort_order=99,
            )
            await session.commit()

        assert updated is not None
        assert updated.name == "Updated Name"
        assert updated.sort_order == 99
        # 未更新的字段保持原值
        assert updated.slug == "original-slug"

    @pytest.mark.asyncio
    async def test_delete_node_cascades_children(self, db_engine, sample_corpus):
        """删除父节点后，子节点应被级联删除"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        session_factory = async_sessionmaker(
            bind=db_engine, class_=AsyncSession, expire_on_commit=False
        )
        async with session_factory() as session:
            parent = await CatalogDao.create_node(
                session,
                corpus_id=sample_corpus.id,
                name="Parent",
                slug="cascade-parent",
            )
            child = await CatalogDao.create_node(
                session,
                corpus_id=sample_corpus.id,
                name="Child",
                slug="cascade-child",
                parent_id=parent.id,
            )
            await session.commit()

        # 删除父节点
        async with session_factory() as session:
            result = await CatalogDao.delete_node(session, parent.id)
            await session.commit()

        assert result is True

        # 验证父子均不可查到
        async with session_factory() as session:
            parent_gone = await CatalogDao.get_node(session, parent.id)
            child_gone = await CatalogDao.get_node(session, child.id)

        assert parent_gone is None
        assert child_gone is None

    @pytest.mark.asyncio
    async def test_create_node_with_parent_sets_parent_id(self, db_engine, sample_corpus):
        """创建带 parent_id 的节点应正确设置外键关系"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        session_factory = async_sessionmaker(
            bind=db_engine, class_=AsyncSession, expire_on_commit=False
        )
        async with session_factory() as session:
            parent = await CatalogDao.create_node(
                session,
                corpus_id=sample_corpus.id,
                name="Parent Node",
                slug="parent-node",
            )
            child = await CatalogDao.create_node(
                session,
                corpus_id=sample_corpus.id,
                name="Child Node",
                slug="child-node",
                parent_id=parent.id,
            )
            await session.commit()

        assert child.parent_id == parent.id

        # 通过 get_node 验证关系可追溯
        async with session_factory() as session:
            fetched_child = await CatalogDao.get_node(session, child.id)

        assert fetched_child is not None
        assert fetched_child.parent_id == parent.id

    @pytest.mark.asyncio
    async def test_delete_nonexistent_node_returns_false(self, db_engine, sample_corpus):
        """删除不存在的节点应幂等返回 False"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        session_factory = async_sessionmaker(
            bind=db_engine, class_=AsyncSession, expire_on_commit=False
        )
        fake_id = uuid4()
        async with session_factory() as session:
            result = await CatalogDao.delete_node(session, fake_id)

        assert result is False


# ===================================================================
# TestCatalogMembershipIntegration — 文档归属生命周期 (5 cases)
# ===================================================================


class TestCatalogMembershipIntegration:
    """CatalogDao 文档归属管理的端到端集成测试"""

    @pytest.mark.asyncio
    async def test_assign_and_unassign_document_lifecycle(
        self, db_engine, sample_corpus, catalog_tree, sample_documents
    ):
        """完整的 assign -> verify -> unassign -> verify 生命周期"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        session_factory = async_sessionmaker(
            bind=db_engine, class_=AsyncSession, expire_on_commit=False
        )
        node_id = catalog_tree["cat_a"].id
        doc_id = sample_documents[0].id

        # 1. assign
        async with session_factory() as session:
            membership = await CatalogDao.assign_document(
                session,
                catalog_node_id=node_id,
                document_id=doc_id,
            )
            await session.commit()

        assert membership.catalog_node_id == node_id
        assert membership.document_id == doc_id

        # 2. verify assignment exists via get_node_documents
        async with session_factory() as session:
            docs, total = await CatalogDao.get_node_documents(
                session, catalog_node_id=node_id
            )

        assert total >= 1

        # 3. unassign
        async with session_factory() as session:
            removed = await CatalogDao.unassign_document(
                session,
                catalog_node_id=node_id,
                document_id=doc_id,
            )
            await session.commit()

        assert removed is True

        # 4. verify removal
        async with session_factory() as session:
            docs_after, total_after = await CatalogDao.get_node_documents(
                session, catalog_node_id=node_id
            )

        assert total_after < total

    @pytest.mark.asyncio
    async def test_assign_duplicate_is_idempotent(
        self, db_engine, sample_corpus, catalog_tree, sample_documents
    ):
        """重复 assign 同一文档不应报错，应返回已有记录"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        session_factory = async_sessionmaker(
            bind=db_engine, class_=AsyncSession, expire_on_commit=False
        )
        node_id = catalog_tree["cat_b"].id
        doc_id = sample_documents[1].id

        async with session_factory() as session:
            first = await CatalogDao.assign_document(
                session,
                catalog_node_id=node_id,
                document_id=doc_id,
            )
            await session.commit()

        async with session_factory() as session:
            second = await CatalogDao.assign_document(
                session,
                catalog_node_id=node_id,
                document_id=doc_id,
            )
            await session.commit()

        # 幂等：两次 assign 返回的 membership ID 应相同
        assert first.id == second.id

    @pytest.mark.asyncio
    async def test_get_node_documents_pagination(
        self, db_engine, sample_corpus, catalog_tree, sample_documents
    ):
        """分页参数 offset/limit 应生效"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        session_factory = async_sessionmaker(
            bind=db_engine, class_=AsyncSession, expire_on_commit=False
        )
        node_id = catalog_tree["root"].id

        # 将所有文档分配到同一节点
        async with session_factory() as session:
            for doc in sample_documents:
                await CatalogDao.assign_document(
                    session,
                    catalog_node_id=node_id,
                    document_id=doc.id,
                )
            await session.commit()

        # 分页取第 1 条
        async with session_factory() as session:
            page1, _ = await CatalogDao.get_node_documents(
                session, catalog_node_id=node_id, offset=0, limit=1
            )

        assert len(page1) == 1

        # 分页取第 2 条
        async with session_factory() as session:
            page2, _ = await CatalogDao.get_node_documents(
                session, catalog_node_id=node_id, offset=1, limit=1
            )

        assert len(page2) == 1
        # 两页的文档应不同
        assert page1[0].id != page2[0].id

    @pytest.mark.asyncio
    async def test_get_node_documents_total_count(
        self, db_engine, sample_corpus, catalog_tree, sample_documents
    ):
        """total count 不受 offset/limit 影响，始终返回总数"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        session_factory = async_sessionmaker(
            bind=db_engine, class_=AsyncSession, expire_on_commit=False
        )
        node_id = catalog_tree["cat_a"].id

        async with session_factory() as session:
            for doc in sample_documents:
                await CatalogDao.assign_document(
                    session,
                    catalog_node_id=node_id,
                    document_id=doc.id,
                )
            await session.commit()

        # 不同分页参数下的 total 应一致
        async with session_factory() as session:
            _, total_full = await CatalogDao.get_node_documents(
                session, catalog_node_id=node_id, offset=0, limit=50
            )
            _, total_paged = await CatalogDao.get_node_documents(
                session, catalog_node_id=node_id, offset=1, limit=1
            )

        assert total_full == total_paged
        assert total_full == len(sample_documents)

    @pytest.mark.asyncio
    async def test_get_document_nodes_multi_membership(
        self, db_engine, sample_corpus, catalog_tree, sample_documents
    ):
        """同一文档属于多个目录节点时，get_document_nodes 应返回所有关联节点"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        session_factory = async_sessionmaker(
            bind=db_engine, class_=AsyncSession, expire_on_commit=False
        )
        doc_id = sample_documents[0].id
        target_nodes = [catalog_tree["cat_a"].id, catalog_tree["cat_b"].id]

        async with session_factory() as session:
            for node_id in target_nodes:
                await CatalogDao.assign_document(
                    session,
                    catalog_node_id=node_id,
                    document_id=doc_id,
                )
            await session.commit()

        async with session_factory() as session:
            nodes = await CatalogDao.get_document_nodes(session, document_id=doc_id)

        returned_ids = {n.id for n in nodes}
        assert returned_ids == set(target_nodes)
        assert len(nodes) == 2
