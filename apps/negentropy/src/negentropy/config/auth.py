"""
SSO/Auth Configuration.
"""

from enum import Enum
from typing import Literal, Optional

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class AuthMode(str, Enum):
    OFF = "off"
    OPTIONAL = "optional"
    STRICT = "strict"


class AuthSettings(BaseSettings):
    """SSO/Auth settings."""

    model_config = SettingsConfigDict(
        env_prefix="NE_AUTH_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        frozen=True,
    )

    enabled: bool = Field(default=True, description="Enable SSO endpoints and middleware")
    mode: AuthMode = Field(default=AuthMode.OPTIONAL, description="Auth enforcement mode")

    token_secret: SecretStr = Field(default=SecretStr(""), description="HMAC secret for session tokens")

    google_client_id: Optional[str] = Field(default=None, description="Google OAuth client ID")
    google_client_secret: Optional[SecretStr] = Field(default=None, description="Google OAuth client secret")
    google_redirect_uri: Optional[str] = Field(default=None, description="Google OAuth redirect URI")
    google_scopes: list[str] = Field(default_factory=lambda: ["openid", "email", "profile"])

    cookie_name: str = Field(default="ne_sso", description="Session cookie name")
    cookie_domain: Optional[str] = Field(default=None, description="Session cookie domain")
    cookie_secure: bool = Field(default=False, description="Send cookie over HTTPS only")
    cookie_same_site: Literal["lax", "strict", "none"] = Field(default="lax", description="SameSite policy")

    session_ttl_seconds: int = Field(default=60 * 60 * 24 * 7, description="Session TTL in seconds")
    state_ttl_seconds: int = Field(default=600, description="OAuth state TTL in seconds")

    allowed_domains: list[str] = Field(default_factory=list, description="Allowed email domains (hd)")
    allowed_emails: list[str] = Field(default_factory=list, description="Allowed email addresses")
    admin_emails: list[str] = Field(default_factory=list, description="Emails with admin role")

    user_id_strategy: Literal["sub", "email"] = Field(
        default="sub", description="User ID source: google sub or email"
    )
    default_redirect_path: str = Field(default="/", description="Default redirect path after login")
