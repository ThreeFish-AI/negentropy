import pytest
import uuid
from google.adk.sessions import Session as ADKSession
from google.adk.events import Event as ADKEvent
from negentropy.engine.adapters.postgres.memory_service import PostgresMemoryService
import negentropy.db.session as db_session
from negentropy.models.hippocampus import Memory
from sqlalchemy import select


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
    # 需要一个 mock embedding 函数
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
