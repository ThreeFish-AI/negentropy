from __future__ import annotations

import io
import re

import httpx
from bs4 import BeautifulSoup
from pypdf import PdfReader
from negentropy.logging import get_logger

logger = get_logger("negentropy.knowledge.content")


async def fetch_content(url: str) -> str:
    """Fetch and extract text content from a URL.

    Supports:
    - HTML: Extracts text, removing scripts/styles.
    - PDF: Extracts text from pages.
    - ArXiv: Auto-converts /abs/ URLs to /pdf/.
    """
    logger.info("fetch_content_started", url=url)

    # 1. Handle ArXiv URLs (convert /abs/ to /pdf/)
    # Example: https://arxiv.org/abs/2602.10109 -> https://arxiv.org/pdf/2602.10109.pdf
    arxiv_match = re.search(r"arxiv\.org/abs/(\d+\.\d+)", url)
    if arxiv_match:
        arxiv_id = arxiv_match.group(1)
        pdf_url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"
        logger.info("arxiv_url_converted", original=url, converted=pdf_url)
        url = pdf_url

    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
        try:
            response = await client.get(url)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            logger.error("fetch_content_failed", url=url, error=str(exc))
            raise ValueError(f"Failed to fetch URL: {exc}")

    content_type = response.headers.get("content-type", "").lower()
    logger.info("fetch_content_downloaded", url=url, content_type=content_type, size=len(response.content))

    # 2. Parse PDF
    if "application/pdf" in content_type or url.endswith(".pdf"):
        return _extract_pdf(response.content)

    # 3. Parse HTML (default)
    return _extract_html(response.text)


def _extract_pdf(content: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(content))
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n\n"
        return text.strip()
    except Exception as exc:
        logger.error("pdf_extraction_failed", error=str(exc))
        raise ValueError(f"Failed to extract text from PDF: {exc}")


def _extract_html(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")

    # Remove script and style elements
    for script in soup(["script", "style", "nav", "footer", "header"]):
        script.extract()

    # Get text
    text = soup.get_text(separator="\n")

    # Clean up whitespace
    lines = (line.strip() for line in text.splitlines())
    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
    text = "\n".join(chunk for chunk in chunks if chunk)

    return text
