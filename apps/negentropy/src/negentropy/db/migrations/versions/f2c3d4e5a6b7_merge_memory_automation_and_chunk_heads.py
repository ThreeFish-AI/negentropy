"""merge memory automation and chunk management heads

Revision ID: f2c3d4e5a6b7
Revises: 9c7f8e6d5b4a, e3c1d9b7a4f2
Create Date: 2026-03-09 20:30:00.000000
"""

from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "f2c3d4e5a6b7"
down_revision: Union[str, Sequence[str], None] = ("9c7f8e6d5b4a", "e3c1d9b7a4f2")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Merge parallel Alembic heads without changing schema."""


def downgrade() -> None:
    """Split the merged Alembic heads without changing schema."""
