from __future__ import annotations

from dataclasses import fields, is_dataclass
from enum import Enum
from pathlib import Path
from typing import Any
from uuid import UUID


def _path_label(path: tuple[str, ...], *, fallback: str | None = None) -> str:
    if path:
        return ".".join(path)
    return fallback or "value"


def _to_json_compatible(
    value: Any,
    *,
    strict: bool,
    path: tuple[str, ...],
    label: str | None = None,
) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, UUID | Path | Enum):
        return str(value)
    if isinstance(value, dict):
        return {
            str(key): _to_json_compatible(item, strict=strict, path=(*path, str(key)), label=label)
            for key, item in value.items()
        }
    if isinstance(value, list | tuple | set):
        return [
            _to_json_compatible(item, strict=strict, path=(*path, str(index)), label=label)
            for index, item in enumerate(value)
        ]
    if is_dataclass(value) and not isinstance(value, type):
        return {
            field.name: _to_json_compatible(
                getattr(value, field.name),
                strict=strict,
                path=(*path, field.name),
                label=label,
            )
            for field in fields(value)
        }

    model_dump = getattr(value, "model_dump", None)
    if callable(model_dump):
        return _to_json_compatible(model_dump(), strict=strict, path=path, label=label)

    to_dict = getattr(value, "to_dict", None)
    if callable(to_dict):
        return _to_json_compatible(to_dict(), strict=strict, path=path, label=label)

    dict_method = getattr(value, "dict", None)
    if callable(dict_method):
        return _to_json_compatible(dict_method(), strict=strict, path=path, label=label)

    if strict:
        raise TypeError(
            f"{_path_label(path, fallback=label)} is not safely JSON-serializable: {value.__class__.__name__}"
        )

    return str(value)


def to_json_compatible(value: Any) -> Any:
    return _to_json_compatible(value, strict=False, path=())


def to_json_compatible_strict(value: Any, *, label: str | None = None) -> Any:
    root_path = (label,) if label else ()
    return _to_json_compatible(value, strict=True, path=root_path, label=label)
