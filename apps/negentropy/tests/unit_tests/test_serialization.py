from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

from negentropy.serialization import to_json_compatible


@dataclass(slots=True)
class ChildPayload:
    count: int


@dataclass(slots=True)
class ParentPayload:
    name: str
    child: ChildPayload


def test_to_json_compatible_supports_slots_dataclass_and_common_runtime_types() -> None:
    identifier = uuid4()
    payload = {
        "id": identifier,
        "path": Path("/tmp/example.pdf"),
        "config": ParentPayload(name="demo", child=ChildPayload(count=3)),
        "items": {"alpha", "beta"},
    }

    result = to_json_compatible(payload)

    assert result["id"] == str(identifier)
    assert result["path"] == "/tmp/example.pdf"
    assert result["config"] == {"name": "demo", "child": {"count": 3}}
    assert sorted(result["items"]) == ["alpha", "beta"]


def test_to_json_compatible_prefers_model_dump_then_to_dict_then_dict() -> None:
    class ModelDumpOnly:
        def model_dump(self):
            return {"source": "model_dump"}

    class ToDictOnly:
        def to_dict(self):
            return {"source": "to_dict"}

    class DictOnly:
        def dict(self):
            return {"source": "dict"}

    assert to_json_compatible(ModelDumpOnly()) == {"source": "model_dump"}
    assert to_json_compatible(ToDictOnly()) == {"source": "to_dict"}
    assert to_json_compatible(DictOnly()) == {"source": "dict"}
    assert "namespace" in to_json_compatible(SimpleNamespace(example=1)).lower()
