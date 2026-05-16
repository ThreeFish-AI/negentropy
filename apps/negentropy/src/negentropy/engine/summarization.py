"""
Session Summarization - 对话标题生成

将对话历史概括为短标题，属于 Session/Memory 治理范畴。

注意: 本模块从 knowledge/ 迁移而来，因为对话摘要是 Session 的职责，
与 Knowledge（静态文档）无关，遵循 Boundary Management 原则。
"""

import re

from google.adk.models import LlmRequest
from google.adk.models.lite_llm import LiteLlm
from google.genai import types

from negentropy.logging import get_logger

logger = get_logger("negentropy.engine.summarization")

# Title 生成对长度的硬约束在响应后处理阶段完成（汉字截 12 / 英文截 24，见
# ``generate_title`` 末尾），这里的 ``max_tokens`` 只用于保护 LLM 总输出预算。
#
# 历史值 20 在面向 reasoning 模型（gpt-5-mini / o1 / o3 等默认配置）时会被
# 内部 reasoning tokens 全数消耗，``response.content.parts`` 为空导致
# ``generate_title`` 返回 None。提升到 256 既能为 reasoning 留预算，又因后处理
# 截断保证 UI 不会被长标题撑破——这是 ISSUE-082 同源根因在 Session 标题路径
# 的呼应修复。
_TITLE_MAX_TOKENS = 256


class SessionSummarizer:
    """Uses LLM to summarize conversation history into a short title.

    凭证解析与 LiteLlm 构造由 ``create()`` 工厂统一在异步边界内完成，避免
    同步 ``__init__`` 在缓存未命中时回退到无 ``api_key`` 的硬编码默认值导致
    ``litellm.AuthenticationError``（与 ``DynamicRootLiteLlm._resolve_override``
    走同一 SoT：``resolve_llm_config()`` 从 DB 读取）。
    """

    def __init__(self, model: LiteLlm) -> None:
        self.model = model
        logger.debug("session_summarizer_initialized")

    # task_registry.py 中登记的 task_key；用户可在 /interface/task-models 为本任务单独绑定模型。
    _TASK_KEY = "session.title"

    @classmethod
    async def create(cls) -> "SessionSummarizer":
        """异步工厂：从 DB 解析当前任务对应 LLM 配置（含 api_key）后构造 LiteLlm。

        与 commit 8ce35d5 修复 ``DynamicRootLiteLlm`` 的范式一致——所有默认
        模型路径统一走 ``resolve_llm_config*()``，不再回退到无凭证的硬编码值。
        改造点：从 ``resolve_llm_config()`` 切换到 ``resolve_llm_config_for_task("session.title")``，
        以允许用户在 ``/interface/task-models`` 为标题生成单独指定模型。

        额外，对支持 reasoning 的 OpenAI 模型族（gpt-5 / o1 / o3 / o4）强制
        ``reasoning_effort="minimal"``——title 生成只需短文本响应，若不显式
        降低推理预算，模型会用尽 ``max_tokens`` 进行内部 reasoning 而返回
        空 content，导致 ``generate_title`` 一律失败（线上观察到的根因）。
        """
        from negentropy.config.model_resolver import (
            _split_vendor_and_model,
            _supports_anthropic_thinking,
            _supports_openai_reasoning,
            resolve_llm_config_for_task,
        )

        name, kwargs = await resolve_llm_config_for_task(cls._TASK_KEY)
        # 防御性浅拷贝：resolver 内部已 copy（model_resolver.py:80/90/448），
        # 这里再独立一份避免对调用方/缓存层的契约耦合，max_tokens 不污染上游 dict。
        kwargs = dict(kwargs)
        kwargs["max_tokens"] = _TITLE_MAX_TOKENS

        vendor, model_name = _split_vendor_and_model(name)
        if _supports_openai_reasoning(vendor or "", model_name):
            kwargs["reasoning_effort"] = "minimal"
        elif _supports_anthropic_thinking(vendor or "", model_name):
            # title 不需要 extended thinking；显式 disabled 避免吞光预算
            kwargs["thinking"] = {"type": "disabled"}

        return cls(LiteLlm(name, **kwargs))

    async def generate_title(self, history: list[types.Content]) -> str | None:
        """
        Generates a short title (roughly 12 Chinese character width) for the given conversation history.
        """
        if not history:
            return None

        logger.info("generating_title", event_count=len(history))

        prompt = (
            "请根据以下对话生成一个简短标题，长度约 10-12 个汉字（不超过 12 个汉字）。\n"
            "若为英文，尽量简短（不超过 24 个字符）。\n"
            "仅输出标题文本，不要引号、前缀、冒号或任何解释。\n"
            "格式要求：直接输出标题，不要有 'Title:' 等前缀。\n\n"
            "Summarize the conversation into a short title. "
            "Output ONLY the title text. No quotes. No prefixes. No explanations."
        )

        try:
            chat_history = list(history)
            instruction = types.Content(role="user", parts=[types.Part(text=prompt)])
            chat_history.append(instruction)

            logger.debug("title_generation_request", event_count=len(history), max_tokens=_TITLE_MAX_TOKENS)

            request = LlmRequest(
                contents=chat_history,
                config=types.GenerateContentConfig(
                    system_instruction=prompt,
                    temperature=0.3,
                    max_output_tokens=_TITLE_MAX_TOKENS,
                ),
            )

            response_text = ""
            async for response in self.model.generate_content_async(request):
                if response.content and response.content.parts:
                    for part in response.content.parts:
                        # 跳过 reasoning / thought parts（gpt-5 系反应模型常见），
                        # 仅采纳可见输出。否则 response_text 会混入推理流水账，
                        # 后处理截断后得到一段无意义片段。
                        if getattr(part, "thought", False):
                            continue
                        if part.text:
                            response_text += part.text

            logger.debug("llm_response_received", response_length=len(response_text))

            if not response_text:
                logger.warning("title_generation_empty_response", history_length=len(history))

            if response_text:
                title = response_text.strip().strip('"').strip("'")

                if len(title) > 100:
                    logger.warning(
                        "title_too_long",
                        title_length=len(title),
                        history_length=len(history),
                    )
                    words = title.split()[:8]
                    title = " ".join(words)

                prefixes = ["Title:", "标题：", "Summary:", "摘要：", "The title is"]
                for prefix in prefixes:
                    if title.startswith(prefix):
                        title = title[len(prefix) :].strip()

                # Normalize whitespace/newlines
                title = re.sub(r"\s+", " ", title).strip()

                # Enforce length for UI width (~12 Chinese chars)
                if re.search(r"[\u4e00-\u9fff]", title):
                    title = title[:12].strip()
                else:
                    if len(title) > 24:
                        title = title[:24].strip()

                if len(title) > 100:
                    logger.error("title_still_too_long_after_processing")
                    return None

                if len(title) < 3:
                    logger.warning("title_too_short", title_length=len(title))
                    return None

                logger.info("session_title_generated", title=title)
                return title

            return None

        except Exception as e:
            logger.warning("title_generation_failed", error=str(e))
            return None
