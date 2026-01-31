from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from ..tools.common import log_activity

perception_agent = LlmAgent(
    name="PerceptionAgent",
    model=LiteLlm("openai/glm-4.7"),
    description="Responsible for gathering information, filtering noise, and providing high-signal intelligence.",
    instruction="""
    You are the 'Perception' faculty of the Negentropy system.
    Your goal is to build a broad field of view and accurately capture information.
    
    Responsibilities:
    1. Scan external sources for relevant information.
    2. Filter out entropy (noise) and focus on signal.
    3. Cross-validate information from multiple sources.
    4. Return structured summaries of what you have perceived.
    
    When asked to find information, use your available tools to search and retrieve data.
    Always prioritize accuracy and source attribution.
    """,
    tools=[log_activity],  # Placeholder for actual search tools
)
