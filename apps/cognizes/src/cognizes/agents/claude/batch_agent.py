"""Batch Processing Agent - 封装批量处理功能."""

import asyncio
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any

from .base import BaseAgent

logger = logging.getLogger(__name__)


class BatchProcessingAgent(BaseAgent):
    """批量处理专用 Agent."""

    def __init__(self, config: dict[str, Any] | None = None):
        """初始化 BatchProcessingAgent.

        Args:
            config: 配置参数
        """
        super().__init__("batch_processor", config)
        self.papers_dir = Path(config.get("papers_dir", "papers") if config else "papers")
        self.default_options = {
            "batch_size": 10,  # 每批处理的文件数
            "parallel_tasks": 3,  # 并行任务数
            "failed_retry": 2,  # 失败重试次数
            "progress_callback": None,  # 进度回调函数
        }

    async def process(self, input_data: dict[str, Any]) -> dict[str, Any]:
        """处理批量请求.

        Args:
            input_data: 包含文件列表和处理选项

        Returns:
            批量处理结果
        """
        files = input_data.get("files", [])
        workflow = input_data.get("workflow", "full")
        options = {**self.default_options, **input_data.get("options", {})}

        if not files:
            return {"success": False, "error": "No files provided"}

        return await self.batch_process(
            {
                "files": files,
                "workflow": workflow,
                "options": options,
            }
        )

    async def batch_process(self, params: dict[str, Any]) -> dict[str, Any]:
        """批量处理文档.

        Args:
            params: 批量处理参数

        Returns:
            批量处理结果
        """
        files = params.get("files", [])
        workflow = params.get("workflow", "full")
        options = params.get("options", {})

        # 验证文件
        valid_files = await self._validate_files(files)
        if not valid_files["success"]:
            return valid_files

        # 开始批量处理
        start_time = datetime.now()
        logger.info(f"Starting batch processing for {len(valid_files['files'])} files")

        # 创建批次
        batches = self._create_batches(valid_files["files"], options.get("batch_size", 10))

        # 处理所有批次
        all_results = []
        total_files = len(valid_files["files"])
        processed_files = 0

        for i, batch in enumerate(batches):
            logger.info(f"Processing batch {i + 1}/{len(batches)} with {len(batch)} files")

            # 处理当前批次
            batch_results = await self._process_batch(batch, workflow, options)

            all_results.extend(batch_results)
            processed_files += len(batch)

            # 调用进度回调
            if options.get("progress_callback"):
                await options["progress_callback"](
                    {
                        "total": total_files,
                        "processed": processed_files,
                        "current_batch": i + 1,
                        "total_batches": len(batches),
                        "progress": processed_files / total_files * 100,
                    }
                )

        # 统计结果
        end_time = datetime.now()
        stats = self._calculate_stats(all_results, start_time, end_time)

        logger.info(f"Batch processing completed: {stats['successful']}/{stats['total']} successful")

        return {
            "success": True,
            "stats": stats,
            "results": all_results,
        }

    async def _validate_files(self, files: list[str]) -> dict[str, Any]:
        """验证文件列表.

        Args:
            files: 文件路径列表

        Returns:
            验证结果
        """
        valid_files = []
        invalid_files = []

        for file_path in files:
            if not os.path.exists(file_path):
                invalid_files.append({"path": file_path, "error": "File not found"})
            elif not file_path.lower().endswith(".pdf"):
                invalid_files.append({"path": file_path, "error": "Not a PDF file"})
            else:
                valid_files.append(file_path)

        return {
            "success": True,
            "files": valid_files,
            "invalid": invalid_files,
        }

    def _create_batches(self, files: list[str], batch_size: int) -> list[list[str]]:
        """创建文件批次.

        Args:
            files: 文件列表
            batch_size: 批次大小

        Returns:
            批次列表
        """
        batches = []
        for i in range(0, len(files), batch_size):
            batch = files[i : i + batch_size]
            batches.append(batch)

        return batches

    async def _process_batch(self, files: list[str], workflow: str, options: dict[str, Any]) -> list[dict[str, Any]]:
        """处理单个批次.

        Args:
            files: 批次文件列表
            workflow: 工作流类型
            options: 处理选项

        Returns:
            批次处理结果
        """
        parallel_tasks = options.get("parallel_tasks", 3)
        failed_retry = options.get("failed_retry", 2)

        # 创建任务列表
        tasks = []
        for file_path in files:
            task = self._process_single_file(file_path, workflow, failed_retry)
            tasks.append(task)

        # 控制并发数
        semaphore = asyncio.Semaphore(parallel_tasks)

        async def controlled_process(task: Any) -> Any:
            async with semaphore:
                return await task

        # 执行所有任务
        controlled_tasks = [controlled_process(task) for task in tasks]
        results = await asyncio.gather(*controlled_tasks, return_exceptions=True)

        # 处理结果
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append(
                    {
                        "file_path": files[i],
                        "success": False,
                        "error": str(result),
                    }
                )
            else:
                processed_results.append(result) if isinstance(result, dict) else processed_results.append(
                    {
                        "success": False,
                        "error": f"Unexpected result type: {type(result)}",
                    }
                )

        return processed_results

    async def _process_single_file(self, file_path: str, workflow: str, retry_count: int) -> dict[str, Any]:
        """处理单个文件，支持重试.

        Args:
            file_path: 文件路径
            workflow: 工作流
            retry_count: 重试次数

        Returns:
            处理结果
        """
        last_error = None

        for attempt in range(retry_count + 1):
            try:
                # 生成 paper_id
                file_name = os.path.splitext(os.path.basename(file_path))[0]
                category = self._get_category_from_path(file_path)
                paper_id = f"{category}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file_name}"

                # 调用 WorkflowAgent 处理
                from .workflow_agent import WorkflowAgent

                workflow_agent = WorkflowAgent({"papers_dir": str(self.papers_dir)})

                result = await workflow_agent.process(
                    {
                        "source_path": file_path,
                        "workflow": workflow,
                        "paper_id": paper_id,
                    }
                )

                if result["success"]:
                    return {
                        "file_path": file_path,
                        "paper_id": paper_id,
                        "success": True,
                        "workflow": workflow,
                        "result": result,
                        "attempt": attempt + 1,
                    }
                else:
                    last_error = result.get("error", "Unknown error")

            except Exception as e:
                last_error = str(e)
                logger.error(f"Error processing {file_path} (attempt {attempt + 1}): {last_error}")

                if attempt < retry_count:
                    # 等待后重试
                    await asyncio.sleep(2**attempt)  # 指数退避

        return {
            "file_path": file_path,
            "success": False,
            "error": last_error,
            "attempts": retry_count + 1,
        }

    def _get_category_from_path(self, file_path: str) -> str:
        """从文件路径推断分类.

        Args:
            file_path: 文件路径

        Returns:
            分类名称
        """
        # 从路径中提取分类
        path_parts = Path(file_path).parts

        # 查找可能的分类目录
        category_keywords = [
            "llm-agents",
            "context-engineering",
            "knowledge-graphs",
            "multi-agent",
            "reasoning",
            "planning",
        ]

        for part in path_parts:
            part_lower = part.lower()
            for keyword in category_keywords:
                if keyword in part_lower:
                    return keyword

        # 默认分类
        return "general"

    def _calculate_stats(
        self, results: list[dict[str, Any]], start_time: datetime, end_time: datetime
    ) -> dict[str, Any]:
        """计算处理统计信息.

        Args:
            results: 处理结果列表
            start_time: 开始时间
            end_time: 结束时间

        Returns:
            统计信息
        """
        total = len(results)
        successful = sum(1 for r in results if r.get("success"))
        failed = total - successful

        # 按工作流分组统计
        workflow_stats = {}
        for result in results:
            workflow = result.get("workflow", "unknown")
            if workflow not in workflow_stats:
                workflow_stats[workflow] = {"total": 0, "successful": 0}
            workflow_stats[workflow]["total"] += 1
            if result.get("success"):
                workflow_stats[workflow]["successful"] += 1

        # 计算处理时间
        duration = (end_time - start_time).total_seconds()

        return {
            "total": total,
            "successful": successful,
            "failed": failed,
            "success_rate": successful / total * 100 if total > 0 else 0,
            "duration": duration,
            "throughput": total / duration if duration > 0 else 0,
            "workflow_stats": workflow_stats,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
        }

    async def get_batch_status(self, batch_id: str) -> dict[str, Any]:
        """获取批次处理状态.

        Args:
            batch_id: 批次ID

        Returns:
            批次状态
        """
        # 这里可以实现批次状态跟踪
        # 例如从数据库或文件中读取状态
        return {"batch_id": batch_id, "status": "not_implemented"}

    async def cancel_batch(self, batch_id: str) -> dict[str, Any]:
        """取消批次处理.

        Args:
            batch_id: 批次ID

        Returns:
            取消结果
        """
        # 这里可以实现批次取消逻辑
        return {
            "batch_id": batch_id,
            "status": "cancelled",
            "message": "not_implemented",
        }
