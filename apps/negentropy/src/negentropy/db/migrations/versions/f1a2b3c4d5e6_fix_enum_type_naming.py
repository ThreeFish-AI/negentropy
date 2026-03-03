"""Fix enum type naming

Revision ID: f1a2b3c4d5e6
Revises: e5f6a7b8c9d0
Create Date: 2026-03-03 17:10:00.000000+08:00

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Rename old enum types to SQLAlchemy default naming.

    This migration handles the case where the database might have old enum type
    names (snake_case) from previous migrations, and ensures the correct names
    (lowercase class names as per SQLAlchemy default) exist.
    """

    # 1. Handle plugin_visibility -> pluginvisibility
    op.execute("""
        DO $$ BEGIN
            -- 如果旧类型存在，重命名为新类型
            IF EXISTS (SELECT 1 FROM pg_type t
                       JOIN pg_namespace n ON t.typnamespace = n.oid
                       WHERE t.typname = 'plugin_visibility' AND n.nspname = 'negentropy')
            THEN
                ALTER TYPE negentropy.plugin_visibility RENAME TO pluginvisibility;
            END IF;
            -- 如果新类型不存在（可能从未运行过任何迁移），创建它
            IF NOT EXISTS (SELECT 1 FROM pg_type t
                           JOIN pg_namespace n ON t.typnamespace = n.oid
                           WHERE t.typname = 'pluginvisibility' AND n.nspname = 'negentropy')
            THEN
                CREATE TYPE negentropy.pluginvisibility AS ENUM ('private', 'shared', 'public');
            END IF;
        END $$;
    """)

    # 2. Handle plugin_permission_type -> pluginpermissiontype
    op.execute("""
        DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM pg_type t
                       JOIN pg_namespace n ON t.typnamespace = n.oid
                       WHERE t.typname = 'plugin_permission_type' AND n.nspname = 'negentropy')
            THEN
                ALTER TYPE negentropy.plugin_permission_type RENAME TO pluginpermissiontype;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type t
                           JOIN pg_namespace n ON t.typnamespace = n.oid
                           WHERE t.typname = 'pluginpermissiontype' AND n.nspname = 'negentropy')
            THEN
                CREATE TYPE negentropy.pluginpermissiontype AS ENUM ('view', 'edit');
            END IF;
        END $$;
    """)


def downgrade() -> None:
    """Revert enum type naming.

    Note: We don't rename back to old names in downgrade since the tables
    expect the new names. This downgrade is intentionally a no-op for safety.
    """
    pass
