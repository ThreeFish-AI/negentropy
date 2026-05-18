"""配置加载与合并逻辑。

从 config.py 拆分而来，职责单一：配置发现、合并与全局单例管理。
"""

import logging
from pathlib import Path
from typing import Any, Dict, Optional

from pydantic_settings import PydanticBaseSettingsSource

from ._config_yaml import (
    deep_merge,
    _flatten_nested_yaml,
    _get_stages,
    _get_user_config_path,
    _load_bundled_yaml,
    _load_yaml_file,
    _merge_named_list,
    _set_stages,
)

logger = logging.getLogger(__name__)

# 模块级缓存：用户 YAML 配置数据（不含 bundled 默认值）
_user_yaml_data: Dict[str, Any] = {}

# CLI 覆盖路径缓存（由 reload_settings 设置）
_config_path_override: Optional[str] = None


class _UserYamlConfigSource(PydanticBaseSettingsSource):
    """自定义配置源：将合并后的 YAML 配置数据注入 pydantic-settings 优先级链。"""

    def __call__(self) -> Dict[str, Any]:
        """返回合并后的 YAML 配置数据。"""
        return dict(_user_yaml_data)

    def get_field_value(  # type: ignore[override]
        self,
        field: Any,
        field_name: str,
    ) -> tuple[Any, str | None, bool]:
        """满足抽象方法协议（实际值已通过 __call__() 提供）。"""
        return None, None, False


def _prepare_user_yaml(
    *,
    config_path: Optional[str] = None,
) -> Dict[str, Any]:
    """加载并合并配置：内置默认 ← 用户 YAML（深度合并）。"""
    global _user_yaml_data

    bundled_dict = _load_bundled_yaml()

    effective_path = config_path or _config_path_override
    if effective_path:
        user_path = Path(effective_path).expanduser().resolve()
    else:
        user_path = _get_user_config_path()

    user_dict = _load_yaml_file(user_path) or {}

    merged = deep_merge(bundled_dict, user_dict)

    for pipeline_name in ("pdf", "webpage"):
        base_stages = _get_stages(bundled_dict, pipeline_name)
        user_stages = _get_stages(user_dict, pipeline_name)
        if base_stages is not None and user_stages is not None:
            merged_stages = _merge_named_list(base_stages, user_stages)
            _set_stages(merged, pipeline_name, merged_stages)

    merged = _flatten_nested_yaml(merged)
    _user_yaml_data = merged
    return merged


def build_settings(
    *,
    config_path: Optional[str] = None,
):
    """构建配置实例。"""
    from .config import NegentropyPerceivesSettings

    if config_path:
        user_dict = _prepare_user_yaml(config_path=config_path)
        if user_dict:
            return NegentropyPerceivesSettings(**user_dict)
        return NegentropyPerceivesSettings()
    else:
        _prepare_user_yaml(config_path=None)
        return NegentropyPerceivesSettings()


def reload_settings(
    *,
    config_path: Optional[str] = None,
):
    """重建全局配置单例。"""
    from . import config as _config_module

    global _config_path_override
    _config_path_override = config_path
    new_settings = build_settings(config_path=config_path)
    _config_module.settings = new_settings
    return new_settings


def describe_config_sources(
    *,
    config_path: Optional[str] = None,
) -> str:
    """报告配置来源详情。"""
    sources: list[str] = []
    sources.append("bundled-default(config.default.yaml)")

    effective_path = config_path or _config_path_override
    if effective_path:
        p = Path(effective_path).expanduser().resolve()
        label = (
            f"custom-config({p})" if p.is_file() else f"custom-config({p}, not found)"
        )
        sources.append(label)
    else:
        standard_path = _get_user_config_path()
        if standard_path.is_file():
            sources.append(f"user-config({standard_path})")

    if len(sources) == 1:
        return "Using bundled defaults (config.default.yaml) and environment variables"

    return f"Loaded: {', '.join(sources)}"
