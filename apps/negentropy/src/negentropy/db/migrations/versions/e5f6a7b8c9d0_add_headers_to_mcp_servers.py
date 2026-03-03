"""add headers to mcp_servers

Revision ID: e5f6a7b8c9d0
Revises: d1e2f3a4b5c6
Create Date: 2026-03-03 10:00:00.000000+00:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

import negentropy.models.base

# revision identifiers, used by Alembic.
revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d1e2f3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add headers column to mcp_servers table for HTTP/SSE transport configuration."""
    op.add_column(
        "mcp_servers",
        sa.Column(
            "headers",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=True,
        ),
        schema=negentropy.models.base.NEGENTROPY_SCHEMA,
    )


def downgrade() -> None:
    """Remove headers column from mcp_servers table."""
    op.drop_column("mcp_servers", "headers", schema=negentropy.models.base.NEGENTROPY_SCHEMA)
