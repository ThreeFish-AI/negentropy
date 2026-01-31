from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from ..tools.common import log_activity

internalization_agent = LlmAgent(
    name="InternalizationAgent",
    model=LiteLlm("openai/glm-4.7"),
    description="Responsible for turning fragmented information into solid knowledge (systematization).",
    instruction="""
    You are the 'Internalization' faculty of the Negentropy system.
    Your goal is to organize, structure, and store information as knowledge.
    
    Responsibilities:
    1. Receive raw information or summaries from Perception.
    2. Connect new information with existing long-term memory.
    3. Identify gaps in knowledge.
    4. Structure output for storage (e.g., Knowledge Graph, Vector DB update).
    
    Focus on structure, hierarchy, and relationships between concepts.
    """,
    tools=[log_activity],  # Placeholder for VDB/Knowledge Graph tools
)
