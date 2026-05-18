import asyncio
import argparse
import asyncpg
import uuid
import random
from datetime import datetime, timedelta

DB_URL = "postgresql://aigc:@localhost/cognizes-engine"
USER_ID = "perf_test_user"
APP_NAME = "perf_test_app"


async def cleanup():
    """清理性能测试数据"""
    print(f"Connecting to {DB_URL}...")
    pool = await asyncpg.create_pool(DB_URL)

    async with pool.acquire() as conn:
        # 统计现有数据
        count = await conn.fetchval("SELECT COUNT(*) FROM memories WHERE user_id = $1", USER_ID)
        if count == 0:
            print("✓ 无历史测试数据，无需清理")
        else:
            # 清理性能测试数据
            deleted = await conn.fetchval(
                """
                DELETE FROM memories WHERE user_id = $1
            """,
                USER_ID,
            )
            # Since DELETE returns "DELETE <count>", we can trust it worked.
            # But fetchval might return None if no rows returned? DELETE usually returns tag.
            # Let's check count again to be sure or just print message.
            print(f"✓ 已清理历史测试数据 (Pre-cleaning count: {count})")

    await pool.close()


async def seed(target_count=100000):
    """生成大规模测试数据"""
    print(f"Connecting to {DB_URL}...")
    pool = await asyncpg.create_pool(DB_URL)

    async with pool.acquire() as conn:
        count = await conn.fetchval("SELECT COUNT(*) FROM memories WHERE user_id = $1", USER_ID)
        if count >= target_count:
            print(f"已有 {count} 条数据，跳过生成")
            await pool.close()
            return

        needed = target_count - count
        print(f"当前 {count} 条，即将生成 {needed} 条测试数据...")

        batch_size = 1000
        base_time = datetime.now() - timedelta(days=365)

        total_batches = (needed + batch_size - 1) // batch_size

        for batch in range(total_batches):
            rows = []
            current_batch_size = min(batch_size, needed - batch * batch_size)

            for i in range(current_batch_size):
                created_at = base_time + timedelta(minutes=random.randint(0, 525600))
                rows.append(
                    (
                        uuid.uuid4(),
                        USER_ID,
                        APP_NAME,
                        "episodic",
                        f"测试记忆 {batch * batch_size + i}",
                        random.random(),
                        random.randint(0, 100),
                        created_at,
                    )
                )

            await conn.executemany(
                """
                INSERT INTO memories (id, user_id, app_name, memory_type, content,
                                     retention_score, access_count, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """,
                rows,
            )

            if (batch + 1) % 10 == 0 or (batch + 1) == total_batches:
                print(f"  已插入 {(batch * batch_size) + current_batch_size} / {needed}")

    await pool.close()
    print("✓ 数据生成完成")


async def main():
    parser = argparse.ArgumentParser(description="Hippocampus Performance Test Data Manager")
    parser.add_argument("--action", choices=["cleanup", "seed", "all"], default="all", help="Action to perform")
    parser.add_argument("--count", type=int, default=100000, help="Target record count for seeding")
    args = parser.parse_args()

    if args.action in ["cleanup", "all"]:
        await cleanup()

    if args.action in ["seed", "all"]:
        await seed(args.count)


if __name__ == "__main__":
    asyncio.run(main())
