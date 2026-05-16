"""共享辅助工具：KgEntityService 测试的工厂函数和 mock 基础设施。"""

from __future__ import annotations

from types import SimpleNamespace
from uuid import UUID, uuid4

import sqlalchemy.orm

# 常量
KNOWLEDGE_ID = uuid4()
CORPUS_ID = UUID("00000000-0000-0000-0000-000000000001")
CORPUS_ID_B = UUID("00000000-0000-0000-0000-000000000002")

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


def make_entity_ns(
    *,
    name: str = "TestEntity",
    entity_type: str = "PERSON",
    confidence: float = 0.8,
    mention_count: int = 1,
    corpus_id: UUID | None = CORPUS_ID,
    embedding: list[float] | None = None,
    properties: dict | None = None,
) -> SimpleNamespace:
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


def make_relation_ns(
    *,
    source_id: UUID,
    target_id: UUID,
    relation_type: str = "WORKS_FOR",
    weight: float = 1.0,
    evidence_text: str | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        id=str(uuid4()),
        source_id=source_id,
        target_id=target_id,
        relation_type=relation_type,
        weight=weight,
        evidence_text=evidence_text,
    )


class FakeExecuteResult:
    """模拟 db.execute() 返回的结果对象（用于 scalar_one_or_none 场景）。"""

    def __init__(self, rows: list):
        self._rows = rows

    def all(self):
        return self._rows

    def scalar_one_or_none(self):
        return self._rows[0] if self._rows else None


class FakeSelectResult:
    """模拟 db.execute() 返回的结果对象（用于 .all() 场景）。"""

    def __init__(self, rows: list[tuple]):
        self._rows = rows

    def all(self):
        return self._rows


class MockExecuteReturn:
    """new_callable 工厂：创建一个 mock execute 方法，始终返回指定值的 scalar_one_or_none。"""

    def __init__(self, *, return_value):
        self._return_value = return_value

    async def __call__(self, stmt):
        return FakeExecuteResult([self._return_value] if self._return_value is not None else [])
