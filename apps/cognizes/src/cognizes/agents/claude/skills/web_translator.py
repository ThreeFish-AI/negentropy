"""Web page content extraction and structured text conversion."""

import logging
import re
from typing import Any

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


async def handle_web_translator(params: dict[str, Any]) -> dict[str, Any]:
    """Fetch a web page, extract main content, and convert to structured text.

    Args:
        params: Dictionary containing:
            - url: URL of the web page to extract

    Returns:
        Dictionary with success/content/metadata/assets/statistics.
    """
    url = params.get("url")
    if not url:
        return {
            "success": False,
            "error": "No url provided",
            "error_type": "ValueError",
        }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, follow_redirects=True)
            response.raise_for_status()
            html_content = response.text

        # Parse HTML
        soup = BeautifulSoup(html_content, "html.parser")

        # Remove non-content elements
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()

        # Extract metadata
        title_tag = soup.find("title")
        title = title_tag.get_text().strip() if title_tag else ""

        description_meta = soup.find("meta", attrs={"name": "description"})
        description = description_meta.get("content", "") if description_meta else ""

        # Locate main content area
        main_content = (
            soup.find("main")
            or soup.find("article")
            or soup.find("div", class_=re.compile(r"content|main|article", re.I))
        )
        if not main_content:
            main_content = soup.find("body") or soup

        # Build structured text
        content_parts: list[str] = []

        if title:
            content_parts.append(f"# {title}\n")
        if description:
            content_parts.append(f"*{description}*\n\n")

        for element in main_content.find_all(
            ["h1", "h2", "h3", "h4", "h5", "h6", "p", "ul", "ol", "blockquote", "pre"]
        ):
            tag_name = element.name

            if tag_name in ("h1", "h2", "h3", "h4", "h5", "h6"):
                level = int(tag_name[1])
                content_parts.append(f"\n{'#' * level} {element.get_text().strip()}\n")

            elif tag_name == "p":
                text = element.get_text().strip()
                if text:
                    content_parts.append(f"{text}\n")

            elif tag_name in ("ul", "ol"):
                items = [f"- {li.get_text().strip()}" for li in element.find_all("li", recursive=False)]
                content_parts.append(f"\n{chr(10).join(items)}\n")

            elif tag_name == "blockquote":
                text = element.get_text().strip()
                if text:
                    content_parts.append(f"\n> {text}\n")

            elif tag_name == "pre":
                content_parts.append(f"\n```\n{element.get_text()}\n```\n")

        # Extract external links
        links: list[dict[str, str]] = []
        for link in soup.find_all("a", href=True):
            href = link["href"]
            if isinstance(href, str) and href.startswith("http"):
                links.append({"text": link.get_text().strip(), "url": href})

        full_content = "\n".join(content_parts)

        return {
            "success": True,
            "content": full_content,
            "metadata": {
                "title": title,
                "description": description,
                "url": url,
            },
            "assets": {
                "links": links[:10],
            },
            "statistics": {
                "total_words": len(full_content.split()),
                "total_paragraphs": len([p for p in full_content.split("\n\n") if p.strip()]),
            },
        }

    except Exception as e:
        logger.error(f"Error processing web page {url}: {str(e)}")
        return {
            "success": False,
            "error": f"Failed to process web page: {str(e)}",
            "error_type": type(e).__name__,
        }
