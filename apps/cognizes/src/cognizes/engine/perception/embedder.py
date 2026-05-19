"""
Document Embedding Service for RAG Pipeline.

This module provides embedding generation for documents and queries:
- Batch embedding generation
- Query embedding
- Model hot-swapping support

Usage:
    from cognizes.engine.perception.embedder import Embedder

    embedder = Embedder(model_name="text-embedding-3-small")
    embeddings = await embedder.embed_texts(["Hello", "World"])

Task ID: P3-5-3
"""

import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

import numpy as np


@dataclass
class EmbeddingResult:
    """Result of embedding generation."""

    text: str
    embedding: list[float]
    model: str
    dimensions: int
    token_count: int = 0
    metadata: dict[str, Any] = field(default_factory=dict)


class EmbeddingProvider(ABC):
    """Abstract base class for embedding providers."""

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Return the model name."""
        ...

    @property
    @abstractmethod
    def dimensions(self) -> int:
        """Return the embedding dimensions."""
        ...

    @abstractmethod
    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a list of texts."""
        ...


class GeminiEmbeddingProvider(EmbeddingProvider):
    """
    Google Gemini Embedding Provider.

    Supports:
    - models/text-embedding-004 (768 dims)
    """

    MODEL_DIMENSIONS = {
        "models/text-embedding-004": 768,
    }

    def __init__(
        self,
        model: str = "models/text-embedding-004",
        api_key: str | None = None,
        batch_size: int = 100,
    ):
        self._model = model
        self._api_key = api_key
        self._batch_size = batch_size
        self._configure_genai()

    def _configure_genai(self):
        """Lazy load and configure Google GenAI."""
        try:
            import os

            import google.generativeai as genai

            api_key = self._api_key or os.getenv("GOOGLE_API_KEY")
            if not api_key:
                raise ValueError("GOOGLE_API_KEY is required for GeminiEmbeddingProvider.")

            genai.configure(api_key=api_key)
            self._genai = genai
        except ImportError:
            raise ImportError(
                "google-generativeai is required for GeminiEmbeddingProvider. "
                "Install with: pip install google-generativeai"
            ) from None

    @property
    def model_name(self) -> str:
        return self._model

    @property
    def dimensions(self) -> int:
        return self.MODEL_DIMENSIONS.get(self._model, 768)

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings using Gemini API."""
        all_embeddings = []

        # Process in batches
        for i in range(0, len(texts), self._batch_size):
            batch = texts[i : i + self._batch_size]

            # Run in executor because genai library might be synchronous for some calls
            # or we want to offload the network wait if it's not native async
            # The current google-generativeai python client supports async methods but
            # let's assume standard usage for now. Actually, let's use the embed_content method.

            # Using async wrapper if available, or run_in_executor
            loop = asyncio.get_event_loop()

            def _call_gemini(_batch=batch):
                return [
                    self._genai.embed_content(
                        model=self._model,
                        content=text,
                    )["embedding"]
                    for text in _batch
                ]

            batch_embeddings = await loop.run_in_executor(None, _call_gemini)
            all_embeddings.extend(batch_embeddings)

        return all_embeddings


class OpenAIEmbeddingProvider(EmbeddingProvider):
    """
    OpenAI Embedding Provider.

    Supports:
    - text-embedding-3-small (1536 dims)
    - text-embedding-3-large (3072 dims)
    - text-embedding-ada-002 (1536 dims)
    """

    MODEL_DIMENSIONS = {
        "text-embedding-3-small": 1536,
        "text-embedding-3-large": 3072,
        "text-embedding-ada-002": 1536,
    }

    def __init__(
        self,
        model: str = "text-embedding-3-small",
        api_key: str | None = None,
        batch_size: int = 100,
    ):
        self._model = model
        self._api_key = api_key
        self._batch_size = batch_size
        self._client = None

    @property
    def model_name(self) -> str:
        return self._model

    @property
    def dimensions(self) -> int:
        return self.MODEL_DIMENSIONS.get(self._model, 1536)

    def _get_client(self):
        """Lazy load OpenAI client."""
        if self._client is None:
            try:
                from openai import AsyncOpenAI

                self._client = AsyncOpenAI(api_key=self._api_key)
            except ImportError:
                raise ImportError(
                    "openai is required for OpenAIEmbeddingProvider. Install with: pip install openai"
                ) from None
        return self._client

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings using OpenAI API."""
        client = self._get_client()
        all_embeddings = []

        # Process in batches
        for i in range(0, len(texts), self._batch_size):
            batch = texts[i : i + self._batch_size]
            response = await client.embeddings.create(
                model=self._model,
                input=batch,
            )
            batch_embeddings = [item.embedding for item in response.data]
            all_embeddings.extend(batch_embeddings)

        return all_embeddings


class SentenceTransformerProvider(EmbeddingProvider):
    """
    Sentence Transformers Embedding Provider.

    Local embedding using sentence-transformers library.
    Recommended for development and cost-sensitive deployments.
    """

    MODEL_DIMENSIONS = {
        "all-MiniLM-L6-v2": 384,
        "all-mpnet-base-v2": 768,
        "paraphrase-MiniLM-L6-v2": 384,
        "BAAI/bge-small-en-v1.5": 384,
        "BAAI/bge-base-en-v1.5": 768,
        "BAAI/bge-large-en-v1.5": 1024,
    }

    def __init__(
        self,
        model: str = "all-MiniLM-L6-v2",
        batch_size: int = 32,
        device: str | None = None,
    ):
        self._model_name = model
        self._batch_size = batch_size
        self._device = device
        self._model = None

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def dimensions(self) -> int:
        return self.MODEL_DIMENSIONS.get(self._model_name, 384)

    def _get_model(self):
        """Lazy load sentence-transformers model."""
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer

                self._model = SentenceTransformer(
                    self._model_name,
                    device=self._device,
                )
            except ImportError:
                raise ImportError(
                    "sentence-transformers is required for SentenceTransformerProvider. "
                    "Install with: pip install sentence-transformers"
                ) from None
        return self._model

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings using sentence-transformers."""
        model = self._get_model()

        # Run in executor to avoid blocking
        loop = asyncio.get_event_loop()
        embeddings = await loop.run_in_executor(
            None,
            lambda: model.encode(
                texts,
                batch_size=self._batch_size,
                show_progress_bar=False,
                convert_to_numpy=True,
            ),
        )

        return embeddings.tolist()


class MockEmbeddingProvider(EmbeddingProvider):
    """
    Mock Embedding Provider for testing.

    Generates random embeddings without external API calls.
    """

    def __init__(
        self,
        model: str = "mock-embedding-model",
        dimensions: int = 1536,
        seed: int | None = None,
    ):
        self._model_name = model
        self._dimensions = dimensions
        self._rng = np.random.default_rng(seed)

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def dimensions(self) -> int:
        return self._dimensions

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Generate mock random embeddings."""
        embeddings = []
        for text in texts:
            # Use text hash for reproducibility
            seed = hash(text) % (2**32)
            rng = np.random.default_rng(seed)
            embedding = rng.standard_normal(self._dimensions)
            # Normalize to unit vector
            embedding = embedding / np.linalg.norm(embedding)
            embeddings.append(embedding.tolist())
        return embeddings


class Embedder:
    """
    High-level Embedder service.

    Orchestrates embedding generation with provider abstraction.
    """

    def __init__(
        self,
        provider: EmbeddingProvider | None = None,
        model_name: str = "text-embedding-3-small",
        provider_type: str = "openai",
        **kwargs,
    ):
        """
        Initialize Embedder.

        Args:
            provider: Custom embedding provider instance
            model_name: Model name (if using default provider)
            provider_type: One of "openai", "sentence-transformers", "mock"
            **kwargs: Additional provider-specific arguments
        """
        if provider is not None:
            self.provider = provider
        else:
            self.provider = self._create_provider(provider_type, model_name, **kwargs)

    def _create_provider(self, provider_type: str, model_name: str, **kwargs) -> EmbeddingProvider:
        """Create embedding provider based on type."""
        providers = {
            "openai": OpenAIEmbeddingProvider,
            "gemini": GeminiEmbeddingProvider,
            "sentence-transformers": SentenceTransformerProvider,
            "mock": MockEmbeddingProvider,
        }

        if provider_type not in providers:
            raise ValueError(f"Unknown provider type: {provider_type}. Available: {list(providers.keys())}")

        return providers[provider_type](model=model_name, **kwargs)

    @property
    def model_name(self) -> str:
        """Return current model name."""
        return self.provider.model_name

    @property
    def dimensions(self) -> int:
        """Return embedding dimensions."""
        return self.provider.dimensions

    async def embed_texts(self, texts: list[str], **metadata) -> list[EmbeddingResult]:
        """
        Generate embeddings for a list of texts.

        Args:
            texts: List of text strings to embed
            **metadata: Additional metadata to include in results

        Returns:
            List of EmbeddingResult objects
        """
        embeddings = await self.provider.embed(texts)

        results = []
        for text, embedding in zip(texts, embeddings, strict=False):
            results.append(
                EmbeddingResult(
                    text=text,
                    embedding=embedding,
                    model=self.model_name,
                    dimensions=len(embedding),
                    metadata=metadata,
                )
            )

        return results

    async def embed_query(self, query: str) -> list[float]:
        """
        Generate embedding for a single query.

        Args:
            query: Query string

        Returns:
            Embedding vector as list of floats
        """
        embeddings = await self.provider.embed([query])
        return embeddings[0]

    async def embed_documents(
        self,
        documents: list[dict[str, Any]],
        content_key: str = "content",
    ) -> list[dict[str, Any]]:
        """
        Embed documents and add embedding to each document.

        Args:
            documents: List of document dicts
            content_key: Key for text content in document

        Returns:
            Documents with 'embedding' field added
        """
        texts = [doc[content_key] for doc in documents]
        embeddings = await self.provider.embed(texts)

        for doc, embedding in zip(documents, embeddings, strict=False):
            doc["embedding"] = embedding

        return documents


# ============================================
# Factory function
# ============================================


def get_embedder(
    provider_type: str = "mock",
    model_name: str | None = None,
    **kwargs,
) -> Embedder:
    """
    Factory function to create an Embedder.

    Args:
        provider_type: One of "openai", "gemini", "sentence-transformers", "mock"
        model_name: Model name (defaults based on provider)
        **kwargs: Provider-specific arguments

    Returns:
        Embedder instance
    """
    default_models = {
        "openai": "text-embedding-3-small",
        "gemini": "models/text-embedding-004",
        "sentence-transformers": "all-MiniLM-L6-v2",
        "mock": "mock-embedding-model",
    }

    if model_name is None:
        model_name = default_models.get(provider_type, "mock-embedding-model")

    return Embedder(
        provider_type=provider_type,
        model_name=model_name,
        **kwargs,
    )
