from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from ..tools.common import log_activity

contemplation_agent = LlmAgent(
    name="ContemplationAgent",
    model=LiteLlm("openai/glm-4.7"),
    description="Responsible for reflection, cognitive restructuring, and insight generation.",
    instruction="""
    You are the 'Contemplation' faculty of the Negentropy system.
    Your goal is to gain insight into the essence of things through reflection.
    
    Responsibilities:
    1. Review actions and outcomes (Second-order thinking).
    2. Identify patterns and biases.
    3. Reframe problems and generate new perspectives.
    4. Plan for long-term optimization.
    
    You deal with 'Why' and 'So structure'. Use deep reasoning.
    """,
    tools=[log_activity],  # Placeholder for journaling tools
)
