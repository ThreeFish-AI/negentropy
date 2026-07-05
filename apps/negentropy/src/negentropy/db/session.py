from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from negentropy.config import settings

engine = create_async_engine(
    str(settings.database_url),
    pool_pre_ping=True,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_recycle=settings.db_pool_recycle,
    pool_timeout=settings.db_pool_timeout,
    echo=settings.db_echo,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


def _register_engine_disposer() -> None:
    """把 ``engine.dispose`` 注册到全局 lifecycle，让进程退出前主动释放连接池。

    放在函数里延迟执行，避免 ``db.session`` 模块被早期 import 时 ``lifecycle``
    尚未就绪（``lifecycle`` 模块本身只依赖 logging，不会引入循环 import，但保留
    防御性 try/except 以应对未来重构）。
    """
    try:
        from negentropy.engine.lifecycle import register_disposer

        register_disposer("db.engine.dispose", engine.dispose)
    except Exception:  # pragma: no cover — 启动期最佳努力，失败不影响主流程
        pass


_register_engine_disposer()
