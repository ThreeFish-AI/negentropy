"""
Web Search Configuration.

支持 Google Custom Search API 等搜索服务提供商。
设计遵循 Evolutionary Design 原则，便于未来扩展其他提供商。

参考文献:
[1] Google Custom Search API, "JSON API Reference,"
    _Google Developers_, 2024. [Online]. Available: https://developers.google.com/custom-search/v1/overview
"""

from enum import Enum

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class SearchProvider(str, Enum):
    """支持的搜索服务提供商。"""

    GOOGLE = "google"
    DUCKDUCKGO = "duckduckgo"  # 保留用于测试或回退
    BING = "bing"  # 预留扩展


class SearchSettings(BaseSettings):
    """Web Search 配置。

    环境变量前缀: NE_SEARCH_
    """

    model_config = SettingsConfigDict(
        env_prefix="NE_SEARCH_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        frozen=True,
    )

    # 核心配置
    provider: SearchProvider = Field(
        default=SearchProvider.GOOGLE,
        description="搜索服务提供商",
    )

    # Google Custom Search API 配置
    google_api_key: SecretStr | None = Field(
        default=None,
        description="Google API Key (用于 Custom Search API)",
    )
    google_cx_id: str | None = Field(
        default=None,
        description="Google Custom Search Engine ID (CX)",
    )

    # 重试与超时配置
    max_retries: int = Field(
        default=3,
        ge=0,
        le=10,
        description="最大重试次数",
    )
    timeout_seconds: float = Field(
        default=10.0,
        ge=1.0,
        le=60.0,
        description="单次请求超时秒数",
    )
    base_backoff_seconds: float = Field(
        default=1.0,
        ge=0.1,
        description="指数退避基础时间",
    )

    # 结果限制
    max_results: int = Field(
        default=10,
        ge=1,
        le=100,
        description="默认最大结果数",
    )

    def is_google_configured(self) -> bool:
        """检查 Google 配置是否完整。"""
        if self.provider != SearchProvider.GOOGLE:
            return False
        api_key = self.google_api_key
        if api_key is None:
            return False
        secret = api_key.get_secret_value()
        return bool(secret and self.google_cx_id)
