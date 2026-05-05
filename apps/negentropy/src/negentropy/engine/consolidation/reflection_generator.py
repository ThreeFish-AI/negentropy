"""ReflectionGenerator — Phase 5 F2 Reflexion 失败反思生成器

设计目标：将 RetrievalTracker 收到的 ``irrelevant`` / ``harmful`` 反馈转化为
"语言形式的强化信号"，沉淀为 ``episodic`` 子类型记忆（``metadata.subtype='reflection'``），
供下次同类查询作为 Few-Shot 优先注入 ContextAssembler。

设计取舍：
- 复用 ``LLMFactExtractor`` 的成熟模式：retry + JSON output + pattern fallback；
- 不改 schema，反思以 ``Memory.metadata.subtype='reflection'`` 区分；
- 失败时降级到 pattern 模板，不影响主反馈写入；
- ``Memory.memory_type='episodic'`` 但语义与情景记忆不同，由 ``subtype`` 字段精确定位；
- 反思对象固定为"针对该次召回结果的避坑要点"，而非笼统总结。

参考文献:
[1] N. Shinn et al., "Reflexion: Language agents with verbal reinforcement learning,"
    Adv. Neural Inf. Process. Syst., vol. 36, pp. 8634–8652, 2023.
[2] J. Wei et al., "Chain-of-thought prompting elicits reasoning in large language models,"
    in Proc. NeurIPS, 2022.
"""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass

import litellm

from negentropy.engine.utils.model_config import resolve_model_config
from negentropy.logging import get_logger

logger = get_logger("negentropy.engine.consolidation.reflection_generator")

_VALID_OUTCOMES = {"irrelevant", "harmful"}
_MAX_LESSON_LEN = 240
_MAX_QUERY_PREVIEW_LEN = 512

_REFLECTION_PROMPT = """你是反思 Agent。下面这次记忆召回被用户标记为 {outcome}：

QUERY: {query}

RETRIEVED:
{snippets}

请输出 JSON：{{"lesson": "≤80字、用第二人称、可操作的避坑要点",
"applicable_when": ["触发该 lesson 的 2~4 个查询特征关键词"],
"anti_examples": ["不应再被召回的 1~2 句记忆摘要"]}}"""


@dataclass(frozen=True)
class Reflection:
    """单次失败反思的结构化输出。"""

    lesson: str
    applicable_when: list[str]
    anti_examples: list[str]
    method: str  # "llm" | "pattern"


class ReflectionGenerator:
    """LLM 驱动的失败反思生成器，pattern 模板兜底。"""

    def __init__(
        self,
        model: str | None = None,
        temperature: float = 0.0,
        max_retries: int = 3,
    ) -> None:
        self._model, self._model_kwargs = resolve_model_config(model)
        self._temperature = temperature
        self._max_retries = max_retries

    async def generate(
        self,
        *,
        query: str,
        retrieved_snippets: list[str],
        outcome: str,
    ) -> Reflection | None:
        """生成反思结构。

        Args:
            query: 原始检索查询（截断至 512 字符以防 prompt-injection）
            retrieved_snippets: 被召回的记忆 content 片段列表
            outcome: 反馈结果（``irrelevant`` 或 ``harmful``）

        Returns:
            Reflection；query 为空 / outcome 不合法时返回 None。
        """
        if outcome not in _VALID_OUTCOMES:
            return None
        if not query or not query.strip():
            return None
        safe_query = query.strip()[:_MAX_QUERY_PREVIEW_LEN]
        snippets = self._format_snippets(retrieved_snippets)

        try:
            ref = await self._llm_generate(query=safe_query, snippets=snippets, outcome=outcome)
            if ref is not None:
                return ref
        except Exception as exc:
            logger.warning("reflection_llm_failed_fallback", error=str(exc), model=self._model)

        return self._pattern_fallback(query=safe_query, snippets=retrieved_snippets, outcome=outcome)

    async def _llm_generate(
        self,
        *,
        query: str,
        snippets: str,
        outcome: str,
    ) -> Reflection | None:
        prompt = _REFLECTION_PROMPT.format(query=query, snippets=snippets, outcome=outcome)

        last_error: Exception | None = None
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
                logger.warning("reflection_llm_retry", attempt=attempt + 1, error=str(exc))
                await asyncio.sleep(2**attempt)
        raise RuntimeError(f"Reflection LLM generation failed after {self._max_retries} retries: {last_error}")

    def _parse_response(self, content: str) -> Reflection | None:
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            logger.warning("reflection_response_not_json", content_preview=content[:200])
            return None

        lesson = str(data.get("lesson", "")).strip()[:_MAX_LESSON_LEN]
        if not lesson:
            return None

        applicable_when_raw = data.get("applicable_when") or []
        anti_examples_raw = data.get("anti_examples") or []
        applicable_when = [str(x).strip()[:64] for x in applicable_when_raw if str(x).strip()][:6]
        anti_examples = [str(x).strip()[:240] for x in anti_examples_raw if str(x).strip()][:3]
        return Reflection(
            lesson=lesson,
            applicable_when=applicable_when,
            anti_examples=anti_examples,
            method="llm",
        )

    def _pattern_fallback(
        self,
        *,
        query: str,
        snippets: list[str],
        outcome: str,
    ) -> Reflection:
        """LLM 失败时的最低降级：基于关键词模板生成固定结构反思。"""
        snippet_preview = snippets[0][:120] if snippets else "（无召回内容）"
        lesson = (
            f"在涉及『{query[:40]}』类问题中，避免直接套用类似『{snippet_preview}』的记忆，"
            f"上次该召回被标记为 {outcome}。"
        )[:_MAX_LESSON_LEN]
        return Reflection(
            lesson=lesson,
            applicable_when=[query[:24]] if query else [],
            anti_examples=[snippets[0][:160]] if snippets else [],
            method="pattern",
        )

    @staticmethod
    def _format_snippets(snippets: list[str]) -> str:
        if not snippets:
            return "(empty)"
        lines: list[str] = []
        for idx, s in enumerate(snippets[:5], 1):
            preview = (s or "").strip().replace("\n", " ")[:200]
            if preview:
                lines.append(f"[{idx}] {preview}")
        return "\n".join(lines) if lines else "(empty)"


__all__ = ["Reflection", "ReflectionGenerator"]
