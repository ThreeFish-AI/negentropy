from __future__ import annotations

from dataclasses import fields, is_dataclass
from enum import Enum
from pathlib import Path
from typing import Any
from uuid import UUID


def to_json_compatible(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, UUID | Path | Enum):
        return str(value)
    if isinstance(value, dict):
        return {str(key): to_json_compatible(item) for key, item in value.items()}
    if isinstance(value, list | tuple | set):
        return [to_json_compatible(item) for item in value]
    if is_dataclass(value) and not isinstance(value, type):
        return {
            field.name: to_json_compatible(getattr(value, field.name))
            for field in fields(value)
        }

    model_dump = getattr(value, "model_dump", None)
    if callable(model_dump):
        return to_json_compatible(model_dump())

    to_dict = getattr(value, "to_dict", None)
    if callable(to_dict):
        return to_json_compatible(to_dict())

    dict_method = getattr(value, "dict", None)
    if callable(dict_method):
        return to_json_compatible(dict_method())

    return str(value)
