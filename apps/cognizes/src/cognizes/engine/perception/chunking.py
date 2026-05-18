"""
Chunking Strategies for RAG Pipeline.

This module provides multiple text chunking strategies for document ingestion:
- FixedLengthChunker: 固定长度分块
- RecursiveChunker: 递归分块（按段落/句子边界）
- SemanticChunker: 语义分块（按语义相似度边界）
- HierarchicalChunker: 层次分块（Parent-Child 结构）

Usage:
    from cognizes.engine.perception.chunking import RecursiveChunker

    chunker = RecursiveChunker(chunk_size=512, chunk_overlap=50)
    chunks = chunker.split(text, source_uri="doc.md")

Task ID: P3-5-2
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
import re

# tiktoken is optional - use character-based estimation as fallback
try:
    import tiktoken

    TIKTOKEN_AVAILABLE = True
except ImportError:
    tiktoken = None
    TIKTOKEN_AVAILABLE = False


@dataclass
class Chunk:
    """Represents a text chunk with metadata."""

    content: str
    index: int
    start_char: int = 0
    end_char: int = 0
    token_count: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    # For hierarchical chunking
    parent_id: Optional[str] = None
    children_ids: List[str] = field(default_factory=list)


class ChunkingStrategy(ABC):
    """Abstract base class for chunking strategies."""

    # Average characters per token for estimation (English ~4, Chinese ~2)
    CHARS_PER_TOKEN = 4

    def __init__(
        self,
        chunk_size: int = 512,
        chunk_overlap: int = 50,
        encoding_name: str = "cl100k_base",
        use_tiktoken: bool = True,
    ):
        """
        Initialize chunking strategy.

        Args:
            chunk_size: Target chunk size in tokens
            chunk_overlap: Number of overlapping tokens between chunks
            encoding_name: Tiktoken encoding name for token counting
            use_tiktoken: Whether to use tiktoken (False = use char estimation)
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self._encoding_name = encoding_name
        self._encoding = None  # Lazy load
        self._use_tiktoken = use_tiktoken and TIKTOKEN_AVAILABLE

    @property
    def encoding(self):
        """Lazy load tiktoken encoding to avoid blocking on import."""
        if not self._use_tiktoken:
            return None
        if self._encoding is None:
            self._encoding = tiktoken.get_encoding(self._encoding_name)
        return self._encoding

    def _count_tokens(self, text: str) -> int:
        """Count tokens in text using tiktoken or character estimation."""
        if self._use_tiktoken and self.encoding:
            return len(self.encoding.encode(text))
        # Fallback: estimate tokens from character count
        return len(text) // self.CHARS_PER_TOKEN

    def _decode_tokens(self, tokens: List[int]) -> str:
        """Decode tokens back to text."""
        if self._use_tiktoken and self.encoding:
            return self.encoding.decode(tokens)
        raise NotImplementedError("Token decoding requires tiktoken")

    @abstractmethod
    def split(self, text: str, source_uri: str = "", **kwargs) -> List[Chunk]:
        """
        Split text into chunks.

        Args:
            text: Input text to split
            source_uri: Source file URI for metadata
            **kwargs: Additional strategy-specific parameters

        Returns:
            List of Chunk objects
        """
        ...


class FixedLengthChunker(ChunkingStrategy):
    """
    固定长度分块策略。

    按固定 token 数量切分文本，支持 overlap。
    适用场景：结构化程度低的通用文本。
    """

    def split(self, text: str, source_uri: str = "", **kwargs) -> List[Chunk]:
        """Split text into fixed-length chunks by tokens or characters."""
        if not text:
            return []

        # Use tiktoken if available, otherwise use character-based chunking
        if self._use_tiktoken and self.encoding:
            return self._split_by_tokens(text, source_uri)
        else:
            return self._split_by_chars(text, source_uri)

    def _split_by_tokens(self, text: str, source_uri: str) -> List[Chunk]:
        """Split by tokens using tiktoken."""
        tokens = self.encoding.encode(text)
        total_tokens = len(tokens)

        if total_tokens == 0:
            return []

        # Ensure overlap < chunk_size to prevent infinite loop
        effective_overlap = min(self.chunk_overlap, self.chunk_size - 1)

        chunks: List[Chunk] = []
        index = 0
        token_start = 0

        while token_start < total_tokens:
            token_end = min(token_start + self.chunk_size, total_tokens)
            chunk_tokens = tokens[token_start:token_end]
            chunk_text = self.encoding.decode(chunk_tokens)

            chunks.append(
                Chunk(
                    content=chunk_text,
                    index=index,
                    start_char=0,
                    end_char=len(chunk_text),
                    token_count=len(chunk_tokens),
                    metadata={
                        "source_uri": source_uri,
                        "strategy": "fixed_length",
                        "chunk_size": self.chunk_size,
                        "overlap": self.chunk_overlap,
                    },
                )
            )

            if token_end >= total_tokens:
                break
            # Use effective_overlap to ensure forward progress
            token_start = token_end - effective_overlap
            index += 1

        return chunks

    def _split_by_chars(self, text: str, source_uri: str) -> List[Chunk]:
        """Split by characters (fallback when tiktoken unavailable)."""
        # Convert token-based sizes to character-based
        char_size = self.chunk_size * self.CHARS_PER_TOKEN
        char_overlap = self.chunk_overlap * self.CHARS_PER_TOKEN

        # Ensure overlap < size to prevent infinite loop
        effective_char_overlap = min(char_overlap, char_size - 1)

        total_chars = len(text)
        if total_chars == 0:
            return []

        chunks: List[Chunk] = []
        index = 0
        char_start = 0

        while char_start < total_chars:
            char_end = min(char_start + char_size, total_chars)
            chunk_text = text[char_start:char_end]

            chunks.append(
                Chunk(
                    content=chunk_text,
                    index=index,
                    start_char=char_start,
                    end_char=char_end,
                    token_count=len(chunk_text) // self.CHARS_PER_TOKEN,
                    metadata={
                        "source_uri": source_uri,
                        "strategy": "fixed_length",
                        "chunk_size": self.chunk_size,
                        "overlap": self.chunk_overlap,
                        "mode": "character",
                    },
                )
            )

            if char_end >= total_chars:
                break
            char_start = char_end - effective_char_overlap
            index += 1

        return chunks


class RecursiveChunker(ChunkingStrategy):
    """
    递归分块策略。

    优先按段落、句子、词边界切分，保持语义完整性。
    适用场景：结构化文档（Markdown、技术文档）。
    """

    # 分隔符优先级（从高到低）
    SEPARATORS = [
        "\n\n",  # 段落
        "\n",  # 换行
        "。",  # 中文句号
        ".",  # 英文句号
        "！",
        "!",
        "？",
        "?",
        "；",
        ";",
        "，",
        ",",
        " ",  # 空格（词边界）
        "",  # 字符级别（最后手段）
    ]

    def split(self, text: str, source_uri: str = "", **kwargs) -> List[Chunk]:
        chunks = self._recursive_split(text, self.SEPARATORS)

        result: List[Chunk] = []
        current_chunk = ""
        current_start = 0

        for i, chunk in enumerate(chunks):
            # Check if adding this chunk exceeds limit
            combined = current_chunk + chunk if current_chunk else chunk
            if self._count_tokens(combined) <= self.chunk_size:
                current_chunk = combined
            else:
                # Save current chunk if not empty
                if current_chunk:
                    result.append(
                        Chunk(
                            content=current_chunk.strip(),
                            index=len(result),
                            start_char=current_start,
                            end_char=current_start + len(current_chunk),
                            token_count=self._count_tokens(current_chunk),
                            metadata={
                                "source_uri": source_uri,
                                "strategy": "recursive",
                            },
                        )
                    )
                    current_start += len(current_chunk)

                # Start new chunk with overlap
                if self.chunk_overlap > 0 and result:
                    # Add overlap from previous chunk
                    overlap_text = self._get_overlap_text(current_chunk)
                    current_chunk = overlap_text + chunk
                else:
                    current_chunk = chunk

        # Don't forget the last chunk
        if current_chunk.strip():
            result.append(
                Chunk(
                    content=current_chunk.strip(),
                    index=len(result),
                    start_char=current_start,
                    end_char=current_start + len(current_chunk),
                    token_count=self._count_tokens(current_chunk),
                    metadata={
                        "source_uri": source_uri,
                        "strategy": "recursive",
                    },
                )
            )

        return result

    def _recursive_split(self, text: str, separators: List[str]) -> List[str]:
        """Recursively split text using separators in priority order."""
        if not separators:
            return [text]

        separator = separators[0]
        remaining_separators = separators[1:]

        if separator == "":
            # Character-level split as last resort
            return list(text)

        splits = text.split(separator)

        # If no splits happened, try next separator
        if len(splits) == 1:
            return self._recursive_split(text, remaining_separators)

        # Add separator back to maintain text integrity
        result = []
        for i, split in enumerate(splits):
            if i < len(splits) - 1:
                result.append(split + separator)
            else:
                result.append(split)

        return result

    def _get_overlap_text(self, text: str) -> str:
        """Get overlap text from end of chunk."""
        tokens = self.encoding.encode(text)
        if len(tokens) <= self.chunk_overlap:
            return text
        overlap_tokens = tokens[-self.chunk_overlap :]
        return self._decode_tokens(overlap_tokens)


class SemanticChunker(ChunkingStrategy):
    """
    语义分块策略。

    使用嵌入向量计算语义边界，在语义变化点切分。
    适用场景：长篇论文、主题多变的文档。

    Note: 需要 embedding 模型，默认使用 sentence-transformers。
    """

    def __init__(
        self,
        chunk_size: int = 512,
        chunk_overlap: int = 50,
        encoding_name: str = "cl100k_base",
        similarity_threshold: float = 0.5,
        embedding_model: str = "all-MiniLM-L6-v2",
    ):
        super().__init__(chunk_size, chunk_overlap, encoding_name)
        self.similarity_threshold = similarity_threshold
        self.embedding_model_name = embedding_model
        self._model = None

    def _get_embedding_model(self):
        """Lazy load embedding model."""
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer

                self._model = SentenceTransformer(self.embedding_model_name)
            except ImportError:
                raise ImportError(
                    "sentence-transformers is required for SemanticChunker. "
                    "Install with: pip install sentence-transformers"
                )
        return self._model

    def _compute_similarity(self, text1: str, text2: str) -> float:
        """Compute cosine similarity between two texts."""
        import numpy as np

        model = self._get_embedding_model()
        embeddings = model.encode([text1, text2])
        similarity = np.dot(embeddings[0], embeddings[1]) / (
            np.linalg.norm(embeddings[0]) * np.linalg.norm(embeddings[1])
        )
        return float(similarity)

    def split(self, text: str, source_uri: str = "", **kwargs) -> List[Chunk]:
        # First, split into sentences
        sentences = self._split_into_sentences(text)

        if len(sentences) <= 1:
            return [
                Chunk(
                    content=text,
                    index=0,
                    token_count=self._count_tokens(text),
                    metadata={"source_uri": source_uri, "strategy": "semantic"},
                )
            ]

        # Find semantic boundaries
        boundaries = [0]
        for i in range(1, len(sentences)):
            prev_text = " ".join(sentences[max(0, i - 2) : i])
            next_text = " ".join(sentences[i : min(len(sentences), i + 2)])

            similarity = self._compute_similarity(prev_text, next_text)
            if similarity < self.similarity_threshold:
                boundaries.append(i)
        boundaries.append(len(sentences))

        # Create chunks from boundaries
        chunks: List[Chunk] = []
        for i in range(len(boundaries) - 1):
            start_idx = boundaries[i]
            end_idx = boundaries[i + 1]
            chunk_text = " ".join(sentences[start_idx:end_idx])

            # Check if chunk exceeds size, split if needed
            if self._count_tokens(chunk_text) > self.chunk_size:
                # Fall back to recursive splitting for large chunks
                sub_chunker = RecursiveChunker(self.chunk_size, self.chunk_overlap)
                sub_chunks = sub_chunker.split(chunk_text, source_uri)
                for sub_chunk in sub_chunks:
                    sub_chunk.index = len(chunks)
                    sub_chunk.metadata["strategy"] = "semantic"
                    chunks.append(sub_chunk)
            else:
                chunks.append(
                    Chunk(
                        content=chunk_text,
                        index=len(chunks),
                        token_count=self._count_tokens(chunk_text),
                        metadata={"source_uri": source_uri, "strategy": "semantic"},
                    )
                )

        return chunks

    def _split_into_sentences(self, text: str) -> List[str]:
        """Split text into sentences."""
        # Simple sentence splitting (can be improved with NLTK/spaCy)
        pattern = r"(?<=[.!?。！？])\s+"
        sentences = re.split(pattern, text)
        return [s.strip() for s in sentences if s.strip()]


class HierarchicalChunker(ChunkingStrategy):
    """
    层次分块策略。

    创建 Parent-Child 层次结构，父块用于上下文，子块用于检索。
    适用场景：法律合同、技术规范等需要精确定位的文档。
    """

    def __init__(
        self,
        parent_chunk_size: int = 1024,
        child_chunk_size: int = 256,
        chunk_overlap: int = 50,
        encoding_name: str = "cl100k_base",
    ):
        super().__init__(child_chunk_size, chunk_overlap, encoding_name)
        self.parent_chunk_size = parent_chunk_size
        self.child_chunk_size = child_chunk_size

    def split(self, text: str, source_uri: str = "", **kwargs) -> List[Chunk]:
        # First, create parent chunks
        parent_chunker = RecursiveChunker(
            chunk_size=self.parent_chunk_size,
            chunk_overlap=0,  # No overlap for parents
        )
        parent_chunks = parent_chunker.split(text, source_uri)

        # Then, create child chunks for each parent
        child_chunker = RecursiveChunker(
            chunk_size=self.child_chunk_size,
            chunk_overlap=self.chunk_overlap,
        )

        all_chunks: List[Chunk] = []

        for parent in parent_chunks:
            parent_id = f"parent_{parent.index}"
            parent.metadata["is_parent"] = True
            parent.metadata["chunk_id"] = parent_id
            parent.metadata["strategy"] = "hierarchical"

            # Create children
            children = child_chunker.split(parent.content, source_uri)
            child_ids = []

            for child in children:
                child_id = f"child_{parent.index}_{child.index}"
                child.parent_id = parent_id
                child.metadata["is_parent"] = False
                child.metadata["chunk_id"] = child_id
                child.metadata["parent_id"] = parent_id
                child.metadata["strategy"] = "hierarchical"
                child_ids.append(child_id)
                all_chunks.append(child)

            parent.children_ids = child_ids
            all_chunks.append(parent)

        # Re-index all chunks
        for i, chunk in enumerate(all_chunks):
            chunk.index = i

        return all_chunks


# ============================================
# Factory function for easy strategy selection
# ============================================


def get_chunker(
    strategy: str = "recursive",
    chunk_size: int = 512,
    chunk_overlap: int = 50,
    **kwargs,
) -> ChunkingStrategy:
    """
    Factory function to create a chunking strategy.

    Args:
        strategy: One of "fixed", "recursive", "semantic", "hierarchical"
        chunk_size: Target chunk size in tokens
        chunk_overlap: Overlap between chunks
        **kwargs: Strategy-specific parameters

    Returns:
        ChunkingStrategy instance
    """
    strategies = {
        "fixed": FixedLengthChunker,
        "fixed_length": FixedLengthChunker,
        "recursive": RecursiveChunker,
        "semantic": SemanticChunker,
        "hierarchical": HierarchicalChunker,
    }

    if strategy not in strategies:
        raise ValueError(f"Unknown strategy: {strategy}. Available: {list(strategies.keys())}")

    # HierarchicalChunker uses different parameter names
    if strategy == "hierarchical":
        parent_size = kwargs.pop("parent_chunk_size", chunk_size * 2)
        child_size = kwargs.pop("child_chunk_size", chunk_size)
        return HierarchicalChunker(
            parent_chunk_size=parent_size,
            child_chunk_size=child_size,
            chunk_overlap=chunk_overlap,
            **kwargs,
        )

    return strategies[strategy](
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        **kwargs,
    )


# ============================================
# Convenience functions
# ============================================


def chunk_text(
    text: str,
    strategy: str = "recursive",
    chunk_size: int = 512,
    chunk_overlap: int = 50,
    source_uri: str = "",
    **kwargs,
) -> List[Chunk]:
    """
    Convenience function to chunk text with a single call.

    Args:
        text: Input text to chunk
        strategy: Chunking strategy name
        chunk_size: Target chunk size in tokens
        chunk_overlap: Overlap between chunks
        source_uri: Source file URI
        **kwargs: Strategy-specific parameters

    Returns:
        List of Chunk objects
    """
    chunker = get_chunker(strategy, chunk_size, chunk_overlap, **kwargs)
    return chunker.split(text, source_uri=source_uri, **kwargs)
