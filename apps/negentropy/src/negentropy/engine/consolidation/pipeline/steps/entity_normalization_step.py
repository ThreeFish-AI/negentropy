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

import time

import litellm

from negentropy.engine.routine.faculty_bridge import run_faculty_json
from negentropy.engine.utils.json_extract import loads_lenient
from negentropy.engine.utils.model_config import resolve_model_config_async
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

    # task_registry.py 中登记的 task_key；用户可在 /interface/task-models 为本任务单独绑定模型。
    _TASK_KEY = "consolidation.entity_normalization"

    def __init__(self, max_retries: int = 1) -> None:
        self._model: str = ""
        self._model_kwargs: dict = {}
        self._max_retries = max_retries

    async def _resolve_model(self) -> None:
        self._model, self._model_kwargs = await resolve_model_config_async(self._TASK_KEY)

    async def run(self, ctx: PipelineContext) -> StepResult:
        start = time.perf_counter()
        if not ctx.facts:
            return StepResult(step_name=self.name, status="skipped", duration_ms=0, output_count=0)

        # 解析当前任务模型（resolver 内含 60s TTL 缓存）
        await self._resolve_model()

        facts_block = "\n".join(f"- [{f.fact_type}] {f.key}: {f.value}" for f in ctx.facts[:50])

        try:
            entities = await self._llm_normalize(facts_block)
        except Exception as exc:
            # 优雅降级：LLM 不可用时返回 success + degraded 标记
            # 在 fail_tolerant 策略下不中断管线，且下游可感知降级状态
            logger.warning(
                "entity_normalization_degraded",
                error=str(exc)[:200],
            )
            return StepResult(
                step_name=self.name,
                status="success",
                duration_ms=int((time.perf_counter() - start) * 1000),
                output_count=0,
                extra={"degraded": True, "reason": "llm_unavailable"},
            )

        ctx.entities.extend(entities)
        return StepResult(
            step_name=self.name,
            status="success",
            duration_ms=int((time.perf_counter() - start) * 1000),
            output_count=len(entities),
        )

    @staticmethod
    def _parse_entities(content: str) -> list[dict]:
        """解析 LLM JSON 为实体归一化列表（无效 / 空 → ``[]``）。"""
        data = loads_lenient(content)
        if not isinstance(data, dict):
            return []
        entities = data.get("entities", [])
        if not isinstance(entities, list):
            return []
        return [e for e in entities if isinstance(e, dict) and e.get("canonical")]

    async def _llm_normalize(self, facts_block: str) -> list[dict]:
        prompt = _PROMPT.format(facts=facts_block)

        from negentropy.config import settings

        enabled = settings.routine.faculty_bridge_enabled and settings.routine.faculty_bridge_consolidation_enabled

        def parse(text: str) -> list[dict] | None:
            # 缺 entities 键 / 非 dict → None 触发降级；含空 entities 的合法 dict → 接受 []。
            # 注：loads_lenient 解析失败恒返回 {}（见 json_extract），故须靠键存在性而非
            # isinstance(dict) 辨别脏输出，否则散文脏文本会被误判为「命中」而不降级 litellm。
            data = loads_lenient(text)
            if not isinstance(data, dict) or "entities" not in data:
                return None
            return self._parse_entities(text)

        async def fallback() -> list[dict]:
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
                    # loads_lenient 对不可解析文本返回 {}（见 json_extract），会把脏输出伪装成
                    # 「空实体成功」而丢失降级信号；故先校验响应确为含 entities 键的 dict，否则 raise
                    # 触发重试 / 最终 RuntimeError → run() 捕获记为 degraded（与严格 json.loads 时代等价）。
                    data = loads_lenient(content)
                    if not isinstance(data, dict) or "entities" not in data:
                        raise ValueError("entity_normalization: 响应非预期 JSON（缺 'entities' 键）")
                    return self._parse_entities(content)
                except Exception as exc:
                    last_error = exc
            raise RuntimeError(f"entity_normalization llm failed: {last_error}")

        entities, _used = await run_faculty_json(
            "internalization",
            prompt,
            parse=parse,
            fallback=fallback,
            enabled=enabled,
            timeout_seconds=float(settings.routine.faculty_bridge_batch_timeout_seconds),
            read_only=True,
        )
        return entities


__all__ = ["EntityNormalizationStep"]
