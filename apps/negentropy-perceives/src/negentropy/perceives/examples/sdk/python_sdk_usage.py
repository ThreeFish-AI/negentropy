#!/usr/bin/env python3
"""negentropy-perceives Python SDK usage examples."""

import asyncio
import json

from negentropy.perceives.sdk import NegentropyPerceivesClient


async def main() -> None:
    """Demonstrate the project SDK against a local HTTP endpoint."""
    async with NegentropyPerceivesClient("http://127.0.0.1:2992/mcp") as client:
        tools = await client.list_tools()
        print(f"Registered tools: {len(tools)}")

        result = await client.parse_webpage_to_markdown(
            url="https://example.com",
            method="simple",
            extract_main_content=True,
        )
        print(json.dumps(result, indent=2, ensure_ascii=False, default=str))


if __name__ == "__main__":
    asyncio.run(main())
