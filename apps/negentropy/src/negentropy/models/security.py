"""凭证存储模型。"""

from datetime import datetime
from typing import Any

from sqlalchemy import Index, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from .base import NEGENTROPY_SCHEMA, TIMESTAMP, Base


class Credential(Base):
    """凭证存储模型。

    存储认证凭证 (API Keys, OAuth Tokens 等)，
    使用 JSONB 结构兼容 ADK AuthCredential。
    """

    __tablename__ = "credentials"

    # 复合主键
    app_name: Mapped[str] = mapped_column(String(255), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(255), primary_key=True)
    credential_key: Mapped[str] = mapped_column(String(255), primary_key=True)

    # Stores the serialized AuthCredential object
    credential_data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)

    # 注意：此表只有 updated_at，没有 created_at
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_negentropy_credentials_app_name", "app_name"),
        Index("ix_negentropy_credentials_user_id", "user_id"),
        Index("ix_negentropy_credentials_credential_key", "credential_key"),
        {"schema": NEGENTROPY_SCHEMA},
    )

    def __repr__(self) -> str:
        return f"<Credential(app_name='{self.app_name}', user_id='{self.user_id}', key='{self.credential_key}')>"
