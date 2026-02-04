"""Add knowledge runtime tables

Revision ID: b7c1f2e1a4d5
Revises: de84d2c984fb
Create Date: 2026-02-04 00:00:00.000000+00:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "b7c1f2e1a4d5"
down_revision: Union[str, None] = "de84d2c984fb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "knowledge_graph_runs",
        sa.Column("app_name", sa.String(length=255), nullable=False),
        sa.Column("run_id", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="'pending'", nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("idempotency_key", sa.String(length=255), nullable=True),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("app_name", "run_id", name="knowledge_graph_runs_app_run_unique"),
        sa.UniqueConstraint("app_name", "idempotency_key", name="knowledge_graph_runs_idempotency_unique"),
        schema="negentropy",
    )
    op.create_index(
        "ix_knowledge_graph_runs_app_updated",
        "knowledge_graph_runs",
        ["app_name", "updated_at"],
        unique=False,
        schema="negentropy",
    )

    op.create_table(
        "knowledge_pipeline_runs",
        sa.Column("app_name", sa.String(length=255), nullable=False),
        sa.Column("run_id", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="'pending'", nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("idempotency_key", sa.String(length=255), nullable=True),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("app_name", "run_id", name="knowledge_pipeline_runs_app_run_unique"),
        sa.UniqueConstraint("app_name", "idempotency_key", name="knowledge_pipeline_runs_idempotency_unique"),
        schema="negentropy",
    )
    op.create_index(
        "ix_knowledge_pipeline_runs_app_updated",
        "knowledge_pipeline_runs",
        ["app_name", "updated_at"],
        unique=False,
        schema="negentropy",
    )

    op.create_table(
        "memory_audit_logs",
        sa.Column("app_name", sa.String(length=255), nullable=False),
        sa.Column("user_id", sa.String(length=255), nullable=False),
        sa.Column("memory_id", sa.String(length=255), nullable=False),
        sa.Column("decision", sa.String(length=20), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("idempotency_key", sa.String(length=255), nullable=True),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "app_name",
            "user_id",
            "memory_id",
            "idempotency_key",
            name="memory_audit_logs_idempotency_unique",
        ),
        schema="negentropy",
    )
    op.create_index(
        "ix_memory_audit_logs_app_user_created",
        "memory_audit_logs",
        ["app_name", "user_id", "created_at"],
        unique=False,
        schema="negentropy",
    )


def downgrade() -> None:
    op.drop_index("ix_memory_audit_logs_app_user_created", table_name="memory_audit_logs", schema="negentropy")
    op.drop_table("memory_audit_logs", schema="negentropy")
    op.drop_index("ix_knowledge_pipeline_runs_app_updated", table_name="knowledge_pipeline_runs", schema="negentropy")
    op.drop_table("knowledge_pipeline_runs", schema="negentropy")
    op.drop_index("ix_knowledge_graph_runs_app_updated", table_name="knowledge_graph_runs", schema="negentropy")
    op.drop_table("knowledge_graph_runs", schema="negentropy")
