"""add markdown fields to knowledge_documents

Revision ID: c3f4e5a6b7c8
Revises: a1b2c3d4e5f6
Create Date: 2026-03-01

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c3f4e5a6b7c8"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "knowledge_documents",
        sa.Column("markdown_content", sa.Text(), nullable=True),
        schema="negentropy",
    )
    op.add_column(
        "knowledge_documents",
        sa.Column("markdown_gcs_uri", sa.Text(), nullable=True),
        schema="negentropy",
    )
    op.add_column(
        "knowledge_documents",
        sa.Column(
            "markdown_extract_status",
            sa.String(length=20),
            nullable=False,
            server_default="'pending'",
        ),
        schema="negentropy",
    )
    op.add_column(
        "knowledge_documents",
        sa.Column("markdown_extract_error", sa.Text(), nullable=True),
        schema="negentropy",
    )
    op.add_column(
        "knowledge_documents",
        sa.Column("markdown_extracted_at", sa.DateTime(timezone=True), nullable=True),
        schema="negentropy",
    )
    op.create_index(
        "ix_knowledge_documents_markdown_extract_status",
        "knowledge_documents",
        ["markdown_extract_status"],
        unique=False,
        schema="negentropy",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_knowledge_documents_markdown_extract_status",
        table_name="knowledge_documents",
        schema="negentropy",
    )
    op.drop_column("knowledge_documents", "markdown_extracted_at", schema="negentropy")
    op.drop_column("knowledge_documents", "markdown_extract_error", schema="negentropy")
    op.drop_column("knowledge_documents", "markdown_extract_status", schema="negentropy")
    op.drop_column("knowledge_documents", "markdown_gcs_uri", schema="negentropy")
    op.drop_column("knowledge_documents", "markdown_content", schema="negentropy")
