"""Resolve MCP server configs from project-level ``.mcp.json`` files.

Claude Code natively discovers MCP servers from ``.mcp.json`` in the working
directory and ``~/.claude/``.  The Negentropy system API only knows about
DB-registered servers (``mcp_servers`` table).  This module bridges the gap
by parsing ``.mcp.json`` and producing lightweight dicts that can be merged
into the API response.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


def read_mcp_json(project_path: str | None) -> dict[str, dict[str, Any]]:
    """Read ``.mcp.json`` from *project_path* and return ``{name: config}``.

    Returns an empty dict when:
    - *project_path* is ``None`` or empty
    - ``.mcp.json`` does not exist
    - the file is malformed JSON or missing ``mcpServers``
    """
    if not project_path:
        return {}

    mcp_json_path = Path(project_path) / ".mcp.json"
    if not mcp_json_path.is_file():
        return {}

    try:
        data = json.loads(mcp_json_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        logger.warning("mcp_json_read_failed", path=str(mcp_json_path), error=str(exc))
        return {}

    servers: dict[str, dict[str, Any]] = data.get("mcpServers", {})
    if not isinstance(servers, dict):
        return {}

    return servers


def derive_transport_type(config: dict[str, Any]) -> str:
    """Derive MCP transport type from a ``.mcp.json`` server config entry.

    Priority:
    1. Explicit ``"type"`` field (``http`` / ``sse`` / ``stdio``)
    2. Presence of ``"url"`` → ``http`` (or ``sse`` if URL path ends with ``/sse``)
    3. Fallback → ``stdio``
    """
    explicit = config.get("type")
    if explicit in ("http", "sse", "stdio"):
        return explicit
    if config.get("url"):
        url: str = config.get("url", "")
        return "sse" if "/sse" in url else "http"
    return "stdio"
