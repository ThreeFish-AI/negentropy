"""
配置管理：支持在 Google 托管服务与 Open Agent Engine 之间切换
"""

import os
from enum import Enum
from dataclasses import dataclass
from dotenv import load_dotenv

# Explicitly load .env file from the project root or current directory
# This ensures DATABASE_URL is available when running via streamlit
load_dotenv(override=True)


class BackendType(Enum):
    GOOGLE_MANAGED = "google"
    OPEN_ENGINE = "postgres"


@dataclass
class AppConfig:
    # 后端类型
    backend: BackendType = BackendType.OPEN_ENGINE

    # PostgreSQL 配置
    database_url: str = os.getenv("DATABASE_URL", "postgresql://aigc:@localhost:5432/cognizes-engine")

    # Gemini 配置
    google_api_key: str = os.getenv("GOOGLE_API_KEY", "")
    google_base_url: str = os.getenv("GOOGLE_BASE_URL", "")  # 自定义 API 端点
    model_name: str = os.getenv("GOOGLE_GENAI_MODEL", "gemini-2.5-flash")

    # OpenTelemetry 配置
    otel_endpoint: str = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4317")
    service_name: str = os.getenv("OTEL_SERVICE_NAME", "travel-agent-demo")

    # Langfuse 配置
    langfuse_secret_key: str = os.getenv("LANGFUSE_SECRET_KEY", "")
    langfuse_public_key: str = os.getenv("LANGFUSE_PUBLIC_KEY", "")
    langfuse_host: str = os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com")

    # 应用配置
    app_name: str = os.getenv("APP_NAME", "travel_agent")
    default_user_id: str = os.getenv("DEFAULT_USER_ID", "demo_user")


config = AppConfig()
