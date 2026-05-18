"""CopilotKit AG-UI 服务端"""

from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import AsyncGenerator
import json
import uuid

app = FastAPI()

# 添加 CORS 支持
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/copilotkit/info")
async def copilotkit_info():
    """
    CopilotKit /info 端点

    返回已注册的 Agent 信息，CopilotKit 前端会在初始化时调用此端点
    注意：CopilotKit 期望 agents 是对象格式（Record<string, AgentInfo>），不是数组
    """
    return JSONResponse(
        content={
            # agents 必须是对象格式：{ "agent_id": { "description": "..." } }
            "agents": {
                "default": {
                    "description": "Travel Agent - 帮助用户规划旅行",
                }
            },
            "actions": {},
        }
    )


@app.post("/api/copilotkit")
async def copilotkit_endpoint(request: Request):
    """
    CopilotKit AG-UI 端点

    支持两种模式：
    1. Single Endpoint Transport: body 包含 method 字段
       - method: "info" -> 返回 Agent 信息 JSON
       - method: "agent/run" -> 返回 SSE 事件流
    2. REST Transport: 直接处理消息，返回 SSE 事件流
    """
    body = await request.json()

    # 检查是否是 Single Endpoint Transport 模式的 info 请求
    method = body.get("method")
    if method == "info":
        # 返回 Agent 信息（与 GET /info 相同）
        return JSONResponse(
            content={
                "agents": {
                    "default": {
                        "description": "Travel Agent - 帮助用户规划旅行",
                    }
                },
                "actions": {},
            }
        )

    # 获取或生成 threadId（CopilotKit 协议要求）
    thread_id = body.get("threadId") or str(uuid.uuid4())

    # 获取消息和工具定义
    # Single Endpoint Transport 模式下，消息在 body.body 中
    # REST Transport 模式下，消息直接在 body 中
    inner_body = body.get("body", body)
    messages = inner_body.get("messages", [])
    frontend_tools = inner_body.get("tools", [])

    async def generate_events() -> AsyncGenerator[str, None]:
        run_id = str(uuid.uuid4())
        message_id = str(uuid.uuid4())

        # 发送运行开始事件（必须包含 threadId）
        yield f"data: {json.dumps({'type': 'RUN_STARTED', 'threadId': thread_id, 'runId': run_id})}\n\n"

        # 发送消息开始事件
        yield f"data: {json.dumps({'type': 'TEXT_MESSAGE_START', 'messageId': message_id, 'role': 'assistant'})}\n\n"

        # 模拟流式消息内容
        # 获取用户最后一条消息用于生成响应
        user_message = ""
        if messages:
            last_msg = messages[-1]
            user_message = last_msg.get("content", "")

        # 生成简单的模拟响应
        response_chunks = [
            "你好！",
            "我是您的 AI 助手。",
            f"您刚才说的是：「{user_message[:20]}」" if user_message else "有什么可以帮助您的？",
        ]

        for chunk in response_chunks:
            yield f"data: {json.dumps({'type': 'TEXT_MESSAGE_CONTENT', 'messageId': message_id, 'delta': chunk})}\n\n"

        # 发送消息结束事件
        yield f"data: {json.dumps({'type': 'TEXT_MESSAGE_END', 'messageId': message_id})}\n\n"

        # 发送运行完成事件
        yield f"data: {json.dumps({'type': 'RUN_FINISHED', 'threadId': thread_id, 'runId': run_id})}\n\n"

    return StreamingResponse(generate_events(), media_type="text/event-stream")
