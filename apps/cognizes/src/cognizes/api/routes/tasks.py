"""Task management routes."""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from cognizes.api.models.task import TaskListResponse, TaskResponse
from cognizes.api.services.task_service import TaskService

logger = logging.getLogger(__name__)
router = APIRouter()


# 依赖注入
async def get_task_service() -> TaskService:
    """获取 TaskService 实例."""
    return TaskService()


@router.get("/", response_model=TaskListResponse)
async def list_tasks(
    status: str | None = Query(None, description="按状态筛选"),
    paper_id: str | None = Query(None, description="按论文 ID 筛选"),
    workflow: str | None = Query(None, description="按工作流筛选"),
    limit: int = Query(20, ge=1, le=100, description="返回数量限制"),
    offset: int = Query(0, ge=0, description="偏移量"),
    service: TaskService = Depends(get_task_service),
) -> dict[str, Any]:
    """
    获取任务列表.

    - **status**: 状态筛选
    - **paper_id**: 论文 ID 筛选
    - **workflow**: 工作流筛选
    - **limit**: 返回数量限制
    - **offset**: 偏移量
    """
    try:
        tasks = await service.list_tasks(
            status=status,
            paper_id=paper_id,
            workflow=workflow,
            limit=limit,
            offset=offset,
        )
        return tasks
    except Exception as e:
        logger.error(f"Error listing tasks: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取任务列表失败: {str(e)}") from e


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: str = Path(..., description="任务 ID"),
    service: TaskService = Depends(get_task_service),
) -> dict[str, Any]:
    """
    获取任务详情.

    - **task_id**: 任务 ID
    """
    try:
        task = await service.get_task(task_id)
        return task
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Error getting task {task_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取任务失败: {str(e)}") from e


@router.delete("/{task_id}")
async def cancel_task(
    task_id: str = Path(..., description="任务 ID"),
    service: TaskService = Depends(get_task_service),
) -> dict[str, Any]:
    """
    取消任务.

    - **task_id**: 任务 ID
    """
    try:
        result = await service.cancel_task(task_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Error canceling task {task_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"取消任务失败: {str(e)}") from e


@router.get("/{task_id}/logs")
async def get_task_logs(
    task_id: str = Path(..., description="任务 ID"),
    lines: int = Query(100, ge=1, le=1000, description="返回日志行数"),
    service: TaskService = Depends(get_task_service),
) -> dict[str, Any]:
    """
    获取任务日志.

    - **task_id**: 任务 ID
    - **lines**: 返回日志行数
    """
    try:
        logs = await service.get_task_logs(task_id, lines)
        return {"task_id": task_id, "logs": logs}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Error getting task logs {task_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取日志失败: {str(e)}") from e


@router.delete("/cleanup")
async def cleanup_completed_tasks(
    older_than_hours: int = Query(24, ge=1, description="清理多少小时前的任务"),
    service: TaskService = Depends(get_task_service),
) -> dict[str, Any]:
    """
    清理已完成的任务.

    - **older_than_hours**: 清理多少小时前的任务
    """
    try:
        result = await service.cleanup_completed_tasks(older_than_hours)
        return result
    except Exception as e:
        logger.error(f"Error cleaning up tasks: {str(e)}")
        raise HTTPException(status_code=500, detail=f"清理任务失败: {str(e)}") from e
