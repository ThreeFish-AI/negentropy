"""Negentropy Perceives MCP Server - A robust web scraping MCP server."""

import importlib.metadata
import re
import tomllib
from pathlib import Path

_DIST_NAME = "negentropy-perceives"

_DEFAULTS: dict[str, str] = {
    "name": _DIST_NAME,
    "version": "0.0.0",
    "author": "Unknown",
    "email": "",
}


def _load_project_metadata() -> dict[str, str]:
    """从 pyproject.toml 或已安装包的元数据中加载项目信息。

    采用两层回退策略：
    1. 开发环境：直接用 tomllib 解析 pyproject.toml
    2. 生产环境（已安装包）：通过 importlib.metadata 获取
    3. 终极兜底：返回预定义默认值
    """
    # ── Layer 1: pyproject.toml（开发环境优先） ──
    try:
        pyproject_path = (
            Path(__file__).resolve().parent.parent.parent.parent / "pyproject.toml"
        )
        if pyproject_path.exists():
            with pyproject_path.open("rb") as f:
                data = tomllib.load(f)

            project = data.get("project", {})
            authors = project.get("authors", [])
            first_author = authors[0] if authors else {}

            return {
                "name": project.get("name", _DEFAULTS["name"]),
                "version": project.get("version", _DEFAULTS["version"]),
                "author": first_author.get("name", _DEFAULTS["author"]),
                "email": first_author.get("email", _DEFAULTS["email"]),
            }
    except (FileNotFoundError, PermissionError, OSError, tomllib.TOMLDecodeError):
        pass

    # ── Layer 2: importlib.metadata（已安装包） ──
    try:
        meta = importlib.metadata.metadata(_DIST_NAME)
        version = meta["Version"] or _DEFAULTS["version"]
        name = meta["Name"] or _DEFAULTS["name"]

        author = _DEFAULTS["author"]
        email = _DEFAULTS["email"]
        author_email_raw = meta.get("Author-email", "")
        if author_email_raw:
            m = re.match(r"^(.+?)\s*<(.+?)>$", author_email_raw.strip())
            if m:
                author, email = m.group(1).strip(), m.group(2).strip()
            else:
                author = author_email_raw.strip()

        if author == _DEFAULTS["author"]:
            author = meta.get("Author", "") or _DEFAULTS["author"]

        return {
            "name": name,
            "version": version,
            "author": author,
            "email": email,
        }
    except importlib.metadata.PackageNotFoundError:
        pass

    # ── Layer 3: 终极兜底 ──
    return dict(_DEFAULTS)


_metadata = _load_project_metadata()

__version__: str = _metadata["version"]
__app_name__: str = _metadata["name"]
__author__: str = _metadata["author"]
__email__: str = _metadata["email"]

__all__ = [
    "__version__",
    "__app_name__",
]
