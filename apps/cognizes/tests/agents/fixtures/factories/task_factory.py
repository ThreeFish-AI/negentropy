"""Factory for generating test data for tasks."""

from datetime import datetime, timedelta

import factory
from factory import SubFactory, fuzzy

from cognizes.api.models.task import (
    TaskCreateRequest,
    TaskInfo,
    TaskProgress,
    TaskResponse,
    TaskUpdateRequest,
)

from .paper_factory import PaperInfoFactory


class TaskProgressFactory(factory.Factory):
    """Factory for TaskProgress model."""

    class Meta:
        model = TaskProgress

    stage = fuzzy.FuzzyChoice(
        [
            "initialization",
            "file_validation",
            "content_extraction",
            "translation",
            "analysis",
            "finalization",
        ]
    )
    status = fuzzy.FuzzyChoice(["pending", "in_progress", "completed", "failed"])
    progress = fuzzy.FuzzyFloat(0, 100)
    message = factory.Faker("sentence")
    started_at = factory.Maybe(
        fuzzy.FuzzyChoice([True, False]),
        factory.LazyFunction(lambda: datetime.now().isoformat() + "Z"),
        None,
    )
    completed_at = factory.Maybe(
        fuzzy.FuzzyChoice([True, False]),
        factory.LazyFunction(lambda: (datetime.now() + timedelta(minutes=5)).isoformat() + "Z"),
        None,
    )
    error_details = factory.Maybe(fuzzy.FuzzyChoice([True, False]), factory.Faker("sentence"), None)


class TaskInfoFactory(factory.Factory):
    """Factory for TaskInfo model."""

    class Meta:
        model = TaskInfo

    task_id = factory.Faker("uuid4")
    paper_id = SubFactory(PaperInfoFactory).paper_id
    workflow = fuzzy.FuzzyChoice(
        [
            "full",
            "extract_only",
            "translate_only",
            "heartfelt_only",
            "extract_translate",
            "translate_heartfelt",
        ]
    )
    status = fuzzy.FuzzyChoice(["pending", "processing", "completed", "failed", "cancelled"])
    progress = fuzzy.FuzzyFloat(0, 100)
    message = factory.Faker("sentence")
    created_at = factory.LazyFunction(lambda: datetime.now().isoformat() + "Z")
    updated_at = factory.LazyFunction(lambda: datetime.now().isoformat() + "Z")
    started_at = factory.Maybe(
        fuzzy.FuzzyChoice([True, False]),
        factory.LazyFunction(lambda: datetime.now().isoformat() + "Z"),
        None,
    )
    completed_at = factory.Maybe(
        fuzzy.FuzzyChoice([True, False]),
        factory.LazyFunction(lambda: (datetime.now() + timedelta(minutes=10)).isoformat() + "Z"),
        None,
    )
    error = factory.Maybe(fuzzy.FuzzyChoice([True, False]), factory.Faker("sentence"), None)
    result = factory.Maybe(
        fuzzy.FuzzyChoice([True, False]),
        factory.LazyFunction(
            lambda: {
                "output_files": {
                    "extracted": "output/paper_extracted.json",
                    "translated": "output/paper_translated.md",
                    "analyzed": "output/paper_heartfelt.md",
                },
                "statistics": {
                    "word_count": factory.Faker("random_int", min=1000, max=10000),
                    "translation_quality": factory.Faker("random.uniform", min=0.8, max=1.0),
                    "processing_time": factory.Faker("random_int", min=60, max=600),
                },
            }
        ),
        None,
    )
    stages = factory.LazyFunction(
        lambda: [TaskProgressFactory() for _ in range(factory.Faker("random_int", min=2, max=6).generate())]
    )
    options = factory.LazyFunction(
        lambda: {
            "extract_images": factory.Faker("boolean"),
            "preserve_format": factory.Faker("boolean"),
            "translation_style": fuzzy.FuzzyChoice(["academic", "casual", "technical"]),
            "technical_mode": factory.Faker("boolean"),
            "analysis_depth": fuzzy.FuzzyChoice(["brief", "standard", "detailed"]),
            "batch_size": factory.Faker("random_int", min=1, max=20),
            "priority": fuzzy.FuzzyChoice(["low", "normal", "high"]),
        }
    )


class TaskResponseFactory(factory.Factory):
    """Factory for TaskResponse model."""

    class Meta:
        model = TaskResponse

    task_id = factory.Faker("uuid4")
    paper_id = SubFactory(PaperInfoFactory).paper_id
    workflow = fuzzy.FuzzyChoice(
        [
            "full",
            "extract_only",
            "translate_only",
            "heartfelt_only",
            "extract_translate",
            "translate_heartfelt",
        ]
    )
    status = fuzzy.FuzzyChoice(["pending", "processing", "completed", "failed", "cancelled"])
    progress = fuzzy.FuzzyFloat(0, 100)
    message = factory.Faker("sentence")
    created_at = factory.LazyFunction(lambda: datetime.now().isoformat() + "Z")
    updated_at = factory.LazyFunction(lambda: datetime.now().isoformat() + "Z")


class TaskCreateRequestFactory(factory.Factory):
    """Factory for TaskCreateRequest model."""

    class Meta:
        model = TaskCreateRequest

    paper_id = factory.Faker("uuid4")
    workflow = fuzzy.FuzzyChoice(
        [
            "full",
            "extract_only",
            "translate_only",
            "heartfelt_only",
            "extract_translate",
            "translate_heartfelt",
        ]
    )
    options = factory.LazyFunction(
        lambda: {
            "extract_images": factory.Faker("boolean"),
            "preserve_format": factory.Faker("boolean"),
            "translation_style": fuzzy.FuzzyChoice(["academic", "casual", "technical"]),
            "technical_mode": factory.Faker("boolean"),
            "analysis_depth": fuzzy.FuzzyChoice(["brief", "standard", "detailed"]),
            "priority": fuzzy.FuzzyChoice(["low", "normal", "high"]),
        }
    )


class TaskUpdateRequestFactory(factory.Factory):
    """Factory for TaskUpdateRequest model."""

    class Meta:
        model = TaskUpdateRequest

    status = fuzzy.FuzzyChoice(["pending", "processing", "completed", "failed", "cancelled"])
    progress = fuzzy.FuzzyFloat(0, 100)
    message = factory.Faker("sentence")
    error = factory.Maybe(fuzzy.FuzzyChoice([True, False]), factory.Faker("sentence"), None)
    result = factory.Maybe(
        fuzzy.FuzzyChoice([True, False]),
        factory.LazyFunction(
            lambda: {
                "output_file": "output/paper_processed.json",
                "statistics": {
                    "processing_time": factory.Faker("random_int", min=60, max=600),
                    "success": True,
                },
            }
        ),
        None,
    )


class BatchTaskFactory(factory.Factory):
    """Factory for batch task creation."""

    class Meta:
        model = dict  # Using dict as model for flexibility

    task_id = factory.Faker("uuid4")
    paper_ids = factory.LazyFunction(
        lambda: [
            factory.Faker("uuid4").generate() for _ in range(factory.Faker("random_int", min=2, max=10).generate())
        ]
    )
    workflow = fuzzy.FuzzyChoice(["translate", "analyze", "extract_translate", "full"])
    status = fuzzy.FuzzyChoice(["pending", "processing", "completed", "failed"])
    total = factory.LazyAttribute(lambda obj: len(obj["paper_ids"]))
    completed = factory.LazyAttribute(lambda obj: factory.Faker("random_int", min=0, max=obj["total"]).generate())
    failed = factory.LazyAttribute(
        lambda obj: factory.Faker("random_int", min=0, max=obj["total"] - obj["completed"]).generate()
    )
    created_at = factory.LazyFunction(lambda: datetime.now().isoformat() + "Z")
    updated_at = factory.LazyFunction(lambda: datetime.now().isoformat() + "Z")
    options = factory.LazyFunction(
        lambda: {
            "batch_size": factory.Faker("random_int", min=1, max=5),
            "parallel": factory.Faker("boolean"),
            "continue_on_error": factory.Faker("boolean"),
        }
    )
