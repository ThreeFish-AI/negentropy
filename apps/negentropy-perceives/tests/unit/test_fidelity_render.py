"""_fidelity_render 单测 — markdown_to_html 纯函数（无浏览器/无 fitz/无 DB）。"""

from __future__ import annotations

from negentropy.perceives.tools._fidelity_render import markdown_to_html


def test_markdown_to_html_wraps_in_template():
    html = markdown_to_html("# Title\n正文", title="t", width=800)
    assert html.startswith("<!DOCTYPE html>")
    assert "<body>" in html
    assert "800px" in html  # width 注入
    assert "katex" in html.lower()  # KaTeX 资源引用


def test_markdown_to_html_table_and_code():
    md = "| A | B |\n|---|---|\n| 1 | 2 |\n\n```python\nprint('hi')\n```\n$E=mc^2$\n"
    html = markdown_to_html(md)
    # 内容透传（无论 markdown 库在位走渲染、还是回退 <pre>，原文都应保留）
    assert "A" in html and "B" in html
    assert "print" in html
    assert "E=mc^2" in html  # 数学原文保留（KaTeX 经 JS 渲染）


def test_markdown_to_html_empty():
    html = markdown_to_html("")
    assert "<body>" in html  # 模板仍完整
