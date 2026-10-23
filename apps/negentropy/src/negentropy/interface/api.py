"""
Interface API 聚合器。

原 3,197 行单体按域拆分为六个路由模块，此处按原注册序聚合：
stats → mcp → builtin_tools → skills → agents → permissions
（permissions 为 {plugin_type}/{plugin_id} 通配路由，必须最后注册）。
路由序契约见 tests/unit_tests/interface/test_route_table_contract.py。
"""

from fastapi import APIRouter

from .agents_api import router as agents_router
from .builtin_tools_api import router as builtin_tools_router
from .mcp_api import router as mcp_router
from .permissions_api import router as permissions_router
from .skills_api import router as skills_router
from .stats_api import router as stats_router

router = APIRouter()
router.include_router(stats_router)
router.include_router(mcp_router)
router.include_router(builtin_tools_router)
router.include_router(skills_router)
router.include_router(agents_router)
router.include_router(permissions_router)
