import pytest
import uuid
import json
from datetime import datetime

from cognizes.core.database import DatabaseManager
from cognizes.engine.hippocampus.consolidation_worker import MemoryConsolidationWorker, JobType, JobStatus


@pytest.mark.asyncio
async def test_consolidation_flow_with_repos():
    # 1. Initialize DatabaseManager and Worker
    db = DatabaseManager()
    # await db.initialize()  # Removed: DatabaseManager uses lazy initialization
    worker = MemoryConsolidationWorker(db)

    # Generate unique IDs
    thread_id = uuid.uuid4()
    user_id = str(uuid.uuid4())
    app_name = "test_app"

    # 2. Setup Test Data (Thread and Events)
    # Create thread
    async with db.acquire() as conn:
        await conn.execute(
            "INSERT INTO threads (id, user_id, app_name, state, version) VALUES ($1, $2, $3, $4, $5)",
            thread_id,
            user_id,
            app_name,
            json.dumps({"status": "active"}),
            1,
        )

    # Create events (User and Assistant exchange)
    events = [
        ("user", "Hello, I am testing the memory system.", 1),
        ("assistant", "Hello! I am ready to consolidate your memories.", 2),
        ("user", "My favorite color is blue.", 3),
    ]

    for author, content, seq in events:
        await db.events.insert(
            event_id=uuid.uuid4(),
            thread_id=thread_id,
            invocation_id=uuid.uuid4(),
            author=author,
            event_type="message",
            content=content,
            actions={},
        )

    # 3. Execute Consolidation
    # We mock the LLM generation to avoid actual API calls and save cost/time
    # Mocking _generate_summary
    async def mock_generate_summary(content):
        return f"Summary of: {content[:20]}..."

    worker._generate_summary = mock_generate_summary

    # Mocking _generate_embedding
    async def mock_generate_embedding(text):
        return [0.1] * 1536

    worker._generate_embedding = mock_generate_embedding

    # Mocking _extract_facts
    async def mock_extract_facts(text):
        return {"facts": [{"type": "user_preference", "key": "favorite_color", "value": "blue", "confidence": 0.9}]}

    worker._extract_facts = mock_extract_facts

    # Run consolidation
    job = await worker.consolidate(str(thread_id), JobType.FULL_CONSOLIDATION)

    # 4. Verify Results

    # Verify Job Status
    assert job.status == JobStatus.COMPLETED

    # Verify Memory Created (Summary)
    memories = await db.memories.list_recent(user_id=user_id, app_name=app_name, limit=10)
    summary_memories = [m for m in memories if m["memory_type"] == "summary"]
    assert len(summary_memories) > 0
    metadata = summary_memories[0]["metadata"]
    if isinstance(metadata, str):
        metadata = json.loads(metadata)
    assert metadata["source"] == "fast_replay"

    # Verify Facts Created
    facts = await db.facts.search(user_id=user_id, app_name=app_name, query_embedding=[0.1] * 1536, limit=10)
    # Note: search uses vector search, so our mock embedding should find it if similarity works,
    # but exact match might be better for test.
    # Let's use direct DB query to verify exact fact
    query = "SELECT * FROM facts WHERE user_id = $1 AND key = $2"
    async with db.acquire() as conn:
        fact_record = await conn.fetchrow(query, user_id, "favorite_color")
        assert fact_record is not None
        assert fact_record["value"] == '"blue"'  # jsonb stores as string "blue" or just string? check upsert logic.
        # upsert logic: json.dumps(value). if value is "blue", it stores "blue".
        # wait, value in create facts is dict usually?
        # In _extract_facts mock above I returned "blue" as value.
        # Let's check consolidation worker usage.
        # It passes `value=fact["value"]`.
        # So if value is string "blue", it dumps it.

    print("Test passed!")
