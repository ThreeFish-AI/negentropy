import asyncio
from logging.config import fileConfig

from sqlalchemy import pool, text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
from negentropy.models.base import Base, Vector as VectorType

# Import all models to ensure they are registered with Base.metadata
from negentropy.models import *  # noqa

target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


from negentropy.config import settings

# Register pgvector type name for reflection to avoid "unknown type" warnings.
# This does not suppress warnings; it teaches SQLAlchemy how to interpret 'vector'.
from sqlalchemy.dialects.postgresql.base import ischema_names
from sqlalchemy.types import UserDefinedType


class _PGVector(UserDefinedType):
    cache_ok = True

    def get_col_spec(self, **kw):
        return "vector"


ischema_names.setdefault("vector", _PGVector)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = str(settings.database_url)
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


# 通过迁移文件手动创建的索引，不在 ORM 模型中定义
# 这些索引需要在此忽略，否则 autogenerate 会尝试删除它们
_IGNORED_INDEXES = frozenset({
    "idx_kb_entity_type",                    # 部分索引 (WHERE entity_type IS NOT NULL)
    "ix_negentropy_knowledge_search_vector", # GIN 索引 (TSVECTOR)
    "ix_knowledge_documents_file_hash",      # 命名与 ORM 自动生成的不一致
})


def do_run_migrations(connection: Connection) -> None:
    # 在运行迁移前，确保 negentropy schema 存在
    from negentropy.models.base import NEGENTROPY_SCHEMA

    connection.execute(text(f"CREATE SCHEMA IF NOT EXISTS {NEGENTROPY_SCHEMA}"))
    connection.commit()

    # 启用 pgvector 扩展（用于 vector 类型的 embedding 列）
    connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    connection.commit()

    def include_object(object, name, type_, reflected, compare_to):
        """
        过滤器：仅管理 negentropy schema 中的对象。

        - 排除 public schema 中的表（如 ADK 的 sessions/events/app_states 等）
        - 排除旧版 alembic_version 表
        - 忽略手动创建的索引（_IGNORED_INDEXES）
        - 仅追踪 negentropy schema 中的业务表
        """
        # 忽略手动创建的索引，避免 autogenerate 误报差异
        if type_ == "index" and name in _IGNORED_INDEXES:
            return False
        if type_ == "table":
            # 如果是反射的表（数据库中已存在），检查其 schema
            if reflected:
                table_schema = object.schema
                # 只管理 negentropy schema 中的表
                return table_schema == NEGENTROPY_SCHEMA
            # 如果是模型定义的表，检查 compare_to 的 schema
            if compare_to is not None:
                return compare_to.schema == NEGENTROPY_SCHEMA
            # 模型中定义的表，检查 object 本身的 schema
            return getattr(object, "schema", None) == NEGENTROPY_SCHEMA
        return True

    def compare_type(context, inspected_column, metadata_column, inspected_type, metadata_type):
        # Treat pgvector columns as equivalent to our Vector TypeDecorator
        if isinstance(metadata_type, VectorType):
            if hasattr(inspected_type, "get_col_spec"):
                return not inspected_type.get_col_spec().startswith("vector")
            return False
        return None

    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_schemas=True,  # 确保 Alembic 能识别 schema
        version_table_schema=NEGENTROPY_SCHEMA,  # 将版本表也放入 negentropy schema
        include_object=include_object,  # 过滤非 negentropy schema 的对象
        compare_type=compare_type,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = str(settings.database_url)

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
