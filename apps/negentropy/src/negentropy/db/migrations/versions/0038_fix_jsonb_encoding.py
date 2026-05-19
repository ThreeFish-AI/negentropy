"""Fix double-encoded JSONB in builtin_tools.

Revision ID: 0038
Revises: 0037
Create Date: 2026-05-19

Root cause:
    Migration 0031 used json.dumps() to pre-serialize Python dicts to strings,
    then passed them through sa.bindparam(..., type_=JSONB). SQLAlchemy's
    JSONB processor double-encoded them, storing e.g. '"{\\"api_key\\": ...}"'
    instead of '{"api_key": ...}'.

    jsonb_typeof() returns 'string' for double-encoded values vs 'object'
    for correct ones.

Fix:
    UPDATE rows where jsonb_typeof(col) = 'string' to parse the string
    back into proper jsonb objects. Idempotent: correct rows are untouched.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0038"
down_revision: str | None = "0037"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "negentropy"
_COLUMNS = ("config", "credentials", "config_schema")


def upgrade() -> None:
    for col in _COLUMNS:
        op.execute(
            sa.text(
                f"""
                UPDATE {SCHEMA}.builtin_tools
                   SET {col} = ({col}::text)::jsonb
                 WHERE jsonb_typeof({col}) = 'string'
                """
            )
        )


def downgrade() -> None:
    pass
