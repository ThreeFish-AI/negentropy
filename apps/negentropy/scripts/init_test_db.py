"""初始化测试数据库：创建 negentropy schema 和 vector 扩展。"""

from _db import run_script, script_engine
from sqlalchemy import text


async def init_test_db() -> None:
    async with script_engine(pool_pre_ping=True) as engine:
        async with engine.begin() as conn:
            await conn.execute(text("CREATE SCHEMA IF NOT EXISTS negentropy"))
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))


if __name__ == "__main__":
    run_script(init_test_db())
