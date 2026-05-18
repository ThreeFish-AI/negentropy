"""Workflow Agent - 负责任务分解和流程编排."""

import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Any

from cognizes.agents.utils import get_category_from_paper_id

from .base import BaseAgent
from .heartfelt_agent import HeartfeltAgent
from .pdf_agent import PDFProcessingAgent
from .translation_agent import TranslationAgent

logger = logging.getLogger(__name__)


class WorkflowAgent(BaseAgent):
    """工作流协调 Agent - 负责任务分解和流程编排."""

    def __init__(self, config: dict[str, Any] | None = None):
        """初始化 WorkflowAgent.

        Args:
            config: 配置参数
        """
        super().__init__("workflow", config)
        self.papers_dir = Path(config.get("papers_dir", "papers") if config else "papers")
        self.pdf_agent = PDFProcessingAgent(config)
        self.translation_agent = TranslationAgent(config)
        self.heartfelt_agent = HeartfeltAgent(config)

    async def validate_input(self, input_data: dict[str, Any]) -> bool:
        """验证输入数据.

        Args:
            input_data: 输入数据

        Returns:
            验证是否通过
        """
        # Check if input_data is a dict
        if not isinstance(input_data, dict):
            return False

        # Check if source_path exists and is not empty
        source_path = input_data.get("source_path")
        if not source_path or not isinstance(source_path, str):
            return False

        return True

    async def process(self, input_data: dict[str, Any]) -> dict[str, Any]:
        """处理文档的主入口.

        Args:
            input_data: 包含 source_path 和 workflow 字段

        Returns:
            处理结果
        """
        # 验证输入
        if not await self.validate_input(input_data):
            return {"success": False, "error": "Invalid input data"}

        source_path = input_data.get("source_path")
        workflow = input_data.get("workflow", "full")
        paper_id = input_data.get("paper_id")

        if not source_path or not os.path.exists(source_path):
            return {"success": False, "error": f"Source file not found: {source_path}"}

        try:
            if workflow == "full":
                return await self._full_workflow(source_path, paper_id)
            elif workflow == "extract_only":
                return await self._extract_workflow(source_path, paper_id)
            elif workflow == "translate_only":
                return await self._translate_workflow(source_path, paper_id)
            elif workflow == "heartfelt_only":
                return await self._heartfelt_workflow(source_path, paper_id)
            else:
                return {"success": False, "error": f"Unsupported workflow: {workflow}"}
        except Exception as e:
            logger.error(f"Error in workflow processing: {str(e)}")
            return {"success": False, "error": str(e)}

    async def _full_workflow(self, source_path: str, paper_id: str | None = None) -> dict[str, Any]:
        """完整处理流程：提取 -> 翻译 -> 分析.

        Args:
            source_path: 源文件路径
            paper_id: 论文ID

        Returns:
            处理结果
        """
        logger.info(f"Starting full workflow for {source_path}")

        # 1. 内容提取
        extract_result = await self.pdf_agent.extract_content(
            {
                "file_path": source_path,
                "options": {
                    "extract_images": True,
                    "extract_tables": True,
                    "extract_formulas": True,
                },
            }
        )

        if not extract_result["success"]:
            return extract_result

        # 2. 翻译
        translate_result = await self.translation_agent.translate(
            {
                "content": extract_result["data"]["content"],
                "preserve_format": True,
                "paper_id": paper_id,
            }
        )

        # 3. 深度分析（异步，不阻塞返回）
        asyncio.create_task(
            self._run_heartfelt_analysis(
                source_path,
                extract_result["data"],
                translate_result.get("data"),
                paper_id,
            )
        )

        # 4. 保存结果
        if paper_id:
            await self._save_workflow_results(paper_id, extract_result, translate_result)

        return {
            "success": True,
            "extract_result": extract_result["data"],
            "translate_result": translate_result.get("data"),
            "status": "completed",
            "workflow": "full",
        }

    async def _extract_workflow(self, source_path: str, paper_id: str | None = None) -> dict[str, Any]:
        """仅提取内容流程.

        Args:
            source_path: 源文件路径
            paper_id: 论文ID

        Returns:
            提取结果
        """
        logger.info(f"Starting extract workflow for {source_path}")

        result = await self.pdf_agent.extract_content(
            {
                "file_path": source_path,
                "options": {
                    "extract_images": True,
                    "extract_tables": True,
                    "extract_formulas": True,
                },
            }
        )

        if result["success"] and paper_id:
            await self._save_extract_result(paper_id, result["data"])

        return {
            "success": result["success"],
            "data": result.get("data"),
            "error": result.get("error") if not result["success"] else None,
            "status": "completed" if result["success"] else "failed",
            "workflow": "extract_only",
        }

    async def _translate_workflow(self, source_path: str, paper_id: str | None = None) -> dict[str, Any]:
        """仅翻译流程.

        Args:
            source_path: 源文件路径
            paper_id: 论文ID

        Returns:
            翻译结果
        """
        logger.info(f"Starting translate workflow for {source_path}")

        # 首先提取内容
        extract_result = await self.pdf_agent.extract_content(
            {"file_path": source_path, "options": {"extract_images": False}}
        )

        if not extract_result["success"]:
            return extract_result

        # 然后翻译
        translate_result = await self.translation_agent.translate(
            {
                "content": extract_result["data"]["content"],
                "preserve_format": True,
                "paper_id": paper_id,
            }
        )

        return {
            "success": translate_result["success"],
            "data": translate_result.get("data"),
            "error": translate_result.get("error") if not translate_result["success"] else None,
            "status": "completed" if translate_result["success"] else "failed",
            "workflow": "translate_only",
        }

    async def _heartfelt_workflow(self, source_path: str, paper_id: str | None = None) -> dict[str, Any]:
        """仅深度分析流程.

        Args:
            source_path: 源文件路径
            paper_id: 论文ID

        Returns:
            分析结果
        """
        logger.info(f"Starting heartfelt workflow for {source_path}")

        # 首先提取内容
        extract_result = await self.pdf_agent.extract_content(
            {"file_path": source_path, "options": {"extract_images": False}}
        )

        if not extract_result["success"]:
            return extract_result

        # 进行深度分析
        heartfelt_result = await self.heartfelt_agent.analyze(
            {"content": extract_result["data"]["content"], "paper_id": paper_id}
        )

        if heartfelt_result["success"] and paper_id:
            await self._save_heartfelt_result(paper_id, heartfelt_result["data"])

        return {
            "success": heartfelt_result["success"],
            "data": heartfelt_result.get("data"),
            "error": heartfelt_result.get("error") if not heartfelt_result["success"] else None,
            "status": "completed" if heartfelt_result["success"] else "failed",
            "workflow": "heartfelt_only",
        }

    async def _run_heartfelt_analysis(
        self,
        source_path: str,
        extract_data: dict[str, Any],
        translate_data: dict[str, Any] | None,
        paper_id: str | None = None,
    ) -> None:
        """异步进行深度分析.

        Args:
            source_path: 源文件路径
            extract_data: 提取的数据
            translate_data: 翻译数据
            paper_id: 论文ID
        """
        try:
            if not extract_data or "content" not in extract_data:
                logger.error(f"No content to analyze for {paper_id}")
                return

            analysis_request = {
                "content": extract_data["content"],
                "translation": translate_data.get("content") if translate_data and isinstance(translate_data, dict) else None,
                "paper_id": paper_id,
            }

            # Perform heartfelt analysis
            result = await self.heartfelt_agent.analyze(analysis_request)

            if result and isinstance(result, dict) and result.get("success") and paper_id:
                result_data = result.get("data") or result.get("result")
                if result_data:
                    await self._save_heartfelt_result(paper_id, result_data)
                else:
                    logger.warning(f"Heartfelt analysis succeeded but no data for {paper_id}")

            logger.info(f"Heartfelt analysis completed for {paper_id}")
        except Exception as e:
            logger.error(f"Error in heartfelt analysis for {paper_id}: {str(e)}")

    # -- Result persistence helpers ------------------------------------------------

    def _persist_result(self, paper_id: str, subdir: str, data: dict[str, Any]) -> Path:
        """通用结果持久化：将 data["content"] 写入 papers/<subdir>/<category>/<paper_id>.md.

        Args:
            paper_id: 论文ID
            subdir: 子目录名 (translation / heartfelt)
            data: 包含 "content" 键的字典

        Returns:
            写入文件的 Path
        """
        category = get_category_from_paper_id(paper_id)
        output_dir = self.papers_dir / subdir / category
        output_dir.mkdir(parents=True, exist_ok=True)
        output_file = output_dir / f"{paper_id}.md"
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(data.get("content", ""))
        return output_file

    async def _save_workflow_results(
        self,
        paper_id: str,
        extract_result: dict[str, Any],
        translate_result: dict[str, Any],
    ) -> None:
        """保存工作流结果.

        Args:
            paper_id: 论文ID
            extract_result: 提取结果
            translate_result: 翻译结果
        """
        try:
            await self._save_extract_result(paper_id, extract_result)

            if translate_result:
                logger.info(f"Translate result available for {paper_id}")

        except Exception as e:
            logger.error(f"Error saving workflow results: {str(e)}")

    async def _save_extract_result(self, paper_id: str, data: dict[str, Any]) -> None:
        """保存提取结果.

        Args:
            paper_id: 论文ID
            data: 提取数据
        """
        output_file = self._persist_result(paper_id, "translation", data)

        # 保存图片（如果有）
        if "images" in data:
            category = get_category_from_paper_id(paper_id)
            images_dir = self.papers_dir / "images" / category
            images_dir.mkdir(parents=True, exist_ok=True)
            # 这里应该处理图片保存逻辑

        logger.info(f"Extract result saved to {output_file}")

    async def _save_heartfelt_result(self, paper_id: str, data: dict[str, Any]) -> None:
        """保存深度分析结果.

        Args:
            paper_id: 论文ID
            data: 分析数据
        """
        output_file = self._persist_result(paper_id, "heartfelt", data)
        logger.info(f"Heartfelt result saved to {output_file}")

    # -- Batch processing ---------------------------------------------------------

    async def batch_process(
        self,
        documents: list[str],
        workflow_type: str = "full",
        concurrent: bool = True,
    ) -> dict[str, Any]:
        """批量处理多个文档.

        Args:
            documents: 文档路径列表
            workflow_type: 工作流类型 (extract_only, translate_only, heartfelt_only, full)
            concurrent: 是否并发执行，False 时顺序执行

        Returns:
            批量处理结果，包含 success / total / successful / failed / results
            以及 backward-compat 的 success_count / failure_count 别名
        """
        logger.info(f"Starting batch processing for {len(documents)} documents")

        async def _process_one(doc_path: str) -> dict[str, Any]:
            paper_id = os.path.splitext(os.path.basename(doc_path))[0]
            return await self.process(
                {"source_path": doc_path, "workflow": workflow_type, "paper_id": paper_id}
            )

        if concurrent:
            raw_results = await asyncio.gather(
                *[_process_one(p) for p in documents],
                return_exceptions=True,
            )
        else:
            raw_results = []
            for doc_path in documents:
                try:
                    raw_results.append(await _process_one(doc_path))
                except Exception as exc:
                    raw_results.append(exc)

        # 归一化结果
        processed_results: list[dict[str, Any]] = []
        successful = 0
        failed = 0

        for result in raw_results:
            if isinstance(result, Exception):
                processed_results.append({"success": False, "error": str(result)})
                failed += 1
            elif isinstance(result, dict):
                processed_results.append(result)
                if result.get("success"):
                    successful += 1
                else:
                    failed += 1
            else:
                processed_results.append({"success": False, "error": "Unknown result type"})
                failed += 1

        return {
            "success": True,
            "total": len(documents),
            "successful": successful,
            "failed": failed,
            "results": processed_results,
            # backward-compat aliases
            "success_count": successful,
            "failure_count": failed,
        }

    async def batch_process_papers(self, paper_paths: list[str], workflow_type: str = "full") -> dict[str, Any]:
        """Alias for batch_process with sequential execution."""
        return await self.batch_process(paper_paths, workflow_type=workflow_type, concurrent=False)

    # -- Status & metadata --------------------------------------------------------

    async def get_workflow_status(self, paper_id: str) -> dict[str, Any]:
        """获取工作流状态.

        Args:
            paper_id: 论文ID

        Returns:
            工作流状态信息
        """
        try:
            # Load metadata for the paper
            metadata = await self._load_metadata(paper_id)

            # Handle case where metadata is None (test case expects error status)
            if metadata is None:
                return {
                    "paper_id": paper_id,
                    "status": "error",
                    "progress": 0,
                    "current_stage": "unknown",
                    "stages_completed": [],
                    "total_stages": 3,
                    "error": "Paper not found",
                    "last_updated": None,
                    "workflows": {},
                }

            # Handle case where metadata is empty dict (no file found)
            if not metadata:
                return {
                    "paper_id": paper_id,
                    "status": "unknown",
                    "progress": 0,
                    "current_stage": "unknown",
                    "stages_completed": [],
                    "total_stages": 3,
                    "error": None,
                    "last_updated": None,
                    "workflows": {},
                }

            # Extract status information
            status = metadata.get("status", "unknown")
            progress = metadata.get("progress", 0)
            current_stage = metadata.get("current_stage", "unknown")
            error = metadata.get("error", None)

            # Get stage-specific details
            stages_completed = metadata.get("stages_completed", [])
            total_stages = metadata.get("total_stages", 3)  # extract, translate, heartfelt

            # Ensure workflows key exists
            workflows = metadata.get("workflows", {})

            return {
                "paper_id": paper_id,
                "status": status,
                "progress": progress,
                "current_stage": current_stage,
                "stages_completed": stages_completed,
                "total_stages": total_stages,
                "error": error,
                "last_updated": metadata.get("last_updated"),
                "workflows": workflows,
            }
        except Exception as e:
            logger.error(f"Failed to get workflow status for {paper_id}: {str(e)}")
            return {
                "paper_id": paper_id,
                "status": "error",
                "progress": 0,
                "current_stage": "unknown",
                "error": str(e),
                "last_updated": None,
                "workflows": {},
            }

    async def _load_metadata(self, paper_id: str) -> dict[str, Any]:
        """Load metadata for a paper.

        Args:
            paper_id: The paper ID

        Returns:
            Metadata dictionary
        """
        metadata_file = self.papers_dir / f"{paper_id}_metadata.json"

        if metadata_file.exists():
            try:
                with open(metadata_file) as f:
                    metadata = json.load(f)
                    if "paper_id" not in metadata:
                        metadata["paper_id"] = paper_id
                    return metadata
            except Exception as e:
                logger.error(f"Failed to load metadata from {metadata_file}: {str(e)}")
                return {"paper_id": paper_id}

        return {}
