"""
MemorySummarizer: 用户记忆画像摘要生成器

受认知科学记忆再巩固 (Reconsolidation) 理论启发，将用户碎片记忆和事实
重蒸馏为结构化画像摘要，缓存在 memory_summaries 表中。

借鉴:
- LightMem 离线蒸馏压缩
- GraphRAG 层次化摘要
- Claude Code CLAUDE.md 文件持久化
- Letta self-editing memory

参考文献:
[1] S. J. Sara, "Reconsolidation and the stability of memory traces,"
    Current Opinion in Neurobiology, vol. 35, pp. 110-115, 2015.
"""

from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime, timedelta

import litellm
import sqlalchemy as sa

import negentropy.db.session as db_session
from negentropy.engine.adapters.postgres.summary_service import SummaryService
from negentropy.engine.factories.memory import get_fact_service
from negentropy.engine.utils.token_counter import TokenCounter
from negentropy.logging import get_logger
from negentropy.models.internalization import Memory, MemorySummary

logger = get_logger("negentropy.engine.consolidation.memory_summarizer")

_DEFAULT_TTL_HOURS = 24
_MAX_SOURCE_MEMORIES = 20
_MAX_SOURCE_FACTS = 30

_SUMMARY_PROMPT = """\
Generate a concise, structured user profile summary based on the \
following memory fragments and facts.

Memory fragments (recent conversations):
{memories}

Structured facts:
{facts}

Instructions:
1. Synthesize into a coherent user profile (~200-400 tokens)
2. Organize by: Role & Background, Key Preferences, \
Communication Style, Important Rules/Constraints
3. Resolve contradictions (prefer newer information)
4. Be factual — only include information supported by the provided data
5. Omit categories with no supporting data

Output as JSON:
{{"summary": "## User Profile\\n- **Role**: ...\\n- \
**Preferences**: ...\\n- **Communication**: ...\\n- **Rules**: ..."}}"""


class MemorySummarizer:
    """用户记忆画像摘要生成器"""

    def __init__(
        self,
        model: str | None = None,
        temperature: float = 0.0,
        max_retries: int = 3,
        ttl_hours: int = _DEFAULT_TTL_HOURS,
    ) -> None:
        self._model, self._model_kwargs = self._resolve_model_config(model)
        self._temperature = temperature
        self._max_retries = max_retries
        self._ttl = timedelta(hours=ttl_hours)
        self._summary_service = SummaryService()

    @staticmethod
    def _resolve_model_config(explicit_model: str | None) -> tuple[str, dict]:
        if explicit_model:
            return explicit_model, {}
        from negentropy.config.model_resolver import get_cached_llm_config, get_fallback_llm_config

        cached = get_cached_llm_config()
        if cached is not None:
            return cached[0], cached[1]
        return get_fallback_llm_config()

    async def get_or_generate_summary(self, user_id: str, app_name: str) -> MemorySummary | None:
        cached = await self._summary_service.get_summary(user_id=user_id, app_name=app_name)
        if cached and (datetime.now(UTC) - cached.updated_at.replace(tzinfo=UTC)) < self._ttl:
            return cached
        try:
            return await self.generate_summary(user_id, app_name)
        except Exception as exc:
            logger.warning("summary_generation_failed", user_id=user_id, error=str(exc))
            return cached

    async def generate_summary(self, user_id: str, app_name: str) -> MemorySummary | None:
        memories = await self._load_memories(user_id, app_name)
        facts = await self._load_facts(user_id, app_name)

        if not memories and not facts:
            logger.debug("no_data_for_summary", user_id=user_id)
            return None

        memories_text = "\n".join(f"- {m.content[:200]}" for m in memories)
        facts_text = "\n".join(f"- [{f_type}] {key}: {str(val)[:100]}" for f_type, key, val in facts)

        prompt = _SUMMARY_PROMPT.format(memories=memories_text, facts=facts_text)
        summary_text = await self._call_llm(prompt)

        if not summary_text:
            return None

        token_count = await TokenCounter.count_tokens_async(summary_text)
        return await self._summary_service.upsert_summary(
            user_id=user_id,
            app_name=app_name,
            summary_type="user_profile",
            content=summary_text,
            token_count=token_count,
            source_memory_count=len(memories),
            source_fact_count=len(facts),
            model_used=self._model,
        )

    async def _load_memories(self, user_id: str, app_name: str) -> list[Memory]:
        async with db_session.AsyncSessionLocal() as db:
            stmt = (
                sa.select(Memory)
                .where(Memory.user_id == user_id, Memory.app_name == app_name, Memory.retention_score > 0.1)
                .order_by(Memory.retention_score.desc(), Memory.created_at.desc())
                .limit(_MAX_SOURCE_MEMORIES)
            )
            result = await db.execute(stmt)
            return list(result.scalars().all())

    async def _load_facts(self, user_id: str, app_name: str) -> list[tuple[str, str, object]]:
        fact_service = get_fact_service()
        facts = await fact_service.list_facts(user_id=user_id, app_name=app_name, limit=_MAX_SOURCE_FACTS)
        return [(f.fact_type, f.key, f.value) for f in facts]

    async def _call_llm(self, prompt: str) -> str | None:
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
                data = json.loads(content)
                return data.get("summary", "")
            except Exception as exc:
                last_error = exc
                logger.warning("summary_llm_retry", attempt=attempt + 1, error=str(exc))
                await asyncio.sleep(2**attempt)

        logger.error("summary_llm_failed", error=str(last_error))
        return None
