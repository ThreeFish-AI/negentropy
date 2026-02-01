from datetime import datetime
from typing import Any, List, Optional
from uuid import UUID, uuid4

from sqlalchemy import DateTime, String, TypeDecorator
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.sql import func


class Vector(TypeDecorator):
    """SQLAlchemy TypeDecorator for pgvector's vector type."""

    impl = String  # Use String as the underlying type for SQLAlchemy internal handling
    cache_ok = True

    def __init__(self, dim: Optional[int] = None):
        super().__init__()
        self.dim = dim

    def load_dialect_impl(self, dialect):
        # We assume the database has pgvector installed and supports the 'vector' type
        # But for the python side, we treat it as a custom UserDefinedType if we were using psycopg2 directly
        # With asyncpg/SQLAlchemy, usually we'd rely on the pgvector-python library.
        # Since we don't have it, we'll try to map it to a format the DB accepts.
        # However, without the library, SQLAlchemy schema generation might fail if we ask it to emit 'vector'.
        # For now, we will assume standard SQLAlchemy UserDefinedType.
        from sqlalchemy.types import UserDefinedType

        class VectorType(UserDefinedType):
            cache_ok = True

            def get_col_spec(self, **kw):
                if dim is None:
                    return "vector"
                return f"vector({dim})"

            def bind_processor(self, dialect):
                def process(value):
                    if value is None:
                        return None
                    if isinstance(value, list):
                        return str(value)  # pgvector input format is '[1,2,3]'
                    return value

                return process

            def result_processor(self, dialect, coltype):
                def process(value):
                    if value is None:
                        return None
                    if isinstance(value, str):
                        # pgvector output format is '[1,2,3]'
                        return [float(x) for x in value.strip("[]").split(",")]
                    return value

                return process

        return VectorType()


class Base(DeclarativeBase):
    pass


TIMESTAMP = DateTime(timezone=True)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class UUIDMixin:
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid4, server_default=func.gen_random_uuid()
    )
