from datetime import datetime
from typing import Any, Dict

from sqlalchemy import DateTime, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from negentropy.models.base import NEGENTROPY_SCHEMA, Base


class Credential(Base):
    """
    Credential Model.

    Stores authentication credentials (API Keys, OAuth Tokens, etc.)
    using a flexible JSONB structure compatible with ADK's AuthCredential.
    """

    __tablename__ = "credentials"

    # 复合主键
    app_name: Mapped[str] = mapped_column(String(255), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(255), primary_key=True)
    credential_key: Mapped[str] = mapped_column(String(255), primary_key=True)

    # Stores the serialized AuthCredential object
    credential_data: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False)

    # 注意：此表只有 updated_at，没有 created_at
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
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
