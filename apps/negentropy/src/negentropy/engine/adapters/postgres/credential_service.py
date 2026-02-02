from typing import Optional

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from google.adk.auth.auth_credential import AuthCredential
from google.adk.auth.auth_tool import AuthConfig
from google.adk.auth.credential_service.base_credential_service import BaseCredentialService
from google.adk.agents.callback_context import CallbackContext

import negentropy.db.session as db_session
from negentropy.models.security import Credential


class PostgresCredentialService(BaseCredentialService):
    """
    PostgreSQL-backed CredentialService.

    Provides persistent storage for potentially complex AuthCredentials
    (OAuth2 tokens, API Keys, etc.) using a JSONB column.

    Bypasses ADK experimental warnings by not calling super().__init__().
    """

    def __init__(self):
        # Skip super().__init__() to avoid @experimental warning
        pass

    async def load_credential(
        self,
        auth_config: AuthConfig,
        callback_context: CallbackContext,
    ) -> Optional[AuthCredential]:
        app_name = callback_context._invocation_context.app_name
        user_id = callback_context._invocation_context.user_id
        key = auth_config.credential_key

        async with db_session.AsyncSessionLocal() as db:
            stmt = select(Credential).where(
                Credential.app_name == app_name, Credential.user_id == user_id, Credential.credential_key == key
            )
            result = await db.execute(stmt)
            credential_record = result.scalar_one_or_none()

        if credential_record and credential_record.credential_data:
            return AuthCredential.model_validate(credential_record.credential_data)
        return None

    async def save_credential(
        self,
        auth_config: AuthConfig,
        callback_context: CallbackContext,
    ) -> None:
        app_name = callback_context._invocation_context.app_name
        user_id = callback_context._invocation_context.user_id
        key = auth_config.credential_key

        if not auth_config.exchanged_auth_credential:
            return

        # Serialize Pydantic model to dict/JSON-compatible format
        credential_data = auth_config.exchanged_auth_credential.model_dump(mode="json", exclude_none=True)

        async with db_session.AsyncSessionLocal() as db:
            # Use upsert (INSERT ... ON CONFLICT DO UPDATE)
            stmt = insert(Credential).values(
                app_name=app_name, user_id=user_id, credential_key=key, credential_data=credential_data
            )

            do_update_stmt = stmt.on_conflict_do_update(
                index_elements=["app_name", "user_id", "credential_key"],
                set_=dict(credential_data=stmt.excluded.credential_data, updated_at=stmt.excluded.updated_at),
            )

            await db.execute(do_update_stmt)
            await db.commit()
