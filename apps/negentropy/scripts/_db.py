"""scripts/ 目录共享数据库工具。

提供脚本级别的数据库连接管理和异步入口点，消除各脚本中的重复样板代码。
脚本通过 ``sys.path[0]`` 自动解析同目录模块，可直接 ``from _db import ...``。
"""

from __future__ import annotations

import asyncio
import sys
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

from sqlalchemy.ext.asyncio import AsyncConnection, create_async_engine

from negentropy.config import settings


@asynccontextmanager
async def script_engine(**kwargs: Any) -> AsyncGenerator:
    """为独立脚本创建临时引擎，退出时自动 dispose。"""
    engine = create_async_engine(str(settings.database_url), **kwargs)
    try:
        yield engine
    finally:
        await engine.dispose()


@asynccontextmanager
async def script_connection(**engine_kwargs: Any) -> AsyncGenerator[AsyncConnection]:
    """快捷方式：创建引擎 + 获取连接，自动清理。"""
    async with script_engine(**engine_kwargs) as engine:
        async with engine.connect() as conn:
            yield conn


def run_script(coro: Any) -> None:
    """asyncio.run 封装 + 统一错误处理。"""
    try:
        exit_code = asyncio.run(coro)
        sys.exit(exit_code if isinstance(exit_code, int) else 0)
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
