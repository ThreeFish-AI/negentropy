"""
FastAPI 应用入口

提供 WebSocket 和 SSE 端点，用于实时事件推送。
"""

import os
import asyncio
import logging

from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from cognizes.engine.pulse.pg_notify_listener import PgNotifyListener, NotifyEvent
from cognizes.core.database import DatabaseManager

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 数据库连接配置
DB_DSN = os.getenv("DATABASE_URL", "postgresql://aigc:@localhost/cognizes-engine")

# 全局监听器实例
listener: PgNotifyListener | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    global listener

    # 启动时：初始化监听器
    listener = PgNotifyListener(dsn=DB_DSN, channels=["event_stream"])
    await listener.start()
    logger.info("✓ PgNotifyListener started")

    yield

    # 关闭时：停止监听器
    if listener:
        await listener.stop()
        logger.info("✓ PgNotifyListener stopped")


app = FastAPI(
    title="Pulse Event Stream API",
    description="WebSocket & SSE 实时事件推送服务",
    lifespan=lifespan,
)


@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {"status": "ok", "listener_running": listener._running if listener else False}


@app.websocket("/ws/events/{thread_id}")
async def websocket_endpoint(websocket: WebSocket, thread_id: str):
    """
    WebSocket 端点：订阅指定 thread_id 的实时事件

    Usage:
        ws://localhost:8000/ws/events/{thread_id}
    """
    await websocket.accept()
    logger.info(f"WebSocket connected: thread_id={thread_id}")

    queue: asyncio.Queue = asyncio.Queue()

    async def on_event(event: NotifyEvent):
        """事件回调：将事件放入队列"""
        payload_thread_id = event.payload.get("thread_id") or event.payload.get("data", {}).get("thread_id")
        if payload_thread_id == thread_id or thread_id == "*":
            await queue.put(event)

    # 注册回调
    if listener:
        listener.on_event("event_stream", on_event)

    try:
        while True:
            event = await queue.get()
            await websocket.send_json(
                {
                    "channel": event.channel,
                    "payload": event.payload,
                    "received_at": event.received_at.isoformat(),
                }
            )
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: thread_id={thread_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")


@app.get("/api/test-notify")
async def test_notify():
    """
    测试端点：发送一条 NOTIFY 消息

    用于验证 WebSocket 推送链路
    """
    import json
    from datetime import datetime

    db = DatabaseManager.get_instance()
    payload = json.dumps(
        {
            "thread_id": "test-thread",
            "event_type": "test",
            "message": "Hello from test-notify!",
            "timestamp": datetime.now().isoformat(),
        }
    )
    await db.execute(f"NOTIFY event_stream, '{payload}'")
    return {"status": "sent", "payload": payload}


@app.get("/api/runs/{run_id}/events")
async def sse_events(run_id: str):
    """
    SSE 端点：订阅指定 run_id 的 AG-UI 事件流

    Usage:
        curl -N http://localhost:8000/api/runs/test-run/events

    Response:
        Content-Type: text/event-stream
        data: {"type":"CUSTOM","runId":"test-run","timestamp":...}
    """
    from starlette.responses import StreamingResponse
    from cognizes.engine.pulse.event_bridge import AgUiEvent, AgUiEventType
    import json

    async def event_generator():
        """生成 SSE 事件流"""
        queue: asyncio.Queue = asyncio.Queue()

        async def on_event(event: NotifyEvent):
            """事件回调：将事件放入队列"""
            payload_run_id = event.payload.get("run_id") or event.payload.get("id")
            if payload_run_id == run_id or run_id == "*":
                await queue.put(event)

        # 注册回调
        if listener:
            listener.on_event("event_stream", on_event)

        try:
            # 发送初始连接事件
            initial_event = AgUiEvent(
                type=AgUiEventType.CUSTOM,
                run_id=run_id,
                data={"name": "connected", "message": f"SSE stream for run_id={run_id}"},
            )
            yield initial_event.to_sse()

            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    # 转换为 AG-UI 事件格式
                    agui_event = AgUiEvent(type=AgUiEventType.RAW, run_id=run_id, data={"payload": event.payload})
                    yield agui_event.to_sse()
                except asyncio.TimeoutError:
                    # 发送心跳保持连接
                    heartbeat = AgUiEvent(type=AgUiEventType.CUSTOM, run_id=run_id, data={"name": "heartbeat"})
                    yield heartbeat.to_sse()
        except asyncio.CancelledError:
            logger.info(f"SSE stream cancelled: run_id={run_id}")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 禁用 Nginx 缓冲
        },
    )


@app.get("/api/test-sse-notify/{run_id}")
async def test_sse_notify(run_id: str):
    """
    测试端点：发送一条带 run_id 的 NOTIFY 消息

    用于验证 SSE 推送链路
    """
    import json
    from datetime import datetime

    db = DatabaseManager.get_instance()
    payload = json.dumps(
        {
            "run_id": run_id,
            "table": "events",
            "operation": "INSERT",
            "data": {
                "id": f"evt-{run_id}",
                "run_id": run_id,
                "event_type": "message",
                "content": {"text": f"Hello from SSE test for {run_id}!"},
            },
            "timestamp": datetime.now().isoformat(),
        }
    )
    await db.execute(f"NOTIFY event_stream, '{payload}'")
    return {"status": "sent", "run_id": run_id, "payload": payload}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
