"""S9: 资源打包 Stage。

整理提取的资源文件（图片、附件等），将它们打包为最终输出目录结构。

输出目录结构::

    output_dir/
    ├── document.md          # 最终 Markdown 文件
    ├── images/              # 图片资源目录
    │   ├── img_p0_0.png
    │   ├── img_p1_0.png
    │   └── ...
    └── metadata.json        # 元数据文件

委托关系：
- ``shutil`` — 文件复制
- ``pathlib.Path`` — 目录构建
"""

from __future__ import annotations

import json
import logging
import os
import shutil
from pathlib import Path
from typing import Any, Dict, List, Optional

from ...base import Stage, StageResult
from ...models import (
    AssemblyOutput,
    ImageExtractionOutput,
    PipelineResult,
    PreprocessingOutput,
)
from ...registry import register_tool
from .._base import PDFToolBase

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 资源打包输入（组合数据）
# ---------------------------------------------------------------------------


class _AssetBundlingInput:
    """资源打包 Stage 的输入。

    汇聚 AssemblyOutput、图片列表和预处理结果。
    """

    def __init__(
        self,
        assembly_output: AssemblyOutput,
        images: Optional[ImageExtractionOutput] = None,
        preprocessing: Optional[PreprocessingOutput] = None,
        output_dir: Optional[str] = None,
    ) -> None:
        self.assembly_output = assembly_output
        self.images = images
        self.preprocessing = preprocessing
        self.output_dir = output_dir


# ---------------------------------------------------------------------------
# 工具适配器
# ---------------------------------------------------------------------------


@register_tool("pdf.asset_bundling.builtin_bundler")
class BuiltinBundler(PDFToolBase):
    """内置资源打包工具。

    将 Markdown 文件和图片资源整理到统一的输出目录中。
    """

    tool_name = "builtin_bundler"

    def is_available(self) -> bool:
        return True

    async def _run(
        self, input_data: _AssetBundlingInput
    ) -> StageResult[PipelineResult]:
        """执行资源打包。"""
        try:
            # 1. 确定输出目录
            if input_data.output_dir:
                output_path = Path(input_data.output_dir)
            else:
                output_path = Path(
                    os.path.join(
                        os.getcwd(),
                        "output",
                        input_data.preprocessing.local_path.stem
                        if input_data.preprocessing
                        else "document",
                    )
                )

            output_path.mkdir(parents=True, exist_ok=True)

            # 2. 创建图片子目录
            images_dir = output_path / "images"
            images_dir.mkdir(exist_ok=True)

            # 3. 复制图片文件
            copied_images: List[str] = []
            if input_data.images:
                for img in input_data.images.images:
                    if img.local_path and Path(img.local_path).exists():
                        dest = images_dir / img.filename
                        shutil.copy2(img.local_path, str(dest))
                        copied_images.append(img.filename)
                    elif img.base64_data:
                        # base64 数据写入文件
                        import base64

                        dest = images_dir / img.filename
                        raw = base64.b64decode(img.base64_data)
                        dest.write_bytes(raw)
                        copied_images.append(img.filename)

            # 4. 写入 Markdown 文件
            md_path = output_path / "document.md"
            md_path.write_text(input_data.assembly_output.markdown, encoding="utf-8")

            # 5. 生成元数据文件
            meta: Dict[str, Any] = {
                "word_count": input_data.assembly_output.word_count,
                "images": copied_images,
                "engines_used": (
                    input_data.assembly_output.metadata.get("engine", "unknown")
                ),
            }
            if input_data.preprocessing:
                meta["page_count"] = input_data.preprocessing.page_count
                meta["source"] = str(input_data.preprocessing.local_path)

            meta_path = output_path / "metadata.json"
            meta_path.write_text(
                json.dumps(meta, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

            # 6. 构建 PipelineResult
            result = PipelineResult(
                success=True,
                markdown=input_data.assembly_output.markdown,
                word_count=input_data.assembly_output.word_count,
                images_count=len(copied_images),
                metadata={
                    "engine": "builtin_bundler",
                    "output_dir": str(output_path),
                    "copied_images": copied_images,
                },
            )

            if input_data.preprocessing:
                result.page_count = input_data.preprocessing.page_count
                result.characteristics = input_data.preprocessing.characteristics

            return StageResult(
                success=True,
                output=result,
                engine_used=self.tool_name,
            )

        except Exception as e:
            logger.exception("资源打包失败")
            return StageResult(success=False, error=f"资源打包失败: {e}")


# ---------------------------------------------------------------------------
# Stage 本地工具映射
# ---------------------------------------------------------------------------

_TOOLS: Dict[str, type] = {
    "builtin_bundler": BuiltinBundler,
}


# ---------------------------------------------------------------------------
# Stage 类
# ---------------------------------------------------------------------------


class AssetBundlingStage(Stage[_AssetBundlingInput, PipelineResult]):
    """S9: 资源打包 Stage。"""

    STAGE_ID = "asset_bundling"
    STAGE_NAME = "资源打包"
    TOOLS = _TOOLS

    @property
    def stage_id(self) -> str:
        return self.STAGE_ID

    @property
    def stage_name(self) -> str:
        return self.STAGE_NAME

    async def execute(
        self, input_data: _AssetBundlingInput
    ) -> StageResult[PipelineResult]:
        """执行资源打包。"""
        for tool_cls in _TOOLS.values():
            tool = tool_cls()
            if tool.is_available():
                return await tool.execute(input_data)
        return StageResult(success=False, error="无可用的资源打包工具")
