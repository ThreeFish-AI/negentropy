import time

import pytest

from negentropy.auth.tokens import TokenError, _b64decode, _b64encode, decode_token, encode_token


def test_base64_helpers_round_trip() -> None:
    raw = b"negentropy-token"

    encoded = _b64encode(raw)

    assert "=" not in encoded
    assert _b64decode(encoded) == raw


def test_encode_and_decode_token_round_trip() -> None:
    token = encode_token({"sub": "google:user-1", "roles": ["user"]}, "secret")

    payload = decode_token(token, "secret")

    assert payload["sub"] == "google:user-1"
    assert payload["roles"] == ["user"]


def test_encode_token_requires_secret() -> None:
    with pytest.raises(TokenError, match="token secret is required"):
        encode_token({"sub": "user"}, "")


def test_decode_token_rejects_invalid_format() -> None:
    with pytest.raises(TokenError, match="invalid token format"):
        decode_token("invalid", "secret")


def test_decode_token_rejects_invalid_signature() -> None:
    token = encode_token({"sub": "user"}, "secret")

    with pytest.raises(TokenError, match="invalid token signature"):
        decode_token(token, "other-secret")


def test_decode_token_rejects_expired_token() -> None:
    token = encode_token({"sub": "user", "exp": time.time() - 10}, "secret")

    with pytest.raises(TokenError, match="token expired"):
        decode_token(token, "secret")

