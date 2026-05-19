"""回归测试：``parse_pdf_to_markdown`` 必须保留首页内容。

历史问题：commit e94d2dc 将 ``assembly`` 排序键从 ``(page, reading_order)`` 改为
``(page, y0)`` 后，多处隐藏的页码错位（Docling 1-based vs PyMuPDF 0-based、
``DoclingTextExtractor`` 硬编码 ``page=0``、Docling BBox BottomLeft vs PyMuPDF
TopLeft）被同时放大，导致 ``assets/2603.05344v3.pdf`` 输出 Markdown 头部丢失了
标题、作者、Abstract 与「1 Introduction」开头，第二页的「Figure 1: Overview of
OPENBOX」反而出现在文档最前。

本测试调用真实的 ``run_pdf_pipeline``（不打桩），断言关键首页文本仍出现在
合理位置，并且第二页图注晚于标题与 Introduction 出现。
"""

from __future__ import annotations

from pathlib import Path

import pytest

from negentropy.perceives.pdf.engines.docling import DoclingEngine
from negentropy.perceives.pipeline.convenience import run_pdf_pipeline

ASSETS_DIR = Path(__file__).resolve().parents[2] / "assets"
ARXIV_PDF = ASSETS_DIR / "2603.05344v3.pdf"


pytestmark = [
    pytest.mark.slow,
    pytest.mark.integration,
    pytest.mark.skipif(
        not ARXIV_PDF.exists(),
        reason=f"测试 PDF 不存在：{ARXIV_PDF}",
    ),
    pytest.mark.skipif(
        not DoclingEngine.is_available(),
        reason="需要安装 docling 可选依赖（uv sync --extra all-engines）",
    ),
]


@pytest.mark.asyncio
async def test_first_page_content_precedes_page_two_caption() -> None:
    """首页（标题/作者/摘要/Introduction）必须出现在第二页 Figure 1 之前。"""
    result = await run_pdf_pipeline(str(ARXIV_PDF))
    assert result.success, f"管线执行失败：{result.error}"
    md = result.markdown or ""
    assert md, "管线返回空 Markdown"

    head_500 = md[:500]
    head_1500 = md[:1500]

    assert "Building Effective AI Coding Agents" in head_500, (
        f"首 500 字符未包含标题；实际内容：{head_500!r}"
    )

    abstract_visible = (
        "Abstract" in head_1500 or "The landscape of AI coding assistance" in head_1500
    )
    assert abstract_visible, (
        f"首 1500 字符未包含 Abstract 关键句；实际：{head_1500[:300]!r}"
    )

    intro_idx = md.find("1 Introduction")
    if intro_idx == -1:
        intro_idx = md.find("Introduction")
    fig1_idx = md.find("Figure 1")
    title_idx = md.find("Building Effective AI Coding Agents")

    assert title_idx >= 0, "Markdown 中未找到论文标题"
    assert intro_idx >= 0, "Markdown 中未找到 Introduction 章节"
    assert fig1_idx >= 0, "Markdown 中未找到 Figure 1 引用（无法验证页序）"
    assert title_idx < intro_idx, (
        f"标题（idx={title_idx}）必须出现在 Introduction（idx={intro_idx}）之前"
    )
    assert intro_idx < fig1_idx, (
        f"Introduction（idx={intro_idx}）必须出现在 Figure 1（idx={fig1_idx}）之前"
    )

    overview_idx = md.find("Overview of OPENBOX")
    if overview_idx >= 0:
        assert title_idx < overview_idx, (
            "第二页『Figure 1: Overview of OPENBOX』必须晚于标题出现"
        )
