"""Fix enum values case to match SQLAlchemy behavior

Revision ID: a2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-03-03 21:30:00.000000+08:00

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a2b3c4d5e6f7"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Fix enum values case to match SQLAlchemy default behavior.

    SQLAlchemy uses the enum's name (e.g., 'PRIVATE') rather than its value
    (e.g., 'private') when serializing to PostgreSQL. This migration updates
    the database enum values to use uppercase to match SQLAlchemy's behavior.

    Reference: https://docs.sqlalchemy.org/en/20/core/type_basics.html#sqlalchemy.types.Enum
    """

    # ==========================================================================
    # 1. Fix pluginvisibility enum: lowercase -> uppercase
    # ==========================================================================

    # Step 1: Create new enum type with uppercase values
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE negentropy.pluginvisibility_new AS ENUM ('PRIVATE', 'SHARED', 'PUBLIC');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Step 2: Update mcp_servers.visibility column
    # Drop default first, then alter type, then set new default
    op.execute("ALTER TABLE negentropy.mcp_servers ALTER COLUMN visibility DROP DEFAULT")
    op.execute("""
        ALTER TABLE negentropy.mcp_servers
        ALTER COLUMN visibility TYPE text
        USING visibility::text
    """)
    op.execute("""
        UPDATE negentropy.mcp_servers
        SET visibility = UPPER(visibility)
        WHERE visibility IN ('private', 'shared', 'public')
    """)
    op.execute("""
        ALTER TABLE negentropy.mcp_servers
        ALTER COLUMN visibility TYPE negentropy.pluginvisibility_new
        USING visibility::negentropy.pluginvisibility_new
    """)
    op.execute("ALTER TABLE negentropy.mcp_servers ALTER COLUMN visibility SET DEFAULT 'PRIVATE'::negentropy.pluginvisibility_new")

    # Step 3: Update skills.visibility column
    op.execute("ALTER TABLE negentropy.skills ALTER COLUMN visibility DROP DEFAULT")
    op.execute("""
        ALTER TABLE negentropy.skills
        ALTER COLUMN visibility TYPE text
        USING visibility::text
    """)
    op.execute("""
        UPDATE negentropy.skills
        SET visibility = UPPER(visibility)
        WHERE visibility IN ('private', 'shared', 'public')
    """)
    op.execute("""
        ALTER TABLE negentropy.skills
        ALTER COLUMN visibility TYPE negentropy.pluginvisibility_new
        USING visibility::negentropy.pluginvisibility_new
    """)
    op.execute("ALTER TABLE negentropy.skills ALTER COLUMN visibility SET DEFAULT 'PRIVATE'::negentropy.pluginvisibility_new")

    # Step 4: Update sub_agents.visibility column
    op.execute("ALTER TABLE negentropy.sub_agents ALTER COLUMN visibility DROP DEFAULT")
    op.execute("""
        ALTER TABLE negentropy.sub_agents
        ALTER COLUMN visibility TYPE text
        USING visibility::text
    """)
    op.execute("""
        UPDATE negentropy.sub_agents
        SET visibility = UPPER(visibility)
        WHERE visibility IN ('private', 'shared', 'public')
    """)
    op.execute("""
        ALTER TABLE negentropy.sub_agents
        ALTER COLUMN visibility TYPE negentropy.pluginvisibility_new
        USING visibility::negentropy.pluginvisibility_new
    """)
    op.execute("ALTER TABLE negentropy.sub_agents ALTER COLUMN visibility SET DEFAULT 'PRIVATE'::negentropy.pluginvisibility_new")

    # Step 5: Drop old enum and rename new one
    op.execute("DROP TYPE negentropy.pluginvisibility")
    op.execute("ALTER TYPE negentropy.pluginvisibility_new RENAME TO pluginvisibility")

    # ==========================================================================
    # 2. Fix pluginpermissiontype enum: lowercase -> uppercase
    # ==========================================================================

    # Step 1: Create new enum type with uppercase values
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE negentropy.pluginpermissiontype_new AS ENUM ('VIEW', 'EDIT');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Step 2: Update plugin_permissions.permission column
    op.execute("ALTER TABLE negentropy.plugin_permissions ALTER COLUMN permission DROP DEFAULT")
    op.execute("""
        ALTER TABLE negentropy.plugin_permissions
        ALTER COLUMN permission TYPE text
        USING permission::text
    """)
    op.execute("""
        UPDATE negentropy.plugin_permissions
        SET permission = UPPER(permission)
        WHERE permission IN ('view', 'edit')
    """)
    op.execute("""
        ALTER TABLE negentropy.plugin_permissions
        ALTER COLUMN permission TYPE negentropy.pluginpermissiontype_new
        USING permission::negentropy.pluginpermissiontype_new
    """)
    op.execute("ALTER TABLE negentropy.plugin_permissions ALTER COLUMN permission SET DEFAULT 'VIEW'::negentropy.pluginpermissiontype_new")

    # Step 3: Drop old enum and rename new one
    op.execute("DROP TYPE negentropy.pluginpermissiontype")
    op.execute("ALTER TYPE negentropy.pluginpermissiontype_new RENAME TO pluginpermissiontype")


def downgrade() -> None:
    """Revert enum values to lowercase.

    This downgrade is provided for completeness but should be used with caution
    as it may cause issues with SQLAlchemy's default enum handling.
    """

    # ==========================================================================
    # 1. Revert pluginvisibility enum: uppercase -> lowercase
    # ==========================================================================

    # Step 1: Create new enum type with lowercase values
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE negentropy.pluginvisibility_new AS ENUM ('private', 'shared', 'public');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Step 2: Update mcp_servers.visibility column
    op.execute("ALTER TABLE negentropy.mcp_servers ALTER COLUMN visibility DROP DEFAULT")
    op.execute("""
        ALTER TABLE negentropy.mcp_servers
        ALTER COLUMN visibility TYPE text
        USING visibility::text
    """)
    op.execute("""
        UPDATE negentropy.mcp_servers
        SET visibility = LOWER(visibility)
        WHERE visibility IN ('PRIVATE', 'SHARED', 'PUBLIC')
    """)
    op.execute("""
        ALTER TABLE negentropy.mcp_servers
        ALTER COLUMN visibility TYPE negentropy.pluginvisibility_new
        USING visibility::negentropy.pluginvisibility_new
    """)
    op.execute("ALTER TABLE negentropy.mcp_servers ALTER COLUMN visibility SET DEFAULT 'private'::negentropy.pluginvisibility_new")

    # Step 3: Update skills.visibility column
    op.execute("ALTER TABLE negentropy.skills ALTER COLUMN visibility DROP DEFAULT")
    op.execute("""
        ALTER TABLE negentropy.skills
        ALTER COLUMN visibility TYPE text
        USING visibility::text
    """)
    op.execute("""
        UPDATE negentropy.skills
        SET visibility = LOWER(visibility)
        WHERE visibility IN ('PRIVATE', 'SHARED', 'PUBLIC')
    """)
    op.execute("""
        ALTER TABLE negentropy.skills
        ALTER COLUMN visibility TYPE negentropy.pluginvisibility_new
        USING visibility::negentropy.pluginvisibility_new
    """)
    op.execute("ALTER TABLE negentropy.skills ALTER COLUMN visibility SET DEFAULT 'private'::negentropy.pluginvisibility_new")

    # Step 4: Update sub_agents.visibility column
    op.execute("ALTER TABLE negentropy.sub_agents ALTER COLUMN visibility DROP DEFAULT")
    op.execute("""
        ALTER TABLE negentropy.sub_agents
        ALTER COLUMN visibility TYPE text
        USING visibility::text
    """)
    op.execute("""
        UPDATE negentropy.sub_agents
        SET visibility = LOWER(visibility)
        WHERE visibility IN ('PRIVATE', 'SHARED', 'PUBLIC')
    """)
    op.execute("""
        ALTER TABLE negentropy.sub_agents
        ALTER COLUMN visibility TYPE negentropy.pluginvisibility_new
        USING visibility::negentropy.pluginvisibility_new
    """)
    op.execute("ALTER TABLE negentropy.sub_agents ALTER COLUMN visibility SET DEFAULT 'private'::negentropy.pluginvisibility_new")

    # Step 5: Drop old enum and rename new one
    op.execute("DROP TYPE negentropy.pluginvisibility")
    op.execute("ALTER TYPE negentropy.pluginvisibility_new RENAME TO pluginvisibility")

    # ==========================================================================
    # 2. Revert pluginpermissiontype enum: uppercase -> lowercase
    # ==========================================================================

    # Step 1: Create new enum type with lowercase values
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE negentropy.pluginpermissiontype_new AS ENUM ('view', 'edit');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Step 2: Update plugin_permissions.permission column
    op.execute("ALTER TABLE negentropy.plugin_permissions ALTER COLUMN permission DROP DEFAULT")
    op.execute("""
        ALTER TABLE negentropy.plugin_permissions
        ALTER COLUMN permission TYPE text
        USING permission::text
    """)
    op.execute("""
        UPDATE negentropy.plugin_permissions
        SET permission = LOWER(permission)
        WHERE permission IN ('VIEW', 'EDIT')
    """)
    op.execute("""
        ALTER TABLE negentropy.plugin_permissions
        ALTER COLUMN permission TYPE negentropy.pluginpermissiontype_new
        USING permission::negentropy.pluginpermissiontype_new
    """)
    op.execute("ALTER TABLE negentropy.plugin_permissions ALTER COLUMN permission SET DEFAULT 'view'::negentropy.pluginpermissiontype_new")

    # Step 3: Drop old enum and rename new one
    op.execute("DROP TYPE negentropy.pluginpermissiontype")
    op.execute("ALTER TYPE negentropy.pluginpermissiontype_new RENAME TO pluginpermissiontype")
