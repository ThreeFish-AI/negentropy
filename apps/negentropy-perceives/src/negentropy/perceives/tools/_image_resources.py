"""图片落盘文件 → MCP Resource 动态注册。

把 :class:`PDFResponse.image_assets` 中已落盘的图片逐个注册为 FastMCP
``FileResource``，回填 ``resource_uri`` 字段，使跨主机客户端可通过
``resources/read?uri=...`` 协议原生地拉取图片字节。

URI 命名规则：``perceives://pdf/<job_id>/<filename>``。每次工具调用生成独立
``job_id``（uuid4 取 12 hex 字符），避免多次解析的 URI 冲突。注册的资源驻留
在 FastMCP server 进程内存中，进程重启失效；磁盘文件由用户的 ``output_dir``
管理，与 server 进程生命周期解耦。
"""

from __future__ import annotations

import logging
import uuid
from pathlib import Path
from typing import Iterable

from fastmcp.resources import FileResource

from ..models import BatchPDFResponse, ImageAssetModel, PDFResponse
from ._registry import app

logger = logging.getLogger(__name__)

URI_SCHEME = "perceives"


def _register_assets(assets: Iterable[ImageAssetModel], job_id: str) -> None:
    """在 ``app`` 上为单个 PDF 的图片资产注册 FileResource，并回填 ``resource_uri``。"""
    for asset in assets:
        if not asset.image_path:
            continue
        path = Path(asset.image_path)
        if not path.is_absolute() or not path.exists():
            logger.warning(
                "图片 %s 路径非绝对或不存在，跳过 Resource 注册: %s",
                asset.filename,
                asset.image_path,
            )
            continue
        uri = f"{URI_SCHEME}://pdf/{job_id}/{asset.filename}"
        try:
            app.add_resource(
                FileResource(
                    uri=uri,  # type: ignore[arg-type]  # pydantic 自动转 AnyUrl
                    path=path,
                    mime_type=asset.mime_type,
                    is_binary=True,
                    name=f"PDF image {asset.filename}",
                )
            )
            asset.resource_uri = uri
        except Exception as e:  # noqa: BLE001 - 注册失败不应影响主响应返回
            logger.warning("注册图片 %s 为 Resource 失败: %s", asset.filename, e)


def register_pdf_response_images(response: PDFResponse) -> PDFResponse:
    """为单个 PDFResponse 注册所有图片为 MCP Resource，回填 ``resource_uri``。"""
    if not response.image_assets:
        return response
    job_id = uuid.uuid4().hex[:12]
    _register_assets(response.image_assets, job_id)
    return response


def register_batch_pdf_response_images(response: BatchPDFResponse) -> BatchPDFResponse:
    """批量版本：对 BatchPDFResponse.results 中每个子响应独立分配 job_id 注册。"""
    for sub in response.results:
        if sub.image_assets:
            job_id = uuid.uuid4().hex[:12]
            _register_assets(sub.image_assets, job_id)
    return response
