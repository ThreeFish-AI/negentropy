"""YAML 配置工具函数（展平 / 深度合并 / 文件加载）。

从 config.py 拆分而来，职责单一：YAML 字典的变换与 I/O。
"""

import logging
from pathlib import Path
from typing import Any, Dict, Optional

import yaml

logger = logging.getLogger(__name__)

# 不展平的顶层键集合（嵌套结构体直接透传）
_NO_FLATTEN_KEYS = frozenset({"pipeline"})


def _flatten_nested_yaml(data: Dict[str, Any], prefix: str = "") -> Dict[str, Any]:
    """将嵌套 YAML 字典递归展平为以 ``_`` 连接的扁平键。"""
    nested: Dict[str, Any] = {}
    flat: Dict[str, Any] = {}
    for key, value in data.items():
        full_key = f"{prefix}{key}" if prefix else key
        if not prefix and key in _NO_FLATTEN_KEYS:
            flat[full_key] = value
        elif isinstance(value, dict):
            nested.update(_flatten_nested_yaml(value, prefix=f"{full_key}_"))
        else:
            flat[full_key] = value
    nested.update(flat)
    return nested


def deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    """递归深度合并两个字典。"""
    result = base.copy()
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        elif value is not None:
            result[key] = value
    return result


def _merge_named_list(base: list, override: list, key: str = "name") -> list:
    """按 ``key`` 字段匹配合并两个对象列表。"""
    base_by_name: Dict[str, Dict[str, Any]] = {
        item[key]: item for item in base if isinstance(item, dict) and key in item
    }
    result: list = []
    seen: set = set()

    for item in override:
        if not isinstance(item, dict) or key not in item:
            result.append(item)
            continue
        name = item[key]
        if name in base_by_name:
            result.append(deep_merge(base_by_name[name], item))
        else:
            result.append(item)
        seen.add(name)

    for item in base:
        if isinstance(item, dict) and key in item:
            name = item[key]
            if name not in seen:
                result.append(item)

    return result


def _get_stages(data: Dict[str, Any], pipeline_name: str) -> Optional[list]:
    """从配置字典中安全提取 pipeline stages 数组。"""
    try:
        return data.get("pipeline", {}).get(pipeline_name, {}).get("stages")
    except (AttributeError, TypeError):
        return None


def _set_stages(data: Dict[str, Any], pipeline_name: str, stages: list) -> None:
    """将合并后的 stages 写回配置字典。"""
    pipeline = data.setdefault("pipeline", {})
    pipe_cfg = pipeline.setdefault(pipeline_name, {})
    pipe_cfg["stages"] = stages


def _load_bundled_yaml() -> Dict[str, Any]:
    """加载内置默认 YAML 配置（打包在 wheel 内）。"""
    from importlib import resources

    bundled_path = resources.files(__package__).joinpath("config.default.yaml")
    if not bundled_path.is_file():
        raise FileNotFoundError(
            f"Bundled config not found: {bundled_path}. "
            "Ensure config.default.yaml is included in package_data."
        )
    with bundled_path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def _get_user_config_path() -> Path:
    """获取用户配置文件的标准路径。"""
    return Path.home() / ".negentropy" / "perceives.config.yaml"


def _load_yaml_file(path: Path) -> Optional[Dict[str, Any]]:
    """安全加载 YAML 文件。"""
    if not path.is_file():
        return None
    try:
        with path.open("r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except (yaml.YAMLError, OSError) as exc:
        logger.warning("加载配置文件失败 %s: %s", path, exc)
        return None
