from __future__ import annotations

import pytest

from negentropy.knowledge.content import extract_file_markdown, optimize_markdown_content


def test_optimize_markdown_content_normalizes_whitespace() -> None:
    raw = "line1  \r\n\r\n\r\nline2\t \r\n\r\n\r\n\r\nline3  "
    optimized = optimize_markdown_content(raw)

    assert optimized == "line1\n\nline2\n\nline3"


@pytest.mark.asyncio
async def test_extract_file_markdown_for_text_file() -> None:
    content = b"Hello  \r\n\r\n\r\nWorld  "

    markdown = await extract_file_markdown(
        content=content,
        filename="sample.txt",
        content_type="text/plain",
    )

    assert markdown == "Hello\n\nWorld"
