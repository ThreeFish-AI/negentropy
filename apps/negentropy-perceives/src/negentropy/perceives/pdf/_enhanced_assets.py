"""增强资源提取逻辑：图片、表格、公式的提取与注入。

从 PDFProcessor 中提取的增强资源操作函数。
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from .enhanced import ExtractedFormula, ExtractedImage, ExtractedTable
from .math_formula import DoclingFormulaEnricher, FormulaReconstructor, MathRegion
from ._imports import import_fitz

logger = logging.getLogger(__name__)


async def extract_enhanced_assets(
    enhanced_processor: Any,
    page_image_maps: Dict[int, Dict[int, ExtractedImage]],
    page_table_maps: Dict[int, Dict[tuple, ExtractedTable]],
    page_math_blocks: Dict[int, List[str]],
    page_math_regions: Dict[int, List[MathRegion]],
    pdf_path: Path,
    page_range: Optional[tuple],
    extract_images: bool,
    extract_tables: bool,
    extract_formulas: bool,
    pdf_name: str = "",
) -> Dict[str, Any]:
    """提取增强资源（图片、表格、公式）。

    通过 page_image_maps / page_table_maps 参数回传页面级映射，
    使调用方（text extraction）能内联引用这些资源。

    Returns:
        提取结果 dict。
    """
    try:
        fitz = import_fitz()
        doc = fitz.open(str(pdf_path))

        start_page = 0
        end_page = len(doc)

        if page_range:
            start_page = max(0, page_range[0])
            end_page = min(len(doc), page_range[1])

        extracted_assets: Dict[str, Any] = {
            "success": True,
            "pages_processed": end_page - start_page,
        }

        if extract_images:
            for page_num in range(start_page, end_page):
                try:
                    page = doc[page_num]
                    blocks = page.get_text("blocks")

                    image_map = await enhanced_processor.extract_images_with_positions(
                        doc,
                        page_num,
                        blocks,
                        enhanced_processor.output_dir,
                        enhanced_processor.images,
                        pdf_name=pdf_name,
                    )
                    if image_map:
                        page_image_maps[page_num] = image_map
                except Exception as e:
                    logger.warning(
                        f"Failed to extract images from page {page_num}: {str(e)}"
                    )

            extracted_assets["images_extracted"] = len(enhanced_processor.images)

        if extract_tables:
            for page_num in range(start_page, end_page):
                try:
                    page = doc[page_num]
                    blocks = page.get_text("blocks")

                    bbox_map, geo_tables = (
                        enhanced_processor.extract_tables_with_geometry(
                            doc,
                            page_num,
                            blocks,
                        )
                    )

                    if bbox_map:
                        page_table_maps[page_num] = bbox_map

                    enhanced_processor.tables.extend(geo_tables)

                    if not geo_tables:
                        text = page.get_text()
                        text_tables = enhanced_processor.extract_tables_from_text(
                            text, page_num
                        )
                        enhanced_processor.tables.extend(text_tables)

                except Exception as e:
                    logger.warning(
                        f"Failed to extract tables from page {page_num}: {str(e)}"
                    )

        if extract_formulas:
            extract_formulas_dual_path(
                enhanced_processor=enhanced_processor,
                page_math_blocks=page_math_blocks,
                page_math_regions=page_math_regions,
                doc=doc,
                pdf_path=pdf_path,
                start_page=start_page,
                end_page=end_page,
            )

        if extract_tables:
            extracted_assets["tables_extracted"] = len(enhanced_processor.tables)
        if extract_formulas:
            extracted_assets["formulas_extracted"] = len(enhanced_processor.formulas)

        doc.close()
        return extracted_assets

    except Exception as e:
        logger.error(f"Error in enhanced asset extraction: {str(e)}")
        return {"success": False, "error": str(e)}


def extract_formulas_dual_path(
    enhanced_processor: Any,
    page_math_blocks: Dict[int, List[str]],
    page_math_regions: Dict[int, List[MathRegion]],
    doc: Any,
    pdf_path: Path,
    start_page: int,
    end_page: int,
) -> None:
    """使用双路径策略提取公式。

    高保真路径：Docling CodeFormula（需安装可选依赖）
    降级路径：PyMuPDF 字体分析 + Unicode→LaTeX 映射
    """
    if not enhanced_processor:
        return

    if DoclingFormulaEnricher.is_available():
        try:
            logger.info("使用 Docling CodeFormula 模型提取公式")
            enricher = DoclingFormulaEnricher()
            docling_md = enricher.get_markdown_with_formulas(str(pdf_path))
            inject_docling_formulas(enhanced_processor, docling_md)
            return
        except Exception as e:
            logger.warning(f"Docling 公式提取失败，降级至 PyMuPDF 字体分析: {e}")

    logger.info("使用 PyMuPDF 字体分析提取公式")
    reconstructor = FormulaReconstructor()
    for page_num in range(start_page, end_page):
        try:
            page = doc[page_num]
            enhanced_blocks, regions = reconstructor.extract_formulas_from_page(
                page, page_num
            )
            if enhanced_blocks:
                page_math_blocks[page_num] = enhanced_blocks
            if regions:
                page_math_regions[page_num] = regions
                for i, region in enumerate(regions):
                    formula = ExtractedFormula(
                        id=enhanced_processor._generate_asset_id(
                            "formula", page_num, i
                        ),
                        latex=region.latex,
                        formula_type=region.formula_type,
                        page_number=page_num,
                        position=region.bbox,
                        description=f"Equation ({region.equation_number})"
                        if region.equation_number
                        else None,
                    )
                    enhanced_processor.formulas.append(formula)
        except Exception as e:
            logger.warning(f"PyMuPDF 公式提取失败 (page {page_num}): {e}")


def inject_docling_formulas(enhanced_processor: Any, docling_md: str) -> None:
    """从 Docling 输出的 Markdown 中提取公式，注入到 enhanced_processor。"""
    if not enhanced_processor or not docling_md:
        return

    block_pattern = re.compile(r"\$\$([\s\S]+?)\$\$")
    for i, match in enumerate(block_pattern.finditer(docling_md)):
        latex = match.group(1).strip()
        if latex:
            formula = ExtractedFormula(
                id=enhanced_processor._generate_asset_id("formula", 0, i),
                latex=latex,
                formula_type="block",
                description="Docling CodeFormula",
            )
            enhanced_processor.formulas.append(formula)

    inline_pattern = re.compile(r"(?<!\$)\$(?!\$)([^$]+?)\$(?!\$)")
    offset = len(enhanced_processor.formulas)
    for i, match in enumerate(inline_pattern.finditer(docling_md)):
        latex = match.group(1).strip()
        if latex and len(latex) > 1:
            formula = ExtractedFormula(
                id=enhanced_processor._generate_asset_id("formula", 0, offset + i),
                latex=latex,
                formula_type="inline",
                description="Docling CodeFormula",
            )
            enhanced_processor.formulas.append(formula)
