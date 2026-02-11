from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import NEGENTROPY_SCHEMA, Base, TimestampMixin, UUIDMixin, Vector


class Corpus(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "corpus"

    app_name: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    config: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, server_default="{}")

    __table_args__ = (
        UniqueConstraint("app_name", "name", name="corpus_app_name_unique"),
        {"schema": NEGENTROPY_SCHEMA},
    )

    knowledge_items: Mapped[List["Knowledge"]] = relationship(back_populates="corpus", cascade="all, delete-orphan")


class Knowledge(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "knowledge"

    corpus_id: Mapped[UUID] = mapped_column(
        ForeignKey(f"{NEGENTROPY_SCHEMA}.corpus.id", ondelete="CASCADE"), nullable=False
    )
    app_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(1536))
    # TSVector type is not directly supported by SQLAlchemy, so we use UserDefinedType or just Any for now
    # However, for Alembic to detect it, we might need a custom type.
    # For now, let's use TSVECTOR from sqlalchemy.dialects.postgresql
    from sqlalchemy.dialects.postgresql import TSVECTOR

    search_vector: Mapped[Optional[Any]] = mapped_column(TSVECTOR)
    source_uri: Mapped[Optional[str]] = mapped_column(Text)
    chunk_index: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    metadata_: Mapped[Optional[Dict[str, Any]]] = mapped_column("metadata", JSONB, server_default="{}")

    corpus: Mapped["Corpus"] = relationship(back_populates="knowledge_items")
