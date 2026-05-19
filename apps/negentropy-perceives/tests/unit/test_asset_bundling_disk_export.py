"""单元测试：`_build_image_assets` 把 ExtractedImage 落盘并构造 ImageAsset 指针。

设计契约：
1. 图片原字节写入 ``<output_dir>/images/<filename>``；返回 ``ImageAsset.image_path``
   指向落盘的绝对路径，``base64_data`` 字段不再存在。
2. 未指定 ``output_dir`` 时回退到 ``<cwd>/output/<pdf_stem>/images/``，与 S9
   ``BuiltinBundler`` 的目录约定一致。
3. 输入为空（None / 无 images）→ 返回 ``[]``。
4. 单图字节读取失败（``base64_data`` 与 ``local_path`` 都不可用）→ 跳过该图。
5. 单图写盘失败（IOError）→ 仅跳过该图，其余正常落盘。
6. 优先复用 ``ExtractedImage.local_path``：源已存在则 ``shutil.copy2``，
   避免无谓的解码—编码—写盘往返。
"""

from __future__ import annotations

import base64
from pathlib import Path
from typing import List
from unittest.mock import patch

import pytest

from negentropy.perceives.pipeline.convenience import _build_image_assets
from negentropy.perceives.pipeline.models import (
    ExtractedImage,
    ImageExtractionOutput,
)


def _png_bytes(n: int, byte: int = 0xAB) -> bytes:
    """返回固定字节的伪 PNG 字节串；落盘路径不需要合法 PNG 解码。"""
    return bytes([byte]) * n


def _make_img(
    filename: str,
    *,
    raw: bytes | None = None,
    local_path: str | None = None,
    width: int = 64,
    height: int = 48,
    page: int = 0,
    caption: str | None = None,
    mime: str = "image/png",
) -> ExtractedImage:
    b64 = base64.b64encode(raw).decode("ascii") if raw is not None else None
    return ExtractedImage(
        image_id=filename.split(".")[0],
        filename=filename,
        local_path=local_path,
        base64_data=b64,
        mime_type=mime,
        width=width,
        height=height,
        page_number=page,
        bbox=None,
        caption=caption,
    )


def _make_output(images: List[ExtractedImage]) -> ImageExtractionOutput:
    return ImageExtractionOutput(
        images=images,
        total_count=len(images),
        metadata={"engine": "pymupdf", "page_count": len(images)},
    )


# ─────────────────────────── 空/边界输入 ───────────────────────────


class TestEmptyInputs:
    def test_none_returns_empty(self, tmp_path: Path) -> None:
        assert _build_image_assets(None, output_dir=str(tmp_path)) == []

    def test_no_images_returns_empty(self, tmp_path: Path) -> None:
        out = ImageExtractionOutput(images=[], total_count=0, metadata={})
        assert _build_image_assets(out, output_dir=str(tmp_path)) == []

    def test_missing_both_sources_is_skipped(self, tmp_path: Path) -> None:
        out = _make_output([_make_img("ghost.png", raw=None, local_path=None)])
        assets = _build_image_assets(out, output_dir=str(tmp_path))
        assert assets == []


# ─────────────────────────── 落盘核心路径 ───────────────────────────


class TestDiskExport:
    def test_writes_bytes_from_base64_source(self, tmp_path: Path) -> None:
        raw = _png_bytes(200, byte=0x11)
        out = _make_output(
            [
                _make_img(
                    "img_p0_0.png",
                    raw=raw,
                    width=640,
                    height=480,
                    page=0,
                    caption="Fig 1",
                )
            ]
        )

        assets = _build_image_assets(out, output_dir=str(tmp_path))

        assert len(assets) == 1
        a = assets[0]
        assert a.filename == "img_p0_0.png"
        assert a.mime_type == "image/png"
        assert a.resource_uri is None  # 由 tool 层注册后回填
        assert a.width == 640
        assert a.height == 480
        assert a.page_number == 0
        assert a.caption == "Fig 1"

        dest = tmp_path / "images" / "img_p0_0.png"
        assert Path(a.image_path) == dest.resolve()
        assert dest.read_bytes() == raw

    def test_local_path_is_copied_in_zero_decode(self, tmp_path: Path) -> None:
        """有 local_path 时直接复制源文件，跳过 base64 解码—写盘往返。"""
        src_dir = tmp_path / "src"
        src_dir.mkdir()
        src = src_dir / "x.png"
        raw = _png_bytes(128, byte=0x22)
        src.write_bytes(raw)

        out = _make_output([_make_img("x.png", raw=None, local_path=str(src))])
        out_dir = tmp_path / "out"

        assets = _build_image_assets(out, output_dir=str(out_dir))
        assert len(assets) == 1
        dest = out_dir / "images" / "x.png"
        assert Path(assets[0].image_path) == dest.resolve()
        assert dest.read_bytes() == raw

    def test_local_path_already_at_dest_is_idempotent(self, tmp_path: Path) -> None:
        """源文件就在目标位置时不重复复制，仍然返回正确路径。"""
        out_dir = tmp_path / "out"
        images_dir = out_dir / "images"
        images_dir.mkdir(parents=True)
        dest = images_dir / "y.png"
        raw = _png_bytes(64, byte=0x33)
        dest.write_bytes(raw)

        out = _make_output([_make_img("y.png", raw=None, local_path=str(dest))])

        assets = _build_image_assets(out, output_dir=str(out_dir))
        assert len(assets) == 1
        assert Path(assets[0].image_path) == dest.resolve()
        assert dest.read_bytes() == raw

    def test_falls_back_to_cwd_when_no_output_dir(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """未指定 output_dir → 落到 ``<cwd>/output/<pdf_stem>/images/``。"""
        monkeypatch.chdir(tmp_path)
        raw = _png_bytes(80, byte=0x44)
        out = _make_output([_make_img("a.png", raw=raw)])

        assets = _build_image_assets(out, output_dir=None, pdf_stem="mydoc")

        dest = tmp_path / "output" / "mydoc" / "images" / "a.png"
        assert len(assets) == 1
        assert Path(assets[0].image_path) == dest.resolve()
        assert dest.read_bytes() == raw

    def test_falls_back_to_default_stem_when_pdf_stem_missing(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.chdir(tmp_path)
        raw = _png_bytes(40, byte=0x55)
        out = _make_output([_make_img("b.png", raw=raw)])

        assets = _build_image_assets(out, output_dir=None, pdf_stem=None)

        dest = tmp_path / "output" / "document" / "images" / "b.png"
        assert len(assets) == 1
        assert Path(assets[0].image_path) == dest.resolve()


# ─────────────────────────── 鲁棒性：单图失败仅跳过本图 ───────────────────────────


class TestRobustness:
    def test_invalid_base64_is_skipped_not_raised(self, tmp_path: Path) -> None:
        bad = ExtractedImage(
            image_id="bad",
            filename="bad.png",
            local_path=None,
            base64_data="$$$not-base64$$$",
            mime_type="image/png",
        )
        good = _make_img("good.png", raw=_png_bytes(32, byte=0x66))
        out = _make_output([bad, good])

        assets = _build_image_assets(out, output_dir=str(tmp_path))

        # bad 跳过，good 落盘
        assert [a.filename for a in assets] == ["good.png"]
        assert (tmp_path / "images" / "good.png").exists()

    def test_per_image_io_failure_skips_only_that_image(self, tmp_path: Path) -> None:
        """模拟单图写盘抛 OSError，整体不应崩溃，其余图片继续落盘。"""
        out = _make_output(
            [
                _make_img("p0.png", raw=_png_bytes(8, byte=0x77)),
                _make_img("p1.png", raw=_png_bytes(8, byte=0x88)),
                _make_img("p2.png", raw=_png_bytes(8, byte=0x99)),
            ]
        )

        original_write = Path.write_bytes

        def flaky_write(self: Path, data: bytes) -> int:  # noqa: D401
            if self.name == "p1.png":
                raise OSError("simulated write failure")
            return original_write(self, data)

        with patch.object(Path, "write_bytes", flaky_write):
            assets = _build_image_assets(out, output_dir=str(tmp_path))

        assert [a.filename for a in assets] == ["p0.png", "p2.png"]

    def test_export_dir_creation_failure_returns_empty(self, tmp_path: Path) -> None:
        """无法创建目标目录 → 整体回落空列表，不抛异常。"""
        out = _make_output([_make_img("a.png", raw=_png_bytes(16))])

        with patch.object(
            Path,
            "mkdir",
            side_effect=OSError("simulated mkdir denied"),
        ):
            assets = _build_image_assets(out, output_dir=str(tmp_path / "denied"))

        assert assets == []
