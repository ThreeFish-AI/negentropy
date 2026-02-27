"""Add knowledge_documents table for GCS document storage

Revision ID: f9a4b3c2d1e6
Revises: e8f3a2c1d4b5
Create Date: 2026-02-27 15:30:00.000000+00:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "f9a4b3c2d1e6"
down_revision: Union[str, None] = "e8f3a2c1d4b5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create knowledge_documents table for storing uploaded document metadata."""
    op.create_table(
        "knowledge_documents",
        sa.Column("corpus_id", sa.UUID(), nullable=False),
        sa.Column("app_name", sa.String(length=255), nullable=False),
        sa.Column("file_hash", sa.String(length=64), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("gcs_uri", sa.Text(), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=True),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="'active'", nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["corpus_id"],
            ["negentropy.corpus.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("corpus_id", "file_hash", name="uq_knowledge_documents_corpus_hash"),
        schema="negentropy",
    )

    # Create indexes for efficient queries
    op.create_index(
        "ix_knowledge_documents_file_hash",
        "knowledge_documents",
        ["file_hash"],
        unique=False,
        schema="negentropy",
    )
    op.create_index(
        "ix_knowledge_documents_app_name",
        "knowledge_documents",
        ["app_name"],
        unique=False,
        schema="negentropy",
    )
    op.create_index(
        "ix_knowledge_documents_status",
        "knowledge_documents",
        ["status"],
        unique=False,
        schema="negentropy",
    )


def downgrade() -> None:
    """Drop knowledge_documents table."""
    op.drop_index("ix_knowledge_documents_status", table_name="knowledge_documents", schema="negentropy")
    op.drop_index("ix_knowledge_documents_app_name", table_name="knowledge_documents", schema="negentropy")
    op.drop_index("ix_knowledge_documents_file_hash", table_name="knowledge_documents", schema="negentropy")
    op.drop_table("knowledge_documents", schema="negentropy")
