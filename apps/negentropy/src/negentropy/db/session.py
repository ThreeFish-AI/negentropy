from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from negentropy.config import settings


engine = create_async_engine(
    str(settings.database_url),
    pool_pre_ping=True,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_recycle=settings.db_pool_recycle,
    echo=settings.db_echo,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)
