"""EntityNormalizationStep — Memify 风格的实体规范化占位（opt-in）。

设计目标：在不引入新依赖的前提下，复用 ``LLMFactExtractor`` 的客户端做轻量规范化：
- 把 ``ctx.facts`` 里同一概念的多种表述（如 "TS"、"typescript"、"TypeScript"）
  归并到 canonical 形式，写回 ``ctx.entities``；
- 不实际入库（cognee Memify 的"after-write 后处理"理念，避免污染主写入路径）；
- 当前 LLM 不可用时降级为空白产出。

未来可演进为：
- 用 spaCy/NER 替代 LLM；
- 与 KG 实体注册表对齐做 entity linking。
"""

from __future__ import annotations

import json
import time

import litellm

from negentropy.engine.utils.model_config import resolve_model_config
from negentropy.logging import get_logger

from ..protocol import PipelineContext, StepResult
from ..registry import register

logger = get_logger("negentropy.engine.consolidation.pipeline.steps.entity_normalization")

_PROMPT = """你是实体规范化助手。下面是一组 fact，请把同一概念的不同表述归并：
FACTS:
{facts}

输出 JSON：{{"entities":[{{"canonical": "<规范名>", "aliases": ["<原始表述1>", ...], "kind": "<可选类型>"}}]}}"""


@register("entity_normalization")
class EntityNormalizationStep:
    name = "entity_normalization"

    def __init__(self, max_retries: int = 1) -> None:
        self._model, self._model_kwargs = resolve_model_config(None)
        self._max_retries = max_retries

    async def run(self, ctx: PipelineContext) -> StepResult:
        start = time.perf_counter()
        if not ctx.facts:
            return StepResult(step_name=self.name, status="skipped", duration_ms=0, output_count=0)

        facts_block = "\n".join(f"- [{f.fact_type}] {f.key}: {f.value}" for f in ctx.facts[:50])

        try:
            entities = await self._llm_normalize(facts_block)
        except Exception as exc:
            return StepResult(
                step_name=self.name,
                status="failed",
                duration_ms=int((time.perf_counter() - start) * 1000),
                error=str(exc),
            )

        ctx.entities.extend(entities)
        return StepResult(
            step_name=self.name,
            status="success",
            duration_ms=int((time.perf_counter() - start) * 1000),
            output_count=len(entities),
        )

    async def _llm_normalize(self, facts_block: str) -> list[dict]:
        prompt = _PROMPT.format(facts=facts_block)
        last_error: Exception | None = None
        for _ in range(self._max_retries):
            try:
                safe_kwargs = {
                    k: v
                    for k, v in self._model_kwargs.items()
                    if k not in ("model", "messages", "temperature", "response_format")
                }
                response = await litellm.acompletion(
                    model=self._model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.0,
                    response_format={"type": "json_object"},
                    **safe_kwargs,
                )
                content = response.choices[0].message.content
                data = json.loads(content)
                entities = data.get("entities", [])
                if isinstance(entities, list):
                    return [e for e in entities if isinstance(e, dict) and e.get("canonical")]
                return []
            except Exception as exc:
                last_error = exc
        raise RuntimeError(f"entity_normalization llm failed: {last_error}")


__all__ = ["EntityNormalizationStep"]
