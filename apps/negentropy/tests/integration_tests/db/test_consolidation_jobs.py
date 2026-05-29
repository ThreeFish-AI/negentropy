"""回归测试：consolidation_jobs 表存在性 + trigger_maintenance_consolidation 可执行。

复现并证伪 Scheduler「Maintenance Consolidation」连续失败的根因——迁移 0043 引入的
函数 ``negentropy.trigger_maintenance_consolidation`` 在函数体内引用
``negentropy.consolidation_jobs``，而该表此前从未被任何迁移创建，触发即报
``UndefinedTableError``。迁移 0044 补建该表后，本测试断言：

1. ``negentropy.consolidation_jobs`` 表存在；
2. handler 实际下发的报错 SQL 可正常执行并返回整数（不再抛 UndefinedTableError）。
"""

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text

from negentropy.config import settings


def _sync_database_url() -> str:
    return str(settings.database_url).replace("postgresql+asyncpg", "postgresql+psycopg")


@pytest.fixture
def alembic_config() -> Config:
    """Returns an Alembic configuration object."""
    return Config("alembic.ini")


def test_consolidation_jobs_table_exists_after_upgrade(alembic_config: Config):
    """迁移到 head 后，negentropy.consolidation_jobs 表应存在。"""
    command.upgrade(alembic_config, "head")

    engine = create_engine(_sync_database_url())
    try:
        with engine.begin() as conn:
            exists = conn.execute(
                text(
                    "SELECT 1 FROM information_schema.tables "
                    "WHERE table_schema = 'negentropy' AND table_name = 'consolidation_jobs'"
                )
            ).scalar()
    finally:
        engine.dispose()

    assert exists, "negentropy.consolidation_jobs 表应由迁移 0044 创建"


def test_trigger_maintenance_consolidation_executes(alembic_config: Config):
    """复现 handler 下发的报错 SQL：应成功执行并返回入队计数（非负整数）。

    使用事务回滚，避免向集成库写入测试巩固任务。
    """
    command.upgrade(alembic_config, "head")

    engine = create_engine(_sync_database_url())
    try:
        with engine.connect() as conn:
            trans = conn.begin()
            try:
                count = conn.execute(
                    text("SELECT negentropy.trigger_maintenance_consolidation(CAST(:lookback AS interval))"),
                    {"lookback": "1 hour"},
                ).scalar()
            finally:
                trans.rollback()
    finally:
        engine.dispose()

    assert isinstance(count, int)
    assert count >= 0
