"""MinerU 文档转换引擎封装。

当 ``mineru`` 可选依赖已安装时，提供基于 MinerU 的全功能 PDF→Markdown
转换路径，包括布局分析、表格结构识别、公式提取与图片处理。

降级策略：当 ``mineru`` 未安装时，``is_available()`` 返回 ``False``，
``convert()`` 安全返回 ``None``，由上层 ``PDFProcessor`` 自动切换至
其他可用路径。

MinerU 输出结构（v2.x+）：
    输出目录/
    ├── content_list.json          # 结构化内容列表（含 text/table/image/equation 类型）
    └── auto/                      # 自动生成的 Markdown 文件
        └── <filename>.md

设计模式参考: 与 ``docling_engine.py`` 保持对称结构，便于上层统一调度。
"""

import json
import logging
import platform
import re
import subprocess  # nosec B404
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 数据类：标准化 MinerU 输出
# ---------------------------------------------------------------------------


@dataclass
class MinerUTable:
    """MinerU 提取的表格。"""

    markdown: str
    rows: int = 0
    columns: int = 0
    page_number: Optional[int] = None
    caption: Optional[str] = None
    bbox: Optional[Tuple[float, float, float, float]] = None
    html: Optional[str] = None  # MinerU 可输出 HTML 格式表格


@dataclass
class MinerUImage:
    """MinerU 提取的图片。"""

    page_number: Optional[int] = None
    caption: Optional[str] = None
    bbox: Optional[Tuple[float, float, float, float]] = None
    filename: Optional[str] = None  # 磁盘文件名
    local_path: Optional[str] = None  # 磁盘绝对路径
    width: Optional[int] = None  # 图片宽度（像素）
    height: Optional[int] = None  # 图片高度（像素）
    mime_type: str = "image/png"
    base64_data: Optional[str] = None  # base64 编码


@dataclass
class MinerUFormula:
    """MinerU 提取的数学公式。"""

    latex: str
    formula_type: str = "block"  # "inline" or "block"
    page_number: Optional[int] = None
    original_text: str = ""


@dataclass
class MinerUConversionResult:
    """MinerU 转换结果的标准化数据结构。

    字段与 ``DoclingConversionResult`` 保持对齐，便于上层统一处理。
    """

    markdown: str
    tables: List[MinerUTable] = field(default_factory=list)
    images: List[MinerUImage] = field(default_factory=list)
    formulas: List[MinerUFormula] = field(default_factory=list)
    code_blocks: List[Any] = field(
        default_factory=list
    )  # MinerU 不支持代码块，始终为空
    metadata: Dict[str, Any] = field(default_factory=dict)
    page_count: int = 0


# ---------------------------------------------------------------------------
# MinerU 引擎
# ---------------------------------------------------------------------------


class MinerUEngine:
    """MinerU 文档转换引擎。

    封装 MinerU 的完整能力：

    * 全文档 Markdown 转换（含布局分析与阅读顺序保持）
    * 结构化表格提取
    * 数学公式 LaTeX 提取
    * 图片提取与分类

    转换策略：
        1. 优先使用 Python API（``from mineru.cli import pdf_parse``）
        2. Python API 不可用时降级为 CLI 子进程调用（``mineru`` 命令行工具）

    Converter 实例在首次调用时延迟初始化并**类级缓存**，
    避免重复加载 AI 模型。
    """

    # 类级缓存：不同配置签名 → converter 实例
    _converters: Dict[str, Any] = {}

    def __init__(
        self,
        output_dir: Optional[str] = None,
        device: Optional[str] = None,
        backend: Optional[str] = None,
    ) -> None:
        """初始化 MinerU 引擎。

        Args:
            output_dir: 输出目录路径，为 None 时自动创建临时目录。
            device: 设备偏好（'auto', 'cpu', 'cuda', 'mps'），为 None 时自动检测。
            backend: MinerU 后端引擎（合法值 'pipeline' / 'vlm-http-client' /
                     'hybrid-http-client' / 'vlm-auto-engine' / 'hybrid-auto-engine'），
                     为 None 时根据设备自动选择。
        """
        self._output_dir = Path(output_dir) if output_dir else None
        self._device = device
        self._backend = backend
        self._resolved_backend: Optional[str] = None

    # ------------------------------------------------------------------
    # 可用性检测
    # ------------------------------------------------------------------

    @staticmethod
    def is_available() -> bool:
        """检测 ``mineru`` 是否已安装且可用。"""
        try:
            import mineru  # noqa: F401

            return True
        except ImportError:
            return False

    # ------------------------------------------------------------------
    # 设备感知后端解析
    # ------------------------------------------------------------------

    def _resolve_device(self) -> str:
        """解析设备类型，返回 MinerU 后端标识。

        策略（Apple Silicon 优先走 MLX 路径，避免静默回退 transformers）：
            1. 若用户显式指定 ``backend`` 且非 ``auto``，直接使用（最高优先级）。
            2. Apple Silicon + mlx_vlm 可用 + macOS 13.5+：选择
               ``vlm-auto-engine``（MinerU ``_select_mac_engine`` 内部命中
               ``mlx-engine``，比 ``vlm-transformers`` 加速 100-200%[1]）。
            3. Apple Silicon 但 mlx 资格不满足：**显式降级 pipeline**，
               避免 ``vlm-auto-engine`` 回退 transformers 的慢路径。
            4. 用户指定 ``device``：mps→vlm-auto-engine，其他→pipeline。
            5. 默认非 mac：pipeline。

        Settings ``pdf.mineru_mps_backend`` 提供配置覆盖（"auto" / "vlm-auto-engine" /
        "pipeline"），默认 "auto"。

        References:
            [1] MinerU 3.x changelog & vlm-mlx-engine benchmark：
                https://opendatalab.github.io/MinerU/reference/changelog/

        Returns:
            MinerU 后端标识字符串。
        """
        if self._resolved_backend is not None:
            return self._resolved_backend

        # 用户显式指定后端（最高优先级，'auto' 触发自动检测）
        if self._backend and self._backend.lower() != "auto":
            self._resolved_backend = self._backend
            logger.info("MinerU 后端: %s（用户指定）", self._resolved_backend)
            return self._resolved_backend

        # 配置覆盖：mineru_mps_backend 直接指定（'auto' = 走探测逻辑）
        mps_backend_pref = self._read_mps_backend_pref()

        # 用户指定设备类型，映射到后端
        if self._device and self._device.lower() != "auto":
            device_lower = self._device.lower()
            if device_lower == "mps":
                self._resolved_backend = self._select_apple_silicon_backend(
                    mps_backend_pref
                )
            elif device_lower == "cuda":
                # CUDA 暂无专用后端，使用 pipeline（GPU 自动利用）
                self._resolved_backend = "pipeline"
            else:
                self._resolved_backend = "pipeline"
            logger.info(
                "MinerU 后端: %s（基于设备偏好 %s）",
                self._resolved_backend,
                device_lower,
            )
            return self._resolved_backend

        # 自动检测：Apple Silicon → 探测 MLX 资格择优
        if self._is_apple_silicon():
            self._resolved_backend = self._select_apple_silicon_backend(
                mps_backend_pref
            )
        else:
            self._resolved_backend = "pipeline"
            logger.info("MinerU 后端: pipeline（CPU 降级）")

        return self._resolved_backend

    @staticmethod
    def _read_mps_backend_pref() -> str:
        """从 settings 读取 ``mineru_mps_backend`` 偏好，默认 ``auto``。"""
        try:
            from ...config import settings

            return str(getattr(settings, "mineru_mps_backend", "auto")).lower()
        except (ImportError, AttributeError):
            return "auto"

    def _select_apple_silicon_backend(self, pref: str) -> str:
        """Apple Silicon 后端择优。

        - pref="vlm-auto-engine" / "pipeline": 直接采用，配置覆盖探测；
        - pref="auto": mlx 资格满足→vlm-auto-engine；不满足→pipeline。

        Args:
            pref: 来自 settings.mineru_mps_backend 的偏好（auto/vlm-auto-engine/pipeline）

        Returns:
            CLI 合法 backend 标识（pipeline / vlm-auto-engine 二选一）
        """
        if pref in ("vlm-auto-engine", "pipeline"):
            logger.info(
                "MinerU 后端: %s（配置 mineru_mps_backend=%s 强制）", pref, pref
            )
            return pref

        if self._probe_mlx_engine_eligibility():
            logger.info(
                "MinerU 后端: vlm-auto-engine（Apple Silicon + mlx_vlm 可用，"
                "MinerU 内部将启用 mlx-engine 路径）"
            )
            return "vlm-auto-engine"

        logger.info(
            "MinerU 后端: pipeline（Apple Silicon 但 mlx_vlm/macOS 版本不满足，"
            "避免 vlm-auto-engine 回退 transformers 慢路径）"
        )
        return "pipeline"

    @staticmethod
    def _probe_mlx_engine_eligibility() -> bool:
        """探测 MinerU ``mlx-engine`` 路径的资格条件。

        MinerU ``utils/engine_utils.py:_select_mac_engine`` 走 ``mlx`` 需同时满足：
            1. ``mlx_vlm`` 已安装；
            2. ``is_mac_os_version_supported()``（macOS 13.5+）。

        优先复用 MinerU 自身的版本判定，避免重复实现导致漂移。

        Returns:
            ``True`` 表示 mlx-engine 路径可行；否则 ``False``。
        """
        from importlib.util import find_spec

        if find_spec("mlx_vlm") is None:
            return False
        try:
            from mineru.utils.check_sys_env import (  # type: ignore[import-untyped]
                is_mac_os_version_supported,
            )

            return bool(is_mac_os_version_supported())
        except ImportError:
            # MinerU 版本不暴露该工具时，保守视为合格（mlx_vlm 已装）
            return True

    @staticmethod
    def _is_apple_silicon() -> bool:
        """检测当前平台是否为 Apple Silicon (M 系列芯片)。

        Returns:
            ``True`` 如果运行在 Apple Silicon 上。
        """
        return platform.system() == "Darwin" and platform.machine() == "arm64"

    # ------------------------------------------------------------------
    # 配置签名（用于 converter 缓存键）
    # ------------------------------------------------------------------

    def _config_key(self) -> str:
        """生成 converter 缓存键。"""
        backend = self._resolve_device()
        device = self._device or "auto"
        return f"backend={backend}|device={device}"

    # ------------------------------------------------------------------
    # 核心转换
    # ------------------------------------------------------------------

    def convert(
        self,
        pdf_path: str,
        page_range: Optional[Tuple[int, int]] = None,
        embed_images: bool = False,
    ) -> Optional[MinerUConversionResult]:
        """执行完整文档转换。

        转换策略：
            1. 优先尝试 Python API（``mineru.cli.pdf_parse``）
            2. Python API 失败时降级为 CLI 子进程调用

        Args:
            pdf_path: PDF 文件本地路径。
            page_range: 可选的页码范围 ``(start, end)``，0-based start / exclusive end。
            embed_images: 是否将图片以 base64 嵌入 Markdown（默认 False，
                使用文件引用模式）。

        Returns:
            ``MinerUConversionResult`` 或 ``None``（当 MinerU 不可用或转换失败时）。
        """
        if not self.is_available():
            logger.debug("MinerU 不可用，跳过转换")
            return None

        # 确保输出目录存在
        output_dir = self._ensure_output_dir()

        # 优先尝试 Python API
        result = self._convert_via_python_api(pdf_path, output_dir, page_range)
        if result is not None:
            return result

        # 降级为 CLI 子进程调用
        logger.info("MinerU Python API 不可用或失败，降级为 CLI 子进程调用")
        result = self._convert_via_cli(pdf_path, output_dir, page_range)
        return result

    def _ensure_output_dir(self) -> Path:
        """确保输出目录存在并返回路径。

        若未指定输出目录，自动创建临时目录。
        """
        if self._output_dir is None:
            self._output_dir = Path(tempfile.mkdtemp(prefix="mineru_output_"))
        self._output_dir.mkdir(parents=True, exist_ok=True)
        return self._output_dir

    def _convert_via_python_api(
        self,
        pdf_path: str,
        output_dir: Path,
        page_range: Optional[Tuple[int, int]] = None,
    ) -> Optional[MinerUConversionResult]:
        """通过 Python API 执行转换。

        尝试使用 ``from mineru.cli import pdf_parse`` 进行转换。
        """
        try:
            from mineru.cli import pdf_parse  # type: ignore[import-untyped]

            backend = self._resolve_device()

            # 构建 API 调用参数
            api_kwargs: Dict[str, Any] = {
                "pdf_path": pdf_path,
                "output_dir": str(output_dir),
                "backend": backend,
            }

            # 页码范围处理
            if page_range is not None:
                api_kwargs["start_page_id"] = page_range[0]
                api_kwargs["end_page_id"] = page_range[1]

            logger.info(
                "MinerU Python API 调用: path=%s, backend=%s, output=%s",
                pdf_path,
                backend,
                output_dir,
            )

            pdf_parse(**api_kwargs)

            # 解析输出
            return self._normalize_output(output_dir, pdf_path)

        except ImportError as e:
            logger.debug("MinerU Python API 不可用（v3.x 已移除 pdf_parse）: %s", e)
            return None
        except Exception as e:
            logger.warning("MinerU Python API 转换失败: %s", e)
            return None

    def _convert_via_cli(
        self,
        pdf_path: str,
        output_dir: Path,
        page_range: Optional[Tuple[int, int]] = None,
    ) -> Optional[MinerUConversionResult]:
        """通过 CLI 子进程执行转换（降级方案）。

        调用命令格式：
            ``mineru -p <input> -o <output_dir> -b <backend>``

        可选页码范围（MinerU v3.x）：
            ``mineru -p <input> -o <output_dir> -b <backend> --start N --end N``

        容错策略：
            1. 首次失败后尝试从输出目录恢复部分结果
            2. VLM 后端崩溃时自动降级到 pipeline（CPU）重试
            3. 退出后清理残留 mineru-api 进程
        """
        backend = self._resolve_device()

        cmd = self._build_cli_cmd(pdf_path, output_dir, backend, page_range)
        logger.info("MinerU CLI 调用: %s", " ".join(cmd))

        # 注入环境变量：减少 MLX/tokenizer 多线程冲突
        env = None
        if self._is_apple_silicon():
            import os

            env = os.environ.copy()
            env["TOKENIZERS_PARALLELISM"] = "false"

        try:
            result = subprocess.run(  # nosec B603 B607
                cmd,
                capture_output=True,
                text=True,
                timeout=600,
                env=env,
            )

            if result.returncode != 0:
                return self._handle_cli_failure(
                    result,
                    pdf_path,
                    output_dir,
                    backend,
                    page_range,
                )

            if result.stdout:
                logger.debug("MinerU CLI 输出: %s", result.stdout[:200])

            return self._normalize_output(output_dir, pdf_path)

        except FileNotFoundError:
            logger.warning("MinerU CLI 命令未找到，请确认 mineru 已安装且在 PATH 中")
            return None
        except subprocess.TimeoutExpired:
            logger.warning("MinerU CLI 执行超时（600 秒）")
            self._cleanup_residual_processes()
            return None
        except Exception as e:
            logger.warning("MinerU CLI 执行异常: %s", e)
            return None

    def _build_cli_cmd(
        self,
        pdf_path: str,
        output_dir: Path,
        backend: str,
        page_range: Optional[Tuple[int, int]],
    ) -> list[str]:
        """构建 MinerU CLI 命令行。"""
        cmd = ["mineru", "-p", pdf_path, "-o", str(output_dir), "-b", backend]
        if page_range is not None:
            cmd.extend(["--start", str(page_range[0])])
            cmd.extend(["--end", str(page_range[1])])
        return cmd

    def _handle_cli_failure(
        self,
        result: subprocess.CompletedProcess,
        pdf_path: str,
        output_dir: Path,
        backend: str,
        page_range: Optional[Tuple[int, int]],
    ) -> Optional[MinerUConversionResult]:
        """处理 MinerU CLI 执行失败：尝试部分恢复 + backend 降级重试。"""
        stderr_tail = result.stderr[-4000:] if result.stderr else "无错误输出"
        stdout_tail = result.stdout[-2000:] if result.stdout else ""

        # MLX GPU Stream 错误是 Apple Silicon subprocess 隔离下的已知限制，
        # 降级为 INFO 级别避免惊悚日志，后续会自动 fallback 到 pipeline backend。
        is_mlx_stream_error = "Stream(gpu" in stderr_tail or "no Stream" in stderr_tail
        if is_mlx_stream_error:
            logger.info(
                "MinerU VLM backend 遇到 MLX GPU Stream 限制 "
                "(exit_code=%d, backend=%s)，将自动降级为 pipeline 重试",
                result.returncode,
                backend,
            )
        else:
            logger.warning(
                "MinerU CLI 执行失败 (exit_code=%d, backend=%s)\n"
                "  stderr: %s\n"
                "  stdout tail: %s",
                result.returncode,
                backend,
                stderr_tail,
                stdout_tail,
            )

        # 清理残留进程（VLM 崩溃后可能留下 orphan mineru-api）
        self._cleanup_residual_processes()

        # 尝试从输出目录恢复部分结果
        partial = self._normalize_output(output_dir, pdf_path)
        if partial is not None:
            logger.info(
                "MinerU CLI 崩溃后恢复部分结果: %d 表格, %d 公式, %d 图片",
                len(partial.tables),
                len(partial.formulas),
                len(partial.images),
            )
            return partial

        # VLM 后端降级：vlm-auto-engine → pipeline（CPU 模式，慢但稳定）
        if "vlm" in backend or "auto-engine" in backend:
            fallback_backend = "pipeline"
            log_level = logging.INFO if is_mlx_stream_error else logging.WARNING
            logger.log(
                log_level,
                "MinerU VLM backend '%s' 失败，降级为 '%s' 重试",
                backend,
                fallback_backend,
            )
            retry_cmd = self._build_cli_cmd(
                pdf_path,
                output_dir,
                fallback_backend,
                page_range,
            )
            try:
                retry_result = subprocess.run(  # nosec B603 B607
                    retry_cmd,
                    capture_output=True,
                    text=True,
                    timeout=300,
                )
                if retry_result.returncode == 0:
                    return self._normalize_output(output_dir, pdf_path)

                retry_stderr = (
                    retry_result.stderr[-4000:] if retry_result.stderr else ""
                )
                logger.warning(
                    "MinerU pipeline backend 重试也失败 (exit_code=%d): %s",
                    retry_result.returncode,
                    retry_stderr,
                )
            except subprocess.TimeoutExpired:
                logger.warning("MinerU pipeline backend 重试超时（300 秒）")
            except Exception as e:
                logger.warning("MinerU pipeline backend 重试异常: %s", e)

        return None

    @staticmethod
    def _cleanup_residual_processes() -> None:
        """清理 MinerU CLI 崩溃后残留的 mineru-api 子进程。"""
        try:
            subprocess.run(  # nosec B603 B607
                ["pkill", "-f", "mineru-api"],
                capture_output=True,
                timeout=5,
            )
        except Exception:  # nosec B110
            pass

    # ------------------------------------------------------------------
    # 输出归一化
    # ------------------------------------------------------------------

    def _normalize_output(
        self,
        output_dir: Path,
        pdf_path: str,
    ) -> Optional[MinerUConversionResult]:
        """将 MinerU 输出归一化为 ``MinerUConversionResult``。

        MinerU 输出目录结构（v2.x+）：
            output_dir/
            ├── content_list.json   # 结构化内容列表
            └── auto/               # Markdown 输出
                └── <name>.md

        解析流程：
            1. 读取 ``content_list.json`` 获取结构化数据
            2. 读取 ``auto/`` 目录下的 Markdown 文件获取完整文本
            3. 从 content_list 中提取表格、公式、图片等结构化元素

        Args:
            output_dir: MinerU 输出目录。
            pdf_path: 原始 PDF 文件路径（用于元数据提取）。

        Returns:
            归一化后的转换结果，失败返回 ``None``。
        """
        # 查找 content_list.json
        content_list_path = self._find_content_list(output_dir)
        if content_list_path is None:
            logger.warning("未找到 MinerU 输出的 content_list.json: %s", output_dir)
            return None

        # 读取 content_list.json
        try:
            with open(content_list_path, "r", encoding="utf-8") as f:
                content_list = json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            logger.warning("读取 MinerU content_list.json 失败: %s", e)
            return None

        if not isinstance(content_list, list):
            logger.warning("MinerU content_list.json 格式异常（非数组）")
            return None

        # 读取 Markdown 输出
        markdown = self._read_markdown_output(output_dir)

        # 若 Markdown 文件不存在，从 content_list 拼接
        if not markdown:
            markdown = self._assemble_markdown_from_content_list(content_list)

        # 提取结构化元素
        tables = self._extract_tables(content_list)
        formulas = self._extract_formulas(content_list, markdown)
        images = self._extract_images(content_list, output_dir)
        code_blocks = self._extract_code_blocks(content_list)

        # 提取元数据
        metadata = self._extract_metadata(content_list, pdf_path)

        # 统计页数
        page_count = self._extract_page_count(content_list)

        return MinerUConversionResult(
            markdown=markdown,
            tables=tables,
            images=images,
            formulas=formulas,
            code_blocks=code_blocks,
            metadata=metadata,
            page_count=page_count,
        )

    def _find_content_list(self, output_dir: Path) -> Optional[Path]:
        """在输出目录中查找 content_list.json 文件。

        MinerU 的输出目录可能存在多级子目录结构，此方法递归搜索
        content_list.json。兼容 v2.x（精确文件名）和 v3.x（PDF 文件名前缀）。

        Args:
            output_dir: MinerU 输出根目录。

        Returns:
            content_list.json 文件路径，未找到返回 ``None``。
        """
        # 策略 1: v2.x 风格 — 精确文件名 content_list.json
        direct = output_dir / "content_list.json"
        if direct.exists():
            return direct

        # 策略 2: 递归搜索精确文件名（v2.x 子目录结构）
        for child in output_dir.rglob("content_list.json"):
            return child

        # 策略 3: v3.x 风格 — 文件名前缀模式 *_content_list.json
        for child in output_dir.rglob("*_content_list.json"):
            return child

        return None

    def _read_markdown_output(self, output_dir: Path) -> str:
        """读取 MinerU 生成的 Markdown 文件。

        在 ``auto/`` 子目录下查找 ``.md`` 文件并读取内容。

        Args:
            output_dir: MinerU 输出根目录。

        Returns:
            Markdown 文本，未找到返回空字符串。
        """
        # auto/ 目录下的 markdown 文件
        auto_dir = output_dir / "auto"
        if auto_dir.exists():
            for md_file in auto_dir.glob("*.md"):
                try:
                    return md_file.read_text(encoding="utf-8")
                except OSError as e:
                    logger.warning("读取 MinerU Markdown 文件失败: %s", e)

        # 递归搜索所有 .md 文件
        for md_file in output_dir.rglob("*.md"):
            try:
                return md_file.read_text(encoding="utf-8")
            except OSError as e:
                logger.warning("读取 MinerU Markdown 文件失败: %s", e)

        return ""

    def _assemble_markdown_from_content_list(
        self, content_list: List[Dict[str, Any]]
    ) -> str:
        """从 content_list 结构化数据拼接 Markdown 文本。

        当 Markdown 文件不可用时，作为降级方案使用。

        Args:
            content_list: MinerU content_list.json 内容。

        Returns:
            拼接后的 Markdown 文本。
        """
        parts: List[str] = []
        for item in content_list:
            item_type = item.get("type", "")
            if item_type == "text":
                text = item.get("text", "")
                if text:
                    parts.append(text)
            elif item_type == "table":
                # 表格使用 Markdown 格式
                table_md = item.get("markdown", "")
                if table_md:
                    parts.append(table_md)
                else:
                    html = item.get("html", "")
                    if html:
                        parts.append(html)
            elif item_type == "equation":
                latex = item.get("latex", "")
                if latex:
                    parts.append(f"$$\n{latex}\n$$")
            elif item_type == "image":
                # 图片使用占位符
                img_path = item.get("img_path", "")
                caption = item.get("text", "")
                if img_path:
                    alt = caption if caption else "image"
                    parts.append(f"![{alt}]({img_path})")

        return "\n\n".join(parts)

    # ------------------------------------------------------------------
    # 结构化元素提取
    # ------------------------------------------------------------------

    def _extract_tables(self, content_list: List[Dict[str, Any]]) -> List[MinerUTable]:
        """从 content_list 提取结构化表格。

        MinerU content_list 中 type="table" 的条目包含表格数据，
        通常以 Markdown 或 HTML 格式存储。

        Args:
            content_list: MinerU content_list.json 内容。

        Returns:
            提取的表格列表。
        """
        tables: List[MinerUTable] = []

        for item in content_list:
            if item.get("type") != "table":
                continue
            try:
                # 优先使用 Markdown 格式
                md = item.get("markdown", "")
                html = item.get("html", "")

                table_content = md or html
                if not table_content:
                    continue

                # 解析表格维度
                rows, cols = self._parse_table_dimensions(
                    table_content, is_html=bool(html)
                )

                # 页码
                page_no = item.get("page_no", None)

                # 标题
                caption = item.get("text", "")

                # 边界框
                bbox = self._extract_bbox_from_item(item)

                tables.append(
                    MinerUTable(
                        markdown=md,
                        rows=rows,
                        columns=cols,
                        page_number=page_no,
                        caption=caption or None,
                        bbox=bbox,
                        html=html or None,
                    )
                )
            except Exception as e:
                logger.warning("提取 MinerU 表格失败: %s", e)

        return tables

    def _parse_table_dimensions(
        self,
        content: str,
        is_html: bool = False,
    ) -> Tuple[int, int]:
        """解析表格的行数和列数。

        Args:
            content: Markdown 或 HTML 格式的表格内容。
            is_html: 是否为 HTML 格式。

        Returns:
            (行数, 列数) 元组。
        """
        rows = 0
        cols = 0

        if is_html:
            # HTML 表格：统计 <tr> 和 <td>/<th> 标签
            rows = len(re.findall(r"<tr[\s>]", content, re.IGNORECASE))
            cols = len(re.findall(r"<t[dh][\s>]", content, re.IGNORECASE))
            if rows > 0:
                cols = cols // rows
        else:
            # Markdown 表格：统计 | 分隔的行和列
            table_lines = [
                line
                for line in content.strip().split("\n")
                if line.strip().startswith("|")
                and line.strip().endswith("|")
                # 排除分隔行（如 |---|---|）
                and not re.match(r"^\|[\s\-:|]+\|$", line.strip())
            ]
            rows = len(table_lines)
            if rows > 0:
                cols = len(table_lines[0].split("|")) - 2  # 首尾空元素

        return (rows, cols)

    def _extract_formulas(
        self,
        content_list: List[Dict[str, Any]],
        markdown: str,
    ) -> List[MinerUFormula]:
        """从 content_list 和 Markdown 中提取数学公式。

        双重提取策略：
            1. 从 content_list 中提取 type="equation" 的结构化数据
            2. 从 Markdown 文本中正则匹配补充提取

        Args:
            content_list: MinerU content_list.json 内容。
            markdown: MinerU 输出的 Markdown 文本。

        Returns:
            提取的公式列表。
        """
        formulas: List[MinerUFormula] = []
        seen_latex: set = set()  # 去重

        # 策略 1：从 content_list 提取
        for item in content_list:
            if item.get("type") != "equation":
                continue
            latex = item.get("latex", "")
            if not latex or latex in seen_latex:
                continue
            seen_latex.add(latex)

            # 判断公式类型
            formula_type = item.get("format", "block")
            if formula_type not in ("inline", "block"):
                formula_type = "block"

            page_no = item.get("page_no", None)
            original_text = item.get("text", "")

            formulas.append(
                MinerUFormula(
                    latex=latex,
                    formula_type=formula_type,
                    page_number=page_no,
                    original_text=original_text,
                )
            )

        # 策略 2：从 Markdown 正则补充提取
        # 块级公式: $$ ... $$
        for match in re.finditer(r"\$\$([\s\S]+?)\$\$", markdown):
            latex = match.group(1).strip()
            if latex and latex not in seen_latex:
                seen_latex.add(latex)
                formulas.append(MinerUFormula(latex=latex, formula_type="block"))

        # 行内公式: $ ... $ (排除 $$)
        for match in re.finditer(r"(?<!\$)\$(?!\$)([^$]+?)\$(?!\$)", markdown):
            latex = match.group(1).strip()
            if latex and len(latex) > 1 and latex not in seen_latex:
                seen_latex.add(latex)
                formulas.append(MinerUFormula(latex=latex, formula_type="inline"))

        return formulas

    def _extract_images(
        self,
        content_list: List[Dict[str, Any]],
        output_dir: Path,
    ) -> List[MinerUImage]:
        """从 content_list 提取图片信息。

        MinerU content_list 中 type="image" 的条目包含图片路径和元数据。
        图片文件通常保存在输出目录的 ``images/`` 子目录中。

        Args:
            content_list: MinerU content_list.json 内容。
            output_dir: MinerU 输出根目录（用于解析图片相对路径）。

        Returns:
            提取的图片列表。
        """
        images: List[MinerUImage] = []

        for item in content_list:
            if item.get("type") != "image":
                continue
            try:
                page_no = item.get("page_no", None)
                caption = item.get("text", "")
                bbox = self._extract_bbox_from_item(item)

                # 图片路径解析
                img_path = item.get("img_path", "")
                filename = None
                local_path = None

                if img_path:
                    img_p = Path(img_path)
                    filename = img_p.name

                    # 尝试解析为绝对路径
                    if img_p.is_absolute():
                        local_path = str(img_p)
                    else:
                        # 相对于输出目录
                        candidates = [
                            output_dir / img_path,
                            output_dir / "images" / img_path,
                            output_dir / "auto" / img_path,
                        ]
                        for candidate in candidates:
                            if candidate.exists():
                                local_path = str(candidate)
                                break

                # 尝试读取图片尺寸
                width, height = self._read_image_dimensions(local_path)

                # base64 编码
                base64_data = None
                if local_path and Path(local_path).exists():
                    try:
                        import base64 as b64mod

                        with open(local_path, "rb") as f:
                            base64_data = b64mod.b64encode(f.read()).decode("ascii")
                    except Exception as e:
                        logger.debug("读取图片 base64 数据失败: %s", e)

                images.append(
                    MinerUImage(
                        page_number=page_no,
                        caption=caption or None,
                        bbox=bbox,
                        filename=filename,
                        local_path=local_path,
                        width=width,
                        height=height,
                        base64_data=base64_data,
                    )
                )
            except Exception as e:
                logger.warning("提取 MinerU 图片失败: %s", e)

        return images

    def _extract_code_blocks(self, content_list: List[Dict[str, Any]]) -> List[Any]:
        """提取代码块。

        MinerU 当前不支持代码块检测，始终返回空列表。

        Args:
            content_list: MinerU content_list.json 内容（未使用）。

        Returns:
            空列表。
        """
        return []

    # ------------------------------------------------------------------
    # 元数据与辅助方法
    # ------------------------------------------------------------------

    def _extract_metadata(
        self,
        content_list: List[Dict[str, Any]],
        pdf_path: str,
    ) -> Dict[str, Any]:
        """提取文档元数据。

        Args:
            content_list: MinerU content_list.json 内容。
            pdf_path: 原始 PDF 文件路径。

        Returns:
            元数据字典。
        """
        meta: Dict[str, Any] = {
            "source": "mineru",
            "pdf_path": pdf_path,
        }

        # 从 content_list 中提取可用元数据
        if content_list:
            # 页码范围
            page_numbers = [
                item.get("page_no")
                for item in content_list
                if item.get("page_no") is not None
            ]
            if page_numbers:
                meta["first_page"] = min(page_numbers)  # type: ignore[type-var]
                meta["last_page"] = max(page_numbers)  # type: ignore[type-var]

        # 文件基本信息
        pdf_p = Path(pdf_path)
        meta["filename"] = pdf_p.name
        meta["file_size"] = pdf_p.stat().st_size if pdf_p.exists() else 0

        return meta

    def _extract_page_count(self, content_list: List[Dict[str, Any]]) -> int:
        """从 content_list 中提取总页数。

        通过统计所有条目中的最大页码来估算页数。

        Args:
            content_list: MinerU content_list.json 内容。

        Returns:
            估算的总页数。
        """
        if not content_list:
            return 0

        max_page = 0
        for item in content_list:
            page_no = item.get("page_no", 0)
            if page_no is not None and isinstance(page_no, (int, float)):
                max_page = max(max_page, int(page_no))

        # 页码从 0 或 1 开始，需要 +1
        return max_page + 1 if max_page > 0 else 0

    @staticmethod
    def _extract_bbox_from_item(
        item: Dict[str, Any],
    ) -> Optional[Tuple[float, float, float, float]]:
        """从 content_list 条目中提取边界框。

        MinerU 的 bbox 格式可能为 [x0, y0, x1, y1] 列表或包含各字段的字典。

        Args:
            item: content_list 中的单个条目。

        Returns:
            (x0, y0, x1, y1) 边界框元组，或 ``None``。
        """
        bbox = item.get("bbox")
        if bbox is None:
            return None

        # 列表格式: [x0, y0, x1, y1]
        if isinstance(bbox, (list, tuple)) and len(bbox) >= 4:
            try:
                return (float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3]))
            except (TypeError, ValueError):
                return None

        # 字典格式: {"x0": ..., "y0": ..., "x1": ..., "y1": ...}
        if isinstance(bbox, dict):
            try:
                return (
                    float(bbox.get("x0", bbox.get("left", 0))),  # type: ignore[arg-type]
                    float(bbox.get("y0", bbox.get("top", 0))),  # type: ignore[arg-type]
                    float(bbox.get("x1", bbox.get("right", 0))),  # type: ignore[arg-type]
                    float(bbox.get("y1", bbox.get("bottom", 0))),  # type: ignore[arg-type]
                )
            except (TypeError, ValueError):
                return None

        return None

    @staticmethod
    def _read_image_dimensions(
        image_path: Optional[str],
    ) -> Tuple[Optional[int], Optional[int]]:
        """读取图片文件的宽高像素值。

        优先使用 PIL，降级为文件头解析。

        Args:
            image_path: 图片文件路径。

        Returns:
            (width, height) 元组，失败返回 (None, None)。
        """
        if not image_path or not Path(image_path).exists():
            return (None, None)

        try:
            from PIL import Image

            with Image.open(image_path) as img:
                return img.size
        except ImportError:
            logger.debug("PIL 不可用，无法读取图片尺寸")
        except Exception as e:
            logger.debug("读取图片尺寸失败: %s", e)

        return (None, None)

    # ------------------------------------------------------------------
    # 缓存管理
    # ------------------------------------------------------------------

    @classmethod
    def reset_cache(cls) -> None:
        """清除 converter 缓存（主要用于测试）。"""
        cls._converters.clear()
