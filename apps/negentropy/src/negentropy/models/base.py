from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, String, TypeDecorator
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.types import UserDefinedType


# Schema 名称常量，用于隔离业务表与 ADK 后台表 (ADK 默认使用 public schema)
NEGENTROPY_SCHEMA = "negentropy"


# =============================================================================
# Vector 类型实现
# =============================================================================


class _VectorImpl(UserDefinedType):
    """pgvector vector 类型的底层实现"""

    cache_ok = True

    def __init__(self, dim: Optional[int] = None):
        self.dim = dim

    def get_col_spec(self, **kw) -> str:
        return "vector" if self.dim is None else f"vector({self.dim})"

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


class Vector(TypeDecorator):
    """SQLAlchemy TypeDecorator for pgvector's vector type."""

    impl = String
    cache_ok = True

    def __init__(self, dim: Optional[int] = None):
        super().__init__()
        self.dim = dim

    def load_dialect_impl(self, dialect):
        return _VectorImpl(dim=self.dim)


# =============================================================================
# ForeignKey 辅助函数
# =============================================================================


def fk(table: str, column: str = "id", ondelete: Optional[str] = None) -> ForeignKey:
    """创建带 schema 的 ForeignKey

    Args:
        table: 表名
        column: 列名，默认 'id'
        ondelete: 删除行为，如 'CASCADE', 'SET NULL'

    Returns:
        配置好的 ForeignKey 对象

    Example:
        thread_id: Mapped[UUID] = mapped_column(fk("threads", ondelete="CASCADE"))
    """
    ref = f"{NEGENTROPY_SCHEMA}.{table}.{column}"
    return ForeignKey(ref, ondelete=ondelete) if ondelete else ForeignKey(ref)


# =============================================================================
# Base 类和 Mixin
# =============================================================================


class Base(DeclarativeBase):
    """所有业务模型的基类，统一归入 negentropy schema"""

    __table_args__ = {"schema": NEGENTROPY_SCHEMA}


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
