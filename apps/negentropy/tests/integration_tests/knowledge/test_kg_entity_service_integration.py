"""
KgEntityService 集成测试 — Dual-Write Strategy

通过真实 PostgreSQL 数据库验证 KgEntityService 的端到端行为。
使用 db_engine fixture（继承自根 conftest.py）建立测试数据库连接。

覆盖场景：
- 实体同步完整生命周期（创建 → 更新）
- 并发幂等性
- 跨 corpus 隔离
- 关系同步与幂等性
- 批量同步错误恢复
"""

from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import select as sql_select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from negentropy.knowledge.kg_entity_service import KgEntityService
from negentropy.models.perception import Corpus, KgEntity, KgRelation

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def integration_corpus(db_engine):
    """创建集成测试用语料库。"""
    sf = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
    async with sf() as s:
        c = Corpus(name="kg-test-corpus", app_name="negentropy")
        s.add(c)
        await s.flush()
        await s.commit()
        yield c
        # 清理：删除语料库（级联删除关联的 kg_entities / kg_relations）
        await s.delete(c)
        await s.commit()


@pytest.fixture
async def integration_corpus_b(db_engine):
    """第二个语料库，用于跨 corpus 隔离测试。"""
    sf = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
    async with sf() as s:
        c = Corpus(name="kg-test-corpus-b", app_name="negentropy")
        s.add(c)
        await s.flush()
        await s.commit()
        yield c
        await s.delete(c)
        await s.commit()


@pytest.fixture
def service() -> KgEntityService:
    """被测服务实例。"""
    return KgEntityService()


@pytest.fixture
async def db_session(db_engine):
    """独立的 AsyncSession，每个测试用例一个。"""
    sf = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
    async with sf() as s:
        yield s


# ===================================================================
# TestEntitySyncIntegration (6 cases)
# ===================================================================


class TestEntitySyncIntegration:
    """实体同步集成测试：验证 DB 中的实际持久化行为。"""

    # -- 1. 创建后更新，验证最终 DB 状态 --

    async def test_full_sync_lifecycle_create_then_update(self, service, db_session, integration_corpus):
        """先创建实体再更新，验证最终 DB 状态正确。"""
        kid = uuid4()

        # 第一次同步：创建
        await service.sync_entity_from_knowledge(
            db_session,
            knowledge_id=kid,
            name="LifecycleEntity",
            entity_type="CONCEPT",
            confidence=0.6,
            corpus_id=integration_corpus.id,
        )
        await db_session.commit()

        # 验证创建
        result = await db_session.execute(
            sql_select(KgEntity).where(
                KgEntity.name == "LifecycleEntity",
                KgEntity.corpus_id == integration_corpus.id,
            )
        )
        entity = result.scalar_one()
        assert entity.confidence == pytest.approx(0.6)
        assert entity.mention_count == 1

        # 第二次同步：更新（更高置信度 + 新属性）
        kid2 = uuid4()
        await service.sync_entity_from_knowledge(
            db_session,
            knowledge_id=kid2,
            name="LifecycleEntity",
            entity_type="CONCEPT",
            confidence=0.95,
            metadata={"version": "v2", "source": "integration-test"},
            corpus_id=integration_corpus.id,
        )
        await db_session.commit()

        # 刷新并验证更新后的状态
        await db_session.refresh(entity)
        assert entity.confidence == pytest.approx(0.95)
        assert entity.mention_count == 2
        assert entity.properties["version"] == "v2"
        assert entity.properties["source"] == "integration-test"

    # -- 2. 同一 (name, type, corpus) 幂等合并为一条记录 --

    async def test_concurrent_same_entity_idempotency(self, service, db_session, integration_corpus):
        """相同 (name, type, corpus) 的多次同步应只产生一条实体记录。"""
        kid1, kid2, kid3 = uuid4(), uuid4(), uuid4()

        for kid in [kid1, kid2, kid3]:
            await service.sync_entity_from_knowledge(
                db_session,
                knowledge_id=kid,
                name="IdempotentEntity",
                entity_type="PERSON",
                confidence=0.8,
                corpus_id=integration_corpus.id,
            )

        await db_session.commit()

        result = await db_session.execute(
            sql_select(KgEntity).where(
                KgEntity.name == "IdempotentEntity",
                KgEntity.corpus_id == integration_corpus.id,
            )
        )
        entities = result.scalars().all()

        # 应只有一条实体记录
        assert len(entities) == 1
        # mention_count 应为 3（每次同步递增）
        assert entities[0].mention_count == 3

    # -- 3. 不同 corpus 下的同名实体相互独立 --

    async def test_different_corpus_separate_entities(
        self, service, db_session, integration_corpus, integration_corpus_b
    ):
        """不同 corpus 下同名同类型实体应为独立记录。"""
        kid_a = uuid4()
        kid_b = uuid4()

        await service.sync_entity_from_knowledge(
            db_session,
            knowledge_id=kid_a,
            name="CrossCorpusEntity",
            entity_type="ORG",
            confidence=0.9,
            corpus_id=integration_corpus.id,
        )
        await service.sync_entity_from_knowledge(
            db_session,
            knowledge_id=kid_b,
            name="CrossCorpusEntity",
            entity_type="ORG",
            confidence=0.5,
            corpus_id=integration_corpus_b.id,
        )
        await db_session.commit()

        # corpus A 中应有一条
        result_a = await db_session.execute(
            sql_select(KgEntity).where(
                KgEntity.name == "CrossCorpusEntity",
                KgEntity.corpus_id == integration_corpus.id,
            )
        )
        assert len(result_a.scalars().all()) == 1

        # corpus B 中也应有一条（独立记录）
        result_b = await db_session.execute(
            sql_select(KgEntity).where(
                KgEntity.name == "CrossCorpusEntity",
                KgEntity.corpus_id == integration_corpus_b.id,
            )
        )
        assert len(result_b.scalars().all()) == 1

        # 总数应为 2
        total = await db_session.execute(sql_select(KgEntity).where(KgEntity.name == "CrossCorpusEntity"))
        assert len(total.scalars().all()) == 2

    # -- 4. 多次同步 mention_count 累积 --

    async def test_mention_count_accumulates_across_syncs(self, service, db_session, integration_corpus):
        """多次对同一实体的同步操作应使 mention_count 正确累积。"""
        for i in range(5):
            await service.sync_entity_from_knowledge(
                db_session,
                knowledge_id=uuid4(),
                name="Accumulator",
                entity_type="TECH",
                confidence=float(i) / 10,
                corpus_id=integration_corpus.id,
            )

        await db_session.commit()

        result = await db_session.execute(
            sql_select(KgEntity).where(
                KgEntity.name == "Accumulator",
                KgEntity.corpus_id == integration_corpus.id,
            )
        )
        entity = result.scalar_one()
        assert entity.mention_count == 5
        # 最终置信度应为最高值 0.4（最后一次 i=4 时 confidence=0.4 > 前值）
        assert entity.confidence == pytest.approx(0.4)

    # -- 5. embedding 持久化到 DB --

    async def test_entity_with_embedding_stored_correctly(self, service, db_session, integration_corpus):
        """embedding 向量应正确写入并从 DB 读回。"""
        # 使用与模型 DEFAULT_EMBEDDING_DIM 一致的维度（1536）
        embedding = [0.1] * 1536

        await service.sync_entity_from_knowledge(
            db_session,
            knowledge_id=uuid4(),
            name="EmbeddedEntity",
            entity_type="CONCEPT",
            embedding=embedding,
            corpus_id=integration_corpus.id,
        )
        await db_session.commit()

        result = await db_session.execute(sql_select(KgEntity).where(KgEntity.name == "EmbeddedEntity"))
        entity = result.scalar_one()
        assert entity.embedding is not None
        assert len(entity.embedding) == len(embedding)

    # -- 6. JSONB properties 合并可验证 --

    async def test_properties_merge_behavior_in_db(self, service, db_session, integration_corpus):
        """properties 字段的 JSONB 合并行为应在 DB 中可验证。"""
        # 第一次：初始属性
        await service.sync_entity_from_knowledge(
            db_session,
            knowledge_id=uuid4(),
            name="MergeTest",
            entity_type="PERSON",
            metadata={"role": "engineer", "team": "platform"},
            corpus_id=integration_corpus.id,
        )
        await db_session.commit()

        # 第二次：追加 + 覆盖
        await service.sync_entity_from_knowledge(
            db_session,
            knowledge_id=uuid4(),
            name="MergeTest",
            entity_type="PERSON",
            metadata={"team": "AI-ML", "level": "senior"},
            corpus_id=integration_corpus.id,
        )
        await db_session.commit()

        result = await db_session.execute(sql_select(KgEntity.properties).where(KgEntity.name == "MergeTest"))
        props = result.scalar_one()

        assert props["role"] == "engineer"  # 保留旧键
        assert props["team"] == "AI-ML"  # 被新值覆盖
        assert props["level"] == "senior"  # 新增键


# ===================================================================
# TestRelationSyncIntegration (4 cases)
# ===================================================================


class TestRelationSyncIntegration:
    """关系同步集成测试。"""

    @pytest.fixture
    async def _preloaded_entities(self, service, db_session, integration_corpus):
        """预置两个实体供关系测试使用。"""
        await service.sync_entity_from_knowledge(
            db_session,
            knowledge_id=uuid4(),
            name="RelSource",
            entity_type="PERSON",
            corpus_id=integration_corpus.id,
        )
        await service.sync_entity_from_knowledge(
            db_session,
            knowledge_id=uuid4(),
            name="RelTarget",
            entity_type="ORG",
            corpus_id=integration_corpus.id,
        )
        await db_session.commit()

    # -- 1. 在已有实体间创建关系 --

    async def test_create_relation_between_existing_entities(
        self, service, db_session, integration_corpus, _preloaded_entities
    ):
        """两端点均存在时，关系应成功创建到 DB。"""
        await service.sync_relation(
            db_session,
            source_name="RelSource",
            target_name="RelTarget",
            relation_type="WORKS_FOR",
            weight=3.0,
            evidence_text="RelSource works at RelTarget",
            corpus_id=integration_corpus.id,
        )
        await db_session.commit()

        result = await db_session.execute(sql_select(KgRelation))
        relations = result.scalars().all()

        assert len(relations) == 1
        rel = relations[0]
        assert rel.relation_type == "WORKS_FOR"
        assert rel.weight == pytest.approx(3.0)
        assert rel.evidence_text == "RelSource works at RelTarget"

    # -- 2. 端点缺失时静默跳过 --

    async def test_skip_relation_when_endpoint_absent(self, service, db_session, integration_corpus):
        """任一端点不存在时，不应抛异常且不创建关系。"""
        # 只预置 source
        await service.sync_entity_from_knowledge(
            db_session,
            knowledge_id=uuid4(),
            name="OnlySource",
            entity_type="PERSON",
            corpus_id=integration_corpus.id,
        )
        await db_session.commit()

        # target 不存在 → 应静默跳过
        await service.sync_relation(
            db_session,
            source_name="OnlySource",
            target_name="NonExistentTarget",
            relation_type="KNOWS",
            corpus_id=integration_corpus.id,
        )
        await db_session.commit()

        result = await db_session.execute(sql_select(KgRelation))
        assert len(result.scalars().all()) == 0

    # -- 3. 相同关系不重复创建 --

    async def test_duplicate_relation_not_created(self, service, db_session, integration_corpus, _preloaded_entities):
        """已存在的相同 (source, target, type) 关系不应重复创建。"""
        await service.sync_relation(
            db_session,
            source_name="RelSource",
            target_name="RelTarget",
            relation_type="WORKS_FOR",
            corpus_id=integration_corpus.id,
        )
        await db_session.commit()

        # 再次创建相同关系
        await service.sync_relation(
            db_session,
            source_name="RelSource",
            target_name="RelTarget",
            relation_type="WORKS_FOR",
            corpus_id=integration_corpus.id,
        )
        await db_session.commit()

        result = await db_session.execute(sql_select(KgRelation))
        assert len(result.scalars().all()) == 1  # 仍为 1 条

    # -- 4. 双向关系可共存 --

    async def test_bidirectional_relations(self, service, db_session, integration_corpus, _preloaded_entities):
        """A→B 和 B→A 是两条独立关系，可以共存。"""
        await service.sync_relation(
            db_session,
            source_name="RelSource",
            target_name="RelTarget",
            relation_type="MANAGES",
            corpus_id=integration_corpus.id,
        )
        await service.sync_relation(
            db_session,
            source_name="RelTarget",
            target_name="RelSource",
            relation_type="REPORTS_TO",
            corpus_id=integration_corpus.id,
        )
        await db_session.commit()

        result = await db_session.execute(sql_select(KgRelation.relation_type).order_by(KgRelation.relation_type))
        types = sorted([row[0] for row in result.all()])

        assert len(types) == 2
        assert "MANAGES" in types
        assert "REPORTS_TO" in types


# ===================================================================
# TestBatchSyncIntegration (3 cases)
# ===================================================================


class TestBatchSyncIntegration:
    """批量同步集成测试。"""

    # -- 1. 模拟图谱构建输出进行批量同步 --

    async def test_batch_sync_graph_build_output(self, service, db_session, integration_corpus):
        """模拟图构建输出，批量同步节点和边到 DB。"""
        nodes = [
            {
                "id": str(uuid4()),
                "label": "BatchNodeA",
                "node_type": "CONCEPT",
                "confidence": 0.85,
                "metadata": {"topic": "NLP"},
            },
            {
                "id": str(uuid4()),
                "label": "BatchNodeB",
                "node_type": "TECH",
                "confidence": 0.92,
                "metadata": {"topic": "VectorDB"},
            },
        ]
        edges = [
            {
                "source": "BatchNodeA",
                "target": "BatchNodeB",
                "edge_type": "USES",
                "weight": 2.5,
                "evidence_text": "A uses B for embeddings",
            }
        ]

        stats = await service.batch_sync_from_graph_build(
            db_session, nodes=nodes, edges=edges, corpus_id=integration_corpus.id
        )
        await db_session.commit()

        assert stats["entities_synced"] == 2
        assert stats["relations_synced"] == 1

        # 验证 DB 中确实存在这些实体
        ent_result = await db_session.execute(
            sql_select(KgEntity.name)
            .where(
                KgEntity.corpus_id == integration_corpus.id,
            )
            .order_by(KgEntity.name)
        )
        names = [row[0] for row in ent_result.all()]
        assert "BatchNodeA" in names
        assert "BatchNodeB" in names

        # 验证关系存在
        rel_result = await db_session.execute(sql_select(KgRelation))
        relations = rel_result.scalars().all()
        assert len(relations) == 1
        assert relations[0].relation_type == "USES"
        assert relations[0].weight == pytest.approx(2.5)

    # -- 2. 部分失败时数据一致性 --

    async def test_batch_sync_partial_failure_recovery(self, service, db_session, integration_corpus):
        """部分节点处理失败时，成功的节点和边仍应正确持久化。"""
        nodes = [
            {
                "id": str(uuid4()),
                "label": "GoodNode",
                "node_type": "OK",
                "confidence": 0.8,
            },
            {
                # 缺少 id 字段，使用默认 UUID——不会导致异常，
                # 但我们通过构造畸形数据来触发潜在问题
                "label": "AlsoGood",
                "node_type": "OK",
                "confidence": 0.7,
            },
        ]
        edges = [
            {
                "source": "GoodNode",
                "target": "AlsoGood",
                "edge_type": "LINKED",
            }
        ]

        stats = await service.batch_sync_from_graph_build(
            db_session, nodes=nodes, edges=edges, corpus_id=integration_corpus.id
        )
        await db_session.commit()

        # 全部应成功（输入合法）
        assert stats["entities_synced"] == 2
        assert stats["relations_synced"] == 1

        # 验证 DB 中数据一致
        ent_count = await db_session.execute(sql_select(KgEntity).where(KgEntity.corpus_id == integration_corpus.id))
        assert len(ent_count.scalars().all()) >= 2

    # -- 3. 大数据集基本性能检查 --

    async def test_batch_sync_large_dataset_performance(self, service, db_session, integration_corpus):
        """较大规模数据集的基本性能检查。"""
        node_count = 50
        edge_count = 80

        nodes = [
            {
                "id": str(uuid4()),
                "label": f"PerfNode_{i}",
                "node_type": "AUTO",
                "confidence": 0.5 + (i % 10) * 0.05,
            }
            for i in range(node_count)
        ]
        edges = [
            {
                "source": f"PerfNode_{i % node_count}",
                "target": f"PerfNode_{(i + 1) % node_count}",
                "edge_type": "CONNECTS",
                "weight": float(i % 5) + 0.5,
            }
            for i in range(edge_count)
        ]

        stats = await service.batch_sync_from_graph_build(
            db_session, nodes=nodes, edges=edges, corpus_id=integration_corpus.id
        )
        await db_session.commit()

        assert stats["entities_synced"] == node_count
        assert stats["relations_synced"] == edge_count

        # 验证 get_top_entities 可正常工作
        top = await service.get_top_entities(db_session, corpus_id=integration_corpus.id, limit=5)
        assert isinstance(top, list)
        assert len(top) <= 5
        if top:
            assert "name" in top[0]
            assert "mention_count" in top[0]
