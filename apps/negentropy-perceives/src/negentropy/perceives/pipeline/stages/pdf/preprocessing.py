"""S0: 预处理与源解析 Stage。

验证 PDF 源（URL 或本地路径）、下载远程文件、检查加密状态、
提取基础元数据（页数、作者、标题等）并规范化页码范围。

委托关系：
- ``pdf._sources`` — URL 判断与远程 PDF 下载
- ``pdf._imports`` — PyMuPDF / pypdf 延迟导入
"""

from __future__ import annotations

import logging
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from ...base import Stage, StageResult
from ...models import (
    DocumentCharacteristics,
    PreprocessingInput,
    PreprocessingOutput,
)
from ...registry import register_tool
from .._base import PDFToolBase

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 工具适配器
# ---------------------------------------------------------------------------


@register_tool("preprocessing.pymupdf")
class FitzPreprocessor(PDFToolBase):
    """基于 PyMuPDF 的预处理工具。"""

    tool_name = "pymupdf"

    def is_available(self) -> bool:
        try:
            from ....pdf._imports import import_fitz

            import_fitz()
            return True
        except ImportError:
            return False

    async def _run(
        self, input_data: PreprocessingInput
    ) -> StageResult[PreprocessingOutput]:
        """执行 PDF 预处理：源解析、元数据提取、页码规范化。"""
        try:
            from ....pdf._imports import import_fitz
            from ....pdf._sources import download_pdf_to_temp, is_pdf_url

            fitz = import_fitz()

            # 1. 源解析：URL 下载或本地路径验证
            if is_pdf_url(input_data.source):
                temp_dir = tempfile.mkdtemp(prefix="pdf_preprocess_")
                local_path = await download_pdf_to_temp(input_data.source, temp_dir)
                if local_path is None:
                    return StageResult(
                        success=False,
                        error=f"无法下载 PDF: {input_data.source}",
                    )
            else:
                local_path = Path(input_data.source)
                if not local_path.exists():
                    return StageResult(
                        success=False,
                        error=f"PDF 文件不存在: {input_data.source}",
                    )

            # 2. 打开 PDF，检查加密
            doc = fitz.open(str(local_path))
            if doc.is_encrypted:
                if input_data.password:
                    if not doc.authenticate(input_data.password):
                        doc.close()
                        return StageResult(success=False, error="PDF 密码验证失败")
                else:
                    doc.close()
                    return StageResult(success=False, error="PDF 已加密，需提供密码")

            # 3. 提取元数据
            metadata: Dict[str, Any] = {}
            raw_meta = doc.metadata or {}
            metadata["title"] = raw_meta.get("title", "")
            metadata["author"] = raw_meta.get("author", "")
            metadata["subject"] = raw_meta.get("subject", "")
            metadata["creator"] = raw_meta.get("creator", "")
            metadata["producer"] = raw_meta.get("producer", "")
            metadata["creation_date"] = raw_meta.get("creationDate", "")
            metadata["modification_date"] = raw_meta.get("modDate", "")
            metadata["total_pages"] = doc.page_count
            metadata["file_size_bytes"] = local_path.stat().st_size

            # 4. 规范化页码范围
            page_range: Optional[Tuple[int, int]] = None
            if input_data.page_range:
                start_page = max(0, input_data.page_range[0])
                end_page = min(doc.page_count, input_data.page_range[1])
                page_range = (start_page, end_page)

            page_count = doc.page_count

            # 5. 构建初步特征（详细特征由 S1 quick_scan 完成）
            characteristics = DocumentCharacteristics(
                page_count=page_count,
            )

            doc.close()

            output = PreprocessingOutput(
                local_path=local_path,
                page_count=page_count,
                characteristics=characteristics,
                metadata=metadata,
                page_range=page_range,
            )

            return StageResult(
                success=True,
                output=output,
                engine_used=self.tool_name,
                metadata={"source": input_data.source},
            )

        except ImportError as e:
            return StageResult(success=False, error=f"PyMuPDF 未安装: {e}")
        except Exception as e:
            logger.exception("预处理阶段异常")
            return StageResult(success=False, error=f"预处理失败: {e}")


@register_tool("preprocessing.pypdf")
class PyPDFPreprocessor(PDFToolBase):
    """基于 pypdf 的预处理工具（降级方案）。"""

    tool_name = "pypdf"

    def is_available(self) -> bool:
        try:
            from ....pdf._imports import import_pypdf

            import_pypdf()
            return True
        except ImportError:
            return False

    async def _run(
        self, input_data: PreprocessingInput
    ) -> StageResult[PreprocessingOutput]:
        """使用 pypdf 执行基础预处理。"""
        try:
            from ....pdf._imports import import_pypdf
            from ....pdf._sources import download_pdf_to_temp, is_pdf_url

            pypdf = import_pypdf()

            # 1. 源解析
            if is_pdf_url(input_data.source):
                temp_dir = tempfile.mkdtemp(prefix="pdf_preprocess_")
                local_path = await download_pdf_to_temp(input_data.source, temp_dir)
                if local_path is None:
                    return StageResult(
                        success=False,
                        error=f"无法下载 PDF: {input_data.source}",
                    )
            else:
                local_path = Path(input_data.source)
                if not local_path.exists():
                    return StageResult(
                        success=False,
                        error=f"PDF 文件不存在: {input_data.source}",
                    )

            # 2. 打开 PDF
            reader = pypdf.PdfReader(str(local_path))
            if reader.is_encrypted:
                if input_data.password:
                    reader.decrypt(input_data.password)
                else:
                    return StageResult(success=False, error="PDF 已加密，需提供密码")

            page_count = len(reader.pages)

            # 3. 提取元数据
            metadata: Dict[str, Any] = {}
            info = reader.metadata
            if info:
                metadata["title"] = getattr(info, "title", "") or ""
                metadata["author"] = getattr(info, "author", "") or ""
                metadata["subject"] = getattr(info, "subject", "") or ""
                metadata["creator"] = getattr(info, "creator", "") or ""
                metadata["producer"] = getattr(info, "producer", "") or ""
            metadata["total_pages"] = page_count
            metadata["file_size_bytes"] = local_path.stat().st_size

            # 4. 规范化页码范围
            page_range: Optional[Tuple[int, int]] = None
            if input_data.page_range:
                start_page = max(0, input_data.page_range[0])
                end_page = min(page_count, input_data.page_range[1])
                page_range = (start_page, end_page)

            characteristics = DocumentCharacteristics(page_count=page_count)

            output = PreprocessingOutput(
                local_path=local_path,
                page_count=page_count,
                characteristics=characteristics,
                metadata=metadata,
                page_range=page_range,
            )

            return StageResult(
                success=True,
                output=output,
                engine_used=self.tool_name,
            )

        except ImportError as e:
            return StageResult(success=False, error=f"pypdf 未安装: {e}")
        except Exception as e:
            logger.exception("pypdf 预处理阶段异常")
            return StageResult(success=False, error=f"预处理失败: {e}")


# ---------------------------------------------------------------------------
# Stage 本地工具映射
# ---------------------------------------------------------------------------

_TOOLS: Dict[str, type] = {
    "pymupdf": FitzPreprocessor,
    "pypdf": PyPDFPreprocessor,
}


# ---------------------------------------------------------------------------
# Stage 类
# ---------------------------------------------------------------------------


class PreprocessingStage(Stage[PreprocessingInput, PreprocessingOutput]):
    """S0: 预处理与源解析 Stage。"""

    STAGE_ID = "preprocessing"
    STAGE_NAME = "预处理与源解析"
    TOOLS = _TOOLS

    @property
    def stage_id(self) -> str:
        return self.STAGE_ID

    @property
    def stage_name(self) -> str:
        return self.STAGE_NAME

    async def execute(
        self, input_data: PreprocessingInput
    ) -> StageResult[PreprocessingOutput]:
        """委托给首个可用的预处理工具执行。"""
        for tool_cls in _TOOLS.values():
            tool = tool_cls()
            if tool.is_available():
                return await tool.execute(input_data)
        return StageResult(
            success=False, error="无可用的预处理工具（pymupdf / pypdf 均未安装）"
        )
