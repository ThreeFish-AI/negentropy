"""FastAPI application for Agentic AI Papers."""

import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# 导入并注册路由
from cognizes.api.routes import papers, tasks, websocket

# 配置日志
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """应用生命周期管理."""
    # 启动时初始化
    logger.info("Starting Agentic AI Papers API...")
    try:
        # 初始化服务
        from cognizes.api.services.task_service import task_service

        await task_service.initialize()
        logger.info("Services initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize services: {str(e)}")
        raise

    yield

    # 关闭时清理
    logger.info("Shutting down Agentic AI Papers API...")
    try:
        from cognizes.api.services.task_service import task_service

        await task_service.cleanup()
        logger.info("Services cleanup completed")
    except Exception as e:
        logger.error(f"Error during cleanup: {str(e)}")


# 创建 FastAPI 应用
app = FastAPI(
    title="Agentic AI Papers API",
    description="AI 论文收集、翻译和管理平台 API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:9003", "http://127.0.0.1:9003"],  # 本地开发
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 全局异常处理
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """全局异常处理器."""
    logger.error(f"Global exception: {str(exc)}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error", "error": str(exc)})


# 健康检查
@app.get("/health")
async def health_check() -> dict[str, str]:
    """健康检查接口."""
    return {
        "status": "healthy",
        "service": "agentic-ai-cognizes-api",
        "version": "1.0.0",
    }


app.include_router(papers.router, prefix="/api/papers", tags=["papers"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(websocket.router, prefix="/ws", tags=["websocket"])


# 根路径
@app.get("/")
async def root() -> dict[str, str]:
    """根路径."""
    return {
        "message": "Agentic AI Papers API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }


# 启动事件
@app.on_event("startup")
async def startup_event() -> None:
    """启动事件."""
    logger.info("Agentic AI Papers API started successfully")


# 关闭事件
@app.on_event("shutdown")
async def shutdown_event() -> None:
    """关闭事件."""
    logger.info("Agentic AI Papers API shutdown")
