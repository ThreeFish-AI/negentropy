import asyncio
import sys

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from negentropy.config import settings


async def init_test_db() -> None:
    engine = create_async_engine(str(settings.database_url), pool_pre_ping=True)
    try:
        async with engine.begin() as conn:
            await conn.execute(text("CREATE SCHEMA IF NOT EXISTS negentropy"))
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    finally:
        await engine.dispose()


if __name__ == "__main__":
    try:
        asyncio.run(init_test_db())
    except Exception as exc:
        print(f"Failed to initialize test database: {exc}", file=sys.stderr)
        sys.exit(1)
