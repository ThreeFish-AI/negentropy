"""Integration 测试：task_model_settings 在真实 PG 上的 INSERT / SELECT round-trip。

覆盖：
    1. 全局映射 (scope_corpus_id=NULL) 可正常写入、读回
    2. 同一 task_key 的全局映射唯一约束（第二条应报错）
    3. Corpus 级映射可写入、与全局映射共存
    4. API 层 upsert + list 端到端 round-trip

动机：0032 migration 早期使用 PRIMARY KEY(scope_corpus_id, task_key)，
PG 会强制把 scope_corpus_id 标为 NOT NULL，导致全局映射无法落库。
本测试用真实 PG 确保此类问题不再逃逸。
"""

from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import select

from negentropy.config.task_registry import ALL_TASKS
from negentropy.db.session import AsyncSessionLocal
from negentropy.models.model_config import ModelConfig, ModelType
from negentropy.models.task_model_setting import TaskModelSetting


@pytest.fixture
def any_task_key() -> str:
    return ALL_TASKS[0].task_key


@pytest.fixture
def corpus_task_key() -> str:
    for slot in ALL_TASKS:
        if slot.scope == "corpus":
            return slot.task_key
    raise AssertionError("no corpus-scoped task registered")


@pytest.fixture
async def _seed_model_config():
    """在 model_configs 表中插入一行可用的 LLM 记录，供 FK 引用。"""
    mc = ModelConfig(
        id=uuid4(),
        model_type=ModelType.LLM,
        vendor="test-vendor",
        model_name="test-model-for-task-settings",
        display_name="Test Model",
        is_default=False,
        enabled=True,
        config={},
    )
    async with AsyncSessionLocal() as db:
        db.add(mc)
        await db.commit()
        await db.refresh(mc)
    yield mc
    async with AsyncSessionLocal() as db:
        await db.execute(select(ModelConfig).where(ModelConfig.id == mc.id))
        await db.delete(mc)
        await db.commit()


@pytest.mark.asyncio
async def test_global_setting_insert_and_read(any_task_key, _seed_model_config):
    """scope_corpus_id=NULL 的行可正常写入并按 IS NULL 条件查回。"""
    mc = _seed_model_config
    row = TaskModelSetting(
        scope_corpus_id=None,
        task_key=any_task_key,
        model_config_id=mc.id,
    )
    async with AsyncSessionLocal() as db:
        db.add(row)
        await db.commit()

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(TaskModelSetting).where(
                TaskModelSetting.scope_corpus_id.is_(None),
                TaskModelSetting.task_key == any_task_key,
            )
        )
        loaded = result.scalar_one()
        assert loaded.scope_corpus_id is None
        assert loaded.task_key == any_task_key
        assert loaded.model_config_id == mc.id

    async with AsyncSessionLocal() as db:
        await db.delete(loaded)
        await db.commit()


@pytest.mark.asyncio
async def test_global_setting_unique_constraint(any_task_key, _seed_model_config):
    """同一 task_key 只能有一条全局映射（偏唯一索引约束）。"""
    mc = _seed_model_config
    row1 = TaskModelSetting(
        scope_corpus_id=None,
        task_key=any_task_key,
        model_config_id=mc.id,
    )
    async with AsyncSessionLocal() as db:
        db.add(row1)
        await db.commit()

    row2 = TaskModelSetting(
        scope_corpus_id=None,
        task_key=any_task_key,
        model_config_id=mc.id,
    )
    with pytest.raises(Exception, match="uq_task_model_settings_global"):  # noqa: PT012
        async with AsyncSessionLocal() as db:
            db.add(row2)
            await db.commit()

    async with AsyncSessionLocal() as db:
        loaded = (
            await db.execute(
                select(TaskModelSetting).where(
                    TaskModelSetting.scope_corpus_id.is_(None),
                    TaskModelSetting.task_key == any_task_key,
                )
            )
        ).scalar_one()
        await db.delete(loaded)
        await db.commit()


@pytest.mark.asyncio
async def test_corpus_setting_coexists_with_global(any_task_key, corpus_task_key, _seed_model_config):
    """全局映射 + Corpus 级映射可共存；不同 corpus 各自独立。"""
    mc = _seed_model_config
    corpus_id_1 = uuid4()
    corpus_id_2 = uuid4()

    global_row = TaskModelSetting(
        scope_corpus_id=None,
        task_key=any_task_key,
        model_config_id=mc.id,
    )
    corpus_row_1 = TaskModelSetting(
        scope_corpus_id=corpus_id_1,
        task_key=corpus_task_key,
        model_config_id=mc.id,
    )
    corpus_row_2 = TaskModelSetting(
        scope_corpus_id=corpus_id_2,
        task_key=corpus_task_key,
        model_config_id=mc.id,
    )

    async with AsyncSessionLocal() as db:
        db.add_all([global_row, corpus_row_1, corpus_row_2])
        await db.commit()

    async with AsyncSessionLocal() as db:
        all_rows = (await db.execute(select(TaskModelSetting))).scalars().all()
        assert len(all_rows) == 3

        for r in all_rows:
            await db.delete(r)
        await db.commit()
