"""
测试数据初始化脚本
"""

import asyncio
import json

from cognizes.core.database import DatabaseManager

# 目的地测试数据
DESTINATIONS_DATA = [
    {
        "id": "dest_001",
        "name": "巴厘岛",
        "country": "印度尼西亚",
        "description": "印度尼西亚著名海岛度假胜地，以美丽沙滩、水上活动和文化体验闻名。",
        "tags": ["海岛", "度假", "潜水", "SPA", "蜜月"],
        "climate": "热带",
        "best_season": "4月-10月",
        "avg_cost_per_day": 800,
    },
    {
        "id": "dest_002",
        "name": "京都",
        "country": "日本",
        "description": "日本古都，保留大量历史寺庙和传统文化，是体验日本文化的最佳目的地。",
        "tags": ["文化", "古迹", "樱花", "美食", "温泉"],
        "climate": "温带",
        "best_season": "3月-5月, 10月-11月",
        "avg_cost_per_day": 1200,
    },
    {
        "id": "dest_003",
        "name": "瑞士少女峰",
        "country": "瑞士",
        "description": "欧洲屋脊，阿尔卑斯山脉最壮观的山峰之一，滑雪和徒步天堂。",
        "tags": ["滑雪", "雪山", "徒步", "自然", "火车"],
        "climate": "高山",
        "best_season": "12月-3月(滑雪), 6月-9月(徒步)",
        "avg_cost_per_day": 2000,
    },
]

# 用户偏好测试数据
USER_PREFERENCES = [
    {"user_id": "demo_user", "preference": "I don't like spicy food", "category": "food"},
    {"user_id": "demo_user", "preference": "I prefer beach vacations", "category": "travel"},
    {"user_id": "demo_user", "preference": "Budget is around 10000 CNY", "category": "budget"},
]

# DDL 语句 - 创建 Demo 所需的表
DDL_DESTINATIONS = """
CREATE TABLE IF NOT EXISTS destinations (
    id              VARCHAR(50) PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    country         VARCHAR(100) NOT NULL,
    description     TEXT,
    tags            TEXT[],                     -- PostgreSQL 数组类型
    metadata        JSONB DEFAULT '{}',
    embedding       vector(768),                -- 向量嵌入 (用于语义搜索)
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_destinations_tags ON destinations USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_destinations_country ON destinations(country);
"""

DDL_USER_PREFERENCES = """
CREATE TABLE IF NOT EXISTS user_preferences (
    id              SERIAL PRIMARY KEY,
    user_id         VARCHAR(255) NOT NULL,
    preference      TEXT NOT NULL,
    category        VARCHAR(100),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, preference)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
"""


async def create_tables(pool):
    """创建 Demo 所需的表结构"""
    print("📦 Creating tables if not exist...")
    await pool.execute(DDL_DESTINATIONS)
    await pool.execute(DDL_USER_PREFERENCES)
    print("  ✅ Tables created/verified")


async def seed_destinations(pool):
    """插入目的地数据"""
    print("🌍 Seeding destinations...")
    for dest in DESTINATIONS_DATA:
        await pool.execute(
            """
            INSERT INTO destinations (id, name, country, description, tags, metadata)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description
        """,
            dest["id"],
            dest["name"],
            dest["country"],
            dest["description"],
            dest["tags"],
            json.dumps({"climate": dest["climate"], "best_season": dest["best_season"]}),
        )
    print(f"  ✅ Inserted {len(DESTINATIONS_DATA)} destinations")


async def seed_user_preferences(pool):
    """插入用户偏好数据"""
    print("👤 Seeding user preferences...")
    for pref in USER_PREFERENCES:
        await pool.execute(
            """
            INSERT INTO user_preferences (user_id, preference, category)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
        """,
            pref["user_id"],
            pref["preference"],
            pref["category"],
        )
    print(f"  ✅ Inserted {len(USER_PREFERENCES)} preferences")


async def main():
    import os

    database_url = os.getenv("DATABASE_URL", "postgresql://aigc:@localhost:5432/cognizes-engine")

    print("🚀 Starting data seeding...")
    db = DatabaseManager(dsn=database_url)
    pool = await db.get_pool()

    try:
        await create_tables(pool)
        await seed_destinations(pool)
        await seed_user_preferences(pool)
        print("✅ Data seeding completed!")
    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(main())
