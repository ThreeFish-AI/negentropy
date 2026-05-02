"""
LLMFactExtractor: LLM 驱动的对话事实提取器

基于 LLM 结构化输出从对话文本中提取事实，覆盖正则无法匹配的间接偏好、
多句陈述和隐性规则。PatternFactExtractor 作为 LLM 不可用时的降级后备。

设计参照 knowledge/llm_extractors.py 的成熟模式：
- DB 优先模型配置解析 + 硬编码默认值回退
- litellm.acompletion + JSON structured output
- 指数退避重试
- 优雅降级到 PatternFactExtractor

参考文献:
[1] J. Wei et al., "Chain-of-thought prompting elicits reasoning in large language models," NeurIPS, 2022.
[2] Mem0, "Memory extraction and consolidation pipeline," Mem0 Documentation, 2025.
"""

from __future__ import annotations

import asyncio
import json

import litellm

from negentropy.engine.consolidation.fact_extractor import ExtractedFact, PatternFactExtractor
from negentropy.logging import get_logger

logger = get_logger("negentropy.engine.consolidation.llm_fact_extractor")

_VALID_FACT_TYPES = {"preference", "profile", "rule", "custom"}
_MAX_TURNS_PER_BATCH = 10
_MAX_CHARS_PER_BATCH = 3000
_MIN_KEY_LENGTH = 2

_EXTRACTION_PROMPT = """Analyze the following conversation turns and extract structured facts about the user.

Extract facts in these categories:
- preference: User likes, dislikes, prefers, or avoids something (direct or indirect)
- profile: User's identity, role, background, demographics
- rule: Instructions, constraints, or rules the user wants followed
- custom: Any other important factual information about the user

Conversation turns:
{turns}

Instructions:
1. Extract ALL factual statements about the user, including indirect preferences expressed through requests
2. Each fact should have a concise key and a descriptive value
3. Assign confidence between 0.5 and 1.0
4. Ignore greetings, small talk, and generic responses

Output as JSON:
{{"facts": [{{"type": "preference|profile|rule|custom", "key": "key", "value": "value", "confidence": 0.9}}]}}"""


class LLMFactExtractor:
    """LLM 驱动的对话事实提取器

    使用 LLM 结构化输出从对话轮次中提取事实。
    LLM 不可用或失败时自动降级到 PatternFactExtractor。
    """

    def __init__(
        self,
        model: str | None = None,
        temperature: float = 0.0,
        max_retries: int = 3,
    ) -> None:
        self._model, self._model_kwargs = self._resolve_model_config(model)
        self._temperature = temperature
        self._max_retries = max_retries
        self._fallback = PatternFactExtractor()

    @staticmethod
    def _resolve_model_config(explicit_model: str | None) -> tuple[str, dict]:
        if explicit_model:
            return explicit_model, {}
        from negentropy.config.model_resolver import get_cached_llm_config, get_fallback_llm_config

        cached = get_cached_llm_config()
        if cached is not None:
            return cached[0], cached[1]
        return get_fallback_llm_config()

    async def extract(self, turns: list[dict[str, str]]) -> list[ExtractedFact]:
        """从对话轮次中提取事实

        Args:
            turns: [{"author": "user"|"model", "text": "..."}, ...]

        Returns:
            提取出的事实列表（去重后）
        """
        user_turns = [t for t in turns if t.get("author") == "user" and t.get("text")]
        if not user_turns:
            return []

        try:
            all_facts: list[ExtractedFact] = []
            seen_keys: set[str] = set()

            for batch in self._batch_turns(user_turns):
                batch_facts = await self._extract_batch(batch)
                for fact in batch_facts:
                    dedup_key = f"{fact.fact_type}:{fact.key}"
                    if dedup_key not in seen_keys and len(fact.key) >= _MIN_KEY_LENGTH:
                        seen_keys.add(dedup_key)
                        all_facts.append(fact)

            logger.debug(
                "llm_facts_extracted",
                total_turns=len(user_turns),
                facts_count=len(all_facts),
                model=self._model,
            )
            return all_facts

        except Exception as exc:
            logger.warning(
                "llm_fact_extraction_failed_fallback",
                error=str(exc),
                model=self._model,
            )
            return self._fallback.extract(turns)

    def _batch_turns(self, turns: list[dict[str, str]]) -> list[list[dict[str, str]]]:
        """将 turns 分批（最多 10 条 / 3000 字符）"""
        batches: list[list[dict[str, str]]] = []
        current_batch: list[dict[str, str]] = []
        current_chars = 0

        for turn in turns:
            text_len = len(turn.get("text", ""))
            if (
                len(current_batch) >= _MAX_TURNS_PER_BATCH or current_chars + text_len > _MAX_CHARS_PER_BATCH
            ) and current_batch:
                batches.append(current_batch)
                current_batch = []
                current_chars = 0
            current_batch.append(turn)
            current_chars += text_len

        if current_batch:
            batches.append(current_batch)
        return batches

    async def _extract_batch(self, turns: list[dict[str, str]]) -> list[ExtractedFact]:
        """对一批 turns 执行 LLM 提取"""
        turns_text = "\n".join(f"[{t['author']}]: {t['text']}" for t in turns)
        prompt = _EXTRACTION_PROMPT.format(turns=turns_text)

        last_error = None
        for attempt in range(self._max_retries):
            try:
                safe_kwargs = {
                    k: v
                    for k, v in self._model_kwargs.items()
                    if k not in ("model", "messages", "temperature", "response_format")
                }
                response = await litellm.acompletion(
                    model=self._model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=self._temperature,
                    response_format={"type": "json_object"},
                    **safe_kwargs,
                )
                content = response.choices[0].message.content
                return self._parse_response(content)
            except Exception as exc:
                last_error = exc
                logger.warning("llm_fact_extraction_retry", attempt=attempt + 1, error=str(exc))
                await asyncio.sleep(2**attempt)

        raise RuntimeError(f"LLM fact extraction failed after {self._max_retries} retries: {last_error}")

    def _parse_response(self, content: str) -> list[ExtractedFact]:
        """解析 LLM JSON 响应为 ExtractedFact 列表"""
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            logger.warning("llm_fact_response_not_json", content_preview=content[:200])
            return []

        facts_data = data.get("facts", [])
        if not isinstance(facts_data, list):
            return []

        results: list[ExtractedFact] = []
        for item in facts_data:
            if not isinstance(item, dict):
                continue
            fact_type = item.get("type", "custom")
            if fact_type not in _VALID_FACT_TYPES:
                fact_type = "custom"
            key = item.get("key", "").strip()
            value = item.get("value", "").strip()
            if not key:
                continue
            try:
                confidence = float(item.get("confidence", 0.7))
            except (TypeError, ValueError):
                confidence = 0.7
            confidence = max(0.0, min(1.0, confidence))

            results.append(ExtractedFact(fact_type=fact_type, key=key, value=value or key, confidence=confidence))
        return results
