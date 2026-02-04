from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, Optional
from urllib.parse import urlencode

import httpx
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy import select

from negentropy.config import settings
from negentropy.db.session import AsyncSessionLocal
from negentropy.models.pulse import UserState

from .tokens import TokenError, decode_token, encode_token

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"


@dataclass(frozen=True)
class AuthUser:
    user_id: str
    email: Optional[str]
    name: Optional[str]
    picture: Optional[str]
    roles: list[str]
    provider: str
    subject: str
    domain: Optional[str]


@dataclass(frozen=True)
class AuthResult:
    user: AuthUser
    token: str
    redirect: str


class AuthService:
    def __init__(self):
        self._settings = settings.auth

    def _require_google_config(self) -> None:
        if not self._settings.google_client_id:
            raise ValueError("NE_AUTH_GOOGLE_CLIENT_ID is required")
        if not self._settings.google_client_secret:
            raise ValueError("NE_AUTH_GOOGLE_CLIENT_SECRET is required")
        if not self._settings.google_redirect_uri:
            raise ValueError("NE_AUTH_GOOGLE_REDIRECT_URI is required")
        if not self._settings.token_secret.get_secret_value():
            raise ValueError("NE_AUTH_TOKEN_SECRET is required")

    def build_login_url(self, *, redirect: Optional[str]) -> str:
        self._require_google_config()
        redirect_path = redirect or self._settings.default_redirect_path
        state = self._build_state_token(redirect_path)
        params = {
            "client_id": self._settings.google_client_id,
            "redirect_uri": self._settings.google_redirect_uri,
            "response_type": "code",
            "scope": " ".join(self._settings.google_scopes),
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
        return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"

    async def handle_callback(self, *, code: str, state: str) -> AuthResult:
        self._require_google_config()
        redirect = self._parse_state_token(state)
        token_payload = await self._exchange_code(code)
        claims = await self._verify_id_token(token_payload.get("id_token"))
        user = self._build_user(claims)
        await self._upsert_user_state(user, claims)
        session_token = self._build_session_token(user)
        return AuthResult(user=user, token=session_token, redirect=redirect)

    def decode_session(self, token: str) -> AuthUser:
        payload = decode_token(token, self._settings.token_secret.get_secret_value())
        return AuthUser(
            user_id=payload["sub"],
            email=payload.get("email"),
            name=payload.get("name"),
            picture=payload.get("picture"),
            roles=payload.get("roles", []),
            provider=payload.get("provider", "google"),
            subject=payload.get("subject", payload["sub"]),
            domain=payload.get("domain"),
        )

    def _build_state_token(self, redirect: str) -> str:
        now = int(time.time())
        payload = {"typ": "oauth_state", "iat": now, "exp": now + self._settings.state_ttl_seconds, "redirect": redirect}
        return encode_token(payload, self._settings.token_secret.get_secret_value())

    def _parse_state_token(self, token: str) -> str:
        payload = decode_token(token, self._settings.token_secret.get_secret_value())
        if payload.get("typ") != "oauth_state":
            raise TokenError("invalid state token")
        return payload.get("redirect") or self._settings.default_redirect_path

    async def _exchange_code(self, code: str) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": self._settings.google_client_id,
                    "client_secret": self._settings.google_client_secret.get_secret_value(),
                    "redirect_uri": self._settings.google_redirect_uri,
                    "grant_type": "authorization_code",
                },
                headers={"content-type": "application/x-www-form-urlencoded"},
            )
        response.raise_for_status()
        return response.json()

    async def _verify_id_token(self, id_token: Optional[str]) -> dict[str, Any]:
        if not id_token:
            raise ValueError("missing id_token from google")

        def _verify() -> dict[str, Any]:
            return google_id_token.verify_oauth2_token(
                id_token,
                google_requests.Request(),
                self._settings.google_client_id,
            )

        import anyio

        return await anyio.to_thread.run_sync(_verify)

    def _build_user(self, claims: dict[str, Any]) -> AuthUser:
        email = claims.get("email")
        domain = claims.get("hd")
        if self._settings.allowed_domains and domain not in self._settings.allowed_domains:
            raise ValueError("email domain not allowed")
        if self._settings.allowed_emails and email not in self._settings.allowed_emails:
            raise ValueError("email not allowed")

        user_id = claims.get("sub")
        if self._settings.user_id_strategy == "email" and email:
            user_id = email
        if not user_id:
            raise ValueError("unable to resolve user id")

        roles = ["admin"] if email and email in self._settings.admin_emails else ["user"]

        return AuthUser(
            user_id=f"google:{user_id}" if not user_id.startswith("google:") else user_id,
            email=email,
            name=claims.get("name"),
            picture=claims.get("picture"),
            roles=roles,
            provider="google",
            subject=claims.get("sub", ""),
            domain=domain,
        )

    async def _upsert_user_state(self, user: AuthUser, claims: dict[str, Any]) -> None:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(UserState).where(
                    UserState.user_id == user.user_id,
                    UserState.app_name == settings.app_name,
                )
            )
            user_state = result.scalar_one_or_none()
            next_state = {
                "profile": {
                    "email": user.email,
                    "name": user.name,
                    "picture": user.picture,
                    "given_name": claims.get("given_name"),
                    "family_name": claims.get("family_name"),
                    "locale": claims.get("locale"),
                },
                "auth": {
                    "provider": user.provider,
                    "subject": user.subject,
                    "email_verified": claims.get("email_verified"),
                    "domain": user.domain,
                    "last_login_at": int(time.time()),
                },
                "roles": user.roles,
            }

            if user_state:
                user_state.state = {**(user_state.state or {}), **next_state}
            else:
                db.add(
                    UserState(
                        user_id=user.user_id,
                        app_name=settings.app_name,
                        state=next_state,
                    )
                )
            await db.commit()

    def _build_session_token(self, user: AuthUser) -> str:
        now = int(time.time())
        payload = {
            "typ": "session",
            "iat": now,
            "exp": now + self._settings.session_ttl_seconds,
            "sub": user.user_id,
            "email": user.email,
            "name": user.name,
            "picture": user.picture,
            "roles": user.roles,
            "provider": user.provider,
            "subject": user.subject,
            "domain": user.domain,
        }
        return encode_token(payload, self._settings.token_secret.get_secret_value())
