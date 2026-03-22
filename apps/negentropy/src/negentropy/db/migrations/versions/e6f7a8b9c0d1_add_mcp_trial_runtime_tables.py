"""add mcp trial runtime tables

Revision ID: e6f7a8b9c0d1
Revises: b4d7e2f9a1c3
Create Date: 2026-03-22 10:30:00.000000+00:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

import negentropy.models.base

# revision identifiers, used by Alembic.
revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, None] = "b4d7e2f9a1c3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    schema = negentropy.models.base.NEGENTROPY_SCHEMA

    op.create_table(
        "mcp_tool_runs",
        sa.Column("server_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tool_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("tool_name", sa.String(length=255), nullable=False),
        sa.Column("origin", sa.String(length=50), server_default="trial_ui", nullable=False),
        sa.Column("status", sa.String(length=50), server_default="running", nullable=False),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("request_payload", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column(
            "normalized_request_payload",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column("result_payload", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("error_summary", sa.Text(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), server_default="0", nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.ForeignKeyConstraint(["server_id"], [f"{schema}.mcp_servers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tool_id"], [f"{schema}.mcp_tools.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        schema=schema,
    )
    op.create_index(
        "ix_mcp_tool_runs_server_tool_started",
        "mcp_tool_runs",
        ["server_id", "tool_name", "started_at"],
        unique=False,
        schema=schema,
    )
    op.create_index(
        "ix_mcp_tool_runs_origin_started",
        "mcp_tool_runs",
        ["origin", "started_at"],
        unique=False,
        schema=schema,
    )

    op.create_table(
        "mcp_tool_run_events",
        sa.Column("run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sequence_num", sa.Integer(), nullable=False),
        sa.Column("stage", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=50), server_default="info", nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("duration_ms", sa.Integer(), server_default="0", nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.ForeignKeyConstraint(["run_id"], [f"{schema}.mcp_tool_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("run_id", "sequence_num", name="mcp_tool_run_events_run_seq_unique"),
        schema=schema,
    )
    op.create_index(
        "ix_mcp_tool_run_events_run_timestamp",
        "mcp_tool_run_events",
        ["run_id", "timestamp"],
        unique=False,
        schema=schema,
    )

    op.create_table(
        "mcp_trial_assets",
        sa.Column("server_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_id", sa.String(length=255), nullable=False),
        sa.Column("source_kind", sa.String(length=50), server_default="upload", nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=255), nullable=True),
        sa.Column("size_bytes", sa.Integer(), server_default="0", nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("gcs_uri", sa.Text(), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.ForeignKeyConstraint(["server_id"], [f"{schema}.mcp_servers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        schema=schema,
    )
    op.create_index(
        "ix_mcp_trial_assets_server_created",
        "mcp_trial_assets",
        ["server_id", "created_at"],
        unique=False,
        schema=schema,
    )
    op.create_index(
        "ix_mcp_trial_assets_owner_created",
        "mcp_trial_assets",
        ["owner_id", "created_at"],
        unique=False,
        schema=schema,
    )


def downgrade() -> None:
    schema = negentropy.models.base.NEGENTROPY_SCHEMA

    op.drop_index("ix_mcp_trial_assets_owner_created", table_name="mcp_trial_assets", schema=schema)
    op.drop_index("ix_mcp_trial_assets_server_created", table_name="mcp_trial_assets", schema=schema)
    op.drop_table("mcp_trial_assets", schema=schema)

    op.drop_index("ix_mcp_tool_run_events_run_timestamp", table_name="mcp_tool_run_events", schema=schema)
    op.drop_table("mcp_tool_run_events", schema=schema)

    op.drop_index("ix_mcp_tool_runs_origin_started", table_name="mcp_tool_runs", schema=schema)
    op.drop_index("ix_mcp_tool_runs_server_tool_started", table_name="mcp_tool_runs", schema=schema)
    op.drop_table("mcp_tool_runs", schema=schema)
