"""MCP tools package. Importing triggers @app.tool() registration."""

from ._registry import (  # noqa: F401
    app,
    web_scraper,
    markdown_converter,
    create_pdf_processor,
)

# Import tool modules to trigger @app.tool() decorator registration
from . import extraction  # noqa: F401
from . import markdown  # noqa: F401
from . import pdf  # noqa: F401
