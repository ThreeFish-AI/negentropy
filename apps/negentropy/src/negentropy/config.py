from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for Negentropy agent."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Application
    app_name: str = "negentropy"

    # Model Configuration
    default_model: str = "openai/glm-4.7"
    orchestrator_model: str = "openai/glm-4.7"
    faculty_model: str = "openai/glm-4.7"

    # OpenAI Configuration
    openai_api_key: str | None = None
    openai_base_url: str | None = None

    # Logging Configuration
    log_level: str = "INFO"
    log_sinks: str = "stdio"  # stdio | file | gcloud (comma-separated)
    log_format: str = "console"  # console (dev) | json (machine)
    log_file_path: str = "logs/negentropy.log"
    gcloud_log_name: str = "negentropy"

    # Database
    database_url: str = "postgresql+asyncpg://aigc:@localhost:5432/negentropy"
    db_pool_size: int = 5
    db_max_overflow: int = 10
    db_pool_recycle: int = 3600
    db_echo: bool = False

    # CredentialService Backend: postgres | inmemory | session
    # - postgres: Custom PostgresCredentialService (Persistent, Production-grade)
    # - inmemory: ADK InMemoryCredentialService
    # - session: ADK SessionStateCredentialService
    credential_service_backend: str = "inmemory"

    # MemoryService Backend: inmemory | vertexai | postgres
    memory_service_backend: str = "inmemory"

    # SessionService Backend: inmemory | vertexai | database | postgres
    # - database: ADK 官方 DatabaseSessionService
    # - postgres: 自定义 PostgresSessionService (使用 negentropy.models.pulse)
    session_service_backend: str = "inmemory"

    # VertexAI Configuration (required when using vertexai backend)
    vertex_project_id: str | None = None
    vertex_location: str | None = None
    vertex_agent_engine_id: str | None = None

    # ArtifactService Backend: inmemory | gcs
    artifact_service_backend: str = "inmemory"
    gcs_bucket_name: str | None = None


settings = Settings()
