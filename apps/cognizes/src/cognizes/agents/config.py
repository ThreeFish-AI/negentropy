"""Application configuration."""

import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

# 加载环境变量
load_dotenv()


class Settings:
    """应用设置."""

    def __init__(self) -> None:
        """初始化设置，从环境变量读取配置."""
        # 基本设置
        self.DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
        self.LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

        # API 设置
        self.API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
        self.API_PORT: int = int(os.getenv("API_PORT", "8000"))
        self.API_PREFIX: str = os.getenv("API_PREFIX", "/api")

        # 文件存储
        self.PAPERS_DIR: str = os.getenv("PAPERS_DIR", "papers")
        self.MAX_UPLOAD_SIZE: int = int(os.getenv("MAX_UPLOAD_SIZE", "50")) * 1024 * 1024  # MB

        # Claude API
        self.ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
        self.ANTHROPIC_BASE_URL: str = os.getenv("ANTHROPIC_BASE_URL", "")

        # 基本配置属性，其他配置会动态使用这些值
        self._init_configs()

    def _init_configs(self) -> None:
        """初始化配置字典."""
        # Agent 设置
        self.WORKFLOW_CONFIG: dict[str, Any] = {
            "papers_dir": self.PAPERS_DIR,
            "batch_size": int(os.getenv("BATCH_SIZE", "10")),
            "parallel_tasks": int(os.getenv("PARALLEL_TASKS", "3")),
        }

        self.PDF_CONFIG: dict[str, Any] = {
            "papers_dir": self.PAPERS_DIR,
            "extract_images": os.getenv("EXTRACT_IMAGES", "true").lower() == "true",
            "extract_tables": os.getenv("EXTRACT_TABLES", "true").lower() == "true",
            "extract_formulas": os.getenv("EXTRACT_FORMULAS", "true").lower() == "true",
        }

        # 翻译设置
        self.TRANSLATION_CONFIG: dict[str, Any] = {
            "target_language": os.getenv("TARGET_LANGUAGE", "zh"),
            "preserve_format": os.getenv("PRESERVE_FORMAT", "true").lower() == "true",
            "batch_size": int(os.getenv("TRANSLATION_BATCH_SIZE", "5000")),
        }

        # WebSocket 设置
        self.WS_HEARTBEAT_INTERVAL: int = int(os.getenv("WS_HEARTBEAT_INTERVAL", "30"))
        self.WS_CONNECTION_TIMEOUT: int = int(os.getenv("WS_CONNECTION_TIMEOUT", "600"))

        # 数据库设置（保留但暂不使用）
        self.DATABASE_URL: str | None = os.getenv("DATABASE_URL")

        # Redis 设置（保留但暂不使用）
        self.REDIS_URL: str | None = os.getenv("REDIS_URL")

        # 安全设置
        self.SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-this")
        self.ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

        # CORS 设置
        self.CORS_ORIGINS: list[str] = os.getenv("CORS_ORIGINS", "http://localhost:9003").split(",")

        # 日志设置
        self.LOG_DIR: str = os.getenv("LOG_DIR", "logs")
        self.LOG_FILE: str = os.path.join(self.LOG_DIR, "app.log")
        self.LOG_MAX_SIZE: int = int(os.getenv("LOG_MAX_SIZE", "10")) * 1024 * 1024  # MB
        self.LOG_BACKUP_COUNT: int = int(os.getenv("LOG_BACKUP_COUNT", "5"))

    @property
    def papers_path(self) -> Path:
        """获取论文目录路径."""
        return Path(self.PAPERS_DIR)

    @property
    def log_path(self) -> Path:
        """获取日志目录路径."""
        return Path(self.LOG_DIR)


# 创建全局设置实例
settings = Settings()
