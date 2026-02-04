from __future__ import annotations

from .types import ChunkingConfig


def chunk_text(text: str, config: ChunkingConfig) -> list[str]:
    cleaned = text.strip()
    if not cleaned:
        return []

    chunk_size = max(1, config.chunk_size)
    overlap = min(max(0, config.overlap), chunk_size - 1)
    step = max(1, chunk_size - overlap)

    chunks: list[str] = []
    start = 0
    length = len(cleaned)
    while start < length:
        end = min(length, start + chunk_size)
        chunk = cleaned[start:end]
        if not config.preserve_newlines:
            chunk = " ".join(chunk.splitlines())
        chunk = chunk.strip()
        if chunk:
            chunks.append(chunk)
        start += step

    return chunks
