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
        logger.debug(f"SessionSummarizer initialized with kwargs: {kwargs}")
        self.model = LiteLlm(settings.llm.full_model_name, **kwargs)

    async def generate_title(self, history: List[types.Content]) -> Optional[str]:
        """
        Generates a 3-5 word title for the given conversation history.
        """
        if not history:
            return None

        logger.info(f"Generating title with {len(history)} events")

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

            logger.debug(f"Title generation request: events={len(history)}, max_tokens=20")

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

            logger.debug(f"Raw LLM response: {len(response_text)} chars - {response_text[:100]}...")

            if response_text:
                title = response_text.strip().strip('"').strip("'")

                if len(title) > 100:
                    logger.warning(
                        f"Generated title too long ({len(title)} chars): {title[:100]}...",
                        history_length=len(history)
                    )
                    words = title.split()[:5]
                    title = " ".join(words)

                prefixes = ["Title:", "标题：", "Summary:", "摘要：", "The title is"]
                for prefix in prefixes:
                    if title.startswith(prefix):
                        title = title[len(prefix):].strip()

                if len(title) > 100:
                    logger.error(f"Title still too long after processing, returning None")
                    return None

                if len(title) < 3:
                    logger.warning(f"Generated title too short: '{title}'")
                    return None

                logger.info(f"Generated session title: {title}")
                return title

            return None

        except Exception as e:
            logger.warning(f"Failed to generate session title: {e}")
            return None
