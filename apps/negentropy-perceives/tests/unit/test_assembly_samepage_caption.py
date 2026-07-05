"""assembly 同页游离 caption 关联 + caption 分隔符 ``|`` 支持单测。

背景（ISSUE：Figure N | caption 与图片相隔远）：``Figure 8 | ...`` caption 与其
图片在阅读序中相隔约 90 行（中间夹章节标题），2.5.7 邻接搜索遇非 text 元素即中断，
够不到。修复：``_find_same_page_orphan_caption`` 在同页范围内为唯一 captionless
图片认领唯一游离 caption；且 caption 分隔符扩展支持 ``|`` / ``｜`` / ``∣``。
"""

import asyncio
from pathlib import Path

from negentropy.perceives.pipeline.models._pdf import (
    AssemblyInput,
    DocumentCharacteristics,
    ExtractedImage,
    ImageExtractionOutput,
    PreprocessingOutput,
    TextBlock,
    TextExtractionOutput,
)
from negentropy.perceives.pipeline.stages.pdf.assembly import (
    BuiltinAssembler,
    _is_figure_or_table_caption_text,
)


class TestCaptionSeparatorPipe:
    """caption 分隔符扩展：``Figure N |`` 也被识别为图注。"""

    def test_pipe_separator_recognized(self) -> None:
        assert _is_figure_or_table_caption_text("Figure 8 | Two-axis map of regimes.")

    def test_fullwidth_pipe_recognized(self) -> None:
        assert _is_figure_or_table_caption_text("Figure 3｜Full-width bar chart.")

    def test_colon_still_recognized(self) -> None:
        assert _is_figure_or_table_caption_text("Figure 1: Overview of the survey.")

    def test_prose_mention_not_caption(self) -> None:
        assert not _is_figure_or_table_caption_text(
            "This section discusses Figure 8 in the context of evolution."
        )


def _img_element(
    filename: str,
    page: int,
    caption: str | None,
    order: int,
    bbox: tuple[float, float, float, float] = (50.0, 60.0, 500.0, 400.0),
) -> ExtractedImage:
    return ExtractedImage(
        image_id=filename,
        filename=filename,
        page_number=page,
        bbox=bbox,
        caption=caption,
        width=602,
        height=388,
    )


def _run(images: list[ExtractedImage], blocks: list[TextBlock]) -> str:
    ai = AssemblyInput(
        preprocessing=PreprocessingOutput(
            local_path=Path("/tmp/x.pdf"),
            page_count=1,
            characteristics=DocumentCharacteristics(),
        ),
        text=TextExtractionOutput(blocks=blocks),
        images=ImageExtractionOutput(images=images, total_count=len(images)),
    )
    return asyncio.run(BuiltinAssembler().execute(ai)).output.markdown


class TestSamePageOrphanCaption:
    """同页游离 caption 关联到 captionless 图片（模拟 Figure 8 场景）。"""

    def test_far_caption_associated_to_captionless_image(self) -> None:
        """图在页首、caption 漂到远处（中间夹标题）→ 应关联进 img alt。"""
        img = _img_element("fig_p39_1.png", page=38, caption=None, order=0)
        blocks = [
            # 中间夹的章节标题（打断邻接搜索）
            TextBlock(
                text="WHAT EVOLVES?",
                page_number=38,
                bbox=(50, 120, 500, 150),
                block_type="heading",
                heading_level=1,
                reading_order=1,
            ),
            TextBlock(
                text="TaskAgent Content Assets",
                page_number=38,
                bbox=(50, 160, 500, 190),
                block_type="heading",
                heading_level=2,
                reading_order=2,
            ),
            # 游离 caption（同页，靠后）
            TextBlock(
                text=(
                    "Figure 8 | Two-axis map of post-deployment agentic AI "
                    "evolution regimes. Columns indicate what evolves."
                ),
                page_number=38,
                bbox=(50, 800, 500, 860),
                block_type="paragraph",
                reading_order=90,
            ),
        ]
        md = _run([img], blocks)
        # caption 被注入 img alt（HTML img 形式，因有 bbox 尺寸）
        assert 'alt="Figure 8 | Two-axis map' in md, md[:400]
        # 游离 caption 段落被 2.6 去重移除（不再作为独立正文段落重复出现）
        # 统计 "Figure 8 |" 出现次数：应仅在 alt 中出现 1 次
        assert md.count("Figure 8 | Two-axis map") == 1, (
            f"caption 未去重，出现 {md.count('Figure 8 | Two-axis map')} 次"
        )

    def test_two_captionless_images_same_page_not_matched(self) -> None:
        """同页 ≥2 张 captionless 图片 + caption 非邻接 → 同页兜底不认领（保守放弃）。

        中间夹标题使邻接兜底对两张图都失败，从而只考验同页兜底：该页有 2 张
        captionless 图片，无法确定 caption 归属 → 应放弃，alt 仍为文件名。
        """
        imgs = [
            _img_element(
                "fig_a.png",
                page=5,
                caption=None,
                order=0,
                bbox=(50.0, 60.0, 500.0, 300.0),
            ),
            _img_element(
                "fig_b.png",
                page=5,
                caption=None,
                order=1,
                bbox=(50.0, 320.0, 500.0, 560.0),
            ),
        ]
        blocks = [
            # 标题打断 fig_b 与 caption 的邻接（_figure_caption_to_inject 不认标题）
            TextBlock(
                text="Some Section Heading",
                page_number=5,
                bbox=(50, 600, 500, 630),
                block_type="heading",
                heading_level=2,
                reading_order=10,
            ),
            TextBlock(
                text="Figure 4 | Some caption text describing a figure.",
                page_number=5,
                bbox=(50, 800, 500, 850),
                block_type="paragraph",
                reading_order=50,
            ),
        ]
        md = _run(imgs, blocks)
        # 两张图都不应认领该 caption（alt 仍是文件名）
        assert 'alt="fig_a.png"' in md
        assert 'alt="fig_b.png"' in md

    def test_captioned_image_not_overwritten(self) -> None:
        """已有 caption 的图片不被同页游离 caption 覆盖。"""
        img = _img_element("fig_c.png", page=7, caption="Figure 5 | Existing.", order=0)
        blocks = [
            TextBlock(
                text="Figure 6 | A different orphan caption on same page.",
                page_number=7,
                bbox=(50, 800, 500, 850),
                block_type="paragraph",
                reading_order=50,
            ),
        ]
        md = _run([img], blocks)
        assert 'alt="Figure 5 | Existing.' in md
