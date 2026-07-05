"""assembly 2.1 标题级联在 auto_batch 切片下的行为单测。

背景（ISSUE：auto_batch 切片首标题误判 h1）：assembly 的 ``_first_h1_seen``
是每次 assembly 调用的局部状态。auto_batch 下每个切片各跑一次 assembly，切片 >0
的首个标题（如 ``8.`` / ``4.2`` / ``References``）会被误当作「论文标题」升为 H1。

修复：``run_pdf_pipeline`` 把 ``slice_index`` 注入 ``PreprocessingInput.config``，
经 ``AssemblyInput.slice_index`` 传入 assembly；切片 >0 时预置 ``_first_h1_seen=True``，
所有标题统一走「后续下移一级」路径。
"""

import asyncio
from pathlib import Path

from negentropy.perceives.pipeline.models._pdf import (
    AssemblyInput,
    DocumentCharacteristics,
    PreprocessingOutput,
    TextBlock,
    TextExtractionOutput,
)
from negentropy.perceives.pipeline.stages.pdf.assembly import BuiltinAssembler


def _mk_input(blocks: list[TextBlock], slice_index: int) -> AssemblyInput:
    return AssemblyInput(
        preprocessing=PreprocessingOutput(
            local_path=Path("/tmp/x.pdf"),
            page_count=1,
            characteristics=DocumentCharacteristics(),
        ),
        text=TextExtractionOutput(blocks=blocks),
        slice_index=slice_index,
    )


def _heading(text: str, level: int, order: int, page: int = 0) -> TextBlock:
    # 给足够大的 bbox y 间距，保证 reading order = 视觉顺序
    return TextBlock(
        text=text,
        page_number=page,
        bbox=(50.0, 100.0 + order * 40.0, 500.0, 130.0 + order * 40.0),
        block_type="heading",
        heading_level=level,
        reading_order=order,
    )


def _run_assembly(blocks: list[TextBlock], slice_index: int) -> str:
    stage = BuiltinAssembler()
    result = asyncio.run(stage.execute(_mk_input(blocks, slice_index)))
    return result.output.markdown


def _heading_lines(md: str) -> list[str]:
    return [ln for ln in md.split("\n") if ln.lstrip().startswith("#")]


class TestSliceHeadingCascade:
    """切片 0 册封论文标题；切片 >0 不册封，统一下移一级。"""

    def test_slice0_coronates_first_h1_as_title(self) -> None:
        """切片 0：首个 H1 保持论文标题，后续标题下移一级。"""
        blocks = [
            _heading("Paper Title", 1, 0),
            _heading("1. Introduction", 1, 1),
            _heading("2.1. Setup", 2, 2),
        ]
        md = _run_assembly(blocks, slice_index=0)
        lines = _heading_lines(md)
        assert any(ln.startswith("# ") and "Paper Title" in ln for ln in lines)
        # 首个 H1 之后的 ``1. Introduction``（level 1）下移到 H2
        assert any(ln.startswith("## ") and "Introduction" in ln for ln in lines)
        # ``2.1. Setup``（level 2）下移到 H3
        assert any(ln.startswith("### ") and "Setup" in ln for ln in lines)

    def test_slice_gt0_does_not_coronate_first_heading(self) -> None:
        """切片 >0：首个标题不被升为 H1，统一下移一级（回归 ISSUE 核心）。"""
        blocks = [
            _heading("8. Measuring Self-Improvement", 1, 0),
            _heading("8.1. Why Evaluate", 2, 1),
        ]
        md = _run_assembly(blocks, slice_index=1)
        lines = _heading_lines(md)
        # 关键断言：切片首标题 ``8.`` 不得是 H1
        assert not any(ln.startswith("# ") and "Measuring" in ln for ln in lines), (
            f"切片 >0 首标题被误升 H1: {lines}"
        )
        # ``8.``（level 1）下移到 H2
        assert any(ln.startswith("## ") and "Measuring" in ln for ln in lines)
        # ``8.1``（level 2）下移到 H3
        assert any(ln.startswith("### ") and "Why Evaluate" in ln for ln in lines)

    def test_slice_gt0_level2_first_heading_not_promoted(self) -> None:
        """切片 >0：首标题为 H2（如 ``4.2``）时不被提升为 H1。"""
        blocks = [
            _heading("4.2. Memory Representation", 2, 0),
            _heading("4.2.1. Content Units", 3, 1),
        ]
        md = _run_assembly(blocks, slice_index=1)
        lines = _heading_lines(md)
        assert not any(
            ln.startswith("# ") and "Memory Representation" in ln for ln in lines
        ), f"切片 >0 的 H2 首标题被误升 H1: {lines}"
        # ``4.2``（level 2）下移到 H3
        assert any(
            ln.startswith("### ") and "Memory Representation" in ln for ln in lines
        )

    def test_references_heading_slice_gt0(self) -> None:
        """切片 >0：``References`` 单标题不被升为 H1。"""
        blocks = [_heading("References", 1, 0)]
        md = _run_assembly(blocks, slice_index=2)
        lines = _heading_lines(md)
        assert not any(
            ln.strip().startswith("# ") and "References" in ln for ln in lines
        ), f"References 被误升 H1: {lines}"

    def test_part_headings_normalized_to_h2(self) -> None:
        """``Part I. / Part IV.`` 顶层结构标题统一钉为 H2（跨切片赋级不一致修复）。"""
        # 切片 0：模拟 docling 给 Part I 赋 h4、Part 前有论文标题
        blocks = [
            _heading("Paper Title", 1, 0),
            _heading("Part I. Agents in the Era of Experience", 4, 1),
            _heading("1. Introduction", 1, 2),
        ]
        md = _run_assembly(blocks, slice_index=0)
        lines = _heading_lines(md)
        # Part I 统一为 H2
        assert any(ln.startswith("## ") and "Part I." in ln for ln in lines), (
            f"Part I 未归一为 H2: {lines}"
        )
        # 不应残留 H4 的 Part
        assert not any(ln.startswith("#### ") and "Part I." in ln for ln in lines)

    def test_part_heading_slice_gt0_normalized(self) -> None:
        """切片 >0 的 ``Part IV.``（源为 h3）也归一为 H2。"""
        blocks = [
            _heading("Part IV. Measurement, Safety, and Open Problems", 3, 0),
            _heading("8. Measuring", 1, 1),
        ]
        md = _run_assembly(blocks, slice_index=1)
        lines = _heading_lines(md)
        assert any(ln.startswith("## ") and "Part IV." in ln for ln in lines), (
            f"Part IV 未归一为 H2: {lines}"
        )

    def test_default_slice_index_zero_backward_compat(self) -> None:
        """未指定 slice_index（非分批路径）默认 0，保持既有册封行为。"""
        blocks = [
            _heading("Paper Title", 1, 0),
            _heading("1. Introduction", 1, 1),
        ]
        # 不传 slice_index → 默认 0
        stage = BuiltinAssembler()
        ai = AssemblyInput(
            preprocessing=PreprocessingOutput(
                local_path=Path("/tmp/x.pdf"),
                page_count=1,
                characteristics=DocumentCharacteristics(),
            ),
            text=TextExtractionOutput(blocks=blocks),
        )
        assert ai.slice_index == 0
        md = asyncio.run(stage.execute(ai)).output.markdown
        lines = _heading_lines(md)
        assert any(ln.startswith("# ") and "Paper Title" in ln for ln in lines)
