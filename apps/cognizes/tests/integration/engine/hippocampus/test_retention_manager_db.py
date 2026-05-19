"""
记忆保持管理器集成测试

测试 MemoryRetentionManager 与数据库的交互:
- 访问记录更新
- 保留分数分布查询
- 低价值记忆清理
"""

import uuid
from datetime import datetime, timedelta

import pytest

pytestmark = pytest.mark.asyncio


class TestRetentionManagerDB:
    """RetentionManager 数据库集成测试"""

    async def test_retention_score_distribution(
        self,
        integration_db,
        integration_thread,
        clean_integration_data,
    ):
        """测试保留分数分布查询"""
        user_id = integration_thread["user_id"]
        app_name = integration_thread["app_name"]
        thread_id = uuid.UUID(integration_thread["thread_id"])

        # 插入不同保留分数的记忆
        async with integration_db.acquire() as conn:
            scores = [
                0.9,  # high
                0.8,  # high
                0.5,  # medium
                0.4,  # medium
                0.2,  # low
            ]
            for i, score in enumerate(scores):
                memory_id = uuid.uuid4()
                await conn.execute(
                    """
                    INSERT INTO memories (id, thread_id, user_id, app_name, memory_type, content, retention_score)
                    VALUES ($1, $2, $3, $4, 'episodic', $5, $6)
                """,
                    memory_id,
                    thread_id,
                    user_id,
                    app_name,
                    f"分布测试 {i}",
                    score,
                )
                clean_integration_data["memories"].append(memory_id)

        # 查询分布
        async with integration_db.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT
                    COUNT(*) FILTER (WHERE retention_score >= 0.7) AS high,
                    COUNT(*) FILTER (WHERE retention_score >= 0.3 AND retention_score < 0.7) AS medium,
                    COUNT(*) FILTER (WHERE retention_score < 0.3) AS low
                FROM memories
                WHERE user_id = $1 AND app_name = $2
            """,
                user_id,
                app_name,
            )

        assert row["high"] == 2
        assert row["medium"] == 2
        assert row["low"] == 1

    async def test_access_count_increment(
        self,
        integration_db,
        integration_thread,
        clean_integration_data,
    ):
        """测试访问计数递增"""
        user_id = integration_thread["user_id"]
        app_name = integration_thread["app_name"]
        thread_id = uuid.UUID(integration_thread["thread_id"])

        memory_id = uuid.uuid4()
        async with integration_db.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO memories (id, thread_id, user_id, app_name, memory_type, content, access_count)
                VALUES ($1, $2, $3, $4, 'episodic', '访问测试', 0)
            """,
                memory_id,
                thread_id,
                user_id,
                app_name,
            )

        clean_integration_data["memories"].append(memory_id)

        # 模拟多次访问
        async with integration_db.acquire() as conn:
            for _ in range(5):
                await conn.execute(
                    """
                    UPDATE memories
                    SET access_count = access_count + 1,
                        last_accessed_at = NOW()
                    WHERE id = $1
                """,
                    memory_id,
                )

            row = await conn.fetchrow("SELECT access_count FROM memories WHERE id = $1", memory_id)

        assert row["access_count"] == 5

    async def test_retention_score_calculation_function(
        self,
        integration_db,
    ):
        """测试保留分数计算函数"""
        async with integration_db.acquire() as conn:
            # 测试新访问的高分记忆
            score_new = await conn.fetchval("""
                SELECT calculate_retention_score(10, NOW(), 0.1)
            """)
            assert score_new > 0.5, "新访问记忆应有较高分数"

            # 测试 30 天前的记忆
            score_old = await conn.fetchval("""
                SELECT calculate_retention_score(1, NOW() - INTERVAL '30 days', 0.1)
            """)
            assert score_old < score_new, "旧记忆分数应低于新记忆"


# 运行: uv run pytest tests/integration/hippocampus/test_retention_manager_db.py -v -s
