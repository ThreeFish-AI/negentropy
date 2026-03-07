from uuid import uuid4

import pytest

from negentropy.knowledge.extraction import (
    ROUTE_FILE_PDF,
    ROUTE_URL,
    extract_source,
    resolve_source_kind,
    resolve_targets,
)


def test_resolve_source_kind_for_url_and_pdf() -> None:
    assert resolve_source_kind(source_uri="https://example.com/doc") == ROUTE_URL
    assert resolve_source_kind(filename="report.pdf") == ROUTE_FILE_PDF
    assert resolve_source_kind(content_type="application/pdf") == ROUTE_FILE_PDF


def test_resolve_targets_sorts_and_filters_invalid_items() -> None:
    server_id = str(uuid4())
    targets = resolve_targets(
        {
            "extractor_routes": {
                "url": {
                    "targets": [
                        {"server_id": server_id, "tool_name": "secondary", "priority": 2},
                        {"server_id": server_id, "tool_name": "primary", "priority": 1},
                        {"server_id": "", "tool_name": "ignored"},
                    ]
                }
            }
        },
        ROUTE_URL,
    )

    assert [item.tool_name for item in targets] == ["primary", "secondary"]


@pytest.mark.asyncio
async def test_extract_source_uses_legacy_provider_without_routes(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_extract_url(self, *, url: str):  # type: ignore[no-untyped-def]
        from negentropy.knowledge.extraction import ExtractedDocumentResult

        return ExtractedDocumentResult(
            plain_text="legacy text",
            markdown_content="legacy markdown",
        )

    monkeypatch.setattr(
        "negentropy.knowledge.extraction.LegacyExtractionProvider.extract_url",
        fake_extract_url,
    )

    result = await extract_source(
        app_name="negentropy",
        corpus_id=uuid4(),
        corpus_config={},
        source_kind=ROUTE_URL,
        url="https://example.com",
    )

    assert result.plain_text == "legacy text"
    assert result.markdown_content == "legacy markdown"
    assert result.trace["provider"] == "legacy"
