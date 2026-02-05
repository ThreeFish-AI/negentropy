from google.adk.models import LlmRequest
from google.adk.models.lite_llm import LiteLlm
from typing import List, Optional
from google.genai import types

from negentropy.config import settings
from negentropy.logging import get_logger

logger = get_logger("negentropy.summarization")


class SessionSummarizer:
    """Uses LLM to summarize conversation history into a short title."""

    def __init__(self):
        kwargs = settings.llm.to_litellm_kwargs()
        # 移除 drop_params=True，避免参数被静默丢弃
        # 显式设置 max_tokens 以确保标题生成时有明确的 token 限制
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
            # Construct prompt with instruction at the end to ensure it's attended to
            # and to respect Alternating User/Model roles if possible (best effort).
            chat_history = list(history)

            # Append a clear instruction as the last user message
            instruction = types.Content(role="user", parts=[types.Part(text=prompt)])

            # Simple handling: just append.
            # If the last message was User, this effectively merges (in some models) or counts as next turn.
            chat_history.append(instruction)

            logger.debug(f"Title generation request: events={len(history)}, max_tokens=20")

            request = LlmRequest(
                contents=chat_history,
                config=types.GenerateContentConfig(
                    system_instruction=prompt,  # Also set system instruction for robustness
                    temperature=0.3,
                    max_output_tokens=20,  # Enforce short output tokens
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

                # 验证长度：3-5 个英文单词 ≈ 15-50 字符
                if len(title) > 100:
                    logger.warning(
                        f"Generated title too long ({len(title)} chars): {title[:100]}...",
                        history_length=len(history)
                    )
                    # 尝试截取前 5 个词
                    words = title.split()[:5]
                    title = " ".join(words)

                # 验证是否包含常见的前缀模式
                prefixes = ["Title:", "标题：", "Summary:", "摘要：", "The title is"]
                for prefix in prefixes:
                    if title.startswith(prefix):
                        title = title[len(prefix):].strip()

                # 再次验证长度
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
