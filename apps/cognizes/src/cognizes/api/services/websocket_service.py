"""WebSocket service for real-time communication."""

import logging
from typing import Any

logger = logging.getLogger(__name__)


class WebSocketService:
    """WebSocket 服务."""

    def __init__(self, connection_manager: Any) -> None:
        """初始化 WebSocketService.

        Args:
            connection_manager: 连接管理器实例
        """
        self.manager = connection_manager

    async def send_task_update(
        self,
        task_id: str,
        status: str,
        progress: float | None = None,
        message: str | None = None,
    ) -> None:
        """发送任务更新.

        Args:
            task_id: 任务ID
            status: 状态
            progress: 进度
            message: 消息
        """
        from datetime import datetime

        try:
            # Create the update message
            update_message = {
                "type": "task_update",
                "task_id": task_id,
                "status": status,
                "progress": progress if progress is not None else 0.0,
                "message": message if message is not None else "",
                "timestamp": datetime.now().isoformat(),
            }

            # Send via manager
            await self.manager.broadcast_to_subscribers(update_message, task_id)
        except Exception as e:
            logger.error(f"Error sending task update: {str(e)}")
            # Don't raise the exception, just log it for reliability

    async def send_task_completion(
        self,
        task_id: str,
        result: dict[str, Any] | None = None,
        error: str | None = None,
    ) -> None:
        """发送任务完成通知.

        Args:
            task_id: 任务ID
            result: 结果
            error: 错误
        """
        from datetime import datetime

        try:
            # Create the completion message
            completion_message = {
                "type": "task_completed",
                "task_id": task_id,
                "success": error is None,
                "result": result if result is not None else {},
                "error": error if error is not None else "",
                "timestamp": datetime.now().isoformat(),
            }

            # Send via manager
            await self.manager.broadcast_to_subscribers(completion_message, task_id)
        except Exception as e:
            logger.error(f"Error sending task completion: {str(e)}")
            # Don't raise the exception, just log it for reliability

    async def send_batch_progress(
        self,
        batch_id: str,
        total_or_progress: int | dict[str, Any],
        processed: int | None = None,
        current_file: str | None = None,
    ) -> None:
        """发送批处理进度.

        Args:
            batch_id: 批次ID
            total_or_progress: 总数（当processed不为None时）或进度字典（旧API兼容）
            processed: 已处理数
            current_file: 当前文件
        """
        from datetime import datetime

        # Support both old and new API
        if isinstance(total_or_progress, dict) and processed is None:
            # Old API: send_batch_progress(batch_id, progress_dict)
            progress_dict = total_or_progress
            total = progress_dict.get("total", 0)
            processed = progress_dict.get("completed", 0)
            current_file = progress_dict.get("current", "")
        else:
            # New API: Use parameters directly
            total = total_or_progress
            processed = processed if processed is not None else 0
            current_file = current_file if current_file is not None else ""

        # Create the progress message
        progress_message = {
            "type": "batch_progress",
            "batch_id": batch_id,
            "total": total,
            "processed": processed,
            "progress": processed / total * 100 if total > 0 else 0,
            "current_file": current_file,
            "timestamp": datetime.now().isoformat(),
        }

        # Broadcast to all active connections (matching the route function behavior)
        for client_id in self.manager.active_connections:
            try:
                await self.manager.send_personal_message(progress_message, client_id)
            except Exception as e:
                logger.error(f"Error sending batch progress to client {client_id}: {str(e)}")
                # Continue with other clients

    async def send_paper_analysis(self, paper_id: str, analysis_data: dict[str, Any]) -> None:
        """发送论文分析结果.

        Args:
            paper_id: 论文ID
            analysis_data: 分析数据
        """
        from datetime import datetime

        try:
            # Flatten the analysis data into the message structure
            message = {
                "type": "paper_analysis",
                "paper_id": paper_id,
                "timestamp": datetime.now().isoformat(),
            }
            # Add all analysis data fields directly to the message
            message.update(analysis_data)

            # Send via manager
            await self.manager.broadcast_to_subscribers(message, paper_id)
        except Exception as e:
            logger.error(f"Error sending paper analysis: {str(e)}")
            # Don't raise the exception, just log it for reliability
