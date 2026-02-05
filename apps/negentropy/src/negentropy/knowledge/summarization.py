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
        kwargs["drop_params"] = True
        self.model = LiteLlm(settings.llm.full_model_name, **kwargs)

    async def generate_title(self, history: List[types.Content]) -> Optional[str]:
        """
        Generates a 3-5 word title for the given conversation history.
        """
        if not history:
            return None

        prompt = (
            "Summarize the conversation into a title of 3-5 words. "
            "Output ONLY the title text. No quotes. No prefixes. No explanations. "
            "Example: 'Project Planning Assistant'"
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

            if response_text:
                title = response_text.strip().strip('"')
                logger.info(f"Generated session title: {title}")
                return title

            return None

        except Exception as e:
            logger.warning(f"Failed to generate session title: {e}")
            return None
