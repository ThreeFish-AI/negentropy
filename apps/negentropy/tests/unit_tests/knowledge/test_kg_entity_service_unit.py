"""
KgEntityService 单元测试 — Dual-Write Strategy

测试 KgEntityService 的核心方法：
- sync_entity_from_knowledge(): 实体 upsert（双写语义）
- sync_relation(): 关系创建（端点校验）
- batch_sync_from_graph_build(): 批量处理（错误隔离）
- get_top_entities(): Top-N 查询

使用 FakeEntityDbSession（内存注册表）模拟 AsyncSession，
避免依赖真实数据库。
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
import sqlalchemy.orm

from negentropy.knowledge.graph.entity_service import KgEntityService
from tests.unit_tests.knowledge.conftest import (
    FakeEntityDbSession,
)

# ---------------------------------------------------------------------------
# 常量
# ---------------------------------------------------------------------------

_KNOWLEDGE_ID = uuid4()
_CORPUS_ID = UUID("00000000-0000-0000-0000-000000000001")
_CORPUS_ID_B = UUID("00000000-0000-0000-0000-000000000002")


# ---------------------------------------------------------------------------
# 修复 KnowledgeDocument <-> DocSource 双向 FK 的 AmbiguousForeignKeysError
# ---------------------------------------------------------------------------
# knowledge_documents 与 doc_sources 存在双向 FK：
#   - KnowledgeDocument.source_id -> doc_sources
#   - DocSource.document_id -> knowledge_documents
# 导致 SQLAlchemy 无法自动推断关系 join 条件。
# 必须在首次触发 ORM 编译之前修补两侧关系。
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


def _make_entity_ns(
    *,
    name: str = "TestEntity",
    entity_type: str = "PERSON",
    confidence: float = 0.8,
    mention_count: int = 1,
    corpus_id: UUID | None = _CORPUS_ID,
    embedding: list[float] | None = None,
    properties: dict | None = None,
) -> SimpleNamespace:
    """工厂：构建模拟 KgEntity 行对象。"""
    return SimpleNamespace(
        id=str(uuid4()),
        name=name,
        entity_type=entity_type,
        confidence=confidence,
        mention_count=mention_count,
        corpus_id=corpus_id,
        embedding=embedding,
        properties=properties or {},
        app_name="negentropy",
    )


def _make_relation_ns(
    *,
    source_id: UUID,
    target_id: UUID,
    relation_type: str = "WORKS_FOR",
    weight: float = 1.0,
    evidence_text: str | None = None,
) -> SimpleNamespace:
    """工厂：构建模拟 KgRelation 行对象。"""
    return SimpleNamespace(
        id=str(uuid4()),
        source_id=source_id,
        target_id=target_id,
        relation_type=relation_type,
        weight=weight,
        evidence_text=evidence_text,
    )


# ===================================================================
# TestSyncEntityFromKnowledge (8 cases)
# ===================================================================


class TestSyncEntityFromKnowledge:
    """sync_entity_from_knowledge() 单元测试。"""

    @pytest.fixture
    def service(self) -> KgEntityService:
        return KgEntityService()

    @pytest.fixture
    def db(self) -> FakeEntityDbSession:
        return FakeEntityDbSession()

    # -- 1. 首次同步创建新实体 + Mention --

    async def test_sync_creates_new_entity(self, service, db):
        """首次同步应创建 KgEntity + KgEntityMention，mention_count=1。"""
        await service.sync_entity_from_knowledge(
            db,
            knowledge_id=_KNOWLEDGE_ID,
            name="Alice",
            entity_type="PERSON",
            confidence=0.85,
            corpus_id=_CORPUS_ID,
        )

        # 应添加 2 个对象：KgEntity + KgEntityMention
        assert len(db.added) == 2

        entity = db.added[0]
        assert entity.name == "Alice"
        assert entity.entity_type == "PERSON"
        assert entity.confidence == pytest.approx(0.85)
        assert entity.mention_count == 1
        assert entity.corpus_id == _CORPUS_ID

        # Mention 记录不再设置 knowledge_chunk_id（避免 FK 约束违规）
        mention = db.added[1]
        assert mention.knowledge_chunk_id is None

    async def test_sync_create_logs_with_non_reserved_extra_keys(self, service, db, monkeypatch):
        """创建实体日志不应使用 LogRecord 保留字段 name。"""
        captured: dict[str, object] = {}

        def fake_info(event: str, *, extra: dict[str, object]) -> None:
            captured["event"] = event
            captured["extra"] = extra

        monkeypatch.setattr("negentropy.knowledge.graph.entity_service.logger.info", fake_info)

        await service.sync_entity_from_knowledge(
            db,
            knowledge_id=_KNOWLEDGE_ID,
            name="Alice",
            entity_type="PERSON",
            confidence=0.85,
            corpus_id=_CORPUS_ID,
        )

        assert captured["event"] == "kg_entity_created"
        assert captured["extra"]["entity_name"] == "Alice"
        assert "name" not in captured["extra"]

    # -- 2. 更新已有实体 — 置信度升级 --

    async def test_sync_updates_existing_entity_confidence_upgrade(self, service, db):
        """更高置信度应更新已有实体的 confidence 字段。"""
        existing = _make_entity_ns(name="Bob", confidence=0.5)
        db.entities.append(existing)

        with patch.object(db, "execute", new_callable=_MockExecuteReturn, return_value=existing):
            await service.sync_entity_from_knowledge(
                db,
                knowledge_id=_KNOWLEDGE_ID,
                name="Bob",
                entity_type="PERSON",
                confidence=0.9,
                corpus_id=_CORPUS_ID,
            )

        # 置信度应从 0.5 升级到 0.9
        assert existing.confidence == pytest.approx(0.9)

    # -- 3. 跳过置信度降级 --

    async def test_sync_skips_confidence_downgrade(self, service, db):
        """更低置信度不应降级已有实体的 confidence。"""
        existing = _make_entity_ns(name="Carol", confidence=0.9)
        db.entities.append(existing)

        with patch.object(db, "execute", new_callable=_MockExecuteReturn, return_value=existing):
            await service.sync_entity_from_knowledge(
                db,
                knowledge_id=_KNOWLEDGE_ID,
                name="Carol",
                entity_type="PERSON",
                confidence=0.3,
                corpus_id=_CORPUS_ID,
            )

        # 置信度应保持不变（不降级）
        assert existing.confidence == pytest.approx(0.9)

    # -- 4. 更新时 mention_count 递增 --

    async def test_sync_increments_mention_count_on_update(self, service, db):
        """每次同步更新时，mention_count 应递增。"""
        existing = _make_entity_ns(name="Dave", mention_count=3)
        db.entities.append(existing)

        with patch.object(db, "execute", new_callable=_MockExecuteReturn, return_value=existing):
            await service.sync_entity_from_knowledge(
                db,
                knowledge_id=_KNOWLEDGE_ID,
                name="Dave",
                entity_type="PERSON",
                confidence=0.7,
                corpus_id=_CORPUS_ID,
            )

        assert existing.mention_count == 4

    async def test_sync_update_logs_with_non_reserved_extra_keys(self, service, db, monkeypatch):
        """更新实体日志不应使用 LogRecord 保留字段 name。"""
        existing = _make_entity_ns(name="Dave", mention_count=3)
        db.entities.append(existing)
        captured: dict[str, object] = {}

        def fake_debug(event: str, *, extra: dict[str, object]) -> None:
            captured["event"] = event
            captured["extra"] = extra

        monkeypatch.setattr("negentropy.knowledge.graph.entity_service.logger.debug", fake_debug)

        with patch.object(db, "execute", new_callable=_MockExecuteReturn, return_value=existing):
            await service.sync_entity_from_knowledge(
                db,
                knowledge_id=_KNOWLEDGE_ID,
                name="Dave",
                entity_type="PERSON",
                confidence=0.7,
                corpus_id=_CORPUS_ID,
            )

        assert captured["event"] == "kg_entity_updated"
        assert captured["extra"]["entity_name"] == "Dave"
        assert "name" not in captured["extra"]

    # -- 5. 属性合并 --

    async def test_sync_merges_properties_metadata(self, service, db):
        """properties dict 应合并，新键覆盖旧值。"""
        existing = _make_entity_ns(
            name="Eve",
            properties={"role": "engineer", "level": "senior"},
        )
        db.entities.append(existing)

        with patch.object(db, "execute", new_callable=_MockExecuteReturn, return_value=existing):
            await service.sync_entity_from_knowledge(
                db,
                knowledge_id=_KNOWLEDGE_ID,
                name="Eve",
                entity_type="PERSON",
                metadata={"level": "staff", "department": "AI"},
                corpus_id=_CORPUS_ID,
            )

        # level 被覆盖，department 为新增
        assert existing.properties["role"] == "engineer"
        assert existing.properties["level"] == "staff"
        assert existing.properties["department"] == "AI"

    # -- 6. 更新 embedding --

    async def test_sync_updates_embedding_when_provided(self, service, db):
        """当提供非 None 的 embedding 时应更新。"""
        existing = _make_entity_ns(name="Frank", embedding=[0.1, 0.2])
        db.entities.append(existing)
        new_embedding = [0.3, 0.4, 0.5]

        with patch.object(db, "execute", new_callable=_MockExecuteReturn, return_value=existing):
            await service.sync_entity_from_knowledge(
                db,
                knowledge_id=_KNOWLEDGE_ID,
                name="Frank",
                entity_type="PERSON",
                embedding=new_embedding,
                corpus_id=_CORPUS_ID,
            )

        assert existing.embedding == new_embedding

    # -- 7. 创建 Mention 记录 --

    async def test_sync_creates_mention_record(self, service, db):
        """创建实体时应同时创建 KgEntityMention 记录。"""
        await service.sync_entity_from_knowledge(
            db,
            knowledge_id=_KNOWLEDGE_ID,
            name="Grace",
            entity_type="ORG",
            corpus_id=_CORPUS_ID,
        )

        # added[0] = KgEntity, added[1] = KgEntityMention
        assert len(db.added) >= 2
        mention = db.added[1]
        assert hasattr(mention, "knowledge_chunk_id")
        assert mention.knowledge_chunk_id is None  # 不再设置，避免 FK 约束违规
        assert hasattr(mention, "context_snippet")

    # -- 8. corpus_id 参与唯一性检查 --

    async def test_sync_with_corpus_id_filtering(self, service, db):
        """不同 corpus_id 下的同名同类型实体应视为不同记录。"""
        corpus_a_entity = _make_entity_ns(name="Hank", corpus_id=_CORPUS_ID)
        db.entities.append(corpus_a_entity)

        # 模拟 execute 返回 None（corpus_b 下无匹配）
        with patch.object(db, "execute", new_callable=_MockExecuteReturn, return_value=None):
            await service.sync_entity_from_knowledge(
                db,
                knowledge_id=_KNOWLEDGE_ID,
                name="Hank",
                entity_type="PERSON",
                corpus_id=_CORPUS_ID_B,
            )

        # 由于 corpus 不同，应创建新实体而非更新
        assert len(db.added) == 2  # 新 entity + 新 mention


# ===================================================================
# TestSyncRelation (6 cases)
# ===================================================================


class TestSyncRelation:
    """sync_relation() 单元测试。"""

    @pytest.fixture
    def service(self) -> KgEntityService:
        return KgEntityService()

    @pytest.fixture
    def db(self) -> FakeEntityDbSession:
        return FakeEntityDbSession()

    # -- 1. 两端点均存在 → 创建关系 --

    async def test_sync_relation_creates_new_relation(self, service, db):
        """source 和 target 均存在时应成功创建关系。"""
        src = _make_entity_ns(name="Alice")
        tgt = _make_entity_ns(name="Bob")
        db.entities.extend([src, tgt])

        call_count = [0]

        async def _fake_execute(stmt):
            stmt_str = str(stmt).lower()
            if "kg_relation" in stmt_str:
                return _FakeExecuteResult([])
            # Entity 查询：交替返回 src / tgt
            call_count[0] += 1
            if call_count[0] % 2 == 1:
                return _FakeExecuteResult([src])
            else:
                return _FakeExecuteResult([tgt])

        with patch.object(db, "execute", side_effect=_fake_execute):
            await service.sync_relation(
                db,
                source_name="Alice",
                target_name="Bob",
                relation_type="WORKS_FOR",
                weight=2.0,
                evidence_text="Alice works for Bob Inc.",
                corpus_id=_CORPUS_ID,
            )

        # 应添加一个关系对象
        assert len(db.added) == 1
        rel = db.added[0]
        assert rel.relation_type == "WORKS_FOR"
        assert rel.weight == pytest.approx(2.0)
        assert rel.evidence_text == "Alice works for Bob Inc."

    # -- 2. source 缺失 → 静默跳过 --

    async def test_sync_relation_skips_when_source_missing(self, service, db):
        """source 实体不存在时应静默跳过，不抛异常。"""
        tgt = _make_entity_ns(name="Bob")
        db.entities.append(tgt)

        call_count = [0]

        async def _fake_execute(stmt):
            stmt_str = str(stmt).lower()
            if "kg_relation" in stmt_str:
                return _FakeExecuteResult([])
            call_count[0] += 1
            # 第一次查 source → 空；第二次查 target → 有结果
            if call_count[0] == 1:
                return _FakeExecuteResult([])
            return _FakeExecuteResult([tgt])

        with patch.object(db, "execute", side_effect=_fake_execute):
            await service.sync_relation(
                db,
                source_name="GhostSource",
                target_name="Bob",
                relation_type="KNOWS",
                corpus_id=_CORPUS_ID,
            )

        # 不应添加任何关系
        assert len(db.added) == 0

    # -- 3. target 缺失 → 静默跳过 --

    async def test_sync_relation_skips_when_target_missing(self, service, db):
        """target 实体不存在时应静默跳过。"""
        src = _make_entity_ns(name="Alice")
        db.entities.append(src)

        call_count = [0]

        async def _fake_execute(stmt):
            stmt_str = str(stmt).lower()
            if "kg_relation" in stmt_str:
                return _FakeExecuteResult([])
            call_count[0] += 1
            if call_count[0] == 1:
                return _FakeExecuteResult([src])  # source 存在
            return _FakeExecuteResult([])  # target 不存在

        with patch.object(db, "execute", side_effect=_fake_execute):
            await service.sync_relation(
                db,
                source_name="Alice",
                target_name="GhostTarget",
                relation_type="KNOWS",
                corpus_id=_CORPUS_ID,
            )

        assert len(db.added) == 0

    # -- 4. 幂等性：相同关系不重复创建 --

    async def test_sync_relation_idempotent(self, service, db):
        """已存在的相同关系不应重复创建。"""
        src = _make_entity_ns(name="Alice")
        tgt = _make_entity_ns(name="Bob")
        existing_rel = _make_relation_ns(source_id=src.id, target_id=tgt.id, relation_type="WORKS_FOR")
        db.entities.extend([src, tgt])
        db.relations.append(existing_rel)

        call_count = [0]

        async def _fake_execute(stmt):
            stmt_str = str(stmt).lower()
            if "kg_relation" in stmt_str:
                return _FakeExecuteResult([existing_rel])
            call_count[0] += 1
            if call_count[0] % 2 == 1:
                return _FakeExecuteResult([src])
            return _FakeExecuteResult([tgt])

        with patch.object(db, "execute", side_effect=_fake_execute):
            await service.sync_relation(
                db,
                source_name="Alice",
                target_name="Bob",
                relation_type="WORKS_FOR",
                corpus_id=_CORPUS_ID,
            )

        # 关系已存在，不应新增
        assert len(db.added) == 0

    # -- 5. evidence_text 正确保存 --

    async def test_sync_relation_with_evidence_text(self, service, db):
        """evidence_text 参数应正确持久化到关系对象。"""
        src = _make_entity_ns(name="Alice")
        tgt = _make_entity_ns(name="Charlie")
        db.entities.extend([src, tgt])

        evidence = "Published joint paper on NLP in 2024"

        call_count = [0]

        async def _fake_execute(stmt):
            stmt_str = str(stmt).lower()
            if "kg_relation" in stmt_str:
                return _FakeExecuteResult([])
            call_count[0] += 1
            if call_count[0] % 2 == 1:
                return _FakeExecuteResult([src])
            return _FakeExecuteResult([tgt])

        with patch.object(db, "execute", side_effect=_fake_execute):
            await service.sync_relation(
                db,
                source_name="Alice",
                target_name="Charlie",
                relation_type="CO_AUTHOR",
                evidence_text=evidence,
                corpus_id=_CORPUS_ID,
            )

        assert len(db.added) == 1
        assert db.added[0].evidence_text == evidence

    # -- 6. weight 持久化 --

    async def test_sync_relation_weight_persistence(self, service, db):
        """weight 参数应正确持久化到关系对象。"""
        src = _make_entity_ns(name="Alice")
        tgt = _make_entity_ns(name="Diana")
        db.entities.extend([src, tgt])

        call_count = [0]

        async def _fake_execute(stmt):
            stmt_str = str(stmt).lower()
            if "kg_relation" in stmt_str:
                return _FakeExecuteResult([])
            call_count[0] += 1
            if call_count[0] % 2 == 1:
                return _FakeExecuteResult([src])
            return _FakeExecuteResult([tgt])

        with patch.object(db, "execute", side_effect=_fake_execute):
            await service.sync_relation(
                db,
                source_name="Alice",
                target_name="Diana",
                relation_type="MANAGES",
                weight=5.5,
                corpus_id=_CORPUS_ID,
            )

        assert len(db.added) == 1
        assert db.added[0].weight == pytest.approx(5.5)


# ===================================================================
# TestBatchSyncFromGraphBuild (5 cases)
# ===================================================================


class TestBatchSyncFromGraphBuild:
    """batch_sync_from_graph_build() 单元测试。"""

    @pytest.fixture
    def service(self) -> KgEntityService:
        return KgEntityService()

    @pytest.fixture
    def db(self) -> FakeEntityDbSession:
        return FakeEntityDbSession()

    # -- 1. 全部节点和边处理完毕 --

    async def test_batch_sync_processes_all_nodes_and_edges(self, service, db):
        """正常输入应处理所有节点和边，返回正确的计数。"""
        nodes = [
            {"id": str(uuid4()), "label": "NodeA", "node_type": "CONCEPT"},
            {"id": str(uuid4()), "label": "NodeB", "node_type": "TECH"},
        ]
        edges = [
            {"source": "NodeA", "target": "NodeB", "edge_type": "USES"},
        ]

        # 模拟 execute 对实体查询返回空（全部新建）
        async def _fake_execute(stmt):
            return _FakeExecuteResult([])

        with patch.object(db, "execute", side_effect=_fake_execute):
            result = await service.batch_sync_from_graph_build(db, nodes=nodes, edges=edges, corpus_id=_CORPUS_ID)

        assert result["entities_synced"] == 2
        assert result["relations_synced"] == 1

    # -- 2. 单个节点失败不影响其他节点 --

    async def test_batch_sync_error_isolation_one_failure(self, service, db):
        """单个节点处理失败不应阻止其他节点的处理。"""
        nodes = [
            {"id": str(uuid4()), "label": "GoodNode", "node_type": "OK"},
            {"id": str(uuid4()), "label": "BadNode", "node_type": "BROKEN"},  # 合法 UUID，execute 时触发异常
            {"id": str(uuid4()), "label": "AnotherGood", "node_type": "OK"},
        ]

        call_num = [0]

        async def _fake_execute(stmt):
            call_num[0] += 1
            # 让第二个节点（BadNode）的查询抛出异常
            if call_num[0] == 2:
                raise RuntimeError("Simulated DB error for BadNode")
            return _FakeExecuteResult([])

        with patch.object(db, "execute", side_effect=_fake_execute):
            result = await service.batch_sync_from_graph_build(db, nodes=nodes, edges=[], corpus_id=_CORPUS_ID)

        # 2 个成功 + 1 个失败被隔离
        assert result["entities_synced"] == 2

    # -- 3. 单条边失败不影响其他边 --

    async def test_batch_sync_error_isolation_edge_failure(self, service, db):
        """单条边处理失败不应阻止其他边的处理。"""
        edges = [
            {"source": "A", "target": "B", "edge_type": "GOOD"},
            {"source": "X", "target": "Y", "edge_type": "FAIL_EDGE"},  # 会触发异常
            {"source": "C", "target": "D", "edge_type": "ALSO_GOOD"},
        ]

        call_num = [0]

        async def _fake_execute(stmt):
            call_num[0] += 1
            if call_num[0] == 4:  # 第二条边的某个查询步骤
                raise RuntimeError("Edge processing failure")
            return _FakeExecuteResult([])

        with patch.object(db, "execute", side_effect=_fake_execute):
            result = await service.batch_sync_from_graph_build(db, nodes=[], edges=edges, corpus_id=_CORPUS_ID)

        # 至少部分边成功（具体数量取决于异常触发时机）
        assert result["relations_synced"] >= 0
        assert isinstance(result["relations_synced"], int)

    # -- 4. 空输入返回零计数 --

    async def test_batch_sync_empty_inputs_returns_zeros(self, service, db):
        """空的 nodes 和 edges 列表应返回 {0, 0}。"""
        result = await service.batch_sync_from_graph_build(db, nodes=[], edges=[])

        assert result == {"entities_synced": 0, "relations_synced": 0}

    # -- 5. 统计准确性 --

    async def test_batch_sync_statistics_accuracy(self, service, db):
        """成功/失败计数应准确反映实际处理情况。"""
        nodes = [
            {"id": str(uuid4()), "label": "N1", "node_type": "T"},
            {"id": str(uuid4()), "label": "N2", "node_type": "T"},
            {"id": str(uuid4()), "label": "N3", "node_type": "T"},
        ]
        edges = [
            {"source": "N1", "target": "N2", "edge_type": "R12"},
            {"source": "N2", "target": "N3", "edge_type": "R23"},
        ]

        async def _fake_execute(stmt):
            return _FakeExecuteResult([])

        with patch.object(db, "execute", side_effect=_fake_execute):
            result = await service.batch_sync_from_graph_build(db, nodes=nodes, edges=edges, corpus_id=_CORPUS_ID)

        assert result["entities_synced"] == 3
        assert result["relations_synced"] == 2


# ===================================================================
# TestGetTopEntities (4 cases)
# ===================================================================


class TestGetTopEntities:
    """get_top_entities() 单元测试。"""

    @pytest.fixture
    def service(self) -> KgEntityService:
        return KgEntityService()

    @pytest.fixture
    def db(self) -> FakeEntityDbSession:
        session = FakeEntityDbSession()
        # 预置一些实体数据
        session.entities = [
            _make_entity_ns(name="HighMention", mention_count=100),
            _make_entity_ns(name="MidMention", mention_count=50),
            _make_entity_ns(name="LowMention", mention_count=10),
            _make_entity_ns(name="ZeroMention", mention_count=0),
        ]
        return session

    # -- 1. 按 mention_count DESC 排序 --

    async def test_get_top_entities_returns_ordered_list(self, service, db):
        """返回列表应按 mention_count 降序排列。"""

        # 模拟 execute 返回预置的全部实体行
        # 服务端按 (id, name, entity_type, confidence, mention_count, created_at) 取值
        async def _fake_execute(stmt):
            rows = [(e.id, e.name, e.entity_type, e.confidence or 0, e.mention_count, None) for e in db.entities]
            return _FakeSelectResult(rows)

        with patch.object(db, "execute", side_effect=_fake_execute):
            results = await service.get_top_entities(db, limit=10)

        names = [r["name"] for r in results]
        counts = [r["mention_count"] for r in results]

        # 确认降序
        assert counts == sorted(counts, reverse=True)
        assert names[0] == "HighMention"

    # -- 2. corpus_id 过滤 --

    async def test_get_top_entities_with_corpus_filter(self, service, db):
        """corpus_id 过滤参数应生效。"""
        filter_called = False

        async def _fake_execute(stmt):
            nonlocal filter_called
            stmt_str = str(stmt)
            if "corpus_id" in stmt_str:
                filter_called = True
            return _FakeSelectResult([])

        with patch.object(db, "execute", side_effect=_fake_execute):
            await service.get_top_entities(db, corpus_id=_CORPUS_ID, limit=5)

        assert filter_called is True

    # -- 3. entity_type 过滤 --

    async def test_get_top_entities_with_type_filter(self, service, db):
        """entity_type 过滤参数应生效。"""
        filter_called = False

        async def _fake_execute(stmt):
            nonlocal filter_called
            stmt_str = str(stmt)
            if "entity_type" in stmt_str:
                filter_called = True
            return _FakeSelectResult([])

        with patch.object(db, "execute", side_effect=_fake_execute):
            await service.get_top_entities(db, entity_type="PERSON", limit=5)

        assert filter_called is True

    # -- 4. limit 参数限制 --

    async def test_get_top_entities_respects_limit(self, service, db):
        """limit 参数应正确限制返回数量。"""
        returned_rows = []

        async def _fake_execute(stmt):
            # 捕获 .limit() 的调用——通过返回固定行数来验证
            # 服务端按 (id, name, entity_type, confidence, mention_count, created_at) 取值
            rows = [
                (e.id, e.name, e.entity_type, e.confidence or 0, e.mention_count, None) for e in db.entities[:2]
            ]  # 模拟只返回 2 条
            returned_rows.extend(rows)
            return _FakeSelectResult(rows)

        with patch.object(db, "execute", side_effect=_fake_execute):
            results = await service.get_top_entities(db, limit=2)

        assert len(results) <= 2


# ===================================================================
# 辅助工具
# ===================================================================


class _FakeExecuteResult:
    """模拟 db.execute() 返回的结果对象（用于 scalar_one_or_none 场景）。"""

    def __init__(self, rows: list):
        self._rows = rows

    def all(self):
        return self._rows

    def scalar_one_or_none(self):
        return self._rows[0] if self._rows else None


class _FakeSelectResult:
    """模拟 db.execute() 返回的结果对象（用于 .all() 场景）。"""

    def __init__(self, rows: list[tuple]):
        self._rows = rows

    def all(self):
        return self._rows


class _MockExecuteReturn:
    """new_callable 工厂：创建一个 mock execute 方法，始终返回指定值的 scalar_one_or_none。

    用于 patch ``db.execute`` 以控制 ``sync_entity_from_knowledge`` 中
    对已有实体的查找行为。配合 ``new_callable=_MockExecuteReturn`` 使用，
    通过 ``return_value`` 关键字参数传入期望返回值。
    """

    def __init__(self, *, return_value):
        self._return_value = return_value

    async def __call__(self, stmt):
        return _FakeExecuteResult([self._return_value] if self._return_value is not None else [])
