from __future__ import annotations

from typing import Optional

from fastapi import HTTPException, Request, status

from negentropy.config import settings

from .service import AuthService, AuthUser
from .tokens import TokenError


def _extract_bearer_token(request: Request) -> Optional[str]:
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header.split(" ", 1)[1].strip()
    cookie_name = settings.auth.cookie_name
    if cookie_name in request.cookies:
        return request.cookies.get(cookie_name)
    return None


def get_current_user(request: Request) -> AuthUser:
    token = _extract_bearer_token(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing auth token")
    try:
        return AuthService().decode_session(token)
    except TokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


def get_optional_user(request: Request) -> Optional[AuthUser]:
    token = _extract_bearer_token(request)
    if not token:
        return None
    try:
        return AuthService().decode_session(token)
    except TokenError:
        return None
