"""
YAML Section Injection Infrastructure.

Provides :class:`YamlDictSource` — a custom :class:`PydanticBaseSettingsSource`
that feeds pre-parsed YAML data into sub-settings as a *low-priority* source,
ensuring the canonical priority chain:

    init > env vars > YAML chain > field defaults
"""

from __future__ import annotations

from typing import Any

from pydantic.fields import FieldInfo
from pydantic_settings import BaseSettings, PydanticBaseSettingsSource

# ---------------------------------------------------------------------------
# Section registry (module-level state)
# ---------------------------------------------------------------------------

_yaml_section_data: dict[str, dict[str, Any]] = {}


def set_yaml_section(key: str, data: dict[str, Any]) -> None:
    """Register YAML data for a configuration section."""
    _yaml_section_data[key] = data


def get_yaml_section(key: str) -> dict[str, Any]:
    """Retrieve YAML data for a configuration section."""
    return _yaml_section_data.get(key, {})


def reset_sections() -> None:
    """Clear all registered sections.  Intended for test teardown only."""
    _yaml_section_data.clear()


# ---------------------------------------------------------------------------
# Custom pydantic-settings source
# ---------------------------------------------------------------------------


class YamlDictSource(PydanticBaseSettingsSource):
    """
    A settings source backed by a plain ``dict`` (typically a YAML section).

    This source only provides values for fields that are **declared** on the
    target settings model, preventing ``extra="ignore"`` validation errors.
    """

    def __init__(self, settings_cls: type[BaseSettings], yaml_data: dict[str, Any]) -> None:
        super().__init__(settings_cls)
        self._yaml_data = yaml_data

    def get_field_value(self, field: FieldInfo, field_name: str) -> tuple[Any, str, bool]:
        val = self._yaml_data.get(field_name)
        return val, field_name, val is not None

    def __call__(self) -> dict[str, Any]:
        d: dict[str, Any] = {}
        for field_name in self.settings_cls.model_fields:
            val = self._yaml_data.get(field_name)
            if val is not None:
                d[field_name] = val
        return d
