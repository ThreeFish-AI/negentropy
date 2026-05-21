"""
Import Verification Test
"""

from cognizes.engine.hippocampus.consolidation_worker import (
    JobStatus,
    JobType,
    MemoryConsolidationWorker,
)
from cognizes.engine.hippocampus.context_assembler import ContextAssembler
from cognizes.engine.hippocampus.memory_service import OpenMemoryService
from cognizes.engine.hippocampus.memory_visualizer import MemoryVisualizer
from cognizes.engine.hippocampus.retention_manager import MemoryRetentionManager


def test_imports():
    """Verify that all key Hippocampus modules can be imported."""
    assert MemoryConsolidationWorker is not None
    assert JobType is not None
    assert JobStatus is not None
    assert MemoryRetentionManager is not None
    assert ContextAssembler is not None
    assert OpenMemoryService is not None
    assert MemoryVisualizer is not None
