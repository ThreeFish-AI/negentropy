"""强制重置数据库：DROP + CREATE public schema，并启用 vector 扩展。"""

from _db import run_script, script_engine
from sqlalchemy import text


async def reset_db():
    print("Connecting to database...")
    async with script_engine(echo=True) as engine:
        async with engine.begin() as conn:
            print("Dropping schema public CASCADE...")
            await conn.execute(text("DROP SCHEMA public CASCADE;"))
            print("Recreating schema public...")
            await conn.execute(text("CREATE SCHEMA public;"))
            print("Enabling vector extension...")
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))

    print("Database schema reset successfully.")


if __name__ == "__main__":
    run_script(reset_db())
