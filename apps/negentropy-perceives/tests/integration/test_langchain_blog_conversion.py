#!/usr/bin/env python3
"""Integration test for LangChain blog conversion to verify paragraph formatting."""

import pytest
import tempfile
from negentropy.perceives.scraping import WebScraper
from negentropy.perceives.markdown.converter import MarkdownConverter


@pytest.mark.requires_network
@pytest.mark.asyncio
async def test_langchain_blog_conversion():
    """Test conversion of the LangChain blog with different methods."""
    url = "https://blog.langchain.com/context-engineering-for-agents/"

    scraper = WebScraper()
    converter = MarkdownConverter()

    print(f"Testing URL: {url}")
    print("=" * 80)

    # Test with different scraping methods
    methods = ["simple", "scrapy", "selenium"]

    for method in methods:
        print(f"\n🔍 Testing with method: {method}")
        print("-" * 40)

        try:
            scrape_result = await scraper.scrape_url(url=url, method=method)

            if "error" in scrape_result:
                print(f"❌ Scraping failed: {scrape_result['error']}")
                continue

            # Show what we got from scraping
            content = scrape_result.get("content", {})
            print(f"Content keys: {list(content.keys())}")

            html_content = content.get("html", "")
            text_content = content.get("text", "")

            print(f"HTML length: {len(html_content) if html_content else 0}")
            print(f"Text length: {len(text_content) if text_content else 0}")

            # Convert to Markdown
            result = converter.convert_webpage_to_markdown(
                scrape_result=scrape_result,
                extract_main_content=True,
                include_metadata=True,
            )

            if result.get("success", False):
                markdown = result.get("markdown", "")
                lines = markdown.split("\n")
                empty_lines = [i for i, line in enumerate(lines) if line.strip() == ""]

                print("✅ Conversion successful!")
                print(f"   Total lines: {len(lines)}")
                print(f"   Empty lines: {len(empty_lines)}")
                print(f"   Total chars: {len(markdown)}")

                # Show first few lines to check structure
                print("\nFirst 10 lines:")
                for i, line in enumerate(lines[:10]):
                    print(f"  {i:2d}: {repr(line[:80])}")

                # Save to temp file for inspection
                with tempfile.NamedTemporaryFile(
                    mode="w",
                    suffix=f"_langchain_blog_{method}.md",
                    delete=False,
                    encoding="utf-8",
                ) as f:
                    f.write(markdown)
                    filename = f.name
                print(f"💾 Saved to {filename}")

                # Check if it looks properly formatted
                if len(empty_lines) > 10 and len(lines) > 50:
                    print("✅ Appears to have proper paragraph structure!")
                else:
                    print("❌ Still appears to be poorly formatted")

                # Show a sample middle section
                if len(lines) > 50:
                    print("\nSample from middle (lines 25-35):")
                    for i in range(25, min(35, len(lines))):
                        print(f"  {i:2d}: {repr(lines[i][:80])}")

            else:
                print(f"❌ Conversion failed: {result.get('error')}")

        except Exception as e:
            print(f"❌ Error with {method}: {str(e)}")

    print("\n🏁 Testing complete!")


if __name__ == "__main__":
    import asyncio

    asyncio.run(test_langchain_blog_conversion())
