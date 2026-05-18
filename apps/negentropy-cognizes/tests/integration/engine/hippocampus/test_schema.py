"""
Hippocampus Schema 集成测试

验证 Schema 部署正确性:
- 表结构
- 索引
- 函数
- 约束
"""

import uuid
from datetime import datetime

import pytest

pytestmark = [pytest.mark.asyncio(loop_scope="function")]


class TestHippocampusSchema:
    """Hippocampus Schema 集成测试"""

    async def test_memories_table_exists(self, integration_db):
        """验证 memories 表存在"""
        async with integration_db.acquire() as conn:
            exists = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_name = 'memories'
                )
            """)
        assert exists, "memories 表应存在"

    async def test_facts_table_exists(self, integration_db):
        """验证 facts 表存在"""
        async with integration_db.acquire() as conn:
            exists = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_name = 'facts'
                )
            """)
        assert exists, "facts 表应存在"

    async def test_consolidation_jobs_table_exists(self, integration_db):
        """验证 consolidation_jobs 表存在"""
        async with integration_db.acquire() as conn:
            exists = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_name = 'consolidation_jobs'
                )
            """)
        assert exists, "consolidation_jobs 表应存在"

    async def test_instructions_table_exists(self, integration_db):
        """验证 instructions 表存在"""
        async with integration_db.acquire() as conn:
            exists = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_name = 'instructions'
                )
            """)
        assert exists, "instructions 表应存在"

    async def test_calculate_retention_score_function(self, integration_db):
        """验证 calculate_retention_score 函数存在且可用"""
        async with integration_db.acquire() as conn:
            # 测试函数调用
            score = await conn.fetchval("""
                SELECT calculate_retention_score(5, NOW() - INTERVAL '3 days', 0.1)
            """)
            assert score is not None
            assert 0 <= score <= 1

    async def test_cleanup_low_value_memories_function(self, integration_db):
        """验证 cleanup_low_value_memories 函数存在"""
        async with integration_db.acquire() as conn:
            exists = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT FROM pg_proc
                    WHERE proname = 'cleanup_low_value_memories'
                )
            """)
        assert exists, "cleanup_low_value_memories 函数应存在"

    async def test_vector_extension_enabled(self, integration_db):
        """验证 vector 扩展已启用"""
        async with integration_db.acquire() as conn:
            exists = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT FROM pg_extension WHERE extname = 'vector'
                )
            """)
        assert exists, "vector 扩展应已启用"

    async def test_memories_embedding_column(self, integration_db):
        """验证 memories.embedding 列类型正确"""
        async with integration_db.acquire() as conn:
            col_type = await conn.fetchval("""
                SELECT data_type
                FROM information_schema.columns
                WHERE table_name = 'memories' AND column_name = 'embedding'
            """)
        assert col_type == "USER-DEFINED", "embedding 列应为 vector 类型"

    async def test_facts_unique_constraint(self, integration_db, integration_thread):
        """验证 facts 表的唯一约束"""
        user_id = integration_thread["user_id"]
        app_name = integration_thread["app_name"]
        thread_id = uuid.UUID(integration_thread["thread_id"])

        fact_key = f"constraint_test_{uuid.uuid4().hex[:8]}"
        fact_id1 = uuid.uuid4()

        async with integration_db.acquire() as conn:
            # 第一次插入
            await conn.execute(
                """
                INSERT INTO facts (id, thread_id, user_id, app_name, fact_type, key, value)
                VALUES ($1, $2, $3, $4, 'preference', $5, '{"v": 1}')
            """,
                fact_id1,
                thread_id,
                user_id,
                app_name,
                fact_key,
            )

            # 第二次插入相同 key (应触发 ON CONFLICT)
            await conn.execute(
                """
                INSERT INTO facts (id, thread_id, user_id, app_name, fact_type, key, value)
                VALUES ($1, $2, $3, $4, 'preference', $5, '{"v": 2}')
                ON CONFLICT (user_id, app_name, fact_type, key)
                DO UPDATE SET value = EXCLUDED.value
            """,
                uuid.uuid4(),
                thread_id,
                user_id,
                app_name,
                fact_key,
            )

            # 验证只有一条记录且值已更新
            count = await conn.fetchval(
                """
                SELECT COUNT(*) FROM facts
                WHERE user_id = $1 AND app_name = $2 AND key = $3
            """,
                user_id,
                app_name,
                fact_key,
            )

            value = await conn.fetchval(
                """
                SELECT value FROM facts
                WHERE user_id = $1 AND app_name = $2 AND key = $3
            """,
                user_id,
                app_name,
                fact_key,
            )

            # 清理
            await conn.execute("DELETE FROM facts WHERE id = $1", fact_id1)

        assert count == 1, "应只有一条记录"
        # asyncpg 可能返回字符串或 dict，需要处理
        import json

        if isinstance(value, str):
            value = json.loads(value)
        assert value["v"] == 2, "值应已更新"


# 运行: uv run pytest tests/integration/hippocampus/test_schema.py -v -s
