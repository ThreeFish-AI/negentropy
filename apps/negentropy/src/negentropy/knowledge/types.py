from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID


SearchMode = Literal["semantic", "keyword", "hybrid"]


@dataclass(frozen=True)
class CorpusSpec:
    app_name: str
    name: str
    description: Optional[str] = None
    config: Dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class CorpusRecord:
    id: UUID
    app_name: str
    name: str
    description: Optional[str]
    config: Dict[str, Any]
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class KnowledgeChunk:
    content: str
    source_uri: Optional[str] = None
    chunk_index: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)
    embedding: Optional[List[float]] = None


@dataclass(frozen=True)
class KnowledgeRecord:
    id: UUID
    corpus_id: UUID
    app_name: str
    content: str
    source_uri: Optional[str]
    chunk_index: int
    metadata: Dict[str, Any]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    embedding: Optional[List[float]] = None


@dataclass(frozen=True)
class KnowledgeMatch:
    id: UUID
    content: str
    source_uri: Optional[str]
    metadata: Dict[str, Any]
    semantic_score: float = 0.0
    keyword_score: float = 0.0
    combined_score: float = 0.0


@dataclass(frozen=True)
class ChunkingConfig:
    chunk_size: int = 800
    overlap: int = 100
    preserve_newlines: bool = True


@dataclass(frozen=True)
class SearchConfig:
    mode: SearchMode = "hybrid"
    limit: int = 20
    semantic_weight: float = 0.7
    keyword_weight: float = 0.3
    metadata_filter: Optional[Dict[str, Any]] = None
