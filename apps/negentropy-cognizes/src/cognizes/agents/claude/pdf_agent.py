"""PDF Processing Agent - 封装 PDF 处理功能."""

import logging
import os
from typing import Any

from .base import BaseAgent

logger = logging.getLogger(__name__)


class PDFProcessingAgent(BaseAgent):
    """PDF 处理专用 Agent."""

    def __init__(self, config: dict[str, Any] | None = None):
        """初始化 PDFProcessingAgent.

        Args:
            config: 配置参数
        """
        super().__init__("pdf_processor", config)
        self.default_options = {
            "extract_images": True,
            "extract_tables": True,
            "extract_formulas": True,
            "output_format": "markdown",
        }

    async def process(self, input_data: dict[str, Any]) -> dict[str, Any]:
        """处理 PDF 文档.

        Args:
            input_data: 包含 file_path 和 options 字段

        Returns:
            处理结果
        """
        file_path = input_data.get("file_path")
        options = {**self.default_options, **input_data.get("options", {})}

        if not file_path:
            return {"success": False, "error": "No file path provided"}

        if not os.path.exists(file_path):
            return {"success": False, "error": f"File not found: {file_path}"}

        return await self.extract_content({"file_path": file_path, "options": options})

    async def extract_content(self, params: dict[str, Any]) -> dict[str, Any]:
        """提取 PDF 内容.

        Args:
            params: 包含 file_path 和 options 的参数

        Returns:
            提取结果
        """
        file_path = params.get("file_path")
        options = params.get("options", {})

        try:
            # 调用 pdf-reader skill
            skill_params = {
                "pdf_source": file_path,
                "method": options.get("method", "auto"),
                "include_metadata": options.get("include_metadata", True),
                "extract_images": options.get("extract_images", True),
                "extract_tables": options.get("extract_tables", True),
                "extract_formulas": options.get("extract_formulas", True),
                "output_format": options.get("output_format", "markdown"),
                "page_range": options.get("page_range"),
            }

            # 如果需要嵌入图片
            if options.get("embed_images"):
                skill_params["embed_images"] = True
                skill_params["embed_options"] = options.get("embed_options", {})

            result = await self.call_skill("pdf-reader", skill_params)

            if result["success"]:
                # 提取元数据
                metadata = self._extract_metadata(result["data"], file_path or "")

                # 处理图片路径
                if options.get("extract_images") and "images" in result["data"]:
                    result["data"]["images"] = self._process_images(
                        result["data"]["images"],
                        file_path or "",
                        options.get("paper_id") or "",
                    )

                return {
                    "success": True,
                    "data": {
                        "content": result["data"].get("markdown", result["data"].get("content", "")),
                        "metadata": metadata,
                        "images": result["data"].get("images", []),
                        "tables": result["data"].get("tables", []),
                        "formulas": result["data"].get("formulas", []),
                        "page_count": result["data"].get("page_count", 0),
                        "word_count": self._count_words(result["data"].get("content", "")),
                    },
                }
            else:
                return result

        except Exception as e:
            logger.error(f"Error extracting PDF content: {str(e)}")
            return {"success": False, "error": str(e)}

    async def batch_extract(self, file_paths: list[str], options: dict[str, Any] | None = None) -> dict[str, Any]:
        """批量提取 PDF 内容.

        Args:
            file_paths: PDF 文件路径列表
            options: 提取选项

        Returns:
            批量提取结果
        """
        calls = []
        for file_path in file_paths:
            calls.append(
                {
                    "skill": "pdf-reader",
                    "params": {
                        "pdf_source": file_path,
                        "method": options.get("method", "auto") if options else "auto",
                        "include_metadata": True,
                        "extract_images": options.get("extract_images", True) if options else True,
                        "extract_tables": options.get("extract_tables", True) if options else True,
                        "extract_formulas": options.get("extract_formulas", True) if options else True,
                    },
                }
            )

        results = await self.batch_call_skill(calls)

        # 处理结果
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, dict) and result.get("success"):
                processed_results.append(
                    {
                        "file_path": file_paths[i],
                        "success": True,
                        "data": result["data"],
                    }
                )
            else:
                processed_results.append(
                    {
                        "file_path": file_paths[i],
                        "success": False,
                        "error": str(result) if not isinstance(result, dict) else result.get("error"),
                    }
                )

        return {"success": True, "total": len(file_paths), "results": processed_results}

    def _extract_metadata(self, data: dict[str, Any], file_path: str) -> dict[str, Any]:
        """提取 PDF 元数据.

        Args:
            data: PDF 数据
            file_path: 文件路径

        Returns:
            元数据字典
        """
        metadata = {
            "file_name": os.path.basename(file_path),
            "file_path": file_path,
            "file_size": os.path.getsize(file_path) if os.path.exists(file_path) else 0,
        }

        # 从 PDF 数据中提取元数据
        if "metadata" in data:
            pdf_metadata = data["metadata"]
            metadata.update(
                {
                    "title": pdf_metadata.get("title", ""),
                    "author": pdf_metadata.get("author", ""),
                    "creator": pdf_metadata.get("creator", ""),
                    "producer": pdf_metadata.get("producer", ""),
                    "creation_date": pdf_metadata.get("creation_date", ""),
                    "modification_date": pdf_metadata.get("modification_date", ""),
                }
            )

        # 添加统计信息
        metadata["page_count"] = data.get("page_count", 0)
        metadata["word_count"] = self._count_words(data.get("content", ""))
        metadata["image_count"] = len(data.get("images", []))
        metadata["table_count"] = len(data.get("tables", []))
        metadata["formula_count"] = len(data.get("formulas", []))

        return metadata

    def _process_images(
        self, images: list[dict[str, Any]], pdf_path: str, paper_id: str | None = None
    ) -> list[dict[str, Any]]:
        """处理提取的图片信息.

        Args:
            images: 图片信息列表
            pdf_path: PDF 文件路径
            paper_id: 论文ID

        Returns:
            处理后的图片信息
        """
        processed_images = []

        for img in images:
            processed_img = {
                "index": img.get("index", 0),
                "page": img.get("page", 0),
                "caption": img.get("caption", ""),
                "format": img.get("format", "png"),
                "size": img.get("size", [0, 0]),
            }

            # 如果有嵌入的图片数据
            if "data" in img:
                processed_img["data"] = img["data"]
                processed_img["embedded"] = True
            else:
                # 生成图片文件名
                category = paper_id.split("_")[0] if paper_id and "_" in paper_id else "general"
                pdf_name = os.path.splitext(os.path.basename(pdf_path))[0]
                img_filename = f"{pdf_name}_p{img.get('page', 0)}_{img.get('index', 0)}.{img.get('format', 'png')}"
                img_path = f"images/{category}/{img_filename}"

                processed_img["path"] = img_path
                processed_img["filename"] = img_filename
                processed_img["embedded"] = False

            processed_images.append(processed_img)

        return processed_images

    def _count_words(self, content: str) -> int:
        """计算字数.

        Args:
            content: 文本内容

        Returns:
            字数
        """
        if not content:
            return 0

        # 简单的字数统计，可以根据需要优化
        words = content.split()
        return len(words)

    async def validate_pdf(self, file_path: str) -> dict[str, Any]:
        """验证 PDF 文件.

        Args:
            file_path: PDF 文件路径

        Returns:
            验证结果
        """
        if not os.path.exists(file_path):
            return {"valid": False, "error": "File does not exist"}

        if not file_path.lower().endswith(".pdf"):
            return {"valid": False, "error": "Not a PDF file"}

        file_size = os.path.getsize(file_path)
        if file_size == 0:
            return {"valid": False, "error": "Empty file"}

        # 可以添加更多的 PDF 验证逻辑
        return {
            "valid": True,
            "file_size": file_size,
            "file_name": os.path.basename(file_path),
        }
