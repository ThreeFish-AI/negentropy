from __future__ import annotations

import base64
import hmac
import json
import time
from hashlib import sha256
from typing import Any


class TokenError(ValueError):
    pass


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _sign(data: str, secret: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), data.encode("utf-8"), sha256).digest()
    return _b64encode(digest)


def encode_token(payload: dict[str, Any], secret: str) -> str:
    if not secret:
        raise TokenError("token secret is required")
    encoded = _b64encode(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    signature = _sign(encoded, secret)
    return f"{encoded}.{signature}"


def decode_token(token: str, secret: str) -> dict[str, Any]:
    if not secret:
        raise TokenError("token secret is required")
    parts = token.split(".")
    if len(parts) != 2:
        raise TokenError("invalid token format")
    encoded, signature = parts
    expected = _sign(encoded, secret)
    if not hmac.compare_digest(signature, expected):
        raise TokenError("invalid token signature")
    payload = json.loads(_b64decode(encoded))
    exp = payload.get("exp")
    if exp is not None and time.time() > float(exp):
        raise TokenError("token expired")
    return payload
