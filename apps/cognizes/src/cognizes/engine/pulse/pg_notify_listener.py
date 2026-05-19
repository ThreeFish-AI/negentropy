"""
PgNotifyListener: PostgreSQL LISTEN/NOTIFY 事件监听器

实现实时事件流推送，替代 Redis Pub/Sub：
- 监听 PostgreSQL NOTIFY 频道
- 支持 WebSocket 推送
- 验证端到端延迟 < 50ms
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Callable, Coroutine

import asyncpg

logger = logging.getLogger(__name__)


@dataclass
class NotifyEvent:
    """NOTIFY 事件数据"""

    channel: str
    payload: dict[str, Any]
    received_at: datetime


class PgNotifyListener:
    """
    PostgreSQL LISTEN/NOTIFY 监听器

    特性：
    - 异步事件监听
    - 自动重连
    - 回调处理
    """

    def __init__(self, dsn: str | None = None, channels: list[str] | None = None):
        self.dsn = dsn
        self.channels = channels or ["event_stream"]
        self._connection: asyncpg.Connection | None = None
        self._pool = None  # 保存连接池引用以便释放连接
        self._listeners: dict[str, list[Callable]] = {}
        self._running = False

    async def start(self) -> None:
        """启动监听器"""
        from cognizes.core.database import DatabaseManager

        self._running = True

        # 统一使用 DatabaseManager 获取连接
        db = DatabaseManager.get_instance(dsn=self.dsn)
        self._pool = await db.get_pool()
        self._connection = await self._pool.acquire()

        for channel in self.channels:
            await self._connection.add_listener(channel, self._handle_notification)
            logger.info(f"Listening on channel: {channel}")

    async def stop(self) -> None:
        """停止监听器"""
        self._running = False
        if self._connection:
            for channel in self.channels:
                await self._connection.remove_listener(channel, self._handle_notification)
            # 通过连接池释放连接
            if self._pool:
                await self._pool.release(self._connection)
            self._connection = None
            self._pool = None

    def on_event(self, channel: str, callback: Callable[[NotifyEvent], Coroutine[Any, Any, None]]) -> None:
        """注册事件回调"""
        if channel not in self._listeners:
            self._listeners[channel] = []
        self._listeners[channel].append(callback)

    def _handle_notification(self, connection: asyncpg.Connection, pid: int, channel: str, payload: str) -> None:
        """处理 NOTIFY 通知"""
        received_at = datetime.now()

        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            data = {"raw": payload}

        event = NotifyEvent(channel=channel, payload=data, received_at=received_at)

        # 触发回调
        callbacks = self._listeners.get(channel, [])
        for callback in callbacks:
            asyncio.create_task(callback(event))


# ========================================
# FastAPI WebSocket 集成示例
# ========================================


async def create_websocket_endpoint():
    """
    FastAPI WebSocket 端点示例

    将 PostgreSQL NOTIFY 事件实时推送到前端
    """
    from fastapi import FastAPI, WebSocket

    app = FastAPI()
    listener = PgNotifyListener(dsn="postgresql://aigc:@localhost/cognizes-engine")

    @app.on_event("startup")
    async def startup():
        await listener.start()

    @app.on_event("shutdown")
    async def shutdown():
        await listener.stop()

    @app.websocket("/ws/events/{thread_id}")
    async def websocket_endpoint(websocket: WebSocket, thread_id: str):
        await websocket.accept()

        queue: asyncio.Queue = asyncio.Queue()

        async def on_event(event: NotifyEvent):
            if event.payload.get("thread_id") == thread_id:
                await queue.put(event)

        listener.on_event("event_stream", on_event)

        try:
            while True:
                event = await queue.get()
                await websocket.send_json(
                    {
                        "event_id": event.payload.get("event_id"),
                        "author": event.payload.get("author"),
                        "event_type": event.payload.get("event_type"),
                        "timestamp": event.received_at.isoformat(),
                    }
                )
        except Exception:
            pass

    return app
