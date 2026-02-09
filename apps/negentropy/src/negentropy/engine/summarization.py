"""
Session Summarization - 对话标题生成

将对话历史概括为短标题，属于 Session/Memory 治理范畴。

注意: 本模块从 knowledge/ 迁移而来，因为对话摘要是 Session 的职责，
与 Knowledge（静态文档）无关，遵循 Boundary Management 原则。
"""

from google.adk.models import LlmRequest
from google.adk.models.lite_llm import LiteLlm
from typing import List, Optional
from google.genai import types

from negentropy.config import settings
from negentropy.logging import get_logger

logger = get_logger("negentropy.engine.summarization")


class SessionSummarizer:
    """Uses LLM to summarize conversation history into a short title."""

    def __init__(self):
        kwargs = settings.llm.to_litellm_kwargs()
        kwargs["max_tokens"] = 20
        logger.debug("session_summarizer_initialized")
        self.model = LiteLlm(settings.llm.full_model_name, **kwargs)

    async def generate_title(self, history: List[types.Content]) -> Optional[str]:
        """
        Generates a 3-5 word title for the given conversation history.
        """
        if not history:
            return None

        logger.info("generating_title", event_count=len(history))

        prompt = (
            "请将以下对话内容概括为 3-5 个词的标题。\n"
            "仅输出标题文本，不要引号、前缀、冒号或任何解释。\n"
            "格式要求：直接输出标题，不要有 'Title:' 等前缀。\n\n"
            "Summarize the conversation into a title of 3-5 words. "
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
                    words = title.split()[:5]
                    title = " ".join(words)

                prefixes = ["Title:", "标题：", "Summary:", "摘要：", "The title is"]
                for prefix in prefixes:
                    if title.startswith(prefix):
                        title = title[len(prefix):].strip()

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
