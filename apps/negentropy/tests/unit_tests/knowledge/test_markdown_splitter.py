"""Markdown 翻译切分器单测 — join==原文不变式 + 原子块语义。

覆盖：
1. 任意切分结果满足 ``"".join(chunks) == text``（CRLF / 无尾换行 / 空文）；
2. fenced code（```/~~~、嵌套、未闭合、4+ backticks）永不被切开；
3. 文首 front-matter / 连续表格行原子；
4. 普通段落按 max_chars 贪心打包，超长段落按行边界降级；
5. 超限原子块整体放行（独占超限 chunk）。
"""

from __future__ import annotations

import pytest

from negentropy.knowledge.translation.splitter import Block, scan_blocks, split_markdown

FIXTURE_DOC = """---
title: Demo
---

# Heading One

This is the first paragraph with some prose that should be translated.

```python
def hello():
    return "world"  # comment stays verbatim
```

Second paragraph after the code block.

| col_a | col_b |
| ----- | ----- |
| 1     | 2     |

Final paragraph.
"""


def _assert_join_invariant(text: str, max_chars: int = 6000) -> list[str]:
    chunks = split_markdown(text, max_chars=max_chars)
    assert "".join(chunks) == text
    return chunks


def test_join_invariant_fixture_doc():
    _assert_join_invariant(FIXTURE_DOC)


def test_join_invariant_no_trailing_newline():
    _assert_join_invariant("# Title\n\nparagraph without trailing newline")


def test_join_invariant_crlf():
    _assert_join_invariant("# Title\r\n\r\nfirst paragraph\r\n\r\nsecond paragraph\r\n")


def test_empty_text_returns_empty():
    assert split_markdown("") == []


def test_invalid_max_chars_raises():
    with pytest.raises(ValueError):
        split_markdown("x", max_chars=0)


def test_fence_block_is_atomic():
    fence = "```python\n" + ("x = 1\n" * 50) + "```\n"
    text = "intro paragraph\n\n" + fence + "\noutro paragraph\n"
    chunks = _assert_join_invariant(text, max_chars=80)
    # fence 整体落在某一个 chunk 内（不被切开）
    assert any(fence in chunk for chunk in chunks)


def test_tilde_fence_with_nested_backticks_is_atomic():
    fence = "~~~markdown\n```python\ninner = True\n```\n~~~\n"
    text = "before\n\n" + fence + "\nafter\n"
    chunks = _assert_join_invariant(text, max_chars=30)
    assert any(fence in chunk for chunk in chunks)


def test_unclosed_fence_extends_to_eof():
    text = "paragraph\n\n```python\nunclosed = True\nstill code\n"
    blocks = scan_blocks(text)
    assert blocks[-1].kind == "code"
    assert blocks[-1].text.endswith("still code\n")
    _assert_join_invariant(text, max_chars=10)


def test_longer_close_fence_accepted():
    # 4+ backticks 闭栏长度 ≥ 开栏即合法
    text = "```\ncode\n`````\n\ntail\n"
    blocks = scan_blocks(text)
    code = [b for b in blocks if b.kind == "code"]
    assert len(code) == 1
    assert "`````" in code[0].text


def test_front_matter_atomic():
    blocks = scan_blocks(FIXTURE_DOC)
    assert blocks[0].kind == "front_matter"
    assert blocks[0].text.startswith("---\ntitle: Demo\n---\n")


def test_table_rows_grouped_atomic():
    blocks = scan_blocks(FIXTURE_DOC)
    tables = [b for b in blocks if b.kind == "table"]
    assert len(tables) == 1
    assert tables[0].text.count("|") >= 6


def test_paragraphs_packed_within_max_chars():
    paragraphs = "\n\n".join(f"paragraph number {i} with several words" for i in range(20))
    chunks = _assert_join_invariant(paragraphs, max_chars=120)
    assert len(chunks) > 1
    assert all(len(chunk) <= 120 for chunk in chunks)


def test_oversize_paragraph_split_at_line_boundary():
    big_paragraph = "\n".join(f"line {i} of one huge paragraph" for i in range(40))
    chunks = _assert_join_invariant(big_paragraph, max_chars=100)
    assert len(chunks) > 1
    # 行边界切分：每个 chunk 要么以换行结束，要么是文末
    for chunk in chunks[:-1]:
        assert chunk.endswith("\n")


def test_oversize_atomic_fence_allowed_over_limit():
    fence = "```\n" + ("data line\n" * 30) + "```\n"
    chunks = _assert_join_invariant(fence, max_chars=50)
    assert any(len(chunk) > 50 for chunk in chunks)
    assert any(fence in chunk for chunk in chunks)


def test_block_dataclass_atomic_property():
    assert Block("```\nx\n```\n", "code").atomic
    assert Block("---\na: 1\n---\n", "front_matter").atomic
    assert Block("| a |\n", "table").atomic
    assert not Block("plain\n", "text").atomic
    assert not Block("\n", "blank").atomic
