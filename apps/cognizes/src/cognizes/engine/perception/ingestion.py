"""
Document Ingestion Service for RAG Pipeline.

This module provides document parsing and ingestion:
- Multi-format support (Markdown, TXT, PDF)
- Document parsing and metadata extraction
- Integration with Chunking and Embedding

Usage:
    from cognizes.engine.perception.ingestion import DocumentIngester

    ingester = DocumentIngester()
    documents = await ingester.ingest_file("document.md")

Task ID: P3-5-1
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Dict, Any, Union, BinaryIO
import hashlib
import mimetypes
from datetime import datetime


@dataclass
class Document:
    """Represents a parsed document."""

    content: str
    source_uri: str
    doc_id: str
    title: Optional[str] = None
    mime_type: str = "text/plain"
    file_size: int = 0
    created_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if not self.doc_id:
            # Generate doc_id from content hash
            self.doc_id = hashlib.sha256(self.content.encode()).hexdigest()[:16]


@dataclass
class IngestedDocument:
    """Document with chunks and embeddings ready for storage."""

    document: Document
    chunks: List[Dict[str, Any]]
    total_tokens: int = 0
    processing_time_ms: float = 0


class DocumentParser(ABC):
    """Abstract base class for document parsers."""

    @property
    @abstractmethod
    def supported_extensions(self) -> List[str]:
        """Return list of supported file extensions."""
        ...

    @abstractmethod
    def parse(self, content: Union[str, bytes], source_uri: str) -> Document:
        """Parse content and return Document."""
        ...


class MarkdownParser(DocumentParser):
    """Parser for Markdown documents."""

    @property
    def supported_extensions(self) -> List[str]:
        return [".md", ".markdown"]

    def parse(self, content: Union[str, bytes], source_uri: str) -> Document:
        if isinstance(content, bytes):
            content = content.decode("utf-8")

        # Extract title from first heading
        title = None
        lines = content.split("\n")
        for line in lines:
            if line.startswith("# "):
                title = line[2:].strip()
                break

        return Document(
            content=content,
            source_uri=source_uri,
            doc_id="",  # Will be generated
            title=title,
            mime_type="text/markdown",
            file_size=len(content.encode("utf-8")),
            metadata={"format": "markdown"},
        )


class TextParser(DocumentParser):
    """Parser for plain text documents."""

    @property
    def supported_extensions(self) -> List[str]:
        return [".txt", ".text"]

    def parse(self, content: Union[str, bytes], source_uri: str) -> Document:
        if isinstance(content, bytes):
            content = content.decode("utf-8")

        # Use filename as title
        title = Path(source_uri).stem if source_uri else None

        return Document(
            content=content,
            source_uri=source_uri,
            doc_id="",
            title=title,
            mime_type="text/plain",
            file_size=len(content.encode("utf-8")),
            metadata={"format": "text"},
        )


class PDFParser(DocumentParser):
    """Parser for PDF documents."""

    @property
    def supported_extensions(self) -> List[str]:
        return [".pdf"]

    def parse(self, content: Union[str, bytes], source_uri: str) -> Document:
        if isinstance(content, str):
            # Already text, just use it
            text_content = content
        else:
            text_content = self._extract_text(content)

        title = Path(source_uri).stem if source_uri else None

        return Document(
            content=text_content,
            source_uri=source_uri,
            doc_id="",
            title=title,
            mime_type="application/pdf",
            file_size=len(content) if isinstance(content, bytes) else len(content.encode()),
            metadata={"format": "pdf"},
        )

    def _extract_text(self, pdf_bytes: bytes) -> str:
        """Extract text from PDF bytes."""
        try:
            import pypdf

            from io import BytesIO

            reader = pypdf.PdfReader(BytesIO(pdf_bytes))
            text_parts = []
            for page in reader.pages:
                text_parts.append(page.extract_text())
            return "\n\n".join(text_parts)
        except ImportError:
            raise ImportError("pypdf is required for PDF parsing. Install with: pip install pypdf")


class DocumentIngester:
    """
    High-level Document Ingestion Service.

    Orchestrates parsing, chunking, and embedding of documents.
    """

    def __init__(
        self,
        chunker=None,
        embedder=None,
        parsers: Optional[List[DocumentParser]] = None,
    ):
        """
        Initialize DocumentIngester.

        Args:
            chunker: ChunkingStrategy instance (optional, uses RecursiveChunker)
            embedder: Embedder instance (optional, uses MockEmbedder)
            parsers: List of DocumentParser instances (optional, uses defaults)
        """
        self.chunker = chunker
        self.embedder = embedder
        self.parsers = self._init_parsers(parsers)

    def _init_parsers(self, parsers: Optional[List[DocumentParser]]) -> Dict[str, DocumentParser]:
        """Initialize parser registry."""
        if parsers is None:
            parsers = [MarkdownParser(), TextParser(), PDFParser()]

        registry = {}
        for parser in parsers:
            for ext in parser.supported_extensions:
                registry[ext.lower()] = parser

        return registry

    def _get_chunker(self):
        """Get or create chunker."""
        if self.chunker is None:
            from cognizes.engine.perception.chunking import RecursiveChunker

            self.chunker = RecursiveChunker(chunk_size=512, chunk_overlap=50)
        return self.chunker

    def _get_embedder(self):
        """Get or create embedder."""
        if self.embedder is None:
            from cognizes.engine.perception.embedder import get_embedder

            self.embedder = get_embedder(provider_type="mock")
        return self.embedder

    def get_parser(self, source_uri: str) -> DocumentParser:
        """Get appropriate parser for file extension."""
        ext = Path(source_uri).suffix.lower()
        if ext not in self.parsers:
            raise ValueError(f"Unsupported file extension: {ext}. Supported: {list(self.parsers.keys())}")
        return self.parsers[ext]

    def parse_content(
        self,
        content: Union[str, bytes],
        source_uri: str,
    ) -> Document:
        """
        Parse content into a Document.

        Args:
            content: File content (string or bytes)
            source_uri: Source file path or URI

        Returns:
            Parsed Document object
        """
        parser = self.get_parser(source_uri)
        return parser.parse(content, source_uri)

    async def ingest_text(
        self,
        content: str,
        source_uri: str = "inline.txt",
        generate_embeddings: bool = True,
    ) -> IngestedDocument:
        """
        Ingest text content.

        Args:
            content: Text content
            source_uri: Source identifier
            generate_embeddings: Whether to generate embeddings

        Returns:
            IngestedDocument with chunks and optional embeddings
        """
        import time

        start_time = time.perf_counter()

        # Parse document
        document = Document(
            content=content,
            source_uri=source_uri,
            doc_id="",
            mime_type="text/plain",
            file_size=len(content.encode("utf-8")),
        )

        # Chunk document
        chunker = self._get_chunker()
        chunks = chunker.split(content, source_uri=source_uri)

        # Convert to dict format
        chunk_dicts = []
        for chunk in chunks:
            chunk_dict = {
                "content": chunk.content,
                "chunk_index": chunk.index,
                "source_uri": source_uri,
                "doc_id": document.doc_id,
                "token_count": chunk.token_count,
                "metadata": chunk.metadata,
            }
            chunk_dicts.append(chunk_dict)

        # Generate embeddings if requested
        if generate_embeddings:
            embedder = self._get_embedder()
            chunk_dicts = await embedder.embed_documents(chunk_dicts)

        processing_time = (time.perf_counter() - start_time) * 1000

        return IngestedDocument(
            document=document,
            chunks=chunk_dicts,
            total_tokens=sum(c.get("token_count", 0) for c in chunk_dicts),
            processing_time_ms=processing_time,
        )

    async def ingest_file(
        self,
        file_path: Union[str, Path],
        generate_embeddings: bool = True,
    ) -> IngestedDocument:
        """
        Ingest a file.

        Args:
            file_path: Path to file
            generate_embeddings: Whether to generate embeddings

        Returns:
            IngestedDocument with chunks and optional embeddings
        """
        import time

        start_time = time.perf_counter()

        file_path = Path(file_path)
        source_uri = str(file_path)

        # Read file
        if file_path.suffix.lower() == ".pdf":
            with open(file_path, "rb") as f:
                content = f.read()
        else:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

        # Parse document
        document = self.parse_content(content, source_uri)

        # Chunk document
        chunker = self._get_chunker()
        chunks = chunker.split(document.content, source_uri=source_uri)

        # Convert to dict format
        chunk_dicts = []
        for chunk in chunks:
            chunk_dict = {
                "content": chunk.content,
                "chunk_index": chunk.index,
                "source_uri": source_uri,
                "doc_id": document.doc_id,
                "title": document.title,
                "token_count": chunk.token_count,
                "metadata": {
                    **chunk.metadata,
                    "mime_type": document.mime_type,
                },
            }
            chunk_dicts.append(chunk_dict)

        # Generate embeddings if requested
        if generate_embeddings:
            embedder = self._get_embedder()
            chunk_dicts = await embedder.embed_documents(chunk_dicts)

        processing_time = (time.perf_counter() - start_time) * 1000

        return IngestedDocument(
            document=document,
            chunks=chunk_dicts,
            total_tokens=sum(c.get("token_count", 0) for c in chunk_dicts),
            processing_time_ms=processing_time,
        )

    async def ingest_files(
        self,
        file_paths: List[Union[str, Path]],
        generate_embeddings: bool = True,
    ) -> List[IngestedDocument]:
        """
        Ingest multiple files.

        Args:
            file_paths: List of file paths
            generate_embeddings: Whether to generate embeddings

        Returns:
            List of IngestedDocument objects
        """
        results = []
        for file_path in file_paths:
            result = await self.ingest_file(file_path, generate_embeddings)
            results.append(result)
        return results


# ============================================
# Factory function
# ============================================


def get_ingester(
    chunk_size: int = 512,
    chunk_overlap: int = 50,
    embedding_provider: str = "mock",
    **kwargs,
) -> DocumentIngester:
    """
    Factory function to create a DocumentIngester.

    Args:
        chunk_size: Chunk size in tokens
        chunk_overlap: Chunk overlap in tokens
        embedding_provider: Embedding provider type
        **kwargs: Additional arguments

    Returns:
        DocumentIngester instance
    """
    from cognizes.engine.perception.chunking import RecursiveChunker
    from cognizes.engine.perception.embedder import get_embedder

    chunker = RecursiveChunker(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )
    embedder = get_embedder(provider_type=embedding_provider, **kwargs)

    return DocumentIngester(chunker=chunker, embedder=embedder)
