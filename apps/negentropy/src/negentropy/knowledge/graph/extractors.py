"""
LLM 增强的知识图谱提取器

基于大语言模型的实体和关系提取器，支持中英文多语言。

相比正则/共现提取器的优势：
1. 支持多语言（中英文）
2. 语义理解，准确率更高
3. 可提取抽象概念和事件
4. 提供置信度分数

参考文献:
[1] J. Wei et al., "Chain-of-thought prompting elicits reasoning in large language models,"
    NeurIPS'22.
[2] Z. Wei et al., "A simple framework for relation extraction," EMNLP'19.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any
from uuid import UUID

import tiktoken

from negentropy.logging import get_logger

if TYPE_CHECKING:
    pass

from ..types import GraphEdge, GraphNode, KgEntityType, KgRelationType

logger = get_logger("negentropy.knowledge.llm_extractors")

# ============================================================================
# KG LLM 调用全局配置（环境变量可覆盖）
# ============================================================================
# 单次 litellm.acompletion 超时（秒）。5 min 确保复杂提取场景充分等待。
KG_LLM_TIMEOUT_SECONDS: float = float(os.environ.get("KG_LLM_TIMEOUT_SECONDS", "300"))
# 全链路最大重试次数（不论嵌套层级，总重试不超过此值）。
# SDK 层 num_retries=0 禁用隐形重试，由应用层统一管控。
KG_LLM_MAX_RETRIES: int = int(os.environ.get("KG_LLM_MAX_RETRIES", "3"))


async def call_llm_with_retry(
    *,
    model: str,
    messages: list[dict[str, str]],
    temperature: float = 0.3,
    max_tokens: int | None = None,
    context_label: str = "kg_llm",
) -> str:
    """带重试的 LLM 调用（KG 系统全局统一保障）。

    策略：SDK 层 ``num_retries=0`` 禁用隐形重试，应用层统一管控。
    单次超时 ``KG_LLM_TIMEOUT_SECONDS``，最大重试 ``KG_LLM_MAX_RETRIES`` 次。
    所有失败后返回空字符串（由调用方决定降级行为）。
    """
    import litellm

    last_error: Exception | None = None
    for attempt in range(KG_LLM_MAX_RETRIES):
        try:
            kwargs: dict[str, Any] = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "timeout": KG_LLM_TIMEOUT_SECONDS,
                "num_retries": 0,
                "max_retries": 0,
            }
            if max_tokens is not None:
                kwargs["max_tokens"] = max_tokens
            response = await litellm.acompletion(**kwargs)
            return response.choices[0].message.content or ""
        except Exception as exc:
            last_error = exc
            logger.warning(
                f"{context_label}_retry",
                attempt=attempt + 1,
                max_retries=KG_LLM_MAX_RETRIES,
                error=str(exc),
            )
            if attempt < KG_LLM_MAX_RETRIES - 1:
                await asyncio.sleep(1.0)

    logger.error(
        f"{context_label}_exhausted",
        error=str(last_error),
        max_retries=KG_LLM_MAX_RETRIES,
    )
    return ""


_DEFAULT_ENCODING = "cl100k_base"
_encoding_cache: tiktoken.Encoding | None = None


def _get_tiktoken_encoding() -> tiktoken.Encoding:
    global _encoding_cache
    if _encoding_cache is None:
        _encoding_cache = tiktoken.get_encoding(_DEFAULT_ENCODING)
    return _encoding_cache


def _truncate_to_token_limit(text: str, max_tokens: int = 3500) -> str:
    """基于 BPE token 计数的截断（替代字符截断 text[:4000]）。

    字符截断的问题：
    - 英文 ~4 chars/token → 4000 chars ≈ 1000 tokens（远低于模型限制）
    - CJK ~2 chars/token → 4000 chars ≈ 2000 tokens（仍有溢出风险）
    Token 截断确保上下文利用率最优且不超限。
    """
    encoding = _get_tiktoken_encoding()
    tokens = encoding.encode(text)
    if len(tokens) <= max_tokens:
        return text
    return encoding.decode(tokens[:max_tokens])


# Backward compatibility aliases (deprecated: use KgEntityType/KgRelationType from types.py)
EntityType = KgEntityType
RelationType = KgRelationType


# ============================================================================
# Extraction Result Types
# ============================================================================


@dataclass(frozen=True)
class EntityExtractionResult:
    """实体提取结果

    LLM 提取的实体信息，包含置信度和来源。
    """

    name: str
    entity_type: str
    description: str | None = None
    confidence: float = 1.0
    source_text: str | None = None  # 来源文本片段
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class RelationExtractionResult:
    """关系提取结果

    LLM 提取的关系信息，包含证据和置信度。
    """

    source_name: str
    target_name: str
    relation_type: str
    description: str | None = None
    confidence: float = 1.0
    evidence: str | None = None  # 支撑文本
    metadata: dict[str, Any] = field(default_factory=dict)


# ============================================================================
# LLM Entity Extractor
# ============================================================================


class LLMEntityExtractor:
    """基于 LLM 的实体提取器

    使用 LLM 结构化输出提取命名实体，支持中英文。

    特性:
    - 支持多语言（中英文）
    - 语义理解，准确率高
    - 可提取抽象概念和事件
    - 提供置信度分数
    - 支持回退到正则提取器

    使用示例:
    ```python
    extractor = LLMEntityExtractor(model="gpt-4o-mini")
    entities = await extractor.extract(text, corpus_id)
    ```
    """

    # 实体提取 Prompt 模板
    EXTRACTION_PROMPT = """Extract named entities from the following text.

Text:
{text}

Instructions:
1. Identify all named entities (people, organizations, locations, events, concepts, products)
2. For each entity, provide:
   - name: The entity name (preserve original language)
   - type: One of [person, organization, location, event, concept, product, other]
   - description: Brief description in 1-2 sentences (optional)
   - confidence: Extraction confidence between 0 and 1

Important:
- Extract entities in their original language (Chinese, English, etc.)
- Only include entities explicitly mentioned in the text
- Assign confidence based on how clearly the entity is identified

Output as JSON with the following structure:
{{"entities": [{{"name": "...", "type": "...", "description": "...", "confidence": 0.9}}]}}"""

    def __init__(
        self,
        model: str | None = None,
        temperature: float = 0.0,
        max_retries: int = KG_LLM_MAX_RETRIES,
        fallback_to_regex: bool = True,
        schema: Any | None = None,
        llm_timeout: float = KG_LLM_TIMEOUT_SECONDS,
    ) -> None:
        """初始化 LLM 实体提取器

        Args:
            model: LLM 模型名称（默认使用配置中的 chat_model）
            temperature: 生成温度（0.0 确保一致性）
            max_retries: 应用层最大重试次数（默认 ``KG_LLM_MAX_RETRIES``）。
                SDK 层已通过 ``num_retries=0`` 禁用隐形重试，全链路重试仅此一层管控。
            fallback_to_regex: 失败时是否回退到正则提取器
            schema: ExtractionSchema 实例，用于约束提取类型
            llm_timeout: 单次 ``litellm.acompletion`` 超时（秒，默认 ``KG_LLM_TIMEOUT_SECONDS``）。
                service 层 ``chunk_extract_timeout`` = max_retries × llm_timeout + backoff，确保外层
                预算覆盖内层重试。
        """
        # 惰性解析模型配置（含 api_key），延迟到首次 _extract_with_llm 调用
        # 因为 __init__ 是同步的，无法调用异步 DB 查询
        self._explicit_model = model
        self._model: str | None = None
        self._model_kwargs: dict[str, Any] = {}
        self._model_config_resolved = False
        self._model_config_lock: asyncio.Lock | None = None
        self._temperature = temperature
        self._max_retries = max_retries
        self._fallback_to_regex = fallback_to_regex
        self._schema = schema
        self._llm_timeout = llm_timeout

    async def _ensure_model_config(self) -> None:
        """异步解析模型配置（含 api_key）。

        解析链：resolve_llm_config_by_model_name → resolve_llm_config → get_fallback_llm_config。
        使用双重检查锁保证并发安全，Lock 惰性创建避免 event loop 问题。
        """
        if self._model_config_resolved:
            return

        if self._model_config_lock is None:
            self._model_config_lock = asyncio.Lock()

        async with self._model_config_lock:
            if self._model_config_resolved:
                return

            model_name: str | None = None
            model_kwargs: dict[str, Any] = {}

            try:
                if self._explicit_model:
                    from negentropy.config.model_resolver import resolve_llm_config_by_model_name

                    resolved = await resolve_llm_config_by_model_name(self._explicit_model)
                    if resolved is not None:
                        model_name, model_kwargs = resolved
                if model_name is None:
                    from negentropy.config.model_resolver import resolve_llm_config

                    model_name, model_kwargs = await resolve_llm_config()
            except Exception:
                logger.warning(
                    "model_config_async_resolve_failed",
                    explicit_model=self._explicit_model,
                    exc_info=True,
                )

            if model_name is None:
                from negentropy.config.model_resolver import get_fallback_llm_config

                model_name, model_kwargs = get_fallback_llm_config()

            self._model = model_name
            self._model_kwargs = model_kwargs
            self._model_config_resolved = True

    async def extract(
        self,
        text: str,
        corpus_id: UUID,
    ) -> list[GraphNode]:
        """从文本中提取实体节点

        使用 LLM 结构化输出提取实体。

        Args:
            text: 输入文本
            corpus_id: 语料库 ID

        Returns:
            提取的实体节点列表
        """
        await self._ensure_model_config()

        logger.debug(
            "llm_extract_entities_started",
            corpus_id=str(corpus_id),
            text_length=len(text),
            model=self._model,
        )

        try:
            results = await self._extract_with_llm(text)

            entities = []
            seen = set()

            for result in results:
                name = result.name.strip()
                if not name or name in seen:
                    continue

                # 生成稳定的实体 ID（基于名称哈希）
                entity_id = self._generate_entity_id(name, corpus_id)

                entity = GraphNode(
                    id=entity_id,
                    label=name,
                    node_type=result.entity_type,
                    metadata={
                        "description": result.description,
                        "confidence": result.confidence,
                        "source": "llm_extraction",
                        "source_text": result.source_text,
                        "corpus_id": str(corpus_id),
                        "model": self._model,
                    },
                )
                entities.append(entity)
                seen.add(name)

            logger.debug(
                "llm_extract_entities_completed",
                corpus_id=str(corpus_id),
                entity_count=len(entities),
                model=self._model,
            )

            return entities

        except Exception as exc:
            logger.error(
                "llm_extract_entities_failed",
                corpus_id=str(corpus_id),
                error=str(exc),
            )

            if self._fallback_to_regex:
                logger.info("falling_back_to_regex_extractor", corpus_id=str(corpus_id))
                return await self._fallback_extract(text, corpus_id)

            raise

    async def _extract_with_llm(self, text: str) -> list[EntityExtractionResult]:
        """使用 LLM 提取实体

        Args:
            text: 输入文本

        Returns:
            实体提取结果列表
        """
        import litellm

        # Token 感知截断：英文 4000 chars ≈ 1000 token（浪费），CJK 4000 chars ≈ 2000 token（风险）
        truncated_text = _truncate_to_token_limit(text, max_tokens=3500)

        prompt = self.EXTRACTION_PROMPT.format(text=truncated_text)

        # Schema-guided 增强提示 (Martinez-Rodriguez et al., 2018)
        if self._schema is not None:
            schema_block = self._schema.format_for_prompt()
            type_names = ", ".join(et.name for et in self._schema.entity_types)
            prompt = (
                f"Extract named entities from the following text.\n\n"
                f"Text:\n{truncated_text}\n\n"
                f"Instructions:\n"
                f"1. Identify entities matching ONLY these types: [{type_names}]\n"
                f"2. For each entity, provide:\n"
                f"   - name: The entity name (preserve original language)\n"
                f"   - type: One of [{type_names}]\n"
                f"   - description: Brief description in 1-2 sentences (optional)\n"
                f"   - confidence: Extraction confidence between 0 and 1\n\n"
                f"{schema_block}\n\n"
                f"Output as JSON: "
                f'{{"entities": [{{"name": "...", "type": "...", '
                f'"description": "...", "confidence": 0.9}}]}}'
            )

        # 重试逻辑（全链路唯一重试层；SDK 层 num_retries=0 已禁用隐形重试）
        last_error = None
        for attempt in range(self._max_retries):
            try:
                # 过滤掉与显式参数冲突的 kwargs 键
                safe_kwargs = {
                    k: v
                    for k, v in self._model_kwargs.items()
                    if k
                    not in (
                        "model",
                        "messages",
                        "temperature",
                        "response_format",
                        "timeout",
                        "num_retries",
                        "max_retries",
                    )
                }
                # num_retries=0 + max_retries=0：禁用 litellm/OpenAI SDK 内部隐形重试，
                # 全链路重试由本 for 循环统一管控（上限 KG_LLM_MAX_RETRIES）。
                response = await litellm.acompletion(
                    model=self._model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=self._temperature,
                    response_format={"type": "json_object"},
                    timeout=self._llm_timeout,
                    num_retries=0,
                    max_retries=0,
                    **safe_kwargs,
                )

                content = response.choices[0].message.content
                return self._parse_entity_response(content)

            except Exception as exc:
                last_error = exc
                logger.warning(
                    "llm_extraction_retry",
                    attempt=attempt + 1,
                    max_retries=self._max_retries,
                    error=str(exc),
                    timeout_seconds=self._llm_timeout,
                )
                await asyncio.sleep(1.0)  # 固定 1s 退避，加速失败让 fallback 接管

        raise RuntimeError(f"LLM entity extraction failed after {self._max_retries} retries: {last_error}")

    def _parse_entity_response(self, content: str) -> list[EntityExtractionResult]:
        """解析 LLM 响应为实体列表

        Args:
            content: LLM 返回的 JSON 字符串

        Returns:
            实体提取结果列表
        """
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            logger.warning("llm_response_not_json", content_preview=content[:200])
            return []

        entities = data.get("entities", [])
        if not isinstance(entities, list):
            return []

        results = []
        for entity_data in entities:
            if not isinstance(entity_data, dict):
                continue

            name = entity_data.get("name", "").strip()
            if not name:
                continue

            entity_type = entity_data.get("type", KgEntityType.OTHER.value)
            if entity_type not in KgEntityType.all_values():
                entity_type = KgEntityType.OTHER.value

            result = EntityExtractionResult(
                name=name,
                entity_type=entity_type,
                description=entity_data.get("description"),
                confidence=float(entity_data.get("confidence", 1.0)),
                source_text=entity_data.get("source_text"),
            )
            results.append(result)

        return results

    def _generate_entity_id(self, name: str, corpus_id: UUID) -> str:
        """生成稳定的实体 ID

        基于名称和语料库 ID 生成确定性 ID，确保同一实体在同一语料库中 ID 一致。

        使用 SHA256 确保跨进程、跨运行的一致性。

        Args:
            name: 实体名称
            corpus_id: 语料库 ID

        Returns:
            实体 ID 字符串
        """
        # 使用 SHA256 生成确定性 ID（跨进程一致）
        hash_input = f"{corpus_id}:{name}"
        hash_value = hashlib.sha256(hash_input.encode()).hexdigest()
        return f"entity:{hash_value[:32]}"

    async def _fallback_extract(
        self,
        text: str,
        corpus_id: UUID,
    ) -> list[GraphNode]:
        """回退到正则提取器

        当 LLM 提取失败时，使用正则提取作为回退。

        Args:
            text: 输入文本
            corpus_id: 语料库 ID

        Returns:
            提取的实体节点列表
        """
        from .strategy import RegexEntityExtractor

        fallback = RegexEntityExtractor()
        return await fallback.extract(text, corpus_id)


# ============================================================================
# LLM Relation Extractor
# ============================================================================


class LLMRelationExtractor:
    """基于 LLM 的关系提取器

    使用 LLM 结构化输出提取实体间关系。

    特性:
    - 提取精确的语义关系类型
    - 提供证据文本
    - 置信度评估
    - 支持回退到共现提取器

    使用示例:
    ```python
    extractor = LLMRelationExtractor(model="gpt-4o-mini")
    relations = await extractor.extract(entities, text)
    ```
    """

    # 关系提取 Prompt 模板 (OpenIE: Banko et al., 2007; HippoRAG: Gutierrez et al., 2024)
    EXTRACTION_PROMPT = """Extract relationships between the following entities found in the text.

Entities:
{entity_names}

Text:
{text}

Instructions:
1. Identify relationships between the entities listed above
2. For each relationship, provide:
   - source: Source entity name (must be from the entity list)
   - target: Target entity name (must be from the entity list)
   - type: Relationship type
   - description: Brief description of the relationship
   - evidence: Exact text from the source that indicates this relationship
   - confidence: Extraction confidence between 0 and 1

Preferred types (use when applicable): {relation_types}
You may also use any descriptive free-text type (e.g. "outperforms", "extends", "benchmarks_against",
"trained_on", "evaluated_on", "introduces", "validates", "contradicts") when it better captures the relationship.

Important:
- Only create relationships between entities from the provided list
- Use the most specific and descriptive relationship type available
- Include the exact text evidence when possible

Output as JSON with the following structure:
{{"relations": [{{"source": "...", "target": "...", "type": "...",
"description": "...", "evidence": "...", "confidence": 0.9}}]}}"""

    def __init__(
        self,
        model: str | None = None,
        temperature: float = 0.0,
        max_retries: int = KG_LLM_MAX_RETRIES,
        fallback_to_cooccurrence: bool = True,
        schema: Any | None = None,
        llm_timeout: float = KG_LLM_TIMEOUT_SECONDS,
    ) -> None:
        """初始化 LLM 关系提取器

        Args:
            model: LLM 模型名称
            temperature: 生成温度
            max_retries: 应用层最大重试次数（默认 ``KG_LLM_MAX_RETRIES``）。
            fallback_to_cooccurrence: 失败时是否回退到共现提取器
            schema: ExtractionSchema 实例，用于约束关系类型
            llm_timeout: 单次 ``litellm.acompletion`` 超时（秒，默认 ``KG_LLM_TIMEOUT_SECONDS``）。
        """
        # 惰性解析模型配置（含 api_key），延迟到首次 _extract_with_llm 调用
        self._explicit_model = model
        self._model: str | None = None
        self._model_kwargs: dict[str, Any] = {}
        self._model_config_resolved = False
        self._model_config_lock: asyncio.Lock | None = None
        self._temperature = temperature
        self._max_retries = max_retries
        self._fallback_to_cooccurrence = fallback_to_cooccurrence
        self._schema = schema
        self._llm_timeout = llm_timeout

    async def _ensure_model_config(self) -> None:
        """异步解析模型配置（含 api_key）。

        解析链：resolve_llm_config_by_model_name → resolve_llm_config → get_fallback_llm_config。
        使用双重检查锁保证并发安全，Lock 惰性创建避免 event loop 问题。
        """
        if self._model_config_resolved:
            return

        if self._model_config_lock is None:
            self._model_config_lock = asyncio.Lock()

        async with self._model_config_lock:
            if self._model_config_resolved:
                return

            model_name: str | None = None
            model_kwargs: dict[str, Any] = {}

            try:
                if self._explicit_model:
                    from negentropy.config.model_resolver import resolve_llm_config_by_model_name

                    resolved = await resolve_llm_config_by_model_name(self._explicit_model)
                    if resolved is not None:
                        model_name, model_kwargs = resolved
                if model_name is None:
                    from negentropy.config.model_resolver import resolve_llm_config

                    model_name, model_kwargs = await resolve_llm_config()
            except Exception:
                logger.warning(
                    "model_config_async_resolve_failed",
                    explicit_model=self._explicit_model,
                    exc_info=True,
                )

            if model_name is None:
                from negentropy.config.model_resolver import get_fallback_llm_config

                model_name, model_kwargs = get_fallback_llm_config()

            self._model = model_name
            self._model_kwargs = model_kwargs
            self._model_config_resolved = True

    async def extract(
        self,
        entities: list[GraphNode],
        text: str,
    ) -> list[GraphEdge]:
        """从文本中提取实体间关系

        Args:
            entities: 实体节点列表
            text: 输入文本

        Returns:
            提取的关系边列表
        """
        await self._ensure_model_config()

        logger.debug(
            "llm_extract_relations_started",
            entity_count=len(entities),
            text_length=len(text),
            model=self._model,
        )

        # 实体数量检查
        if len(entities) < 2:
            logger.debug("insufficient_entities_for_relations", count=len(entities))
            return []

        try:
            results = await self._extract_with_llm(entities, text)

            # 创建实体名称到 ID 的映射
            entity_map = {e.label: e.id for e in entities if e.label}

            edges = []
            seen = set()

            for result in results:
                source_id = entity_map.get(result.source_name)
                target_id = entity_map.get(result.target_name)

                if not source_id or not target_id:
                    continue

                # 去重键
                key = (source_id, target_id, result.relation_type)
                if key in seen:
                    continue

                edge = GraphEdge(
                    source=source_id,
                    target=target_id,
                    label=result.description or result.relation_type,
                    edge_type=result.relation_type,
                    weight=result.confidence,
                    metadata={
                        **result.metadata,
                        "evidence": result.evidence,
                        "confidence": result.confidence,
                        "source": "llm_extraction",
                        "model": self._model,
                    },
                )
                edges.append(edge)
                seen.add(key)

            logger.debug(
                "llm_extract_relations_completed",
                entity_count=len(entities),
                edge_count=len(edges),
                model=self._model,
            )

            return edges

        except Exception as exc:
            logger.error(
                "llm_extract_relations_failed",
                error=str(exc),
            )

            if self._fallback_to_cooccurrence:
                logger.info("falling_back_to_cooccurrence_extractor")
                return await self._fallback_extract(entities, text)

            raise

    async def _extract_with_llm(
        self,
        entities: list[GraphNode],
        text: str,
    ) -> list[RelationExtractionResult]:
        """使用 LLM 提取关系

        Args:
            entities: 实体节点列表
            text: 输入文本

        Returns:
            关系提取结果列表
        """
        import litellm

        # 提取实体名称
        entity_names = [e.label for e in entities if e.label]
        if len(entity_names) < 2:
            return []

        # 限制实体数量（避免 prompt 过长）
        entity_names = entity_names[:50]

        # 截断文本
        truncated_text = _truncate_to_token_limit(text, max_tokens=3500)

        prompt = self.EXTRACTION_PROMPT.format(
            entity_names=json.dumps(entity_names, ensure_ascii=False),
            text=truncated_text,
            relation_types=", ".join(KgRelationType.all_values()),
        )

        # Schema-guided 增强关系提示
        if self._schema is not None:
            rel_type_names = ", ".join(rt.name for rt in self._schema.relation_types)
            schema_block = self._schema.format_relation_types_for_prompt()
            prompt = (
                f"Extract relationships between the following entities found in the text.\n\n"
                f"Entities:\n{json.dumps(entity_names, ensure_ascii=False)}\n\n"
                f"Text:\n{truncated_text}\n\n"
                f"Instructions:\n"
                f"1. Identify relationships between the entities listed above\n"
                f"2. Use ONLY these relation types when applicable: [{rel_type_names}]\n"
                f"3. For each relationship, provide:\n"
                f"   - source: Source entity name\n"
                f"   - target: Target entity name\n"
                f"   - type: Relationship type (prefer from [{rel_type_names}])\n"
                f"   - description: Brief description\n"
                f"   - evidence: Exact text from source\n"
                f"   - confidence: Extraction confidence between 0 and 1\n\n"
                f"{schema_block}\n\n"
                f"Output as JSON: "
                f'{{"relations": [{{"source": "...", "target": "...", "type": "...", '
                f'"description": "...", "evidence": "...", "confidence": 0.9}}]}}'
            )

        # 重试逻辑（全链路唯一重试层；SDK 层 num_retries=0 已禁用隐形重试）
        last_error = None
        for attempt in range(self._max_retries):
            try:
                # 过滤掉与显式参数冲突的 kwargs 键
                safe_kwargs = {
                    k: v
                    for k, v in self._model_kwargs.items()
                    if k
                    not in (
                        "model",
                        "messages",
                        "temperature",
                        "response_format",
                        "timeout",
                        "num_retries",
                        "max_retries",
                    )
                }
                response = await litellm.acompletion(
                    model=self._model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=self._temperature,
                    response_format={"type": "json_object"},
                    timeout=self._llm_timeout,
                    num_retries=0,
                    max_retries=0,
                    **safe_kwargs,
                )

                content = response.choices[0].message.content
                return self._parse_relation_response(content)

            except Exception as exc:
                last_error = exc
                logger.warning(
                    "llm_relation_extraction_retry",
                    attempt=attempt + 1,
                    max_retries=self._max_retries,
                    error=str(exc),
                    timeout_seconds=self._llm_timeout,
                )
                await asyncio.sleep(1.0)  # 固定 1s 退避，加速失败让 fallback 接管

        raise RuntimeError(f"LLM relation extraction failed after {self._max_retries} retries: {last_error}")

    def _parse_relation_response(self, content: str) -> list[RelationExtractionResult]:
        """解析 LLM 响应为关系列表

        Args:
            content: LLM 返回的 JSON 字符串

        Returns:
            关系提取结果列表
        """
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            logger.warning("llm_response_not_json", content_preview=content[:200])
            return []

        relations = data.get("relations", [])
        if not isinstance(relations, list):
            return []

        results = []
        for rel_data in relations:
            if not isinstance(rel_data, dict):
                continue

            source = rel_data.get("source", "").strip()
            target = rel_data.get("target", "").strip()

            if not source or not target:
                continue

            # Open Relation Type (Banko et al., 2007; Gutierrez et al., 2024)
            # 已知类型保持原值，未知类型映射为 CUSTOM 并保留原始类型到 metadata
            raw_type = rel_data.get("type", KgRelationType.RELATED_TO.value)
            if raw_type in KgRelationType.all_values():
                relation_type = raw_type
                extra_metadata = {}
            else:
                relation_type = KgRelationType.CUSTOM.value
                extra_metadata = {"raw_relation_type": raw_type}

            result = RelationExtractionResult(
                source_name=source,
                target_name=target,
                relation_type=relation_type,
                description=rel_data.get("description"),
                confidence=float(rel_data.get("confidence", 1.0)),
                evidence=rel_data.get("evidence"),
                metadata=extra_metadata,
            )
            results.append(result)

        return results

    async def _fallback_extract(
        self,
        entities: list[GraphNode],
        text: str,
    ) -> list[GraphEdge]:
        """回退到共现提取器

        Args:
            entities: 实体节点列表
            text: 输入文本

        Returns:
            提取的关系边列表
        """
        from .strategy import CooccurrenceRelationExtractor

        fallback = CooccurrenceRelationExtractor()
        return await fallback.extract(entities, text)


# ============================================================================
# Composite Extractor (LLM + Regex fallback)
# ============================================================================


class CompositeEntityExtractor:
    """组合实体提取器

    优先使用 LLM 提取，失败时自动回退到正则提取。

    使用示例:
    ```python
    extractor = CompositeEntityExtractor(
        llm_model="gpt-4o-mini",
        enable_llm=True,
    )
    entities = await extractor.extract(text, corpus_id)
    ```
    """

    def __init__(
        self,
        llm_model: str | None = None,
        enable_llm: bool = True,
        fallback_to_regex: bool = True,
        schema: Any | None = None,
    ) -> None:
        """初始化组合提取器

        Args:
            llm_model: LLM 模型名称
            enable_llm: 是否启用 LLM 提取
            fallback_to_regex: 失败时是否回退到正则
            schema: ExtractionSchema 实例
        """
        self._enable_llm = enable_llm
        self._schema = schema
        self._llm_extractor = (
            LLMEntityExtractor(
                model=llm_model,
                fallback_to_regex=fallback_to_regex,
                schema=schema,
            )
            if enable_llm
            else None
        )

    async def extract(
        self,
        text: str,
        corpus_id: UUID,
    ) -> list[GraphNode]:
        """从文本中提取实体

        Args:
            text: 输入文本
            corpus_id: 语料库 ID

        Returns:
            提取的实体节点列表
        """
        if self._enable_llm and self._llm_extractor:
            return await self._llm_extractor.extract(text, corpus_id)

        # 禁用 LLM 时直接使用正则
        from .strategy import RegexEntityExtractor

        regex_extractor = RegexEntityExtractor()
        return await regex_extractor.extract(text, corpus_id)


class CompositeRelationExtractor:
    """组合关系提取器

    优先使用 LLM 提取，失败时自动回退到共现提取。
    """

    def __init__(
        self,
        llm_model: str | None = None,
        enable_llm: bool = True,
        fallback_to_cooccurrence: bool = True,
        schema: Any | None = None,
    ) -> None:
        """初始化组合提取器

        Args:
            llm_model: LLM 模型名称
            enable_llm: 是否启用 LLM 提取
            fallback_to_cooccurrence: 失败时是否回退到共现
            schema: ExtractionSchema 实例
        """
        self._enable_llm = enable_llm
        self._llm_extractor = (
            LLMRelationExtractor(
                model=llm_model,
                fallback_to_cooccurrence=fallback_to_cooccurrence,
                schema=schema,
            )
            if enable_llm
            else None
        )

    async def extract(
        self,
        entities: list[GraphNode],
        text: str,
    ) -> list[GraphEdge]:
        """从文本中提取关系

        Args:
            entities: 实体节点列表
            text: 输入文本

        Returns:
            提取的关系边列表
        """
        if self._enable_llm and self._llm_extractor:
            return await self._llm_extractor.extract(entities, text)

        # 禁用 LLM 时直接使用共现
        from .strategy import CooccurrenceRelationExtractor

        cooccurrence_extractor = CooccurrenceRelationExtractor()
        return await cooccurrence_extractor.extract(entities, text)
