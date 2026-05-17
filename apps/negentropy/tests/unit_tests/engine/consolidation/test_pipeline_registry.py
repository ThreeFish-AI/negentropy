"""Tests for pipeline registry and build_pipeline."""

from __future__ import annotations

import pytest

from negentropy.engine.consolidation.pipeline import StepResult, build_pipeline, register
from negentropy.engine.consolidation.pipeline.registry import STEP_REGISTRY


class TestRegistryBuilder:
    def test_default_steps_registered(self):
        from negentropy.engine.consolidation.pipeline import steps as _  # noqa

        assert "fact_extract" in STEP_REGISTRY
        assert "auto_link" in STEP_REGISTRY

    def test_register_decorator(self):
        @register("test_xyz")
        class _S:
            name = "test_xyz"

            async def run(self, ctx):
                return StepResult(step_name=self.name, status="success", duration_ms=1)

        assert STEP_REGISTRY.get("test_xyz") is _S
        STEP_REGISTRY.pop("test_xyz", None)

    def test_build_pipeline_strict_unknown_raises(self):
        with pytest.raises(ValueError):
            build_pipeline(["nonexistent_step_xyz"], strict=True)

    def test_build_pipeline_non_strict_skips_unknown(self):
        from negentropy.engine.consolidation.pipeline import steps as _  # noqa

        pipe = build_pipeline(["fact_extract", "nope_step"], strict=False)
        assert pipe.step_names == ["fact_extract"]
