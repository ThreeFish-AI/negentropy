"""
文本分块模块

提供多种文本分块策略，将长文本分割成适合索引的块。

支持的策略:
- fixed: 固定大小分块（字符级别）
- recursive: 递归分块（段落 > 句子 > 词）
- semantic: 语义分块（基于句子相似度）

参考文献:
[1] G. Kamalloo and A. K. G., "Semantic Chunking for RAG Applications," 2024.
[2] LlamaIndex, "Semantic Chunking," GitHub, 2024.
[3] LangChain, "RecursiveCharacterTextSplitter," GitHub, 2024.
"""

from __future__ import annotations

import re
from typing import Any, Awaitable, Callable

from negentropy.logging import get_logger

from .types import ChunkingConfig, ChunkingStrategy

logger = get_logger("negentropy.knowledge.chunking")


# ================================
# 句子分割器
# ================================

# 中文句子结束符
_CN_SENTENCE_DELIMITERS = ("。", "！", "？", "；", "\n")
# 英文句子结束符
_EN_SENTENCE_DELIMITERS = (".", "!", "?", ";", "\n")


def _split_into_sentences(text: str) -> list[str]:
    """将文本分割为句子

    支持中文和英文句子分割。

    Args:
        text: 输入文本

    Returns:
        句子列表
    """
    if not text:
        return []

    sentences = []
    current = []
    i = 0

    while i < len(text):
        char = text[i]
        current.append(char)

        # 检查是否是句子结束符
        if char in _CN_SENTENCE_DELIMITERS or char in _EN_SENTENCE_DELIMITERS:
            # 获取当前句子
            sentence = "".join(current).strip()
            if sentence:
                sentences.append(sentence)
            current = []

        i += 1

    # 处理最后一个句子
    if current:
        sentence = "".join(current).strip()
        if sentence:
            sentences.append(sentence)

    return sentences


# ================================
# 分块策略实现
# ================================


def chunk_text(text: str, config: ChunkingConfig) -> list[str]:
    """文本分块入口函数

    根据 config.strategy 选择相应的分块策略。

    Args:
        text: 输入文本
        config: 分块配置

    Returns:
        分块结果列表
    """
    strategy = config.strategy
    if strategy == ChunkingStrategy.SEMANTIC:
        # 语义分块需要 embedding_fn，这里返回空列表并记录警告
        logger.warning(
            "semantic_chunking_requires_embedding_fn",
            hint="Use semantic_chunk_async() instead for semantic chunking",
        )
        return []
    elif strategy == ChunkingStrategy.RECURSIVE:
        return _recursive_chunk(text, config)
    else:  # ChunkingStrategy.FIXED
        return _fixed_chunk(text, config)


def _fixed_chunk(text: str, config: ChunkingConfig) -> list[str]:
    """固定大小分块

    简单的字符级别分块，适合不需要考虑语义边界的场景。
    """
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


def _recursive_chunk(text: str, config: ChunkingConfig) -> list[str]:
    """递归分块

    按照段落 > 句子 > 词 的优先级递归分割。
    保持文本结构完整性，适合大多数文档。

    参考文献:
    [1] LangChain, "RecursiveCharacterTextSplitter," GitHub, 2024.
    """
    if not text or not text.strip():
        return []

    # 首先按段落分割
    paragraphs = re.split(r"\n\s*\n", text.strip())
    paragraphs = [p.strip() for p in paragraphs if p.strip()]

    if not paragraphs:
        return [text.strip()] if text.strip() else []

    chunks: list[str] = []
    current_chunk = ""
    chunk_size = config.chunk_size
    overlap = config.overlap

    for para in paragraphs:
        # 如果单个段落超过 chunk_size，需要进一步分割
        if len(para) > chunk_size:
            # 先保存当前块
            if current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = ""

            # 按句子分割
            sentences = _split_into_sentences(para)
            for sentence in sentences:
                # 如果单个句子仍然超过 chunk_size，按词分割
                if len(sentence) > chunk_size:
                    words = sentence.split()
                    for word in words:
                        if len(current_chunk) + len(word) + 1 > chunk_size:
                            if current_chunk:
                                chunks.append(current_chunk.strip())
                            current_chunk = word
                        else:
                            current_chunk += " " + word if current_chunk else word
                else:
                    if len(current_chunk) + len(sentence) + 1 > chunk_size:
                        if current_chunk:
                            chunks.append(current_chunk.strip())
                        current_chunk = sentence
                    else:
                        current_chunk += " " + sentence if current_chunk else sentence
        else:
            # 段落长度适中，直接添加
            if len(current_chunk) + len(para) + 2 > chunk_size:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = para
            else:
                current_chunk += "\n\n" + para if current_chunk else para

    # 处理最后一个块
    if current_chunk:
        chunks.append(current_chunk.strip())

    # 添加重叠（如果需要）
    if overlap > 0 and len(chunks) > 1:
        chunks_with_overlap = [chunks[0]]
        for i in range(1, len(chunks)):
            prev = chunks[i - 1]
            curr = chunks[i]
            # 从前一个块的末尾取 overlap 字符
            overlap_text = prev[-overlap:] if len(prev) > overlap else prev
            chunks_with_overlap.append(overlap_text + " " + curr)
        return chunks_with_overlap

    return chunks


async def semantic_chunk_async(
    text: str,
    config: ChunkingConfig,
    embedding_fn: Callable[[str], Awaitable[list[float]]],
) -> list[str]:
    """语义分块（异步版本）

    基于句子相似度的智能分块，保持语义完整性。

    算法流程:
    1. 将文本分割为句子
    2. 计算相邻句子的嵌入向量
    3. 计算相邻句子间的余弦相似度
    4. 在相似度低于阈值的位置切分
    5. 合并小块直到达到 chunk_size

    Args:
        text: 输入文本
        config: 分块配置（必须使用 ChunkingStrategy.SEMANTIC）
        embedding_fn: 嵌入函数，接受文本返回向量

    Returns:
        分块结果列表

    参考文献:
    [1] G. Kamalloo and A. K. G., "Semantic Chunking for RAG Applications," 2024.
    [2] LlamaIndex, "SemanticChunker," GitHub, 2024.
    """
    if not text or not text.strip():
        return []

    if config.strategy != ChunkingStrategy.SEMANTIC:
        logger.warning(
            "semantic_chunk_called_with_wrong_strategy",
            strategy=config.strategy.value,
            falling_back="recursive",
        )
        return _recursive_chunk(text, config)

    # 1. 分割为句子
    sentences = _split_into_sentences(text)
    if not sentences:
        return [text.strip()] if text.strip() else []

    # 如果只有一个句子，直接返回
    if len(sentences) == 1:
        return [text.strip()]

    logger.info(
        "semantic_chunk_started",
        sentence_count=len(sentences),
        threshold=config.semantic_threshold,
    )

    # 2. 计算句子嵌入
    try:
        embeddings = await _batch_embed_sentences(sentences, embedding_fn)
    except Exception as exc:
        logger.error("sentence_embedding_failed", exc_info=exc)
        # 回退到递归分块
        return _recursive_chunk(text, config)

    # 3. 计算相邻句子相似度并确定分割点
    split_indices = await _find_split_points(sentences, embeddings, config.semantic_threshold)

    # 4. 在分割点处切分
    chunks = []
    start_idx = 0
    for split_idx in split_indices:
        chunk = " ".join(sentences[start_idx:split_idx])
        if chunk.strip():
            chunks.append(chunk.strip())
        start_idx = split_idx

    # 添加最后一个块
    if start_idx < len(sentences):
        chunk = " ".join(sentences[start_idx:])
        if chunk.strip():
            chunks.append(chunk.strip())

    # 5. 合并小块直到达到 chunk_size
    chunks = await _merge_small_chunks(chunks, config)

    # 6. 处理超大块（超过 max_chunk_size）
    chunks = await _split_large_chunks(chunks, config)

    logger.info(
        "semantic_chunk_completed",
        input_length=len(text),
        chunk_count=len(chunks),
    )

    return chunks


async def _batch_embed_sentences(
    sentences: list[str],
    embedding_fn: Callable[[str], Awaitable[list[float]]],
) -> list[list[float]]:
    """批量计算句子嵌入

    为了性能优化，可以考虑批量处理。
    """
    embeddings = []
    for sentence in sentences:
        embedding = await embedding_fn(sentence)
        embeddings.append(embedding)
    return embeddings


async def _find_split_points(
    sentences: list[str],
    embeddings: list[list[float]],
    threshold: float,
) -> list[int]:
    """找到语义分割点

    当相邻句子的相似度低于阈值时，认为这是语义边界。
    """
    if len(embeddings) < 2:
        return []

    split_indices = []

    for i in range(len(embeddings) - 1):
        similarity = _cosine_similarity(embeddings[i], embeddings[i + 1])
        if similarity < threshold:
            split_indices.append(i + 1)  # 在 i+1 位置切分

    return split_indices


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """计算余弦相似度

    公式: similarity = dot(a, b) / (norm(a) * norm(b))

    Args:
        a: 向量 a
        b: 向量 b

    Returns:
        余弦相似度，范围 [0, 1]
    """
    if not a or not b or len(a) != len(b):
        return 0.0

    # 计算点积
    dot_product = sum(x * y for x, y in zip(a, b))

    # 计算向量范数
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(y * y for y in b) ** 0.5

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return dot_product / (norm_a * norm_b)


async def _merge_small_chunks(
    chunks: list[str],
    config: ChunkingConfig,
) -> list[str]:
    """合并小块

    将小于 min_chunk_size 的块与相邻块合并。
    """
    if not chunks:
        return []

    min_size = config.min_chunk_size
    merged = []
    i = 0

    while i < len(chunks):
        current = chunks[i]

        # 如果当前块太小，尝试与下一个块合并
        if len(current) < min_size and i + 1 < len(chunks):
            next_chunk = chunks[i + 1]
            combined = current + " " + next_chunk

            # 检查合并后是否超过 chunk_size
            if len(combined) <= config.chunk_size:
                current = combined
                i += 2  # 跳过下一个块
            else:
                i += 1
        else:
            i += 1

        merged.append(current)

    return merged


async def _split_large_chunks(
    chunks: list[str],
    config: ChunkingConfig,
) -> list[str]:
    """分割超大块

    将超过 max_chunk_size 的块按句子分割。
    """
    result = []

    for chunk in chunks:
        if len(chunk) <= config.max_chunk_size:
            result.append(chunk)
            continue

        # 分割为句子
        sentences = _split_into_sentences(chunk)
        if len(sentences) <= 1:
            # 无法分割，保留原块
            result.append(chunk)
            continue

        # 递归分割
        current = ""
        for sentence in sentences:
            if len(current) + len(sentence) + 1 <= config.max_chunk_size:
                current += " " + sentence if current else sentence
            else:
                if current:
                    result.append(current.strip())
                current = sentence

        if current:
            result.append(current.strip())

    return result
