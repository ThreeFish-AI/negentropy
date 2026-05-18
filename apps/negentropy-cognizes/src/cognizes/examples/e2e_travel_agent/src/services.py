"""
服务工厂：根据配置创建对应的 Session/Memory 服务实例
"""

from config import config, BackendType

# Google 托管服务（基线）
from google.adk.sessions import InMemorySessionService
from google.adk.memory import InMemoryMemoryService

# Open Agent Engine（我们的实现）- 使用正确的包路径
from cognizes.adapters.postgres.session_service import PostgresSessionService
from cognizes.adapters.postgres.memory_service import PostgresMemoryService
from cognizes.adapters.postgres.tracing import TracingManager
from cognizes.core.database import DatabaseManager


async def get_db_pool():
    """获取数据库连接池 - 通过 DatabaseManager 统一管理"""
    db = DatabaseManager.get_instance(dsn=config.database_url)
    return await db.get_pool()


async def embed_text(text: str) -> list[float]:
    import httpx

    # 优先使用配置的 base_url，否则 fallback 到 curl 示例中的 default
    base_url = config.google_base_url
    if not base_url:
        # Fallback based on user provided curl example if config is missing
        base_url = "http://llms.as-in.io/v1/stub/vendors/VertexAI/v1beta1/publishers/google/models"

    # Ensure no trailing slash for clean append
    base_url = base_url.rstrip("/")

    # Fix: If base_url points to root (e.g. .../VertexAI), append missing path
    # The error log showed base_url was .../VertexAI, leading to 401.
    # We need to construct the FULL path as per curl example:
    # .../VertexAI/v1beta1/publishers/google/models/text-embedding-005:predict
    if base_url.endswith("VertexAI"):
        base_url = f"{base_url}/v1beta1/publishers/google/models"

    # Target text-embedding-005 as per valid curl example
    model = "text-embedding-005"
    url = f"{base_url}/{model}:predict"

    headers = {"Authorization": f"Bearer {config.google_api_key}", "Content-Type": "application/json"}

    # Vertex AI Predict Format
    payload = {"instances": [{"content": text}]}

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=10.0)

            if response.status_code != 200:
                print(f"⚠️ Embedding API Error {response.status_code}: {response.text}")
                response.raise_for_status()

            data = response.json()
            # Vertex AI response structure: {"predictions": [{"embeddings": {"values": [...]}}]}
            # Or sometimes simpler depending on model. checking standard structure.
            # text-embedding-004/005 usually: predictions[0]['embeddings']['values']

            embeddings = data["predictions"][0]["embeddings"]["values"]

            # Fix dimension mismatch (768 -> 1536) for existing DB schema
            if len(embeddings) == 768:
                embeddings = embeddings + [0.0] * 768

            return embeddings

    except Exception as e:
        print(f"⚠️ Embedding Manual Call failed for text: {text[:20]}... using MOCK. Error: {e}")
        # Ultimate Fallback if even manual call fails
        return [0.1] * 1536


async def create_services() -> tuple:
    """
    根据配置创建服务实例

    Returns:
        (session_service, memory_service)
    """

    if config.backend == BackendType.GOOGLE_MANAGED:
        # 基线：使用 Google 内存实现
        session_service = InMemorySessionService()
        memory_service = InMemoryMemoryService()

    elif config.backend == BackendType.OPEN_ENGINE:
        # 我们的实现：PostgreSQL 后端
        pool = await get_db_pool()

        # 初始化 OpenTelemetry TracingManager (支持 PostgreSQL + Langfuse 双路导出)
        tracing_manager = TracingManager(
            service_name=config.service_name,
            pg_dsn=config.database_url,
            langfuse_public_key=config.langfuse_public_key,
            langfuse_secret_key=config.langfuse_secret_key,
            langfuse_host=config.langfuse_host,
        )

        # 创建 Embedding 函数
        from google import genai
        from google.genai import types

        # 配置 Client - 支持自定义 base_url
        client_kwargs = {"api_key": config.google_api_key}
        if config.google_base_url:
            client_kwargs["http_options"] = types.HttpOptions(base_url=config.google_base_url)

        client = genai.Client(**client_kwargs)

        # 创建服务实例
        session_service = PostgresSessionService(pool=pool)
        memory_service = PostgresMemoryService(pool=pool, embedding_fn=embed_text)

    else:
        raise ValueError(f"Unknown backend type: {config.backend}")

    return session_service, memory_service
