"""
Interface 模块。

提供 MCP Server、Skill、Agent、Models 的管理和权限控制功能。
"""

from .api import router
from .models_api import router as models_router
from .task_models_api import corpus_router as task_models_corpus_router
from .task_models_api import router as task_models_router

__all__ = [
    "router",
    "models_router",
    "task_models_router",
    "task_models_corpus_router",
]
