import typing as t

from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.db.session import AsyncSessionLocal


async def get_db() -> t.AsyncGenerator[AsyncSession, None]:
    """
    Dependency for getting an async database session.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
