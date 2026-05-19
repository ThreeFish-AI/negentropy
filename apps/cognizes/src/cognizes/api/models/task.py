"""Task related data models."""

from typing import Any

from pydantic import BaseModel, Field


class TaskResponse(BaseModel):
    """任务响应模型."""

    task_id: str = Field(..., description="任务ID")
    paper_id: str = Field(..., description="论文ID")
    workflow: str = Field(..., description="工作流类型")
    status: str = Field(..., description="任务状态")
    progress: float = Field(default=0, ge=0, le=100, description="进度百分比")
    message: str = Field(default="", description="状态消息")
    result: dict[str, Any] | None = Field(None, description="处理结果")
    error: str | None = Field(None, description="错误信息")
    created_at: str = Field(..., description="创建时间")
    updated_at: str = Field(..., description="更新时间")
    params: dict[str, Any] | None = Field(None, description="任务参数")

    model_config = {
        "json_schema_extra": {
            "example": {
                "task_id": "task_12345678-1234-1234-1234-123456789abc",
                "paper_id": "llm-agents_20240115_example.pdf",
                "workflow": "full",
                "status": "processing",
                "progress": 65.5,
                "message": "正在翻译内容...",
                "created_at": "2024-01-15T14:30:00",
                "updated_at": "2024-01-15T14:35:00",
            }
        }
    }


class TaskInfo(BaseModel):
    """任务信息模型（用于列表）."""

    task_id: str = Field(..., description="任务ID")
    paper_id: str = Field(..., description="论文ID")
    workflow: str = Field(..., description="工作流类型")
    status: str = Field(..., description="任务状态")
    progress: float = Field(default=0, description="进度百分比")
    created_at: str = Field(..., description="创建时间")
    updated_at: str = Field(..., description="更新时间")


class TaskListResponse(BaseModel):
    """任务列表响应模型."""

    tasks: list[TaskInfo] = Field(..., description="任务列表")
    total: int = Field(..., description="总数")
    offset: int = Field(..., description="偏移量")
    limit: int = Field(..., description="限制数")


class TaskUpdate(BaseModel):
    """任务更新模型（WebSocket 消息）."""

    type: str = Field(..., description="消息类型")
    task_id: str = Field(..., description="任务ID")
    status: str | None = Field(None, description="状态")
    progress: float | None = Field(None, description="进度")
    message: str | None = Field(None, description="消息")
    timestamp: str = Field(..., description="时间戳")


class TaskCompletion(BaseModel):
    """任务完成模型（WebSocket 消息）."""

    type: str = Field(..., description="消息类型")
    task_id: str = Field(..., description="任务ID")
    success: bool = Field(..., description="是否成功")
    result: dict[str, Any] | None = Field(None, description="结果")
    error: str | None = Field(None, description="错误")
    timestamp: str = Field(..., description="时间戳")


class BatchProgress(BaseModel):
    """批处理进度模型（WebSocket 消息）."""

    type: str = Field(..., description="消息类型")
    batch_id: str = Field(..., description="批次ID")
    total: int = Field(..., description="总数")
    processed: int = Field(..., description="已处理数")
    progress: float = Field(..., description="进度百分比")
    current_file: str | None = Field(None, description="当前文件")
    timestamp: str = Field(..., description="时间戳")


class WebSocketMessage(BaseModel):
    """WebSocket 消息基模型."""

    type: str = Field(..., description="消息类型")
    timestamp: str = Field(..., description="时间戳")


class SubscribeMessage(WebSocketMessage):
    """订阅消息模型."""

    type: str = Field(default="subscribe", description="消息类型")
    task_id: str = Field(..., description="任务ID")


class UnsubscribeMessage(WebSocketMessage):
    """取消订阅消息模型."""

    type: str = Field(default="unsubscribe", description="消息类型")
    task_id: str = Field(..., description="任务ID")


class PingMessage(WebSocketMessage):
    """心跳消息模型."""

    type: str = Field(default="ping", description="消息类型")


class PongMessage(WebSocketMessage):
    """心跳响应消息模型."""

    type: str = Field(default="pong", description="消息类型")


class SubscriptionConfirmed(WebSocketMessage):
    """订阅确认消息模型."""

    type: str = Field(default="subscription_confirmed", description="消息类型")
    task_id: str = Field(..., description="任务ID")


class UnsubscriptionConfirmed(WebSocketMessage):
    """取消订阅确认消息模型."""

    type: str = Field(default="unsubscription_confirmed", description="消息类型")
    task_id: str = Field(..., description="任务ID")
