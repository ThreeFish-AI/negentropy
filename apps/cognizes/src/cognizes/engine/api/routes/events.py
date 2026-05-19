from fastapi import APIRouter
from starlette.responses import StreamingResponse
from cognizes.engine.pulse.event_bridge import PulseEventBridge, create_sse_endpoint

router = APIRouter()


@router.get("/api/runs/{run_id}/events")
async def stream_events(run_id: str):
    bridge = PulseEventBridge(...)  # 注入依赖
    return StreamingResponse(create_sse_endpoint(bridge, run_id), media_type="text/event-stream")
