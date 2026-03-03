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

    Uses conditional logic to ensure idempotency regardless of the current
    database state. Key scenarios:
    1. Old type exists, new type doesn't exist -> RENAME
    2. Both old and new types exist -> DROP old, keep new
    3. Only new type exists -> No-op
    4. Neither exists -> CREATE new
    """

    # ==========================================================================
    # 1. Handle plugin_visibility -> pluginvisibility
    # ==========================================================================

    op.execute("""
        DO $$ BEGIN
            -- Check if old type exists
            IF EXISTS (SELECT 1 FROM pg_type t
                       JOIN pg_namespace n ON t.typnamespace = n.oid
                       WHERE t.typname = 'plugin_visibility' AND n.nspname = 'negentropy')
            THEN
                -- Check if new type also exists
                IF EXISTS (SELECT 1 FROM pg_type t
                           JOIN pg_namespace n ON t.typnamespace = n.oid
                           WHERE t.typname = 'pluginvisibility' AND n.nspname = 'negentropy')
                THEN
                    -- Both exist: drop old type (new type takes precedence)
                    DROP TYPE negentropy.plugin_visibility CASCADE;
                ELSE
                    -- Only old exists: rename to new
                    ALTER TYPE negentropy.plugin_visibility RENAME TO pluginvisibility;
                END IF;
            ELSE
                -- Old type doesn't exist, ensure new type exists
                IF NOT EXISTS (SELECT 1 FROM pg_type t
                               JOIN pg_namespace n ON t.typnamespace = n.oid
                               WHERE t.typname = 'pluginvisibility' AND n.nspname = 'negentropy')
                THEN
                    CREATE TYPE negentropy.pluginvisibility AS ENUM ('private', 'shared', 'public');
                END IF;
            END IF;
        END $$;
    """)

    # ==========================================================================
    # 2. Handle plugin_permission_type -> pluginpermissiontype
    # ==========================================================================

    op.execute("""
        DO $$ BEGIN
            -- Check if old type exists
            IF EXISTS (SELECT 1 FROM pg_type t
                       JOIN pg_namespace n ON t.typnamespace = n.oid
                       WHERE t.typname = 'plugin_permission_type' AND n.nspname = 'negentropy')
            THEN
                -- Check if new type also exists
                IF EXISTS (SELECT 1 FROM pg_type t
                           JOIN pg_namespace n ON t.typnamespace = n.oid
                           WHERE t.typname = 'pluginpermissiontype' AND n.nspname = 'negentropy')
                THEN
                    -- Both exist: drop old type (new type takes precedence)
                    DROP TYPE negentropy.plugin_permission_type CASCADE;
                ELSE
                    -- Only old exists: rename to new
                    ALTER TYPE negentropy.plugin_permission_type RENAME TO pluginpermissiontype;
                END IF;
            ELSE
                -- Old type doesn't exist, ensure new type exists
                IF NOT EXISTS (SELECT 1 FROM pg_type t
                               JOIN pg_namespace n ON t.typnamespace = n.oid
                               WHERE t.typname = 'pluginpermissiontype' AND n.nspname = 'negentropy')
                THEN
                    CREATE TYPE negentropy.pluginpermissiontype AS ENUM ('view', 'edit');
                END IF;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    """Revert enum type naming.

    Note: We don't rename back to old names in downgrade since the tables
    expect the new names. This downgrade is intentionally a no-op for safety.
    """
    pass
