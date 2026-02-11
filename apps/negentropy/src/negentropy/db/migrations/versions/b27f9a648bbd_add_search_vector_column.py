"""add_search_vector_column

Revision ID: b27f9a648bbd
Revises: c1640a4711b5
Create Date: 2026-02-11 09:43:51.787620+00:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# Register custom types (e.g. Vector) for Alembic autogenerate
import negentropy.models.base


# revision identifiers, used by Alembic.
revision: str = "b27f9a648bbd"
down_revision: Union[str, None] = "c1640a4711b5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


from sqlalchemy.dialects import postgresql


def upgrade() -> None:
    op.add_column("knowledge", sa.Column("search_vector", postgresql.TSVECTOR(), nullable=True), schema="negentropy")
    # Add GIN index for full-text search
    op.create_index(
        "ix_negentropy_knowledge_search_vector",
        "knowledge",
        ["search_vector"],
        unique=False,
        schema="negentropy",
        postgresql_using="gin",
    )

    # Create trigger to automatically update search_vector
    op.execute("""
        CREATE TRIGGER tsvectorupdate BEFORE INSERT OR UPDATE
        ON negentropy.knowledge FOR EACH ROW EXECUTE FUNCTION
        tsvector_update_trigger(search_vector, 'pg_catalog.english', content);
    """)

    # Backfill existing data
    op.execute("UPDATE negentropy.knowledge SET search_vector = to_tsvector('english', content)")


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS tsvectorupdate ON negentropy.knowledge")
    op.drop_index("ix_negentropy_knowledge_search_vector", table_name="knowledge", schema="negentropy")
    op.drop_column("knowledge", "search_vector", schema="negentropy")
