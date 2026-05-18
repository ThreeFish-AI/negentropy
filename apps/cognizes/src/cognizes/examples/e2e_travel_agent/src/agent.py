"""
Travel Agent 定义 - 完全对标 Google 官方 Demo
"""

from functools import cached_property
from google import genai
from google.adk.agents import LlmAgent
from google.adk.models import Gemini
from google.adk.tools import FunctionTool
from config import config

# 导入工具
from tools.flight_search import search_flights
from tools.hotel_booking import book_hotel, search_hotels
from tools.destination_search import recommend_destinations


class CustomGemini(Gemini):
    """自定义 Gemini 模型，支持自定义 API base_url"""

    @cached_property
    def api_client(self) -> genai.Client:
        """创建自定义 API 客户端"""
        client_kwargs = {"api_key": config.google_api_key}
        if config.google_base_url:
            client_kwargs["http_options"] = {"base_url": config.google_base_url}
        return genai.Client(**client_kwargs)


# Agent System Prompt (与 Google Demo 保持一致)
TRAVEL_AGENT_INSTRUCTIONS = """
You are a helpful travel assistant named Atlas. You help users plan their trips.

## Your Capabilities:
1. **Flight Search**: Search for flights to any destination
2. **Hotel Booking**: Search and book hotels
3. **Destination Recommendations**: Recommend destinations based on user preferences
4. **Preference Memory**: Remember and use user preferences (e.g., "I hate spicy food")

## Important Guidelines:
- Always confirm details before making bookings
- Remember user preferences for future conversations
- Be friendly and proactive in suggesting options
- If user mentions preferences, store them for later use

## State Management:
- Use `user:` prefix for persistent user preferences
- Use session state for current conversation context
"""


def create_travel_agent() -> LlmAgent:
    """创建 Travel Agent 实例"""

    # 定义工具 - ADK FunctionTool 会从函数名和 docstring 推断 name 和 description
    tools = [
        FunctionTool(func=search_flights),
        FunctionTool(func=search_hotels),
        FunctionTool(func=book_hotel),
        FunctionTool(func=recommend_destinations),
    ]

    # 创建自定义 Gemini 模型（支持 base_url）
    custom_model = CustomGemini(model=config.model_name)

    # 创建 Agent
    agent = LlmAgent(
        name="travel_agent_atlas",  # 必须是有效的 Python 标识符
        model=custom_model,
        instruction=TRAVEL_AGENT_INSTRUCTIONS,  # 注意：是 instruction 而非 instructions
        tools=tools,
    )

    return agent
