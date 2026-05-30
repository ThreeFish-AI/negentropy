"""T4-F2 — Reflexion 失败反思端到端集成测试（真实 PostgreSQL）。

补足空白：现有单测覆盖 record_feedback 触发分支 / 风暴上限 / 去重，但无「负反馈
→ 真正写入一条 episodic/subtype=reflection 记忆」的端到端验证。本测试证明
``reflection.enabled=true`` 时 Reflexion 闭环真实落库。

离线确定性：未配 LLM key 时 ReflectionGenerator 自动回退 pattern 模板（method=pattern），
无需网络。

锚点：retrieval_tracker.log_retrieval / record_feedback / get_pending_reflection_tasks；
reflection_worker._write_reflection（memory_type=episodic, metadata.subtype=reflection）。
"""

from __future__ import annotations

import asyncio
import uuid

import pytest
from sqlalchemy import delete, select

import negentropy.db.session as db_session
from negentropy.config._base import reset_sections, set_yaml_section
from negentropy.engine.adapters.postgres.memory_service import PostgresMemoryService
from negentropy.engine.adapters.postgres.retrieval_tracker import (
    RetrievalTracker,
    get_pending_reflection_tasks,
)
from negentropy.models.internalization import Memory, MemoryRetrievalLog


async def _embedding_fn(text: str) -> list[float]:
    return [0.12] * 1536


def _invalidate_memory_settings_cache() -> None:
    from negentropy.config import settings as global_settings

    global_settings.__dict__.pop("memory", None)


@pytest.fixture
def _reflection_on():
    reset_sections()
    set_yaml_section(
        "memory",
        {"reflection": {"enabled": True, "daily_limit_per_user": 10, "max_inflight_tasks": 8, "dedup_cosine": 0.92}},
    )
    _invalidate_memory_settings_cache()
    yield
    reset_sections()
    _invalidate_memory_settings_cache()


@pytest.fixture(autouse=True)
def _postgres_memory_singleton():
    """反思 worker 经 ``get_memory_service()`` 解析后端；测试会话内该单例可能被其它
    测试污染成 InMemory。这里强制预热为 Postgres 单例，确保 worker 写入真实 DB
    （生产 memory_backend=postgres，与此一致）。"""
    from negentropy.engine.factories.memory import get_memory_service, reset_memory_service

    reset_memory_service()
    # 预热：缓存一个 embedding_fn 注入的 Postgres 单例，供 worker 解析复用
    pg = get_memory_service("postgres")
    pg._embedding_fn = _embedding_fn  # type: ignore[attr-defined]
    import negentropy.engine.factories.memory as mem_factory

    mem_factory._memory_service_instance = pg
    yield
    reset_memory_service()


async def _seed_thread(thread_id: uuid.UUID, app_name: str, user_id: str) -> None:
    async with db_session.AsyncSessionLocal() as db:
        from negentropy.models.pulse import Thread

        db.add(Thread(id=thread_id, app_name=app_name, user_id=user_id, state={}))
        await db.commit()


async def _cleanup(user_id: str, app_name: str) -> None:
    async with db_session.AsyncSessionLocal() as db:
        await db.execute(
            delete(MemoryRetrievalLog).where(
                MemoryRetrievalLog.user_id == user_id, MemoryRetrievalLog.app_name == app_name
            )
        )
        await db.execute(delete(Memory).where(Memory.user_id == user_id, Memory.app_name == app_name))
        await db.commit()


async def _await_pending_reflection(timeout: float = 10.0) -> None:
    """等待后台反思任务完成（fire-and-forget，需显式 await 才能断言落库）。"""
    tasks = list(get_pending_reflection_tasks())
    if tasks:
        await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), timeout=timeout)


@pytest.mark.asyncio
async def test_negative_feedback_writes_reflection_memory(_reflection_on, monkeypatch):
    """一次 irrelevant 反馈 → 写入一条 episodic/subtype=reflection 记忆。

    强制走 pattern fallback：测试环境 DB 可能配了真实 reflection 模型，直连 LLM 会
    慢/超时且不确定。这里让 LLM 路径快速失败，验证「生成→落库」骨架（与生成方式无关）。
    """
    # 直接让 generate 返回确定性 pattern 反思，绕过真实 LLM + 退避耗时（保证 <3min 预算）。
    from negentropy.engine.consolidation.reflection_generator import Reflection

    async def _deterministic_generate(self, *, query, retrieved_snippets, outcome):  # noqa: ANN001
        return Reflection(
            lesson=f"对『{query[:20]}』类查询，避免召回不相关记忆",
            applicable_when=[query[:10]],
            anti_examples=[],
            method="pattern",
        )

    monkeypatch.setattr(
        "negentropy.engine.consolidation.reflection_generator.ReflectionGenerator.generate",
        _deterministic_generate,
    )

    app_name = "t4_reflexion"
    user_id = f"reflexion_{uuid.uuid4().hex[:8]}"
    thread_id = uuid.uuid4()
    await _cleanup(user_id, app_name)
    await _seed_thread(thread_id, app_name, user_id)
    service = PostgresMemoryService(embedding_fn=_embedding_fn)

    # 1. 种一条记忆并写检索日志（反思 worker 需从 log 拉 query + snippets）
    res = await service.add_memory_typed(
        user_id=user_id,
        app_name=app_name,
        thread_id=thread_id,
        content="部署到 staging 用 kubectl apply",
        memory_type="procedural",
    )
    mem_id = uuid.UUID(res["id"])

    tracker = RetrievalTracker()
    log_id = await tracker.log_retrieval(
        user_id=user_id,
        app_name=app_name,
        query="如何回滚生产环境",
        memory_ids=[mem_id],
        thread_id=thread_id,
    )
    assert log_id is not None

    # 2. 记录 irrelevant 反馈 → 触发后台反思任务
    ok = await tracker.record_feedback(log_id, "irrelevant")
    assert ok

    # 3. 等待后台任务完成
    await _await_pending_reflection()

    # 4. 断言一条 reflection 记忆已落库
    async with db_session.AsyncSessionLocal() as db:
        rows = (
            (
                await db.execute(
                    select(Memory).where(
                        Memory.user_id == user_id,
                        Memory.app_name == app_name,
                        Memory.memory_type == "episodic",
                    )
                )
            )
            .scalars()
            .all()
        )

    reflections = [m for m in rows if (m.metadata_ or {}).get("subtype") == "reflection"]
    assert reflections, "irrelevant 反馈应写入一条 subtype=reflection 的 episodic 记忆"
    refl = reflections[0]
    assert refl.metadata_.get("outcome") == "irrelevant"
    assert refl.metadata_.get("created_by") == "reflexion_v1"
    assert refl.content, "反思应有 lesson 内容"

    await _cleanup(user_id, app_name)


@pytest.mark.asyncio
async def test_helpful_feedback_writes_no_reflection(_reflection_on):
    """helpful 反馈不触发反思（仅 irrelevant/harmful 触发）。"""
    app_name = "t4_reflexion_pos"
    user_id = f"reflexion_pos_{uuid.uuid4().hex[:8]}"
    thread_id = uuid.uuid4()
    await _cleanup(user_id, app_name)
    await _seed_thread(thread_id, app_name, user_id)
    service = PostgresMemoryService(embedding_fn=_embedding_fn)

    res = await service.add_memory_typed(
        user_id=user_id,
        app_name=app_name,
        thread_id=thread_id,
        content="some memory",
        memory_type="semantic",
    )
    tracker = RetrievalTracker()
    log_id = await tracker.log_retrieval(
        user_id=user_id,
        app_name=app_name,
        query="q",
        memory_ids=[uuid.UUID(res["id"])],
        thread_id=thread_id,
    )
    await tracker.record_feedback(log_id, "helpful")
    await _await_pending_reflection()

    async with db_session.AsyncSessionLocal() as db:
        rows = (
            (
                await db.execute(
                    select(Memory).where(
                        Memory.user_id == user_id,
                        Memory.app_name == app_name,
                        Memory.memory_type == "episodic",
                    )
                )
            )
            .scalars()
            .all()
        )
    reflections = [m for m in rows if (m.metadata_ or {}).get("subtype") == "reflection"]
    assert not reflections, "helpful 反馈不应触发反思生成"

    await _cleanup(user_id, app_name)
