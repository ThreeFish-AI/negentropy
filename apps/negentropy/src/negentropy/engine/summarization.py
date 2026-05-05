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

# Title 生成对长度做硬约束（max_tokens=20）；与 LiteLlm 默认参数合并后注入。
_TITLE_MAX_TOKENS = 20


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

    @classmethod
    async def create(cls) -> "SessionSummarizer":
        """异步工厂：从 DB 解析默认 LLM 配置（含 api_key）后构造 LiteLlm。

        与 commit 8ce35d5 修复 ``DynamicRootLiteLlm`` 的范式一致——所有默认
        模型路径统一走 ``resolve_llm_config()``，不再回退到无凭证的硬编码值。
        """
        from negentropy.config.model_resolver import resolve_llm_config

        name, kwargs = await resolve_llm_config()
        # 防御性浅拷贝：resolver 内部已 copy（model_resolver.py:80/90/448），
        # 这里再独立一份避免对调用方/缓存层的契约耦合，max_tokens 不污染上游 dict。
        kwargs = dict(kwargs)
        kwargs["max_tokens"] = _TITLE_MAX_TOKENS
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

            logger.debug("title_generation_request", event_count=len(history), max_tokens=20)

            request = LlmRequest(
                contents=chat_history,
                config=types.GenerateContentConfig(
                    system_instruction=prompt,
                    temperature=0.3,
                    max_output_tokens=20,
                ),
            )

            response_text = ""
            async for response in self.model.generate_content_async(request):
                if response.content and response.content.parts:
                    for part in response.content.parts:
                        if part.text:
                            response_text += part.text

            logger.debug("llm_response_received", response_length=len(response_text))

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
