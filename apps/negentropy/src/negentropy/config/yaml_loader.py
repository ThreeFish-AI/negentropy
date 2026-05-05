"""
YAML Configuration Loader.

Implements layered YAML configuration loading with deep merge semantics.

Priority order (lowest → highest):
    1. config.default.yaml  (package defaults, shipped with wheel)
    2. ~/.negentropy/config.yaml  (user-level overrides)
    3. NE_CONFIG_PATH env var  (CLI-specified custom config, cross-process)
    4. config.local.yaml  (runtime overrides, cwd-relative, gitignored)
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

import yaml

# ---------------------------------------------------------------------------
# Well-known paths
# ---------------------------------------------------------------------------

USER_CONFIG_DIR = Path.home() / ".negentropy"
USER_CONFIG_FILE = USER_CONFIG_DIR / "config.yaml"

LOCAL_CONFIG_FILENAME = "config.local.yaml"


def get_local_config_path() -> Path:
    """运行时配置文件路径（cwd 下，gitignored，存放机密与 per-deployment 覆盖）。"""
    return Path.cwd() / LOCAL_CONFIG_FILENAME


# ---------------------------------------------------------------------------
# Path resolution
# ---------------------------------------------------------------------------


def get_default_config_path() -> Path:
    """
    Resolve the path to ``config.default.yaml`` shipped with the package.

    Uses ``__file__`` relative path for reliable access in both editable-install
    and wheel-installed modes.
    """
    return Path(__file__).parent / "config.default.yaml"


def get_yaml_file_paths() -> list[Path]:
    """
    Return ordered list of YAML config paths to load (lowest priority first).
    Only returns paths that exist on disk.
    """
    paths: list[Path] = []

    # 1. Package default (always present)
    default_path = get_default_config_path()
    if default_path.is_file():
        paths.append(default_path)

    # 2. User-level config
    if USER_CONFIG_FILE.is_file():
        paths.append(USER_CONFIG_FILE)

    # 3. CLI-specified config via env var (cross-process propagation)
    cli_config = os.getenv("NE_CONFIG_PATH")
    if cli_config:
        cli_path = Path(cli_config).resolve()
        if cli_path.is_file():
            paths.append(cli_path)

    # 4. Runtime local config (cwd-relative, gitignored, highest YAML priority)
    local_path = get_local_config_path()
    if local_path.is_file():
        paths.append(local_path)

    return paths


# ---------------------------------------------------------------------------
# Deep merge
# ---------------------------------------------------------------------------


def deep_merge(base: dict, override: dict) -> dict:
    """
    Recursively merge *override* into *base*.

    - dict values are merged recursively.
    - All other types are replaced by *override*.
    - Neither input dict is mutated.
    """
    result = base.copy()
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result


# ---------------------------------------------------------------------------
# Merged config loader
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def load_merged_yaml_config() -> dict:
    """
    Load and deep-merge all discovered YAML config files.

    Cached via :func:`lru_cache` to guarantee single-load semantics,
    matching the ``Settings`` singleton pattern.
    """
    merged: dict = {}
    for path in get_yaml_file_paths():
        try:
            with open(path, encoding="utf-8") as fh:
                data = yaml.safe_load(fh) or {}
            merged = deep_merge(merged, data)
        except (OSError, yaml.YAMLError):
            # Graceful degradation: skip unreadable files
            pass
    return merged


def reset_cache() -> None:
    """Clear the merged-config cache.  Intended for test teardown only."""
    load_merged_yaml_config.cache_clear()
