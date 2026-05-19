"""PDF 图片提取模块。

负责从 PDF 页面中提取图片资源，支持：
- 基础图片提取（``extract_images_from_pdf_page``）
- 带空间定位的图片提取（``extract_images_with_positions``），
  将图片与文本块位置关联，实现 Markdown 内联插入。

References:
    PyMuPDF (fitz) API: https://pymupdf.readthedocs.io/
"""

from __future__ import annotations

import base64
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..figure_text_filter import CAPTION_PATTERNS as _CAPTION_PATTERNS
from ._shared import generate_asset_id, slugify

# PyMuPDF imports
try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 数据类
# ---------------------------------------------------------------------------


@dataclass
class ExtractedImage:
    """提取的图片信息数据类。"""

    id: str
    filename: str
    local_path: str
    base64_data: Optional[str] = None
    mime_type: str = "image/png"
    width: Optional[int] = None
    height: Optional[int] = None
    page_number: Optional[int] = None
    position: Optional[Dict[str, float]] = None
    caption: Optional[str] = None
    xref: Optional[int] = None


# ---------------------------------------------------------------------------
# 图片标题检测
# ---------------------------------------------------------------------------


def detect_image_caption(
    text_blocks: list,
    img_y1: float,
    img_x0: float,
    img_x1: float,
    tolerance: float = 30.0,
) -> Optional[str]:
    """检测图片下方的标题文本。

    扫描图片底部附近的文本块，匹配标题模式
    （如 ``Figure 1:``、``图 1``）。

    Args:
        text_blocks: ``page.get_text("blocks")`` 的结果列表（仅 type==0 文本块）。
        img_y1: 图片底部 y 坐标。
        img_x0: 图片左侧 x 坐标。
        img_x1: 图片右侧 x 坐标。
        tolerance: 垂直搜索距离上限（默认 30.0）。

    Returns:
        标题字符串，未找到则返回 ``None``。
    """
    best_caption = None
    best_distance = tolerance + 1

    for block in text_blocks:
        if block[6] != 0:
            continue
        block_y0 = block[1]
        block_text = block[4].strip() if block[4] else ""
        if not block_text:
            continue

        vertical_distance = block_y0 - img_y1
        if vertical_distance < -5 or vertical_distance > tolerance:
            continue

        block_x0, block_x1 = block[0], block[2]
        overlap = min(block_x1, img_x1) - max(block_x0, img_x0)
        if overlap <= 0:
            continue

        first_line = block_text.split("\n")[0].strip()
        for pattern in _CAPTION_PATTERNS:
            if pattern.match(first_line):
                if vertical_distance < best_distance:
                    best_distance = vertical_distance
                    best_caption = re.sub(r"\n+", " ", block_text).strip()
                    if len(best_caption) > 120:
                        best_caption = best_caption[:120]
                break

    return best_caption


# ---------------------------------------------------------------------------
# 图片文件名生成
# ---------------------------------------------------------------------------


def generate_image_name(
    page_num: int,
    img_index: int,
    xref_name: str = "",
    caption: Optional[str] = None,
    nearby_text: str = "",
    pdf_name: str = "",
) -> str:
    """为提取的图片生成语义化文件名。

    优先级：标题文本 > PDF 内部名称 > 附近文本上下文 > 回退默认名。

    Args:
        page_num: 页码（0-based）。
        img_index: 图片在该页内的序号。
        xref_name: PDF 内部 xref 元数据名称。
        caption: 检测到的图片标题。
        nearby_text: 附近的文本上下文。
        pdf_name: 原始 PDF 文件名。

    Returns:
        不含扩展名的文件名 slug。
    """
    if caption:
        slug = slugify(caption)
        if slug and len(slug) >= 3:
            return slug

    if xref_name and xref_name not in ("Im", "Image", "X", "img"):
        slug = slugify(xref_name)
        if slug and len(slug) >= 2:
            return f"p{page_num + 1}-{slug}"

    if nearby_text:
        words = nearby_text.split()[:5]
        context = " ".join(words)
        slug = slugify(context)
        if slug and len(slug) >= 3:
            return f"p{page_num + 1}-{slug}"

    base = slugify(pdf_name) if pdf_name else "img"
    if not base:
        base = "img"
    return f"{base}-p{page_num + 1}-{img_index + 1}"


# ---------------------------------------------------------------------------
# 图片提取函数
# ---------------------------------------------------------------------------


async def extract_images_from_pdf_page(
    pdf_document,
    page_num: int,
    output_dir: Path,
    image_format: str = "png",
) -> List[ExtractedImage]:
    """从 PDF 页面提取所有图片。

    Args:
        pdf_document: PyMuPDF 文档对象。
        page_num: 页码（0-based）。
        output_dir: 图片输出目录。
        image_format: 输出图片格式（png, jpg 等）。

    Returns:
        ``ExtractedImage`` 列表。
    """
    images: List[ExtractedImage] = []

    try:
        if fitz is None:
            raise ImportError("PyMuPDF (fitz) is not available")

        page = pdf_document[page_num]
        image_list = page.get_images(full=True)

        for img_index, img_info in enumerate(image_list):
            try:
                xref = img_info[0]
                pix = fitz.Pixmap(pdf_document, xref)

                if pix.n - pix.alpha >= 4:
                    pix = fitz.Pixmap(fitz.csRGB, pix)

                img_id = generate_asset_id("img", page_num, img_index)
                filename = f"{img_id}.{image_format}"
                local_path = output_dir / filename

                if image_format.lower() == "png":
                    pix.save(str(local_path))
                else:
                    with open(local_path, "wb") as f:
                        f.write(pix.tobytes(image_format.upper()))

                width, height = pix.width, pix.height
                b64_data = base64.b64encode(pix.tobytes(image_format.upper())).decode(
                    "ascii"
                )

                position = None
                try:
                    rects = page.get_image_rects(xref)
                    if rects:
                        rect = rects[0]
                        position = {
                            "x0": rect.x0,
                            "y0": rect.y0,
                            "x1": rect.x1,
                            "y1": rect.y1,
                        }
                except Exception:
                    pass  # nosec B110

                extracted_image = ExtractedImage(
                    id=img_id,
                    filename=filename,
                    local_path=str(local_path),
                    base64_data=b64_data,
                    mime_type=f"image/{image_format}",
                    width=width,
                    height=height,
                    page_number=page_num,
                    position=position,
                    xref=xref,
                )

                images.append(extracted_image)
                logger.info(f"Extracted image {img_id} from page {page_num}")

                pix = None  # Free memory

            except Exception as e:
                logger.warning(
                    f"Failed to extract image {img_index} from page {page_num}: {str(e)}"
                )
                continue

    except ImportError:
        logger.error("PyMuPDF (fitz) is required for image extraction")
    except Exception as e:
        logger.error(f"Error extracting images from page {page_num}: {str(e)}")

    return images


async def extract_images_with_positions(
    pdf_document,
    page_num: int,
    text_blocks: list,
    output_dir: Path,
    collected_images: List[ExtractedImage],
    image_format: str = "png",
    pdf_name: str = "",
) -> Dict[int, ExtractedImage]:
    """提取图片并构建 block_no -> ExtractedImage 映射。

    将图片 xref 与其在页面上的视觉块位置关联，
    使图片可在正确的文本位置内联插入。

    Args:
        pdf_document: PyMuPDF 文档对象。
        page_num: 页码（0-based）。
        text_blocks: ``page.get_text("blocks")`` 的结果列表。
        output_dir: 图片输出目录。
        collected_images: 累积的图片列表（提取的图片会追加到此列表）。
        image_format: 输出图片格式。
        pdf_name: 原始 PDF 文件名（用于命名）。

    Returns:
        block_no (int) -> ``ExtractedImage`` 的映射字典。
    """
    block_to_image: Dict[int, ExtractedImage] = {}

    try:
        if fitz is None:
            raise ImportError("PyMuPDF (fitz) is not available")

        page = pdf_document[page_num]
        image_list = page.get_images(full=True)

        if not image_list:
            return block_to_image

        # Build xref -> rect mapping
        xref_rects: Dict[int, Any] = {}
        for img_info in image_list:
            xref = img_info[0]
            try:
                rects = page.get_image_rects(xref)
                if rects:
                    xref_rects[xref] = rects[0]
            except Exception:
                continue  # nosec B112

        image_blocks = [b for b in text_blocks if b[6] == 1]
        text_only_blocks = [b for b in text_blocks if b[6] == 0]

        matched_xrefs: set = set()
        for block in image_blocks:
            b_x0, b_y0, b_x1, b_y1 = block[0], block[1], block[2], block[3]
            block_no = block[5]
            b_cx = (b_x0 + b_x1) / 2
            b_cy = (b_y0 + b_y1) / 2

            best_xref = None
            best_overlap = -1

            for xref, rect in xref_rects.items():
                if xref in matched_xrefs:
                    continue
                overlap_x0 = max(b_x0, rect.x0)
                overlap_y0 = max(b_y0, rect.y0)
                overlap_x1 = min(b_x1, rect.x1)
                overlap_y1 = min(b_y1, rect.y1)

                if overlap_x1 > overlap_x0 and overlap_y1 > overlap_y0:
                    overlap_area = (overlap_x1 - overlap_x0) * (overlap_y1 - overlap_y0)
                    if overlap_area > best_overlap:
                        best_overlap = overlap_area
                        best_xref = xref
                else:
                    margin = 20
                    if (
                        rect.x0 - margin <= b_cx <= rect.x1 + margin
                        and rect.y0 - margin <= b_cy <= rect.y1 + margin
                    ):
                        if best_overlap < 0:
                            best_xref = xref

            if best_xref is None:
                continue

            matched_xrefs.add(best_xref)

            img_info = None
            img_index = 0
            for idx, info in enumerate(image_list):
                if info[0] == best_xref:
                    img_info = info
                    img_index = idx
                    break

            if img_info is None:
                continue

            try:
                pix = fitz.Pixmap(pdf_document, best_xref)

                if pix.n - pix.alpha >= 4:
                    pix = fitz.Pixmap(fitz.csRGB, pix)

                width, height = pix.width, pix.height

                rect = xref_rects[best_xref]
                caption = detect_image_caption(
                    text_only_blocks, rect.y1, rect.x0, rect.x1
                )

                xref_name = img_info[7] if len(img_info) > 7 else ""

                nearby_text = ""
                for tb in sorted(text_only_blocks, key=lambda b: b[1]):
                    if tb[1] < b_y0 and tb[4]:
                        nearby_text = tb[4].strip()

                name_slug = generate_image_name(
                    page_num, img_index, xref_name, caption, nearby_text, pdf_name
                )
                filename = f"{name_slug}.{image_format}"

                local_path = output_dir / filename
                counter = 1
                while local_path.exists():
                    filename = f"{name_slug}-{counter}.{image_format}"
                    local_path = output_dir / filename
                    counter += 1

                if image_format.lower() == "png":
                    pix.save(str(local_path))
                else:
                    with open(local_path, "wb") as f:
                        f.write(pix.tobytes(image_format.upper()))

                b64_data = base64.b64encode(pix.tobytes(image_format.upper())).decode(
                    "ascii"
                )

                extracted_image = ExtractedImage(
                    id=f"img_{page_num}_{img_index}",
                    filename=filename,
                    local_path=str(local_path),
                    base64_data=b64_data,
                    mime_type=f"image/{image_format}",
                    width=width,
                    height=height,
                    page_number=page_num,
                    position={
                        "x0": rect.x0,
                        "y0": rect.y0,
                        "x1": rect.x1,
                        "y1": rect.y1,
                    },
                    caption=caption,
                    xref=best_xref,
                )

                block_to_image[block_no] = extracted_image
                collected_images.append(extracted_image)
                logger.info(
                    f"Extracted image '{filename}' from page {page_num} (block {block_no})"
                )

                pix = None

            except Exception as e:
                logger.warning(
                    f"Failed to extract image for block {block_no} on page {page_num}: {str(e)}"
                )
                continue

        # Handle unmatched xrefs
        for img_index, img_info in enumerate(image_list):
            xref = img_info[0]
            if xref in matched_xrefs:
                continue

            try:
                pix = fitz.Pixmap(pdf_document, xref)
                if pix.n - pix.alpha >= 4:
                    pix = fitz.Pixmap(fitz.csRGB, pix)

                width, height = pix.width, pix.height
                xref_name = img_info[7] if len(img_info) > 7 else ""

                position = None
                if xref in xref_rects:
                    rect = xref_rects[xref]
                    position = {
                        "x0": rect.x0,
                        "y0": rect.y0,
                        "x1": rect.x1,
                        "y1": rect.y1,
                    }

                name_slug = generate_image_name(
                    page_num, img_index, xref_name, None, "", pdf_name
                )
                filename = f"{name_slug}.{image_format}"
                local_path = output_dir / filename
                counter = 1
                while local_path.exists():
                    filename = f"{name_slug}-{counter}.{image_format}"
                    local_path = output_dir / filename
                    counter += 1

                if image_format.lower() == "png":
                    pix.save(str(local_path))
                else:
                    with open(local_path, "wb") as f:
                        f.write(pix.tobytes(image_format.upper()))

                b64_data = base64.b64encode(pix.tobytes(image_format.upper())).decode(
                    "ascii"
                )

                extracted_image = ExtractedImage(
                    id=f"img_{page_num}_{img_index}",
                    filename=filename,
                    local_path=str(local_path),
                    base64_data=b64_data,
                    mime_type=f"image/{image_format}",
                    width=width,
                    height=height,
                    page_number=page_num,
                    position=position,
                    xref=xref,
                )
                collected_images.append(extracted_image)
                logger.info(
                    f"Extracted unmatched image '{filename}' from page {page_num}"
                )

                pix = None

            except Exception as e:
                logger.warning(
                    f"Failed to extract unmatched image xref={xref} on page {page_num}: {str(e)}"
                )
                continue

    except ImportError:
        logger.error("PyMuPDF (fitz) is required for image extraction")
    except Exception as e:
        logger.error(
            f"Error in extract_images_with_positions for page {page_num}: {str(e)}"
        )

    return block_to_image
