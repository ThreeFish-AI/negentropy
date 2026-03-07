"""Add MCP tool metadata fields

Revision ID: c6f8d9e1a2b3
Revises: a2b3c4d5e6f7
Create Date: 2026-03-07 16:00:00.000000+00:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "c6f8d9e1a2b3"
down_revision: Union[str, None] = "a2b3c4d5e6f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add MCP tool metadata fields defined by the MCP spec."""

    op.add_column(
        "mcp_tools",
        sa.Column("title", sa.String(length=255), nullable=True),
        schema="negentropy",
    )
    op.add_column(
        "mcp_tools",
        sa.Column("output_schema", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False),
        schema="negentropy",
    )
    op.add_column(
        "mcp_tools",
        sa.Column("icons", postgresql.JSONB(astext_type=sa.Text()), server_default="[]", nullable=False),
        schema="negentropy",
    )
    op.add_column(
        "mcp_tools",
        sa.Column("annotations", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False),
        schema="negentropy",
    )
    op.add_column(
        "mcp_tools",
        sa.Column("execution", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False),
        schema="negentropy",
    )
    op.add_column(
        "mcp_tools",
        sa.Column("meta", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False),
        schema="negentropy",
    )


def downgrade() -> None:
    """Drop MCP tool metadata fields."""

    op.drop_column("mcp_tools", "meta", schema="negentropy")
    op.drop_column("mcp_tools", "execution", schema="negentropy")
    op.drop_column("mcp_tools", "annotations", schema="negentropy")
    op.drop_column("mcp_tools", "icons", schema="negentropy")
    op.drop_column("mcp_tools", "output_schema", schema="negentropy")
    op.drop_column("mcp_tools", "title", schema="negentropy")
