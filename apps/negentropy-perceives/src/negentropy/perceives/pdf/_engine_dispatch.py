"""数据驱动的引擎调度：统一 Docling / OpenDataLoader / MinerU / Marker 的降级链逻辑。"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EngineDescriptor:
    """描述一个可降级的 PDF 引擎。"""

    name: str
    display_name: str
    engine_attr: str  # self._docling_engine
    init_kwargs_attr: str  # self._docling_init_kwargs
    install_hint: str
    supports_page_range: bool = True
    needs_embed_images: bool = False


# 按 process_pdf 中的降级优先级排列（不含 pymupdf/pypdf，它们走独立路径）
DISPATCH_TABLE: Tuple[EngineDescriptor, ...] = (
    EngineDescriptor(
        name="docling",
        display_name="Docling",
        engine_attr="_docling_engine",
        init_kwargs_attr="_docling_init_kwargs",
        install_hint="uv pip install negentropy-perceives[docling]",
    ),
    EngineDescriptor(
        name="opendataloader",
        display_name="OpenDataLoader",
        engine_attr="_opendataloader_engine",
        init_kwargs_attr="_opendataloader_init_kwargs",
        install_hint="请安装 opendataloader-pdf 依赖并确保 Java 11+ 可用",
        supports_page_range=False,
        needs_embed_images=True,
    ),
    EngineDescriptor(
        name="mineru",
        display_name="MinerU",
        engine_attr="_mineru_engine",
        init_kwargs_attr="_mineru_init_kwargs",
        install_hint="uv pip install negentropy-perceives[mineru]",
    ),
    EngineDescriptor(
        name="marker",
        display_name="Marker",
        engine_attr="_marker_engine",
        init_kwargs_attr="_marker_init_kwargs",
        install_hint=(
            "uv pip install negentropy-perceives[marker]。"
            "注意：Marker 使用 GPL-3.0 许可证。"
        ),
        supports_page_range=False,
        needs_embed_images=True,
    ),
)


def get_engine_kwargs(
    desc: EngineDescriptor,
    pdf_path: str,
    page_range: Optional[tuple],
    embed_images: bool,
) -> Dict[str, Any]:
    """根据引擎描述构建 run() 所需的 kwargs 参数。"""
    kwargs: Dict[str, Any] = {"pdf_path": pdf_path}
    if desc.supports_page_range:
        kwargs["page_range"] = page_range
    if desc.needs_embed_images:
        kwargs["embed_images"] = embed_images
    return kwargs


async def try_dispatch_engine(
    processor: Any,
    desc: EngineDescriptor,
    pdf_path: str,
    page_range: Optional[tuple],
    embed_images: bool,
    pdf_source: str,
    include_metadata: bool,
    output_format: str,
    method: str,
) -> Optional[Dict[str, Any]]:
    """尝试调度单个引擎处理 PDF。

    Returns:
        成功时返回结果 dict；引擎不可用时返回 None；
        显式指定但不可用时返回错误 dict。
    """
    engine = getattr(processor, desc.engine_attr, None)

    # 引擎未安装/未初始化
    if not engine:
        if method == desc.name:
            return {
                "success": False,
                "error": f"{desc.display_name} 引擎不可用，请安装: {desc.install_hint}",
                "source": pdf_source,
            }
        return None

    # method 不匹配
    if method not in ("auto", desc.name):
        return None

    # 尝试调度
    try:
        logger.info("使用 %s 引擎转换 PDF: %s", desc.name, pdf_source)
        from ..core.cancellation import current_cancel_scope
        from ..infra import get_engine_pool

        _scope = current_cancel_scope()
        init_kwargs = getattr(processor, desc.init_kwargs_attr, {})
        engine_kwargs = get_engine_kwargs(desc, str(pdf_path), page_range, embed_images)

        result = await get_engine_pool().run(
            desc.name,
            kwargs=engine_kwargs,
            init_kwargs=init_kwargs,
            deadline_monotonic=_scope.deadline_monotonic if _scope else None,
        )

        if result and result.markdown:
            return processor._build_result_from_engine(
                result,
                engine_name=desc.name,
                pdf_source=pdf_source,
                include_metadata=include_metadata,
                output_format=output_format,
            )
        logger.warning("%s 返回空结果，降级至下一引擎", desc.name)
    except Exception as e:
        logger.warning("%s 转换失败，降级至下一引擎: %s", desc.name, e)

    return None
