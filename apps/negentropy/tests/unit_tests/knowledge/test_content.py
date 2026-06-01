from __future__ import annotations

from negentropy.knowledge.ingestion.content import optimize_markdown_content


def test_optimize_markdown_content_normalizes_whitespace() -> None:
    raw = "line1  \r\n\r\n\r\nline2\t \r\n\r\n\r\n\r\nline3  "
    optimized = optimize_markdown_content(raw)

    assert optimized == "line1\n\nline2\n\nline3"
