import asyncio
import sys
import os

# Ensure we can import config
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))

from negentropy.config import settings
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def reset_db():
    print(f"Connecting to database: {settings.database_url}")
    # We need to connect to the 'postgres' database or the target database to drop schema?
    # Actually, dropping public schema removes all tables in it.
    
    engine = create_async_engine(settings.database_url, echo=True)
    
    async with engine.begin() as conn:
        print("Dropping schema public CASCADE...")
        await conn.execute(text("DROP SCHEMA public CASCADE;"))
        print("Recreating schema public...")
        await conn.execute(text("CREATE SCHEMA public;"))
        print("Granting usage on schema public...")
        # Optional: ensure permissions
        # await conn.execute(text("GRANT ALL ON SCHEMA public TO public;"))
        
        print("Enabling vector extension...")
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        
    print("Database schema reset successfully.")
    await engine.dispose()

if __name__ == "__main__":
    try:
        asyncio.run(reset_db())
    except Exception as e:
        print(f"Error resetting DB: {e}")
        sys.exit(1)
