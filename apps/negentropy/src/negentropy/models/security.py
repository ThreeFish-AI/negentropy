from datetime import datetime

from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import JSONB

from negentropy.models.base import Base


class Credential(Base):
    """
    Credential Model.

    Stores authentication credentials (API Keys, OAuth Tokens, etc.)
    using a flexible JSONB structure compatible with ADK's AuthCredential.
    """

    __tablename__ = "credentials"

    app_name = Column(String, primary_key=True, index=True)
    user_id = Column(String, primary_key=True, index=True)
    credential_key = Column(String, primary_key=True, index=True)

    # Stores the serialized AuthCredential object
    credential_data = Column(JSONB, nullable=False)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<Credential(app_name='{self.app_name}', user_id='{self.user_id}', key='{self.credential_key}')>"
