"""OpenDataLoader PDF 引擎适配器。

Apache-2.0 / CPU-only / 全元素 bounding box / XY-Cut++ 阅读顺序。
Java 内核（84.8%）通过 Python wrapper ``opendataloader_pdf.convert()`` 调用，
输出含 bbox 的结构化 JSON 与 Markdown。

架构策略：
    - 利用 ``EngineWorkerPool`` 将 JVM 常驻于 worker 子进程，
      化解每次 convert() 启动 JVM 的固有开销。
    - 一次 convert() 同时请求 ``format="markdown,json"``，
      从 JSON kids 中提取 tables/images/headings/captions（含 bbox）。
    - 输出落盘到隔离的临时目录，避免 worker 间文件污染。

Limitations (local mode, MVP):
    - 不支持 page_range（opendataloader 转换整篇 PDF）
    - 不提取 LaTeX 公式（需 hybrid mode + ``--enrich-formula``）
    - 不区分代码块（local mode 无 code 块类型）
    - 表格在学术论文场景可能被识别为 paragraph（需 hybrid 增强复杂表格）

References:
    [1] OpenDataLoader PDF, "GitHub Repository,"
        https://github.com/opendataloader-project/opendataloader-pdf, 2026.
    [2] OpenDataLoader PDF, "Benchmark Results,"
        https://opendataloader.org/docs/benchmark, 2026.
"""

from __future__ import annotations

import glob
import json
import logging
import os
import subprocess  # nosec B404
import tempfile
from typing import List, Optional, Tuple

from ._base import (
    EngineCapabilities,
    EngineCodeBlock,
    EngineConversionResult,
    EngineFormula,
    EngineImage,
    EngineTable,
)
from ._opendataloader_schema import ODLDocument, ODLElement

logger = logging.getLogger(__name__)


def _check_java_available(timeout: int = 3) -> bool:
    """检查 Java 11+ 运行时是否可用。"""
    try:
        result = subprocess.run(  # nosec B603 B607
            ["java", "-version"],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return False


class OpenDataLoaderEngine:
    """OpenDataLoader PDF 引擎（Apache-2.0 / CPU-only / JVM 常驻）。

    实现与 ``PDFEngine`` 协议兼容的接口（duck typing），供
    ``PDFProcessor`` 和 ``EngineWorkerPool`` 统一调度。
    """

    def __init__(
        self,
        *,
        use_struct_tree: bool = True,
        sanitize: bool = False,
    ) -> None:
        self._use_struct_tree = use_struct_tree
        self._sanitize = sanitize

    @staticmethod
    def is_available() -> bool:
        """检测 opendataloader-pdf 包和 Java 11+ 是否可用。"""
        try:
            import opendataloader_pdf  # noqa: F401

            return _check_java_available()
        except ImportError:
            return False

    @property
    def capabilities(self) -> EngineCapabilities:
        return EngineCapabilities(
            supports_page_range=False,
            supports_embed_images=True,
            supports_code_blocks=False,
            supports_table_structure=True,
            supports_formula_extraction=False,
            supports_gpu_acceleration=False,
        )

    def convert(
        self,
        pdf_path: str,
        *,
        page_range: Optional[Tuple[int, int]] = None,
        embed_images: bool = False,
    ) -> Optional[EngineConversionResult]:
        """执行 PDF 转换，返回统一结果。

        一次调用同时生成 Markdown + JSON；JSON 用于提取结构化元素（含 bbox），
        Markdown 用于最终文本输出。
        """
        import opendataloader_pdf

        if not os.path.isfile(pdf_path):
            logger.error("PDF 文件不存在: %s", pdf_path)
            return None

        # 使用 mkdtemp 而非 TemporaryDirectory，保持目录存活至 worker 进程回收，
        # 避免 output_dir / images[].local_path 成为悬空引用。
        out_dir = tempfile.mkdtemp(prefix="odl_")
        try:
            opendataloader_pdf.convert(
                input_path=[pdf_path],
                output_dir=out_dir,
                format="markdown,json",
                image_output="embedded" if embed_images else "external",
                image_format="png",
                use_struct_tree=self._use_struct_tree,
                sanitize=self._sanitize,
            )
        except Exception as e:
            logger.warning("OpenDataLoader convert 失败: %s", e)
            return None

        return self._parse_outputs(out_dir, pdf_path)

    # ------------------------------------------------------------------
    # 输出解析
    # ------------------------------------------------------------------

    def _parse_outputs(
        self, out_dir: str, pdf_path: str
    ) -> Optional[EngineConversionResult]:
        """从 out_dir 中读取 JSON + Markdown 并组装统一结果。"""
        # 读取 Markdown
        markdown = ""
        md_files = glob.glob(os.path.join(out_dir, "**", "*.md"), recursive=True)
        if md_files:
            with open(md_files[0], "r", encoding="utf-8") as f:
                markdown = f.read()

        # 读取 JSON
        json_files = glob.glob(os.path.join(out_dir, "**", "*.json"), recursive=True)
        if not json_files:
            logger.warning("OpenDataLoader 未生成 JSON 文件")
            return EngineConversionResult(
                markdown=markdown,
                page_count=0,
                engine_name="opendataloader",
                output_dir=out_dir,
            )

        with open(json_files[0], "r", encoding="utf-8") as f:
            raw_data = json.load(f)

        try:
            doc = ODLDocument.model_validate(raw_data)
        except Exception as e:
            logger.warning("OpenDataLoader JSON 解析失败: %s", e)
            return EngineConversionResult(
                markdown=markdown,
                page_count=0,
                engine_name="opendataloader",
            )

        # 从 kids 中提取结构化元素
        tables: List[EngineTable] = []
        images: List[EngineImage] = []
        formulas: List[EngineFormula] = []
        code_blocks: List[EngineCodeBlock] = []

        for kid in doc.kids:
            elem_type = kid.type

            if elem_type == "table":
                tables.append(self._parse_table(kid))

            elif elem_type == "image":
                images.append(self._parse_image(kid, out_dir))

            elif elem_type == "formula":
                formulas.append(self._parse_formula(kid))

            elif elem_type == "heading":
                # heading 作为文本由 markdown 覆盖，此处仅用于 layout 信息
                pass

        return EngineConversionResult(
            markdown=markdown,
            tables=tables,
            images=images,
            formulas=formulas,
            code_blocks=code_blocks,
            metadata={
                "author": doc.author,
                "title": doc.title,
                "engine": "opendataloader",
            },
            page_count=doc.number_of_pages,
            engine_name="opendataloader",
            output_dir=out_dir,
        )

    @staticmethod
    def _parse_bbox(kid: ODLElement) -> Tuple[float, float, float, float]:
        """将 JSON 中的 bounding box 转为统一 tuple。

        OpenDataLoader 格式：``[left, bottom, right, top]``（PDF points）。
        """
        if kid.bounding_box and len(kid.bounding_box) == 4:
            return (
                float(kid.bounding_box[0]),
                float(kid.bounding_box[1]),
                float(kid.bounding_box[2]),
                float(kid.bounding_box[3]),
            )
        return (0.0, 0.0, 0.0, 0.0)

    def _parse_table(self, kid: ODLElement) -> EngineTable:
        """将 JSON table 元素映射为 EngineTable。"""
        bbox = self._parse_bbox(kid)
        # content 中可能含表格文本或 markdown 表示
        table_text = kid.content or ""
        # 粗估行列数
        rows = table_text.count("\n") + 1 if table_text else 0
        cols = 0
        if "|" in table_text:
            cols = (
                max(
                    len(line.split("|")) - 2
                    for line in table_text.split("\n")
                    if "|" in line
                )
                or 0
            )

        return EngineTable(
            markdown=table_text,
            rows=rows,
            columns=cols,
            page_number=kid.page_number,
            bbox=bbox,
        )

    def _parse_image(self, kid: ODLElement, out_dir: str) -> EngineImage:
        """将 JSON image 元素映射为 EngineImage。"""
        bbox = self._parse_bbox(kid)
        # source 是相对于 out_dir 的图片文件路径
        filename = None
        local_path = None
        if kid.source:
            filename = os.path.basename(kid.source)
            local_path = os.path.join(out_dir, kid.source)

        return EngineImage(
            page_number=kid.page_number,
            bbox=bbox,
            filename=filename,
            local_path=local_path,
        )

    def _parse_formula(self, kid: ODLElement) -> EngineFormula:
        """将 JSON formula 元素映射为 EngineFormula。"""
        latex = kid.content or kid.formula_content or ""
        return EngineFormula(
            latex=latex,
            formula_type="block",
            page_number=kid.page_number,
            original_text=kid.content or "",
        )
