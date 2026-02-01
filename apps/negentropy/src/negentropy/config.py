from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for Negentropy agent."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Application
    app_name: str = "negentropy"

    # Model Configuration
    default_model: str = "openai/glm-4.7"
    orchestrator_model: str = "openai/glm-4.7"  # 强推理模型用于 Root Agent
    faculty_model: str = "openai/glm-4.7"  # 通用模型用于 Faculty Agents

    # Database
    database_url: str = "postgresql+asyncpg://aigc:@localhost:5432/negentropy"
    db_pool_size: int = 5
    db_max_overflow: int = 10
    db_pool_recycle: int = 3600
    db_echo: bool = False

    # MemoryService Backend: inmemory | vertexai | postgres
    memory_service_backend: str = "postgres"

    # SessionService Backend: inmemory | vertexai | postgres
    session_service_backend: str = "postgres"

    # VertexAI Configuration (required when using vertexai backend)
    vertex_project_id: str | None = None
    vertex_location: str | None = None
    vertex_agent_engine_id: str | None = None


settings = Settings()
