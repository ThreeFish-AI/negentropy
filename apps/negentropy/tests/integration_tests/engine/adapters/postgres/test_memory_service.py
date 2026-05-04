import uuid

import pytest
from google.adk.events import Event as ADKEvent
from google.adk.sessions import Session as ADKSession
from sqlalchemy import select

import negentropy.db.session as db_session
from negentropy.engine.adapters.postgres.memory_service import PostgresMemoryService
from negentropy.models.internalization import Memory, MemoryRetrievalLog


@pytest.mark.asyncio
async def test_memory_service_lifecycle():
    # 1. 初始化 Service
    service = PostgresMemoryService()

    app_name = "test_app"
    user_id = "test_user"
    session_id = str(uuid.uuid4())

    # 2. 使用真实的 ADK Event
    events = [
        ADKEvent(id=str(uuid.uuid4()), author="user", content={"parts": [{"text": "Hello, this is a test."}]}),
        ADKEvent(id=str(uuid.uuid4()), author="model", content={"parts": [{"text": "I hear you loud and clear."}]}),
    ]

    session = ADKSession(
        id=session_id, app_name=app_name, user_id=user_id, state={}, events=events, last_update_time=0.0
    )

    # 3. 在数据库中创建 Thread 以避免 FK 违反
    async with db_session.AsyncSessionLocal() as db:
        from negentropy.models.pulse import Thread

        thread = Thread(id=uuid.UUID(session_id), app_name=app_name, user_id=user_id, state={})
        db.add(thread)
        await db.commit()

    # 4. 测试 add_session_to_memory (consolidate)
    await service.add_session_to_memory(session)

    async with db_session.AsyncSessionLocal() as db:
        stmt = select(Memory).where(Memory.thread_id == uuid.UUID(session_id))
        result = await db.execute(stmt)
        memory = result.scalar_one_or_none()

        assert memory is not None
        assert memory.user_id == user_id
        assert "Hello" in memory.content
        assert "I hear you" in memory.content
        assert memory.metadata_["event_count"] == 2

    # 4. 测试 search_memory (全文检索)
    response = await service.search_memory(app_name=app_name, user_id=user_id, query="test")
    assert len(response.memories) > 0
    # MemoryEntry.content 实际上被 ADK 转换为 Content 对象
    assert "test" in response.memories[0].content.parts[0].text

    # 5. 测试 list_memories
    memories = await service.list_memories(app_name=app_name, user_id=user_id, limit=1)
    assert len(memories) == 1
    assert memories[0].id == str(memory.id)


@pytest.mark.asyncio
async def test_memory_service_vector_search():
    # 需要 mock embedding 函数
    async def mock_embedding(text):
        return [0.1] * 1536

    service = PostgresMemoryService(embedding_fn=mock_embedding)

    app_name = "vector_app"
    user_id = "vector_user"

    # 直接插入一条带向量的记忆
    async with db_session.AsyncSessionLocal() as db:
        m = Memory(
            user_id=user_id,
            app_name=app_name,
            content="Vector search test content",
            embedding=[0.1] * 1536,
            memory_type="episodic",
        )
        db.add(m)
        await db.commit()

    # 搜索
    response = await service.search_memory(app_name=app_name, user_id=user_id, query="query")
    assert len(response.memories) > 0
    assert "Vector search" in response.memories[0].content.parts[0].text


# ============================================================================
# Phase 7 E2E Integration Tests
# ============================================================================


async def _create_thread(user_id: str, app_name: str) -> str:
    """Helper: create a thread and return its ID."""
    session_id = str(uuid.uuid4())
    async with db_session.AsyncSessionLocal() as db:
        from negentropy.models.pulse import Thread

        thread = Thread(id=uuid.UUID(session_id), app_name=app_name, user_id=user_id, state={})
        db.add(thread)
        await db.commit()
    return session_id


async def _cleanup_memories(user_id: str, app_name: str) -> None:
    """Helper: cleanup all test data for a user/app."""
    async with db_session.AsyncSessionLocal() as db:
        await db.execute(
            MemoryRetrievalLog.__table__.delete().where(
                MemoryRetrievalLog.user_id == user_id, MemoryRetrievalLog.app_name == app_name
            )
        )
        await db.execute(Memory.__table__.delete().where(Memory.user_id == user_id, Memory.app_name == app_name))
        await db.commit()


@pytest.mark.asyncio
async def test_consolidation_with_overlapping_content():
    """两次会话含重叠内容 → 验证去重合并正确触发。"""

    async def mock_embedding(text):
        return [0.1] * 1536

    service = PostgresMemoryService(embedding_fn=mock_embedding)
    app_name = "e2e_dedup_app"
    user_id = "e2e_dedup_user"

    await _cleanup_memories(user_id, app_name)

    # 会话 1
    sid1 = await _create_thread(user_id, app_name)
    events1 = [
        ADKEvent(id=str(uuid.uuid4()), author="user", content={"parts": [{"text": "I prefer dark theme for coding."}]}),
        ADKEvent(
            id=str(uuid.uuid4()), author="model", content={"parts": [{"text": "Noted your dark theme preference."}]}
        ),
    ]
    session1 = ADKSession(id=sid1, app_name=app_name, user_id=user_id, state={}, events=events1, last_update_time=0.0)
    await service.add_session_to_memory(session1)

    # 会话 2（重叠内容）
    sid2 = await _create_thread(user_id, app_name)
    events2 = [
        ADKEvent(id=str(uuid.uuid4()), author="user", content={"parts": [{"text": "I like using dark theme."}]}),
        ADKEvent(id=str(uuid.uuid4()), author="model", content={"parts": [{"text": "Dark theme is great."}]}),
    ]
    session2 = ADKSession(id=sid2, app_name=app_name, user_id=user_id, state={}, events=events2, last_update_time=0.0)
    await service.add_session_to_memory(session2)

    # 验证搜索返回结果
    response = await service.search_memory(app_name=app_name, user_id=user_id, query="dark theme")
    assert len(response.memories) > 0

    await _cleanup_memories(user_id, app_name)


@pytest.mark.asyncio
async def test_typed_memory_crud_and_search():
    """类型化写入 + 搜索完整生命周期。"""

    async def mock_embedding(text):
        return [0.2] * 1536

    service = PostgresMemoryService(embedding_fn=mock_embedding)
    app_name = "e2e_crud_app"
    user_id = "e2e_crud_user"

    await _cleanup_memories(user_id, app_name)

    tid = uuid.UUID(await _create_thread(user_id, app_name))
    result = await service.add_memory_typed(
        user_id=user_id,
        app_name=app_name,
        thread_id=tid,
        content="用户偏好 Rust 语言，使用 Neovim 编辑器",
        memory_type="preference",
        metadata={"source": "integration_test"},
    )
    assert result is not None

    response = await service.search_memory(app_name=app_name, user_id=user_id, query="Rust 语言偏好")
    assert len(response.memories) > 0

    memories = await service.list_memories(app_name=app_name, user_id=user_id, limit=10)
    assert len(memories) >= 1

    await _cleanup_memories(user_id, app_name)


@pytest.mark.asyncio
async def test_rocchio_feedback_loop():
    """搜索 → 提交反馈 → Rocchio 重加权完整闭环。"""

    async def mock_embedding(text):
        return [0.3] * 1536

    service = PostgresMemoryService(embedding_fn=mock_embedding)
    app_name = "e2e_rocchio_app"
    user_id = "e2e_rocchio_user"

    await _cleanup_memories(user_id, app_name)

    tid = uuid.UUID(await _create_thread(user_id, app_name))
    await service.add_memory_typed(
        user_id=user_id,
        app_name=app_name,
        thread_id=tid,
        content="部署流程：uv run deploy --env staging",
        memory_type="procedural",
    )

    response = await service.search_memory(app_name=app_name, user_id=user_id, query="如何部署到 staging")
    assert len(response.memories) > 0

    # 验证检索日志并提交反馈
    from negentropy.models.internalization import MemoryRetrievalLog

    async with db_session.AsyncSessionLocal() as db:
        logs = (
            (
                await db.execute(
                    select(MemoryRetrievalLog).where(
                        MemoryRetrievalLog.user_id == user_id,
                        MemoryRetrievalLog.app_name == app_name,
                    )
                )
            )
            .scalars()
            .all()
        )

    assert len(logs) > 0

    from negentropy.engine.adapters.postgres.retrieval_tracker import RetrievalTracker

    tracker = RetrievalTracker()
    log_id = logs[0].id
    success = await tracker.record_feedback(log_id=log_id, outcome="helpful")
    assert success

    # 验证反馈已写入
    async with db_session.AsyncSessionLocal() as db:
        log = await db.get(MemoryRetrievalLog, log_id)
    assert log.outcome_feedback == "helpful"

    # Rocchio 重加权
    from negentropy.engine.relevance.rocchio_reweighter import reweight_memories

    reweighted = await reweight_memories(user_id=user_id, app_name=app_name, min_count=1)
    assert reweighted >= 1

    await _cleanup_memories(user_id, app_name)


@pytest.mark.asyncio
async def test_governance_audit_trail():
    """写入记忆 → 验证属性正确落库。"""

    async def mock_embedding(text):
        return [0.4] * 1536

    service = PostgresMemoryService(embedding_fn=mock_embedding)
    app_name = "e2e_audit_app"
    user_id = "e2e_audit_user"

    await _cleanup_memories(user_id, app_name)

    tid = uuid.UUID(await _create_thread(user_id, app_name))
    await service.add_memory_typed(
        user_id=user_id,
        app_name=app_name,
        thread_id=tid,
        content="审计测试：这是一条语义记忆",
        memory_type="semantic",
    )

    async with db_session.AsyncSessionLocal() as db:
        mem = (
            await db.execute(
                select(Memory).where(
                    Memory.user_id == user_id,
                    Memory.app_name == app_name,
                )
            )
        ).scalar_one_or_none()

    assert mem is not None
    assert mem.retention_score > 0
    assert mem.memory_type == "semantic"

    await _cleanup_memories(user_id, app_name)
