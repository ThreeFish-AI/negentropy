"""单元测试：``tools._image_resources`` 把图片落盘文件注册为 MCP Resource。

设计契约：
1. URI 命名规则：``perceives://pdf/<12hex>/<filename>``，每次工具调用独立分配 job_id。
2. 注册到 ``app`` 后，``await app.get_resource(uri)`` 可拉到 ``FileResource`` 实例
   且 ``read()`` 返回的字节与磁盘文件一致。
3. ``ImageAssetModel.resource_uri`` 字段被回填为注册的 URI。
4. 缺失/不存在的 ``image_path`` 跳过注册，不影响其它图片。
5. 批量响应（BatchPDFResponse）每个子响应分配独立 job_id。
"""

from __future__ import annotations

import re
from pathlib import Path

from fastmcp.resources import FileResource

from negentropy.perceives.models import (
    BatchPDFResponse,
    ImageAssetModel,
    PDFResponse,
)
from negentropy.perceives.tools._image_resources import (
    URI_SCHEME,
    register_batch_pdf_response_images,
    register_pdf_response_images,
)
from negentropy.perceives.tools._registry import app

URI_PATTERN = re.compile(rf"^{URI_SCHEME}://pdf/[0-9a-f]{{12}}/[\w.\-]+$")


def _png_bytes(byte: int = 0xAA, n: int = 32) -> bytes:
    return bytes([byte]) * n


def _make_response(
    image_paths: list[tuple[str, bytes, str]],
) -> PDFResponse:
    """构造 PDFResponse，每项 = (filename, raw_bytes, image_path)。"""
    assets = [
        ImageAssetModel(
            filename=name,
            mime_type="image/png",
            image_path=path,
            page_number=i,
        )
        for i, (name, _raw, path) in enumerate(image_paths)
    ]
    return PDFResponse(
        success=True,
        pdf_source="dummy.pdf",
        method="pipeline_auto",
        output_format="markdown",
        content="",
        conversion_time=0.0,
        image_assets=assets if assets else None,
    )


class TestRegisterSingleResponse:
    async def test_uri_format_and_resource_lookup(self, tmp_path: Path) -> None:
        raw = _png_bytes(0x11, 64)
        img_path = tmp_path / "img_p0_0.png"
        img_path.write_bytes(raw)

        response = _make_response([("img_p0_0.png", raw, str(img_path))])
        register_pdf_response_images(response)

        assert response.image_assets is not None
        asset = response.image_assets[0]
        assert asset.resource_uri is not None
        assert URI_PATTERN.match(asset.resource_uri), asset.resource_uri

        resource = await app.get_resource(asset.resource_uri)
        assert isinstance(resource, FileResource)
        assert resource.is_binary is True
        assert resource.mime_type == "image/png"

        result = await resource.read()
        # ResourceResult.contents 是 list[ResourceContent]
        assert len(result.contents) == 1
        content = result.contents[0].content
        assert content == raw

    async def test_non_existent_path_is_skipped_without_raise(
        self, tmp_path: Path
    ) -> None:
        ghost = tmp_path / "missing.png"  # 故意不创建
        response = _make_response([("missing.png", b"", str(ghost))])

        register_pdf_response_images(response)

        assert response.image_assets is not None
        assert response.image_assets[0].resource_uri is None

    async def test_relative_path_is_skipped(self, tmp_path: Path) -> None:
        response = _make_response([("a.png", b"", "relative/a.png")])
        register_pdf_response_images(response)
        assert response.image_assets is not None
        assert response.image_assets[0].resource_uri is None

    async def test_empty_assets_is_noop(self) -> None:
        response = _make_response([])
        # image_assets 此时为 None
        register_pdf_response_images(response)
        assert response.image_assets is None

    async def test_distinct_job_ids_across_calls(self, tmp_path: Path) -> None:
        """两次独立调用 → 两个不同的 job_id（URI 命名空间不冲突）。"""
        raw = _png_bytes(0x22, 16)
        for name in ("a.png", "b.png"):
            (tmp_path / name).write_bytes(raw)

        r1 = _make_response([("a.png", raw, str(tmp_path / "a.png"))])
        r2 = _make_response([("b.png", raw, str(tmp_path / "b.png"))])

        register_pdf_response_images(r1)
        register_pdf_response_images(r2)

        assert r1.image_assets and r2.image_assets
        uri1 = r1.image_assets[0].resource_uri or ""
        uri2 = r2.image_assets[0].resource_uri or ""
        # 提取 job_id 段
        job1 = uri1.split("/")[3] if uri1 else ""
        job2 = uri2.split("/")[3] if uri2 else ""
        assert job1 and job2 and job1 != job2


class TestRegisterBatchResponse:
    async def test_each_subresponse_gets_own_job_id(self, tmp_path: Path) -> None:
        raw = _png_bytes(0x33, 24)
        for name in ("a.png", "b.png"):
            (tmp_path / name).write_bytes(raw)

        sub1 = _make_response([("a.png", raw, str(tmp_path / "a.png"))])
        sub2 = _make_response([("b.png", raw, str(tmp_path / "b.png"))])
        batch = BatchPDFResponse(
            success=True,
            total_pdfs=2,
            successful_count=2,
            failed_count=0,
            results=[sub1, sub2],
            total_conversion_time=0.0,
        )

        register_batch_pdf_response_images(batch)

        uri1 = (sub1.image_assets or [None])[0]
        uri2 = (sub2.image_assets or [None])[0]
        assert uri1 is not None and uri2 is not None
        assert uri1.resource_uri and uri2.resource_uri
        # 不同 job_id
        assert uri1.resource_uri.split("/")[3] != uri2.resource_uri.split("/")[3]
