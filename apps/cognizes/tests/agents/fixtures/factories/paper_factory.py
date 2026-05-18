"""Factory for generating test data for papers."""

import uuid
from datetime import datetime

import factory
from factory import fuzzy

from cognizes.api.models.paper import (
    PaperInfo,
    PaperMetadata,
    PaperProcessRequest,
    PaperStatus,
    PaperUploadResponse,
)


class PaperMetadataFactory(factory.Factory):
    """Factory for PaperMetadata model."""

    class Meta:
        model = PaperMetadata

    title = factory.Faker("sentence", nb_words=8)
    authors = factory.LazyFunction(
        lambda: [factory.Faker("name").generate() for _ in range(factory.Faker("random_int", min=1, max=5).generate())]
    )
    year = factory.Faker("random_int", min=2020, max=2024)
    venue = factory.Faker("company")
    abstract = factory.Faker("paragraph", nb_sentences=3)
    pages = factory.Faker("random_int", min=5, max=50)
    doi = factory.LazyFunction(lambda: f"10.1000/{uuid.uuid4().hex[:8]}")
    keywords = factory.LazyFunction(
        lambda: [factory.Faker("word").generate() for _ in range(factory.Faker("random_int", min=3, max=8).generate())]
    )


class PaperInfoFactory(factory.Factory):
    """Factory for PaperInfo model."""

    class Meta:
        model = PaperInfo

    paper_id = factory.LazyAttribute(lambda obj: f"{obj.category}_20241212_143022_{obj.filename}")
    filename = factory.Faker("file_name", extension="pdf")
    category = fuzzy.FuzzyChoice(
        [
            "llm-agents",
            "reinforcement-learning",
            "multi-agent",
            "knowledge-graphs",
            "context-engineering",
            "general-ai",
        ]
    )
    status = fuzzy.FuzzyChoice(["uploaded", "processing", "completed", "failed"])
    upload_time = factory.LazyFunction(lambda: datetime.now().isoformat() + "Z")
    updated_at = factory.LazyFunction(lambda: datetime.now().isoformat() + "Z")
    size = fuzzy.FuzzyInteger(100000, 10000000)  # 100KB to 10MB
    metadata = factory.SubFactory(PaperMetadataFactory)
    workflows = factory.LazyFunction(
        lambda: {
            "extract": {
                "status": "completed",
                "progress": 100,
                "message": "Extraction completed successfully",
                "started_at": "2024-01-15T14:30:22Z",
                "completed_at": "2024-01-15T14:32:15Z",
            },
            "translate": {
                "status": fuzzy.FuzzyChoice(["pending", "processing", "completed"]),
                "progress": fuzzy.FuzzyFloat(0, 100),
                "message": fuzzy.FuzzyChoice(
                    [
                        "Waiting to start",
                        "Translation in progress...",
                        "Translation completed",
                    ]
                ),
            },
        }
    )


class PaperUploadResponseFactory(factory.Factory):
    """Factory for PaperUploadResponse model."""

    class Meta:
        model = PaperUploadResponse

    paper_id = factory.LazyAttribute(lambda obj: f"{obj.category}_20241212_143022_{obj.filename}")
    filename = factory.Faker("file_name", extension="pdf")
    category = factory.LazyAttribute(
        lambda obj: fuzzy.FuzzyChoice(["llm-agents", "reinforcement-learning", "multi-agent"]).fuzz()
    )
    size = fuzzy.FuzzyInteger(100000, 10000000)
    upload_time = factory.LazyFunction(lambda: datetime.now().isoformat() + "Z")


class PaperProcessRequestFactory(factory.Factory):
    """Factory for PaperProcessRequest model."""

    class Meta:
        model = PaperProcessRequest

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
        }
    )


class PaperStatusFactory(factory.Factory):
    """Factory for PaperStatus model."""

    class Meta:
        model = PaperStatus

    paper_id = factory.LazyAttribute(lambda obj: f"{obj.category}_20241212_143022_{obj.filename}")
    status = fuzzy.FuzzyChoice(["uploaded", "processing", "completed", "failed"])
    workflows = factory.LazyFunction(
        lambda: {
            "extract": {
                "status": "completed",
                "progress": 100,
                "message": "Extraction completed",
                "started_at": "2024-01-15T14:30:22Z",
                "completed_at": "2024-01-15T14:32:15Z",
            },
            "translate": {
                "status": fuzzy.FuzzyChoice(["pending", "processing", "completed", "failed"]),
                "progress": fuzzy.FuzzyFloat(0, 100),
                "message": factory.Faker("sentence"),
                "started_at": "2024-01-15T14:32:20Z" if fuzzy.FuzzyChoice([True, False]) else None,
                "completed_at": None,
            },
            "heartfelt": {
                "status": fuzzy.FuzzyChoice(["pending", "processing", "completed", "failed"]),
                "progress": fuzzy.FuzzyFloat(0, 100),
                "message": factory.Faker("sentence"),
            },
        }
    )
    upload_time = factory.LazyFunction(lambda: datetime.now().isoformat() + "Z")
    updated_at = factory.LazyFunction(lambda: datetime.now().isoformat() + "Z")
    category = fuzzy.FuzzyChoice(
        [
            "llm-agents",
            "reinforcement-learning",
            "multi-agent",
            "knowledge-graphs",
            "context-engineering",
        ]
    )
    filename = factory.Faker("file_name", extension="pdf")
