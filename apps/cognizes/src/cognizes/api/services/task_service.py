"""Task service for managing background tasks."""

import logging
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class TaskService:
    """任务管理服务."""

    def __init__(self) -> None:
        """初始化 TaskService."""
        self.tasks: dict[str, dict[str, Any]] = {}  # 内存中的任务存储
        self.logs_dir = Path("logs/tasks")
        self.logs_dir.mkdir(parents=True, exist_ok=True)

    async def initialize(self) -> None:
        """初始化服务."""
        logger.info("TaskService initialized")
        # 可以在这里加载持久化的任务

    async def cleanup(self) -> None:
        """清理服务."""
        logger.info("TaskService cleanup completed")
        # 保存正在运行的任务状态

    async def create_task(self, paper_id: str, workflow: str, params: dict[str, Any] | None = None) -> str:
        """创建新任务.

        Args:
            paper_id: 论文ID
            workflow: 工作流类型
            params: 任务参数

        Returns:
            任务ID
        """
        task_id = str(uuid.uuid4())

        task = {
            "task_id": task_id,
            "paper_id": paper_id,
            "workflow": workflow,
            "status": "pending",
            "progress": 0,
            "message": "",
            "result": None,
            "error": None,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "params": params or {},
        }

        self.tasks[task_id] = task

        # 保存到日志文件
        await self._save_task_log(task_id, "Task created")

        return task_id

    async def get_task(self, task_id: str) -> dict[str, Any]:
        """获取任务详情.

        Args:
            task_id: 任务ID

        Returns:
            任务详情
        """
        if task_id not in self.tasks:
            raise ValueError(f"Task not found: {task_id}")

        return self.tasks[task_id]

    async def update_task(
        self,
        task_id: str,
        status: str | None = None,
        progress: float | None = None,
        message: str | None = None,
        result: dict[str, Any] | None = None,
        error: str | None = None,
    ) -> None:
        """更新任务状态.

        Args:
            task_id: 任务ID
            status: 状态
            progress: 进度（0-100）
            message: 消息
            result: 结果
            error: 错误信息
        """
        if task_id not in self.tasks:
            logger.warning(f"Task not found for update: {task_id}")
            return

        task = self.tasks[task_id]

        if status is not None:
            task["status"] = status
        if progress is not None:
            task["progress"] = max(0, min(100, progress))
        if message is not None:
            task["message"] = message
        if result is not None:
            task["result"] = result
        if error is not None:
            task["error"] = error

        task["updated_at"] = datetime.now().isoformat()

        # 保存状态更新
        log_message = f"Status: {status}, Progress: {progress}%"
        if message:
            log_message += f", Message: {message}"
        if error:
            log_message += f", Error: {error}"

        await self._save_task_log(task_id, log_message)

        # 发送 WebSocket 更新（如果可用）
        try:
            from ..routes.websocket import send_task_update

            await send_task_update(task_id, status or "unknown", progress or 0.0, message or "")

            # 如果任务完成，发送完成通知
            if status in ["completed", "failed"]:
                # 发送任务更新消息而不是未定义的函数
                await send_task_update(
                    task_id,
                    status or "unknown",
                    progress=100.0 if status == "completed" else progress,
                    message=message,
                )
        except Exception as e:
            logger.error(f"Error sending WebSocket update: {str(e)}")

    async def cancel_task(self, task_id: str) -> dict[str, Any]:
        """取消任务.

        Args:
            task_id: 任务ID

        Returns:
            取消结果
        """
        if task_id not in self.tasks:
            raise ValueError(f"Task not found: {task_id}")

        task = self.tasks[task_id]

        if task["status"] in ["completed", "failed", "cancelled"]:
            return {
                "task_id": task_id,
                "status": task["status"],
                "message": f"Task is already {task['status']}",
            }

        # 更新状态
        await self.update_task(task_id, status="cancelled", message="Task cancelled by user")

        return {
            "task_id": task_id,
            "status": "cancelled",
            "message": "Task cancelled successfully",
        }

    async def list_tasks(
        self,
        status: str | None = None,
        paper_id: str | None = None,
        workflow: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> dict[str, Any]:
        """获取任务列表.

        Args:
            status: 状态筛选
            paper_id: 论文ID筛选
            workflow: 工作流筛选
            limit: 返回数量限制
            offset: 偏移量

        Returns:
            任务列表
        """
        tasks = list(self.tasks.values())

        # 应用筛选
        if status:
            tasks = [t for t in tasks if t["status"] == status]
        if paper_id:
            tasks = [t for t in tasks if t["paper_id"] == paper_id]
        if workflow:
            tasks = [t for t in tasks if t["workflow"] == workflow]

        # 排序（按创建时间倒序）
        tasks.sort(key=lambda x: x["created_at"], reverse=True)

        # 分页
        total = len(tasks)
        tasks = tasks[offset : offset + limit]

        return {"tasks": tasks, "total": total, "offset": offset, "limit": limit}

    async def get_task_logs(self, task_id: str, lines: int = 100) -> list[str]:
        """获取任务日志.

        Args:
            task_id: 任务ID
            lines: 返回日志行数

        Returns:
            日志行列表
        """
        log_file = self.logs_dir / f"{task_id}.log"

        if not log_file.exists():
            return []

        try:
            with open(log_file, encoding="utf-8") as f:
                all_lines = f.readlines()

            # 返回最后 N 行
            return [line.strip() for line in all_lines[-lines:]]

        except Exception as e:
            logger.error(f"Error reading task logs: {str(e)}")
            return []

    async def cleanup_completed_tasks(self, older_than_hours: int = 24) -> dict[str, Any]:
        """清理已完成的任务.

        Args:
            older_than_hours: 清理多少小时前的任务

        Returns:
            清理结果
        """
        cutoff_time = datetime.now() - timedelta(hours=older_than_hours)
        cutoff_str = cutoff_time.isoformat()

        tasks_to_remove = []

        for task_id, task in self.tasks.items():
            if task["status"] in ["completed", "failed", "cancelled"]:
                if task["updated_at"] < cutoff_str:
                    tasks_to_remove.append(task_id)

        # 删除任务
        for task_id in tasks_to_remove:
            del self.tasks[task_id]

            # 删除日志文件
            log_file = self.logs_dir / f"{task_id}.log"
            if log_file.exists():
                log_file.unlink()

        logger.info(f"Cleaned up {len(tasks_to_remove)} old tasks")

        return {"cleaned": len(tasks_to_remove), "cutoff_time": cutoff_str}

    async def _save_task_log(self, task_id: str, message: str) -> None:
        """保存任务日志.

        Args:
            task_id: 任务ID
            message: 日志消息
        """
        log_file = self.logs_dir / f"{task_id}.log"
        timestamp = datetime.now().isoformat()

        try:
            with open(log_file, "a", encoding="utf-8") as f:
                f.write(f"[{timestamp}] {message}\n")
        except Exception as e:
            logger.error(f"Error saving task log: {str(e)}")

    async def get_task_statistics(self) -> dict[str, Any]:
        """获取任务统计信息.

        Returns:
            统计信息
        """
        stats = {
            "total": len(self.tasks),
            "pending": 0,
            "processing": 0,
            "completed": 0,
            "failed": 0,
            "cancelled": 0,
        }

        for task in self.tasks.values():
            status = task["status"]
            if status in stats:
                stats[status] += 1

        # 计算成功率
        completed = stats["completed"]
        finished = stats["completed"] + stats["failed"] + stats["cancelled"]
        stats["success_rate"] = int((completed / finished * 100) if finished > 0 else 0)

        return stats


# 创建全局实例
task_service = TaskService()
