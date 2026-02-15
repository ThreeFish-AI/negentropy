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
from typing import Any, Awaitable, Callable, Literal

from negentropy.logging import get_logger

from .types import ChunkingConfig, ChunkingStrategy

logger = get_logger("negentropy.knowledge.chunking")


# ================================
# Word Boundary Protection
# ================================

# 英文字符正则表达式（用于单词边界检测）
_EN_WORD_PATTERN = re.compile(r"[a-zA-Z]")

# 单词边界调整的默认最大比例（相对于 chunk_size）
_DEFAULT_MAX_ADJUSTMENT_RATIO = 0.3


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
# Word Boundary Utilities
# ================================


def _find_word_boundary(
    text: str,
    position: int,
    direction: Literal["left", "right"],
    max_adjustment: int = 50,
) -> int:
    """查找最近的单词边界位置

    对于英文文本，找到最近的空格字符作为边界。
    对于中文文本，由于不需要特殊处理，返回原位置。

    Args:
        text: 输入文本
        position: 当前位置
        direction: 搜索方向，"left" 向左搜索（返回单词起始位置），
                   "right" 向右搜索（返回单词结束位置）
        max_adjustment: 最大调整距离，超过此距离则返回原位置

    Returns:
        调整后的边界位置，如果找不到合适边界则返回原位置
    """
    if position < 0:
        return 0
    if position >= len(text):
        return len(text)

    # 当前字符
    current_char = text[position] if position < len(text) else ""

    # 如果当前位置已经是空格或边界，直接返回
    if current_char == " " or current_char == "":
        return position

    # 判断当前字符是否为英文
    is_current_en = bool(_EN_WORD_PATTERN.match(current_char))

    if not is_current_en:
        # 当前字符不是英文，不需要调整
        return position

    if direction == "left":
        # 向左搜索，找到单词起始位置
        search_start = max(0, position - max_adjustment)

        # 首先尝试找空格
        for i in range(position - 1, search_start - 1, -1):
            if i >= 0 and text[i] == " ":
                return i + 1  # 返回空格后的位置

        # 如果没找到空格，找非英文字符
        for i in range(position - 1, search_start - 1, -1):
            if i >= 0 and not _EN_WORD_PATTERN.match(text[i]):
                return i + 1  # 返回非英文字符后的位置

        return position

    else:  # direction == "right"
        # 向右搜索，找到单词结束位置
        search_end = min(len(text), position + max_adjustment + 1)

        # 首先尝试找空格
        for i in range(position, search_end):
            if text[i] == " ":
                return i  # 返回空格位置

        # 如果没找到空格，找非英文字符
        for i in range(position, search_end):
            if not _EN_WORD_PATTERN.match(text[i]):
                return i  # 返回非英文字符位置

        return position


def _adjust_chunk_boundary(
    text: str,
    start: int,
    end: int,
    chunk_size: int,
    max_adjustment_ratio: float = _DEFAULT_MAX_ADJUSTMENT_RATIO,
) -> tuple[int, int]:
    """调整分块边界以保护英文单词完整性

    Args:
        text: 输入文本
        start: 当前分块起始位置
        end: 当前分块结束位置
        chunk_size: 目标分块大小
        max_adjustment_ratio: 最大调整比例（相对于 chunk_size）

    Returns:
        调整后的 (start, end) 元组
    """
    if end >= len(text):
        return start, end

    # 使用更大的搜索范围，但调整结果受 max_adj 限制
    max_adj = max(1, int(chunk_size * max_adjustment_ratio))
    search_range = max(50, max_adj * 5)
    original_end = end

    # 检查 end 位置是否在英文单词中间
    if end > 0 and end < len(text):
        prev_char = text[end - 1]
        next_char = text[end]

        # 如果前后都是英文字符，说明切在了单词中间
        if _EN_WORD_PATTERN.match(prev_char) and _EN_WORD_PATTERN.match(next_char):
            # 优先向左找边界（缩短 chunk）
            new_end = _find_word_boundary(text, end, "left", search_range)

            # 检查是否找到了真正的单词边界，且调整幅度在限制内
            is_valid_boundary = (
                new_end != end
                and new_end > start
                and original_end - new_end <= max_adj  # 调整幅度在限制内
                and (new_end == 0 or text[new_end - 1] == " " or not _EN_WORD_PATTERN.match(text[new_end - 1]))
            )
            if is_valid_boundary:
                end = new_end
            else:
                # 尝试向右找边界（延长 chunk）
                new_end = _find_word_boundary(text, end, "right", search_range)
                is_valid_right = (
                    new_end != end
                    and new_end - original_end <= max_adj  # 调整幅度在限制内
                    and new_end < len(text)
                    and (text[new_end] == " " or not _EN_WORD_PATTERN.match(text[new_end]))
                )
                if is_valid_right:
                    end = new_end

    # 检查 start 位置是否在英文单词中间（针对有 overlap 的情况）
    if start > 0 and start < len(text):
        prev_char = text[start - 1]
        curr_char = text[start]

        if _EN_WORD_PATTERN.match(prev_char) and _EN_WORD_PATTERN.match(curr_char):
            new_start = _find_word_boundary(text, start, "right", search_range)
            is_valid = (
                new_start != start
                and new_start < end
                and new_start - start <= max_adj
                and (text[new_start - 1] == " " or not _EN_WORD_PATTERN.match(text[new_start - 1]))
            )
            if is_valid:
                start = new_start

    return start, end


def _get_word_safe_overlap(
    prev_chunk: str,
    overlap_size: int,
    max_adjustment_ratio: float = 0.15,
) -> str:
    """获取保护单词完整性的重叠文本

    从前一个块的末尾提取 overlap_size 大小的文本，
    但确保不会在英文单词中间切分。

    Args:
        prev_chunk: 前一个分块
        overlap_size: 期望的重叠大小
        max_adjustment_ratio: 最大调整比例

    Returns:
        调整后的重叠文本
    """
    if len(prev_chunk) <= overlap_size:
        return prev_chunk

    max_adj = max(1, int(overlap_size * max_adjustment_ratio))
    overlap_start = len(prev_chunk) - overlap_size

    # 检查是否在英文单词中间
    if overlap_start > 0 and overlap_start < len(prev_chunk):
        prev_char = prev_chunk[overlap_start - 1]
        curr_char = prev_chunk[overlap_start]

        if _EN_WORD_PATTERN.match(prev_char) and _EN_WORD_PATTERN.match(curr_char):
            # 尝试向右找边界（增加 overlap）
            new_start = _find_word_boundary(prev_chunk, overlap_start, "right", max_adj)

            new_overlap_size = len(prev_chunk) - new_start

            # 如果增加后的 overlap 不超过上限，使用新的边界
            if new_overlap_size <= overlap_size + max_adj:
                overlap_start = new_start
            else:
                # 尝试向左找边界（减少 overlap）
                left_start = _find_word_boundary(prev_chunk, overlap_start, "left", max_adj)
                if left_start != overlap_start and left_start < len(prev_chunk):
                    overlap_start = left_start

    return prev_chunk[overlap_start:]


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

    支持英文单词完整性保护：切分时会尝试在单词边界处切分，
    避免在英文单词中间切断。
    """
    cleaned = text.strip()
    if not cleaned:
        return []

    chunk_size = max(1, config.chunk_size)
    overlap = min(max(0, config.overlap), chunk_size - 1)

    chunks: list[str] = []
    start = 0
    length = len(cleaned)
    while start < length:
        end = min(length, start + chunk_size)

        # 如果不是最后一块，尝试调整边界以保护单词完整性
        if end < length:
            _, adjusted_end = _adjust_chunk_boundary(cleaned, start, end, chunk_size)
            # 只有当调整后的 end 仍在合理范围内才使用
            if adjusted_end > start:
                end = adjusted_end

        chunk = cleaned[start:end]
        if not config.preserve_newlines:
            chunk = " ".join(chunk.splitlines())
        chunk = chunk.strip()
        if chunk:
            chunks.append(chunk)

        # 计算下一个 start
        # 如果有 overlap，从当前 end 往回退 overlap 个字符
        # 如果没有 overlap，从当前 end 开始
        if overlap > 0 and end < length:
            next_start = max(start + 1, end - overlap)  # 确保至少前进 1 个字符
        else:
            next_start = end
        start = next_start

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
            # 从前一个块的末尾取 overlap 字符，保护单词完整性
            overlap_text = _get_word_safe_overlap(prev, overlap)
            # 连接 overlap 和当前块，处理多余空格
            combined = (overlap_text.rstrip() + " " + curr.lstrip()).strip()
            chunks_with_overlap.append(combined)
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
