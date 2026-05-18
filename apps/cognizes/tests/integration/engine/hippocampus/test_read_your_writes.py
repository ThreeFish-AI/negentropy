"""
Read-Your-Writes 延迟测试 (集成测试)

验证新写入的记忆能否在下一个 Turn 立即可见，
确保我们的 Zero-ETL 架构比 Google 方案更快。

验收标准: 延迟 < 100ms

对应任务: P2-2-13, P2-2-14
"""

import json
import time
import uuid
from statistics import mean, stdev

import pytest

# 跳过如果没有数据库连接
pytestmark = pytest.mark.asyncio


class TestReadYourWrites:
    """Read-Your-Writes 延迟测试套件"""

    async def test_memory_write_then_read_latency(
        self,
        integration_db,
        integration_thread,
        clean_integration_data,
    ):
        """
        验证记忆写入后立即可读

        流程:
        1. 直接插入记忆 (模拟巩固写入)
        2. 立即查询该记忆
        3. 测量延迟
        """
        user_id = integration_thread["user_id"]
        app_name = integration_thread["app_name"]
        thread_id = uuid.UUID(integration_thread["thread_id"])

        latencies = []

        for i in range(10):
            memory_id = uuid.uuid4()
            content = f"测试记忆内容 {i} - {uuid.uuid4().hex}"

            # 写入记忆
            async with integration_db.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO memories (id, thread_id, user_id, app_name, memory_type, content)
                    VALUES ($1, $2, $3, $4, 'episodic', $5)
                """,
                    memory_id,
                    thread_id,
                    user_id,
                    app_name,
                    content,
                )

            clean_integration_data["memories"].append(memory_id)

            # 立即读取并测量延迟
            start = time.perf_counter()
            async with integration_db.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT id, content FROM memories WHERE id = $1
                """,
                    memory_id,
                )
            end = time.perf_counter()

            latency_ms = (end - start) * 1000
            latencies.append(latency_ms)

            # 验证内容正确
            assert row is not None, "记忆应立即可见"
            assert row["content"] == content

        # 统计结果
        avg_latency = mean(latencies)
        p99_latency = sorted(latencies)[int(len(latencies) * 0.99)]

        print(f"\n=== Read-Your-Writes 延迟测试结果 ===")
        print(f"平均延迟: {avg_latency:.2f} ms")
        print(f"P99 延迟: {p99_latency:.2f} ms")
        print(f"标准差: {stdev(latencies):.2f} ms")

        # 验收标准: P99 < 100ms
        assert p99_latency < 100, f"P99 延迟 {p99_latency:.2f}ms 超过 100ms 阈值"

    async def test_fact_upsert_visibility(
        self,
        integration_db,
        integration_thread,
        clean_integration_data,
    ):
        """
        验证 Fact Upsert 后立即可见

        测试 ON CONFLICT 更新后的可见性
        """
        user_id = integration_thread["user_id"]
        app_name = integration_thread["app_name"]
        thread_id = uuid.UUID(integration_thread["thread_id"])

        fact_id = uuid.uuid4()
        fact_key = f"test_fact_{uuid.uuid4().hex[:8]}"

        # 第一次插入
        async with integration_db.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO facts (id, thread_id, user_id, app_name, fact_type, key, value)
                VALUES ($1, $2, $3, $4, 'preference', $5, '{"version": 1}')
                ON CONFLICT (user_id, app_name, fact_type, key)
                DO UPDATE SET value = EXCLUDED.value
            """,
                fact_id,
                thread_id,
                user_id,
                app_name,
                fact_key,
            )

        clean_integration_data["facts"].append(fact_id)

        # 立即更新 (Upsert)
        start = time.perf_counter()
        async with integration_db.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO facts (id, thread_id, user_id, app_name, fact_type, key, value)
                VALUES ($1, $2, $3, $4, 'preference', $5, '{"version": 2}')
                ON CONFLICT (user_id, app_name, fact_type, key)
                DO UPDATE SET value = EXCLUDED.value
            """,
                uuid.uuid4(),
                thread_id,
                user_id,
                app_name,
                fact_key,
            )

            # 立即读取
            row = await conn.fetchrow(
                """
                SELECT value FROM facts
                WHERE user_id = $1 AND app_name = $2 AND key = $3
            """,
                user_id,
                app_name,
                fact_key,
            )
        end = time.perf_counter()

        latency_ms = (end - start) * 1000

        print(f"\n=== Fact Upsert 延迟: {latency_ms:.2f} ms ===")

        # 验证更新值可见
        assert row is not None
        value = row["value"]
        if isinstance(value, str):
            value = json.loads(value)
        assert value["version"] == 2
        assert latency_ms < 100


# 运行: uv run pytest tests/integration/engine/hippocampus/test_read_your_writes.py -v -s
