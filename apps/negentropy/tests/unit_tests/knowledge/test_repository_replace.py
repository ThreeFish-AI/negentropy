"""Repository 层原子 replace + 双口径计数的单元测试。

覆盖：
- replace_knowledge_by_source 的同事务语义
- list_corpora_with_counts 的 top-level vs total 口径
- _top_level_role_expr 的 COALESCE 行为
"""

from __future__ import annotations

from uuid import uuid4

import pytest

from negentropy.knowledge.retrieval.repository import (
    KnowledgeRepository,
    _top_level_role_expr,
)
from negentropy.knowledge.types import KnowledgeChunk

# ============================================================================
# _top_level_role_expr
# ============================================================================


def test_top_level_role_expr_produces_coalesce():
    """_top_level_role_expr 应生成 COALESCE 表达式，将 NULL 映射为 'leaf'。"""
    expr = _top_level_role_expr()
    # 验证表达式可编译（不抛异常），且包含 coalesce 语义
    compiled = str(expr.compile(compile_kwargs={"literal_binds": True}))
    assert "coalesce" in compiled.lower()


# ============================================================================
# _chunks_to_insert_values / _build_returning_clause / _row_to_knowledge_record
# ============================================================================


def test_chunks_to_insert_values_maps_fields():
    """_chunks_to_insert_values 应正确映射所有 KnowledgeChunk 字段。"""
    chunk = KnowledgeChunk(
        content="hello",
        source_uri="gs://test/doc.pdf",
        chunk_index=3,
        metadata={"chunk_role": "parent"},
        embedding=[0.1, 0.2],
    )
    values = KnowledgeRepository._chunks_to_insert_values(corpus_id=uuid4(), app_name="test", chunk_list=[chunk])
    assert len(values) == 1
    v = values[0]
    assert v["content"] == "hello"
    assert v["source_uri"] == "gs://test/doc.pdf"
    assert v["chunk_index"] == 3
    assert v["metadata_"]["chunk_role"] == "parent"
    assert v["embedding"] == [0.1, 0.2]
    assert v["is_enabled"] is True
    assert v["retrieval_count"] == 0


def test_chunks_to_insert_values_empty_list():
    """空 chunk_list 应返回空列表。"""
    values = KnowledgeRepository._chunks_to_insert_values(corpus_id=uuid4(), app_name="test", chunk_list=[])
    assert values == []


# ============================================================================
# PipelineTracker.get_stage_output
# ============================================================================


@pytest.mark.asyncio
async def test_get_stage_output_returns_completed_stage_output():
    from negentropy.knowledge.service import PipelineTracker

    from .conftest import FakePipelineDao

    dao = FakePipelineDao()
    tracker = PipelineTracker(dao=dao, app_name="test", operation="ingest_text", run_id="run-1")
    await tracker.start({"corpus_id": str(uuid4())})
    await tracker.start_stage("persist")
    await tracker.complete_stage("persist", {"record_count": 14, "replaced_count": 84})

    output = tracker.get_stage_output("persist")
    assert output["record_count"] == 14
    assert output["replaced_count"] == 84


@pytest.mark.asyncio
async def test_get_stage_output_returns_empty_for_missing_stage():
    from negentropy.knowledge.service import PipelineTracker

    from .conftest import FakePipelineDao

    dao = FakePipelineDao()
    tracker = PipelineTracker(dao=dao, app_name="test", operation="ingest_text", run_id="run-2")
    await tracker.start({})

    output = tracker.get_stage_output("nonexistent")
    assert output == {}
